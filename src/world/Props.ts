import {
  AdditiveBlending,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  ShaderMaterial,
  SpotLight,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Texture,
} from 'three';
import type { Engine, System } from '../core/Engine.js';
import type { MaterialLibrary } from '../render/Materials.js';
import { skyEnvironment, updateWorldLight, worldLightUniforms } from '../render/WorldLighting.js';
import { clamp, smoothstep } from '../math/Noise.js';
import { hash3 } from '../math/PRNG.js';
import { ChunkGrid, type ChunkFactory } from './Chunks.js';
import {
  PROP_CAPACITY,
  PROP_CHUNK_M,
  PROP_KINDS,
  PROP_STRIDE,
  createPropChunk,
  fillPropChunk,
  type PropChunk,
  type PropKind,
  type WorldField,
} from './WorldField.js';
import {
  BEAM_LENGTH_M,
  LIGHTHOUSE_LENS_HEIGHT_M,
  buildBeamShaft,
  buildBellBuoy,
  buildBottle,
  buildCrate,
  buildJetty,
  buildLighthouseLantern,
  buildLighthouseTower,
  buildSeaArch,
  buildWreck,
} from './PropGeometry.js';
import propVert from '../shaders/world/prop.vert';
import propFrag from '../shaders/world/prop.frag';

/**
 * Everything on the coast that is not the coast.
 *
 * A lighthouse whose optic actually turns, bell buoys that ring because they are rolling, jetties
 * on pilings that reach the bottom, hulls on the shoals that would have put them there, arches
 * the sea has bored through a stack, and the crates and bottles that drift past and can be
 * fished out. All of it placed by `WorldField` — which asks the ground what it is rather than
 * rolling for a prop and then hunting for somewhere to stand it — and all of it deterministic
 * per chunk.
 *
 * Two pieces are worth reading closely:
 *
 *   * **The beam is a light and a shaft, and both are real.** A `SpotLight` sweeps the sea, so
 *     the boat is genuinely lit by it as it passes; a narrow additive cone is the scattering in
 *     the air along the same axis, and its brightness is tied to the visibility the weather
 *     system is already reporting. It switches on at solar altitude −0.833°, the standard sunset
 *     definition, from the live ephemeris — the same threshold the boat's navigation lights use.
 *   * **The bell rings because a pendulum in a tilted frame does.** The clapper's equilibrium is
 *     the buoy's own heel, so `θ'' = −(g/L)·sin(θ − φ) − cθ'` with φ read off the wave normal.
 *     Nothing schedules a chime: a flat calm is silent, a long swell tolls slowly, and a short
 *     sea clatters. That relationship is the entire reason to model it rather than loop a sample.
 */

/** Instances of each kind held resident. */
const CAPACITY: Record<PropKind, number> = {
  lighthouse: 4,
  buoy: 12,
  jetty: 8,
  wreck: 8,
  arch: 6,
  crate: 24,
  bottle: 24,
};

/**
 * How far each kind is drawn, metres.
 *
 * Not an optimisation so much as a correctness fix. The instance buffers are refilled from the
 * live chunks every frame and the live set is a dense array whose order changes as cells are
 * swap-removed, so if more props of a kind were in range than the buffer could hold, *which* of
 * them got drawn would change from frame to frame and they would flicker in and out. Ranges are
 * set so that the count in range is comfortably inside the capacity — and they happen to be the
 * ranges these things are visible at anyway. A lighthouse is the exception in both senses: it is
 * meant to be seen from a long way off, and there is never more than one nearby.
 */
const DRAW_RANGE_M: Record<PropKind, number> = {
  lighthouse: 3000,
  arch: 2600,
  jetty: 1400,
  wreck: 1200,
  buoy: 1200,
  crate: 600,
  bottle: 400,
};

/** Seconds for one revolution of the optic. Two panels, so a flash every four seconds. */
const BEAM_PERIOD_S = 8;
/** Luminous intensity of the sector light, candela-ish. It has to read against a twilight sky. */
const BEAM_INTENSITY = 260000;

/** Clapper pendulum: length in metres, damping per second, and the gap it swings before it hits. */
const CLAPPER_LENGTH_M = 0.42;
const CLAPPER_DAMPING = 0.55;
const CLAPPER_GAP = 0.24;
const CLAPPER_REARM_S = 0.14;
const GRAVITY = 9.80665;
/** Positional voices for bells. More than four ringing at once is a harbour, not a coast. */
const BELL_VOICES = 4;
/** Floats of per-slot bell state: angle, rate, frame heel, re-arm timer, last side struck. */
const BELL_STATE = 5;

/** Reach of the collectable grab, metres, and how far a floating prop rides out of the water. */
const CRATE_FREEBOARD = 0.18;

const matrix = new Matrix4();
const scratchPosition = new Vector3();
const scratchRotation = new Quaternion();
const scratchScale = new Vector3(1, 1, 1);
const scratchNormal = new Vector3();
const scratchTint = new Color();
const scratchTilt = new Quaternion();
const yAxis = new Vector3(0, 1, 0);
const heelAxis = new Vector3();

/** The sea, as the props need it. `Ocean` satisfies this structurally. */
export interface Swell {
  heightAt(x: number, z: number): number;
  normalAt(x: number, z: number, out: Vector3): Vector3;
}

/** The slice of `core/Audio`'s engine a bell needs. Passing the real one wires the sound up. */
export interface BellAudio {
  now(): number;
  createPanner(): PannerNode;
  setPosition(panner: PannerNode, x: number, y: number, z: number): void;
  playTone(options: {
    frequency: number;
    type?: OscillatorType;
    gain?: number;
    attack?: number;
    decay?: number;
    destination?: AudioNode;
    when?: number;
  }): void;
}

export interface Collectable {
  kind: PropKind;
  x: number;
  y: number;
  z: number;
}

export function createCollectable(): Collectable {
  return { kind: 'crate', x: 0, y: 0, z: 0 };
}

/** One drawable part of one kind. Lighthouses have two; everything else has one. */
interface PropPart {
  readonly kind: PropKind;
  readonly mesh: InstancedMesh;
  readonly tint: InstancedBufferAttribute;
  readonly palette: readonly Color[];
  count: number;
}

interface PropCell {
  readonly props: PropChunk;
  readonly bell: Float32Array;
}

export class Props implements System {
  readonly name = 'props';
  readonly priority = 16;

  private readonly engine: Engine;
  private readonly field: WorldField;
  private readonly grid: ChunkGrid<PropCell>;
  private readonly materials: ShaderMaterial[] = [];
  private readonly parts: PropPart[] = [];
  private readonly beam: Mesh;
  private readonly beamMaterial: MeshBasicMaterial;
  private readonly light: SpotLight;
  private readonly lightTarget = new Object3D();
  /** Ids of collectables already taken. Packed from the cell and the slot, so it survives reload. */
  private readonly taken = new Set<number>();
  private readonly panners: PannerNode[] = [];

  private swell: Swell | null = null;
  private audio: BellAudio | null = null;
  private bearing = 0;
  private beamStrength = 0;
  private lighthouseFound = false;
  private lighthouseX = 0;
  private lighthouseY = 0;
  private lighthouseZ = 0;
  private nextVoice = 0;

  private constructor(engine: Engine, field: WorldField, maps: PropMaps) {
    this.engine = engine;
    this.field = field;

    const paint = this.material(null, 0, 0.62, 0, -0.2);
    const iron = this.material(maps.metal, 0.85, 0.72, 1, -0.2);
    const timber = this.material(maps.timber, 1, 0.92, 0, 0.45);
    const rock = this.material(maps.rock, 1, 0.88, 0, 0.7);
    const glass = this.material(null, 0, 0.09, 0, 0.02);

    this.addPart('lighthouse', buildLighthouseTower(), paint, [
      new Color(0.79, 0.78, 0.75),
      new Color(0.74, 0.74, 0.72),
    ]);
    this.addPart('lighthouse', buildLighthouseLantern(), iron, [new Color(0.1, 0.1, 0.11)]);
    // Lateral marks: red to port, green to starboard, as they are on every buoyed channel.
    this.addPart('buoy', buildBellBuoy(), paint, [
      new Color(0.36, 0.05, 0.045),
      new Color(0.05, 0.26, 0.13),
    ]);
    this.addPart('jetty', buildJetty(), timber, [new Color(0.52, 0.49, 0.44)]);
    this.addPart('wreck', buildWreck(), timber, [new Color(0.21, 0.19, 0.17)]);
    this.addPart('arch', buildSeaArch(), rock, [new Color(0.84, 0.85, 0.83)]);
    this.addPart('crate', buildCrate(), timber, [
      new Color(0.6, 0.54, 0.44),
      new Color(0.48, 0.42, 0.35),
    ]);
    this.addPart('bottle', buildBottle(), glass, [new Color(0.24, 0.4, 0.29)]);

    this.beamMaterial = new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
      opacity: 0,
    });
    this.beam = new Mesh(buildBeamShaft(), this.beamMaterial);
    this.beam.frustumCulled = false;
    this.beam.renderOrder = 5;
    this.beam.visible = false;

    this.light = new SpotLight(0xfff2d8, 0, BEAM_LENGTH_M, 0.075, 0.35, 1.4);
    this.light.castShadow = false;
    this.light.target = this.lightTarget;
    engine.scene.add(this.beam, this.light, this.lightTarget);

    this.grid = new ChunkGrid<PropCell>(
      {
        chunkSize: PROP_CHUNK_M,
        create: (cx, cz): PropCell => {
          const cell: PropCell = {
            props: createPropChunk(),
            bell: new Float32Array(PROP_CAPACITY * BELL_STATE),
          };
          fillPropChunk(this.field, cx, cz, cell.props);
          return cell;
        },
        reset: (cell, cx, cz): void => {
          cell.bell.fill(0);
          fillPropChunk(this.field, cx, cz, cell.props);
        },
        retire: (): void => {
          // Nothing to hide: props are drawn from the live set every frame, so a retired cell
          // simply stops being walked.
        },
        destroy: (): void => {
          // The payload owns no GPU memory. All of that lives in the shared instanced meshes.
        },
      } satisfies ChunkFactory<PropCell>,
      engine.settings.world.seed ^ 0x9d04,
      { creationBudget: 2, hysteresis: 1, poolLimit: 24 },
    );
    this.grid.setDrawDistance(clamp(engine.settings.graphics.drawDistance, 1200, 3000));
  }

  static async create(
    engine: Engine,
    materials: MaterialLibrary,
    field: WorldField,
  ): Promise<Props> {
    const [metal, timber, rock] = await Promise.all([
      materials.load('Metal063', { repeat: 1 }),
      materials.load('Planks023A', { repeat: 1 }),
      materials.load('Rock064', { repeat: 1 }),
    ]);
    return new Props(engine, field, { metal: metal.map, timber: timber.map, rock: rock.map });
  }

  /** Hand the props the wave field so the floating ones actually float. */
  setSwell(swell: Swell | null): void {
    this.swell = swell;
  }

  /** Hand the props an audio engine so the bells are audible as well as visible. */
  setBellAudio(audio: BellAudio | null): void {
    this.audio = audio;
    for (const panner of this.panners) panner.disconnect();
    this.panners.length = 0;
    if (audio === null) return;
    for (let i = 0; i < BELL_VOICES; i += 1) this.panners.push(audio.createPanner());
  }

  /** Is the light lit this frame, and how strongly? The HUD and the journal both ask. */
  get beamLit(): number {
    return this.beamStrength;
  }

  /**
   * Take the nearest floating collectable within `radius`, if there is one.
   *
   * Returns false rather than allocating a result, and marks the item taken by a hash of its cell
   * and slot — which is stable, so the same crate stays taken across a reload of the same seed.
   */
  takeCollectable(x: number, z: number, radius: number, out: Collectable): boolean {
    let bestDistance = radius * radius;
    let bestId = 0;
    let found = false;

    for (const cell of this.grid.active) {
      const props = cell.props;
      for (let slot = 0; slot < props.count; slot += 1) {
        const base = slot * PROP_STRIDE;
        const kind = PROP_KINDS[props.data[base] ?? 0];
        if (kind !== 'crate' && kind !== 'bottle') continue;
        const id = collectableId(props.cx, props.cz, slot);
        if (this.taken.has(id)) continue;
        const px = props.data[base + 1] ?? 0;
        const pz = props.data[base + 3] ?? 0;
        const distance = (px - x) ** 2 + (pz - z) ** 2;
        if (distance >= bestDistance) continue;
        bestDistance = distance;
        bestId = id;
        found = true;
        out.kind = kind;
        out.x = px;
        out.z = pz;
        out.y = this.waterAt(px, pz);
      }
    }

    if (found) this.taken.add(bestId);
    return found;
  }

  fixedUpdate(dt: number): void {
    // The clapper is a stiff little pendulum with a period around 1.3 s; integrating it on the
    // frame clock would let it go unstable the moment the frame rate dipped.
    for (const cell of this.grid.active) {
      const props = cell.props;
      for (let slot = 0; slot < props.count; slot += 1) {
        if (PROP_KINDS[props.data[slot * PROP_STRIDE] ?? 0] !== 'buoy') continue;
        this.stepBell(cell, slot, dt);
      }
    }
  }

  update(dt: number, engine: Engine): void {
    const camera = engine.camera.position;
    this.grid.update(camera.x, camera.z);

    const environment = skyEnvironment(engine);
    for (const material of this.materials) {
      updateWorldLight(material.uniforms, engine, environment);
      const tide = material.uniforms['uTideHeight'];
      if (tide !== undefined) tide.value = engine.world.tideHeight;
    }

    for (const part of this.parts) part.count = 0;
    this.lighthouseFound = false;
    let nearestLighthouse = Number.POSITIVE_INFINITY;

    for (const cell of this.grid.active) {
      const props = cell.props;
      for (let slot = 0; slot < props.count; slot += 1) {
        const base = slot * PROP_STRIDE;
        const kind = PROP_KINDS[props.data[base] ?? 0];
        if (kind === undefined) continue;
        if (
          (kind === 'crate' || kind === 'bottle') &&
          this.taken.has(collectableId(props.cx, props.cz, slot))
        ) {
          continue;
        }

        const x = props.data[base + 1] ?? 0;
        const z = props.data[base + 3] ?? 0;
        const range = DRAW_RANGE_M[kind];
        if ((x - camera.x) ** 2 + (z - camera.z) ** 2 > range * range) continue;

        this.pose(kind, cell, slot, x, props.data[base + 2] ?? 0, z);
        const size = props.data[base + 5] ?? 1;
        scratchScale.set(size, size, size);
        matrix.compose(scratchPosition, scratchRotation, scratchScale);

        for (const part of this.parts) {
          if (part.kind !== kind || part.count >= part.mesh.instanceMatrix.count) continue;
          part.mesh.setMatrixAt(part.count, matrix);
          const palette = part.palette[Math.floor((props.data[base + 6] ?? 0) * part.palette.length)];
          scratchTint.copy(palette ?? part.palette[0] ?? scratchTint);
          part.tint.setXYZ(part.count, scratchTint.r, scratchTint.g, scratchTint.b);
          part.count += 1;
        }

        if (kind === 'lighthouse') {
          const distance = (x - camera.x) ** 2 + (z - camera.z) ** 2;
          if (distance < nearestLighthouse) {
            nearestLighthouse = distance;
            this.lighthouseFound = true;
            this.lighthouseX = x;
            this.lighthouseY = (props.data[base + 2] ?? 0) + LIGHTHOUSE_LENS_HEIGHT_M * size;
            this.lighthouseZ = z;
          }
        }
      }
    }

    for (const part of this.parts) {
      part.mesh.count = part.count;
      part.mesh.visible = part.count > 0;
      part.mesh.instanceMatrix.needsUpdate = true;
      part.tint.needsUpdate = true;
    }

    this.updateBeam(dt, engine);
  }

  onSettingsChanged(engine: Engine): void {
    this.grid.setDrawDistance(clamp(engine.settings.graphics.drawDistance, 1200, 3000));
  }

  dispose(): void {
    this.grid.dispose();
    for (const part of this.parts) {
      part.mesh.dispose();
      part.mesh.geometry.dispose();
    }
    for (const material of this.materials) material.dispose();
    this.beam.geometry.dispose();
    this.beamMaterial.dispose();
    this.light.dispose();
    for (const panner of this.panners) panner.disconnect();
    this.panners.length = 0;
    this.engine.scene.remove(this.beam, this.light, this.lightTarget);
  }

  // ------------------------------------------------------------------------------- internals

  private material(
    map: Texture | null,
    mapStrength: number,
    roughness: number,
    metalness: number,
    splashLine: number,
  ): ShaderMaterial {
    const material = new ShaderMaterial({
      vertexShader: propVert,
      fragmentShader: propFrag,
      uniforms: {
        ...worldLightUniforms(),
        uAlbedo: { value: map },
        uMapStrength: { value: map === null ? 0 : mapStrength },
        uMapScale: { value: new Vector2(0.45, 0.45) },
        uRoughness: { value: roughness },
        uMetalness: { value: metalness },
        uSplashLine: { value: splashLine },
        uTideHeight: { value: 0 },
      },
    });
    this.materials.push(material);
    return material;
  }

  private addPart(
    kind: PropKind,
    geometry: BufferGeometry,
    material: ShaderMaterial,
    palette: readonly Color[],
  ): void {
    const capacity = CAPACITY[kind];
    const tint = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    geometry.setAttribute('aTint', tint);
    const mesh = new InstancedMesh(geometry, material, capacity);
    // The instance set is rebuilt from the live chunks every frame, so a bounding volume would
    // be stale by the time it was tested. There are never more than a hundred of these.
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.visible = false;
    this.engine.scene.add(mesh);
    this.parts.push({ kind, mesh, tint, palette, count: 0 });
  }

  /** Where a prop sits and how it is leaning, this frame. */
  private pose(kind: PropKind, cell: PropCell, slot: number, x: number, y: number, z: number): void {
    const base = slot * PROP_STRIDE;
    const yaw = cell.props.data[base + 4] ?? 0;
    const floats = kind === 'buoy' || kind === 'crate' || kind === 'bottle';

    if (!floats) {
      scratchPosition.set(x, y, z);
      scratchRotation.setFromAxisAngle(yAxis, yaw);
      return;
    }

    const surface = this.waterAt(x, z);
    scratchPosition.set(x, surface + (kind === 'buoy' ? 0 : CRATE_FREEBOARD), z);

    // A floating body's deck plane is the water's tangent plane, so the heel is simply the wave
    // normal — which is also, for a bell buoy, the forcing the clapper feels.
    if (this.swell === null) {
      scratchNormal.set(0, 1, 0);
    } else {
      this.swell.normalAt(x, z, scratchNormal);
    }

    heelAxis.copy(yAxis).cross(scratchNormal);
    const sine = heelAxis.length();
    if (sine < 1e-5) {
      scratchRotation.setFromAxisAngle(yAxis, yaw);
    } else {
      heelAxis.multiplyScalar(1 / sine);
      scratchRotation.setFromAxisAngle(heelAxis, Math.asin(Math.min(1, sine)));
      scratchRotation.multiply(scratchTilt.setFromAxisAngle(yAxis, yaw));
    }
    if (kind === 'buoy') {
      cell.bell[slot * BELL_STATE + 2] = Math.atan2(scratchNormal.x, Math.max(0.05, scratchNormal.y));
    }
  }

  private waterAt(x: number, z: number): number {
    return this.swell === null ? this.engine.world.tideHeight : this.swell.heightAt(x, z);
  }

  /**
   * One step of a clapper hanging in a heeling bell.
   *
   * The equilibrium of the pendulum is the frame's own tilt, so the whole model is the ordinary
   * pendulum equation written about `θ − φ`. When the swing exceeds the gap between clapper and
   * shoulder it has hit the bell, and the sound is the impact speed.
   */
  private stepBell(cell: PropCell, slot: number, dt: number): void {
    const base = slot * BELL_STATE;
    const angle = cell.bell[base] ?? 0;
    const rate = cell.bell[base + 1] ?? 0;
    const heel = cell.bell[base + 2] ?? 0;
    const rearm = cell.bell[base + 3] ?? 0;
    const side = cell.bell[base + 4] ?? 0;

    const acceleration =
      -(GRAVITY / CLAPPER_LENGTH_M) * Math.sin(angle - heel) - CLAPPER_DAMPING * rate;
    const nextRate = rate + acceleration * dt;
    const nextAngle = angle + nextRate * dt;

    const swing = nextAngle - heel;
    const struck = Math.sign(swing);
    if (Math.abs(swing) > CLAPPER_GAP && struck !== side && rearm <= 0) {
      const strength = clamp(Math.abs(nextRate) / 2.6, 0.08, 1);
      this.ring(cell, slot, strength);
      cell.bell[base + 3] = CLAPPER_REARM_S;
      cell.bell[base + 4] = struck;
      // The clapper loses most of its energy into the bell, which is what stops it buzzing.
      cell.bell[base] = heel + CLAPPER_GAP * struck;
      cell.bell[base + 1] = -nextRate * 0.35;
      return;
    }

    cell.bell[base] = nextAngle;
    cell.bell[base + 1] = nextRate;
    cell.bell[base + 3] = Math.max(0, rearm - dt);
  }

  /**
   * A struck bell: a strike note and a hum an octave below it.
   *
   * Two partials rather than one because a bell without its hum note is a doorbell. The decay of
   * the hum is twice the strike's, which is the other half of why a bell sounds like a bell.
   */
  private ring(cell: PropCell, slot: number, strength: number): void {
    const audio = this.audio;
    if (audio === null || this.panners.length === 0) return;

    const base = slot * PROP_STRIDE;
    const x = cell.props.data[base + 1] ?? 0;
    const z = cell.props.data[base + 3] ?? 0;
    const panner = this.panners[this.nextVoice % this.panners.length];
    this.nextVoice += 1;
    if (panner === undefined) return;

    audio.setPosition(panner, x, this.engine.world.tideHeight + 2, z);
    const when = audio.now();
    audio.playTone({
      frequency: 618,
      type: 'triangle',
      gain: 0.2 * strength,
      attack: 0.002,
      decay: 1.7,
      destination: panner,
      when,
    });
    audio.playTone({
      frequency: 309,
      type: 'sine',
      gain: 0.11 * strength,
      attack: 0.005,
      decay: 3.4,
      destination: panner,
      when,
    });
  }

  /**
   * Turn the optic and decide whether it is lit.
   *
   * −0.833° is the standard sunset altitude — the sun's upper limb on a sea horizon, refraction
   * included — and it comes from the live ephemeris rather than from a clock, so in June at
   * sixty north the light genuinely stays out until nearly midnight.
   */
  private updateBeam(dt: number, engine: Engine): void {
    this.bearing = (this.bearing + (Math.PI * 2 * dt) / BEAM_PERIOD_S) % (Math.PI * 2);

    const altitude = engine.world.ephemeris?.sunAltitudeDeg ?? 90;
    const night = 1 - smoothstep(-3.5, -0.833, altitude);
    this.beamStrength = this.lighthouseFound ? night : 0;

    if (this.beamStrength <= 0.001) {
      this.beam.visible = false;
      this.light.intensity = 0;
      return;
    }

    this.beam.visible = true;
    this.beam.position.set(this.lighthouseX, this.lighthouseY, this.lighthouseZ);
    this.beam.rotation.set(0, this.bearing, 0);

    this.light.position.copy(this.beam.position);
    this.lightTarget.position.set(
      this.lighthouseX + Math.sin(this.bearing) * BEAM_LENGTH_M,
      this.lighthouseY - 6,
      this.lighthouseZ + Math.cos(this.bearing) * BEAM_LENGTH_M,
    );
    this.lightTarget.updateMatrixWorld();
    this.light.intensity = BEAM_INTENSITY * this.beamStrength;

    // The shaft is scattering, so it is only as visible as the air is thick. On a clear night it
    // is a hint; in mist it is a solid bar — which is precisely how it behaves on a real coast.
    const haze = clamp(1 - engine.world.visibility / 20000, 0.06, 1);
    this.beamMaterial.opacity = this.beamStrength * (0.1 + haze * 0.55);
  }
}

interface PropMaps {
  metal: Texture | null;
  timber: Texture | null;
  rock: Texture | null;
}

/** A stable id for one collectable. Same seed, same cell, same slot — same crate, forever. */
function collectableId(cx: number, cz: number, slot: number): number {
  return hash3(cx, cz, slot);
}

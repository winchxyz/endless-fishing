import {
  AddEquation,
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  Vector3,
  type DataTexture,
  type Quaternion,
} from 'three';
import type { Engine, System } from '../core/Engine.js';
import type { Displacement, WaveBank } from '../math/Gerstner.js';
import { clamp, damp } from '../math/Noise.js';
import { PRNG } from '../math/PRNG.js';
import { WORKBOAT_FORM } from './Buoyancy.js';
import { createFoamTexture } from '../render/ProceduralTextures.js';
import {
  skyEnvironment,
  updateWorldLight,
  worldLightUniforms,
  type UniformMap,
} from '../render/WorldLighting.js';
import wakeVert from '../shaders/entities/wake.vert';
import wakeFrag from '../shaders/entities/wake.frag';
import sprayVert from '../shaders/entities/spray.vert';
import sprayFrag from '../shaders/entities/spray.frag';

/**
 * What the boat leaves behind it.
 *
 * This system exists because of a problem that is not a rendering problem at all. The boat moves,
 * the HUD says so, and nothing on screen changes — because the camera is locked to the hull and
 * the ocean clipmap is centred on the camera, so a sea with no fixed features in it looks
 * identical at eight knots and at rest. The fix is not more input plumbing; it is evidence.
 * A wake is that evidence, and it is the one visual cue that cannot be faked by moving the water,
 * because it is anchored to where the boat *has been*.
 *
 * Two pieces, and they answer to different physics:
 *
 *   * **The ribbon** is a strip of geometry skinned across a ring buffer of track samples. It
 *     carries the Kelvin wave systems — see `wake.vert`, where the derivation lives — and it sits
 *     on the sea by evaluating the same Gerstner bank the ocean's own vertex shader evaluates,
 *     from the same uniform arrays and the same clock. That last point is not a nicety: a ribbon
 *     with its own idea of the wave phase would float above a swell on one side and cut through
 *     it on the other, and there is no amount of alpha that hides it.
 *   * **The spray** is a GPU particle system. The CPU sets an emission level and an emitter
 *     transform once a frame; every droplet's arc is closed-form in the vertex shader.
 *
 * The wave clock is `engine.loop.simTime`, which is *identically* the number `Ocean` accumulates
 * into its own wave time — both are the same repeated sum of `FIXED_TIMESTEP` from zero, in the
 * same order, so they agree bit for bit. Reading it here rather than mirroring the accumulator is
 * the difference between one clock and two clocks that happen to agree today.
 */

/** Rows of track the ribbon is skinned across, and how far apart they are laid, metres. */
const TRACK_SAMPLES = 128;
const SAMPLE_SPACING_M = 0.7;
/** Vertices across the ribbon. Odd, so one column of them runs down the centreline. */
const RIBBON_LATERAL = 15;
/** How long a wake stays on the water before it is gone entirely, seconds. */
const WAKE_LIFETIME_S = 20;
/** Crest amplitude of a fully developed wake, metres. */
const WAKE_AMPLITUDE_M = 0.4;
/** Clearance over the water. Depth precision at a 20 km far plane is not generous. */
const WAKE_LIFT_M = 0.025;

/** Must match the ocean's own compile-time wave limit; the packed arrays are sized from it. */
const MAX_WAVES = 8;

/** Droplets at full instance density, and the floor the quality preset may not cut below. */
const MAX_SPRAY = 384;
const MIN_SPRAY = 72;
/**
 * Wrap period of the spray clock, seconds.
 *
 * Every particle lifetime is an exact submultiple of this, so the clock can be wrapped forever
 * without a single droplet jumping. See the header of `spray.vert`.
 */
const SPRAY_CYCLE_S = 16;
/**
 * Droplet diameter at mid-life, metres, at the full budget.
 *
 * Small. A bow throws a mist of drops a few centimetres across that atomise as they fly, and a
 * sprite big enough to see individually is a sprite big enough to read as smoke — which is what
 * half a metre looked like: grey puffs drifting past the cabin rather than water being thrown.
 */
const SPRAY_SIZE_M = 0.15;
const SPRAY_OPACITY = 0.85;

/**
 * Speed at which the bow is throwing all the water it is going to, m/s.
 *
 * About eight knots, which is this hull's top speed under power. Emission goes as the cube of the
 * fraction of it: the mass of water a bow throws per second is the flux through the bow wave —
 * an area that grows with speed, crossed at that speed — and that is a cube, not a line. It is
 * why a boat at four knots barely wets the foredeck and the same boat at eight is unpleasant.
 */
const SPRAY_REFERENCE_SPEED = 4.2;
/**
 * Vertical acceleration a landing has to exceed before it counts as a slam, m/s², and the range
 * over which it saturates. A hull dropping off a crest and stopping dead throws far more water
 * than the same hull cruising, and this is the term that puts it there.
 */
const SLAM_THRESHOLD = 6;
const SLAM_RANGE = 26;

/** Hull-space points the two effects hang off. Forward is −Z; the hull is 7.2 m long. */
const TRANSOM_OFFSET = new Vector3(0, 0, WORKBOAT_FORM.length / 2 - 0.1);
const BOW_EMITTER = new Vector3(0, 0.02, -(WORKBOAT_FORM.length / 2 - 0.55));

/** Scratch. Module level and reused, because `update` must not allocate. */
const hullAxis = new Vector3();
const hullForward = new Vector3();
const worldPoint = new Vector3();
const windVector = new Vector3();

/**
 * Premultiplied over-blend, shared by both materials.
 *
 * `src·1 + dst·(1 − src.a)` lets one shader both cover what is behind it and add to it: the foam
 * and the droplets composite, the specular glint is added on top of them, and neither needs a
 * second pass. Depth is tested but never written — this is water lying on water.
 */
const PREMULTIPLIED_OVER = {
  transparent: true,
  depthWrite: false,
  blending: CustomBlending,
  blendEquation: AddEquation,
  blendSrc: OneFactor,
  blendDst: OneMinusSrcAlphaFactor,
} as const;

/** The only thing the wake needs from the sea: the bank of waves it has to lie on. */
export interface WakeWater {
  readonly waveBank: WaveBank;
}

/** And from the boat. `Boat` satisfies this structurally. */
export interface WakeHull {
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly orientation: Quaternion;
  /** Vertical acceleration of the hull, m/s². The slam term reads it. */
  readonly verticalAcceleration: number;
}

export class Wake implements System {
  readonly name = 'wake';
  /** After the boat (20) has moved and before the camera (30) reads the frame. */
  readonly priority = 24;

  private readonly engine: Engine;
  private readonly water: WakeWater;
  private readonly hull: WakeHull;

  private readonly ribbon: Mesh;
  private readonly ribbonGeometry: BufferGeometry;
  private readonly ribbonMaterial: ShaderMaterial;
  private readonly trackA: Float32Array;
  private readonly trackB: Float32Array;
  private readonly attributeA: BufferAttribute;
  private readonly attributeB: BufferAttribute;

  private readonly spray: Mesh;
  private readonly sprayGeometry: InstancedBufferGeometry;
  private readonly sprayMaterial: ShaderMaterial;
  private readonly slots: InstancedBufferAttribute;

  private readonly foamTexture: DataTexture;

  /** The wave bank, packed the way `gerstner.glsl` reads it. Shared by both materials. */
  private readonly waveA = new Float32Array(MAX_WAVES * 4);
  private readonly waveB = new Float32Array(MAX_WAVES * 4);
  private readonly packScratch = new Float32Array(MAX_WAVES * 8);
  private packedBank: WaveBank | null = null;

  /** Scratch for the displacement inversion, and its answer. See `undisplace`. */
  private readonly waveScratch: Displacement = { x: 0, y: 0, z: 0 };
  private originX = 0;
  private originZ = 0;

  /** The boat's odometer, metres, and where it stood when the last track row was committed. */
  private arcLength = 0;
  private lastCommitArc = 0;
  /** Rows the boat has actually laid. Everything past this was seeded and must not be drawn. */
  private laidRows = 0;
  private lastX = 0;
  private lastZ = 0;
  /** Last heading with any way on. Held through a stop so a drifting boat keeps its wake straight. */
  private headingX = 0;
  private headingZ = -1;
  /** When the boat last had enough way on to make a wake. Starts a lifetime in the past. */
  private lastWakeTime = -WAKE_LIFETIME_S * 4;
  private emission = 0;
  private sprayBudget = MAX_SPRAY;

  constructor(engine: Engine, water: WakeWater, hull: WakeHull) {
    this.engine = engine;
    this.water = water;
    this.hull = hull;

    // The ocean's own foam, from the same generator with the same seed, so the wake and the
    // whitecaps beside it are literally the same material and not two whites that nearly match.
    this.foamTexture = createFoamTexture(512, engine.settings.world.seed ^ 0x9e37);

    const vertices = TRACK_SAMPLES * RIBBON_LATERAL;
    this.trackA = new Float32Array(vertices * 4);
    this.trackB = new Float32Array(vertices * 3);
    this.attributeA = new BufferAttribute(this.trackA, 4).setUsage(DynamicDrawUsage);
    this.attributeB = new BufferAttribute(this.trackB, 3).setUsage(DynamicDrawUsage);

    this.ribbonGeometry = buildRibbonGeometry();
    this.ribbonGeometry.setAttribute('aTrackA', this.attributeA);
    this.ribbonGeometry.setAttribute('aTrackB', this.attributeB);

    this.ribbonMaterial = new ShaderMaterial({
      vertexShader: wakeVert,
      fragmentShader: wakeFrag,
      defines: { MAX_WAVES },
      uniforms: {
        ...worldLightUniforms(),
        uWaveA: { value: this.waveA },
        uWaveB: { value: this.waveB },
        uWaveCount: { value: 0 },
        uWaveTime: { value: 0 },
        uTime: { value: 0 },
        uTrackLength: { value: 0 },
        uWaterLevel: { value: 0 },
        uLifetime: { value: WAKE_LIFETIME_S },
        uHalfBeam: { value: WORKBOAT_FORM.beam / 2 },
        uAmplitude: { value: WAKE_AMPLITUDE_M },
        uLift: { value: WAKE_LIFT_M },
        uSampleSpacing: { value: SAMPLE_SPACING_M },
        uLateralCells: { value: RIBBON_LATERAL - 1 },
        uMaxBehind: { value: TRACK_SAMPLES * SAMPLE_SPACING_M },
        uValidRows: { value: 0 },
        uFoam: { value: this.foamTexture },
      },
      ...PREMULTIPLIED_OVER,
      // The camera goes under the surface on a heavy landing, and a wake that vanishes when it
      // does is worse than the cost of drawing both faces of a strip this thin.
      side: DoubleSide,
      // A decal lying on the water needs both: the offset handles the depth slope of a strip
      // seen almost edge on, the lift in the shader handles the rest.
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -8,
    });

    this.ribbon = new Mesh(this.ribbonGeometry, this.ribbonMaterial);
    this.ribbon.frustumCulled = false;
    this.ribbon.renderOrder = 1;

    const rng = new PRNG(engine.settings.world.seed ^ 0x7a4e);
    const seeds = new Float32Array(MAX_SPRAY * 4);
    for (let i = 0; i < seeds.length; i += 1) seeds[i] = rng.next();
    this.slots = new InstancedBufferAttribute(new Float32Array(MAX_SPRAY), 1);

    this.sprayGeometry = buildSprayGeometry();
    this.sprayGeometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 4));
    this.sprayGeometry.setAttribute('aSlot', this.slots);

    this.sprayMaterial = new ShaderMaterial({
      vertexShader: sprayVert,
      fragmentShader: sprayFrag,
      defines: { MAX_WAVES },
      uniforms: {
        ...worldLightUniforms(),
        uWaveA: { value: this.waveA },
        uWaveB: { value: this.waveB },
        uWaveCount: { value: 0 },
        uWaveTime: { value: 0 },
        uTime: { value: 0 },
        uCycle: { value: SPRAY_CYCLE_S },
        uEmitter: { value: new Vector3() },
        uEmitterRight: { value: new Vector3(1, 0, 0) },
        uEmitterForward: { value: new Vector3(0, 0, -1) },
        uEmitterVelocity: { value: new Vector3() },
        uWind: { value: new Vector3() },
        uEmission: { value: 0 },
        uThrow: { value: 0 },
        uSize: { value: SPRAY_SIZE_M },
        uOpacity: { value: SPRAY_OPACITY },
        uWaterLevel: { value: 0 },
      },
      ...PREMULTIPLIED_OVER,
      side: DoubleSide,
    });

    this.spray = new Mesh(this.sprayGeometry, this.sprayMaterial);
    this.spray.frustumCulled = false;
    this.spray.renderOrder = 2;

    engine.scene.add(this.ribbon, this.spray);
    this.applyQuality();
    this.lastX = hull.position.x;
    this.lastZ = hull.position.z;
    this.seedTrack(0);
  }

  update(dt: number, engine: Engine): void {
    const simTime = engine.loop.simTime;
    const environment = skyEnvironment(engine);
    updateWorldLight(this.ribbonMaterial.uniforms, engine, environment);
    updateWorldLight(this.sprayMaterial.uniforms, engine, environment);
    this.syncWaveBank();

    const velocity = this.hull.velocity;
    // Speed over ground, horizontal only. Heave is not progress and does not make a wake.
    const speed = Math.hypot(velocity.x, velocity.z);

    this.advanceTrack(simTime, speed);
    this.updateSpray(dt, engine, speed);
  }

  onSettingsChanged(): void {
    this.applyQuality();
  }

  dispose(): void {
    this.engine.scene.remove(this.ribbon, this.spray);
    this.ribbonGeometry.dispose();
    this.ribbonMaterial.dispose();
    this.sprayGeometry.dispose();
    this.sprayMaterial.dispose();
    this.foamTexture.dispose();
  }

  // ------------------------------------------------------------------------------ the quality

  /**
   * Droplets are the only thing here that the preset may take away.
   *
   * The ribbon is fixed at every preset, deliberately: the degradation order in CLAUDE.md puts
   * instance density well below the water's own shading, and cutting the wake is cutting the
   * thing that tells the player the boat is moving. What the budget buys instead is fewer, larger
   * droplets — the plume keeps roughly its visual mass and simply gets coarser, which is a far
   * better trade than a bow that stops throwing water on a laptop.
   */
  private applyQuality(): void {
    this.sprayBudget = clamp(
      Math.round(MAX_SPRAY * this.engine.settings.graphics.instanceDensity),
      MIN_SPRAY,
      MAX_SPRAY,
    );
    this.sprayGeometry.instanceCount = this.sprayBudget;

    const divisor = Math.max(1, this.sprayBudget - 1);
    for (let i = 0; i < this.sprayBudget; i += 1) this.slots.setX(i, i / divisor);
    this.slots.needsUpdate = true;

    // Screen coverage goes as the square of the diameter, so compensating by the square root of
    // the lost count holds the plume's visual mass. Capped, because past a point a droplet is no
    // longer a droplet.
    setNumber(
      this.sprayMaterial.uniforms,
      'uSize',
      SPRAY_SIZE_M * clamp(Math.sqrt(MAX_SPRAY / this.sprayBudget), 1, 1.7),
    );
  }

  // --------------------------------------------------------------------------------- the wake

  /**
   * Repack the wave uniforms when — and only when — the ocean has rebuilt its bank.
   *
   * `Ocean` builds a new `WaveBank` whenever the wind moves enough to matter, so identity of the
   * instance is an exact test for "the sea has changed", with no state duplicated and nothing to
   * fall out of step.
   */
  private syncWaveBank(): void {
    const bank = this.water.waveBank;
    if (bank === this.packedBank) return;
    this.packedBank = bank;

    this.waveA.fill(0);
    this.waveB.fill(0);
    const count = bank.toUniformArray(this.packScratch);
    this.waveA.set(this.packScratch.subarray(0, count * 4));
    this.waveB.set(this.packScratch.subarray(count * 4, count * 8));
    setNumber(this.ribbonMaterial.uniforms, 'uWaveCount', count);
    setNumber(this.sprayMaterial.uniforms, 'uWaveCount', count);
  }

  /**
   * Lay track.
   *
   * Samples go down at a fixed *spatial* interval rather than a fixed time interval, so the
   * ribbon has the same resolution whatever the boat is doing and a boat at rest stops consuming
   * the buffer instead of filling it with a hundred copies of one point. The head row is pinned
   * to the transom every frame, so the wake never separates from the boat between commits.
   */
  private advanceTrack(simTime: number, speed: number): void {
    hullForward.set(0, 0, -1).applyQuaternion(this.hull.orientation);
    const planar = Math.hypot(hullForward.x, hullForward.z);
    if (planar > 1e-4) {
      this.headingX = hullForward.x / planar;
      this.headingZ = hullForward.z / planar;
    }

    const position = this.hull.position;
    this.arcLength += Math.hypot(position.x - this.lastX, position.z - this.lastZ);
    this.lastX = position.x;
    this.lastZ = position.z;

    if (this.arcLength - this.lastCommitArc > TRACK_SAMPLES * SAMPLE_SPACING_M) {
      // More ground covered in one frame than the whole buffer holds: a stalled tab, or a debug
      // teleport. There is no wake between here and there, so do not draw one.
      this.seedTrack(simTime);
    } else {
      let commits = 0;
      while (this.arcLength - this.lastCommitArc >= SAMPLE_SPACING_M && commits < TRACK_SAMPLES) {
        this.shiftTrack();
        this.lastCommitArc += SAMPLE_SPACING_M;
        this.laidRows = Math.min(TRACK_SAMPLES - 1, this.laidRows + 1);
        commits += 1;
      }
    }
    this.writeHead(simTime, speed);

    // The fragment shader discards a wake that has aged out, but a discarded fragment has still
    // been rasterised. A boat on a mooring leaves the ribbon covering a good part of the frame
    // for nothing, so once the last of it is older than its own lifetime the mesh goes away.
    if (speed > 0.3) this.lastWakeTime = simTime;
    this.ribbon.visible = simTime - this.lastWakeTime < WAKE_LIFETIME_S;

    const uniforms = this.ribbonMaterial.uniforms;
    setNumber(uniforms, 'uWaveTime', simTime);
    setNumber(uniforms, 'uTime', simTime);
    setNumber(uniforms, 'uTrackLength', this.arcLength);
    setNumber(uniforms, 'uWaterLevel', this.engine.world.tideHeight);
    setNumber(uniforms, 'uValidRows', this.laidRows / (TRACK_SAMPLES - 1));
  }

  /** Slide every row one place older. `copyWithin` is a memmove; it allocates nothing. */
  private shiftTrack(): void {
    const rowA = RIBBON_LATERAL * 4;
    const rowB = RIBBON_LATERAL * 3;
    this.trackA.copyWithin(rowA, 0, this.trackA.length - rowA);
    this.trackB.copyWithin(rowB, 0, this.trackB.length - rowB);
  }

  /**
   * The undisplaced coordinate whose water ends up over a given world point.
   *
   * This matters more than it looks. Gerstner waves move the surface sideways as well as up, by
   * as much as the wave's own amplitude, and `wake.vert` re-applies that displacement to place
   * the ribbon — because that is the only way it can be guaranteed to land on the ocean mesh.
   * So the track has to be *stored* in the wave field's own undisplaced frame. Recording the
   * transom's plain world position instead would leave the whole wake sliding a metre from side
   * to side as each swell passed under it, which is far more obvious than it sounds.
   *
   * The inversion is the same four-step fixed point `WaveBank.heightAt` uses, run once a frame
   * for one point rather than per vertex.
   */
  private undisplace(x: number, z: number, waveTime: number): void {
    const bank = this.water.waveBank;
    let originX = x;
    let originZ = z;
    for (let iteration = 0; iteration < 4; iteration += 1) {
      bank.evaluate(originX, originZ, waveTime, this.waveScratch);
      originX += x - (originX + this.waveScratch.x);
      originZ += z - (originZ + this.waveScratch.z);
    }
    this.originX = originX;
    this.originZ = originZ;
  }

  private writeHead(simTime: number, speed: number): void {
    worldPoint.copy(TRANSOM_OFFSET).applyQuaternion(this.hull.orientation).add(this.hull.position);
    this.undisplace(worldPoint.x, worldPoint.z, simTime);
    for (let lateral = 0; lateral < RIBBON_LATERAL; lateral += 1) {
      const a = lateral * 4;
      this.trackA[a] = this.originX;
      this.trackA[a + 1] = this.originZ;
      this.trackA[a + 2] = simTime;
      this.trackA[a + 3] = this.arcLength;
      const b = lateral * 3;
      this.trackB[b] = this.headingX;
      this.trackB[b + 1] = this.headingZ;
      this.trackB[b + 2] = speed;
    }
    this.attributeA.needsUpdate = true;
    this.attributeB.needsUpdate = true;
  }

  /**
   * Collapse the whole track onto the transom.
   *
   * Every row is given the *current* odometer reading, not an old one, so the wedge has zero
   * width and the ribbon has zero area. Seeding it with stale odometer values instead would put a
   * kilometre-wide fan of fully transparent triangles across the frame, which costs exactly as
   * much fill as an opaque one.
   */
  private seedTrack(simTime: number): void {
    worldPoint.copy(TRANSOM_OFFSET).applyQuaternion(this.hull.orientation).add(this.hull.position);
    this.undisplace(worldPoint.x, worldPoint.z, simTime);
    const stale = simTime - WAKE_LIFETIME_S * 4;
    for (let index = 0; index < TRACK_SAMPLES * RIBBON_LATERAL; index += 1) {
      const a = index * 4;
      this.trackA[a] = this.originX;
      this.trackA[a + 1] = this.originZ;
      this.trackA[a + 2] = stale;
      this.trackA[a + 3] = this.arcLength;
      const b = index * 3;
      this.trackB[b] = this.headingX;
      this.trackB[b + 1] = this.headingZ;
      this.trackB[b + 2] = 0;
    }
    this.lastCommitArc = this.arcLength;
    this.laidRows = 0;
    this.attributeA.needsUpdate = true;
    this.attributeB.needsUpdate = true;
  }

  // -------------------------------------------------------------------------------- the spray

  private updateSpray(dt: number, engine: Engine, speed: number): void {
    const hull = this.hull;
    const slam = clamp((hull.verticalAcceleration - SLAM_THRESHOLD) / SLAM_RANGE, 0, 1);
    const driven = clamp(speed / SPRAY_REFERENCE_SPEED, 0, 1);
    const target = clamp(driven * driven * driven + slam * 0.85, 0, 1);
    // Damped rather than applied straight. A slot switching on part way through its own cycle
    // would put a droplet in mid-air; a tenth of a second of ramp hides that, and it is also
    // about how long a sheet of water takes to build and leave the bow.
    this.emission = damp(this.emission, target, 12, dt);

    const uniforms = this.sprayMaterial.uniforms;
    const simTime = engine.loop.simTime;
    setNumber(uniforms, 'uTime', simTime % SPRAY_CYCLE_S);
    setNumber(uniforms, 'uWaveTime', simTime);
    setNumber(uniforms, 'uWaterLevel', engine.world.tideHeight);
    setNumber(uniforms, 'uEmission', this.emission);
    // A slam throws water whether or not the boat has any way on, so the launch speed carries
    // both terms and is not simply a function of speed.
    setNumber(uniforms, 'uThrow', 1.4 + speed * 0.85 + slam * 3.2);

    setVector(uniforms, 'uEmitter', worldPoint.copy(BOW_EMITTER).applyQuaternion(hull.orientation).add(hull.position));
    setVector(uniforms, 'uEmitterRight', hullAxis.set(1, 0, 0).applyQuaternion(hull.orientation));
    setVector(uniforms, 'uEmitterForward', hullForward.set(0, 0, -1).applyQuaternion(hull.orientation));
    setVector(uniforms, 'uEmitterVelocity', hull.velocity);
    setVector(uniforms, 'uWind', windVector.set(engine.world.windX, 0, engine.world.windZ));

    this.spray.visible = this.emission > 0.002;
  }
}

/**
 * The ribbon's parameter space: `position` is (lateral, 0, row fraction), not a world point.
 *
 * The vertex shader maps it onto the track, so the only thing that changes per frame is the track
 * itself. Indices connect each row to the next, which is what makes the strip a strip.
 */
function buildRibbonGeometry(): BufferGeometry {
  const local = new Float32Array(TRACK_SAMPLES * RIBBON_LATERAL * 3);
  for (let row = 0; row < TRACK_SAMPLES; row += 1) {
    for (let lateral = 0; lateral < RIBBON_LATERAL; lateral += 1) {
      const vertex = (row * RIBBON_LATERAL + lateral) * 3;
      local[vertex] = (lateral / (RIBBON_LATERAL - 1)) * 2 - 1;
      local[vertex + 1] = 0;
      local[vertex + 2] = row / (TRACK_SAMPLES - 1);
    }
  }

  const indices = new Uint16Array((TRACK_SAMPLES - 1) * (RIBBON_LATERAL - 1) * 6);
  let cursor = 0;
  for (let row = 0; row < TRACK_SAMPLES - 1; row += 1) {
    for (let lateral = 0; lateral < RIBBON_LATERAL - 1; lateral += 1) {
      const a = row * RIBBON_LATERAL + lateral;
      const b = a + 1;
      const c = a + RIBBON_LATERAL;
      const d = c + 1;
      indices[cursor] = a;
      indices[cursor + 1] = c;
      indices[cursor + 2] = b;
      indices[cursor + 3] = b;
      indices[cursor + 4] = c;
      indices[cursor + 5] = d;
      cursor += 6;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(local, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  // Every vertex is placed in the vertex shader, so a bounding volume computed from the
  // attribute would describe a two-metre square at the origin. Culling is off instead.
  geometry.boundingSphere = null;
  return geometry;
}

/** One unit quad, billboarded per instance in the vertex shader. */
function buildSprayGeometry(): InstancedBufferGeometry {
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(
      new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]),
      3,
    ),
  );
  geometry.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1));
  geometry.boundingSphere = null;
  return geometry;
}

function setNumber(uniforms: UniformMap, name: string, value: number): void {
  const uniform = uniforms[name];
  if (uniform !== undefined) uniform.value = value;
}

function setVector(uniforms: UniformMap, name: string, value: Vector3): void {
  const uniform = uniforms[name];
  if (uniform !== undefined) (uniform.value as Vector3).copy(value);
}

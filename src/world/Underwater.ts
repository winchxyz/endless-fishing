import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  RGBAFormat,
  SphereGeometry,
  UnsignedByteType,
  Vector3,
  type Texture,
} from 'three';
import type { Engine, System } from '../core/Engine.js';
import { PRNG } from '../math/PRNG.js';
import { clamp } from '../math/Noise.js';
import { createCausticsTexture } from '../render/ProceduralTextures.js';
import type { SwellSource } from './Seabed.js';

/**
 * Being under the water.
 *
 * The submerged view is not a colour grade over the surface one. Four things change, and all
 * four are optics rather than art direction:
 *
 *   * **Extinction is metres, not kilometres.** Above water, haze is a horizon effect. Below it,
 *     Jerlov's coefficients take the red out inside three metres and everything else inside
 *     forty, which is why a coastal sea bed is grey-green and why nothing is visible past the
 *     length of a boat. The extinction itself lives in `seabed.frag` and `fish.frag`, where the
 *     path length is known per pixel; this system owns the *background* — the radiance an
 *     infinitely long path through the water converges on, which is what fills every direction
 *     with no geometry in it.
 *   * **Caustics.** Light refracts through the moving surface and converges into a net on the
 *     bed. Driven here from the same `WaveBank` the surface geometry is built from, so the
 *     pattern's period and direction are the swell's and not a scroll speed someone liked.
 *   * **Suspended particulate.** Open water is never empty. Detritus drifting through the beam
 *     is the single strongest depth cue underwater, because it is the only thing near enough to
 *     the camera to have parallax.
 *   * **Shafts from the surface.** Refraction caps the sun at 48.6° from vertical however low it
 *     is in the sky — Snell's window — so the light down here always comes from nearly overhead,
 *     and the shafts lean far less than a naive projection of the sun vector would make them.
 *
 * `isSubmerged` and `submersion` are the public half: the audio system's lowpass and anything
 * the composer wants to do about the palette both read them rather than testing the camera
 * against the water themselves.
 */

/**
 * Jerlov diffuse attenuation and volume scattering, per metre.
 *
 * The TypeScript mirror of the constants in `shaders/ocean/ocean.frag`, which owns them. They
 * are here because the background colour has to be computed on the CPU — it is a uniform, not a
 * shaded surface — and it has to converge on exactly what the shaders converge on at long path,
 * or the water and the space between things would be two different colours.
 */
export const JERLOV_ABSORPTION_OCEANIC: readonly [number, number, number] = [0.42, 0.072, 0.028];
export const JERLOV_ABSORPTION_COASTAL: readonly [number, number, number] = [0.56, 0.19, 0.31];
export const JERLOV_SCATTER_OCEANIC: readonly [number, number, number] = [0.01, 0.038, 0.055];
export const JERLOV_SCATTER_COASTAL: readonly [number, number, number] = [0.028, 0.062, 0.048];

/** Refractive index of sea water. Fixes Snell's window at 48.6°. */
const WATER_IOR = 1.333;
/** Shortest possible path from the surface to a depth, as a fraction of that depth. */
const SNELL_SECANT = 0.66;

/** Radius of the background shell, metres. Nothing is visible at a tenth of it. */
const MURK_RADIUS = 1500;
/** Edge of the box particulate is kept inside, centred on the camera. */
const MOTE_BOX = 22;
const MAX_MOTES = 700;
/** Shafts of light from the surface, and how far down they reach. */
const SHAFT_COUNT = 11;
const SHAFT_LENGTH = 34;

/**
 * What an underwater-aware material needs each frame.
 *
 * Structural on purpose: `Seabed` and `Fish` take one of these and never import this file's
 * class, the same arrangement `Ocean.setCloudShadows` uses.
 */
export interface UnderwaterOptics {
  readonly caustics: Texture;
  /** 0..1. Zero at night and under solid overcast — there is no beam left to bend. */
  readonly causticsStrength: number;
  /** Metres of seabed one tile of the caustic sheet covers. */
  readonly causticsScale: number;
  /** Drift of the sheet, metres. Follows the swell. */
  readonly causticsOffsetX: number;
  readonly causticsOffsetZ: number;
  /** Cross-fade between the sheet's two phases, 0..1. */
  readonly causticsPhase: number;
  /** Jerlov mix: 0 clear oceanic, 1 turbid coastal. */
  readonly turbidity: number;
}

const scratchDirection = new Vector3();
const DOWN = new Vector3(0, -1, 0);

export class Underwater implements System, UnderwaterOptics {
  readonly name = 'underwater';
  readonly priority = 35;

  readonly caustics: Texture;
  causticsStrength = 0;
  causticsScale = 9;
  causticsOffsetX = 0;
  causticsOffsetZ = 0;
  causticsPhase = 0;
  /** Northern coastal water. Green-grey, and a long way from a tropical aquarium. */
  turbidity = 0.34;

  private readonly swell: SwellSource;
  private readonly murk: Mesh;
  private readonly murkMaterial: MeshBasicMaterial;
  private readonly murkGeometry: BufferGeometry;
  private readonly motes: Points;
  private readonly moteMaterial: PointsMaterial;
  private readonly moteGeometry: BufferGeometry;
  private readonly moteSprite: DataTexture;
  private readonly moteData: Float32Array;
  private readonly moteDrift: Float32Array;
  private readonly shafts: Group;
  private readonly shaftMesh: Mesh;
  private readonly shaftMaterial: MeshBasicMaterial;
  private readonly shaftGeometry: BufferGeometry;

  /** Linear HDR radiance the water converges on at long path. Also the particulate's colour. */
  private readonly waterColour = new Color();
  private surfaceY = 0;
  private cameraY = 0;
  private submersionAmount = 0;
  private moteCount = 0;
  private godRaysEnabled: boolean;

  constructor(engine: Engine, swell: SwellSource) {
    this.swell = swell;
    const graphics = engine.settings.graphics;
    this.godRaysEnabled = graphics.godRaysEnabled;

    this.caustics = engine.resources.track(
      createCausticsTexture(256, engine.settings.world.seed ^ 0xca05),
    );

    // --- background ---------------------------------------------------------------------------
    // Opaque and depth-*writing*, at a radius nothing can be seen at. Drawn after the sky dome
    // and the cloud resolve, both of which write no depth, so it covers them; and before the
    // ocean, the seabed and the fish, all of which are nearer and therefore pass the depth test
    // and draw over it. That ordering is why this is one mesh rather than a full-screen pass.
    this.murkGeometry = new SphereGeometry(MURK_RADIUS, 16, 12);
    this.murkMaterial = new MeshBasicMaterial({
      side: BackSide,
      depthTest: false,
      depthWrite: true,
      fog: false,
      toneMapped: false,
    });
    this.murk = new Mesh(this.murkGeometry, this.murkMaterial);
    this.murk.name = 'underwater:murk';
    this.murk.renderOrder = -500;
    this.murk.frustumCulled = false;
    this.murk.visible = false;
    engine.scene.add(this.murk);

    // --- particulate --------------------------------------------------------------------------
    const rng = new PRNG(engine.settings.world.seed ^ 0x3f07);
    this.moteData = new Float32Array(MAX_MOTES * 3);
    this.moteDrift = new Float32Array(MAX_MOTES * 3);
    for (let i = 0; i < MAX_MOTES; i += 1) {
      this.moteData[i * 3] = rng.range(-MOTE_BOX, MOTE_BOX) * 0.5;
      this.moteData[i * 3 + 1] = rng.range(-MOTE_BOX, MOTE_BOX) * 0.5;
      this.moteData[i * 3 + 2] = rng.range(-MOTE_BOX, MOTE_BOX) * 0.5;
      // Marine snow sinks at a few millimetres a second and is pushed about by everything else.
      this.moteDrift[i * 3] = rng.range(-0.05, 0.05);
      this.moteDrift[i * 3 + 1] = rng.range(-0.03, -0.004);
      this.moteDrift[i * 3 + 2] = rng.range(-0.05, 0.05);
    }
    this.moteGeometry = new BufferGeometry();
    this.moteGeometry.setAttribute('position', new BufferAttribute(this.moteData, 3));
    this.moteSprite = engine.resources.track(buildMoteSprite());
    this.moteMaterial = new PointsMaterial({
      map: this.moteSprite,
      size: 0.045,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.motes = new Points(this.moteGeometry, this.moteMaterial);
    this.motes.name = 'underwater:motes';
    this.motes.frustumCulled = false;
    this.motes.visible = false;
    this.motes.renderOrder = 5;
    engine.scene.add(this.motes);

    // --- shafts -------------------------------------------------------------------------------
    this.shaftGeometry = buildShafts(rng);
    this.shaftMaterial = new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      fog: false,
      toneMapped: false,
    });
    this.shaftMesh = new Mesh(this.shaftGeometry, this.shaftMaterial);
    this.shaftMesh.frustumCulled = false;
    // On the mesh rather than on the group: `renderOrder` is per object in three and a parent's
    // is not inherited, which is a silent no-op that costs an afternoon to find.
    this.shaftMesh.renderOrder = 4;
    this.shafts = new Group();
    this.shafts.name = 'underwater:shafts';
    this.shafts.add(this.shaftMesh);
    this.shafts.visible = false;
    engine.scene.add(this.shafts);

    this.applyDensity(graphics.instanceDensity);
  }

  /** True the moment the camera crosses the actual wave surface at its own position. */
  get isSubmerged(): boolean {
    return this.submersionAmount > 0.5;
  }

  /**
   * 0 above the water, 1 fully under, ramped over the last few centimetres.
   *
   * Hand this straight to `Audio.setSubmersion`: a hard switch at the waterline clicks the
   * master lowpass every time a wave washes past the camera, which on a boat is constantly.
   */
  get submersion(): number {
    return this.submersionAmount;
  }

  /** Metres the camera is below the surface. Zero above it. */
  get depthM(): number {
    return Math.max(0, this.surfaceY - this.cameraY);
  }

  /** The radiance the water converges on. Read by anything wanting to match the palette. */
  get waterRadiance(): Color {
    return this.waterColour;
  }

  update(dt: number, engine: Engine): void {
    const camera = engine.camera.position;
    const world = engine.world;

    this.surfaceY = this.swell.heightAt(camera.x, camera.z);
    this.cameraY = camera.y;
    // Ramped over thirty-five centimetres, which is about the height of the chop that washes
    // over a camera sitting on the gunwale.
    this.submersionAmount = clamp((this.surfaceY - camera.y) / 0.35, 0, 1);

    this.updateCaustics(engine, world.cloudiness);
    this.updateWaterColour(world.sceneIlluminanceLux);

    // Only once the camera is genuinely under, not the instant it grazes a crest.
    //
    // The murk shell is a full-screen wall of water colour drawn at renderOrder −500, which puts
    // it over the sky (−1000) and the star field (−900). Showing it for any submersion above
    // zero meant that in a Beaufort 6 sea — where the camera dips below a passing wave every few
    // seconds — it covered the entire frame. At night the water colour is nearly black, so the
    // sky, the stars and the moon all disappeared behind it. The threshold now matches
    // `isSubmerged`, so the shell and the flag that claims the player is underwater agree.
    const submerged = this.submersionAmount > 0.5;
    this.murk.visible = submerged;
    this.motes.visible = submerged;
    this.shafts.visible = submerged && this.godRaysEnabled && this.causticsStrength > 0.02;
    if (!submerged) return;

    this.murk.position.copy(camera);
    this.murkMaterial.color.copy(this.waterColour);

    this.updateMotes(dt, camera);
    if (this.shafts.visible) this.updateShafts(engine, camera);
  }

  onSettingsChanged(engine: Engine): void {
    const graphics = engine.settings.graphics;
    this.godRaysEnabled = graphics.godRaysEnabled;
    this.applyDensity(graphics.instanceDensity);
  }

  dispose(): void {
    this.murkGeometry.dispose();
    this.murkMaterial.dispose();
    this.moteGeometry.dispose();
    this.moteMaterial.dispose();
    this.shaftGeometry.dispose();
    this.shaftMaterial.dispose();
  }

  private applyDensity(instanceDensity: number): void {
    this.moteCount = Math.round(MAX_MOTES * clamp(instanceDensity, 0.15, 1));
    this.moteGeometry.setDrawRange(0, this.moteCount);
  }

  /**
   * Drive the caustic sheet from the wave bank.
   *
   * The dominant component's phase speed carries the pattern along the bed and its period sets
   * the cross-fade between the sheet's two phases, so the light on the sand pulses with the
   * swell that is actually passing overhead. Strength is the direct beam: no sun, no caustics,
   * because a caustic *is* a focused beam and an overcast sky has none to focus.
   */
  private updateCaustics(engine: Engine, cloudiness: number): void {
    const components = this.swell.waveBank.components;
    let dominant = 0;
    let directionX = 1;
    let directionZ = 0;
    let phaseSpeed = 3;
    for (let i = 0; i < components.length; i += 1) {
      const wave = components[i];
      if (wave === undefined || wave.amplitude <= dominant) continue;
      dominant = wave.amplitude;
      directionX = wave.directionX;
      directionZ = wave.directionZ;
      phaseSpeed = wave.frequency / Math.max(1e-4, wave.wavenumber);
    }

    // A quarter of the phase speed: the caustic net is the surface's curvature pattern, and it
    // slides much more slowly across the bed than the crests do across the surface.
    const elapsed = engine.loop.elapsed;
    const drift = phaseSpeed * 0.25 * elapsed;
    this.causticsOffsetX = directionX * drift;
    this.causticsOffsetZ = directionZ * drift;
    this.causticsPhase = 0.5 + 0.5 * Math.sin((elapsed * Math.PI * 2) / this.swell.waveBank.peakPeriod);

    const ephemeris = engine.world.ephemeris;
    const altitude = ephemeris === null ? 0 : ephemeris.sunDirectionRefracted.y;
    this.causticsStrength = clamp(altitude * 2.2, 0, 1) * (1 - clamp(cloudiness, 0, 1) * 0.9);
  }

  /**
   * The colour a long path through the water settles on.
   *
   * Deliberately the same expression `seabed.frag` and `fish.frag` reach as their path length
   * grows — the scattering albedo times the downwelling light that got this deep — so the
   * background and the fog on a distant rock are the same colour by construction rather than by
   * two people picking the same swatch.
   */
  private updateWaterColour(sceneIlluminanceLux: number): void {
    const sky = sceneIlluminanceLux / Math.PI;
    const depth = Math.max(0, this.surfaceY - this.cameraY);
    this.waterColour.setRGB(
      channelRadiance(0, this.turbidity, sky, depth),
      channelRadiance(1, this.turbidity, sky, depth),
      channelRadiance(2, this.turbidity, sky, depth),
    );
  }

  /**
   * Advance the particulate and wrap it around the camera.
   *
   * The wrap is a modulo of the offset from the camera, not a respawn: a mote that leaves the
   * box re-enters on the opposite face with the same drift, so the field is stationary in the
   * water while the box follows the eye. Respawning at random would make the near field twinkle.
   */
  private updateMotes(dt: number, camera: Vector3): void {
    const data = this.moteData;
    const drift = this.moteDrift;
    const span = MOTE_BOX;
    const half = span * 0.5;
    for (let i = 0; i < this.moteCount; i += 1) {
      const i3 = i * 3;
      let x = (data[i3] ?? 0) + (drift[i3] ?? 0) * dt;
      let y = (data[i3 + 1] ?? 0) + (drift[i3 + 1] ?? 0) * dt;
      let z = (data[i3 + 2] ?? 0) + (drift[i3 + 2] ?? 0) * dt;
      // The mote positions are relative to the point the geometry sits at, which follows the
      // camera; wrapping in that frame keeps them in front of the eye without moving them
      // relative to the water by more than one box edge at a time.
      if (x > half) x -= span;
      else if (x < -half) x += span;
      if (y > half) y -= span;
      else if (y < -half) y += span;
      if (z > half) z -= span;
      else if (z < -half) z += span;
      data[i3] = x;
      data[i3 + 1] = y;
      data[i3 + 2] = z;
    }
    this.moteGeometry.getAttribute('position').needsUpdate = true;

    this.motes.position.copy(camera);
    // Motes are lit by the same water they are suspended in, a little brighter than it because
    // they are close enough that nothing has absorbed the light between them and the eye.
    this.moteMaterial.color.copy(this.waterColour).multiplyScalar(2.6);
    this.moteMaterial.opacity = 0.34 * this.submersionAmount;
  }

  /**
   * Hang the shafts from the surface, leaning down-sun.
   *
   * The lean is the *refracted* direction, not the sun's own: Snell's law caps the underwater
   * zenith angle at 48.6° whatever the sun is doing, so shafts at sunset are still within fifty
   * degrees of vertical. Getting this wrong is the classic tell — horizontal god rays under
   * water are not a thing that happens.
   */
  private updateShafts(engine: Engine, camera: Vector3): void {
    const ephemeris = engine.world.ephemeris;
    this.shafts.position.set(camera.x, this.surfaceY, camera.z);

    if (ephemeris !== null) {
      const sun = ephemeris.sunDirectionRefracted;
      const horizontal = Math.hypot(sun.x, sun.z);
      const airZenith = Math.atan2(horizontal, Math.max(0, sun.y));
      const waterZenith = Math.asin(clamp(Math.sin(airZenith) / WATER_IOR, -1, 1));
      const spread = Math.sin(waterZenith);
      const scale = horizontal < 1e-5 ? 0 : spread / horizontal;
      scratchDirection.set(-sun.x * scale, -Math.cos(waterZenith), -sun.z * scale).normalize();
      this.shafts.quaternion.setFromUnitVectors(DOWN, scratchDirection);
    }

    // Shafts are the same beam the caustics are, so they come and go together.
    this.shaftMaterial.opacity = 0.5 * this.causticsStrength * this.submersionAmount;
    this.shaftMaterial.color.setRGB(
      this.waterColour.r * 6 + 0.02,
      this.waterColour.g * 5 + 0.05,
      this.waterColour.b * 4.5 + 0.05,
    );
  }
}

function lerpChannel(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  channel: number,
  t: number,
): number {
  const from = a[channel] ?? 0;
  const to = b[channel] ?? 0;
  return from + (to - from) * t;
}

/** In-scattered radiance in one channel, at a depth, for the current water type. */
function channelRadiance(channel: number, turbidity: number, sky: number, depth: number): number {
  const absorption = lerpChannel(
    JERLOV_ABSORPTION_OCEANIC,
    JERLOV_ABSORPTION_COASTAL,
    channel,
    turbidity,
  );
  const scatter = lerpChannel(JERLOV_SCATTER_OCEANIC, JERLOV_SCATTER_COASTAL, channel, turbidity);
  return scatter * sky * 0.55 * Math.exp((-absorption * depth) / SNELL_SECANT);
}

/**
 * A soft round sprite for the particulate.
 *
 * Square points read as pixel dirt on the lens rather than as anything in the water, and a
 * Gaussian falloff is the one thing that makes a 32-pixel sprite survive being drawn at three
 * pixels across.
 */
function buildMoteSprite(size = 32): DataTexture {
  const data = new Uint8Array(size * size * 4);
  const centre = (size - 1) * 0.5;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - centre) / centre;
      const dy = (y - centre) / centre;
      const falloff = Math.exp(-(dx * dx + dy * dy) * 4.2);
      const index = (y * size + x) * 4;
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
      data[index + 3] = Math.round(Math.min(1, falloff) * 255);
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Shafts of light hanging below the surface.
 *
 * Each one is a three-column strip: dark at both edges, bright down the middle, fading to
 * nothing at its lower end. Additive, so the dark columns contribute nothing and the shaft has
 * no silhouette at all — which is what a volume of lit water looks like and what a textured quad
 * with a visible rectangular edge does not.
 */
function buildShafts(rng: PRNG): BufferGeometry {
  const positions: number[] = [];
  const colours: number[] = [];
  const indices: number[] = [];

  for (let shaft = 0; shaft < SHAFT_COUNT; shaft += 1) {
    const angle = (shaft / SHAFT_COUNT) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const radius = rng.range(1.5, 9);
    const width = rng.range(0.35, 1.5);
    const length = SHAFT_LENGTH * rng.range(0.55, 1);
    const centreX = Math.cos(angle) * radius;
    const centreZ = Math.sin(angle) * radius;
    // Each shaft faces the axis it radiates from, so it stays broadside to a camera looking up
    // through the middle of the group.
    const alongX = -Math.sin(angle);
    const alongZ = Math.cos(angle);
    const base = positions.length / 3;

    for (let row = 0; row <= 1; row += 1) {
      // Shafts splay outwards as they descend, the way a beam through a rough surface does.
      const drop = -length * row;
      const flare = 1 + row * 0.7;
      const fade = row === 0 ? 1 : 0;
      for (let column = -1; column <= 1; column += 1) {
        const offset = column * width * flare;
        positions.push(centreX + alongX * offset, drop, centreZ + alongZ * offset);
        const edge = column === 0 ? 1 : 0;
        colours.push(edge * fade, edge * fade, edge * fade);
      }
    }

    // Row 0 is base+0..2, row 1 is base+3..5, so the quad between columns c and c+1 spans
    // (c, c+1) on the top row and (c+3, c+4) on the bottom.
    for (let column = 0; column < 2; column += 1) {
      const a = base + column;
      indices.push(a, a + 1, a + 4, a, a + 4, a + 3);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colours), 3));
  geometry.setIndex(indices);
  return geometry;
}

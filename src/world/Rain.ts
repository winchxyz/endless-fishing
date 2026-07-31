import {
  BufferAttribute,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  NormalBlending,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import type { Engine, System } from '../core/Engine.js';
import { skyEnvironment, updateWorldLight, worldLightUniforms } from '../render/WorldLighting.js';
import { PRNG } from '../math/PRNG.js';
import { clamp, damp } from '../math/Noise.js';
import rainVert from '../shaders/world/rain.vert';
import rainFrag from '../shaders/world/rain.frag';

/**
 * Rain.
 *
 * The weather system has published a precipitation figure since the day it was written, and every
 * consumer of it was invisible: it darkened the underside of the deck, it collapsed the
 * visibility, it opened the rain bed in the audio mix and it desaturated the grade. So a pinned
 * storm arrived with a Beaufort 9 sea, 1.4 km of visibility, rain on the soundtrack and a clear
 * view of nothing falling. This is the missing half of it, and `WorldState` has named it as a
 * wind consumer — "the rain slant" — since before there was anything to slant.
 *
 * **The field is a lattice, not a particle system.** A raindrop reaches terminal velocity within
 * about two metres of leaving the cloud base and holds it for the rest of the kilometre down, so
 * there is nothing to integrate: every drop in the sky has the same velocity, `wind + fall`, and
 * the whole field is one rigid lattice translating through the camera. That means no per-particle
 * state, no respawn logic, no sort — one instanced draw call, one uniform update a frame, and a
 * shower that is exactly as consistent at the end of an hour as at the start.
 *
 * **What is physical and what is a budget.** The fall speed, the slant, the streak length and the
 * way all three respond to the wind are physical and are derived below from published numbers.
 * The *count* is not: Marshall-Palmer puts something over four thousand drops in a cubic metre of
 * heavy rain, and this draws fourteen thousand across seventy thousand cubic metres. Each
 * instance therefore stands for a great many drops, which is the same bargain every rain in every
 * renderer makes; it is written down here rather than left to be discovered.
 *
 * **Why it is not in the cloud shader.** Rain near the eye is a parallax cue and nothing else can
 * substitute for it — a screen-space veil sits still when the boat rolls, and the roll is most of
 * what a storm feels like from a small boat. The far field is already handled, correctly, by the
 * visibility the same weather publishes.
 */

/** Drops drawn at full instance density. Scaled by the quality preset. */
const MAX_DROPS = 14000;

/**
 * The lattice, metres.
 *
 * Small, and that is the whole trick. The instance budget divided by the box volume is the drop
 * spacing, and rain only reads as rain when that spacing is a couple of metres: at seventy metres
 * a side the first version of this put fourteen thousand drops five metres apart and a Beaufort 9
 * downpour arrived as forty visible streaks. Nothing beyond about twenty metres contributes a
 * streak the eye can separate anyway — past that it is a veil, and the veil is already there in
 * the visibility the same weather publishes.
 */
const BOX = new Vector3(48, 30, 48);

/**
 * Terminal velocity of a 2 mm drop, m/s — Gunn and Kinzer's measurements, which are still the
 * reference table. Drizzle at 0.5 mm falls at about 2 m/s and a 5 mm drop at 9; the median volume
 * diameter of rain that is worth drawing sits near 2, and the shader spreads ±30 % about it.
 */
const TERMINAL_MS = 8.8;

/**
 * Shutter, seconds. A streak is what the sensor integrates while it is open, so this number sets
 * the length of every streak in the frame: at 1/48 s a drop falling at 8.8 m/s with 20 m/s of wind
 * behind it draws a 46 cm streak leaning 66° off vertical, which is what a photograph of a squall
 * looks like. It is deliberately not the frame time — a 180° shutter is the film convention and
 * the frame rate is not something the weather should be able to see.
 */
const SHUTTER_S = 1 / 48;

/**
 * Streak width, pixels, and it has a floor that is not about optics.
 *
 * A drop's true image is a fraction of a pixel across at any distance worth drawing, so the width
 * is a rendering decision either way. But below about two and a half pixels a long thin quad stops
 * being drawn as a line and starts being drawn as a row of dashes: the rasteriser only lights a
 * pixel whose *centre* the quad covers, and a near-horizontal streak two pixels tall crosses pixel
 * centres intermittently. There is no antialiasing to rescue it — SMAA is a post pass and sees the
 * dashes, not the quad that made them. Two and a half pixels is where the strip closes up, and the
 * opacity below is set against that width so the shower carries the same energy either way.
 */
const WIDTH_PX = 2.6;

/** Peak opacity of a single streak. */
const OPACITY = 0.3;

/** Scratch. Module-level so `update` allocates nothing. */
const scratchDrift = new Vector3();

export class Rain implements System {
  readonly name = 'rain';
  /** With the other entities: after the ocean has set the water level, before the composer. */
  readonly priority = 25;

  private readonly geometry: InstancedBufferGeometry;
  private readonly material: ShaderMaterial;
  private readonly mesh: Mesh;

  /** How far the lattice has drifted, already reduced modulo `BOX` on every axis. */
  private readonly drift = new Vector3();
  /** Damped fill, so a squall arrives and leaves instead of switching. */
  private fill = 0;

  constructor(engine: Engine) {
    const random = new PRNG(0x0a11_d20b);

    this.geometry = new InstancedBufferGeometry();
    // One quad: x is ±0.5 across the streak, y runs 0 at the head to 1 at the tail.
    this.geometry.setAttribute(
      'aCorner',
      new BufferAttribute(
        new Float32Array([-0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0]),
        3,
      ),
    );
    this.geometry.setIndex([0, 1, 2, 2, 1, 3]);

    const offsets = new Float32Array(MAX_DROPS * 3);
    const seeds = new Float32Array(MAX_DROPS * 2);
    for (let i = 0; i < MAX_DROPS; i += 1) {
      offsets[i * 3] = random.range(0, BOX.x);
      offsets[i * 3 + 1] = random.range(0, BOX.y);
      offsets[i * 3 + 2] = random.range(0, BOX.z);
      // The gate compares `aSeed.x` against the fill, so it has to be uniform on 0..1 for the
      // drawn fraction to equal the fill. Sorting it would make the gate a contiguous block of
      // the buffer and put every drawn drop in one corner of the box.
      seeds[i * 2] = random.range(0, 1);
      seeds[i * 2 + 1] = random.range(0, 1);
    }
    this.geometry.setAttribute('aOffset', new InstancedBufferAttribute(offsets, 3));
    this.geometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 2));
    // The lattice is centred on the camera every frame, so there is no meaningful bounding box
    // to cull against and three's own test would pop the whole shower in and out.
    this.geometry.boundingSphere = null;

    this.material = new ShaderMaterial({
      vertexShader: rainVert,
      fragmentShader: rainFrag,
      uniforms: {
        ...worldLightUniforms(),
        uBox: { value: BOX.clone() },
        uDrift: { value: new Vector3() },
        uStreak: { value: new Vector3() },
        uHalfResolution: { value: new Vector2(1, 1) },
        uWidthPx: { value: WIDTH_PX },
        uFill: { value: 0 },
        uWaterLevel: { value: 0 },
        uOpacity: { value: OPACITY },
      },
      transparent: true,
      // Rain is in front of the sea and behind the drops closer to the eye, and there are nine
      // thousand of them: sorting is meaningless and writing depth would let whichever drop
      // happened to be drawn first occlude the ones behind it.
      depthWrite: false,
      depthTest: true,
      blending: NormalBlending,
      // The quad is extruded in screen space, so its winding depends on which way the streak
      // happens to lean.
      side: DoubleSide,
    });

    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    // After the ocean and the boat, before the composer takes the frame.
    this.mesh.renderOrder = 40;
    this.mesh.visible = false;
    engine.scene.add(this.mesh);

    engine.resources.track(this.geometry);
    engine.resources.track(this.material);

    this.onSettingsChanged(engine);
  }

  update(dt: number, engine: Engine): void {
    const world = engine.world;
    const uniforms = this.material.uniforms;

    // Below a fiftieth the shower is a handful of drops nobody can see and the draw call is pure
    // cost, so it is genuinely switched off rather than drawn empty.
    const target = clamp((world.precipitation - 0.02) / 0.5, 0, 1);
    this.fill = damp(this.fill, target, 0.8, Math.min(dt, 0.1));
    this.mesh.visible = this.fill > 0.004;
    if (!this.mesh.visible) return;

    updateWorldLight(uniforms, engine, skyEnvironment(engine));

    // Velocity of every drop in the sky: the one wind vector, plus terminal fall.
    const velocityX = world.windX;
    const velocityY = -TERMINAL_MS;
    const velocityZ = world.windZ;

    // The drift is reduced modulo the box on each axis as it is accumulated, so it stays a small
    // number for the whole session and the lattice never quantises. `+ BOX` before the modulo
    // keeps it positive; the fall term is negative and JavaScript's `%` is not a modulo.
    this.drift.set(
      (this.drift.x + velocityX * dt + BOX.x) % BOX.x,
      (this.drift.y + velocityY * dt + BOX.y) % BOX.y,
      (this.drift.z + velocityZ * dt + BOX.z) % BOX.z,
    );
    (uniforms['uDrift']?.value as Vector3 | undefined)?.copy(this.drift);

    scratchDrift.set(velocityX * SHUTTER_S, velocityY * SHUTTER_S, velocityZ * SHUTTER_S);
    (uniforms['uStreak']?.value as Vector3 | undefined)?.copy(scratchDrift);

    const fill = uniforms['uFill'];
    if (fill !== undefined) fill.value = this.fill;
    const waterLevel = uniforms['uWaterLevel'];
    if (waterLevel !== undefined) waterLevel.value = world.tideHeight;

    // Heavier rain is denser as well as more numerous, and a streak in a downpour is a brighter
    // one because there is more water in the air behind it. Half a stop across the range.
    const opacity = uniforms['uOpacity'];
    if (opacity !== undefined) opacity.value = OPACITY * (0.72 + 0.5 * world.precipitation);

    const halfResolution = uniforms['uHalfResolution'];
    if (halfResolution !== undefined) {
      (halfResolution.value as Vector2).set(
        engine.width * engine.pixelRatio * 0.5,
        engine.height * engine.pixelRatio * 0.5,
      );
    }
  }

  onSettingsChanged(engine: Engine): void {
    // Instance density is the same knob that thins the gulls and the props, and rain is the last
    // thing in the degradation list that is still a draw call rather than a resolution.
    const density = clamp(engine.settings.graphics.instanceDensity, 0.1, 1);
    this.geometry.instanceCount = Math.max(1, Math.round(MAX_DROPS * density));
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}

import {
  AdditiveBlending,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { Engine, System } from '../core/Engine.js';
import { skyEnvironment, updateWorldLight, worldLightUniforms } from '../render/WorldLighting.js';
import { clamp } from '../math/Noise.js';
import { PRNG } from '../math/PRNG.js';
import { buildCetacean, buildGull, buildSpout } from './SeaLifeGeometry.js';
import birdsVert from '../shaders/entities/birds.vert';
import birdsFrag from '../shaders/entities/birds.frag';

/**
 * Seabirds, and the things that come up for air.
 *
 * The flock is a boids solve, but the rule that gives it its character is not one of the three
 * classic ones — it is that **a gull steers through the air, not over the ground.** Everything
 * here is integrated as an air velocity; the wind vector from `WorldState` is then added to get
 * the ground track. That single change produces, for free, every behaviour a person who has
 * watched gulls off a stern will recognise:
 *
 *   * They hang. Facing into a force 6 at their own cruising airspeed, their ground speed is
 *     nearly zero and they hover over the wake without a wingbeat.
 *   * They are blown. Above force 7 the wind exceeds what they can fly at, so the whole flock is
 *     carried downwind however hard it points into it, and it has to work its way back up.
 *   * They point the wrong way. A bird crabbing across a strong wind is aimed well off its own
 *     track, because the instance is oriented by its *air* velocity and not by where it is going.
 *
 * The wingbeat itself is in the vertex shader, where it belongs: identical geometry, per-vertex
 * work, and sixty flapping gulls through a CPU skinning path would be the wrong trade in every
 * direction. Amplitude is driven down as a bird settles into a glide, so a flock riding a gale is
 * a flock of stiff wings and not sixty metronomes.
 *
 * Dolphins and whales share the program and the flock's budget. They flap at zero amplitude, so
 * the same shader draws them without a branch.
 */

/** Gulls at full instance density. Scaled down by the quality preset. */
const MAX_GULLS = 48;
/** How far a bird may drift from the flock's focus before it is treated as gone. */
const FLOCK_RANGE_M = 260;
/** Neighbour radii, metres. */
const PERCEPTION_M = 26;
const SEPARATION_M = 7;
/** Airspeeds, m/s. A herring gull cruises around nine and can push fifteen. */
const CRUISE_AIRSPEED = 9;
const MAX_AIRSPEED = 15;
/** Height band the flock holds above the water when there is nothing to fish for, metres. */
const PATROL_LOW_M = 7;
const PATROL_HIGH_M = 26;
/** And when there is. */
const FEEDING_LOW_M = 3;
const FEEDING_HIGH_M = 11;

const SEPARATION_WEIGHT = 1.7;
const ALIGNMENT_WEIGHT = 0.55;
const COHESION_WEIGHT = 0.32;
const FOCUS_WEIGHT = 0.95;
const ALTITUDE_WEIGHT = 0.7;

/** Cetaceans resident at once, and how far off they work. */
const DOLPHINS = 6;
const WHALES = 2;
const DOLPHIN_RANGE_M = [90, 420] as const;
const WHALE_RANGE_M = [650, 1700] as const;
/** Seconds between one animal's surfacings, and how long each lasts. */
const DOLPHIN_INTERVAL_S = [14, 70] as const;
const WHALE_INTERVAL_S = [70, 260] as const;
const DOLPHIN_ARC_S = 1.5;
const WHALE_ARC_S = 7;
/** Seconds the blow hangs in the air after a whale breaks the surface. */
const SPOUT_S = 2.2;

/** Floats of cetacean state: x, z, heading, timer, interval, phase. */
const ANIMAL_STATE = 6;

const matrix = new Matrix4();
const scratchPosition = new Vector3();
const scratchDirection = new Vector3();
const scratchRotation = new Quaternion();
const scratchRoll = new Quaternion();
const scratchScale = new Vector3(1, 1, 1);
const UNIT_SCALE = new Vector3(1, 1, 1);
const steering = new Vector3();
const neighbourSum = new Vector3();
const separationSum = new Vector3();
const cohesionSum = new Vector3();
const focusPoint = new Vector3();
const FORWARD = new Vector3(0, 0, 1);
const Z_AXIS = new Vector3(0, 0, 1);

/**
 * Where the fish are. Returns false when nothing is schooling, and the flock falls back to
 * working the water around the boat — which is what gulls do when there is a boat and no fish.
 */
export type SchoolLocator = (out: Vector3) => boolean;

/** The sea surface, as the birds need it. `Ocean` satisfies this structurally. */
export interface SeaSurface {
  heightAt(x: number, z: number): number;
}

export class Birds implements System {
  readonly name = 'birds';
  readonly priority = 22;

  private readonly engine: Engine;
  private readonly gullMaterial: ShaderMaterial;
  private readonly cetaceanMaterial: ShaderMaterial;
  private readonly spoutMaterial: MeshBasicMaterial;
  private readonly gulls: InstancedMesh;
  private readonly dolphins: InstancedMesh;
  private readonly whales: InstancedMesh;
  private readonly spouts: InstancedMesh;

  /** Air velocity and world position, three floats each, indexed by bird. */
  private readonly velocity = new Float32Array(MAX_GULLS * 3);
  private readonly position = new Float32Array(MAX_GULLS * 3);
  private readonly amplitude: InstancedBufferAttribute;
  private readonly animals = new Float32Array((DOLPHINS + WHALES) * ANIMAL_STATE);
  private readonly rng: PRNG;

  private sea: SeaSurface | null = null;
  private locator: SchoolLocator | null = null;
  private flock = MAX_GULLS;
  private elapsed = 0;

  constructor(engine: Engine) {
    this.engine = engine;
    this.rng = new PRNG(engine.settings.world.seed ^ 0xb12d);

    this.gullMaterial = createAnimalMaterial(
      new Color(0.88, 0.885, 0.89),
      new Color(0.4, 0.44, 0.48),
      new Color(0.05, 0.05, 0.06),
      1,
      0.55,
    );
    // Countershaded, and wet: a surfacing animal is a mirror for about four seconds.
    this.cetaceanMaterial = createAnimalMaterial(
      new Color(0.58, 0.6, 0.59),
      new Color(0.1, 0.12, 0.13),
      new Color(0.08, 0.09, 0.1),
      0,
      0.22,
    );

    const gullGeometry = buildGull();
    this.amplitude = new InstancedBufferAttribute(new Float32Array(MAX_GULLS), 1);
    const phase = new InstancedBufferAttribute(new Float32Array(MAX_GULLS), 1);
    const rate = new InstancedBufferAttribute(new Float32Array(MAX_GULLS), 1);
    for (let i = 0; i < MAX_GULLS; i += 1) {
      phase.setX(i, this.rng.range(0, Math.PI * 2));
      // Wingbeat around 3.2 Hz, which is what a herring gull actually does in level flight.
      rate.setX(i, this.rng.range(17, 23));
      this.amplitude.setX(i, 0.5);
    }
    gullGeometry.setAttribute('aPhase', phase);
    gullGeometry.setAttribute('aRate', rate);
    gullGeometry.setAttribute('aAmplitude', this.amplitude);

    this.gulls = new InstancedMesh(gullGeometry, this.gullMaterial, MAX_GULLS);
    this.gulls.frustumCulled = false;

    // One fusiform body for both: a minke and a common dolphin differ in size and in almost
    // nothing else at the range either of them is ever seen from a small boat.
    const cetacean = buildCetacean();
    this.dolphins = new InstancedMesh(cetacean, this.cetaceanMaterial, DOLPHINS);
    this.whales = new InstancedMesh(cetacean, this.cetaceanMaterial, WHALES);
    this.dolphins.frustumCulled = false;
    this.whales.frustumCulled = false;

    this.spoutMaterial = new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
      opacity: 0.55,
    });
    this.spouts = new InstancedMesh(buildSpout(), this.spoutMaterial, WHALES);
    this.spouts.frustumCulled = false;

    engine.scene.add(this.gulls, this.dolphins, this.whales, this.spouts);
    this.applyQuality();
    this.scatter();
    for (let i = 0; i < DOLPHINS + WHALES; i += 1) this.reseat(i, true);
  }

  /** Hand the birds the wave field, so they fly over water rather than over a plane. */
  setSea(sea: SeaSurface | null): void {
    this.sea = sea;
  }

  /**
   * Tell the flock where the fish are.
   *
   * Optional by design: with no locator the gulls work the water around the boat, which is both
   * the correct default and the behaviour a player expects before they have caught anything.
   */
  setSchoolLocator(locator: SchoolLocator | null): void {
    this.locator = locator;
  }

  update(dt: number, engine: Engine): void {
    // Clamped because a tab that has been backgrounded hands back a delta that would scatter the
    // flock to the horizon in one step.
    const step = Math.min(dt, 0.05);
    this.elapsed += step;

    const world = engine.world;
    const environment = skyEnvironment(engine);
    updateWorldLight(this.gullMaterial.uniforms, engine, environment);
    updateWorldLight(this.cetaceanMaterial.uniforms, engine, environment);
    setNumber(this.gullMaterial.uniforms, 'uTime', this.elapsed);
    setNumber(this.cetaceanMaterial.uniforms, 'uTime', this.elapsed);

    const feeding = this.locator !== null && this.locator(focusPoint);
    if (!feeding) {
      focusPoint.set(engine.camera.position.x, this.waterAt(engine.camera.position.x, engine.camera.position.z), engine.camera.position.z);
    }

    this.steerFlock(step, world.windX, world.windZ, feeding);
    this.updateCetaceans(step, engine);
  }

  onSettingsChanged(): void {
    this.applyQuality();
  }

  dispose(): void {
    this.engine.scene.remove(this.gulls, this.dolphins, this.whales, this.spouts);
    this.gulls.geometry.dispose();
    this.dolphins.geometry.dispose();
    this.spouts.geometry.dispose();
    this.gulls.dispose();
    this.dolphins.dispose();
    this.whales.dispose();
    this.spouts.dispose();
    this.gullMaterial.dispose();
    this.cetaceanMaterial.dispose();
    this.spoutMaterial.dispose();
  }

  // -------------------------------------------------------------------------------- the flock

  private applyQuality(): void {
    this.flock = clamp(
      Math.round(MAX_GULLS * this.engine.settings.graphics.instanceDensity),
      6,
      MAX_GULLS,
    );
    this.gulls.count = this.flock;
  }

  private scatter(): void {
    const camera = this.engine.camera.position;
    for (let i = 0; i < MAX_GULLS; i += 1) {
      const bearing = this.rng.range(0, Math.PI * 2);
      const radius = this.rng.range(20, FLOCK_RANGE_M * 0.6);
      this.position[i * 3] = camera.x + Math.cos(bearing) * radius;
      this.position[i * 3 + 1] = this.rng.range(PATROL_LOW_M, PATROL_HIGH_M);
      this.position[i * 3 + 2] = camera.z + Math.sin(bearing) * radius;
      const heading = this.rng.range(0, Math.PI * 2);
      this.velocity[i * 3] = Math.cos(heading) * CRUISE_AIRSPEED;
      this.velocity[i * 3 + 1] = 0;
      this.velocity[i * 3 + 2] = Math.sin(heading) * CRUISE_AIRSPEED;
    }
  }

  private steerFlock(dt: number, windX: number, windZ: number, feeding: boolean): void {
    const low = feeding ? FEEDING_LOW_M : PATROL_LOW_M;
    const high = feeding ? FEEDING_HIGH_M : PATROL_HIGH_M;
    const perceptionSquared = PERCEPTION_M * PERCEPTION_M;
    const separationSquared = SEPARATION_M * SEPARATION_M;

    for (let i = 0; i < this.flock; i += 1) {
      const bi = i * 3;
      const px = this.position[bi] ?? 0;
      const py = this.position[bi + 1] ?? 0;
      const pz = this.position[bi + 2] ?? 0;

      neighbourSum.set(0, 0, 0);
      separationSum.set(0, 0, 0);
      cohesionSum.set(0, 0, 0);
      let neighbours = 0;

      for (let j = 0; j < this.flock; j += 1) {
        if (j === i) continue;
        const bj = j * 3;
        const dx = (this.position[bj] ?? 0) - px;
        const dy = (this.position[bj + 1] ?? 0) - py;
        const dz = (this.position[bj + 2] ?? 0) - pz;
        const distance = dx * dx + dy * dy + dz * dz;
        if (distance > perceptionSquared) continue;
        neighbours += 1;
        cohesionSum.x += dx;
        cohesionSum.y += dy;
        cohesionSum.z += dz;
        neighbourSum.x += this.velocity[bj] ?? 0;
        neighbourSum.y += this.velocity[bj + 1] ?? 0;
        neighbourSum.z += this.velocity[bj + 2] ?? 0;
        if (distance > separationSquared || distance < 1e-4) continue;
        // Repulsion goes as 1/r, so a near miss is decisive and a distant one is a nudge.
        const scale = 1 / distance;
        separationSum.x -= dx * scale;
        separationSum.y -= dy * scale;
        separationSum.z -= dz * scale;
      }

      steering.set(0, 0, 0);
      if (neighbours > 0) {
        steering.addScaledVector(separationSum, SEPARATION_WEIGHT * SEPARATION_M);
        steering.addScaledVector(neighbourSum, ALIGNMENT_WEIGHT / neighbours);
        steering.addScaledVector(cohesionSum, COHESION_WEIGHT / neighbours);
      }

      // Orbit the focus rather than converge on it: the radial term pulls in, the tangential one
      // is what turns a huddle into the wheeling column that forms over a bait ball.
      const fx = focusPoint.x - px;
      const fz = focusPoint.z - pz;
      const range = Math.hypot(fx, fz) || 1;
      const pull = clamp((range - 30) / 60, -0.6, 1);
      steering.x += ((fx / range) * pull - (fz / range) * 0.8) * FOCUS_WEIGHT * CRUISE_AIRSPEED;
      steering.z += ((fz / range) * pull + (fx / range) * 0.8) * FOCUS_WEIGHT * CRUISE_AIRSPEED;

      const surface = this.waterAt(px, pz);
      const target = clamp(py, surface + low, surface + high);
      steering.y += (target - py) * ALTITUDE_WEIGHT;

      let vx = (this.velocity[bi] ?? 0) + steering.x * dt;
      let vy = (this.velocity[bi + 1] ?? 0) + steering.y * dt;
      let vz = (this.velocity[bi + 2] ?? 0) + steering.z * dt;

      // Airspeed is bounded by the animal, not by the ground track. This is the whole trick.
      const airspeed = Math.hypot(vx, vy, vz);
      const clamped = clamp(airspeed, CRUISE_AIRSPEED * 0.55, MAX_AIRSPEED);
      const correction = clamped / Math.max(airspeed, 1e-4);
      vx *= correction;
      vy *= correction;
      vz *= correction;

      this.velocity[bi] = vx;
      this.velocity[bi + 1] = vy;
      this.velocity[bi + 2] = vz;
      this.position[bi] = px + (vx + windX) * dt;
      this.position[bi + 1] = Math.max(surface + 1.2, py + vy * dt);
      this.position[bi + 2] = pz + (vz + windZ) * dt;

      this.recall(i, windX, windZ);
      this.poseBird(i, vx, vy, vz);
    }

    this.gulls.instanceMatrix.needsUpdate = true;
    this.amplitude.needsUpdate = true;
  }

  /**
   * A bird carried out of range comes back as a different bird, upwind.
   *
   * Not a cheat: in a gale the flock over a boat genuinely turns over, and the alternative — a
   * bird that beats its way back against a force 8 — is both wrong and invisible, because it
   * happens a kilometre astern.
   */
  private recall(index: number, windX: number, windZ: number): void {
    const bi = index * 3;
    const dx = (this.position[bi] ?? 0) - focusPoint.x;
    const dz = (this.position[bi + 2] ?? 0) - focusPoint.z;
    if (dx * dx + dz * dz < FLOCK_RANGE_M * FLOCK_RANGE_M) return;

    const windSpeed = Math.hypot(windX, windZ);
    const upwindX = windSpeed > 0.1 ? -windX / windSpeed : 1;
    const upwindZ = windSpeed > 0.1 ? -windZ / windSpeed : 0;
    const spread = this.rng.range(-0.7, 0.7);
    const distance = this.rng.range(FLOCK_RANGE_M * 0.5, FLOCK_RANGE_M * 0.8);
    this.position[bi] = focusPoint.x + (upwindX * Math.cos(spread) - upwindZ * Math.sin(spread)) * distance;
    this.position[bi + 2] = focusPoint.z + (upwindX * Math.sin(spread) + upwindZ * Math.cos(spread)) * distance;
    this.position[bi + 1] = focusPoint.y + this.rng.range(PATROL_LOW_M, PATROL_HIGH_M);
  }

  private poseBird(index: number, vx: number, vy: number, vz: number): void {
    const bi = index * 3;
    scratchPosition.set(this.position[bi] ?? 0, this.position[bi + 1] ?? 0, this.position[bi + 2] ?? 0);
    scratchDirection.set(vx, vy, vz).normalize();
    scratchRotation.setFromUnitVectors(FORWARD, scratchDirection);
    // Bank into the turn: the horizontal component of the steering vector, read as a roll.
    const bank = clamp((steering.x * -vz + steering.z * vx) / 90, -0.9, 0.9);
    scratchRoll.setFromAxisAngle(Z_AXIS, bank);
    scratchRotation.multiply(scratchRoll);
    matrix.compose(scratchPosition, scratchRotation, UNIT_SCALE);
    this.gulls.setMatrixAt(index, matrix);

    // A gull climbing is working; a gull descending is on a fixed wing. The amplitude follows the
    // climb rate, which is why a flock hanging in a gale reads as still rather than as frantic.
    this.amplitude.setX(index, clamp(0.16 + vy * 0.09, 0.02, 0.62));
  }

  private waterAt(x: number, z: number): number {
    return this.sea === null ? this.engine.world.tideHeight : this.sea.heightAt(x, z);
  }

  // ---------------------------------------------------------------------------- the cetaceans

  /** Put an animal somewhere new, and set the clock for its next appearance. */
  private reseat(index: number, initial: boolean): void {
    const whale = index >= DOLPHINS;
    const base = index * ANIMAL_STATE;
    const camera = this.engine.camera.position;
    const range = whale ? WHALE_RANGE_M : DOLPHIN_RANGE_M;
    const interval = whale ? WHALE_INTERVAL_S : DOLPHIN_INTERVAL_S;
    const bearing = this.rng.range(0, Math.PI * 2);
    const distance = this.rng.range(range[0], range[1]);

    this.animals[base] = camera.x + Math.cos(bearing) * distance;
    this.animals[base + 1] = camera.z + Math.sin(bearing) * distance;
    this.animals[base + 2] = this.rng.range(0, Math.PI * 2);
    this.animals[base + 4] = this.rng.range(interval[0], interval[1]);
    // A first appearance is staggered across the whole interval so a fresh world does not open
    // with the entire pod breaching at once.
    this.animals[base + 3] = initial ? this.rng.range(0, this.animals[base + 4] ?? 1) : 0;
    this.animals[base + 5] = whale ? this.rng.range(0.85, 1.25) : this.rng.range(0.8, 1.2);
  }

  /**
   * Surfacings.
   *
   * An animal is invisible until its timer runs out, then follows one arc — up, over and back —
   * whose height above the water comes from a half sine, so it enters and leaves the surface
   * smoothly and its pitch is the derivative of that. A dolphin's arc clears the water entirely;
   * a whale's barely breaks it, and the blow is what you actually see.
   */
  private updateCetaceans(dt: number, engine: Engine): void {
    let dolphinCount = 0;
    let whaleCount = 0;
    let spoutCount = 0;

    for (let index = 0; index < DOLPHINS + WHALES; index += 1) {
      const whale = index >= DOLPHINS;
      const base = index * ANIMAL_STATE;
      const arc = whale ? WHALE_ARC_S : DOLPHIN_ARC_S;
      const timer = (this.animals[base + 3] ?? 0) + dt;
      this.animals[base + 3] = timer;

      const interval = this.animals[base + 4] ?? 60;
      if (timer > interval + arc) {
        this.reseat(index, false);
        continue;
      }
      if (timer < interval) continue;

      const progress = (timer - interval) / arc;
      const heading = this.animals[base + 2] ?? 0;
      const speed = whale ? 2.4 : 9;
      const travel = (progress - 0.5) * arc * speed;
      const x = (this.animals[base] ?? 0) + Math.sin(heading) * travel;
      const z = (this.animals[base + 1] ?? 0) + Math.cos(heading) * travel;
      const surface = this.waterAt(x, z);
      const size = this.animals[base + 5] ?? 1;
      const rise = whale ? 0.75 : 2.3;
      const lift = Math.sin(progress * Math.PI) * rise;
      const pitch = Math.cos(progress * Math.PI) * (whale ? 0.18 : 0.85);

      scratchPosition.set(x, surface + lift - (whale ? 1.5 : 0.55) * size, z);
      scratchDirection.set(
        Math.sin(heading) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(heading) * Math.cos(pitch),
      );
      scratchRotation.setFromUnitVectors(FORWARD, scratchDirection.normalize());
      const scale = size * (whale ? 7.4 : 1.15);
      scratchScale.set(scale, scale, scale);
      matrix.compose(scratchPosition, scratchRotation, scratchScale);

      if (whale) {
        this.whales.setMatrixAt(whaleCount, matrix);
        whaleCount += 1;
        // The blow: a column of vapour that hangs for a couple of seconds after the animal has
        // broken the surface, and which is how a whale is spotted at two kilometres.
        const sinceBlow = timer - interval;
        if (sinceBlow < SPOUT_S) {
          const grow = clamp(sinceBlow / 0.35, 0, 1) * clamp(1 - sinceBlow / SPOUT_S, 0, 1);
          scratchPosition.y = surface + lift + 0.6;
          scratchRotation.setFromAxisAngle(Z_AXIS, 0.18);
          scratchScale.set(1 + grow * 1.4, 1 + grow * 2.6, 1 + grow * 1.4);
          matrix.compose(scratchPosition, scratchRotation, scratchScale);
          this.spouts.setMatrixAt(spoutCount, matrix);
          spoutCount += 1;
        }
      } else {
        this.dolphins.setMatrixAt(dolphinCount, matrix);
        dolphinCount += 1;
      }
    }

    this.dolphins.count = dolphinCount;
    this.whales.count = whaleCount;
    this.spouts.count = spoutCount;
    this.dolphins.visible = dolphinCount > 0;
    this.whales.visible = whaleCount > 0;
    this.spouts.visible = spoutCount > 0;
    this.dolphins.instanceMatrix.needsUpdate = true;
    this.whales.instanceMatrix.needsUpdate = true;
    this.spouts.instanceMatrix.needsUpdate = true;
    this.spoutMaterial.opacity = clamp(0.25 + engine.world.windSpeed * 0.02, 0.25, 0.7);
  }
}

function setNumber(uniforms: Record<string, { value: unknown } | undefined>, name: string, value: number): void {
  const uniform = uniforms[name];
  if (uniform !== undefined) uniform.value = value;
}

function createAnimalMaterial(
  underside: Color,
  mantle: Color,
  tip: Color,
  translucency: number,
  roughness: number,
): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: birdsVert,
    fragmentShader: birdsFrag,
    uniforms: {
      ...worldLightUniforms(),
      uTime: { value: 0 },
      uUnderside: { value: underside },
      uMantle: { value: mantle },
      uTip: { value: tip },
      uTranslucency: { value: translucency },
      uRoughness: { value: roughness },
    },
    // Wings and flukes are single-sided cards standing in for something with two faces.
    side: DoubleSide,
  });
}

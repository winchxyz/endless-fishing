import {
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  ShaderMaterial,
  Vector2,
  Vector3,
  type BufferGeometry,
} from 'three';
import type { Engine, System } from '../core/Engine.js';
import { PRNG } from '../math/PRNG.js';
import { clamp, damp } from '../math/Noise.js';
import { createScaleTexture } from '../render/ProceduralTextures.js';
import { skyEnvironment, updateWorldLight, worldLightUniforms } from '../render/WorldLighting.js';
import { SPECIES, speciesAffinity, type Species, type SpeciesQuery } from '../gameplay/Species.js';
import { buildFishGeometry } from './FishGeometry.js';
import fishVert from '../shaders/fish/fish.vert';
import fishFrag from '../shaders/fish/fish.frag';

/**
 * The fish in the water, and the shoals they move in.
 *
 * Two halves that deliberately do not know about each other. `School` is the flocking model:
 * typed arrays and plain numbers, no `three` and no engine — which is why the tests can run five
 * thousand steps of it in a node process and assert that it stays together and never explodes.
 * `Fish` is the system that streams shoals around the player, flattens them into one
 * `InstancedMesh` per species, and answers the two questions the fishing code asks.
 *
 * The flocking is Reynolds' three rules with three additions the game needs:
 *
 *   * **A depth band**, straight out of `Species`. A shoal of herring at forty metres and a
 *     wolffish on the bottom are different animals in the same water, and the fish you can see
 *     are drawn from the same table as the fish that can bite.
 *   * **Bait.** A shoal converges on something in the water. This is the visible half of
 *     `BiteModel.structureFactor`, and it is why `schoolBoost` exists: what the player watches
 *     drift towards the bobber is the same quantity that raises the bite rate.
 *   * **Flight from the hull.** A boat is a large dark shape and fish scatter from it. Without
 *     this a shoal swims through the bilge, and one frame of that undoes an hour of ocean.
 *
 * Allocation in the frame loop is zero: the shoal arrays are sized once at boot, the instance
 * buffers are sized for the ultra preset and never resized, and every vector is module scratch.
 */

/** Instances reserved per species: the ultra preset's 96-fish shoal, twice over. */
const MAX_INSTANCES_PER_SPECIES = 192;
const MAX_SCHOOLS_PER_SPECIES = 2;
/** Metres from the camera a shoal may spawn, and the range at which it is retired. */
const SPAWN_MIN_RANGE = 34;
const SPAWN_MAX_RANGE = 130;
const DESPAWN_RANGE = 210;
/** Seconds between spawn attempts. Shoals should drift into view, not switch on. */
const SPAWN_INTERVAL = 1.4;
/** Radius the hull scares fish out of, metres. About twice the boat's length. */
const HULL_SCARE_RADIUS = 8;

/** Everything a shoal needs to know about the world outside it. Plain numbers by design. */
export interface SchoolEnvironment {
  baitX: number;
  baitY: number;
  baitZ: number;
  /** 0 when there is nothing in the water for them to be interested in. */
  baitPull: number;
  hullX: number;
  hullY: number;
  hullZ: number;
  /** Radius inside which the hull scares fish off. 0 disables it. */
  hullRadius: number;
  /** Mean water level and the seabed under the shoal, metres. */
  surfaceY: number;
  floorY: number;
}

/**
 * Flocking constants for one species, all derived from its body length.
 *
 * Scaling by length rather than fixing metres is what makes a wall of herring tight and a pair of
 * ling loose out of the same code: every fish keeps station in body lengths, which is what a
 * lateral line actually measures.
 */
export interface SchoolTuning {
  neighbourRadius: number;
  separationRadius: number;
  separationWeight: number;
  alignmentWeight: number;
  cohesionWeight: number;
  wanderWeight: number;
  /** Pull back towards the shoal's home point, once it has wandered past `homeRadius`. */
  homeRadius: number;
  homeWeight: number;
  /** How hard the fish hold their depth, and how far through it the shoal spreads. */
  depthWeight: number;
  depthSpread: number;
  baitRadius: number;
  baitWeight: number;
  fleeWeight: number;
  cruiseSpeed: number;
  maxSpeed: number;
  maxAcceleration: number;
  /** Metres of water a fish insists on keeping above and below it. */
  surfaceClearance: number;
  floorClearance: number;
}

/**
 * Shoaling strength, 0..1.
 *
 * Mass is the honest predictor. A half-kilo herring is safe only inside a wall of herring; a
 * two-hundred-kilo halibut has nothing to hide from and lies on the bottom alone. Everything in
 * between falls out of the same log — cod and pollock come out as loose groups of five or six,
 * which is what they are.
 */
export function shoalFraction(species: Species): number {
  return clamp(1 - Math.log10(species.maxMassKg + 1) / 1.9, 0.05, 1);
}

export function tuningForSpecies(species: Species, bodyLength: number): SchoolTuning {
  const length = Math.max(0.1, bodyLength);
  const shoal = shoalFraction(species);
  // A cruising fish makes one to two body lengths a second and can treble that in a burst.
  const cruise = length * (1.1 + 0.7 * shoal);
  return {
    neighbourRadius: length * 7,
    separationRadius: length * (1.5 + 1.6 * (1 - shoal)),
    separationWeight: 2.6,
    alignmentWeight: 1.5 * shoal + 0.25,
    cohesionWeight: 0.9 * shoal + 0.08,
    wanderWeight: cruise * 0.5,
    homeRadius: 22 + 90 * shoal,
    homeWeight: cruise * 0.9,
    depthWeight: 0.55,
    depthSpread: length * (4 + 16 * shoal),
    baitRadius: 26,
    baitWeight: cruise * 1.6,
    fleeWeight: cruise * 5,
    cruiseSpeed: cruise,
    maxSpeed: cruise * 2.6,
    maxAcceleration: cruise * 4.5,
    surfaceClearance: 0.6 + length,
    floorClearance: 0.35 + length * 0.6,
  };
}

/**
 * One shoal.
 *
 * Pure arithmetic over typed arrays. The neighbour pass is O(n²) and stays that way: n is at most
 * ninety-six, the inner body is a dozen flops, and a spatial hash for ninety-six points costs
 * more to maintain than it saves.
 */
export class School {
  readonly capacity: number;
  readonly positions: Float32Array;
  readonly velocities: Float32Array;
  /** Swim phase, radians. Also seeds each fish's wander, so the wander is deterministic. */
  readonly phases: Float32Array;
  /** Per-fish beat rate and colour variation, handed straight to the shader. */
  readonly beats: Float32Array;
  readonly variation: Float32Array;
  /** Roll into the turn, radians. Smoothed, so a fish does not snap upright between frames. */
  readonly banks: Float32Array;
  /** Body length, metres. Also the instance's uniform scale. */
  readonly lengths: Float32Array;

  /** What each fish wants to do this step, held between the two passes below. */
  private readonly accelerations: Float32Array;

  species: Species | null = null;
  /** Null exactly when `species` is null; `step` returns before either can be read. */
  tuning: SchoolTuning | null = null;
  count = 0;

  homeX = 0;
  homeY = 0;
  homeZ = 0;
  /** The depth the shoal is holding, as a world y. */
  holdY = 0;
  age = 0;

  centroidX = 0;
  centroidY = 0;
  centroidZ = 0;
  /** RMS distance between pairs of fish — the shoal's diameter in one number. */
  spread = 0;
  /** Mean distance from a fish to its closest neighbour. The cohesion the tests assert on. */
  nearestNeighbourMean = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * 3);
    this.velocities = new Float32Array(capacity * 3);
    this.phases = new Float32Array(capacity);
    this.beats = new Float32Array(capacity);
    this.variation = new Float32Array(capacity);
    this.banks = new Float32Array(capacity);
    this.lengths = new Float32Array(capacity);
    this.accelerations = new Float32Array(capacity * 3);
  }

  get active(): boolean {
    return this.species !== null && this.count > 0;
  }

  /**
   * Fill the shoal.
   *
   * Everything random comes from `rng` and nothing from `Math.random`, so a seed and a home point
   * reproduce the same shoal down to the last fish — which is what the determinism test checks
   * and what makes a bug in here reproducible at all.
   */
  spawn(
    species: Species,
    count: number,
    homeX: number,
    homeY: number,
    homeZ: number,
    rng: PRNG,
  ): void {
    const meanLength = (species.minLengthM + species.maxLengthM) * 0.5;
    const tuning = tuningForSpecies(species, meanLength);
    this.species = species;
    this.tuning = tuning;
    this.count = Math.min(count, this.capacity);
    this.homeX = homeX;
    this.homeY = homeY;
    this.homeZ = homeZ;
    this.holdY = homeY;
    this.age = 0;

    const heading = rng.next() * Math.PI * 2;
    const radius = tuning.separationRadius * Math.cbrt(this.count) * 1.1;

    for (let i = 0; i < this.count; i += 1) {
      const i3 = i * 3;
      this.positions[i3] = homeX + rng.range(-radius, radius);
      this.positions[i3 + 1] = homeY + rng.range(-radius, radius) * 0.4;
      this.positions[i3 + 2] = homeZ + rng.range(-radius, radius);

      // Everyone starts on roughly the same heading. A shoal that has to sort itself out of a
      // random tangle spends its first few seconds looking like a bag of nails.
      const bearing = heading + rng.range(-0.35, 0.35);
      const speed = tuning.cruiseSpeed * rng.range(0.8, 1.2);
      this.velocities[i3] = Math.sin(bearing) * speed;
      this.velocities[i3 + 1] = rng.range(-0.1, 0.1) * speed;
      this.velocities[i3 + 2] = Math.cos(bearing) * speed;

      this.phases[i] = rng.next() * Math.PI * 2;
      this.beats[i] = rng.range(0.85, 1.2);
      this.variation[i] = rng.next();
      this.banks[i] = 0;
      // Length is distributed like `rollSpecimen`'s, so a shoal is mostly small fish with the odd
      // better one in it rather than a rack of identical clones.
      const size = clamp(rng.gaussian(0.3, 0.22), 0, 1);
      this.lengths[i] = species.minLengthM + (species.maxLengthM - species.minLengthM) * size;
    }

    this.spread = 0;
    this.nearestNeighbourMean = 0;
    this.measure(this.count);
  }

  retire(): void {
    this.species = null;
    this.tuning = null;
    this.count = 0;
  }

  /**
   * Advance the shoal. Called once per rendered frame; flocking is visual, not physics.
   *
   * Two passes rather than one. Everything reads the positions the shoal held at the start of the
   * step and nothing reads a value another fish has already moved, so the result cannot depend on
   * the order the array happens to be in — which it would if a fish integrated in place and the
   * next one saw its new position. Reproducibility is the point of the whole exercise.
   */
  step(dt: number, environment: SchoolEnvironment): void {
    const n = this.count;
    const t = this.tuning;
    if (n === 0 || t === null) return;
    this.age += dt;
    this.accumulate(n, t, environment);
    this.integrate(dt, n, t);
    this.measure(n);
  }

  /** Pass one: what every fish wants to do, and the two statistics that describe the shoal. */
  private accumulate(n: number, t: SchoolTuning, environment: SchoolEnvironment): void {
    const p = this.positions;
    const v = this.velocities;
    const a = this.accelerations;

    const neighbourSquared = t.neighbourRadius * t.neighbourRadius;
    const separationSquared = t.separationRadius * t.separationRadius;
    const baitSquared = t.baitRadius * t.baitRadius;
    const hullSquared = environment.hullRadius * environment.hullRadius;
    const surfaceLimit = environment.surfaceY - t.surfaceClearance;
    const floorLimit = environment.floorY + t.floorClearance;

    let pairSquaredSum = 0;
    let nearestSum = 0;

    for (let i = 0; i < n; i += 1) {
      const i3 = i * 3;
      const px = p[i3] ?? 0;
      const py = p[i3 + 1] ?? 0;
      const pz = p[i3 + 2] ?? 0;
      const vx = v[i3] ?? 0;
      const vy = v[i3 + 1] ?? 0;
      const vz = v[i3 + 2] ?? 0;

      let separationX = 0;
      let separationY = 0;
      let separationZ = 0;
      let alignX = 0;
      let alignY = 0;
      let alignZ = 0;
      let centreX = 0;
      let centreY = 0;
      let centreZ = 0;
      let found = 0;
      let nearest = Infinity;

      // Each fish looks at every other rather than only at the pairs above it. The symmetric form
      // halves the arithmetic and then spends the saving reading nine accumulators back out of
      // arrays; at ninety-six fish this is both faster and very much easier to read.
      for (let j = 0; j < n; j += 1) {
        if (j === i) continue;
        const j3 = j * 3;
        const qx = p[j3] ?? 0;
        const qy = p[j3 + 1] ?? 0;
        const qz = p[j3 + 2] ?? 0;
        const dx = px - qx;
        const dy = py - qy;
        const dz = pz - qz;
        const squared = dx * dx + dy * dy + dz * dz;
        pairSquaredSum += squared;
        if (squared < nearest) nearest = squared;
        if (squared > neighbourSquared) continue;

        found += 1;
        centreX += qx;
        centreY += qy;
        centreZ += qz;
        alignX += v[j3] ?? 0;
        alignY += v[j3 + 1] ?? 0;
        alignZ += v[j3 + 2] ?? 0;

        if (squared >= separationSquared) continue;
        // A 1/d falloff, so crowding is felt sharply and a fish two lengths away is not felt at
        // all. The floor on d stops a coincident pair producing an infinity; the acceleration
        // clamp in the next pass turns whatever survives it into "swim away hard", which is
        // exactly what a fish being trodden on ought to do.
        const distance = Math.sqrt(squared);
        const push = (1 - distance / t.separationRadius) / Math.max(distance, 1e-3);
        separationX += dx * push;
        separationY += dy * push;
        separationZ += dz * push;
      }

      nearestSum += nearest === Infinity ? 0 : Math.sqrt(nearest);

      let ax = separationX * t.separationWeight;
      let ay = separationY * t.separationWeight;
      let az = separationZ * t.separationWeight;

      if (found > 0) {
        const inverse = 1 / found;
        ax += (alignX * inverse - vx) * t.alignmentWeight;
        ay += (alignY * inverse - vy) * t.alignmentWeight;
        az += (alignZ * inverse - vz) * t.alignmentWeight;
        ax += (centreX * inverse - px) * t.cohesionWeight;
        ay += (centreY * inverse - py) * t.cohesionWeight;
        az += (centreZ * inverse - pz) * t.cohesionWeight;
      }

      // Wander: three incommensurate sinusoids per fish, seeded off its swim phase.
      // Deterministic, allocation-free, and it does not repeat within a shoal's lifetime.
      const phase = this.phases[i] ?? 0;
      ax += Math.sin(this.age * 0.31 + phase) * t.wanderWeight;
      ay += Math.sin(this.age * 0.23 + phase * 1.7) * t.wanderWeight * 0.3;
      az += Math.cos(this.age * 0.27 + phase * 2.3) * t.wanderWeight;

      // The depth band, spread through the shoal so it is a cloud rather than a sheet.
      const hold = this.holdY + ((this.variation[i] ?? 0.5) - 0.5) * t.depthSpread;
      ay += (hold - py) * t.depthWeight;
      if (py > surfaceLimit) ay -= (py - surfaceLimit) * 4;
      if (py < floorLimit) ay += (floorLimit - py) * 4;

      // Home tether. Silent inside the radius, so the shoal roams freely and then turns back
      // rather than orbiting a point on a string.
      const awayX = px - this.homeX;
      const awayZ = pz - this.homeZ;
      const away = Math.hypot(awayX, awayZ);
      if (away > t.homeRadius) {
        const pull = (t.homeWeight * (away / t.homeRadius - 1)) / away;
        ax -= awayX * pull;
        az -= awayZ * pull;
      }

      if (environment.baitPull > 0) {
        const bx = environment.baitX - px;
        const by = environment.baitY - py;
        const bz = environment.baitZ - pz;
        const squared = bx * bx + by * by + bz * bz;
        if (squared < baitSquared) {
          const distance = Math.max(0.2, Math.sqrt(squared));
          const pull =
            (environment.baitPull * t.baitWeight * (1 - distance / t.baitRadius)) / distance;
          ax += bx * pull;
          ay += by * pull;
          az += bz * pull;
        }
      }

      if (hullSquared > 0) {
        const hx = px - environment.hullX;
        const hy = py - environment.hullY;
        const hz = pz - environment.hullZ;
        const squared = hx * hx + hy * hy + hz * hz;
        if (squared < hullSquared) {
          const distance = Math.max(0.2, Math.sqrt(squared));
          const scare = 1 - distance / environment.hullRadius;
          const flee = (t.fleeWeight * scare * scare) / distance;
          ax += hx * flee;
          ay += hy * flee;
          az += hz * flee;
        }
      }

      a[i3] = ax;
      a[i3 + 1] = ay;
      a[i3 + 2] = az;
    }

    // Every unordered pair was visited twice, once from each end, so the mean over the ordered
    // pairs is the mean over the unordered ones.
    this.spread = n < 2 ? 0 : Math.sqrt(pairSquaredSum / (n * (n - 1)));
    this.nearestNeighbourMean = nearestSum / n;
  }

  /**
   * Pass two: what a fish can actually do about it.
   *
   * The two clamps are not polish. Bounded acceleration and bounded speed make explicit Euler
   * unconditionally stable here whatever the weights are, which is why no combination of a boat
   * sitting on top of a shoal and a bait in the middle of it can make this diverge.
   */
  private integrate(dt: number, n: number, t: SchoolTuning): void {
    const p = this.positions;
    const v = this.velocities;
    const a = this.accelerations;
    const minSpeed = t.cruiseSpeed * 0.3;
    const maxSpeedSquared = t.maxSpeed * t.maxSpeed;
    const minSpeedSquared = minSpeed * minSpeed;
    const maxAccelerationSquared = t.maxAcceleration * t.maxAcceleration;

    for (let i = 0; i < n; i += 1) {
      const i3 = i * 3;
      let ax = a[i3] ?? 0;
      let ay = a[i3 + 1] ?? 0;
      let az = a[i3 + 2] ?? 0;

      const wanted = ax * ax + ay * ay + az * az;
      if (wanted > maxAccelerationSquared) {
        const scale = t.maxAcceleration / Math.sqrt(wanted);
        ax *= scale;
        ay *= scale;
        az *= scale;
      }

      let vx = (v[i3] ?? 0) + ax * dt;
      let vy = (v[i3 + 1] ?? 0) + ay * dt;
      let vz = (v[i3 + 2] ?? 0) + az * dt;

      const speedSquared = vx * vx + vy * vy + vz * vz;
      if (speedSquared > maxSpeedSquared) {
        const scale = t.maxSpeed / Math.sqrt(speedSquared);
        vx *= scale;
        vy *= scale;
        vz *= scale;
      } else if (speedSquared < minSpeedSquared) {
        // A fish with no way on has no steerage and would spin on the spot. Below the floor it is
        // nudged back up along whatever heading it had, or given one if it had none left.
        const speed = Math.sqrt(speedSquared);
        if (speed < 1e-5) {
          const phase = this.phases[i] ?? 0;
          vx = Math.sin(phase) * minSpeed;
          vy = 0;
          vz = Math.cos(phase) * minSpeed;
        } else {
          const scale = minSpeed / speed;
          vx *= scale;
          vy *= scale;
          vz *= scale;
        }
      }

      v[i3] = vx;
      v[i3 + 1] = vy;
      v[i3 + 2] = vz;
      p[i3] = (p[i3] ?? 0) + vx * dt;
      p[i3 + 1] = (p[i3 + 1] ?? 0) + vy * dt;
      p[i3 + 2] = (p[i3 + 2] ?? 0) + vz * dt;

      // Bank into the turn: the horizontal cross product of heading and acceleration, which is
      // the component turning the fish rather than the one speeding it up. The sign is chosen so
      // a fish going round to starboard drops its starboard flank, which is what banking is.
      const horizontal = Math.hypot(vx, vz);
      if (horizontal > 1e-4) {
        const turning = (ax * vz - az * vx) / horizontal;
        this.banks[i] = damp(this.banks[i] ?? 0, clamp(turning * 0.14, -0.75, 0.75), 6, dt);
      }
    }
  }

  private measure(n: number): void {
    if (n === 0) return;
    const p = this.positions;
    let x = 0;
    let y = 0;
    let z = 0;
    for (let i = 0; i < n; i += 1) {
      x += p[i * 3] ?? 0;
      y += p[i * 3 + 1] ?? 0;
      z += p[i * 3 + 2] ?? 0;
    }
    this.centroidX = x / n;
    this.centroidY = y / n;
    this.centroidZ = z / n;
  }
}

/** What `nearestSchool` writes into. A caller-owned struct, so the query allocates nothing. */
export interface SchoolReport {
  /** Metres to the edge of the nearest shoal. `Infinity` when there is none in the water. */
  distanceM: number;
  species: Species | null;
  count: number;
  /** Depth of the shoal's centre below mean water level, metres. */
  depthM: number;
}

export function createSchoolReport(): SchoolReport {
  return { distanceM: Infinity, species: null, count: 0, depthM: 0 };
}

/** The slice of the ocean the fish need. Structural, so nothing here depends on `Ocean`. */
export interface WaterSurface {
  heightAt(x: number, z: number): number;
}

/** The slice of the seabed the fish need — how high the ground is under a point. */
export interface GroundSurface {
  floorHeightAt(x: number, z: number): number;
}

/** Anything with a world position fish should get out of the way of. `Boat` satisfies it. */
export interface HullSource {
  readonly position: Vector3;
}

/**
 * The one thing the fish need from the underwater optics: which water they are swimming in.
 *
 * Kept to a single field so this stays structural — `Underwater` satisfies it and nothing in
 * `entities` has to import anything from `world` to say so. A fish shaded for clear oceanic water
 * while the sea around it is turbid coastal is a fish that visibly does not belong in the shot.
 */
export interface WaterOptics {
  readonly turbidity: number;
}

const scratchMatrix = new Matrix4();
const scratchForward = new Vector3();
const scratchRight = new Vector3();
const scratchUp = new Vector3();
const scratchScale = new Vector3();
const WORLD_UP = new Vector3(0, 1, 0);

const spawnQuery: SpeciesQuery = {
  depthM: 20,
  sunAltitudeDeg: 0,
  beaufort: 3,
  waterTemperatureC: 10,
  bait: 'bare',
  rarity: 0,
};

interface SpeciesRender {
  readonly species: Species;
  readonly geometry: BufferGeometry;
  readonly material: ShaderMaterial;
  readonly mesh: InstancedMesh;
  readonly phase: InstancedBufferAttribute;
  readonly swim: InstancedBufferAttribute;
  readonly variation: InstancedBufferAttribute;
  readonly phaseData: Float32Array;
  readonly swimData: Float32Array;
  readonly variationData: Float32Array;
  /** Precomputed, because `tuningForSpecies` returns an object and this runs every frame. */
  readonly cruiseSpeed: number;
}

export class Fish implements System {
  readonly name = 'fish';
  readonly priority = 30;

  private readonly water: WaterSurface;
  private readonly ground: GroundSurface;
  private readonly hull: HullSource | null;

  private readonly renders: SpeciesRender[] = [];
  private readonly schools: School[] = [];
  private readonly rng: PRNG;
  private readonly weights: number[] = [];
  private readonly environment: SchoolEnvironment = {
    baitX: 0,
    baitY: 0,
    baitZ: 0,
    baitPull: 0,
    hullX: 0,
    hullY: 0,
    hullZ: 0,
    hullRadius: 0,
    surfaceY: 0,
    floorY: -55,
  };

  private optics: WaterOptics | null = null;
  private spawnTimer = 0;
  private schoolSize: number;
  private targetSchools: number;

  constructor(engine: Engine, water: WaterSurface, ground: GroundSurface, hull: HullSource | null) {
    this.water = water;
    this.ground = ground;
    this.hull = hull;
    this.rng = new PRNG(engine.settings.world.seed ^ 0x1f15);

    const graphics = engine.settings.graphics;
    this.schoolSize = graphics.schoolSize;
    this.targetSchools = schoolBudget(graphics.instanceDensity);

    for (const species of SPECIES) {
      const render = createSpeciesRender(engine, species);
      this.renders.push(render);
      this.weights.push(0);
      engine.scene.add(render.mesh);
    }
    // Exactly as many shoals as the instance buffers were sized for, so a spawn can never fail
    // for want of a slot and the pool never has to grow.
    const capacity = MAX_INSTANCES_PER_SPECIES / MAX_SCHOOLS_PER_SPECIES;
    for (let i = 0; i < SPECIES.length * MAX_SCHOOLS_PER_SPECIES; i += 1) {
      this.schools.push(new School(capacity));
    }
  }

  /** Tell the fish which water they are in, so they absorb like the sea around them. */
  setOptics(source: WaterOptics): void {
    this.optics = source;
  }

  /** Put something in the water for them to come and look at. `strength` is 0..1. */
  setBait(x: number, y: number, z: number, strength: number): void {
    this.environment.baitX = x;
    this.environment.baitY = y;
    this.environment.baitZ = z;
    this.environment.baitPull = clamp(strength, 0, 1);
  }

  clearBait(): void {
    this.environment.baitPull = 0;
  }

  /**
   * The nearest shoal to a point, written into a caller-owned struct.
   *
   * The distance is to the *edge* of the shoal rather than to its centre, because that is what
   * `BiteModel.structureFactor` means by a school distance — a bait on the near side of a hundred
   * herring is in the school, not fifteen metres from it.
   */
  nearestSchool(position: Vector3, out: SchoolReport): SchoolReport {
    out.distanceM = Infinity;
    out.species = null;
    out.count = 0;
    out.depthM = 0;

    for (const school of this.schools) {
      if (!school.active) continue;
      const distance = this.edgeDistance(school, position);
      if (distance >= out.distanceM) continue;
      out.distanceM = distance;
      out.species = school.species;
      out.count = school.count;
      out.depthM = Math.max(0, this.environment.surfaceY - school.centroidY);
    }
    return out;
  }

  /**
   * How much of a shoal is over a point, 0..1.
   *
   * Decays on the same nine-metre scale `BiteModel.structureFactor` uses for a marked school, so
   * the fishing code can fold this straight in, and weighted by how many fish are actually there:
   * drifting a bait through six cod is not the same event as drifting it through eighty herring,
   * and the bite rate should know that.
   */
  schoolBoost(position: Vector3): number {
    let best = 0;
    for (const school of this.schools) {
      if (!school.active) continue;
      const density = clamp(school.count / Math.max(1, this.schoolSize), 0.15, 1);
      best = Math.max(best, Math.exp(-this.edgeDistance(school, position) / 9) * density);
    }
    return best;
  }

  update(dt: number, engine: Engine): void {
    const camera = engine.camera.position;
    const environment = this.environment;
    environment.surfaceY = this.water.heightAt(camera.x, camera.z);
    environment.floorY = this.ground.floorHeightAt(camera.x, camera.z);

    if (this.hull !== null) {
      environment.hullX = this.hull.position.x;
      environment.hullY = this.hull.position.y;
      environment.hullZ = this.hull.position.z;
      environment.hullRadius = HULL_SCARE_RADIUS;
    }

    this.stream(dt, engine, camera);

    // Clamped because a stalled tab hands back a whole second, and a second of flocking in one
    // step is how a shoal teleports.
    const stepDt = Math.min(dt, 1 / 20);
    for (const school of this.schools) school.step(stepDt, environment);

    this.writeInstances();
  }

  beforeRender(engine: Engine): void {
    const environment = skyEnvironment(engine);
    const turbidity = this.optics?.turbidity;
    for (const render of this.renders) {
      const uniforms = render.material.uniforms;
      updateWorldLight(uniforms, engine, environment);
      const time = uniforms['uTime'];
      if (time !== undefined) time.value = engine.loop.elapsed;
      const level = uniforms['uWaterLevel'];
      if (level !== undefined) level.value = this.environment.surfaceY;
      const water = uniforms['uTurbidity'];
      if (water !== undefined && turbidity !== undefined) water.value = turbidity;
    }
  }

  onSettingsChanged(engine: Engine): void {
    const graphics = engine.settings.graphics;
    this.schoolSize = graphics.schoolSize;
    this.targetSchools = schoolBudget(graphics.instanceDensity);
    // Shoals already in the water keep the size they were born with and are replaced as they
    // leave range. Resizing them live would make fish appear and vanish in front of the player.
  }

  dispose(): void {
    for (const render of this.renders) {
      render.geometry.dispose();
      render.material.dispose();
      render.mesh.dispose();
    }
    this.renders.length = 0;
    this.schools.length = 0;
  }

  private edgeDistance(school: School, position: Vector3): number {
    const dx = school.centroidX - position.x;
    const dy = school.centroidY - position.y;
    const dz = school.centroidZ - position.z;
    return Math.max(0, Math.hypot(dx, dy, dz) - school.spread * 0.5);
  }

  /** Retire shoals that have left range, and bring new ones in to replace them. */
  private stream(dt: number, engine: Engine, camera: Vector3): void {
    let live = 0;
    for (const school of this.schools) {
      if (!school.active) continue;
      const distance = Math.hypot(school.centroidX - camera.x, school.centroidZ - camera.z);
      if (distance > DESPAWN_RANGE) school.retire();
      else live += 1;
    }

    this.spawnTimer -= dt;
    if (live >= this.targetSchools || this.spawnTimer > 0) return;
    this.spawnTimer = SPAWN_INTERVAL;

    const bearing = this.rng.next() * Math.PI * 2;
    const range = this.rng.range(SPAWN_MIN_RANGE, SPAWN_MAX_RANGE);
    const homeX = camera.x + Math.sin(bearing) * range;
    const homeZ = camera.z + Math.cos(bearing) * range;
    const surface = this.water.heightAt(homeX, homeZ);
    const column = Math.max(2, surface - this.ground.floorHeightAt(homeX, homeZ));

    const species = this.chooseSpecies(engine, column);
    if (species === undefined) return;
    const slot = this.freeSlot(species);
    if (slot === undefined) return;

    // Hold somewhere inside the species' band, but never below the ground or above the surface.
    const band = this.rng.range(species.minDepthM, species.maxDepthM);
    const depth = clamp(band, 1.5, Math.max(2, column - 1.5));
    const count = Math.max(1, Math.round(this.schoolSize * shoalFraction(species)));
    slot.spawn(species, count, homeX, surface - depth, homeZ, this.rng);
    // Sea state moves fish down: a shoal that spawns in a gale sits deeper than one in a flat
    // calm, which is the same fact the bite model reads from the other end.
    slot.holdY -= Math.min(6, engine.world.beaufort * 0.5);
  }

  /**
   * Pick what is swimming past.
   *
   * Weighted by the species table's own affinity for the conditions, so the fish the player can
   * see are drawn from the same distribution as the fish that will take a bait. The bait term is
   * neutralised by asking each species about a bait it already likes — this is a question about
   * what lives here, not about what is on the hook.
   */
  private chooseSpecies(engine: Engine, column: number): Species | undefined {
    const world = engine.world;
    const ephemeris = world.ephemeris;
    spawnQuery.depthM = clamp(column * 0.6, 1, 400);
    spawnQuery.sunAltitudeDeg = ephemeris === null ? 10 : ephemeris.sunAltitudeDeg;
    spawnQuery.beaufort = world.beaufort;
    spawnQuery.waterTemperatureC = world.temperatureC;
    spawnQuery.rarity = 0;

    let total = 0;
    for (let i = 0; i < SPECIES.length; i += 1) {
      const species = SPECIES[i];
      if (species === undefined) continue;
      spawnQuery.bait = species.baits[0] ?? 'bare';
      const weight = species.weight * speciesAffinity(species, spawnQuery);
      this.weights[i] = weight;
      total += weight;
    }
    if (total <= 0) return undefined;

    const index = this.rng.weightedIndex(this.weights);
    return index < 0 ? undefined : SPECIES[index];
  }

  /** A retired shoal, if this species has not already used up its share of the instance buffer. */
  private freeSlot(species: Species): School | undefined {
    let used = 0;
    let free: School | undefined;
    for (const school of this.schools) {
      if (school.active) {
        if (school.species === species) used += 1;
      } else if (free === undefined) {
        free = school;
      }
    }
    return used >= MAX_SCHOOLS_PER_SPECIES ? undefined : free;
  }

  /** Flatten every live shoal into its species' instance buffers. */
  private writeInstances(): void {
    for (const render of this.renders) {
      let written = 0;
      for (const school of this.schools) {
        if (school.species !== render.species || !school.active) continue;
        for (let i = 0; i < school.count && written < MAX_INSTANCES_PER_SPECIES; i += 1) {
          const i3 = i * 3;
          scratchForward.set(
            school.velocities[i3] ?? 0,
            school.velocities[i3 + 1] ?? 0,
            school.velocities[i3 + 2] ?? 1,
          );
          const speed = scratchForward.length();
          if (speed < 1e-5) scratchForward.set(0, 0, 1);
          else scratchForward.multiplyScalar(1 / speed);

          scratchUp.copy(WORLD_UP).applyAxisAngle(scratchForward, school.banks[i] ?? 0);
          scratchRight.crossVectors(scratchUp, scratchForward);
          // A fish going straight up or straight down has no unique roll; any right axis will do
          // and this one at least does not produce a zero-length basis.
          if (scratchRight.lengthSq() < 1e-8) scratchRight.set(1, 0, 0);
          scratchRight.normalize();
          scratchUp.crossVectors(scratchForward, scratchRight);

          const length = school.lengths[i] ?? 0.3;
          scratchScale.set(length, length, length);
          scratchMatrix.makeBasis(scratchRight, scratchUp, scratchForward);
          scratchMatrix.scale(scratchScale);
          scratchMatrix.setPosition(
            school.positions[i3] ?? 0,
            school.positions[i3 + 1] ?? 0,
            school.positions[i3 + 2] ?? 0,
          );
          render.mesh.setMatrixAt(written, scratchMatrix);

          render.phaseData[written] = school.phases[i] ?? 0;
          // Beat rate rises with speed: a fish holding station idles its tail, a fish making a
          // run beats hard. Bainbridge's relation, near enough at the size this reads on screen.
          render.swimData[written] = (school.beats[i] ?? 1) * (0.55 + speed / render.cruiseSpeed);
          render.variationData[written] = school.variation[i] ?? 0;
          written += 1;
        }
      }

      render.mesh.count = written;
      render.mesh.visible = written > 0;
      if (written === 0) continue;
      render.mesh.instanceMatrix.needsUpdate = true;
      render.phase.needsUpdate = true;
      render.swim.needsUpdate = true;
      render.variation.needsUpdate = true;
    }
  }
}

/** Shoals in the water at once, from the instance-density knob. Fish are the last thing cut. */
function schoolBudget(instanceDensity: number): number {
  return Math.max(3, Math.round(3 + 7 * clamp(instanceDensity, 0, 1)));
}

function createSpeciesRender(engine: Engine, species: Species): SpeciesRender {
  const geometry = buildFishGeometry(species);
  // 128 is ample: a fish fills a couple of hundred pixels at the closest a player ever gets, and
  // twelve species at 256 would be three megabytes of texture nobody could resolve.
  const scales = engine.resources.track(
    createScaleTexture(128, species.scaleDensity, species.iridescence, hashSpecies(species.id)),
  );

  const material = new ShaderMaterial({
    name: `fish:${species.id}`,
    vertexShader: fishVert,
    fragmentShader: fishFrag,
    uniforms: {
      ...worldLightUniforms(),
      uTime: { value: 0 },
      uBeatHz: { value: 2.4 },
      uAmplitude: { value: 0.085 },
      uWavelength: { value: 1.05 },
      uScales: { value: scales },
      // Once round the girth and twice down the body: a fish's scales are taller than they are
      // wide, and one repeat each way would make them square.
      uScaleRepeat: { value: new Vector2(1, 2) },
      uBackColour: {
        value: new Color(species.backColour[0], species.backColour[1], species.backColour[2]),
      },
      uBellyColour: {
        value: new Color(species.bellyColour[0], species.bellyColour[1], species.bellyColour[2]),
      },
      uIridescence: { value: species.iridescence },
      uWaterLevel: { value: 0 },
      // Coastal northern water, murkier than the open-ocean value the surface shader defaults to.
      uTurbidity: { value: 0.32 },
    },
    // Fins are membranes a millimetre thick. Drawing one side of them leaves a fish with half a
    // tail from the wrong angle; `fish.frag` flips the shading normal for the back face.
    side: DoubleSide,
  });

  const mesh = new InstancedMesh(geometry, material, MAX_INSTANCES_PER_SPECIES);
  mesh.name = `fish:${species.id}`;
  mesh.count = 0;
  mesh.visible = false;
  // The instances are scattered over a couple of hundred metres and the vertex shader moves them
  // further; a bounding sphere fitted to one unit-length fish would cull the whole shoal the
  // moment the mesh's own origin left the frustum.
  mesh.frustumCulled = false;

  const phaseData = new Float32Array(MAX_INSTANCES_PER_SPECIES);
  const swimData = new Float32Array(MAX_INSTANCES_PER_SPECIES);
  const variationData = new Float32Array(MAX_INSTANCES_PER_SPECIES);
  const phase = new InstancedBufferAttribute(phaseData, 1);
  const swim = new InstancedBufferAttribute(swimData, 1);
  const variation = new InstancedBufferAttribute(variationData, 1);
  geometry.setAttribute('aPhase', phase);
  geometry.setAttribute('aSwim', swim);
  geometry.setAttribute('aVariation', variation);

  return {
    species,
    geometry,
    material,
    mesh,
    phase,
    swim,
    variation,
    phaseData,
    swimData,
    variationData,
    cruiseSpeed: Math.max(
      0.1,
      tuningForSpecies(species, (species.minLengthM + species.maxLengthM) * 0.5).cruiseSpeed,
    ),
  };
}

/** Stable per-species texture seed, so a herring looks the same in every session. */
function hashSpecies(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 0x01000193) >>> 0;
  }
  return hash;
}

import { Vector3, type MeshStandardMaterial, type Object3D } from 'three';
import type { System } from '../core/Engine.js';
import type { ActionName } from '../core/Input.js';
import type { WorldState } from '../core/WorldState.js';
import { Bobber, type WaterField } from '../entities/Bobber.js';
import { FishingLine } from '../entities/FishingLine.js';
import { clamp, smoothstep } from '../math/Noise.js';
import { PRNG } from '../math/PRNG.js';
import {
  createBiteFactors,
  rollBite,
  type BaitKind,
  type BiteConditions,
  type BiteFactors,
} from './BiteModel.js';
import { Fight, type FightConditions } from './FightModel.js';
import { upgradeEffect, type UpgradeEffects } from './Progression.js';
import { rollSpecimen, type CaughtFish, type Species } from './Species.js';

/**
 * The game loop: charge, cast, sink, wait, strike, fight, land or lose.
 *
 * The state is a **named state**, not a drawer of booleans. That is not a stylistic preference —
 * `casting && !hooked && charge > 0` is how a fishing game ends up with a rod that is reeling in
 * a fish it has not hooked yet, and no amount of care at the call sites prevents it, because the
 * illegal combinations are expressible. Here they are not: `LEGAL_TRANSITIONS` is the only
 * description of the graph, the state union is derived from its keys, the set of successors of
 * each state is derived from its values, and `FishingStateMachine.to` will not compile against a
 * pair the table does not contain.
 *
 * Two edges exist beyond the straight-through chain, and both earn their place. `waiting → idle`
 * is winding a bait back in that nothing wanted, which otherwise strands the player with a float
 * they cannot retrieve. `bite → escaped` is missing the strike: the fish let go, and "the fish got
 * away" is precisely what `escaped` means, so it needs no state of its own.
 *
 * Everything this system talks to is a structural interface rather than a concrete class, the way
 * `Ocean.setCloudShadows` and `Fish`'s water and ground are. The tackle does not care that the
 * water is `Ocean` or that the ground is `Seabed`; it cares that something answers `heightAt` and
 * `floorHeightAt`. That is also what lets the whole loop be driven in a unit test with no GPU.
 */

/**
 * The state graph, and the single description of it.
 *
 * Read as "from → what may follow". Both the runtime check and the compile-time one below come
 * out of this object, so the graph cannot drift from the code that walks it.
 */
export const LEGAL_TRANSITIONS = {
  idle: ['charging'],
  charging: ['casting'],
  casting: ['sinking'],
  sinking: ['waiting'],
  waiting: ['bite', 'idle'],
  bite: ['fighting', 'escaped'],
  fighting: ['landed', 'escaped'],
  landed: ['idle'],
  escaped: ['idle'],
} as const;

export type FishingState = keyof typeof LEGAL_TRANSITIONS;

/** The states that may legally follow `From`. Derived, never written down twice. */
export type NextState<From extends FishingState> = (typeof LEGAL_TRANSITIONS)[From][number];

/** Runtime mirror of the table, for anything driving the machine from data rather than code. */
export function canTransition(from: FishingState, to: FishingState): boolean {
  const allowed: readonly FishingState[] = LEGAL_TRANSITIONS[from];
  return allowed.includes(to);
}

/**
 * The machine itself.
 *
 * A bare string rather than a discriminated union carrying each state's payload, because a
 * union means allocating a state object on every transition and the frame loop is not allowed to
 * allocate. The payloads live as fields on the system beside it and are reset on the way out of
 * the state that owns them, which `FishingSystem.stow` does in exactly one place.
 */
export class FishingStateMachine {
  private current: FishingState = 'idle';

  get state(): FishingState {
    return this.current;
  }

  /**
   * Move from `from` to `next`, if that is where we are.
   *
   * The type parameter is what makes an illegal pair unwritable. The table check is what keeps
   * that true when the union arrives from somewhere the compiler is not — a save file, the debug
   * panel — and the source check is what stops a stale caller firing a transition twice.
   */
  to<From extends FishingState>(from: From, next: NextState<From> & FishingState): boolean {
    if (this.current !== from || !canTransition(this.current, next)) return false;
    this.current = next;
    return true;
  }

  /** Only the loader and the tests wind the machine back; play never does. */
  reset(): void {
    this.current = 'idle';
  }
}

/** The slice of the boat the tackle needs. `Boat` satisfies it. */
export interface RodSource {
  rodTipWorldPosition(out: Vector3): Vector3;
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly isAnchored: boolean;
}

/** The slice of the seabed the tackle needs — how high the ground is under the float. */
export interface GroundField {
  floorHeightAt(x: number, z: number): number;
}

/** The slice of the shoals the tackle needs. `Fish` satisfies it. */
export interface SchoolSource {
  schoolBoost(position: Vector3): number;
  setBait(x: number, y: number, z: number, strength: number): void;
  clearBait(): void;
}

/** The input this system reads. Every member is held state or a per-frame edge. */
export interface FishingInput {
  readonly primaryDown: boolean;
  readonly primaryPressed: boolean;
  readonly primaryReleased: boolean;
  isHeld(action: ActionName): boolean;
}

/**
 * The slice of the engine the tackle needs.
 *
 * `Engine` satisfies it structurally, so `engine` can be handed straight to `update` — and a test
 * can hand over four plain objects instead of booting WebGL.
 */
export interface FishingHost {
  readonly scene: { add(object: Object3D): void };
  readonly camera: { getWorldDirection(target: Vector3): Vector3 };
  readonly input: FishingInput;
  readonly world: WorldState;
}

const GRAVITY = 9.80665;

/** Seconds of hold for a full-power cast. */
const CHARGE_SECONDS = 1.15;
/** Launch angle. Flatter than the 45° that maximises range, because a float cast is aimed. */
const CAST_ELEVATION_RAD = (38 * Math.PI) / 180;
/** Nominal range at no charge, and at full charge with the stock reel. Metres. */
const MIN_CAST_RANGE_M = 5;
const MAX_CAST_RANGE_M = 34;
/** Extra range per multiple of the stock reel's recovery speed. */
const RANGE_PER_STOCK_REEL = 0.55;
const STOCK_REEL_MPS = upgradeEffect('reel-speed', 0);

/** Longest dropper the rig carries, metres — a boat paternoster fishing off a float. */
const MAX_DROPPER_M = 12;
/** How far clear of the ground the hook is held, and the shallowest the rig will fish. */
const BOTTOM_CLEARANCE_M = 0.6;
const MIN_DROPPER_M = 0.8;
/** Sink rate of a baited hook under shot, m/s. */
const SINK_RATE_MPS = 0.7;

/** Slack carried in the line as a share of the straight distance, at zero load. */
const LINE_SAG = 0.09;
/** Line left out at the splash, as a share of the throw — a cast lands with a little slack. */
const CAST_SLACK = 1.06;
/** Speed the float is left with once it is in the water. See `stepFlight`. */
const SPLASH_ENTRY_MPS = 1.1;

/** Boat speed over which a cast is not worth making, m/s. Anchored is always fair. */
const CAST_SPEED_LIMIT_MPS = 1.3;

/** How far the take buries the float, as a share of the bobber's full pull-down. */
const BITE_PULL_DOWN = 0.75;
/** Rate the float is dragged to wherever the fish has got to, 1/s. */
const FIGHT_STEER_RATE = 3.5;

/** Seconds the catch and the loss hold on screen before the rod is idle again. */
const LANDED_DWELL_S = 2;
const ESCAPED_DWELL_S = 1.6;

/** Distance from the rod tip at which a retrieve is finished. */
const STOWED_LINE_M = 1.2;

/** Stand-in for "there is no shoal anywhere near this bait". */
const NO_SCHOOL_M = 5000;
/**
 * Decay length of the school term, metres.
 *
 * `Fish.schoolBoost` returns `exp(−distance / 9) · density` and is documented as decaying on the
 * same scale `BiteModel.structureFactor` uses for a marked school. Inverting it is how the two
 * are folded together without either of them learning about the other: the boost the shoals
 * publish goes back in as the distance the bite model asks for.
 */
const SCHOOL_DECAY_M = 9;

/** Ground relief that counts as full structure, how far around to look, and open-water distance. */
const STRUCTURE_PROBE_M = 7;
const STRUCTURE_RELIEF_M = 6;
const NO_STRUCTURE_M = 90;

/** Sea temperature below the thermocline on the shelf, and where the thermocline sits. */
const DEEP_WATER_C = 7;
const THERMOCLINE_TOP_M = 8;
const THERMOCLINE_BASE_M = 45;

/** How strongly a bait in the water pulls a shoal onto it, 0..1. */
const BAIT_ATTRACTION = 0.85;

const rodTip = new Vector3();
const lineEnd = new Vector3();
const aim = new Vector3();
const launchVelocity = new Vector3();

/**
 * Nominal range of a full-power cast, metres.
 *
 * Scaled by the reel because that is what the upgrade buys: a bigger spool with a smoother lip
 * lets line leave without the coils slapping it, and that is most of what distance is.
 */
export function castRangeM(reelSpeedMps: number): number {
  const better = reelSpeedMps / STOCK_REEL_MPS - 1;
  return MAX_CAST_RANGE_M * (1 + RANGE_PER_STOCK_REEL * better);
}

/** Launch speed that throws a drag-free projectile `rangeM` at the cast elevation. */
function launchSpeed(rangeM: number): number {
  return Math.sqrt((Math.max(0, rangeM) * GRAVITY) / Math.sin(2 * CAST_ELEVATION_RAD));
}

export class FishingSystem implements System {
  readonly name = 'fishing';
  /** After the fish have moved, before the camera and the post chain. */
  readonly priority = 40;

  private readonly machine = new FishingStateMachine();
  private readonly bobber = new Bobber();
  private readonly line = new FishingLine();
  private readonly fight = new Fight();
  private readonly rng: PRNG;

  private readonly water: WaterField;
  private readonly ground: GroundField;
  private readonly rod: RodSource;
  private readonly schools: SchoolSource | null;
  private readonly effects: Readonly<UpgradeEffects>;

  private readonly factors: BiteFactors = createBiteFactors();
  private readonly conditions: BiteConditions = {
    depthM: 0,
    beaufort: 0,
    precipitation: 0,
    sunAltitudeDeg: 0,
    moonIlluminatedFraction: 0,
    moonAltitudeDeg: 0,
    bait: 'worm',
    structureDistanceM: NO_STRUCTURE_M,
    schoolDistanceM: NO_SCHOOL_M,
    waterTemperatureC: 12,
  };
  private readonly fightConditions: FightConditions = {
    reel: 0,
    reelSpeedMps: 0,
    lineStrengthN: 0,
    waveHeightM: 0,
  };

  private charge = 0;
  private onTheHook: Species | null = null;
  private landedFish: CaughtFish | null = null;
  private strikeStrength = 0;
  private hookWindowLeft = 0;
  private baitDepth = 0;
  private riggedDepth = MIN_DROPPER_M;
  private lineOut = 0;
  private structureDistance = NO_STRUCTURE_M;
  private dwellLeft = 0;
  private bait: BaitKind = 'worm';

  constructor(
    host: FishingHost,
    water: WaterField,
    ground: GroundField,
    rod: RodSource,
    schools: SchoolSource | null,
    effects: Readonly<UpgradeEffects>,
    seed: number,
  ) {
    this.water = water;
    this.ground = ground;
    this.rod = rod;
    this.schools = schools;
    this.effects = effects;
    this.rng = new PRNG(seed);

    host.scene.add(this.bobber.group);
    host.scene.add(this.line.mesh);
  }

  /** Where the loop currently is. The HUD and the catch card read nothing else to decide layout. */
  get state(): FishingState {
    return this.machine.state;
  }

  /** 0..1 while charging, 0 the rest of the time. Drives the power bar. */
  get chargeFraction(): number {
    return this.machine.state === 'charging' ? this.charge : 0;
  }

  /** Fraction of the line's capacity in use, 0..1. */
  get tension(): number {
    return this.machine.state === 'fighting' ? this.fight.tension : 0;
  }

  /** What the hooked fish has left, 1 fresh and 0 beaten. */
  get fishStamina(): number {
    return this.machine.state === 'fighting' ? this.fight.staminaFraction : 0;
  }

  /** Metres from the rod tip to the fish. */
  get fishDistanceM(): number {
    return this.machine.state === 'fighting' ? this.fight.distanceM : 0;
  }

  /** The species on the hook, from the take until the rod goes idle again. */
  get hookedSpecies(): Species | null {
    return this.onTheHook;
  }

  /** The specimen that was landed, for the catch card and the journal. Null until one is. */
  get lastCatch(): CaughtFish | null {
    return this.landedFish;
  }

  /**
   * True whenever there is a fish on. The tension meter hides itself on this.
   *
   * Named to match `UiSystem.FishingReadout`, so this object *is* the readout the HUD wants and
   * `uiSystem.attach({ fishing: fishingSystem })` needs no adapter between them.
   */
  get hooked(): boolean {
    return this.machine.state === 'fighting';
  }

  /** Depth the bait is fishing at, metres below mean water level. */
  get baitDepthM(): number {
    return this.baitDepth;
  }

  /** Metres of line off the reel. The readout every boat has beside the sounder. */
  get lineOutM(): number {
    return this.lineOut;
  }

  /** What is on the hook. */
  get baitKind(): BaitKind {
    return this.bait;
  }

  setBait(bait: BaitKind): void {
    this.bait = bait;
  }

  /** The float's materials, for the shadow rig to register. See CLAUDE.md on CSM. */
  get materials(): readonly MeshStandardMaterial[] {
    return this.bobber.materials;
  }

  /**
   * Edges and visuals.
   *
   * Every button *edge* lives here rather than in `fixedUpdate`, for the reason `Boat` gives: a
   * rendered frame can run six fixed steps, and an edge read on the fixed clock would fire six
   * times. Held state is safe on either clock and is read where it is integrated.
   */
  update(dt: number, host: FishingHost): void {
    const input = host.input;

    switch (this.machine.state) {
      case 'idle':
        if (input.primaryPressed && this.canCast()) this.beginCharge();
        break;
      case 'charging':
        // A blur clears `primaryDown` without ever sending a release, so the button being up is
        // the condition rather than the release edge. Alt-tabbing mid-cast throws the float.
        if (input.primaryReleased || !input.primaryDown) this.releaseCast(host);
        break;
      case 'bite':
        if (input.primaryPressed) this.setHook();
        break;
      case 'landed':
      case 'escaped':
        if (input.primaryPressed) this.dwellLeft = 0;
        break;
      case 'casting':
      case 'sinking':
      case 'waiting':
      case 'fighting':
        break;
    }

    this.line.updateLighting(host.world);
    this.refreshStructure();
    this.drawTackle(dt);
  }

  /** Everything integrated over time, on the fixed clock the bite rolls are calibrated for. */
  fixedUpdate(dt: number, host: FishingHost): void {
    switch (this.machine.state) {
      case 'idle':
        break;
      case 'charging':
        this.charge = clamp(this.charge + dt / CHARGE_SECONDS, 0, 1);
        break;
      case 'casting':
        this.stepFlight(dt, host);
        break;
      case 'sinking':
        this.stepSink(dt, host);
        break;
      case 'waiting':
        this.stepWaiting(dt, host);
        break;
      case 'bite':
        this.stepBite(dt, host);
        break;
      case 'fighting':
        this.stepFight(dt, host);
        break;
      // The float keeps riding the swell while the catch card is up. Freezing it for two seconds
      // in the middle of a moving sea reads as a hitch in the frame rate, not as a pause.
      case 'landed':
        this.dwellLeft -= dt;
        this.settleFloat(dt, host, 0);
        if (this.dwellLeft <= 0 && this.machine.to('landed', 'idle')) this.stow();
        break;
      case 'escaped':
        this.dwellLeft -= dt;
        this.settleFloat(dt, host, 0);
        if (this.dwellLeft <= 0 && this.machine.to('escaped', 'idle')) this.stow();
        break;
    }
  }

  dispose(): void {
    this.bobber.dispose();
    this.line.dispose();
    this.schools?.clearBait();
  }

  /**
   * A cast is a two-handed job.
   *
   * Under way it lands behind the boat and the line is straight across the tide before the bait
   * is down, which is why anglers stop the boat first. Anchored is always fair; drifting is fair
   * up to a walking pace.
   */
  private canCast(): boolean {
    if (this.rod.isAnchored) return true;
    return Math.hypot(this.rod.velocity.x, this.rod.velocity.z) < CAST_SPEED_LIMIT_MPS;
  }

  private beginCharge(): void {
    if (!this.machine.to('idle', 'charging')) return;
    this.charge = 0;
  }

  private releaseCast(host: FishingHost): void {
    if (!this.machine.to('charging', 'casting')) return;

    this.rod.rodTipWorldPosition(rodTip);
    host.camera.getWorldDirection(aim);
    aim.y = 0;
    // Looking straight up or straight down leaves nothing to aim along; fall back to world north
    // rather than launching the float at a NaN bearing.
    if (aim.lengthSq() < 1e-6) aim.set(0, 0, -1);
    aim.normalize();

    const range = MIN_CAST_RANGE_M + (castRangeM(this.effects.reelSpeedMps) - MIN_CAST_RANGE_M) * this.charge;
    const speed = launchSpeed(range);
    const horizontal = Math.cos(CAST_ELEVATION_RAD) * speed;
    launchVelocity.set(aim.x * horizontal, Math.sin(CAST_ELEVATION_RAD) * speed, aim.z * horizontal);
    // The float leaves a moving platform, so it leaves with the platform's velocity in it.
    launchVelocity.add(this.rod.velocity);

    this.bobber.launch(rodTip, launchVelocity);
    this.line.reset();
    this.line.setVisible(true);
    this.line.setOpacity(1);
    this.lineOut = STOWED_LINE_M;
    this.baitDepth = 0;
    this.charge = 0;
  }

  private stepFlight(dt: number, host: FishingHost): void {
    const world = host.world;
    this.bobber.integrateFlight(dt, world.windX, world.windZ);
    if (!this.bobber.hasSplashed(this.water)) return;

    // The splash. A float arriving at twelve metres a second keeps almost none of it — the
    // impulse goes into the crown of water it throws up — and handing that speed to the
    // buoyancy solver as an initial condition would drive it to the seabed and back.
    const entry = this.bobber.velocity.length();
    if (entry > SPLASH_ENTRY_MPS) this.bobber.velocity.multiplyScalar(SPLASH_ENTRY_MPS / entry);

    this.rod.rodTipWorldPosition(rodTip);
    this.lineOut = Math.max(STOWED_LINE_M, rodTip.distanceTo(this.bobber.position) * CAST_SLACK);
    this.machine.to('casting', 'sinking');
  }

  private stepSink(dt: number, host: FishingHost): void {
    this.settleFloat(dt, host, 0);
    this.riggedDepth = this.fishingDepth();
    this.baitDepth = Math.min(this.riggedDepth, this.baitDepth + SINK_RATE_MPS * dt);
    if (this.baitDepth >= this.riggedDepth) this.machine.to('sinking', 'waiting');
  }

  private stepWaiting(dt: number, host: FishingHost): void {
    if (host.input.isHeld('reel')) {
      this.retrieve(dt);
      return;
    }

    this.settleFloat(dt, host, 0);
    this.riggedDepth = this.fishingDepth();
    this.baitDepth = Math.min(this.riggedDepth, this.baitDepth + SINK_RATE_MPS * dt);

    const boost = this.markBait();
    this.buildConditions(host.world, boost);
    // `lureQuality` is documented as a multiplier on the bait factor, and the bite rate is a
    // product with that factor in it — so scaling the interval scales the rate by exactly the
    // same amount, and the bite model does not need to learn about the upgrade tree.
    const bite = rollBite(this.conditions, this.factors, dt * this.effects.lureQuality, this.rng);
    if (bite === null) return;

    this.onTheHook = bite.species;
    this.strikeStrength = bite.strike;
    this.hookWindowLeft = bite.hookWindow;
    this.bobber.dip(bite.strike);
    this.machine.to('waiting', 'bite');
  }

  private stepBite(dt: number, host: FishingHost): void {
    this.settleFloat(dt, host, BITE_PULL_DOWN * this.strikeStrength);
    this.hookWindowLeft -= dt;
    if (this.hookWindowLeft > 0) return;
    // It let go. Nothing was ever on the hook, so there is nothing to reset but the take itself.
    if (this.machine.to('bite', 'escaped')) this.beginDwell(ESCAPED_DWELL_S);
  }

  private setHook(): void {
    const species = this.onTheHook;
    if (species === null) return;

    this.rod.rodTipWorldPosition(rodTip);
    const offsetX = this.bobber.position.x - rodTip.x;
    const offsetZ = this.bobber.position.z - rodTip.z;
    const distance = Math.hypot(offsetX, offsetZ);
    if (!this.machine.to('bite', 'fighting')) return;

    this.fight.begin(species, distance, Math.atan2(offsetX, offsetZ), this.rng);
  }

  private stepFight(dt: number, host: FishingHost): void {
    const species = this.onTheHook;
    if (species === null) return;

    const world = host.world;
    const conditions = this.fightConditions;
    conditions.reel = host.input.isHeld('reel') || host.input.primaryDown ? 1 : 0;
    conditions.reelSpeedMps = this.effects.reelSpeedMps;
    conditions.lineStrengthN = this.effects.lineStrengthN;
    conditions.waveHeightM = world.significantWaveHeight;

    const outcome = this.fight.step(dt, species, conditions, this.rng);

    // The float goes wherever the fish is, and is held under by however much load is on it.
    this.rod.rodTipWorldPosition(rodTip);
    const bearing = this.fight.bearingRad;
    const range = this.fight.distanceM;
    this.bobber.steerTowards(
      dt,
      rodTip.x + Math.sin(bearing) * range,
      rodTip.z + Math.cos(bearing) * range,
      FIGHT_STEER_RATE,
    );
    this.bobber.integrateHeave(dt, this.water, this.fight.tension);
    this.lineOut = Math.max(STOWED_LINE_M, range);

    switch (outcome) {
      case 'fighting':
        break;
      case 'landed':
        this.landedFish = rollSpecimen(species, this.rng);
        if (this.machine.to('fighting', 'landed')) this.beginDwell(LANDED_DWELL_S);
        break;
      case 'snapped':
      case 'thrown':
        if (this.machine.to('fighting', 'escaped')) this.beginDwell(ESCAPED_DWELL_S);
        break;
    }
  }

  /**
   * Wind the float back to the rod tip. The only way out of a cast nothing wanted.
   *
   * The float is dragged in by the line getting shorter rather than by being steered, so the
   * retrieve takes exactly as long as the reel says it should and a better reel is felt here too.
   * The finish is judged on the horizontal offset: the rod tip is nearly two metres above the
   * water and a three-dimensional distance could never close to a rod's length.
   */
  private retrieve(dt: number): void {
    this.rod.rodTipWorldPosition(rodTip);
    this.lineOut = Math.max(STOWED_LINE_M, this.lineOut - this.effects.reelSpeedMps * dt);
    this.bobber.integrateHeave(dt, this.water, 0);
    this.bobber.tether(rodTip, this.lineOut);

    const offsetX = this.bobber.position.x - rodTip.x;
    const offsetZ = this.bobber.position.z - rodTip.z;
    if (Math.hypot(offsetX, offsetZ) > STOWED_LINE_M) return;
    if (this.machine.to('waiting', 'idle')) this.stow();
  }

  /**
   * The float on the water: buoyancy, drift, and the line coming tight.
   *
   * Heave before drift, in that order and in the same step, because the drift term reads the
   * surface normal the heave term sampled — see `Bobber.integrateDrift`.
   */
  private settleFloat(dt: number, host: FishingHost, pullDown: number): void {
    const world = host.world;
    this.bobber.integrateHeave(dt, this.water, pullDown);
    this.bobber.integrateDrift(dt, world.windX, world.windZ);
    this.rod.rodTipWorldPosition(rodTip);
    this.bobber.tether(rodTip, this.lineOut);
  }

  /**
   * How deep the bait is fishing.
   *
   * As deep as the rig will reach, or a short way off the bottom if the ground comes up to meet
   * it — which is what a boat angler does over a bank, and what makes a bank worth finding.
   */
  private fishingDepth(): number {
    const surface = this.water.heightAt(this.bobber.position.x, this.bobber.position.z);
    const floor = this.ground.floorHeightAt(this.bobber.position.x, this.bobber.position.z);
    const column = Math.max(0, surface - floor);
    return clamp(column - BOTTOM_CLEARANCE_M, MIN_DROPPER_M, MAX_DROPPER_M);
  }

  /** Put the bait on the shoals' map and take back how much of one is over it. */
  private markBait(): number {
    const schools = this.schools;
    if (schools === null) return 0;
    const surface = this.water.heightAt(this.bobber.position.x, this.bobber.position.z);
    schools.setBait(
      this.bobber.position.x,
      surface - this.baitDepth,
      this.bobber.position.z,
      BAIT_ATTRACTION,
    );
    return clamp(schools.schoolBoost(this.bobber.position), 0, 1);
  }

  private buildConditions(world: WorldState, schoolBoost: number): void {
    const conditions = this.conditions;
    const ephemeris = world.ephemeris;

    conditions.depthM = this.baitDepth;
    conditions.beaufort = world.beaufort;
    conditions.precipitation = world.precipitation;
    conditions.sunAltitudeDeg = ephemeris === null ? 0 : ephemeris.sunAltitudeDeg;
    conditions.moonIlluminatedFraction = ephemeris === null ? 0 : ephemeris.moon.illuminatedFraction;
    conditions.moonAltitudeDeg = ephemeris === null ? 0 : ephemeris.moonAltitudeDeg;
    conditions.bait = this.bait;
    conditions.structureDistanceM = this.structureDistance;
    conditions.schoolDistanceM =
      schoolBoost <= 0 ? NO_SCHOOL_M : Math.min(NO_SCHOOL_M, -SCHOOL_DECAY_M * Math.log(schoolBoost));
    // Sea surface temperature is the air's, and below the thermocline it is not. A bait on the
    // bottom of a summer bank is in winter water, and that is what puts cod under a July sky.
    conditions.waterTemperatureC =
      world.temperatureC -
      (world.temperatureC - DEEP_WATER_C) *
        smoothstep(THERMOCLINE_TOP_M, THERMOCLINE_BASE_M, this.baitDepth);
  }

  /**
   * Distance to structure, read off the ground itself.
   *
   * There is no register of reefs and wrecks to query, and there does not need to be: structure
   * *is* relief. Four samples a few metres out give the local roughness, and rough ground under
   * the bait is the thing `BiteModel.structureFactor` is asking about. Sampled once a frame
   * rather than once a step — the float does not move far in eight milliseconds.
   */
  private refreshStructure(): void {
    if (!this.bobber.visible) {
      this.structureDistance = NO_STRUCTURE_M;
      return;
    }
    const x = this.bobber.position.x;
    const z = this.bobber.position.z;
    const centre = this.ground.floorHeightAt(x, z);
    const relief = Math.max(
      Math.abs(this.ground.floorHeightAt(x + STRUCTURE_PROBE_M, z) - centre),
      Math.abs(this.ground.floorHeightAt(x - STRUCTURE_PROBE_M, z) - centre),
      Math.abs(this.ground.floorHeightAt(x, z + STRUCTURE_PROBE_M) - centre),
      Math.abs(this.ground.floorHeightAt(x, z - STRUCTURE_PROBE_M) - centre),
    );
    this.structureDistance = NO_STRUCTURE_M * (1 - smoothstep(0.4, STRUCTURE_RELIEF_M, relief));
  }

  /** Copy the solved tackle onto the scene graph. Once a frame, not once a step. */
  private drawTackle(dt: number): void {
    if (!this.bobber.visible) return;

    this.rod.rodTipWorldPosition(rodTip);
    this.bobber.lineAttachment(lineEnd);
    const straight = rodTip.distanceTo(lineEnd);
    const tension = this.tension;
    // A loaded line is straight and a slack one hangs, and the solver only needs to be told how
    // much line there is for that to fall out of it by itself.
    const deployed = Math.max(this.lineOut, straight) * (1 + LINE_SAG * (1 - tension));
    this.line.resolve(dt, rodTip, lineEnd, deployed, tension);
    this.bobber.sync();
  }

  private beginDwell(seconds: number): void {
    this.dwellLeft = seconds;
    this.schools?.clearBait();
    this.line.setOpacity(0.35);
  }

  /** Out of the water and back on the reel. The one place a cast's leftovers are cleared. */
  private stow(): void {
    this.bobber.setVisible(false);
    this.line.setVisible(false);
    this.line.reset();
    this.fight.clear();
    this.schools?.clearBait();
    this.onTheHook = null;
    this.charge = 0;
    this.strikeStrength = 0;
    this.hookWindowLeft = 0;
    this.baitDepth = 0;
    this.lineOut = 0;
    this.dwellLeft = 0;
    this.structureDistance = NO_STRUCTURE_M;
  }
}

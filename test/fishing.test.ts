import { describe, expect, it, vi } from 'vitest';

/**
 * The fishing loop, driven end to end with no GPU in the room.
 *
 * The properties under test are the ones whose failure is invisible until it has already ruined
 * a session:
 *
 *   1. **Every state is reachable and no illegal pair is expressible.** A state machine nobody can
 *      get out of is the classic fishing-game bug — a float in the water that cannot be retrieved,
 *      a catch card that never clears. The graph is asserted against `LEGAL_TRANSITIONS`, and the
 *      compile-time half of the guarantee is asserted with `@ts-expect-error`, which fails the
 *      build if the type ever stops rejecting the pair.
 *   2. **Tension never leaves 0..1.** The HUD scales a bar by it and the line shader thins a tube
 *      by it; a single frame at 1.4 is a visible pop that no exception is thrown for.
 *   3. **Both ways of losing a fish actually happen.** Over-tension parts the line and prolonged
 *      slack drops the hook. If either is unreachable the fight has no downside and the whole
 *      model is decoration.
 *   4. **Stamina is the difficulty knob it claims to be.** A species with more of it takes
 *      strictly longer to land, everything else held equal — otherwise `Species.stamina` is a
 *      number in a table that nothing reads.
 *   5. **The whole session is reproducible from a seed.** Everything else in this world is, and a
 *      fight that quietly reaches for `Math.random` cannot be replayed to find out why it went
 *      wrong.
 *
 * `FishingSystem` draws the line with a `ShaderMaterial`, and vitest has no shader plugin. The two
 * stubs below stand in for the GLSL; nothing under test reads a shader string.
 */
vi.mock('../src/shaders/line/line.vert', () => ({ default: '' }));
vi.mock('../src/shaders/line/line.frag', () => ({ default: '' }));

import { Vector3, type Object3D } from 'three';
import { computeEphemeris, type EphemerisState } from '../src/astro/Ephemeris.js';
import type { GeoLocation } from '../src/astro/Coordinates.js';
import type { ActionName } from '../src/core/Input.js';
import { createWorldState, type WorldState } from '../src/core/WorldState.js';
import type { WaterField } from '../src/entities/Bobber.js';
import {
  Fight,
  LANDING_RANGE_M,
  SLACK_GRACE_S,
  snapThreshold,
  type FightConditions,
  type FightOutcome,
} from '../src/gameplay/FightModel.js';
import {
  FishingStateMachine,
  FishingSystem,
  LEGAL_TRANSITIONS,
  canTransition,
  castRangeM,
  type FishingHost,
  type FishingInput,
  type FishingState,
  type GroundField,
  type RodSource,
  type SchoolSource,
} from '../src/gameplay/FishingSystem.js';
import { upgradeEffect, type UpgradeEffects } from '../src/gameplay/Progression.js';
import { speciesById, type Species } from '../src/gameplay/Species.js';
import { PRNG } from '../src/math/PRNG.js';

const FIXED_DT = 1 / 120;
const FRAME_DT = 1 / 60;

/** The graph the design calls for, written out independently of the module that implements it. */
const EXPECTED_GRAPH: Readonly<Record<FishingState, readonly FishingState[]>> = {
  idle: ['charging'],
  charging: ['casting'],
  casting: ['sinking'],
  sinking: ['waiting'],
  waiting: ['bite', 'idle'],
  bite: ['fighting', 'escaped'],
  fighting: ['landed', 'escaped'],
  landed: ['idle'],
  escaped: ['idle'],
};

const ALL_STATES: readonly FishingState[] = [
  'idle',
  'charging',
  'casting',
  'sinking',
  'waiting',
  'bite',
  'fighting',
  'landed',
  'escaped',
];

function requireSpecies(id: string): Species {
  const species = speciesById(id);
  if (species === undefined) throw new Error(`the species table has lost its ${id}`);
  return species;
}

function tackle(lineStrengthN: number, reelSpeedMps: number): UpgradeEffects {
  return { lineStrengthN, reelSpeedMps, lureQuality: 1, sonarRangeM: 40, enginePowerN: 2200 };
}

// --------------------------------------------------------------------------------------------
// Stand-ins for the world. Each is the structural slice `FishingSystem` asks for and no more.
// --------------------------------------------------------------------------------------------

/** A dead flat sea, so the only thing moving the float is the float's own buoyancy. */
class FlatSea implements WaterField {
  heightAt(): number {
    return 0;
  }

  normalAt(_x: number, _z: number, out: Vector3): Vector3 {
    return out.set(0, 1, 0);
  }
}

class LevelGround implements GroundField {
  private readonly depth: number;

  constructor(depthM: number) {
    this.depth = depthM;
  }

  floorHeightAt(): number {
    return -this.depth;
  }
}

class MooredRod implements RodSource {
  readonly position = new Vector3(0, 0, 0);
  readonly velocity = new Vector3(0, 0, 0);
  readonly isAnchored = true;
  private readonly tip = new Vector3(0, 1.9, -1.2);

  rodTipWorldPosition(out: Vector3): Vector3 {
    return out.copy(this.tip);
  }
}

/** A shoal sitting right on the mark, so the bite rate is dominated by terms the test controls. */
class DenseShoal implements SchoolSource {
  baitStrength = 0;

  schoolBoost(): number {
    return 0.95;
  }

  setBait(_x: number, _y: number, _z: number, strength: number): void {
    this.baitStrength = strength;
  }

  clearBait(): void {
    this.baitStrength = 0;
  }
}

class TestInput implements FishingInput {
  primaryDown = false;
  primaryPressed = false;
  primaryReleased = false;

  private readonly held = new Set<ActionName>();

  isHeld(action: ActionName): boolean {
    return this.held.has(action);
  }

  hold(action: ActionName): void {
    this.held.add(action);
  }

  letGo(action: ActionName): void {
    this.held.delete(action);
  }

  press(): void {
    this.primaryDown = true;
    this.primaryPressed = true;
  }

  release(): void {
    this.primaryDown = false;
    this.primaryReleased = true;
  }

  endFrame(): void {
    this.primaryPressed = false;
    this.primaryReleased = false;
  }
}

/**
 * A dusk, asked for by solar altitude rather than by the clock.
 *
 * The bite model is keyed on where the sun is, so the test has to be too: picking "eight in the
 * evening" would be a different part of the curve at every latitude and in every month, and the
 * test would pass or fail on the calendar. Scanning a day for the sample closest to +3° finds the
 * peak of `timeOfDayFactor` wherever and whenever it actually is.
 */
const LOCATION: GeoLocation = { latitudeDeg: 58.2, longitudeDeg: -6.4, elevationM: 0 };

function duskEphemeris(): EphemerisState {
  const start = Date.UTC(2026, 5, 21, 0, 0, 0);
  let best = computeEphemeris(start, LOCATION);
  for (let step = 1; step < 144; step += 1) {
    const candidate = computeEphemeris(start + step * 600_000, LOCATION);
    if (Math.abs(candidate.sunAltitudeDeg - 3) < Math.abs(best.sunAltitudeDeg - 3)) {
      best = candidate;
    }
  }
  return best;
}

function fishingWeather(): WorldState {
  const world = createWorldState();
  world.ephemeris = duskEphemeris();
  // Force 3: the best fishing weather there is, per `BiteModel.weatherFactor`.
  world.beaufort = 3;
  world.windX = 4.2;
  world.windZ = 1.1;
  world.windSpeed = Math.hypot(world.windX, world.windZ);
  world.significantWaveHeight = 0.8;
  world.precipitation = 0;
  world.temperatureC = 12;
  return world;
}

/** One rod, one boat, one patch of sea, plus a record of everywhere the machine has been. */
class Rig {
  readonly input = new TestInput();
  readonly world: WorldState;
  readonly system: FishingSystem;
  readonly scenery: Object3D[] = [];
  readonly visited = new Set<FishingState>();
  readonly trace: FishingState[] = [];

  minTension = Infinity;
  maxTension = -Infinity;

  private readonly host: FishingHost;

  constructor(effects: UpgradeEffects, seed: number, bottomM = 30) {
    this.world = fishingWeather();
    const scenery = this.scenery;
    this.host = {
      scene: {
        add(object: Object3D): void {
          scenery.push(object);
        },
      },
      camera: {
        getWorldDirection(target: Vector3): Vector3 {
          return target.set(0, 0, -1);
        },
      },
      input: this.input,
      world: this.world,
    };
    this.system = new FishingSystem(
      this.host,
      new FlatSea(),
      new LevelGround(bottomM),
      new MooredRod(),
      new DenseShoal(),
      effects,
      seed,
    );
    this.system.setBait('sandeel');
    this.record();
  }

  get state(): FishingState {
    return this.system.state;
  }

  /** One rendered frame: two fixed steps, then the visual pass, then the input edges clear. */
  frame(): void {
    this.system.fixedUpdate(FIXED_DT, this.host);
    this.record();
    this.system.fixedUpdate(FIXED_DT, this.host);
    this.record();
    this.system.update(FRAME_DT, this.host);
    this.record();
    this.input.endFrame();
  }

  /** Run frames until `done` or the budget runs out. Returns whether it got there. */
  runUntil(done: () => boolean, maxFrames: number): boolean {
    for (let i = 0; i < maxFrames && !done(); i += 1) this.frame();
    return done();
  }

  private record(): void {
    const state = this.system.state;
    this.visited.add(state);
    if (this.trace[this.trace.length - 1] !== state) this.trace.push(state);
    if (state === 'fighting') {
      this.minTension = Math.min(this.minTension, this.system.tension);
      this.maxTension = Math.max(this.maxTension, this.system.tension);
    }
  }
}

/** Charge for `chargeFrames`, let go, and wait for the bait to reach its fishing depth. */
function castAndSettle(rig: Rig, chargeFrames: number): void {
  rig.input.press();
  rig.frame();
  expect(rig.state).toBe('charging');
  for (let i = 0; i < chargeFrames; i += 1) rig.frame();
  rig.input.release();
  rig.frame();
  expect(rig.state).toBe('casting');

  expect(rig.runUntil(() => rig.state === 'sinking', 600)).toBe(true);
  expect(rig.runUntil(() => rig.state === 'waiting', 4000)).toBe(true);
}

/**
 * Play the fish: keep the reel turning while there is room on the meter, and give line when there
 * is not. This is the strategy the model is built to reward, so it is the one the test uses.
 */
function playOut(rig: Rig, maxFrames: number): void {
  rig.runUntil(() => {
    if (rig.state !== 'fighting') return true;
    if (rig.system.tension < 0.5) rig.input.hold('reel');
    else rig.input.letGo('reel');
    return false;
  }, maxFrames);
  rig.input.letGo('reel');
}

// --------------------------------------------------------------------------------------------

describe('The fishing state graph', () => {
  it('is exactly the graph the loop is specified as', () => {
    expect(Object.keys(LEGAL_TRANSITIONS).sort()).toEqual([...ALL_STATES].sort());
    for (const from of ALL_STATES) {
      expect(LEGAL_TRANSITIONS[from]).toEqual(EXPECTED_GRAPH[from]);
    }
  });

  it('rejects every pair the graph does not contain', () => {
    let rejected = 0;
    for (const from of ALL_STATES) {
      for (const to of ALL_STATES) {
        const legal = EXPECTED_GRAPH[from].includes(to);
        expect(canTransition(from, to)).toBe(legal);
        if (!legal) rejected += 1;
      }
    }
    // 81 ordered pairs, 12 of them legal. If that count ever changes, the graph changed with it.
    expect(rejected).toBe(69);
  });

  it('refuses a transition requested from a state it is not in', () => {
    const machine = new FishingStateMachine();
    expect(machine.state).toBe('idle');
    // Legal edge, wrong source: the caller is stale and the machine says so rather than jumping.
    expect(machine.to('waiting', 'bite')).toBe(false);
    expect(machine.state).toBe('idle');

    expect(machine.to('idle', 'charging')).toBe(true);
    expect(machine.state).toBe('charging');
    // The same call a second time is a double-fire, and is refused for the same reason.
    expect(machine.to('idle', 'charging')).toBe(false);
    expect(machine.state).toBe('charging');
  });

  it('will not compile an illegal successor', () => {
    const machine = new FishingStateMachine();
    // @ts-expect-error `NextState<'idle'>` is derived from LEGAL_TRANSITIONS and is only
    // 'charging'. If this line ever type-checks, the graph has stopped being enforced by the
    // compiler and this directive fails the build to say so.
    expect(machine.to('idle', 'fighting')).toBe(false);
    expect(machine.state).toBe('idle');
  });
});

describe('The cast', () => {
  it('charges while the button is held and reads back for the power bar', () => {
    const rig = new Rig(tackle(55, 0.65), 0x1234);
    expect(rig.system.chargeFraction).toBe(0);

    rig.input.press();
    rig.frame();
    expect(rig.state).toBe('charging');

    let previous = rig.system.chargeFraction;
    for (let i = 0; i < 20; i += 1) {
      rig.frame();
      expect(rig.system.chargeFraction).toBeGreaterThan(previous);
      previous = rig.system.chargeFraction;
    }
    expect(previous).toBeGreaterThan(0);
    expect(previous).toBeLessThan(1);

    // Held past full charge it saturates rather than running away.
    for (let i = 0; i < 200; i += 1) rig.frame();
    expect(rig.system.chargeFraction).toBe(1);
  });

  it('reaches further with a better reel', () => {
    const stock = castRangeM(upgradeEffect('reel-speed', 0));
    const upgraded = castRangeM(upgradeEffect('reel-speed', 6));
    expect(upgraded).toBeGreaterThan(stock);

    const near = new Rig(tackle(55, upgradeEffect('reel-speed', 0)), 0x51de);
    const far = new Rig(tackle(55, upgradeEffect('reel-speed', 6)), 0x51de);
    for (const rig of [near, far]) castAndSettle(rig, 40);
    expect(far.system.lineOutM).toBeGreaterThan(near.system.lineOutM);
  });

  it('puts the float in the water and then leaves it on the surface', () => {
    const rig = new Rig(tackle(55, 0.65), 0xa1);
    castAndSettle(rig, 30);
    expect(rig.trace.slice(0, 5)).toEqual(['idle', 'charging', 'casting', 'sinking', 'waiting']);
    // The rig fishes as deep as it reaches, short of the ground it was given.
    expect(rig.system.baitDepthM).toBeGreaterThan(1);
    expect(rig.system.baitDepthM).toBeLessThanOrEqual(12);
    // Bobber and line both went into the scene, which is the only thing this system draws.
    expect(rig.scenery.length).toBe(2);
  });

  it('can be wound back in when nothing wants it', () => {
    const rig = new Rig(tackle(55, 1.2), 0xb2);
    castAndSettle(rig, 30);
    rig.input.hold('reel');
    expect(rig.runUntil(() => rig.state === 'idle', 6000)).toBe(true);
    expect(rig.trace).toEqual(['idle', 'charging', 'casting', 'sinking', 'waiting', 'idle']);
  });
});

describe('A whole session', () => {
  it('reaches every state in the graph', () => {
    const visited = new Set<FishingState>();

    // A landed fish: idle -> charging -> casting -> sinking -> waiting -> bite -> fighting ->
    // landed -> idle. Heavy line and a quick reel so the fight is decided by the model rather
    // than by the test running out of patience.
    const landing = new Rig(tackle(400, 2.5), 0x0f15, 30);
    castAndSettle(landing, 18);
    expect(landing.runUntil(() => landing.state === 'bite', 20000)).toBe(true);
    expect(landing.system.hookedSpecies).not.toBeNull();

    landing.input.press();
    landing.frame();
    expect(landing.state).toBe('fighting');
    landing.input.release();
    landing.frame();

    playOut(landing, 40000);
    expect(landing.state).toBe('landed');

    const caught = landing.system.lastCatch;
    expect(caught).not.toBeNull();
    if (caught !== null) {
      expect(caught.massKg).toBeGreaterThanOrEqual(caught.species.minMassKg);
      expect(caught.massKg).toBeLessThanOrEqual(caught.species.maxMassKg);
      expect(caught.lengthM).toBeGreaterThan(0);
      expect(caught.value).toBeGreaterThan(0);
    }

    expect(landing.system.hooked).toBe(false);
    expect(landing.runUntil(() => landing.state === 'idle', 1200)).toBe(true);
    // Back to a clean rod: nothing from the fight is still being reported.
    expect(landing.system.hookedSpecies).toBeNull();
    expect(landing.system.tension).toBe(0);
    expect(landing.system.chargeFraction).toBe(0);
    for (const state of landing.visited) visited.add(state);

    // A missed strike: the fish spits the bait and the rod reports the same loss it would after
    // a parted line, because it is the same event as far as the player is concerned.
    const missed = new Rig(tackle(55, 0.65), 0x0f15, 30);
    castAndSettle(missed, 18);
    expect(missed.runUntil(() => missed.state === 'bite', 20000)).toBe(true);
    expect(missed.runUntil(() => missed.state === 'escaped', 1200)).toBe(true);
    expect(missed.runUntil(() => missed.state === 'idle', 1200)).toBe(true);
    for (const state of missed.visited) visited.add(state);

    expect([...visited].sort()).toEqual([...ALL_STATES].sort());
  });

  it('keeps tension inside 0..1 for the whole fight', () => {
    const rig = new Rig(tackle(400, 2.5), 0x7a17, 30);
    castAndSettle(rig, 18);
    expect(rig.runUntil(() => rig.state === 'bite', 20000)).toBe(true);
    rig.input.press();
    rig.frame();
    rig.input.release();
    playOut(rig, 40000);

    expect(rig.minTension).toBeGreaterThanOrEqual(0);
    expect(rig.maxTension).toBeLessThanOrEqual(1);
    // ...and the meter actually moved, so the bounds above are not vacuously true.
    expect(rig.maxTension).toBeGreaterThan(0.2);
  });

  it('is reproducible from a seed', () => {
    const play = (seed: number): { trace: string; species: string; mass: number } => {
      const rig = new Rig(tackle(400, 2.5), seed, 30);
      castAndSettle(rig, 18);
      rig.runUntil(() => rig.state === 'bite', 20000);
      rig.input.press();
      rig.frame();
      rig.input.release();
      playOut(rig, 40000);
      rig.runUntil(() => rig.state === 'idle', 1200);
      const caught = rig.system.lastCatch;
      return {
        trace: rig.trace.join('>'),
        species: caught === null ? 'none' : caught.species.id,
        mass: caught === null ? 0 : caught.massKg,
      };
    };

    const first = play(0x5eed);
    const second = play(0x5eed);
    expect(second).toEqual(first);

    // ...and a different seed is a different session, so the determinism above is not the
    // result of the seed being ignored.
    const other = play(0x5eee);
    expect(other.mass).not.toBe(first.mass);
  });
});

// --------------------------------------------------------------------------------------------
// The fight on its own: pure numbers, no scene, no float, no line.
// --------------------------------------------------------------------------------------------

interface FightRun {
  outcome: FightOutcome;
  steps: number;
  seconds: number;
  minTension: number;
  maxTension: number;
}

function fightFor(
  species: Species,
  effects: { lineStrengthN: number; reelSpeedMps: number; waveHeightM: number },
  reelPolicy: (fight: Fight) => number,
  seed: number,
  startRangeM: number,
  maxSteps: number,
): FightRun {
  const fight = new Fight();
  const rng = new PRNG(seed);
  fight.begin(species, startRangeM, 0, rng);

  const conditions: FightConditions = {
    reel: 0,
    reelSpeedMps: effects.reelSpeedMps,
    lineStrengthN: effects.lineStrengthN,
    waveHeightM: effects.waveHeightM,
  };

  let minTension = Infinity;
  let maxTension = -Infinity;
  for (let step = 1; step <= maxSteps; step += 1) {
    conditions.reel = reelPolicy(fight);
    const outcome = fight.step(FIXED_DT, species, conditions, rng);
    minTension = Math.min(minTension, fight.tension);
    maxTension = Math.max(maxTension, fight.tension);
    if (outcome !== 'fighting') {
      return { outcome, steps: step, seconds: fight.elapsedS, minTension, maxTension };
    }
  }
  return { outcome: 'fighting', steps: maxSteps, seconds: fight.elapsedS, minTension, maxTension };
}

const ALWAYS = (): number => 1;
const NEVER = (): number => 0;
const PLAY = (fight: Fight): number => (fight.tension < 0.55 ? 1 : 0);

describe('The fight', () => {
  it('parts the line when it is held on too hard, and a heavier line lasts longer', () => {
    const halibut = requireSpecies('halibut');
    const rough = { reelSpeedMps: 0.65, waveHeightM: 0, lineStrengthN: 0 };

    const stock = fightFor(
      halibut,
      { ...rough, lineStrengthN: upgradeEffect('line-strength', 0) },
      ALWAYS,
      0xc0d,
      20,
      20000,
    );
    const heavy = fightFor(
      halibut,
      { ...rough, lineStrengthN: upgradeEffect('line-strength', 8) },
      ALWAYS,
      0xc0d,
      20,
      20000,
    );

    expect(stock.outcome).toBe('snapped');
    expect(heavy.outcome).toBe('snapped');
    // Nothing about the fight depends on the breaking strain except when it ends, so the two
    // runs are the same trajectory and the heavier line is strictly further along it.
    expect(heavy.steps).toBeGreaterThan(stock.steps);
    expect(snapThreshold(upgradeEffect('line-strength', 8))).toBeGreaterThan(
      snapThreshold(upgradeEffect('line-strength', 0)),
    );
  });

  it('raises the breaking point monotonically across the upgrade tree', () => {
    let previous = snapThreshold(upgradeEffect('line-strength', 0));
    for (let level = 1; level <= 8; level += 1) {
      const next = snapThreshold(upgradeEffect('line-strength', level));
      expect(next).toBeGreaterThan(previous);
      expect(next).toBeLessThanOrEqual(1);
      previous = next;
    }
  });

  it('drops the hook out when the line is left slack, and holds it when it is not', () => {
    const plaice = requireSpecies('plaice');
    // A fish that never runs, so nothing but the angler can keep the line in contact.
    const sulker: Species = { ...plaice, id: 'test-sulker', runRate: 0, pull: 0.4, stamina: 30 };
    const conditions = { lineStrengthN: 400, reelSpeedMps: 0.65, waveHeightM: 0 };

    const abandoned = fightFor(sulker, conditions, NEVER, 0x51ac, 14, 20000);
    expect(abandoned.outcome).toBe('thrown');
    // It survived the opening run, then went slack for the full grace period and no less.
    expect(abandoned.seconds).toBeGreaterThan(SLACK_GRACE_S);
    expect(abandoned.minTension).toBeGreaterThanOrEqual(0);

    const played = fightFor(sulker, conditions, PLAY, 0x51ac, 14, 40000);
    expect(played.outcome).toBe('landed');
    expect(played.maxTension).toBeLessThanOrEqual(1);
  });

  it('takes strictly longer to land a fish with more stamina', () => {
    const pollock = requireSpecies('pollock');
    const conditions = { lineStrengthN: 400, reelSpeedMps: 1, waveHeightM: 0 };
    const short: Species = { ...pollock, id: 'test-short', stamina: 7 };
    const long: Species = { ...pollock, id: 'test-long', stamina: 42 };

    const quick = fightFor(short, conditions, PLAY, 0x5a1, 18, 60000);
    const grind = fightFor(long, conditions, PLAY, 0x5a1, 18, 60000);

    expect(quick.outcome).toBe('landed');
    expect(grind.outcome).toBe('landed');
    expect(grind.steps).toBeGreaterThan(quick.steps);
  });

  it('holds tension inside 0..1 through a gale', () => {
    // Force 9 across the deck: the surge term is at full authority and is the only thing that
    // could push the load off either end of the meter.
    const conger = requireSpecies('conger');
    const run = fightFor(
      conger,
      { lineStrengthN: 400, reelSpeedMps: 1.4, waveHeightM: 7 },
      PLAY,
      0x8a1e,
      24,
      60000,
    );
    expect(run.minTension).toBeGreaterThanOrEqual(0);
    expect(run.maxTension).toBeLessThanOrEqual(1);
    expect(run.maxTension).toBeGreaterThan(0.3);
    expect(['landed', 'snapped', 'thrown']).toContain(run.outcome);
  });

  it('closes the distance only against a fish that is not running', () => {
    // A whiting pulls too lightly to part anything, so the reel can be held down for the whole
    // fight and the only thing deciding whether line comes in is what the fish is doing.
    const whiting = requireSpecies('whiting');
    const fight = new Fight();
    const rng = new PRNG(0xd15);
    fight.begin(whiting, 25, 0, rng);
    const conditions: FightConditions = {
      reel: 1,
      reelSpeedMps: 1.2,
      lineStrengthN: 400,
      waveHeightM: 0,
    };

    let closedWhileRunning = false;
    let closedWhileHolding = false;
    let ranAtAll = false;
    for (let step = 0; step < 40000; step += 1) {
      const before = fight.distanceM;
      const outcome = fight.step(FIXED_DT, whiting, conditions, rng);
      // Read the behaviour after the step: the fish decides at the top of it, so this is the
      // one the distance was moved by.
      const running = fight.behaviour === 'running' || fight.behaviour === 'sounding';
      const moved = fight.distanceM - before;
      ranAtAll = ranAtAll || running;
      if (running && moved < -1e-9) closedWhileRunning = true;
      if (!running && moved < -1e-9) closedWhileHolding = true;
      if (outcome !== 'fighting') break;
    }

    expect(ranAtAll).toBe(true);
    expect(closedWhileRunning).toBe(false);
    expect(closedWhileHolding).toBe(true);
  });

  it('is over once the fish is at the boat', () => {
    const whiting = requireSpecies('whiting');
    const run = fightFor(
      whiting,
      { lineStrengthN: 400, reelSpeedMps: 1.4, waveHeightM: 0 },
      PLAY,
      0x1a2d,
      LANDING_RANGE_M + 3,
      40000,
    );
    expect(run.outcome).toBe('landed');
    expect(run.seconds).toBeGreaterThan(0);
  });
});

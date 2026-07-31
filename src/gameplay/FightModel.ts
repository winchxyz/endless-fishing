import { clamp, damp } from '../math/Noise.js';
import type { PRNG } from '../math/PRNG.js';
import { upgradeEffect } from './Progression.js';
import type { Species } from './Species.js';

/**
 * What happens between the hook going in and the fish being in the boat.
 *
 * The whole model is built on one asymmetry, and everything worth feeling comes out of it: the
 * fish decides what it is doing and the angler only decides how much load to put on. You cannot
 * stop a run — you can only choose whether to fight it and risk the line, or give it and lose the
 * ground you made. That is why line-in is *not* a function of how fast the reel turns, and why a
 * button held down is the losing strategy rather than the winning one.
 *
 * Three quantities move, and they are coupled in a loop:
 *
 *   * **Load** rises when the reel turns against a fish that is pulling, and when the fish runs.
 *     It falls when neither is happening. Past the breaking strain the line parts; held near zero
 *     for long enough, the hook simply drops out of a mouth that is no longer being pulled
 *     against. Both failures are the same statement — a line that is not in contact is not
 *     fishing — approached from opposite ends.
 *   * **Stamina** drains at a rate set by what the animal is doing and by how hard it is being
 *     pumped. It is a real seconds budget, straight out of `Species.stamina`, so a halibut is not
 *     "harder" than a herring by a difficulty multiplier: it is harder because it can keep this up
 *     for fifty-five seconds and the herring cannot manage six.
 *   * **Range** closes only while the reel is turning and the fish is not going the other way.
 *     A green fish gives up very little line even when it is holding still, which is why the
 *     first minute of a big fish is spent getting nothing and the last ten seconds are easy.
 *
 * Nothing here knows about three.js, the scene, or where anything is in the world — a bearing in
 * radians is as spatial as it gets. That keeps the part of the game with actual feel in it
 * testable without a GPU anywhere near it.
 */

export type FishBehaviour = 'holding' | 'running' | 'sounding' | 'shaking';

/** How the step ended. Everything except `fighting` is terminal. */
export type FightOutcome = 'fighting' | 'landed' | 'snapped' | 'thrown';

/** Everything outside the fish that the fight depends on, refreshed by the caller each step. */
export interface FightConditions {
  /** Reel input this step, 0..1. */
  reel: number;
  /** Metres of line the reel recovers per second at full crank. */
  reelSpeedMps: number;
  /** Breaking strain of the line in newtons, from the upgrade tree. */
  lineStrengthN: number;
  /** Significant wave height, metres. Rough water makes the load volatile. */
  waveHeightM: number;
}

const TAU = Math.PI * 2;

/** Metres at which the fish is alongside and the net goes under it. */
export const LANDING_RANGE_M = 0.9;

/** Seconds of slack the hook survives before it falls out of a mouth nothing is pulling on. */
export const SLACK_GRACE_S = 2.2;

/** Below this load there is no contact with the fish at all. */
const SLACK_LOAD = 0.07;

/**
 * Load at which stock line parts.
 *
 * `HUD` draws its red rule at exactly this fraction of the meter and never moves it, which is the
 * point of the line-strength tree: what you buy is room above a mark that stays where it is, so
 * the meter means the same thing at every level and you can learn to read it once.
 */
const STOCK_STRAIN = 0.82;
const STOCK_LINE_N = upgradeEffect('line-strength', 0);
/** Extra strain survived per multiple of the stock breaking strain. */
const STRAIN_PER_STOCK = 0.045;
/** Nothing survives a load the meter cannot show. */
const MAX_STRAIN = 0.99;

/** What a completely spent fish can still apply, as a share of its peak. Dead weight is not zero. */
const SPENT_EFFORT = 0.3;

/** Load from cranking against dead weight, before the fish contributes anything. */
const REEL_LOAD = 0.16;
/** Load from cranking against a fish that is pulling the other way. */
const REEL_AGAINST = 0.78;
/** Load a run puts on regardless of the reel — a run takes line whether it is offered or not. */
const RUN_LOAD = 0.92;
/** A sound is a run straight down, and the rod absorbs more of it than of a run across the tide. */
const SOUND_SHARE = 0.78;
/** Peak load of a head shake. */
const SHAKE_LOAD = 0.6;
/** Shakes per second: a base rhythm plus the part that scales with how quick the animal is. */
const SHAKE_HZ = 1.6;
const SHAKE_HZ_PER_RUN_RATE = 0.9;

/** How fast the load follows the fish, 1/s. Line comes tight faster than it goes slack. */
const TIGHTEN_RATE = 7.5;
const SLACKEN_RATE = 3.2;

/** Sea state at which the swell is doing as much to the line as the fish is. */
const VOLATILE_SEA_M = 3.5;
/** Size and decay of the surge the boat's heave puts through a loaded line. */
const SURGE_KICK = 2.4;
const SURGE_DECAY = 3;

/** Chance per decision that a fish runs, per unit of `Species.runRate`, at full vigour. */
const RUN_CHANCE_PER_RUN_RATE = 0.42;
const MAX_RUN_CHANCE = 0.8;
/** Share of the remaining decisions spent shaking rather than sitting still. */
const SHAKE_SHARE = 0.3;

/** Seconds a behaviour lasts. Runs get longer the fresher the fish is; holds get longer as it tires. */
const RUN_MIN_S = 0.7;
const RUN_SPAN_S = 2.4;
const SHAKE_MIN_S = 0.45;
const SHAKE_SPAN_S = 0.9;
const HOLD_MIN_S = 0.6;
const HOLD_SPAN_S = 1.6;

/** How far a fish may swing its heading when it decides to run, radians. */
const RUN_YAW_RAD = 0.9;

/** Speed of a run, metres per second: a floor plus the part that comes from the animal's power. */
const RUN_SPEED_BASE = 0.55;
const RUN_SPEED_PER_PULL = 1.5;

/** Share of the reel's rated speed a completely fresh fish lets you have. */
const GREEN_SHARE = 0.3;
/** Share you get while it is shaking rather than holding still. */
const SHAKE_CLOSE = 0.55;

/** Seconds of stamina burned per second, by behaviour. */
const EXERTION: Readonly<Record<FishBehaviour, number>> = {
  holding: 0.45,
  shaking: 1,
  sounding: 1.35,
  running: 1.55,
};
/** Extra drain from being pumped — keeping the pressure on is what actually shortens a fight. */
const PUMP_EXERTION = 0.6;

/**
 * Load the line parts at, as a fraction of the meter.
 *
 * Expressed against the stock line rather than in newtons because the meter is a load index, not
 * a force: what the player needs to know is how much of *their* line's capacity they are using,
 * and a heavier line spends the same capacity more slowly.
 */
export function snapThreshold(lineStrengthN: number): number {
  const heavier = Math.max(0, lineStrengthN - STOCK_LINE_N) / STOCK_LINE_N;
  return clamp(STOCK_STRAIN + STRAIN_PER_STOCK * heavier, STOCK_STRAIN, MAX_STRAIN);
}

/** Speed a fish of this species runs at, given how much it has left. */
function runSpeed(species: Species, vigour: number): number {
  return (RUN_SPEED_BASE + RUN_SPEED_PER_PULL * species.pull) * (0.45 + 0.55 * vigour);
}

export class Fight {
  private load = 0;
  private staminaLeft = 0;
  private staminaTotal = 1;
  private range = 0;
  private doing: FishBehaviour = 'holding';
  private behaviourLeft = 0;
  private slackFor = 0;
  private surge = 0;
  private shakePhase = 0;
  private bearing = 0;
  private elapsed = 0;

  /** Fraction of the line's capacity currently in use, 0..1. */
  get tension(): number {
    return this.load;
  }

  /** What the fish has left, 1 when it is fresh and 0 when it is beaten. */
  get staminaFraction(): number {
    return this.staminaTotal <= 0 ? 0 : clamp(this.staminaLeft / this.staminaTotal, 0, 1);
  }

  /** Metres from the rod tip to the fish. */
  get distanceM(): number {
    return this.range;
  }

  get behaviour(): FishBehaviour {
    return this.doing;
  }

  /** Direction the fish is pulling, radians. The caller turns it into a place on the water. */
  get bearingRad(): number {
    return this.bearing;
  }

  /** Seconds since the hook went in. */
  get elapsedS(): number {
    return this.elapsed;
  }

  /**
   * The hook goes in.
   *
   * A fish that has just felt steel bolts — there is no version of this where the first thing it
   * does is sit still — so the opening behaviour is a run rather than a roll of the dice.
   */
  begin(species: Species, distanceM: number, bearingRad: number, rng: PRNG): void {
    this.staminaTotal = Math.max(1e-3, species.stamina);
    this.staminaLeft = this.staminaTotal;
    this.range = Math.max(LANDING_RANGE_M, distanceM);
    this.bearing = bearingRad;
    this.doing = 'running';
    this.behaviourLeft = RUN_MIN_S + RUN_SPAN_S * rng.next();
    this.load = 0.3 * species.pull;
    this.slackFor = 0;
    this.surge = 0;
    this.shakePhase = 0;
    this.elapsed = 0;
  }

  /** Drop everything, so a fight that ended cannot leak numbers into the next one. */
  clear(): void {
    this.load = 0;
    this.staminaLeft = 0;
    this.staminaTotal = 1;
    this.range = 0;
    this.doing = 'holding';
    this.behaviourLeft = 0;
    this.slackFor = 0;
    this.surge = 0;
    this.shakePhase = 0;
    this.elapsed = 0;
  }

  /**
   * One fixed step of the fight.
   *
   * The species is passed in rather than held, so this object can never be stepped without one
   * and there is no null to defend against on the hot path.
   */
  step(dt: number, species: Species, conditions: FightConditions, rng: PRNG): FightOutcome {
    this.elapsed += dt;
    const vigour = this.staminaFraction;

    this.behaviourLeft -= dt;
    if (this.behaviourLeft <= 0) this.chooseBehaviour(species, vigour, rng);

    const effort = species.pull * (SPENT_EFFORT + (1 - SPENT_EFFORT) * vigour);
    const reel = clamp(conditions.reel, 0, 1);
    const running = this.doing === 'running' || this.doing === 'sounding';

    this.shakePhase += dt * (SHAKE_HZ + SHAKE_HZ_PER_RUN_RATE * species.runRate);
    const shake = this.doing === 'shaking' ? Math.max(0, Math.sin(this.shakePhase * TAU)) ** 3 : 0;

    let target = reel * (REEL_LOAD + REEL_AGAINST * effort);
    if (running) target += RUN_LOAD * effort * (this.doing === 'sounding' ? SOUND_SHARE : 1);
    // A head shake against slack line transmits nothing — there is no path from the fish to the
    // rod for it to travel down. That is exactly why letting a fish shake its head unopposed is
    // how you lose it, and it is the same term that makes the slack rule below bite.
    target += SHAKE_LOAD * effort * shake * clamp(reel + this.load, 0, 1);

    // The boat is rising and falling three metres while all this is happening, and every metre of
    // that goes into the line. In a flat calm the load is whatever the fish is doing; in a swell
    // it is that plus a metre and a half of boat, which is why big fish are lost in big seas.
    const volatility = clamp(conditions.waveHeightM / VOLATILE_SEA_M, 0, 1);
    this.surge =
      damp(this.surge, 0, SURGE_DECAY, dt) + (rng.next() * 2 - 1) * volatility * SURGE_KICK * dt;
    target *= 1 + this.surge;

    this.load = clamp(
      damp(this.load, target, target > this.load ? TIGHTEN_RATE : SLACKEN_RATE, dt),
      0,
      1,
    );

    const exertion = EXERTION[this.doing] + PUMP_EXERTION * reel * this.load;
    this.staminaLeft = Math.max(0, this.staminaLeft - exertion * dt);

    // Line comes in only against a fish that is not going the other way, and only as fast as a
    // tiring animal allows. `GREEN_SHARE` is the whole first act of a big fight.
    const give = running ? 0 : GREEN_SHARE + (1 - GREEN_SHARE) * (1 - vigour);
    const closing =
      reel * conditions.reelSpeedMps * give * (this.doing === 'shaking' ? SHAKE_CLOSE : 1);
    const fleeing = this.doing === 'running' ? runSpeed(species, vigour) : 0;
    this.range = Math.max(0, this.range + (fleeing - closing) * dt);

    if (this.load >= snapThreshold(conditions.lineStrengthN)) return 'snapped';
    this.slackFor = this.load < SLACK_LOAD ? this.slackFor + dt : 0;
    if (this.slackFor >= SLACK_GRACE_S) return 'thrown';
    if (this.range <= LANDING_RANGE_M) return 'landed';
    return 'fighting';
  }

  /**
   * What the fish does next.
   *
   * Runs are rationed by stamina rather than by a cooldown: a fresh fish runs because it can, and
   * the reason a fight ends is that it stops being able to. `pull` against `runRate` decides
   * whether a run goes away from the boat or straight down — a heavy, slow animal sounds, a light
   * fast one runs — which is the difference between a conger and a bass without either being
   * named anywhere.
   */
  private chooseBehaviour(species: Species, vigour: number, rng: PRNG): void {
    const runChance = clamp(species.runRate * RUN_CHANCE_PER_RUN_RATE * vigour, 0, MAX_RUN_CHANCE);
    const roll = rng.next();

    if (roll < runChance) {
      const soundChance = clamp(species.pull - species.runRate * 0.35, 0.1, 0.8);
      this.doing = rng.next() < soundChance ? 'sounding' : 'running';
      this.behaviourLeft = RUN_MIN_S + RUN_SPAN_S * vigour * rng.next();
      this.bearing += (rng.next() * 2 - 1) * RUN_YAW_RAD;
      return;
    }

    if (roll < runChance + SHAKE_SHARE) {
      this.doing = 'shaking';
      this.behaviourLeft = SHAKE_MIN_S + SHAKE_SPAN_S * rng.next();
      this.shakePhase = 0;
      return;
    }

    this.doing = 'holding';
    this.behaviourLeft = HOLD_MIN_S + HOLD_SPAN_S * (1 - 0.5 * vigour) * rng.next();
  }
}

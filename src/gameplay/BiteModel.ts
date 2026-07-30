import { clamp, smoothstep } from '../math/Noise.js';
import type { PRNG } from '../math/PRNG.js';
import { selectSpecies, type Species } from './Species.js';

/**
 * How often a fish takes the bait.
 *
 * The rate is a **product of independent factors**, each one a separate exported function of a
 * single physical quantity. That structure is deliberate: a single hand-tuned curve with six
 * inputs cannot be argued with or tested, whereas each of these can be plotted, checked against
 * what anglers actually observe, and unit-tested on its own. Every factor returns 0..1, so the
 * product is 0..1 and the base rate below is the only number that sets the overall pace.
 *
 * The time-of-day term is driven by the **real solar altitude** out of the ephemeris, not by a
 * clock hour. That is the whole point: dawn and dusk are the best fishing of the day because of
 * where the sun is, and at 64°N in December that happens at eleven in the morning. A model keyed
 * on wall-clock hours would be wrong everywhere except the latitude it was tuned at.
 */

const DEG_TO_RAD = Math.PI / 180;

/**
 * Bites per second when every factor is 1 — which never happens, because the factors peak in
 * different conditions. In practice the product lands between 0.005 (midday flat calm, bare
 * hook, open water) and 0.6 (dawn over a mark with the right bait), so the wait between fish
 * runs from a couple of seconds to several minutes. That spread is the game.
 */
const BASE_BITE_RATE = 0.42;

export type BaitKind =
  | 'bare'
  | 'bread'
  | 'worm'
  | 'shrimp'
  | 'sandeel'
  | 'squid'
  | 'mackerel-strip'
  | 'lure';

/** Everything the model needs to know about the water the bait is sitting in. */
export interface BiteConditions {
  /** Depth of the bait below mean water level, metres. */
  depthM: number;
  beaufort: number;
  /** 0 = dry, 1 = heaviest rain. */
  precipitation: number;
  sunAltitudeDeg: number;
  /** 0..1 from `ephemeris.moon.illuminatedFraction`. */
  moonIlluminatedFraction: number;
  moonAltitudeDeg: number;
  bait: BaitKind;
  /** Metres to the nearest reef, wreck or island shelf. Large in open water. */
  structureDistanceM: number;
  /** Metres to the nearest fish school. Large when nothing is marked. */
  schoolDistanceM: number;
  waterTemperatureC: number;
}

/** The individual terms, kept so the HUD and the debug panel can show *why* it is slow. */
export interface BiteFactors {
  depth: number;
  weather: number;
  timeOfDay: number;
  moon: number;
  bait: number;
  structure: number;
  /** Bias towards the unusual end of the species table. Not part of the rate product. */
  rare: number;
  /** Product of the six rate factors. */
  combined: number;
}

export function createBiteFactors(): BiteFactors {
  return { depth: 0, weather: 0, timeOfDay: 0, moon: 0, bait: 0, structure: 0, rare: 0, combined: 0 };
}

/**
 * Depth of the bait.
 *
 * Two competing effects. Bait sitting in the surface film catches almost nothing — fish that
 * feed there are looking up at a silhouette and are spooked by the boat — so the term ramps in
 * over the first metre and a half. Below that it decays with depth, because light, temperature
 * and the food chain all do.
 */
export function depthFactor(depthM: number): number {
  const surface = smoothstep(0.15, 1.6, depthM);
  const body = 0.22 + 0.78 * Math.exp(-Math.max(0, depthM - 4) / 22);
  return clamp(surface * body, 0, 1);
}

/**
 * Sea state and rain.
 *
 * A light chop is the best fishing weather there is: broken surface hides the line, scatters the
 * light and puts oxygen in the water. Flat calm is worse, and by force 8 the fish have gone deep
 * and the bait is being thrown around anyway. Drizzle helps a little for the same reason chop
 * does; a downpour flattens the surface film and drops the salinity near it.
 */
export function weatherFactor(beaufort: number, precipitation: number): number {
  const b = Math.max(0, beaufort);
  // Asymmetric about force 3 — a rising wind spoils fishing faster than a dying one improves it.
  const spread = b < 3 ? 2.6 : 1.9;
  const chop = 0.18 + 0.82 * Math.exp(-0.5 * ((b - 3) / spread) ** 2);
  const storm = 1 - 0.55 * smoothstep(7, 11, b);
  const p = clamp(precipitation, 0, 1);
  const rain = 1 + 0.18 * smoothstep(0.02, 0.25, p) - 0.62 * smoothstep(0.3, 0.9, p);
  return clamp(chop * storm * rain, 0, 1);
}

/**
 * Time of day, as solar altitude in degrees.
 *
 * The peak sits at about +3°, wide enough to cover −2° to +8° — the sun on or just above the
 * horizon. That is when the light level is changing fastest, which is what triggers the feeding
 * window; predators can still see and prey can no longer see them coming. Full night is a little
 * better than midday because a lot of species feed after dark, and the moon term handles how
 * much better.
 */
export function timeOfDayFactor(sunAltitudeDeg: number): number {
  const day = smoothstep(-6, 20, sunAltitudeDeg);
  const base = 0.34 * (1 - day) + 0.26 * day;
  const twilight = Math.exp(-0.5 * ((sunAltitudeDeg - 3) / 6.5) ** 2);
  return clamp(base + (1 - base) * twilight * 0.92, 0, 1);
}

/**
 * Moon phase and position — the solunar terms.
 *
 * Phase matters through the tide: new and full are the spring tides, when the water moves most
 * and everything that eats has to work with it. The quarters are neaps and are noticeably
 * slower. Position matters through the moon's transit — the major periods are the moon directly
 * overhead and directly underfoot, which is a statement about tidal forcing, not about
 * moonlight, and is why it holds in daylight too.
 */
export function moonFactor(illuminatedFraction: number, moonAltitudeDeg: number): number {
  const syzygy = Math.abs(2 * clamp(illuminatedFraction, 0, 1) - 1);
  const phase = 0.55 + 0.45 * syzygy;
  const transit = Math.abs(Math.sin(moonAltitudeDeg * DEG_TO_RAD));
  return clamp(phase * (0.7 + 0.3 * transit), 0, 1);
}

/** Relative effectiveness of what is on the hook. A bare hook catches the occasional idiot. */
const BAIT_TABLE: Readonly<Record<BaitKind, number>> = {
  bare: 0.12,
  bread: 0.35,
  lure: 0.6,
  worm: 0.7,
  squid: 0.75,
  shrimp: 0.78,
  sandeel: 0.82,
  'mackerel-strip': 0.85,
};

export function baitFactor(bait: BaitKind): number {
  return BAIT_TABLE[bait];
}

/**
 * Proximity to structure or to a marked school, whichever is closer to hand.
 *
 * Open water is close to empty. Fish hold on reefs, wrecks and shelf edges because that is where
 * the current concentrates food, and a school is the same argument with legs. The two decay at
 * different rates — a wreck holds fish across a wider radius than a moving bait ball does.
 */
export function structureFactor(structureDistanceM: number, schoolDistanceM: number): number {
  const structure = 0.35 + 0.65 * Math.exp(-Math.max(0, structureDistanceM) / 14);
  const school = 0.35 + 0.65 * Math.exp(-Math.max(0, schoolDistanceM) / 9);
  return clamp(Math.max(structure, school), 0, 1);
}

/**
 * How far towards the unusual end of the species table this water is leaning.
 *
 * Dirty weather is bad fishing and good fish. A gale stirs the bottom, pushes deep-water species
 * onto the mark and brings in things nobody sees on a flat July afternoon — so the storm that
 * ruins the bite rate raises this. Darkness does the same for a different reason: the night
 * shift is a different set of animals.
 */
export function rareSpeciesFactor(
  beaufort: number,
  precipitation: number,
  sunAltitudeDeg: number,
): number {
  const rough = smoothstep(3, 9, beaufort);
  const wet = smoothstep(0.1, 0.7, precipitation);
  const dark = 1 - smoothstep(-8, 4, sunAltitudeDeg);
  return clamp(0.08 + 0.52 * Math.max(rough, wet) + 0.24 * dark + 0.16 * rough * dark, 0, 1);
}

/**
 * Bites per second, and the terms it came from.
 *
 * Writes the breakdown into a caller-owned struct rather than returning a fresh object, because
 * this is evaluated on the fixed clock while a bait is in the water.
 */
export function evaluateBite(conditions: BiteConditions, out: BiteFactors): number {
  out.depth = depthFactor(conditions.depthM);
  out.weather = weatherFactor(conditions.beaufort, conditions.precipitation);
  out.timeOfDay = timeOfDayFactor(conditions.sunAltitudeDeg);
  out.moon = moonFactor(conditions.moonIlluminatedFraction, conditions.moonAltitudeDeg);
  out.bait = baitFactor(conditions.bait);
  out.structure = structureFactor(conditions.structureDistanceM, conditions.schoolDistanceM);
  out.rare = rareSpeciesFactor(
    conditions.beaufort,
    conditions.precipitation,
    conditions.sunAltitudeDeg,
  );
  out.combined = out.depth * out.weather * out.timeOfDay * out.moon * out.bait * out.structure;
  return clamp(BASE_BITE_RATE * out.combined, 0, 1);
}

export interface BiteResult {
  species: Species;
  /** 0..1 — how hard it took. Drives the bobber dip and how long you have to react. */
  strike: number;
  /** Seconds the fish stays on the hook before spitting the bait. */
  hookWindow: number;
}

/**
 * Species query, reused between rolls.
 *
 * A module-level mutable object rather than an object literal at the call site: it keeps the
 * roll allocation-free, and it means the shape is checked structurally against whatever
 * `Species.ts` asks for instead of being subject to excess-property checking.
 */
const speciesQuery = {
  depthM: 0,
  sunAltitudeDeg: 0,
  beaufort: 0,
  waterTemperatureC: 12,
  bait: 'bare' as BaitKind,
  rarity: 0,
};

/**
 * Roll for a bite over a `dt`-second slice.
 *
 * The rate is a Poisson intensity, so the probability over the slice is `1 − e^(−λ·dt)` rather
 * than `λ·dt`. At 120 Hz the difference is negligible, but the exponential form stays correct if
 * the caller ever hands it a whole second, and it can never exceed 1.
 */
export function rollBite(
  conditions: BiteConditions,
  factors: BiteFactors,
  dt: number,
  rng: PRNG,
): BiteResult | null {
  const rate = evaluateBite(conditions, factors);
  if (rng.next() >= 1 - Math.exp(-rate * dt)) return null;

  speciesQuery.depthM = conditions.depthM;
  speciesQuery.sunAltitudeDeg = conditions.sunAltitudeDeg;
  speciesQuery.beaufort = conditions.beaufort;
  speciesQuery.waterTemperatureC = conditions.waterTemperatureC;
  speciesQuery.bait = conditions.bait;
  speciesQuery.rarity = factors.rare;

  const species = selectSpecies(speciesQuery, rng);
  if (species === undefined) return null;

  // A confident fish in coloured water smashes the bait; a suspicious one in flat calm mouths
  // it. So the same conditions that raise the bite rate also make the take more decisive.
  const strike = clamp(0.25 + 0.75 * rng.next() * (0.4 + 0.6 * factors.combined * 3), 0, 1);
  return { species, strike, hookWindow: 0.8 + 1.4 * (1 - strike) };
}

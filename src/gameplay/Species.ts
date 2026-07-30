import type { PRNG } from '../math/PRNG.js';
import type { BaitKind } from './BiteModel.js';

/**
 * The fish.
 *
 * Twelve North Atlantic species as data, because everything interesting about them is a
 * *condition*, not behaviour: a wolffish is a fish that only shows up over rough ground in a
 * blow, and a herring is a fish that only shows up in a shoal at dusk. Encoding that as fields
 * means the bite model, the journal, the loot roll and the fight all read the same table
 * instead of each carrying their own opinion.
 *
 * Two rules worth stating because they are easy to get subtly wrong:
 *
 *   * **Activity windows are solar altitudes, never clock hours.** "Dawn" at 60°N in June and
 *     "dawn" at the equator in March are four hours apart on a clock and identical in the sky.
 *     The whole project keys off the real ephemeris and this table is not an exception.
 *   * **Rarity weights within a tier sum to exactly 1.** The tier is chosen first from the
 *     rarity roll, then the species within it; keeping the two decisions separate is what lets
 *     a storm raise the chance of *something* rare without distorting which rare thing it is.
 */

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Species {
  id: string;
  name: string;
  latin: string;
  rarity: Rarity;
  /** Selection weight within its rarity tier. Weights per tier sum to 1. */
  weight: number;

  /** Mass range in kilograms. Sampled log-normally, so most are small and a monster is rare. */
  minMassKg: number;
  maxMassKg: number;
  /** Length in metres at the minimum and maximum mass. */
  minLengthM: number;
  maxLengthM: number;

  /** Depth band it holds, metres below the surface. */
  minDepthM: number;
  maxDepthM: number;
  /** Solar altitude band, degrees, over which it feeds. */
  minSunAltitudeDeg: number;
  maxSunAltitudeDeg: number;
  /** Beaufort band it will take a bait in. */
  minBeaufort: number;
  maxBeaufort: number;
  /** Water temperature band, Celsius. */
  minTemperatureC: number;
  maxTemperatureC: number;

  baits: readonly BaitKind[];

  /** Body proportions for the procedural loft. Fractions of total length. */
  bodyDepth: number;
  bodyWidth: number;
  forkedTail: boolean;

  /** Colour, linear sRGB. Back and belly, for countershading. */
  backColour: readonly [number, number, number];
  bellyColour: readonly [number, number, number];
  scaleDensity: number;
  iridescence: number;

  /** Fight character. `pull` is peak line tension, `runRate` runs per second, `stamina` seconds. */
  pull: number;
  runRate: number;
  stamina: number;

  /** Money per kilogram. */
  valuePerKg: number;
}

/** Probability that a caught fish is an albino variant. */
export const ALBINO_PROBABILITY = 0.004;
/** Value and rarity multiplier applied to an albino. */
export const ALBINO_VALUE_MULTIPLIER = 6;

const ALL_BAITS: readonly BaitKind[] = [
  'bare',
  'bread',
  'worm',
  'shrimp',
  'sandeel',
  'squid',
  'mackerel-strip',
  'lure',
];

export const SPECIES: readonly Species[] = [
  {
    id: 'mackerel',
    name: 'Atlantic mackerel',
    latin: 'Scomber scombrus',
    rarity: 'common',
    weight: 0.3,
    minMassKg: 0.2,
    maxMassKg: 1.6,
    minLengthM: 0.25,
    maxLengthM: 0.5,
    minDepthM: 0,
    maxDepthM: 40,
    // Mackerel are a surface fish that feeds hard through the light and shuts off in the dark.
    minSunAltitudeDeg: -6,
    maxSunAltitudeDeg: 90,
    minBeaufort: 0,
    maxBeaufort: 6,
    minTemperatureC: 8,
    maxTemperatureC: 20,
    baits: ['lure', 'shrimp', 'worm', 'sandeel'],
    bodyDepth: 0.17,
    bodyWidth: 0.11,
    forkedTail: true,
    backColour: [0.06, 0.14, 0.13],
    bellyColour: [0.72, 0.74, 0.70],
    scaleDensity: 34,
    iridescence: 0.85,
    pull: 0.35,
    runRate: 1.6,
    stamina: 9,
    valuePerKg: 4,
  },
  {
    id: 'herring',
    name: 'Atlantic herring',
    latin: 'Clupea harengus',
    rarity: 'common',
    weight: 0.24,
    minMassKg: 0.1,
    maxMassKg: 0.7,
    minLengthM: 0.2,
    maxLengthM: 0.38,
    minDepthM: 5,
    maxDepthM: 60,
    // Herring rise to feed at dusk and through the night, and sink away by full daylight.
    minSunAltitudeDeg: -14,
    maxSunAltitudeDeg: 10,
    minBeaufort: 0,
    maxBeaufort: 5,
    minTemperatureC: 4,
    maxTemperatureC: 16,
    baits: ['lure', 'shrimp', 'bare'],
    bodyDepth: 0.19,
    bodyWidth: 0.09,
    forkedTail: true,
    backColour: [0.09, 0.16, 0.19],
    bellyColour: [0.80, 0.81, 0.79],
    scaleDensity: 40,
    iridescence: 0.95,
    pull: 0.22,
    runRate: 1.2,
    stamina: 6,
    valuePerKg: 3,
  },
  {
    id: 'pollock',
    name: 'Pollock',
    latin: 'Pollachius pollachius',
    rarity: 'common',
    weight: 0.26,
    minMassKg: 0.8,
    maxMassKg: 9,
    minLengthM: 0.35,
    maxLengthM: 1.0,
    minDepthM: 10,
    maxDepthM: 90,
    minSunAltitudeDeg: -10,
    maxSunAltitudeDeg: 40,
    minBeaufort: 0,
    maxBeaufort: 7,
    minTemperatureC: 4,
    maxTemperatureC: 15,
    baits: ['lure', 'squid', 'sandeel', 'worm'],
    bodyDepth: 0.22,
    bodyWidth: 0.13,
    forkedTail: false,
    backColour: [0.10, 0.11, 0.08],
    bellyColour: [0.62, 0.60, 0.54],
    scaleDensity: 26,
    iridescence: 0.35,
    pull: 0.55,
    runRate: 0.9,
    stamina: 14,
    valuePerKg: 5,
  },
  {
    id: 'whiting',
    name: 'Whiting',
    latin: 'Merlangius merlangus',
    rarity: 'common',
    weight: 0.2,
    minMassKg: 0.2,
    maxMassKg: 1.8,
    minLengthM: 0.22,
    maxLengthM: 0.48,
    minDepthM: 15,
    maxDepthM: 110,
    minSunAltitudeDeg: -18,
    maxSunAltitudeDeg: 30,
    minBeaufort: 0,
    maxBeaufort: 6,
    minTemperatureC: 3,
    maxTemperatureC: 14,
    baits: ['worm', 'squid', 'shrimp'],
    bodyDepth: 0.18,
    bodyWidth: 0.10,
    forkedTail: false,
    backColour: [0.16, 0.15, 0.12],
    bellyColour: [0.76, 0.75, 0.72],
    scaleDensity: 30,
    iridescence: 0.4,
    pull: 0.24,
    runRate: 0.8,
    stamina: 7,
    valuePerKg: 3.5,
  },
  {
    id: 'cod',
    name: 'Atlantic cod',
    latin: 'Gadus morhua',
    rarity: 'rare',
    weight: 0.3,
    minMassKg: 1.5,
    maxMassKg: 28,
    minLengthM: 0.45,
    maxLengthM: 1.4,
    minDepthM: 20,
    maxDepthM: 200,
    minSunAltitudeDeg: -18,
    maxSunAltitudeDeg: 25,
    minBeaufort: 1,
    maxBeaufort: 8,
    minTemperatureC: 1,
    maxTemperatureC: 12,
    baits: ['squid', 'worm', 'sandeel', 'lure'],
    bodyDepth: 0.24,
    bodyWidth: 0.15,
    forkedTail: false,
    backColour: [0.20, 0.17, 0.09],
    bellyColour: [0.72, 0.70, 0.62],
    scaleDensity: 24,
    iridescence: 0.25,
    pull: 0.72,
    runRate: 0.7,
    stamina: 22,
    valuePerKg: 9,
  },
  {
    id: 'haddock',
    name: 'Haddock',
    latin: 'Melanogrammus aeglefinus',
    rarity: 'rare',
    weight: 0.24,
    minMassKg: 0.7,
    maxMassKg: 7,
    minLengthM: 0.35,
    maxLengthM: 0.9,
    minDepthM: 40,
    maxDepthM: 180,
    minSunAltitudeDeg: -18,
    maxSunAltitudeDeg: 30,
    minBeaufort: 0,
    maxBeaufort: 7,
    minTemperatureC: 2,
    maxTemperatureC: 11,
    baits: ['worm', 'squid', 'shrimp'],
    bodyDepth: 0.23,
    bodyWidth: 0.13,
    forkedTail: false,
    backColour: [0.13, 0.13, 0.14],
    bellyColour: [0.74, 0.73, 0.71],
    scaleDensity: 27,
    iridescence: 0.3,
    pull: 0.5,
    runRate: 0.8,
    stamina: 15,
    valuePerKg: 8,
  },
  {
    id: 'sea-bass',
    name: 'European sea bass',
    latin: 'Dicentrarchus labrax',
    rarity: 'rare',
    weight: 0.26,
    minMassKg: 0.8,
    maxMassKg: 8,
    minLengthM: 0.35,
    maxLengthM: 0.9,
    minDepthM: 0,
    maxDepthM: 35,
    // Bass come onto the shallows to hunt in the half-light and in broken water.
    minSunAltitudeDeg: -8,
    maxSunAltitudeDeg: 12,
    minBeaufort: 2,
    maxBeaufort: 7,
    minTemperatureC: 8,
    maxTemperatureC: 20,
    baits: ['lure', 'sandeel', 'squid'],
    bodyDepth: 0.21,
    bodyWidth: 0.12,
    forkedTail: true,
    backColour: [0.14, 0.16, 0.18],
    bellyColour: [0.78, 0.78, 0.76],
    scaleDensity: 30,
    iridescence: 0.6,
    pull: 0.78,
    runRate: 1.5,
    stamina: 18,
    valuePerKg: 14,
  },
  {
    id: 'plaice',
    name: 'European plaice',
    latin: 'Pleuronectes platessa',
    rarity: 'rare',
    weight: 0.2,
    minMassKg: 0.3,
    maxMassKg: 4,
    minLengthM: 0.25,
    maxLengthM: 0.7,
    minDepthM: 10,
    maxDepthM: 80,
    minSunAltitudeDeg: -6,
    maxSunAltitudeDeg: 50,
    minBeaufort: 0,
    maxBeaufort: 5,
    minTemperatureC: 4,
    maxTemperatureC: 15,
    baits: ['worm', 'shrimp'],
    // Flatfish: very deep body, very thin across.
    bodyDepth: 0.55,
    bodyWidth: 0.06,
    forkedTail: false,
    backColour: [0.18, 0.14, 0.07],
    bellyColour: [0.82, 0.80, 0.74],
    scaleDensity: 22,
    iridescence: 0.15,
    pull: 0.42,
    runRate: 0.4,
    stamina: 11,
    valuePerKg: 11,
  },
  {
    id: 'ling',
    name: 'Common ling',
    latin: 'Molva molva',
    rarity: 'epic',
    weight: 0.34,
    minMassKg: 4,
    maxMassKg: 32,
    minLengthM: 0.8,
    maxLengthM: 1.8,
    minDepthM: 80,
    maxDepthM: 400,
    minSunAltitudeDeg: -18,
    maxSunAltitudeDeg: 8,
    minBeaufort: 2,
    maxBeaufort: 9,
    minTemperatureC: 2,
    maxTemperatureC: 10,
    baits: ['squid', 'sandeel'],
    bodyDepth: 0.14,
    bodyWidth: 0.11,
    forkedTail: false,
    backColour: [0.16, 0.14, 0.10],
    bellyColour: [0.66, 0.64, 0.58],
    scaleDensity: 20,
    iridescence: 0.2,
    pull: 0.85,
    runRate: 0.6,
    stamina: 28,
    valuePerKg: 13,
  },
  {
    id: 'wolffish',
    name: 'Atlantic wolffish',
    latin: 'Anarhichas lupus',
    rarity: 'epic',
    weight: 0.33,
    minMassKg: 3,
    maxMassKg: 20,
    minLengthM: 0.6,
    maxLengthM: 1.4,
    minDepthM: 60,
    maxDepthM: 300,
    minSunAltitudeDeg: -18,
    maxSunAltitudeDeg: 5,
    // Only over rough ground in a real blow.
    minBeaufort: 6,
    maxBeaufort: 12,
    minTemperatureC: -1,
    maxTemperatureC: 8,
    baits: ['squid', 'shrimp', 'sandeel'],
    bodyDepth: 0.16,
    bodyWidth: 0.13,
    forkedTail: false,
    backColour: [0.11, 0.12, 0.15],
    bellyColour: [0.44, 0.45, 0.47],
    scaleDensity: 16,
    iridescence: 0.1,
    pull: 0.92,
    runRate: 0.5,
    stamina: 26,
    valuePerKg: 17,
  },
  {
    id: 'conger',
    name: 'European conger',
    latin: 'Conger conger',
    rarity: 'epic',
    weight: 0.33,
    minMassKg: 5,
    maxMassKg: 60,
    minLengthM: 1.0,
    maxLengthM: 2.6,
    minDepthM: 20,
    maxDepthM: 250,
    // Strictly a night fish, and it likes a wreck.
    minSunAltitudeDeg: -18,
    maxSunAltitudeDeg: -2,
    minBeaufort: 0,
    maxBeaufort: 8,
    minTemperatureC: 6,
    maxTemperatureC: 16,
    baits: ['squid', 'sandeel'],
    bodyDepth: 0.10,
    bodyWidth: 0.09,
    forkedTail: false,
    backColour: [0.09, 0.10, 0.09],
    bellyColour: [0.50, 0.49, 0.45],
    scaleDensity: 14,
    iridescence: 0.12,
    pull: 0.95,
    runRate: 0.45,
    stamina: 34,
    valuePerKg: 15,
  },
  {
    id: 'halibut',
    name: 'Atlantic halibut',
    latin: 'Hippoglossus hippoglossus',
    rarity: 'legendary',
    weight: 1,
    minMassKg: 25,
    maxMassKg: 220,
    minLengthM: 1.2,
    maxLengthM: 2.5,
    minDepthM: 100,
    maxDepthM: 700,
    minSunAltitudeDeg: -18,
    maxSunAltitudeDeg: 6,
    // The one everybody is really out here for: deep water, heavy weather, and patience.
    minBeaufort: 5,
    maxBeaufort: 12,
    minTemperatureC: 1,
    maxTemperatureC: 9,
    baits: ['sandeel', 'squid'],
    bodyDepth: 0.48,
    bodyWidth: 0.09,
    forkedTail: false,
    backColour: [0.13, 0.12, 0.10],
    bellyColour: [0.86, 0.85, 0.81],
    scaleDensity: 18,
    iridescence: 0.18,
    pull: 1.0,
    runRate: 0.35,
    stamina: 55,
    valuePerKg: 26,
  },
];

/** Base chance of each tier before the conditions push it around. Sums to 1. */
export const RARITY_BASE: Readonly<Record<Rarity, number>> = {
  common: 0.68,
  rare: 0.25,
  epic: 0.062,
  legendary: 0.008,
};

export interface SpeciesQuery {
  depthM: number;
  sunAltitudeDeg: number;
  beaufort: number;
  waterTemperatureC: number;
  bait: BaitKind;
  /** 0..1 from the bite model — how much the conditions favour something unusual. */
  rarity: number;
}

/**
 * How well a species fits the conditions, 0..1.
 *
 * A product of per-condition memberships rather than a sum, so a single hard exclusion — a
 * night-only fish in daylight, a storm-only fish in a flat calm — zeroes the whole thing.
 * Each band has soft shoulders, so the edge of a species' range thins out rather than
 * switching off, which is what stops the mix changing visibly as the sun crosses a threshold.
 */
export function speciesAffinity(species: Species, query: SpeciesQuery): number {
  const depth = band(query.depthM, species.minDepthM, species.maxDepthM, 12);
  const light = band(query.sunAltitudeDeg, species.minSunAltitudeDeg, species.maxSunAltitudeDeg, 3);
  const sea = band(query.beaufort, species.minBeaufort, species.maxBeaufort, 1);
  const temperature = band(
    query.waterTemperatureC,
    species.minTemperatureC,
    species.maxTemperatureC,
    2.5,
  );
  const bait = species.baits.includes(query.bait) ? 1 : 0.12;
  return depth * light * sea * temperature * bait;
}

/**
 * Soft membership of `[low, high]` with a shoulder of `softness` on each side.
 * Returns 1 well inside the band, 0 well outside, and a smooth ramp between.
 */
function band(value: number, low: number, high: number, softness: number): number {
  if (softness <= 0) return value >= low && value <= high ? 1 : 0;
  const rising = smoothstep(low - softness, low + softness * 0.35, value);
  const falling = 1 - smoothstep(high - softness * 0.35, high + softness, value);
  return Math.max(0, Math.min(rising, falling));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Choose what just took the bait.
 *
 * Two stages. The rarity tier is picked first, shifted by the bite model's `rarity` factor —
 * storms, darkness and deep water push it up. Then a species is chosen within that tier,
 * weighted by its base weight times its affinity for the conditions. Keeping the decisions
 * separate is what lets a gale make something rare more likely without also deciding *which*
 * rare thing, and it keeps the per-tier weights meaningful.
 *
 * Returns undefined when nothing in the chosen tier can live in these conditions at all — a
 * legendary roll in two metres of tropical water has no candidates, and the honest answer is
 * that nothing bit.
 */
export function selectSpecies(query: SpeciesQuery, rng: PRNG): Species | undefined {
  const push = Math.min(1, Math.max(0, query.rarity));
  // Shift probability mass up the tiers. The exponents are chosen so that at push = 1 a
  // legendary is roughly six times more likely than at push = 0, which is a real change
  // without making a monster routine in bad weather.
  const tierWeights: Array<[Rarity, number]> = [
    ['common', RARITY_BASE.common * (1 - 0.45 * push)],
    ['rare', RARITY_BASE.rare * (1 + 0.35 * push)],
    ['epic', RARITY_BASE.epic * (1 + 2.2 * push)],
    ['legendary', RARITY_BASE.legendary * (1 + 5.0 * push)],
  ];

  let tierTotal = 0;
  for (const [, weight] of tierWeights) tierTotal += weight;
  let tierRoll = rng.next() * tierTotal;
  let tier: Rarity = 'common';
  for (const [name, weight] of tierWeights) {
    tierRoll -= weight;
    if (tierRoll <= 0) {
      tier = name;
      break;
    }
  }

  let total = 0;
  const candidates: Array<{ species: Species; weight: number }> = [];
  for (const species of SPECIES) {
    if (species.rarity !== tier) continue;
    const weight = species.weight * speciesAffinity(species, query);
    if (weight <= 0) continue;
    candidates.push({ species, weight });
    total += weight;
  }
  if (total <= 0) return undefined;

  let roll = rng.next() * total;
  for (const candidate of candidates) {
    roll -= candidate.weight;
    if (roll <= 0) return candidate.species;
  }
  return candidates[candidates.length - 1]?.species;
}

export interface CaughtFish {
  species: Species;
  massKg: number;
  lengthM: number;
  albino: boolean;
  /** Money this specimen is worth. */
  value: number;
}

/**
 * Roll a specimen's size.
 *
 * Log-normal rather than uniform, because that is what fish populations actually look like:
 * a great many small ones, a few good ones, and very rarely something that goes on the wall.
 * A uniform roll would make every second cod a specimen and destroy the point of a personal
 * best. Length follows from mass by the cube-root allometry that governs any body growing
 * roughly isometrically.
 */
export function rollSpecimen(species: Species, rng: PRNG): CaughtFish {
  // Map a standard normal onto the mass range so that ~1 sigma lands near the low end and the
  // tail reaches the maximum only rarely.
  const t = Math.min(1, Math.max(0, rng.gaussian(0.28, 0.22)));
  const logMin = Math.log(species.minMassKg);
  const logMax = Math.log(species.maxMassKg);
  const massKg = Math.exp(logMin + (logMax - logMin) * t);

  const massFraction =
    (massKg - species.minMassKg) / Math.max(1e-6, species.maxMassKg - species.minMassKg);
  const lengthM =
    species.minLengthM +
    (species.maxLengthM - species.minLengthM) * Math.cbrt(Math.max(0, massFraction));

  const albino = rng.next() < ALBINO_PROBABILITY;
  const value = massKg * species.valuePerKg * (albino ? ALBINO_VALUE_MULTIPLIER : 1);

  return { species, massKg, lengthM, albino, value };
}

/** Every bait the game knows about, for the tackle UI. */
export const BAITS: readonly BaitKind[] = ALL_BAITS;

/** Lookup by id, for the journal and the save file. */
export function speciesById(id: string): Species | undefined {
  return SPECIES.find((species) => species.id === id);
}

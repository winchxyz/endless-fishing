/**
 * The upgrade tree.
 *
 * Five lines of progression, each one a *physical quantity another system already needs*
 * rather than an abstract percentage: the line has a breaking strain in newtons, the reel
 * recovers so many metres a second, the sonar reaches so many metres. That is the whole design
 * rule here — if an upgrade cannot be expressed as a number some other file was going to have
 * to invent anyway, it does not belong in the tree.
 *
 * Costs are geometric and effects are linear, which is the standard shape for a good reason:
 * the marginal cost of a point of capability rises, so every purchase is a real decision, and
 * the curve stays trivially monotonic and therefore testable.
 */

export type UpgradeId =
  | 'line-strength'
  | 'reel-speed'
  | 'lure-quality'
  | 'sonar-range'
  | 'engine-power';

export const UPGRADE_IDS: readonly UpgradeId[] = [
  'line-strength',
  'reel-speed',
  'lure-quality',
  'sonar-range',
  'engine-power',
];

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  description: string;
  /** Levels above the base. Level 0 is the starting tackle and costs nothing. */
  maxLevel: number;
  /** Cost of going from level 0 to level 1. */
  baseCost: number;
  /** Multiplier applied to the cost per level already owned. Strictly above 1. */
  costGrowth: number;
  /** Effect at level 0. */
  base: number;
  /** Added to the effect per level. Strictly positive, so the effect is monotonic too. */
  perLevel: number;
  unit: string;
  /** Decimals to show in the shop readout. */
  decimals: number;
}

export const UPGRADES: Readonly<Record<UpgradeId, UpgradeDefinition>> = {
  'line-strength': {
    id: 'line-strength',
    name: 'Line strength',
    description: 'Breaking strain. A heavier line survives a run that would part a light one.',
    maxLevel: 8,
    baseCost: 140,
    costGrowth: 1.62,
    base: 55,
    perLevel: 24,
    unit: 'N',
    decimals: 0,
  },
  'reel-speed': {
    id: 'reel-speed',
    name: 'Reel speed',
    description: 'Line recovered per second at full crank. Shortens every fight.',
    maxLevel: 6,
    baseCost: 180,
    costGrowth: 1.74,
    base: 0.65,
    perLevel: 0.18,
    unit: 'm/s',
    decimals: 2,
  },
  'lure-quality': {
    id: 'lure-quality',
    name: 'Lure quality',
    description: 'Multiplier on how convincing the bait is. Raises the bite rate directly.',
    maxLevel: 6,
    baseCost: 110,
    costGrowth: 1.85,
    base: 1,
    perLevel: 0.11,
    unit: '×',
    decimals: 2,
  },
  'sonar-range': {
    id: 'sonar-range',
    name: 'Sonar range',
    description: 'Radius within which schools and structure are marked on the sounder.',
    maxLevel: 7,
    baseCost: 220,
    costGrowth: 1.68,
    base: 40,
    perLevel: 34,
    unit: 'm',
    decimals: 0,
  },
  'engine-power': {
    id: 'engine-power',
    name: 'Engine power',
    description: 'Thrust at the propeller. Gets you to the mark, and off it in a blow.',
    maxLevel: 6,
    baseCost: 260,
    costGrowth: 1.8,
    base: 2200,
    perLevel: 900,
    unit: 'N',
    decimals: 0,
  },
};

/** The concrete numbers other systems read. Nothing outside this file invents them. */
export interface UpgradeEffects {
  /** Breaking strain of the line, newtons. The fishing system fails the cast above this. */
  lineStrengthN: number;
  /** Metres of line recovered per second at full crank. */
  reelSpeedMps: number;
  /** Multiplier applied to the bite model's bait factor. Never below 1. */
  lureQuality: number;
  /** Radius in metres within which the sounder marks schools and structure. */
  sonarRangeM: number;
  /** Propeller thrust in newtons, fed to the boat's engine model. */
  enginePowerN: number;
}

/** Minimal view of the purse, so this module does not need to know about `Inventory`. */
export interface Wallet {
  readonly money: number;
  spend(amount: number): boolean;
}

export interface ProgressionData {
  levels: Record<string, number>;
}

export type PurchaseResult =
  | { ok: true; id: UpgradeId; cost: number; level: number }
  | { ok: false; id: UpgradeId; reason: 'maxed' | 'insufficient-funds' };

/**
 * Price of the step from `level` to `level + 1`.
 *
 * Defined for every non-negative level, including levels past the cap, so the curve itself is
 * a pure monotonic function and the cap is a separate, testable concern.
 */
export function upgradeCost(id: UpgradeId, level: number): number {
  const definition = UPGRADES[id];
  const steps = Math.max(0, Math.floor(level));
  return Math.round(definition.baseCost * definition.costGrowth ** steps);
}

/** Total spent to reach `level` from scratch. */
export function upgradeTotalCost(id: UpgradeId, level: number): number {
  let total = 0;
  for (let step = 0; step < level; step += 1) total += upgradeCost(id, step);
  return total;
}

/** The effect value of a single upgrade at a level. Strictly increasing in `level`. */
export function upgradeEffect(id: UpgradeId, level: number): number {
  const definition = UPGRADES[id];
  const clamped = Math.min(definition.maxLevel, Math.max(0, Math.floor(level)));
  return definition.base + definition.perLevel * clamped;
}

function createEffects(): UpgradeEffects {
  return {
    lineStrengthN: 0,
    reelSpeedMps: 0,
    lureQuality: 1,
    sonarRangeM: 0,
    enginePowerN: 0,
  };
}

export class Progression {
  private readonly levels: Record<UpgradeId, number> = {
    'line-strength': 0,
    'reel-speed': 0,
    'lure-quality': 0,
    'sonar-range': 0,
    'engine-power': 0,
  };

  /**
   * Recomputed only on a level change and handed out as a stable object, so the boat and the
   * fishing system can hold the reference and read it in the frame loop without allocating.
   */
  private readonly cachedEffects = createEffects();

  constructor(data?: ProgressionData) {
    if (data !== undefined) this.load(data);
    else this.recomputeEffects();
  }

  levelOf(id: UpgradeId): number {
    return this.levels[id];
  }

  maxLevelOf(id: UpgradeId): number {
    return UPGRADES[id].maxLevel;
  }

  isMaxed(id: UpgradeId): boolean {
    return this.levels[id] >= UPGRADES[id].maxLevel;
  }

  /** Price of the next level, or null when the upgrade is already at its cap. */
  costOf(id: UpgradeId): number | null {
    if (this.isMaxed(id)) return null;
    return upgradeCost(id, this.levels[id]);
  }

  canAfford(id: UpgradeId, money: number): boolean {
    const cost = this.costOf(id);
    return cost !== null && money >= cost;
  }

  /** The value this upgrade currently delivers, in its own unit. */
  effectOf(id: UpgradeId): number {
    return upgradeEffect(id, this.levels[id]);
  }

  purchase(id: UpgradeId, wallet: Wallet): PurchaseResult {
    const cost = this.costOf(id);
    if (cost === null) return { ok: false, id, reason: 'maxed' };
    if (!wallet.spend(cost)) return { ok: false, id, reason: 'insufficient-funds' };
    this.levels[id] += 1;
    this.recomputeEffects();
    return { ok: true, id, cost, level: this.levels[id] };
  }

  /** Directly set a level. Used by the loader and by the debug panel, never by the shop. */
  setLevel(id: UpgradeId, level: number): void {
    const capped = Math.min(UPGRADES[id].maxLevel, Math.max(0, Math.floor(level)));
    if (capped === this.levels[id]) return;
    this.levels[id] = capped;
    this.recomputeEffects();
  }

  get effects(): Readonly<UpgradeEffects> {
    return this.cachedEffects;
  }

  toData(): ProgressionData {
    const levels: Record<string, number> = {};
    for (const id of UPGRADE_IDS) levels[id] = this.levels[id];
    return { levels };
  }

  load(data: ProgressionData): void {
    for (const id of UPGRADE_IDS) {
      const stored = data.levels[id];
      this.levels[id] = Math.min(
        UPGRADES[id].maxLevel,
        Math.max(0, typeof stored === 'number' && Number.isFinite(stored) ? Math.floor(stored) : 0),
      );
    }
    this.recomputeEffects();
  }

  private recomputeEffects(): void {
    this.cachedEffects.lineStrengthN = upgradeEffect('line-strength', this.levels['line-strength']);
    this.cachedEffects.reelSpeedMps = upgradeEffect('reel-speed', this.levels['reel-speed']);
    this.cachedEffects.lureQuality = upgradeEffect('lure-quality', this.levels['lure-quality']);
    this.cachedEffects.sonarRangeM = upgradeEffect('sonar-range', this.levels['sonar-range']);
    this.cachedEffects.enginePowerN = upgradeEffect('engine-power', this.levels['engine-power']);
  }
}

export function createProgressionData(): ProgressionData {
  const levels: Record<string, number> = {};
  for (const id of UPGRADE_IDS) levels[id] = 0;
  return { levels };
}

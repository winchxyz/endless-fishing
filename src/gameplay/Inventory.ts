import type { CaughtFish } from './Species.js';

/**
 * What the player has caught, and what it was worth.
 *
 * Two separate ledgers with deliberately different lifetimes:
 *
 *   * The **journal** is permanent and one row per species — count, personal bests, first and
 *     last seen. It is the thing the player is actually collecting, so nothing in it is ever
 *     allowed to go backwards.
 *   * The **recent log** is a bounded ring of individual specimens, kept only so the catch card
 *     and the end-of-session summary have something concrete to show. It is capped because a
 *     save file that grows without limit eventually stops fitting in localStorage, and the
 *     failure mode of that is a silently lost save.
 *
 * This module owns no timers and reads no clock: the caller passes the instant, because the
 * game runs on a simulated clock that the player can move.
 */

/** How many individual specimens the log keeps before the oldest is dropped. */
export const RECENT_CATCH_LIMIT = 64;

export interface CatchRecord {
  speciesId: string;
  massKg: number;
  lengthM: number;
  albino: boolean;
  /** Money this specimen earned, after every multiplier. */
  value: number;
  /** UTC epoch ms of the catch, on the game clock. */
  caughtAtMs: number;
}

export interface JournalEntry {
  speciesId: string;
  count: number;
  bestMassKg: number;
  bestLengthM: number;
  /** UTC epoch ms. 0 when migrated from a save that did not record it. */
  firstCaughtMs: number;
  lastCaughtMs: number;
}

export interface InventoryData {
  money: number;
  totalCatches: number;
  recent: CatchRecord[];
}

export interface JournalData {
  entries: JournalEntry[];
}

/** Everything the catch card needs to know about what just happened. */
export interface CatchOutcome {
  record: CatchRecord;
  /** True when this specimen beat the stored best mass for its species. */
  personalBest: boolean;
  /** True when this species had never been caught before. */
  firstCatch: boolean;
  moneyEarned: number;
}

export function createInventoryData(): InventoryData {
  return { money: 0, totalCatches: 0, recent: [] };
}

export function createJournalData(): JournalData {
  return { entries: [] };
}

export class Inventory {
  private moneyBalance = 0;
  private catches = 0;
  private readonly log: CatchRecord[] = [];
  private readonly entries = new Map<string, JournalEntry>();

  get money(): number {
    return this.moneyBalance;
  }

  get totalCatches(): number {
    return this.catches;
  }

  /** Newest first. */
  get recent(): readonly CatchRecord[] {
    return this.log;
  }

  /** One row per species ever caught, in the order they were first caught. */
  get journal(): readonly JournalEntry[] {
    return [...this.entries.values()];
  }

  entryFor(speciesId: string): JournalEntry | undefined {
    return this.entries.get(speciesId);
  }

  hasCaught(speciesId: string): boolean {
    return this.entries.has(speciesId);
  }

  earn(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.moneyBalance += Math.round(amount);
  }

  /** Returns false and changes nothing when the balance will not cover it. */
  spend(amount: number): boolean {
    const cost = Math.round(amount);
    if (!Number.isFinite(cost) || cost < 0 || cost > this.moneyBalance) return false;
    this.moneyBalance -= cost;
    return true;
  }

  /**
   * File a specimen.
   *
   * `valueMultiplier` is where market bonuses and upgrade effects land, so the money credited
   * and the money shown on the catch card are computed once, here, and cannot disagree.
   */
  record(fish: CaughtFish, caughtAtMs: number, valueMultiplier = 1): CatchOutcome {
    const value = Math.max(1, Math.round(fish.value * valueMultiplier));
    const record: CatchRecord = {
      speciesId: fish.species.id,
      massKg: fish.massKg,
      lengthM: fish.lengthM,
      albino: fish.albino,
      value,
      caughtAtMs,
    };

    this.log.unshift(record);
    if (this.log.length > RECENT_CATCH_LIMIT) this.log.length = RECENT_CATCH_LIMIT;
    this.catches += 1;
    this.moneyBalance += value;

    const existing = this.entries.get(record.speciesId);
    if (existing === undefined) {
      this.entries.set(record.speciesId, {
        speciesId: record.speciesId,
        count: 1,
        bestMassKg: record.massKg,
        bestLengthM: record.lengthM,
        firstCaughtMs: caughtAtMs,
        lastCaughtMs: caughtAtMs,
      });
      return { record, personalBest: true, firstCatch: true, moneyEarned: value };
    }

    existing.count += 1;
    existing.lastCaughtMs = caughtAtMs;
    // Monotonic by construction. A best is a high-water mark, so it is only ever raised —
    // never assigned — which is what makes it survive an out-of-order or replayed record.
    const personalBest = record.massKg > existing.bestMassKg;
    if (personalBest) existing.bestMassKg = record.massKg;
    if (record.lengthM > existing.bestLengthM) existing.bestLengthM = record.lengthM;

    return { record, personalBest, firstCatch: false, moneyEarned: value };
  }

  toInventoryData(): InventoryData {
    return {
      money: this.moneyBalance,
      totalCatches: this.catches,
      recent: this.log.map((entry) => ({ ...entry })),
    };
  }

  toJournalData(): JournalData {
    return { entries: this.journal.map((entry) => ({ ...entry })) };
  }

  /** Replaces the whole state. Used once, on load. */
  load(inventory: InventoryData, journal: JournalData): void {
    this.moneyBalance = inventory.money;
    this.catches = inventory.totalCatches;
    this.log.length = 0;
    for (const record of inventory.recent.slice(0, RECENT_CATCH_LIMIT)) {
      this.log.push({ ...record });
    }
    this.entries.clear();
    for (const entry of journal.entries) {
      this.entries.set(entry.speciesId, { ...entry });
    }
  }

  clear(): void {
    this.moneyBalance = 0;
    this.catches = 0;
    this.log.length = 0;
    this.entries.clear();
  }
}

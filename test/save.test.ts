import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The save file, and the ledger behind it.
 *
 * A save is read during boot and written while the player is mid-cast, so the properties worth
 * asserting are the ones whose failure is either invisible or fatal:
 *
 *   1. **A round trip is lossless.** Money, counts, personal bests, first-caught dates and
 *      upgrade levels all have to come back exactly, because the only way anybody finds out
 *      they did not is by losing an evening's fishing.
 *   2. **Nothing gets past the parser.** Truncated JSON, a bare array, a string, a null, a
 *      version from the future, a version from a build that never existed — every one of them
 *      has to end in a usable `SaveData` and no exception. A throw here is a black screen.
 *   3. **An old file is migrated, not orphaned.** Version 1 spelled the upgrade ids differently
 *      and kept a flat bag of bests; those are a player's upgrades and they have to survive.
 *   4. **A personal best is decided before the ledger is updated, not after.** This is the one
 *      that looks fine in play until you notice every single fish is flagged, and it survives a
 *      reload only if the bests came back off disk first.
 *   5. **A write never reaches the console.** `npm run verify` fails the build on one warning,
 *      and a full quota fires on the machine of whoever has been playing the longest.
 *
 * Everything imported here is free of three, of the DOM and of shader modules, which is what
 * lets the whole save path be driven in node.
 */

import { Inventory } from '../src/gameplay/Inventory.js';
import { Progression, upgradeEffect } from '../src/gameplay/Progression.js';
import {
  SAVE_KEY,
  SAVE_VERSION,
  SaveScheduler,
  clearSave,
  defaultSaveData,
  defaultSavedSettings,
  loadSave,
  migrate,
  parseSave,
  serializeSave,
  writeSave,
  type SaveData,
  type SaveStorage,
} from '../src/gameplay/Save.js';
import { speciesById, type CaughtFish } from '../src/gameplay/Species.js';

// --------------------------------------------------------------------------------- test kit

class MemoryStorage implements SaveStorage {
  readonly items = new Map<string, string>();
  writes = 0;

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.writes += 1;
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }
}

/** A device whose quota is gone. The failure mode that has to stay silent. */
class FullStorage implements SaveStorage {
  attempts = 0;

  getItem(): string | null {
    return null;
  }

  setItem(): void {
    this.attempts += 1;
    throw new DOMException('quota exceeded', 'QuotaExceededError');
  }

  removeItem(): void {
    throw new DOMException('quota exceeded', 'QuotaExceededError');
  }
}

/** Private browsing: the object exists and every call on it throws. */
class SealedStorage implements SaveStorage {
  getItem(): string | null {
    throw new Error('access denied');
  }

  setItem(): void {
    throw new Error('access denied');
  }

  removeItem(): void {
    throw new Error('access denied');
  }
}

/**
 * A specimen of a known mass.
 *
 * Built by hand rather than rolled, because these tests are about what happens to a catch after
 * it exists — a random mass would make "is this a personal best" a coin toss.
 */
function specimen(speciesId: string, massKg: number, albino = false): CaughtFish {
  const species = speciesById(speciesId);
  if (species === undefined) throw new Error(`the species table has lost its ${speciesId}`);
  const span = Math.max(1e-6, species.maxMassKg - species.minMassKg);
  const lengthM =
    species.minLengthM +
    (species.maxLengthM - species.minLengthM) * Math.cbrt(Math.max(0, (massKg - species.minMassKg) / span));
  return { species, massKg, lengthM, albino, value: massKg * species.valuePerKg };
}

function snapshotOf(progression: Progression, inventory: Inventory, savedAtMs: number): SaveData {
  return {
    version: SAVE_VERSION,
    savedAtMs,
    progression: progression.toData(),
    inventory: inventory.toInventoryData(),
    journal: inventory.toJournalData(),
    settings: defaultSavedSettings(),
  };
}

const DAWN_MS = Date.UTC(2026, 6, 30, 4, 12, 0);
const HOUR_MS = 3_600_000;

// --------------------------------------------------------------------------------------------

describe('A round trip', () => {
  it('brings back the purse, the journal and the upgrade tree exactly', () => {
    const storage = new MemoryStorage();

    const progression = new Progression();
    progression.setLevel('reel-speed', 3);
    progression.setLevel('line-strength', 5);

    const inventory = new Inventory();
    inventory.record(specimen('cod', 9.5), DAWN_MS);
    inventory.record(specimen('cod', 4.25), DAWN_MS + HOUR_MS);
    inventory.record(specimen('mackerel', 0.9, true), DAWN_MS + 2 * HOUR_MS);
    inventory.earn(500);

    expect(writeSave(snapshotOf(progression, inventory, DAWN_MS), storage)).toBe(true);
    expect(storage.items.has(SAVE_KEY)).toBe(true);

    const result = loadSave(storage);
    expect(result.status).toBe('ok');
    expect(result.foundVersion).toBe(SAVE_VERSION);

    const reloadedTree = new Progression();
    reloadedTree.load(result.data.progression);
    expect(reloadedTree.levelOf('reel-speed')).toBe(3);
    expect(reloadedTree.levelOf('line-strength')).toBe(5);
    // The point of persisting a level is the number some other system reads off it.
    expect(reloadedTree.effects.reelSpeedMps).toBeCloseTo(upgradeEffect('reel-speed', 3), 12);

    const reloaded = new Inventory();
    reloaded.load(result.data.inventory, result.data.journal);
    expect(reloaded.money).toBe(inventory.money);
    expect(reloaded.totalCatches).toBe(3);
    expect(reloaded.recent.length).toBe(3);
    // Newest first, and the albino kept its six-fold value.
    expect(reloaded.recent[0]?.speciesId).toBe('mackerel');
    expect(reloaded.recent[0]?.albino).toBe(true);
    expect(reloaded.recent[0]?.value).toBe(inventory.recent[0]?.value);

    const cod = reloaded.entryFor('cod');
    expect(cod?.count).toBe(2);
    expect(cod?.bestMassKg).toBeCloseTo(9.5, 12);
    expect(cod?.firstCaughtMs).toBe(DAWN_MS);
    expect(cod?.lastCaughtMs).toBe(DAWN_MS + HOUR_MS);
    expect(reloaded.hasCaught('mackerel')).toBe(true);
    expect(reloaded.hasCaught('halibut')).toBe(false);

    // And the whole ledger, field for field, rather than only the fields named above.
    expect(reloaded.toJournalData()).toEqual(inventory.toJournalData());
    expect(reloaded.toInventoryData()).toEqual(inventory.toInventoryData());
  });

  it('survives a second lap through the file', () => {
    const inventory = new Inventory();
    inventory.record(specimen('pollock', 6), DAWN_MS);
    const once = snapshotOf(new Progression(), inventory, DAWN_MS);

    const twice = parseSave(serializeSave(parseSave(serializeSave(once)).data));
    expect(twice.status).toBe('ok');
    expect(twice.data).toEqual(parseSave(serializeSave(once)).data);
  });

  it('clears itself when asked, and reads back as a fresh start', () => {
    const storage = new MemoryStorage();
    writeSave(defaultSaveData(), storage);
    expect(clearSave(storage)).toBe(true);
    expect(loadSave(storage).status).toBe('absent');
  });
});

describe('A payload that is not a save', () => {
  const rubbish: ReadonlyArray<readonly [string, string]> = [
    ['truncated json', '{"version":2,"inventory":{'],
    ['not json at all', 'endless fishing was here'],
    ['a bare null', 'null'],
    ['an array', '[1,2,3]'],
    ['a string', '"cod"'],
    ['a number', '42'],
    ['an object with no version', '{"inventory":{"money":10}}'],
    ['a version that is not a number', '{"version":"two"}'],
    ['a version that is not finite', '{"version":null}'],
    ['a version from a build that never shipped', '{"version":0,"inventory":{"money":9999}}'],
    ['a negative version', '{"version":-3}'],
  ];

  for (const [name, payload] of rubbish) {
    it(`discards ${name} and starts fresh`, () => {
      const result = parseSave(payload);
      expect(result.status).toBe('corrupt');
      expect(result.data).toEqual(defaultSaveData());
      // A fresh start has to be a *usable* fresh start, not merely a non-throwing one.
      const inventory = new Inventory();
      inventory.load(result.data.inventory, result.data.journal);
      expect(inventory.money).toBe(0);
      expect(inventory.journal.length).toBe(0);
    });
  }

  it('keeps the rows it can read out of a half-mangled file', () => {
    // A real corruption is rarely total. Rows that survived are kept; rows that did not are
    // dropped, because a journal entry with no species is not a fish anybody caught.
    const result = parseSave(
      JSON.stringify({
        version: SAVE_VERSION,
        savedAtMs: 'yesterday',
        progression: { levels: { 'reel-speed': 2, 'not-an-upgrade': 9, 'line-strength': 'lots' } },
        inventory: { money: -40, totalCatches: Number.NaN, recent: [null, { massKg: 3 }] },
        journal: {
          entries: [
            { speciesId: 'cod', count: 4, bestMassKg: 11, bestLengthM: 0.9, firstCaughtMs: DAWN_MS },
            { speciesId: 'cod', count: 99 },
            { bestMassKg: 400 },
          ],
        },
      }),
    );

    expect(result.status).toBe('ok');
    expect(result.data.savedAtMs).toBe(0);
    expect(result.data.progression.levels['reel-speed']).toBe(2);
    expect(result.data.progression.levels['line-strength']).toBe(0);
    expect(result.data.progression.levels['not-an-upgrade']).toBeUndefined();
    // Money cannot be negative and a catch count cannot be NaN, so both floor at zero.
    expect(result.data.inventory.money).toBe(0);
    expect(result.data.inventory.totalCatches).toBe(0);
    expect(result.data.inventory.recent.length).toBe(0);
    // One cod row, the first one; the duplicate and the nameless row are gone.
    expect(result.data.journal.entries.length).toBe(1);
    expect(result.data.journal.entries[0]?.count).toBe(4);
    // A last-seen that predates a first-seen is not a state the game can reach, so it is clamped.
    expect(result.data.journal.entries[0]?.lastCaughtMs).toBe(DAWN_MS);
  });

  it('never throws, whatever it is handed', () => {
    const specimens: unknown[] = [
      undefined,
      null,
      0,
      Number.NaN,
      '',
      [],
      {},
      { version: Number.POSITIVE_INFINITY },
      { version: SAVE_VERSION, journal: 'no' },
      { version: SAVE_VERSION, inventory: { recent: 'no' } },
    ];
    for (const candidate of specimens) {
      expect(() => migrate(candidate)).not.toThrow();
      expect(migrate(candidate).data.version).toBe(SAVE_VERSION);
    }
    expect(parseSave(null).status).toBe('absent');
    expect(parseSave('').status).toBe('absent');
  });

  it('treats storage it cannot reach as an absent save rather than an error', () => {
    expect(() => loadSave(new SealedStorage())).not.toThrow();
    expect(loadSave(new SealedStorage()).status).toBe('unavailable');
    expect(loadSave(null).status).toBe('unavailable');
    expect(loadSave(null).data).toEqual(defaultSaveData());
    expect(writeSave(defaultSaveData(), null)).toBe(false);
  });
});

describe('An older save', () => {
  /** Version 1: short upgrade ids, a flat list of species seen and a map of best masses. */
  const V1 = JSON.stringify({
    version: 1,
    money: 1840,
    upgrades: { line: 4, reel: 2, sonar: 30, engine: 1, nonsense: 5 },
    caught: ['cod', 'plaice', 'cod', 'not-a-fish'],
    bestMassKg: { cod: 14.5, plaice: 2.1 },
    preset: 'ultra',
    volume: 0.4,
  });

  it('is migrated rather than thrown away', () => {
    const result = parseSave(V1);
    expect(result.status).toBe('migrated');
    expect(result.foundVersion).toBe(1);
    expect(result.data.version).toBe(SAVE_VERSION);
    expect(result.data.inventory.money).toBe(1840);
  });

  it('carries the upgrades across the rename and clamps them to the current caps', () => {
    const tree = new Progression();
    tree.load(parseSave(V1).data.progression);
    expect(tree.levelOf('line-strength')).toBe(4);
    expect(tree.levelOf('reel-speed')).toBe(2);
    expect(tree.levelOf('engine-power')).toBe(1);
    // Version 1 had no cap on sonar; this build's is 7, and a level past a cap is not an error.
    expect(tree.levelOf('sonar-range')).toBe(tree.maxLevelOf('sonar-range'));
    expect(tree.levelOf('lure-quality')).toBe(0);
  });

  it('keeps the species and their bests, once each', () => {
    const inventory = new Inventory();
    const data = parseSave(V1).data;
    inventory.load(data.inventory, data.journal);

    expect(inventory.journal.map((entry) => entry.speciesId)).toEqual(['cod', 'plaice', 'not-a-fish']);
    expect(inventory.entryFor('cod')?.bestMassKg).toBeCloseTo(14.5, 12);
    // Version 1 recorded no dates and no lengths, so they come across as "no record" rather
    // than as an invention. A zero best can only ever be raised, so nothing goes backwards.
    expect(inventory.entryFor('plaice')?.bestLengthM).toBe(0);
    expect(inventory.entryFor('plaice')?.firstCaughtMs).toBe(0);
  });

  it('reads a file from a newer build as best it can, and reports that it did', () => {
    // Every field goes through the same guards as a current file, so the worst a future
    // payload can do is contribute nothing. Discarding it instead would cost a player who
    // opened a newer deploy once their entire history.
    const result = parseSave(
      JSON.stringify({
        version: SAVE_VERSION + 7,
        savedAtMs: DAWN_MS,
        inventory: { money: 77, totalCatches: 1, recent: [] },
        journal: { entries: [{ speciesId: 'ling', count: 1, bestMassKg: 20, bestLengthM: 1.4, firstCaughtMs: DAWN_MS }] },
        tackleBox: { rods: ['something this build has never heard of'] },
      }),
    );

    expect(result.status).toBe('migrated');
    expect(result.foundVersion).toBe(SAVE_VERSION + 7);
    expect(result.data.version).toBe(SAVE_VERSION);
    expect(result.data.inventory.money).toBe(77);
    expect(result.data.journal.entries[0]?.speciesId).toBe('ling');
  });
});

describe('The personal best', () => {
  it('is decided against the stored best, not against the one just written', () => {
    const inventory = new Inventory();

    const first = inventory.record(specimen('cod', 8), DAWN_MS);
    expect(first.firstCatch).toBe(true);
    expect(first.personalBest).toBe(true);
    // The ledger has already moved by the time the verdict is handed back, which is exactly
    // why the verdict cannot be recomputed from it afterwards.
    expect(inventory.entryFor('cod')?.bestMassKg).toBeCloseTo(8, 12);

    const smaller = inventory.record(specimen('cod', 3), DAWN_MS + HOUR_MS);
    expect(smaller.firstCatch).toBe(false);
    expect(smaller.personalBest).toBe(false);
    expect(inventory.entryFor('cod')?.bestMassKg).toBeCloseTo(8, 12);

    const bigger = inventory.record(specimen('cod', 12), DAWN_MS + 2 * HOUR_MS);
    expect(bigger.personalBest).toBe(true);
    expect(inventory.entryFor('cod')?.bestMassKg).toBeCloseTo(12, 12);

    // A different species is its own first catch and nobody else's.
    const other = inventory.record(specimen('plaice', 0.4), DAWN_MS + 3 * HOUR_MS);
    expect(other.firstCatch).toBe(true);
    expect(inventory.entryFor('cod')?.count).toBe(3);
  });

  it('still knows the record after a reload', () => {
    const before = new Inventory();
    before.record(specimen('haddock', 5.5), DAWN_MS);

    const storage = new MemoryStorage();
    writeSave(snapshotOf(new Progression(), before, DAWN_MS), storage);

    const after = new Inventory();
    const loaded = loadSave(storage);
    after.load(loaded.data.inventory, loaded.data.journal);

    // The trap this whole test exists for: a fresh session that forgot the bests would call a
    // 2 kg haddock a personal best, and every fish after it too.
    const modest = after.record(specimen('haddock', 2), DAWN_MS + HOUR_MS);
    expect(modest.firstCatch).toBe(false);
    expect(modest.personalBest).toBe(false);
    expect(after.entryFor('haddock')?.count).toBe(2);

    const record = after.record(specimen('haddock', 6.9), DAWN_MS + 2 * HOUR_MS);
    expect(record.personalBest).toBe(true);
    expect(after.entryFor('haddock')?.bestMassKg).toBeCloseTo(6.9, 12);
  });

  it('never lets a best go backwards, however the records arrive', () => {
    const inventory = new Inventory();
    // Out of order on purpose: a replayed or late record must not lower a high-water mark.
    inventory.record(specimen('ling', 18), DAWN_MS + 2 * HOUR_MS);
    inventory.record(specimen('ling', 6), DAWN_MS);
    inventory.record(specimen('ling', 11), DAWN_MS + HOUR_MS);
    expect(inventory.entryFor('ling')?.bestMassKg).toBeCloseTo(18, 12);
    expect(inventory.entryFor('ling')?.count).toBe(3);
  });
});

describe('The scheduler', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function expectSilence(): void {
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  }

  it('writes once for a burst of changes', () => {
    const storage = new MemoryStorage();
    const inventory = new Inventory();
    const scheduler = new SaveScheduler(() => snapshotOf(new Progression(), inventory, DAWN_MS), {
      storage,
      debounceMs: 1000,
    });

    inventory.record(specimen('whiting', 0.8), DAWN_MS);
    scheduler.schedule();
    expect(scheduler.pending).toBe(true);
    // Nothing has touched the disk yet; three fish in quick succession are still one write.
    expect(storage.writes).toBe(0);
    inventory.record(specimen('whiting', 1.2), DAWN_MS + 1000);
    scheduler.schedule();
    inventory.record(specimen('cod', 4), DAWN_MS + 2000);
    scheduler.schedule();
    expect(storage.writes).toBe(0);

    vi.advanceTimersByTime(1000);
    expect(storage.writes).toBe(1);
    expect(scheduler.pending).toBe(false);

    // ...and what landed is the state as of the last change, not the first.
    const reloaded = new Inventory();
    const loaded = loadSave(storage);
    reloaded.load(loaded.data.inventory, loaded.data.journal);
    expect(reloaded.totalCatches).toBe(3);
    expect(reloaded.entryFor('whiting')?.bestMassKg).toBeCloseTo(1.2, 12);

    scheduler.dispose();
    scheduler.dispose();
    expect(storage.writes).toBe(1);
    expectSilence();
  });

  it('writes an outstanding change on the way out rather than losing it', () => {
    const storage = new MemoryStorage();
    const inventory = new Inventory();
    inventory.record(specimen('sea-bass', 3.3), DAWN_MS);
    const scheduler = new SaveScheduler(() => snapshotOf(new Progression(), inventory, DAWN_MS), {
      storage,
      debounceMs: 60_000,
    });

    scheduler.schedule();
    expect(storage.writes).toBe(0);
    // The tab going away long before the debounce would have fired.
    scheduler.dispose();
    expect(storage.writes).toBe(1);
    expect(loadSave(storage).data.journal.entries[0]?.speciesId).toBe('sea-bass');

    // The timer must have gone with it; a write after disposal would resurrect dead state.
    vi.advanceTimersByTime(120_000);
    expect(storage.writes).toBe(1);
    expectSilence();
  });

  it('does nothing at all when nothing changed', () => {
    const storage = new MemoryStorage();
    const scheduler = new SaveScheduler(() => defaultSaveData(), { storage, debounceMs: 10 });
    expect(scheduler.flush()).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(storage.writes).toBe(0);
    scheduler.dispose();
    expect(storage.writes).toBe(0);
  });

  it('gives up quietly on a device with no room left, without a word to the console', () => {
    const storage = new FullStorage();
    const scheduler = new SaveScheduler(() => defaultSaveData(), { storage, debounceMs: 10 });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(() => scheduler.schedule()).not.toThrow();
      vi.advanceTimersByTime(10);
    }

    // Three strikes, then it stops paying for a call that is only going to throw again.
    expect(storage.attempts).toBe(3);
    expect(scheduler.pending).toBe(true);
    expect(() => scheduler.dispose()).not.toThrow();
    expectSilence();
  });

  it('runs against a browser-shaped storage without one', () => {
    // No `localStorage`, no `window`, no `document` in node: construction has to resolve all
    // three to nothing and carry on, because this is also what a locked-down browser looks like.
    const scheduler = new SaveScheduler(() => defaultSaveData());
    expect(() => scheduler.schedule()).not.toThrow();
    vi.advanceTimersByTime(5000);
    expect(() => scheduler.dispose()).not.toThrow();
    expectSilence();
  });
});

import type { QualityPreset, Settings } from '../core/Settings.js';
import {
  RECENT_CATCH_LIMIT,
  createInventoryData,
  createJournalData,
  type CatchRecord,
  type InventoryData,
  type JournalData,
  type JournalEntry,
} from './Inventory.js';
import { UPGRADES, UPGRADE_IDS, createProgressionData, type ProgressionData } from './Progression.js';

/**
 * The save file.
 *
 * Three properties are non-negotiable, and every design decision here follows from them:
 *
 *   1. **It never throws.** A save is read during boot. An exception here is a black screen,
 *      and a black screen is worse than a lost save. Every field is coerced through a guard
 *      that has a default, so the worst outcome of a mangled payload is a fresh start.
 *   2. **It never writes to the console.** `npm run verify` fails the build on a single console
 *      warning, and "your old save was unreadable" is not a message the player can act on.
 *      Corruption is reported through the return value, for a caller that wants to know.
 *   3. **It migrates rather than discards.** The version lives *inside* the payload, not in the
 *      storage key, so an old save is found and upgraded instead of being orphaned by a rename.
 *
 * The storage is injected rather than reached for. `localStorage` throws on access in some
 * private-browsing modes and does not exist at all under Node, and the tests need to drive a
 * real round-trip without a browser.
 */

export const SAVE_VERSION = 2;
export const SAVE_KEY = 'endless-fishing/save';

/** The subset of settings that belongs to the *player's progress* rather than to the device. */
export interface SavedSettings {
  preset: QualityPreset;
  masterVolume: number;
  musicVolume: number;
  muted: boolean;
  timeScale: number;
  latitudeDeg: number;
  longitudeDeg: number;
}

export interface SaveData {
  version: number;
  /** UTC epoch ms the file was written at, on the real clock. */
  savedAtMs: number;
  progression: ProgressionData;
  inventory: InventoryData;
  journal: JournalData;
  settings: SavedSettings;
}

/** The two calls this module needs from a storage backend. `localStorage` satisfies it. */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LoadResult {
  data: SaveData;
  /** 'ok' when the payload parsed as the current version. */
  status: 'ok' | 'absent' | 'migrated' | 'corrupt' | 'unavailable';
  /** The version found in the payload, or null when there was nothing usable. */
  foundVersion: number | null;
}

const PRESETS: readonly QualityPreset[] = ['low', 'medium', 'high', 'ultra'];
const TIME_SCALES: readonly number[] = [1, 60, 600, 3600];

/**
 * Upgrade ids as they were spelled in version 1.
 *
 * Kept as a table rather than a rename in place, because the whole point of a migration path is
 * that the old spelling stays readable forever without the live code having to carry it.
 */
const V1_UPGRADE_IDS: Readonly<Record<string, string>> = {
  line: 'line-strength',
  reel: 'reel-speed',
  lure: 'lure-quality',
  sonar: 'sonar-range',
  engine: 'engine-power',
};

export function defaultSavedSettings(): SavedSettings {
  return {
    preset: 'high',
    masterVolume: 0.8,
    musicVolume: 0.35,
    muted: false,
    timeScale: 1,
    latitudeDeg: 32.08,
    longitudeDeg: 34.78,
  };
}

export function defaultSaveData(): SaveData {
  return {
    version: SAVE_VERSION,
    savedAtMs: 0,
    progression: createProgressionData(),
    inventory: createInventoryData(),
    journal: createJournalData(),
    settings: defaultSavedSettings(),
  };
}

// ------------------------------------------------------------------------ coercion helpers

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function int(value: unknown, fallback: number, min: number, max: number): number {
  return Math.round(num(value, fallback, min, max));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// ---------------------------------------------------------------------------- sanitisation

function readLevels(raw: unknown, rename: Readonly<Record<string, string>> | null): ProgressionData {
  const source = asRecord(raw);
  const levels = createProgressionData().levels;
  if (source === null) return { levels };
  for (const [key, value] of Object.entries(source)) {
    const id = rename === null ? key : (rename[key] ?? key);
    const definition = UPGRADE_IDS.find((candidate) => candidate === id);
    if (definition === undefined) continue;
    levels[definition] = int(value, 0, 0, UPGRADES[definition].maxLevel);
  }
  return { levels };
}

function readCatchRecord(raw: unknown): CatchRecord | null {
  const source = asRecord(raw);
  if (source === null) return null;
  const speciesId = str(source['speciesId']);
  if (speciesId === null) return null;
  return {
    speciesId,
    massKg: num(source['massKg'], 0, 0, 1e6),
    lengthM: num(source['lengthM'], 0, 0, 1e4),
    albino: bool(source['albino'], false),
    value: num(source['value'], 0, 0, 1e12),
    caughtAtMs: num(source['caughtAtMs'], 0, 0, Number.MAX_SAFE_INTEGER),
  };
}

function readJournalEntry(raw: unknown): JournalEntry | null {
  const source = asRecord(raw);
  if (source === null) return null;
  const speciesId = str(source['speciesId']);
  if (speciesId === null) return null;
  const firstCaughtMs = num(source['firstCaughtMs'], 0, 0, Number.MAX_SAFE_INTEGER);
  return {
    speciesId,
    count: int(source['count'], 1, 0, Number.MAX_SAFE_INTEGER),
    bestMassKg: num(source['bestMassKg'], 0, 0, 1e6),
    bestLengthM: num(source['bestLengthM'], 0, 0, 1e4),
    firstCaughtMs,
    // A last-seen earlier than a first-seen is not a state the game can produce, so a payload
    // claiming it has been edited or mangled; clamping is cheaper than rejecting the row.
    lastCaughtMs: Math.max(
      firstCaughtMs,
      num(source['lastCaughtMs'], firstCaughtMs, 0, Number.MAX_SAFE_INTEGER),
    ),
  };
}

function readSettings(raw: unknown): SavedSettings {
  const defaults = defaultSavedSettings();
  const source = asRecord(raw);
  if (source === null) return defaults;
  const preset = str(source['preset']);
  const timeScale = num(source['timeScale'], defaults.timeScale, 1, 3600);
  return {
    preset: PRESETS.find((candidate) => candidate === preset) ?? defaults.preset,
    masterVolume: num(source['masterVolume'], defaults.masterVolume, 0, 1),
    musicVolume: num(source['musicVolume'], defaults.musicVolume, 0, 1),
    muted: bool(source['muted'], defaults.muted),
    timeScale: TIME_SCALES.includes(timeScale) ? timeScale : defaults.timeScale,
    latitudeDeg: num(source['latitudeDeg'], defaults.latitudeDeg, -90, 90),
    longitudeDeg: num(source['longitudeDeg'], defaults.longitudeDeg, -180, 180),
  };
}

function readCurrent(source: Record<string, unknown>): SaveData {
  const inventory = asRecord(source['inventory']);
  const journal = asRecord(source['journal']);

  const recent: CatchRecord[] = [];
  for (const raw of asArray(inventory?.['recent'])) {
    const record = readCatchRecord(raw);
    if (record !== null) recent.push(record);
    if (recent.length >= RECENT_CATCH_LIMIT) break;
  }

  const entries: JournalEntry[] = [];
  const seen = new Set<string>();
  for (const raw of asArray(journal?.['entries'])) {
    const entry = readJournalEntry(raw);
    if (entry === null || seen.has(entry.speciesId)) continue;
    seen.add(entry.speciesId);
    entries.push(entry);
  }

  return {
    version: SAVE_VERSION,
    savedAtMs: num(source['savedAtMs'], 0, 0, Number.MAX_SAFE_INTEGER),
    progression: readLevels(asRecord(source['progression'])?.['levels'], null),
    inventory: {
      money: int(inventory?.['money'], 0, 0, Number.MAX_SAFE_INTEGER),
      totalCatches: int(inventory?.['totalCatches'], 0, 0, Number.MAX_SAFE_INTEGER),
      recent,
    },
    journal: { entries },
    settings: readSettings(source['settings']),
  };
}

/**
 * Version 1 → 2.
 *
 * Version 1 kept a flat bag: a money total, short upgrade ids, a list of species ever caught
 * and a map of best masses. It never recorded a length or a date, so those come across as zero
 * — which is honest, reads correctly in the journal as "no record", and keeps the bests
 * monotonic because a zero can only ever be raised.
 */
function migrateV1(source: Record<string, unknown>): SaveData {
  const data = defaultSaveData();
  data.progression = readLevels(source['upgrades'], V1_UPGRADE_IDS);
  data.inventory.money = int(source['money'], 0, 0, Number.MAX_SAFE_INTEGER);

  const bests = asRecord(source['bestMassKg']) ?? {};
  const seen = new Set<string>();
  for (const raw of asArray(source['caught'])) {
    const speciesId = str(raw);
    if (speciesId === null || seen.has(speciesId)) continue;
    seen.add(speciesId);
    data.journal.entries.push({
      speciesId,
      count: 1,
      bestMassKg: num(bests[speciesId], 0, 0, 1e6),
      bestLengthM: 0,
      firstCaughtMs: 0,
      lastCaughtMs: 0,
    });
  }
  data.inventory.totalCatches = data.journal.entries.length;

  const preset = str(source['preset']);
  if (preset !== null) {
    data.settings.preset = PRESETS.find((candidate) => candidate === preset) ?? data.settings.preset;
  }
  data.settings.masterVolume = num(source['volume'], data.settings.masterVolume, 0, 1);
  return data;
}

/**
 * Turn anything at all into a `SaveData`.
 *
 * Exported because it is the piece worth testing on its own: every path through it has to
 * terminate in a valid object, and the only way to be sure of that is to hand it garbage.
 */
export function migrate(raw: unknown): { data: SaveData; status: LoadResult['status']; foundVersion: number | null } {
  const source = asRecord(raw);
  if (source === null) return { data: defaultSaveData(), status: 'corrupt', foundVersion: null };

  const version = source['version'];
  if (typeof version !== 'number' || !Number.isFinite(version)) {
    return { data: defaultSaveData(), status: 'corrupt', foundVersion: null };
  }
  if (version === 1) return { data: migrateV1(source), status: 'migrated', foundVersion: 1 };
  // A file from a future build is read as best we can rather than thrown away: the fields we
  // know about are overwhelmingly likely to still be there, and nothing is written back until
  // the game itself saves.
  if (version >= SAVE_VERSION) {
    return {
      data: readCurrent(source),
      status: version === SAVE_VERSION ? 'ok' : 'migrated',
      foundVersion: version,
    };
  }
  return { data: defaultSaveData(), status: 'corrupt', foundVersion: version };
}

// ----------------------------------------------------------------------------------- i/o

export function serializeSave(data: SaveData): string {
  return JSON.stringify(data);
}

/** Parse a raw payload. Returns defaults for null, empty, non-JSON or structurally wrong input. */
export function parseSave(raw: string | null): LoadResult {
  if (raw === null || raw.length === 0) {
    return { data: defaultSaveData(), status: 'absent', foundVersion: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { data: defaultSaveData(), status: 'corrupt', foundVersion: null };
  }
  return migrate(parsed);
}

/** `localStorage` when it exists and is reachable, otherwise null. Never throws. */
export function resolveStorage(): SaveStorage | null {
  try {
    const candidate: unknown = globalThis.localStorage;
    if (candidate === undefined || candidate === null) return null;
    const storage = candidate as SaveStorage;
    if (typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') return null;
    return storage;
  } catch {
    return null;
  }
}

export function loadSave(storage: SaveStorage | null = resolveStorage()): LoadResult {
  if (storage === null) {
    return { data: defaultSaveData(), status: 'unavailable', foundVersion: null };
  }
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return { data: defaultSaveData(), status: 'unavailable', foundVersion: null };
  }
  return parseSave(raw);
}

/** Returns false when the write did not happen — quota, private browsing, no storage at all. */
export function writeSave(data: SaveData, storage: SaveStorage | null = resolveStorage()): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(SAVE_KEY, serializeSave({ ...data, version: SAVE_VERSION }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage: SaveStorage | null = resolveStorage()): boolean {
  if (storage === null) return false;
  try {
    storage.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------------ settings bridge

/** Snapshot the player-facing half of the settings store into a save block. */
export function captureSettings(settings: Settings): SavedSettings {
  return {
    preset: settings.graphics.preset,
    masterVolume: settings.audio.masterVolume,
    musicVolume: settings.audio.musicVolume,
    muted: settings.audio.muted,
    timeScale: settings.world.timeScale,
    latitudeDeg: settings.world.latitudeDeg,
    longitudeDeg: settings.world.longitudeDeg,
  };
}

/**
 * Push a save block back into the live settings store.
 *
 * Location goes through `setLocation` rather than being assigned, so the store marks the
 * position as explicit and the timezone guess stops overwriting it — and so the sky rebuilds
 * on the same code path a player changing it in the panel would take.
 */
export function applySavedSettings(settings: Settings, saved: SavedSettings): void {
  settings.applyPreset(saved.preset);
  settings.audio.masterVolume = saved.masterVolume;
  settings.audio.musicVolume = saved.musicVolume;
  settings.audio.muted = saved.muted;
  settings.emit('audio');
  settings.world.timeScale = saved.timeScale;
  settings.setLocation(saved.latitudeDeg, saved.longitudeDeg);
}

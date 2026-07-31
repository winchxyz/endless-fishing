import type { Engine, System } from '../core/Engine.js';
import type { ActionName } from '../core/Input.js';
import type { Settings } from '../core/Settings.js';
import { dayEvents, type DayEvents } from '../astro/RiseSet.js';
import { RAD_TO_DEG } from '../astro/AstroTime.js';
import { HUD, type HudSnapshot } from '../ui/HUD.js';
import { CatchCard, type CatchCardData } from '../ui/CatchCard.js';
import { Journal } from '../ui/Journal.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';
import type { FishingState } from './FishingSystem.js';
import { Inventory } from './Inventory.js';
import type { ProgressionData } from './Progression.js';
import { SAVE_VERSION, SaveScheduler, captureSettings, loadSave, type SaveData } from './Save.js';
import { SPECIES, type CaughtFish } from './Species.js';

/**
 * The bridge between the simulation and the overlay.
 *
 * `src/ui/**` is forbidden from importing three, so it cannot reach into the engine for
 * anything — it takes a plain snapshot and renders it. Something has to build that snapshot,
 * and this is it. Keeping the bridge here rather than in `main.ts` means the entry point stays
 * a list of registrations, and keeping it out of `src/ui` means the overlay stays testable
 * without a WebGL context.
 *
 * The snapshot object is allocated once and mutated in place. Twenty-odd fields rebuilt sixty
 * times a second is not free, and more importantly the HUD only writes to the DOM when a value
 * actually changed — handing it a fresh object each frame would defeat that entirely.
 *
 * It also owns the *session*: the purse, the journal and the save file. That is not scope
 * creep. The catch card, the journal screen and the ledger behind them are one thing seen from
 * three angles, they all move on exactly the same event — a fish reaching the boat — and the
 * only way to get the personal-best flag right is for whatever writes the ledger and whatever
 * draws the card to be the same piece of code, in that order.
 */

/** What the fishing system exposes, structurally, so this does not depend on it existing yet. */
export interface FishingReadout {
  readonly tension: number;
  readonly hooked: boolean;
  /** Where the loop is. The catch card is driven off the edge *into* `landed`. */
  readonly state: FishingState;
  /** The specimen the last landing produced. Stays set until the next one replaces it. */
  readonly lastCatch: CaughtFish | null;
}

/** What the upgrade tree exposes. `Progression` satisfies it. */
export interface ProgressionStore {
  load(data: ProgressionData): void;
  toData(): ProgressionData;
}

/** What the weather system exposes. Structural for the same reason. */
export interface WeatherReadout {
  readonly barometricTrendHpaPerHour: number;
  readonly stormWarning: { approaching: boolean; minutesAway: number };
}

/** What the boat exposes. */
export interface BoatReadout {
  readonly heading: number;
  readonly speedKnots: number;
}

export class UiSystem implements System {
  readonly name = 'ui';
  // Last of everything, so the numbers on screen describe the frame that was just simulated
  // rather than the one before it.
  readonly priority = 95;

  readonly hud: HUD;
  readonly catchCard: CatchCard;
  readonly journal: Journal;
  readonly settingsPanel: SettingsPanel;
  /** The purse and both ledgers. Public because the shop will need to spend out of it. */
  readonly inventory = new Inventory();

  private boat: BoatReadout | null = null;
  private weather: WeatherReadout | null = null;
  private fishing: FishingReadout | null = null;
  private progression: ProgressionStore | null = null;

  private readonly settings: Settings;
  private readonly saver: SaveScheduler;
  /**
   * The upgrade levels as they were read off disk.
   *
   * Held rather than applied, because the save is read the moment the overlay exists and the
   * tree may not have been handed over yet. It is also what gets written back if it never is,
   * so a build that has not wired the shop up cannot quietly erase someone's upgrades.
   */
  private readonly savedProgression: ProgressionData;
  /** Previous frame's fishing state, so a landing is handled on its edge and not every frame. */
  private lastFishingState: FishingState = 'idle';

  /**
   * Rise and set times are a numerical search over a whole day — about a hundred ephemeris
   * evaluations — so they are computed once per local day and per location, not per frame.
   */
  private events: DayEvents | null = null;
  private eventsKey = '';

  private readonly snapshot: HudSnapshot = {
    headingRad: 0,
    speedKnots: 0,
    epochMs: Date.now(),
    utcOffsetMinutes: 0,
    sunriseMs: null,
    sunsetMs: null,
    moonriseMs: null,
    moonsetMs: null,
    sunAltitudeDeg: 0,
    moonAltitudeDeg: 0,
    moonIlluminatedFraction: 0,
    moonBrightLimbAngle: 0,
    moonNorthAngle: 0,
    moonPhase: 'new',
    pressureHpa: 1013.25,
    pressureTrendHpaPerHour: 0,
    windSpeed: 0,
    beaufort: 0,
    windDirectionRad: 0,
    lineTension: 0,
    hooked: false,
    stormApproaching: false,
    stormMinutesAway: 0,
  };

  /** Rebuilt in place on every landing, for the same reason the HUD snapshot is. */
  private readonly card: CatchCardData = {
    species: '',
    latin: '',
    rarity: 'common',
    massKg: 0,
    lengthM: 0,
    albino: false,
    personalBest: false,
    firstCatch: false,
    value: 0,
  };

  private readonly help: HTMLElement;
  private helpDismissed = false;

  constructor(host: HTMLElement, settings: Settings) {
    this.settings = settings;
    this.hud = new HUD(host);
    this.catchCard = new CatchCard(host);
    this.journal = new Journal(host);
    this.settingsPanel = new SettingsPanel(host, settings);
    this.help = buildHelpCard(host);

    // The species table already carries every field `JournalSpecies` asks for, so the journal
    // reads the real table rather than a copy of six of its columns.
    this.journal.setSpecies(SPECIES);

    // The save is read here and nowhere else. It cannot throw and it cannot write to the
    // console, so a mangled file costs the player their history and nothing else.
    //
    // The `settings` block inside it is deliberately *not* applied. `core/Settings` keeps its
    // own store, it loaded before this system existed, and it is the finer-grained of the two —
    // it remembers individual quality knobs where the save only remembers a preset name.
    // Restoring the save over the top would silently undo whatever the player last chose in
    // the panel. The block is still written, so a save file describes a whole session.
    const loaded = loadSave();
    this.savedProgression = loaded.data.progression;
    this.inventory.load(loaded.data.inventory, loaded.data.journal);
    this.refreshJournal();

    this.saver = new SaveScheduler(() => this.buildSave());
    // An older file is rewritten in the new format straight away, so it is migrated once
    // rather than on every boot for the rest of its life. A *newer* one is left alone until
    // the player actually changes something, because overwriting it would be a downgrade.
    if (loaded.foundVersion !== null && loaded.foundVersion < SAVE_VERSION) this.saver.schedule();
  }

  /** Wired after construction because these systems are built after the UI host exists. */
  attach(sources: {
    boat?: BoatReadout;
    weather?: WeatherReadout;
    fishing?: FishingReadout;
    progression?: ProgressionStore;
  }): void {
    if (sources.boat !== undefined) this.boat = sources.boat;
    if (sources.weather !== undefined) this.weather = sources.weather;
    if (sources.fishing !== undefined) {
      this.fishing = sources.fishing;
      // Adopt whatever state the rod is already in, so wiring the UI up mid-cast is not read
      // as a landing that never happened.
      this.lastFishingState = sources.fishing.state;
    }
    if (sources.progression !== undefined) {
      this.progression = sources.progression;
      // The tree mutates its effects object in place, so everything already holding a
      // reference to it — the rod, the boat — feels the saved upgrades immediately.
      sources.progression.load(this.savedProgression);
    }
  }

  update(_dt: number, engine: Engine): void {
    const input = engine.input;

    if (input.wasPressed('journal')) this.journal.toggle();
    if (input.wasPressed('settings')) this.settingsPanel.toggle();

    // Dismissal is tested before the landing below can raise a new card, so the same click
    // that skips the landing dwell does not also wipe the card in the frame it appears.
    if (this.catchCard.isVisible && playerActed(input)) this.catchCard.dismiss();
    this.watchForLanding(engine);

    // The help card goes as soon as the player does anything at all. Showing controls until
    // someone has read them is patronising; showing them until someone has *used* them is just
    // wrong, because the first thing anybody does is press a key to see what happens.
    if (!this.helpDismissed && (input.throttleAxis !== 0 || input.rudderAxis !== 0)) {
      this.helpDismissed = true;
      this.help.classList.add('is-gone');
    }

    // Everything below reads the sky, and on the first frame or two there is not one yet.
    // Anything that must happen regardless of that — a fish landed, a save written — is above.
    const state = engine.world.ephemeris;
    if (state === null) return;

    this.refreshDayEvents(engine);

    const s = this.snapshot;
    s.headingRad = this.boat?.heading ?? 0;
    s.speedKnots = this.boat?.speedKnots ?? 0;
    s.epochMs = engine.time.epochMs;
    s.utcOffsetMinutes = engine.time.timezoneOffsetMinutes;

    s.sunriseMs = this.events?.sunrise ?? null;
    s.sunsetMs = this.events?.sunset ?? null;
    s.moonriseMs = this.events?.moonrise ?? null;
    s.moonsetMs = this.events?.moonset ?? null;

    s.sunAltitudeDeg = state.sunAltitudeDeg;
    s.moonAltitudeDeg = state.moonAltitudeDeg;
    s.moonIlluminatedFraction = state.moon.illuminatedFraction;
    // The glyph is drawn from the real limb geometry, not from a phase name, which is why both
    // of these are carried through rather than just the fraction.
    s.moonBrightLimbAngle = state.moon.brightLimbAngle;
    s.moonNorthAngle = state.moon.northScreenAngle;
    s.moonPhase = state.moon.phaseName;

    const world = engine.world;
    s.pressureHpa = world.pressureHpa;
    s.pressureTrendHpaPerHour = this.weather?.barometricTrendHpaPerHour ?? 0;
    s.windSpeed = world.windSpeed;
    s.beaufort = world.beaufort;
    s.windDirectionRad = world.windDirection;

    s.lineTension = this.fishing?.tension ?? 0;
    s.hooked = this.fishing?.hooked ?? false;

    const warning = this.weather?.stormWarning;
    s.stormApproaching = warning?.approaching ?? false;
    s.stormMinutesAway = warning?.minutesAway ?? 0;

    this.hud.update(s);
  }

  dispose(): void {
    // First, so a session that ends between the debounce and the timer still lands on disk.
    this.saver.dispose();
    this.hud.dispose();
    this.catchCard.dispose();
    this.journal.dispose();
    this.settingsPanel.dispose();
  }

  /**
   * Catch the frame the rod arrives in `landed`, and only that frame.
   *
   * `lastCatch` is not cleared when the rod goes idle — the card is still up, and the journal
   * may still want it — so the specimen alone cannot say whether it has been filed. The edge
   * can, and it is the only thing that can, which is why the previous state is kept.
   */
  private watchForLanding(engine: Engine): void {
    const fishing = this.fishing;
    if (fishing === null) return;
    const state = fishing.state;
    const justLanded = state === 'landed' && this.lastFishingState !== 'landed';
    this.lastFishingState = state;
    if (!justLanded) return;

    const fish = fishing.lastCatch;
    if (fish !== null) this.land(fish, engine.time.epochMs);
  }

  /**
   * File a specimen: ledger first, then the card, then the screen, then the disk.
   *
   * The order is the whole point. `Inventory.record` compares the fish against the stored best
   * *before* it raises it and hands back the verdict, so the card is told what was true a
   * moment ago. Ask the journal afterwards instead and every fish ever caught is a personal
   * best, because by then it is.
   */
  private land(fish: CaughtFish, caughtAtMs: number): void {
    const outcome = this.inventory.record(fish, caughtAtMs);

    const card = this.card;
    card.species = fish.species.name;
    card.latin = fish.species.latin;
    card.rarity = fish.species.rarity;
    card.massKg = outcome.record.massKg;
    card.lengthM = outcome.record.lengthM;
    card.albino = outcome.record.albino;
    card.firstCatch = outcome.firstCatch;
    // The first of anything is trivially the best of it, and printing both flags on the same
    // card says one thing twice.
    card.personalBest = outcome.personalBest && !outcome.firstCatch;
    card.value = outcome.moneyEarned;
    this.catchCard.show(card);

    this.refreshJournal();
    this.saver.schedule();
  }

  private refreshJournal(): void {
    this.journal.setRecords(this.inventory.journal);
    this.journal.setSummary(this.inventory.money, this.inventory.totalCatches);
  }

  private buildSave(): SaveData {
    return {
      version: SAVE_VERSION,
      // The wall clock, not the world clock: this records when the file was written, and the
      // world clock can be dragged to a solstice for a screenshot.
      savedAtMs: Date.now(),
      progression: this.progression?.toData() ?? this.savedProgression,
      inventory: this.inventory.toInventoryData(),
      journal: this.inventory.toJournalData(),
      settings: captureSettings(this.settings),
    };
  }

  /**
   * Recompute the day's events when the local day or the location changes.
   *
   * Keyed on the local calendar day *and* the coordinates, because the settings panel can move
   * the boat to Reykjavík mid-session and the sunset time has to follow it immediately rather
   * than at the next midnight.
   */
  private refreshDayEvents(engine: Engine): void {
    const world = engine.settings.world;
    const local = new Date(engine.time.epochMs);
    const key = `${local.getFullYear()}-${local.getMonth()}-${local.getDate()}:${world.latitudeDeg.toFixed(3)}:${world.longitudeDeg.toFixed(3)}`;
    if (key === this.eventsKey) return;
    this.eventsKey = key;
    this.events = dayEvents(
      {
        latitudeDeg: world.latitudeDeg,
        longitudeDeg: world.longitudeDeg,
        elevationM: 0,
      },
      engine.time.epochMs,
    );
  }
}

/** Degrees for a HUD that wants them, without every call site importing the constant. */
export function toDegrees(radians: number): number {
  return radians * RAD_TO_DEG;
}

/**
 * The keys that mean the player has moved on, so the catch card gets out of the way.
 *
 * Every bound action except the debug key, which is not the player playing. These are read as
 * *edges* rather than as held state on purpose: someone who lands a fish while still leaning on
 * the throttle has not asked for the card to go, and testing the held axis would give them a
 * card that existed for a single frame.
 */
const DISMISSING_ACTIONS: readonly ActionName[] = [
  'throttleUp',
  'throttleDown',
  'rudderLeft',
  'rudderRight',
  'boost',
  'anchor',
  'reel',
  'cameraMode',
  'journal',
  'settings',
];

/** The slice of `Input` the dismissal test reads. `Input` satisfies it. */
interface PlayerInput {
  readonly primaryPressed: boolean;
  wasPressed(action: ActionName): boolean;
}

/** True on any frame the player did something. Allocates nothing. */
function playerActed(input: PlayerInput): boolean {
  if (input.primaryPressed) return true;
  for (const action of DISMISSING_ACTIONS) {
    if (input.wasPressed(action)) return true;
  }
  return false;
}

/** The controls the player actually needs, in the order they will need them. */
const HELP_ROWS: ReadonlyArray<readonly [string, string]> = [
  ['W / S', 'Throttle'],
  ['A / D', 'Steer'],
  ['Shift', 'Boost'],
  ['Space', 'Anchor — steady the boat to fish'],
  ['Hold LMB', 'Charge a cast, release to throw'],
  ['R', 'Reel in — keep the line taut, not tight'],
  ['C', 'Camera: follow / first person / orbit'],
  ['J', 'Species journal'],
  ['Esc', 'Settings — time, location, graphics'],
];

/**
 * A card telling the player how to play.
 *
 * Obvious in hindsight, and it was missing: everything the game knows about itself was in a
 * README that a player who opens a link will never see. Built here rather than in `index.html`
 * so the key list has exactly one definition.
 */
function buildHelpCard(host: HTMLElement): HTMLElement {
  const card = document.createElement('aside');
  card.className = 'hud-panel help-card';

  const title = document.createElement('h2');
  title.textContent = 'Endless Fishing';
  card.appendChild(title);

  const list = document.createElement('dl');
  for (const [keys, action] of HELP_ROWS) {
    const term = document.createElement('dt');
    term.textContent = keys;
    const detail = document.createElement('dd');
    detail.textContent = action;
    list.append(term, detail);
  }
  card.appendChild(list);

  const hint = document.createElement('p');
  hint.className = 'help-card__hint';
  hint.textContent = 'Anchor first, then cast. Dawn and dusk fish best.';
  card.appendChild(hint);

  host.appendChild(card);
  return card;
}

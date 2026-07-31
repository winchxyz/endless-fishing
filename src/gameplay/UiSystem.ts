import type { Engine, System } from '../core/Engine.js';
import type { Settings } from '../core/Settings.js';
import { dayEvents, type DayEvents } from '../astro/RiseSet.js';
import { RAD_TO_DEG } from '../astro/AstroTime.js';
import { HUD, type HudSnapshot } from '../ui/HUD.js';
import { CatchCard } from '../ui/CatchCard.js';
import { Journal } from '../ui/Journal.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';

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
 */

/** What the fishing system exposes, structurally, so this does not depend on it existing yet. */
export interface FishingReadout {
  readonly tension: number;
  readonly hooked: boolean;
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

  private boat: BoatReadout | null = null;
  private weather: WeatherReadout | null = null;
  private fishing: FishingReadout | null = null;

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

  private readonly help: HTMLElement;
  private helpDismissed = false;

  constructor(host: HTMLElement, settings: Settings) {
    this.hud = new HUD(host);
    this.catchCard = new CatchCard(host);
    this.journal = new Journal(host);
    this.settingsPanel = new SettingsPanel(host, settings);
    this.help = buildHelpCard(host);
  }

  /** Wired after construction because these systems are built after the UI host exists. */
  attach(sources: {
    boat?: BoatReadout;
    weather?: WeatherReadout;
    fishing?: FishingReadout;
  }): void {
    if (sources.boat !== undefined) this.boat = sources.boat;
    if (sources.weather !== undefined) this.weather = sources.weather;
    if (sources.fishing !== undefined) this.fishing = sources.fishing;
  }

  update(_dt: number, engine: Engine): void {
    const state = engine.world.ephemeris;
    if (state === null) return;

    if (engine.input.wasPressed('journal')) this.journal.toggle();
    if (engine.input.wasPressed('settings')) this.settingsPanel.toggle();

    // The card goes as soon as the player does anything at all. Showing controls until someone
    // has read them is patronising; showing them until someone has *used* them is just wrong,
    // because the first thing anybody does is press a key to see what happens.
    if (!this.helpDismissed && (engine.input.throttleAxis !== 0 || engine.input.rudderAxis !== 0)) {
      this.helpDismissed = true;
      this.help.classList.add('is-gone');
    }

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
    this.hud.dispose();
    this.catchCard.dispose();
    this.journal.dispose();
    this.settingsPanel.dispose();
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

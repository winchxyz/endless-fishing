import './hud.css';

/**
 * The instrument panel.
 *
 * Two rules shape everything in this file.
 *
 * **The DOM is written to only when a value has actually changed.** Twenty `textContent`
 * assignments a frame is a real cost — each one invalidates layout for the subtree — and at 120
 * Hz almost every one of them writes the string that is already there. Every readout therefore
 * goes through `Watched`, which holds the last value it applied. Where producing the string is
 * itself non-trivial (the clock, the rise and set times, the moon terminator path) the watched
 * value is the *quantised number*, so a frame that does not move the needle does no work at all
 * beyond a numeric comparison.
 *
 * **The moon is drawn from the ephemeris, not from a set of icons.** The glyph is one circle
 * and one path; the path is a semicircular limb closed by an elliptical terminator whose
 * semi-minor axis is `|2f − 1|` of the radius, `f` being the real illuminated fraction, and the
 * whole group is rotated by the real bright-limb angle in the observer's frame. That is the
 * actual geometry of a lit sphere seen from an angle, so the crescent tips the way the sky
 * outside the window tips — including the horns-up moon you get near the tropics, which no set
 * of eight canned icons can produce.
 *
 * The snapshot is plain data. Nothing in `src/ui` knows that three.js exists.
 */

export interface HudSnapshot {
  /** Boat heading, radians, 0 = north, increasing clockwise (eastward). */
  headingRad: number;
  /** Speed over ground, knots. */
  speedKnots: number;

  /** UTC epoch ms of the simulated instant. */
  epochMs: number;
  /** Minutes to add to UTC to get civil time where the boat is. */
  utcOffsetMinutes: number;

  /** UTC epoch ms, or null when the event does not happen on this local day. */
  sunriseMs: number | null;
  sunsetMs: number | null;
  moonriseMs: number | null;
  moonsetMs: number | null;
  sunAltitudeDeg: number;
  moonAltitudeDeg: number;

  /** 0..1, straight from `ephemeris.moon.illuminatedFraction`. */
  moonIlluminatedFraction: number;
  /** Screen angle of the bright limb, radians. 0 = lit edge up, clockwise positive. */
  moonBrightLimbAngle: number;
  /** Screen angle of lunar north, radians, same convention. */
  moonNorthAngle: number;
  /** `ephemeris.moon.phaseName`, or any label the host prefers. */
  moonPhase: string;

  pressureHpa: number;
  /** hPa per hour. Negative is falling. */
  pressureTrendHpaPerHour: number;

  /** Metres per second. */
  windSpeed: number;
  beaufort: number;
  /** Direction the wind blows *towards*, radians from north, clockwise. */
  windDirectionRad: number;

  /** Fraction of the line's breaking strain, 0..1. */
  lineTension: number;
  /** True while a fish is on. The meter is hidden otherwise. */
  hooked: boolean;

  stormApproaching: boolean;
  /** Minutes until the front arrives. Ignored unless `stormApproaching`. */
  stormMinutesAway: number;
}

const TAU = Math.PI * 2;
const RAD_TO_DEG = 180 / Math.PI;
const MS_TO_KNOTS = 1.943844;
const MOON_RADIUS = 10;
/** Fraction of the meter at which the line is in real danger. Matches `.tension__limit`. */
const STRAIN_MARK = 0.82;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;
const POINTS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
] as const;

/** Holds the last value it applied and does nothing at all when handed it again. */
class Watched<T> {
  private last: T | undefined;

  constructor(private readonly apply: (value: T) => void) {}

  set(value: T): void {
    if (value === this.last) return;
    this.last = value;
    this.apply(value);
  }
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function wrapTurn(radians: number): number {
  const wrapped = radians % TAU;
  return wrapped < 0 ? wrapped + TAU : wrapped;
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** Civil time where the boat is. Formatted by hand so it cannot pick up the host's locale. */
export function formatClock(epochMs: number, utcOffsetMinutes: number): string {
  const date = new Date(epochMs + utcOffsetMinutes * 60000);
  return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

export function formatDate(epochMs: number, utcOffsetMinutes: number): string {
  const date = new Date(epochMs + utcOffsetMinutes * 60000);
  return `${WEEKDAYS[date.getUTCDay()] ?? ''} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()] ?? ''}`;
}

/** Signed degrees with a true minus sign and a degree symbol. */
function formatAltitude(degrees: number): string {
  const rounded = Math.round(degrees * 10) / 10;
  const sign = rounded < 0 ? '−' : '+';
  return `${sign}${Math.abs(rounded).toFixed(1)}°`;
}

export function compassPoint(radians: number): string {
  const index = Math.round(wrapTurn(radians) / (TAU / 16)) % 16;
  return POINTS[index] ?? 'N';
}

/**
 * Where the wind sits relative to the hull, in the words a helmsman would use.
 * `relative` is the bearing of the direction the wind comes *from*, measured off the bow.
 */
function windBearingLabel(relative: number): string {
  const degrees = wrapTurn(relative) * RAD_TO_DEG;
  const off = degrees > 180 ? 360 - degrees : degrees;
  const side = degrees > 180 ? 'port' : 'stbd';
  if (off < 11.25) return 'ahead';
  if (off > 168.75) return 'astern';
  const sector = off < 67.5 ? 'bow' : off < 112.5 ? 'beam' : 'quarter';
  return `${side} ${sector}`;
}

/**
 * The lit region of a sphere illuminated from an angle, with the bright limb pointing up.
 *
 * Outer semicircle from (−r, 0) over the top to (r, 0), closed by a half-ellipse of semi-axes
 * (r, |2f−1|·r) back to the start. The sweep flag is the only thing that differs between a
 * crescent and a gibbous: the terminator bulges into the lit side below half, into the dark
 * side above it. At exactly half the minor axis is zero and SVG degenerates the arc to the
 * straight line that a half moon actually shows.
 */
export function moonTerminatorPath(illuminatedFraction: number, radius: number): string {
  const k = 2 * clamp01(illuminatedFraction) - 1;
  const minor = (Math.abs(k) * radius).toFixed(3);
  const sweep = k >= 0 ? 1 : 0;
  return `M ${-radius} 0 A ${radius} ${radius} 0 0 1 ${radius} 0 A ${radius} ${minor} 0 0 ${sweep} ${-radius} 0 Z`;
}

function compassFace(): string {
  let markup = '';
  for (let i = 0; i < 32; i += 1) {
    const angle = (i * TAU) / 32;
    const major = i % 4 === 0;
    const sin = Math.sin(angle);
    const cos = -Math.cos(angle);
    const inner = 44 - (major ? 8 : 4);
    markup +=
      `<line class="compass__tick${major ? ' compass__tick--major' : ''}" ` +
      `x1="${(sin * 44).toFixed(2)}" y1="${(cos * 44).toFixed(2)}" ` +
      `x2="${(sin * inner).toFixed(2)}" y2="${(cos * inner).toFixed(2)}"/>`;
  }
  const cardinals = ['N', 'E', 'S', 'W'];
  for (let i = 0; i < 4; i += 1) {
    const angle = (i * Math.PI) / 2;
    markup +=
      `<text class="compass__cardinal" x="${(Math.sin(angle) * 27).toFixed(2)}" ` +
      `y="${(-Math.cos(angle) * 27).toFixed(2)}">${cardinals[i] ?? ''}</text>`;
  }
  return markup;
}

function sunRays(): string {
  let markup = '';
  for (let i = 0; i < 8; i += 1) {
    const angle = (i * TAU) / 8;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    markup +=
      `<line class="sun-glyph__ray" x1="${(sin * 7.6).toFixed(2)}" y1="${(cos * 7.6).toFixed(2)}" ` +
      `x2="${(sin * 10).toFixed(2)}" y2="${(cos * 10).toFixed(2)}"/>`;
  }
  return markup;
}

const MARKUP = `
<div class="hud-panel hud__storm" role="status">
  <span class="hud__storm-title">Storm</span>
  <span class="hud-row__value" data-storm-detail></span>
</div>
<section class="hud-panel hud__nav" aria-label="Navigation">
  <svg class="compass" viewBox="-50 -50 100 100" aria-hidden="true">
    <circle class="compass__ring" cx="0" cy="0" r="44"/>
    <g data-rose>${compassFace()}</g>
    <path class="compass__lubber" d="M0 -47 l-3.4 -6.4 h6.8 z"/>
  </svg>
  <div class="hud__nav-readout">
    <div class="hud-figure"><span class="hud-figure__value" data-heading>000</span><span class="hud-figure__unit">&deg;</span></div>
    <div class="hud-label" data-heading-point>N</div>
    <div class="hud-rule"></div>
    <div class="hud-figure"><span class="hud-figure__value" data-speed>0.0</span><span class="hud-figure__unit">kn</span></div>
  </div>
</section>
<section class="hud-panel hud__sky" aria-label="Sky">
  <div class="hud__clock">
    <span class="hud__clock-time" data-clock>--:--</span>
    <span class="hud-label" data-date></span>
  </div>
  <div class="hud-rule"></div>
  <div class="hud__bodies">
    <div class="hud__body">
      <div class="hud__body-head">
        <svg class="sun-glyph" viewBox="-12 -12 24 24" aria-hidden="true">
          <circle class="sun-glyph__disc" cx="0" cy="0" r="5.2"/>${sunRays()}
        </svg>
        <span class="hud-label">Sun</span>
      </div>
      <div class="hud-row"><span class="hud-label">Alt</span><span class="hud-row__value" data-sun-alt>&mdash;</span></div>
      <div class="hud-row"><span class="hud-label">Rise</span><span class="hud-row__value" data-sunrise>&mdash;</span></div>
      <div class="hud-row"><span class="hud-label">Set</span><span class="hud-row__value" data-sunset>&mdash;</span></div>
    </div>
    <div class="hud__body">
      <div class="hud__body-head">
        <svg class="moon-glyph" viewBox="-12 -12 24 24" aria-hidden="true">
          <circle class="moon-glyph__dark" cx="0" cy="0" r="${MOON_RADIUS}"/>
          <g data-moon-limb><path class="moon-glyph__lit" data-moon-path d=""/></g>
          <g data-moon-north><line class="moon-glyph__north" x1="0" y1="-10.6" x2="0" y2="-11.9"/></g>
        </svg>
        <span class="hud__phase" data-moon-phase>&mdash;</span>
      </div>
      <div class="hud-row"><span class="hud-label">Alt</span><span class="hud-row__value" data-moon-alt>&mdash;</span></div>
      <div class="hud-row"><span class="hud-label">Rise</span><span class="hud-row__value" data-moonrise>&mdash;</span></div>
      <div class="hud-row"><span class="hud-label">Set</span><span class="hud-row__value" data-moonset>&mdash;</span></div>
    </div>
  </div>
</section>
<section class="hud-panel hud__weather" aria-label="Weather">
  <div class="hud__baro">
    <span class="hud-figure__value" data-pressure>1013</span>
    <span class="hud-figure__unit">hPa</span>
    <svg class="hud__trend" data-trend viewBox="-4.5 -6.5 9 13" aria-hidden="true">
      <path class="hud__trend-mark" data-trend-mark d=""/>
    </svg>
  </div>
  <div class="hud-row"><span class="hud-label">Trend</span><span class="hud-row__value" data-trend-value>&mdash;</span></div>
  <div class="hud-rule"></div>
  <div class="hud__wind">
    <svg class="wind-dial" data-wind-dial viewBox="-20 -20 40 40" aria-hidden="true">
      <circle class="wind-dial__ring" cx="0" cy="0" r="13"/>
      <path class="wind-dial__hull" d="M0 -10 C4 -5.5 4.6 1.5 3 8.5 L-3 8.5 C-4.6 1.5 -4 -5.5 0 -10 Z"/>
      <g data-wind-arrow><path class="wind-dial__arrow" d="M0 -19.4 L4.2 -13.4 L-4.2 -13.4 Z"/></g>
    </svg>
    <div>
      <div class="hud-figure"><span class="hud-figure__value" data-wind-speed>0</span><span class="hud-figure__unit">kn</span></div>
      <div class="hud-row"><span class="hud-label">Force</span><span class="hud-row__value" data-beaufort>0</span></div>
      <div class="hud-row"><span class="hud-label">From</span><span class="hud-row__value" data-wind-from>&mdash;</span></div>
    </div>
  </div>
</section>
<div class="hud__tension" data-tension aria-label="Line tension">
  <div class="tension__track">
    <div class="tension__fill" data-tension-fill></div>
    <div class="tension__limit"></div>
  </div>
  <div class="tension__legend">
    <span class="hud-label">Line</span><span class="hud-row__value" data-tension-value>0%</span>
  </div>
</div>`;

const RISING_ARROW = 'M0 5 V-5 M-3 -2 L0 -5 L3 -2';
const FALLING_ARROW = 'M0 -5 V5 M-3 2 L0 5 L3 2';
const STEADY_ARROW = 'M-4 0 H4';

export class HUD {
  private readonly root: HTMLElement;
  private readonly fields: {
    rose: Watched<string>;
    heading: Watched<number>;
    headingPoint: Watched<string>;
    speed: Watched<number>;
    clock: Watched<number>;
    date: Watched<number>;
    sunAltitude: Watched<number>;
    sunrise: Watched<number>;
    sunset: Watched<number>;
    moonAltitude: Watched<number>;
    moonrise: Watched<number>;
    moonset: Watched<number>;
    moonPath: Watched<number>;
    moonLimb: Watched<number>;
    moonNorth: Watched<number>;
    moonPhase: Watched<string>;
    pressure: Watched<number>;
    trendArrow: Watched<string>;
    trendFalling: Watched<boolean>;
    trendValue: Watched<number>;
    windSpeed: Watched<number>;
    windStrong: Watched<boolean>;
    beaufort: Watched<number>;
    windArrow: Watched<number>;
    windFrom: Watched<string>;
    tensionLive: Watched<boolean>;
    tensionFill: Watched<number>;
    tensionStrained: Watched<boolean>;
    tensionParting: Watched<boolean>;
    stormLive: Watched<boolean>;
    stormDetail: Watched<number>;
  };

  constructor(host: HTMLElement) {
    const root = document.createElement('div');
    root.className = 'hud';
    root.innerHTML = MARKUP;
    host.appendChild(root);
    this.root = root;

    const pick = (selector: string): Element => {
      const node = root.querySelector(selector);
      if (node === null) throw new Error(`HUD markup is missing ${selector}`);
      return node;
    };
    const text = (selector: string): ((value: string) => void) => {
      const node = pick(selector);
      return (value) => {
        node.textContent = value;
      };
    };
    const attribute = (selector: string, name: string): ((value: string) => void) => {
      const node = pick(selector);
      return (value) => node.setAttribute(name, value);
    };
    const toggle = (selector: string, name: string): ((on: boolean) => void) => {
      const node = pick(selector);
      return (on) => node.classList.toggle(name, on);
    };

    /** A cell whose watched value is a quantised number and whose text is derived from it. */
    const numeric = (selector: string, format: (value: number) => string): Watched<number> => {
      const write = text(selector);
      return new Watched<number>((value) => write(format(value)));
    };
    /**
     * Every rise/set cell shares one formatter. The watched value is the event's epoch with
     * the boat's offset already folded in, which does two things: the `Date` allocation only
     * happens on the two or three frames a day when the event actually moves, and moving the
     * boat to another longitude re-renders the cell even though the UTC instant did not change.
     */
    const riseSet = (selector: string): Watched<number> =>
      numeric(selector, (localMs) => (localMs < 0 ? '—' : formatClock(localMs, 0)));

    const setPath = attribute('[data-moon-path]', 'd');
    const setLimb = attribute('[data-moon-limb]', 'transform');
    const setNorth = attribute('[data-moon-north]', 'transform');
    const setArrow = attribute('[data-wind-arrow]', 'transform');
    const fill = pick('[data-tension-fill]');
    const writeTension = text('[data-tension-value]');

    this.fields = {
      rose: new Watched<string>(attribute('[data-rose]', 'transform')),
      heading: numeric('[data-heading]', (deg) => String(deg).padStart(3, '0')),
      headingPoint: new Watched<string>(text('[data-heading-point]')),
      speed: numeric('[data-speed]', (tenths) => (tenths / 10).toFixed(1)),
      clock: numeric('[data-clock]', (minutes) => formatClock(minutes * 60000, 0)),
      date: numeric('[data-date]', (days) => formatDate(days * 86400000, 0)),

      sunAltitude: numeric('[data-sun-alt]', (tenths) => formatAltitude(tenths / 10)),
      sunrise: riseSet('[data-sunrise]'),
      sunset: riseSet('[data-sunset]'),
      moonAltitude: numeric('[data-moon-alt]', (tenths) => formatAltitude(tenths / 10)),
      moonrise: riseSet('[data-moonrise]'),
      moonset: riseSet('[data-moonset]'),
      moonPath: new Watched<number>((thousandths) =>
        setPath(moonTerminatorPath(thousandths / 1000, MOON_RADIUS)),
      ),
      moonLimb: new Watched<number>((halfDegrees) => setLimb(`rotate(${halfDegrees / 2})`)),
      moonNorth: new Watched<number>((halfDegrees) => setNorth(`rotate(${halfDegrees / 2})`)),
      moonPhase: new Watched<string>(text('[data-moon-phase]')),

      pressure: numeric('[data-pressure]', (hpa) => String(hpa)),
      trendArrow: new Watched<string>(attribute('[data-trend-mark]', 'd')),
      trendFalling: new Watched<boolean>(toggle('[data-trend]', 'is-falling')),
      trendValue: numeric('[data-trend-value]', (tenths) => {
        const value = tenths / 10;
        return `${value < 0 ? '−' : '+'}${Math.abs(value).toFixed(1)} hPa/h`;
      }),
      windSpeed: numeric('[data-wind-speed]', (knots) => String(knots)),
      windStrong: new Watched<boolean>(toggle('[data-wind-dial]', 'is-strong')),
      beaufort: numeric('[data-beaufort]', (force) => String(force)),
      windArrow: new Watched<number>((degrees) => setArrow(`rotate(${degrees})`)),
      windFrom: new Watched<string>(text('[data-wind-from]')),

      tensionLive: new Watched<boolean>(toggle('[data-tension]', 'is-live')),
      tensionFill: new Watched<number>((thousandths) => {
        if (fill instanceof HTMLElement) fill.style.width = `${thousandths / 10}%`;
        writeTension(`${Math.round(thousandths / 10)}%`);
      }),
      tensionStrained: new Watched<boolean>(toggle('[data-tension]', 'is-strained')),
      tensionParting: new Watched<boolean>(toggle('[data-tension]', 'is-parting')),
      stormLive: new Watched<boolean>(toggle('.hud__storm', 'is-live')),
      stormDetail: numeric('[data-storm-detail]', (minutes) =>
        minutes <= 0 ? 'overhead' : `${minutes} min`,
      ),
    };
  }

  update(snapshot: Readonly<HudSnapshot>): void {
    const f = this.fields;
    const offsetMs = snapshot.utcOffsetMinutes * 60000;
    const local = (ms: number | null): number => (ms === null ? -1 : ms + offsetMs);

    const headingDeg = wrapTurn(snapshot.headingRad) * RAD_TO_DEG;
    f.rose.set(`rotate(${(-headingDeg).toFixed(1)})`);
    f.heading.set(Math.round(headingDeg) % 360);
    f.headingPoint.set(compassPoint(snapshot.headingRad));
    f.speed.set(Math.round(Math.max(0, snapshot.speedKnots) * 10));

    const localMs = snapshot.epochMs + offsetMs;
    f.clock.set(Math.floor(localMs / 60000));
    f.date.set(Math.floor(localMs / 86400000));

    f.sunAltitude.set(Math.round(snapshot.sunAltitudeDeg * 10));
    f.sunrise.set(local(snapshot.sunriseMs));
    f.sunset.set(local(snapshot.sunsetMs));
    f.moonAltitude.set(Math.round(snapshot.moonAltitudeDeg * 10));
    f.moonrise.set(local(snapshot.moonriseMs));
    f.moonset.set(local(snapshot.moonsetMs));

    f.moonPath.set(Math.round(clamp01(snapshot.moonIlluminatedFraction) * 1000));
    f.moonLimb.set(Math.round(wrapTurn(snapshot.moonBrightLimbAngle) * RAD_TO_DEG * 2));
    f.moonNorth.set(Math.round(wrapTurn(snapshot.moonNorthAngle) * RAD_TO_DEG * 2));
    f.moonPhase.set(snapshot.moonPhase.replace(/-/g, ' '));

    f.pressure.set(Math.round(snapshot.pressureHpa));
    const trend = snapshot.pressureTrendHpaPerHour;
    f.trendValue.set(Math.round(trend * 10));
    // Half a hectopascal an hour is the classic threshold for a barometer that is doing
    // something rather than breathing, so below it the mark reads flat.
    f.trendArrow.set(trend > 0.5 ? RISING_ARROW : trend < -0.5 ? FALLING_ARROW : STEADY_ARROW);
    f.trendFalling.set(trend < -0.5);

    const knots = snapshot.windSpeed * MS_TO_KNOTS;
    f.windSpeed.set(Math.round(knots));
    f.beaufort.set(Math.round(snapshot.beaufort));
    f.windStrong.set(snapshot.beaufort >= 7);
    const relative = snapshot.windDirectionRad - snapshot.headingRad;
    f.windArrow.set(Math.round(wrapTurn(relative) * RAD_TO_DEG));
    f.windFrom.set(`${compassPoint(snapshot.windDirectionRad + Math.PI)} · ${windBearingLabel(relative + Math.PI)}`);

    const tension = clamp01(snapshot.lineTension);
    f.tensionLive.set(snapshot.hooked);
    if (snapshot.hooked) {
      f.tensionFill.set(Math.round(tension * 1000));
      f.tensionStrained.set(tension >= 0.6 && tension < STRAIN_MARK);
      f.tensionParting.set(tension >= STRAIN_MARK);
    }

    f.stormLive.set(snapshot.stormApproaching);
    if (snapshot.stormApproaching) f.stormDetail.set(Math.round(snapshot.stormMinutesAway));
  }

  dispose(): void {
    this.root.remove();
  }
}

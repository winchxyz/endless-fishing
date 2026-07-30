import { MS_PER_DAY, RAD_TO_DEG, astroTime } from './AstroTime.js';
import type { GeoLocation } from './Coordinates.js';
import { lunarPosition } from './LunarPosition.js';
import {
  ASTRONOMICAL_TWILIGHT_DEG,
  CIVIL_TWILIGHT_DEG,
  NAUTICAL_TWILIGHT_DEG,
  SUNSET_ALTITUDE_DEG,
  solarPosition,
} from './SolarPosition.js';

/**
 * Rise, set and twilight times.
 *
 * Solved numerically rather than with the closed-form hour-angle equation. That equation
 * assumes the body's declination is constant across the day, which is fine for the Sun and
 * quite wrong for the Moon — the Moon moves 13° a day, which is why it rises roughly 50
 * minutes later each night and why some days have no moonrise at all. A coarse scan for a
 * sign change followed by a secant refinement handles both bodies with the same code, copes
 * with the polar cases where a body never rises or never sets, and costs about 100 position
 * evaluations for a whole day — a few hundred microseconds, once per day, off the hot path.
 */

export interface RiseSetTimes {
  /** UTC epoch ms, or null when the event does not occur on this day. */
  rise: number | null;
  set: number | null;
  /** True when the body is above the target altitude for the entire day. */
  alwaysUp: boolean;
  /** True when the body never reaches the target altitude. */
  alwaysDown: boolean;
}

export interface DayEvents {
  sunrise: number | null;
  sunset: number | null;
  solarNoon: number;
  civilDawn: number | null;
  civilDusk: number | null;
  nauticalDawn: number | null;
  nauticalDusk: number | null;
  astronomicalDawn: number | null;
  astronomicalDusk: number | null;
  moonrise: number | null;
  moonset: number | null;
}

/** Samples per day for the coarse scan. 144 = one every ten minutes. */
const SCAN_STEPS = 144;
const REFINE_ITERATIONS = 24;

type AltitudeFn = (epochMs: number) => number;

function sunAltitudeDegAt(location: GeoLocation): AltitudeFn {
  return (epochMs) => solarPosition(astroTime(epochMs), location).horizontal.altitude * RAD_TO_DEG;
}

/**
 * The Moon's rise threshold is not a constant, and which altitude it applies to matters.
 *
 * The familiar textbook value h₀ = 0.7275·π − 34′ is a *geocentric* threshold: the 0.7275·π
 * term is the parallax correction (π minus the 0.2725·π semidiameter) folded in, precisely so
 * that it can be compared against a geocentric altitude. We already compute a topocentric
 * altitude, so reusing that number would apply the parallax twice — worth about 0.9° of
 * altitude, which is four minutes of moonrise, and exactly the discrepancy that showed up
 * against the USNO tables.
 *
 * Against a topocentric altitude the threshold is simply "upper limb on the refracted
 * horizon": −(semidiameter + 34′), with the semidiameter varying between apogee and perigee.
 */
function moonAltitudeExcessDegAt(location: GeoLocation): AltitudeFn {
  return (epochMs) => {
    const moon = lunarPosition(astroTime(epochMs), location);
    const semidiameterDeg = moon.angularRadius * RAD_TO_DEG;
    const thresholdDeg = -(semidiameterDeg + 34 / 60);
    return moon.horizontal.altitude * RAD_TO_DEG - thresholdDeg;
  };
}

/**
 * UTC instant of local *solar* midnight for the day containing `epochMs`.
 *
 * Deliberately not the machine's calendar day. The player can put the boat at any longitude
 * they like — the settings panel exposes manual coordinates — and a search window anchored on
 * the browser's timezone would then straddle the wrong solar day and return a sunset that
 * precedes its own sunrise. Anchoring on local mean solar time guarantees the window contains
 * exactly one solar noon, with the rise before it and the set after it, everywhere on Earth.
 */
export function startOfLocalDay(epochMs: number, longitudeDeg: number): number {
  const solarOffsetMs = (longitudeDeg / 15) * 3600000;
  const localSolarMs = epochMs + solarOffsetMs;
  return Math.floor(localSolarMs / MS_PER_DAY) * MS_PER_DAY - solarOffsetMs;
}

/**
 * Find every crossing of `targetDeg` in a 24-hour window and return the first rise (upward
 * crossing) and the first set (downward crossing).
 */
function findCrossings(
  altitudeAt: AltitudeFn,
  dayStartMs: number,
  targetDeg: number,
): RiseSetTimes {
  const step = MS_PER_DAY / SCAN_STEPS;
  let previousTime = dayStartMs;
  let previousValue = altitudeAt(previousTime) - targetDeg;

  let rise: number | null = null;
  let set: number | null = null;
  let sawAbove = previousValue > 0;
  let sawBelow = previousValue <= 0;

  for (let i = 1; i <= SCAN_STEPS; i += 1) {
    const time = dayStartMs + i * step;
    const value = altitudeAt(time) - targetDeg;
    if (value > 0) sawAbove = true;
    else sawBelow = true;

    if (previousValue <= 0 && value > 0 && rise === null) {
      rise = refine(altitudeAt, targetDeg, previousTime, time);
    } else if (previousValue > 0 && value <= 0 && set === null) {
      set = refine(altitudeAt, targetDeg, previousTime, time);
    }

    previousTime = time;
    previousValue = value;
  }

  return { rise, set, alwaysUp: sawAbove && !sawBelow, alwaysDown: sawBelow && !sawAbove };
}

/** Bisection on a bracketed crossing. Converges to well under a second in 24 iterations. */
function refine(
  altitudeAt: AltitudeFn,
  targetDeg: number,
  lowMs: number,
  highMs: number,
): number {
  let low = lowMs;
  let high = highMs;
  const lowValue = altitudeAt(low) - targetDeg;

  for (let i = 0; i < REFINE_ITERATIONS; i += 1) {
    const mid = (low + high) / 2;
    const midValue = altitudeAt(mid) - targetDeg;
    if (midValue === 0) return mid;
    if (lowValue < 0 === midValue < 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

export function sunRiseSet(
  location: GeoLocation,
  epochMs: number,
  targetDeg = SUNSET_ALTITUDE_DEG,
): RiseSetTimes {
  const dayStart = startOfLocalDay(epochMs, location.longitudeDeg);
  return findCrossings(sunAltitudeDegAt(location), dayStart, targetDeg);
}

export function moonRiseSet(location: GeoLocation, epochMs: number): RiseSetTimes {
  const dayStart = startOfLocalDay(epochMs, location.longitudeDeg);
  return findCrossings(moonAltitudeExcessDegAt(location), dayStart, 0);
}

/** Local apparent noon — when the Sun crosses the meridian. */
export function solarNoon(location: GeoLocation, epochMs: number): number {
  const dayStart = startOfLocalDay(epochMs, location.longitudeDeg);
  const altitudeAt = sunAltitudeDegAt(location);

  // Golden-section search for the maximum; the altitude curve is unimodal across a day.
  let low = dayStart;
  let high = dayStart + MS_PER_DAY;
  const phi = (Math.sqrt(5) - 1) / 2;
  let c = high - phi * (high - low);
  let d = low + phi * (high - low);

  for (let i = 0; i < 40; i += 1) {
    if (altitudeAt(c) > altitudeAt(d)) high = d;
    else low = c;
    c = high - phi * (high - low);
    d = low + phi * (high - low);
  }
  return (low + high) / 2;
}

/** Everything the HUD needs for one local day, computed in one pass. */
export function dayEvents(location: GeoLocation, epochMs: number): DayEvents {
  const dayStart = startOfLocalDay(epochMs, location.longitudeDeg);
  const sunAltitude = sunAltitudeDegAt(location);

  const sun = findCrossings(sunAltitude, dayStart, SUNSET_ALTITUDE_DEG);
  const civil = findCrossings(sunAltitude, dayStart, CIVIL_TWILIGHT_DEG);
  const nautical = findCrossings(sunAltitude, dayStart, NAUTICAL_TWILIGHT_DEG);
  const astronomical = findCrossings(sunAltitude, dayStart, ASTRONOMICAL_TWILIGHT_DEG);
  const moon = findCrossings(moonAltitudeExcessDegAt(location), dayStart, 0);

  return {
    sunrise: sun.rise,
    sunset: sun.set,
    solarNoon: solarNoon(location, epochMs),
    civilDawn: civil.rise,
    civilDusk: civil.set,
    nauticalDawn: nautical.rise,
    nauticalDusk: nautical.set,
    astronomicalDawn: astronomical.rise,
    astronomicalDusk: astronomical.set,
    moonrise: moon.rise,
    moonset: moon.set,
  };
}

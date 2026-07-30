/**
 * Time scales.
 *
 * Three clocks matter here and confusing them is the classic way to be a minute of arc wrong:
 *
 *   UT1  — Earth rotation angle. Drives sidereal time, and therefore hour angle.
 *   TT   — a uniform dynamical scale. Drives the orbital theories (the sun and moon series).
 *   ΔT   — TT − UT1. Currently about 69 s, and not predictable from first principles, so it
 *          comes from an observed table with an extrapolation beyond it.
 *
 * We treat the system clock as UT1 (the difference, |UT1 − UTC| < 0.9 s, is far below our
 * tolerance) and derive TT from it. Everything downstream takes a `JulianDate`, never a
 * `Date`, so an overridden timestamp behaves identically to a live one.
 *
 * References: Meeus, *Astronomical Algorithms*, 2nd ed., ch. 7 and ch. 10;
 * Espenak & Meeus, *Five Millennium Canon of Solar Eclipses*, ΔT polynomial expressions.
 */

/** Julian Day number for the J2000.0 epoch, 2000 January 1.5 TT. */
export const J2000 = 2451545.0;
export const DAYS_PER_JULIAN_CENTURY = 36525;
export const MS_PER_DAY = 86400000;

export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;
/** Arcseconds to radians. Nutation and aberration are quoted in arcseconds. */
export const ARCSEC_TO_RAD = Math.PI / (180 * 3600);

export interface JulianDate {
  /** Julian Day in UT1 — use for anything to do with Earth's rotation. */
  jd: number;
  /** Julian Ephemeris Day (TT) — use for orbital theories. */
  jde: number;
  /** Julian centuries of TT since J2000.0. The `T` of every Meeus series. */
  T: number;
  /** UTC milliseconds this was derived from, carried through for the HUD. */
  epochMs: number;
}

/**
 * Observed ΔT in seconds at the start of each listed year.
 *
 * From the IERS/USNO series as tabulated by Espenak. Earth's rotation is not predictable, so
 * this is measurement, not theory — which is exactly why it is a table and not a formula.
 * Values after 2024 are the published short-term projection.
 */
const DELTA_T_TABLE: ReadonlyArray<readonly [year: number, seconds: number]> = [
  [1960, 33.2], [1962, 34.0], [1964, 35.0], [1966, 36.5], [1968, 38.3], [1970, 40.2],
  [1972, 42.2], [1974, 44.5], [1976, 46.5], [1978, 48.5], [1980, 50.5], [1982, 52.2],
  [1984, 53.8], [1986, 54.9], [1988, 55.8], [1990, 56.9], [1992, 58.3], [1994, 60.0],
  [1996, 61.6], [1998, 63.0], [2000, 63.8], [2002, 64.3], [2004, 64.6], [2006, 64.8],
  [2008, 65.5], [2010, 66.1], [2012, 66.7], [2014, 67.3], [2016, 68.1], [2018, 68.9],
  [2020, 69.4], [2022, 69.3], [2024, 69.2], [2026, 69.2], [2028, 69.3], [2030, 69.5],
];

/** ΔT = TT − UT1, in seconds, for a decimal year. */
export function deltaTSeconds(decimalYear: number): number {
  const first = DELTA_T_TABLE[0];
  const last = DELTA_T_TABLE[DELTA_T_TABLE.length - 1];
  if (first === undefined || last === undefined) return 69;

  if (decimalYear >= first[0] && decimalYear <= last[0]) {
    for (let i = 0; i < DELTA_T_TABLE.length - 1; i += 1) {
      const a = DELTA_T_TABLE[i];
      const b = DELTA_T_TABLE[i + 1];
      if (a === undefined || b === undefined) break;
      if (decimalYear >= a[0] && decimalYear <= b[0]) {
        const t = (decimalYear - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * t;
      }
    }
  }

  // Outside the observed range, fall back to the Espenak & Meeus polynomial expressions.
  if (decimalYear > last[0]) {
    if (decimalYear <= 2150) {
      const u = (decimalYear - 1820) / 100;
      return -20 + 32 * u * u - 0.5628 * (2150 - decimalYear);
    }
    const u = (decimalYear - 1820) / 100;
    return -20 + 32 * u * u;
  }
  if (decimalYear >= 1900) {
    const t = (decimalYear - 1900) / 100;
    return (
      -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t ** 3 - 0.000197 * t ** 4
    ) * 100;
  }
  const u = (decimalYear - 1820) / 100;
  return -20 + 32 * u * u;
}

/** Julian Day from a UTC epoch in milliseconds. Exact — no calendar arithmetic needed. */
export function julianDayFromEpochMs(epochMs: number): number {
  // The Unix epoch, 1970-01-01T00:00:00Z, is JD 2440587.5.
  return epochMs / MS_PER_DAY + 2440587.5;
}

export function epochMsFromJulianDay(jd: number): number {
  return (jd - 2440587.5) * MS_PER_DAY;
}

/**
 * Julian Day from a calendar date in UTC (Meeus 7.1). Gregorian calendar only, which covers
 * every date this game can be pointed at.
 */
export function julianDayFromUTC(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  const dayFraction = (hour + minute / 60 + second / 3600) / 24;
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    dayFraction +
    b -
    1524.5
  );
}

/** Approximate decimal year from a Julian Day. Only ever feeds the ΔT lookup. */
export function decimalYearFromJulianDay(jd: number): number {
  return 2000 + (jd - J2000) / 365.25;
}

/** Build the full time bundle every astronomy function consumes. */
export function astroTime(epochMs: number): JulianDate {
  const jd = julianDayFromEpochMs(epochMs);
  const deltaT = deltaTSeconds(decimalYearFromJulianDay(jd));
  const jde = jd + deltaT / 86400;
  return { jd, jde, T: (jde - J2000) / DAYS_PER_JULIAN_CENTURY, epochMs };
}

/** Normalise degrees to [0, 360). */
export function normalizeDegrees(degrees: number): number {
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Normalise radians to [0, 2π). */
export function normalizeRadians(radians: number): number {
  const twoPi = Math.PI * 2;
  const wrapped = radians % twoPi;
  return wrapped < 0 ? wrapped + twoPi : wrapped;
}

/** Shortest signed difference a − b, in radians, wrapped to (−π, π]. */
export function angleDelta(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

export const sinDeg = (degrees: number): number => Math.sin(degrees * DEG_TO_RAD);
export const cosDeg = (degrees: number): number => Math.cos(degrees * DEG_TO_RAD);
export const tanDeg = (degrees: number): number => Math.tan(degrees * DEG_TO_RAD);

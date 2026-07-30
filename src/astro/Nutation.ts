import { ARCSEC_TO_RAD, DEG_TO_RAD, cosDeg, normalizeDegrees, sinDeg } from './AstroTime.js';

/**
 * Nutation and the obliquity of the ecliptic (Meeus ch. 22).
 *
 * The abbreviated series: four terms in Δψ and four in Δε, good to about 0.5″ and 0.1″
 * respectively. That is two orders of magnitude inside our 0.1° tolerance, and the full
 * IAU 1980 63-term series would cost 60 extra evaluations per frame for a difference nobody
 * can see. Nutation matters here mainly because it shifts apparent sidereal time, and
 * therefore the hour angle of everything.
 */

export interface Nutation {
  /** Nutation in longitude, radians. */
  deltaPsi: number;
  /** Nutation in obliquity, radians. */
  deltaEpsilon: number;
  /** Mean obliquity of the ecliptic, radians. */
  meanObliquity: number;
  /** True obliquity = mean + Δε, radians. */
  trueObliquity: number;
}

export function nutation(T: number): Nutation {
  // Longitude of the ascending node of the Moon's mean orbit on the ecliptic.
  const omega = normalizeDegrees(125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000);
  // Mean longitudes of the Sun and Moon.
  const L = normalizeDegrees(280.4665 + 36000.7698 * T);
  const LPrime = normalizeDegrees(218.3165 + 481267.8813 * T);

  const deltaPsiArcsec =
    -17.2 * sinDeg(omega) -
    1.32 * sinDeg(2 * L) -
    0.23 * sinDeg(2 * LPrime) +
    0.21 * sinDeg(2 * omega);

  const deltaEpsilonArcsec =
    9.2 * cosDeg(omega) +
    0.57 * cosDeg(2 * L) +
    0.1 * cosDeg(2 * LPrime) -
    0.09 * cosDeg(2 * omega);

  const deltaPsi = deltaPsiArcsec * ARCSEC_TO_RAD;
  const deltaEpsilon = deltaEpsilonArcsec * ARCSEC_TO_RAD;
  const meanObliquity = meanObliquityRad(T);

  return {
    deltaPsi,
    deltaEpsilon,
    meanObliquity,
    trueObliquity: meanObliquity + deltaEpsilon,
  };
}

/**
 * Mean obliquity ε₀ (Meeus 22.2), the higher-accuracy polynomial in units of 10 000 Julian
 * years. Accurate to 0.01″ over ±1000 years from J2000, against 1″ for the short form.
 */
export function meanObliquityRad(T: number): number {
  const U = T / 100;
  // Written out term by term rather than in Horner form: the coefficient signs alternate
  // irregularly and a nested rewrite is a very easy place to hide a sign error.
  const arcsec =
    21.448 -
    4680.93 * U -
    1.55 * U ** 2 +
    1999.25 * U ** 3 -
    51.38 * U ** 4 -
    249.67 * U ** 5 -
    39.05 * U ** 6 +
    7.12 * U ** 7 +
    27.87 * U ** 8 +
    5.79 * U ** 9 +
    2.45 * U ** 10;
  return (23 + (26 + arcsec / 60) / 60) * DEG_TO_RAD;
}

import { DEG_TO_RAD, J2000, normalizeDegrees, normalizeRadians } from './AstroTime.js';
import { nutation } from './Nutation.js';

/**
 * Sidereal time (Meeus ch. 12).
 *
 * This is the hinge of the whole star field: it converts "where the Earth is pointed right
 * now" into the rotation that carries right ascension into an hour angle. Get it wrong and
 * every constellation is in the wrong place by a predictable, embarrassing amount.
 *
 * Note that it is computed from UT, not TT — it measures Earth's rotation, not dynamical
 * time. Passing `jde` here would put the whole sky about 69 s of rotation out of place.
 */

/** Greenwich Mean Sidereal Time in radians, from a Julian Day in UT. */
export function greenwichMeanSiderealTime(jd: number): number {
  const T = (jd - J2000) / 36525;
  const degrees =
    280.46061837 +
    360.98564736629 * (jd - J2000) +
    0.000387933 * T * T -
    (T * T * T) / 38710000;
  return normalizeDegrees(degrees) * DEG_TO_RAD;
}

/**
 * Greenwich Apparent Sidereal Time in radians — GMST corrected for nutation (the equation of
 * the equinoxes). Worth the extra term: Δψ reaches ±17″, and we are matching star positions
 * against a catalogue.
 */
export function greenwichApparentSiderealTime(jd: number, T: number): number {
  const { deltaPsi, trueObliquity } = nutation(T);
  return normalizeRadians(greenwichMeanSiderealTime(jd) + deltaPsi * Math.cos(trueObliquity));
}

/** Local Apparent Sidereal Time in radians. Longitude is east-positive. */
export function localSiderealTime(jd: number, T: number, longitudeDeg: number): number {
  return normalizeRadians(greenwichApparentSiderealTime(jd, T) + longitudeDeg * DEG_TO_RAD);
}

/** Hour angle in radians, wrapped to (−π, π]. Negative means the body is still rising. */
export function hourAngle(localSiderealTimeRad: number, rightAscensionRad: number): number {
  let h = localSiderealTimeRad - rightAscensionRad;
  const twoPi = Math.PI * 2;
  h %= twoPi;
  if (h > Math.PI) h -= twoPi;
  if (h <= -Math.PI) h += twoPi;
  return h;
}

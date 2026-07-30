import {
  DEG_TO_RAD,
  cosDeg,
  normalizeDegrees,
  normalizeRadians,
  sinDeg,
  type JulianDate,
} from './AstroTime.js';
import { nutation } from './Nutation.js';
import { equatorialToHorizontal, type EquatorialCoords, type GeoLocation, type HorizontalCoords } from './Coordinates.js';
import { localSiderealTime, hourAngle } from './SiderealTime.js';
import { applyRefraction, type AtmosphereConditions } from './Refraction.js';

/**
 * Solar position — the NOAA algorithm, which is Meeus ch. 25 ("low accuracy", meaning 0.01°)
 * with the aberration and nutation corrections that make it apparent rather than geometric.
 *
 * Accuracy against the JPL ephemeris is better than 0.01° for 1800–2100, comfortably inside
 * the 0.05° the brief asks for. Every visual decision in the game keys off `altitude` here:
 * twilight phase, exposure, colour grade, when the navigation lights come on, when the fish
 * bite. There is no hand-authored time-of-day curve anywhere.
 */

/** Mean solar radius as seen from 1 AU, in radians. 959.63″. */
const SOLAR_ANGULAR_RADIUS_AT_1AU = 959.63 * (Math.PI / (180 * 3600));

/** Solar illuminance at the top of the atmosphere, normal incidence, at 1 AU. */
export const SOLAR_CONSTANT_LUX = 133000;

export interface SolarPosition {
  /** Apparent geocentric ecliptic longitude, radians. */
  apparentLongitude: number;
  equatorial: EquatorialCoords;
  /** Geometric altitude and azimuth — no refraction. */
  horizontal: HorizontalCoords;
  /** Altitude as actually seen, refraction applied. This is the one the visuals use. */
  apparentAltitude: number;
  /** Angular radius of the disc, radians. Varies ±1.7% over the year. */
  angularRadius: number;
  /** Earth–Sun distance in astronomical units. */
  distanceAu: number;
  /** Equation of time in minutes: apparent solar time minus mean solar time. */
  equationOfTimeMinutes: number;
  /** Hour angle, radians. Negative before local apparent noon. */
  hourAngle: number;
}

export function solarPosition(
  time: JulianDate,
  location: GeoLocation,
  conditions?: AtmosphereConditions,
): SolarPosition {
  const { T } = time;

  // Geometric mean longitude and mean anomaly, degrees.
  const L0 = normalizeDegrees(280.46646 + T * (36000.76983 + T * 0.0003032));
  const M = normalizeDegrees(357.52911 + T * (35999.05029 - 0.0001537 * T));
  // Eccentricity of Earth's orbit.
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);

  // Equation of the centre.
  const C =
    sinDeg(M) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    sinDeg(2 * M) * (0.019993 - 0.000101 * T) +
    sinDeg(3 * M) * 0.000289;

  const trueLongitude = L0 + C;
  const trueAnomaly = M + C;

  // Radius vector, AU (Meeus 25.5).
  const distanceAu = (1.000001018 * (1 - e * e)) / (1 + e * cosDeg(trueAnomaly));

  // Apparent longitude: correct for nutation in longitude and for aberration.
  // The classic NOAA form folds both into two terms; the −0.00569° is aberration at 1 AU.
  const omega = 125.04 - 1934.136 * T;
  const apparentLongitudeDeg = trueLongitude - 0.00569 - 0.00478 * sinDeg(omega);
  const apparentLongitude = normalizeRadians(apparentLongitudeDeg * DEG_TO_RAD);

  // Obliquity, with the same small correction NOAA applies.
  const { meanObliquity } = nutation(T);
  const obliquity = meanObliquity + 0.00256 * DEG_TO_RAD * cosDeg(omega);

  const sinLambda = Math.sin(apparentLongitude);
  const cosLambda = Math.cos(apparentLongitude);
  const rightAscension = normalizeRadians(Math.atan2(Math.cos(obliquity) * sinLambda, cosLambda));
  const declination = Math.asin(Math.sin(obliquity) * sinLambda);

  const lst = localSiderealTime(time.jd, T, location.longitudeDeg);
  const H = hourAngle(lst, rightAscension);
  const horizontal = equatorialToHorizontal(declination, H, location.latitudeDeg);

  // Equation of time (Meeus 28.3), in minutes.
  const y = Math.tan(obliquity / 2) ** 2;
  const eotRadians =
    y * sinDeg(2 * L0) -
    2 * e * sinDeg(M) +
    4 * e * y * sinDeg(M) * cosDeg(2 * L0) -
    0.5 * y * y * sinDeg(4 * L0) -
    1.25 * e * e * sinDeg(2 * M);

  return {
    apparentLongitude,
    equatorial: { rightAscension, declination, distance: distanceAu },
    horizontal,
    apparentAltitude: applyRefraction(horizontal.altitude, conditions),
    angularRadius: SOLAR_ANGULAR_RADIUS_AT_1AU / distanceAu,
    distanceAu,
    equationOfTimeMinutes: (eotRadians * 4 * 180) / Math.PI,
    hourAngle: H,
  };
}

/**
 * Twilight bands, defined by the *geometric* solar altitude as the standards define them.
 *
 * These are not stylistic buckets. Every atmosphere, exposure and grading transition in the
 * game is a continuous function of solar altitude; this classification exists so the HUD can
 * name what the player is looking at, and so the tests can assert the boundaries.
 */
export type TwilightPhase =
  | 'day'
  | 'golden-hour'
  | 'civil-twilight'
  | 'nautical-twilight'
  | 'astronomical-twilight'
  | 'night';

/** Sunset/sunrise: the geometric altitude at which the upper limb touches the horizon. */
export const SUNSET_ALTITUDE_DEG = -0.833;
export const CIVIL_TWILIGHT_DEG = -6;
export const NAUTICAL_TWILIGHT_DEG = -12;
export const ASTRONOMICAL_TWILIGHT_DEG = -18;
export const GOLDEN_HOUR_UPPER_DEG = 6;

export function twilightPhase(altitudeDeg: number): TwilightPhase {
  if (altitudeDeg > GOLDEN_HOUR_UPPER_DEG) return 'day';
  if (altitudeDeg > SUNSET_ALTITUDE_DEG) return 'golden-hour';
  if (altitudeDeg > CIVIL_TWILIGHT_DEG) return 'civil-twilight';
  if (altitudeDeg > NAUTICAL_TWILIGHT_DEG) return 'nautical-twilight';
  if (altitudeDeg > ASTRONOMICAL_TWILIGHT_DEG) return 'astronomical-twilight';
  return 'night';
}

/**
 * Direct solar illuminance on a surface normal to the beam, in lux.
 *
 * Extinction through the atmosphere using a Kasten–Young air mass, which stays finite at the
 * horizon where the naive 1/sin(h) blows up. Returns 0 once the disc is fully set. This is
 * what drives the sun light's intensity — the falloff through twilight is the physical one,
 * not an artist curve.
 */
export function solarIlluminanceLux(apparentAltitudeRad: number, distanceAu: number): number {
  const altitudeDeg = (apparentAltitudeRad * 180) / Math.PI;
  if (altitudeDeg < -0.9) return 0;

  const airMass =
    1 / (Math.sin(apparentAltitudeRad) + 0.50572 * (altitudeDeg + 6.07995) ** -1.6364);
  // Broadband atmospheric transmittance for a clear sky, ~0.7 per air mass at sea level.
  const transmittance = 0.7 ** airMass ** 0.678;
  const inverseSquare = 1 / (distanceAu * distanceAu);
  return SOLAR_CONSTANT_LUX * inverseSquare * transmittance * Math.max(0, Math.sin(apparentAltitudeRad));
}

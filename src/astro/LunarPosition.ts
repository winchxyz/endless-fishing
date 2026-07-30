import {
  ARCSEC_TO_RAD,
  DEG_TO_RAD,
  RAD_TO_DEG,
  cosDeg,
  normalizeDegrees,
  normalizeRadians,
  sinDeg,
  type JulianDate,
} from './AstroTime.js';
import { nutation } from './Nutation.js';
import {
  angularSeparation,
  eclipticToEquatorial,
  equatorialToHorizontal,
  type EquatorialCoords,
  type GeoLocation,
  type HorizontalCoords,
} from './Coordinates.js';
import { hourAngle, localSiderealTime } from './SiderealTime.js';
import { applyRefraction, type AtmosphereConditions } from './Refraction.js';
import { solarPosition } from './SolarPosition.js';

/**
 * Lunar position — truncated ELP-2000/82, as tabulated by Meeus, *Astronomical Algorithms*,
 * 2nd ed., ch. 47 (tables 47.A and 47.B).
 *
 * Sixty periodic terms in longitude and distance, sixty in latitude. Accuracy is about 10″ in
 * longitude and 4″ in latitude — around 0.003°, well inside the 0.3° the brief allows and, more
 * to the point, well inside what the eye can check against the real sky.
 *
 * Three things here are what make a moon look *real* rather than like a sprite:
 *
 *   1. **Topocentric parallax.** The Moon is close enough that an observer on the surface sees
 *      it up to ~1° away from where a geocentric calculation puts it. Skipping this is the most
 *      common way a "correct" moon ends up visibly wrong near the horizon.
 *   2. **Position angle of the bright limb, converted to screen space** via the parallactic
 *      angle. This is what decides which way a crescent tips, and it is the single clearest
 *      tell that a sky is simulated rather than drawn.
 *   3. **Varying angular diameter**, 0.49°–0.56° between apogee and perigee.
 */

/** Equatorial radius of the Earth, km. */
const EARTH_RADIUS_KM = 6378.14;
/** Flattening ratio b/a for the reference ellipsoid. */
const EARTH_POLAR_RATIO = 0.99664719;
/** Astronomical unit in km, for the Sun–Moon geometry. */
const AU_KM = 149597870.7;

/**
 * Table 47.A — periodic terms for the Moon's longitude (Σl) and distance (Σr).
 * Columns: D, M, M′, F, coefficient of sine for Σl (10⁻⁶ deg), coefficient of cosine for Σr (10⁻³ km).
 */
const TERMS_LR: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
  [0, 0, 1, 0, 6288774, -20905355],
  [2, 0, -1, 0, 1274027, -3699111],
  [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925],
  [0, 1, 0, 0, -185116, 48888],
  [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158],
  [2, -1, -1, 0, 57066, -152138],
  [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586],
  [0, 1, -1, 0, -40923, -129620],
  [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755],
  [2, 0, 0, -2, 15327, 10321],
  [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661],
  [4, 0, -1, 0, 10675, -34782],
  [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636],
  [2, 1, -1, 0, -7888, 24208],
  [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379],
  [1, 1, 0, 0, 4987, -16675],
  [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445],
  [4, 0, 0, 0, 3861, -11650],
  [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003],
  [2, 0, -1, 2, -2602, 0],
  [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322],
  [2, -2, 0, 0, 2236, -9884],
  [0, 1, 2, 0, -2120, 5751],
  [0, 2, 0, 0, -2069, 0],
  [2, -2, -1, 0, 2048, -4950],
  [2, 0, 1, -2, -1773, 4130],
  [2, 0, 0, 2, -1595, 0],
  [4, -1, -1, 0, 1215, -3958],
  [0, 0, 2, 2, -1110, 0],
  [3, 0, -1, 0, -892, 3258],
  [2, 1, 1, 0, -810, 2616],
  [4, -1, -2, 0, 759, -1897],
  [0, 2, -1, 0, -713, -2117],
  [2, 2, -1, 0, -700, 2354],
  [2, 1, -2, 0, 691, 0],
  [2, -1, 0, -2, 596, 0],
  [4, 0, 1, 0, 549, -1423],
  [0, 0, 4, 0, 537, -1117],
  [4, -1, 0, 0, 520, -1571],
  [1, 0, -2, 0, -487, -1739],
  [2, 1, 0, -2, -399, 0],
  [0, 0, 2, -2, -381, -4421],
  [1, 1, 1, 0, 351, 0],
  [3, 0, -2, 0, -340, 0],
  [4, 0, -3, 0, 330, 0],
  [2, -1, 2, 0, 327, 0],
  [0, 2, 1, 0, -323, 1165],
  [1, 1, -1, 0, 299, 0],
  [2, 0, 3, 0, 294, 0],
  [2, 0, -1, -2, 0, 8752],
];

/**
 * Table 47.B — periodic terms for the Moon's ecliptic latitude (Σb).
 * Columns: D, M, M′, F, coefficient of sine (10⁻⁶ deg).
 */
const TERMS_B: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [0, 0, 0, 1, 5128122],
  [0, 0, 1, 1, 280602],
  [0, 0, 1, -1, 277693],
  [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413],
  [2, 0, -1, -1, 46271],
  [2, 0, 0, 1, 32573],
  [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266],
  [0, 0, 2, -1, 8822],
  [2, -1, 0, -1, 8216],
  [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200],
  [2, 1, 0, -1, -3359],
  [2, -1, -1, 1, 2463],
  [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065],
  [0, 1, -1, -1, -1870],
  [4, 0, -1, -1, 1828],
  [0, 1, 0, 1, -1794],
  [0, 0, 0, 3, -1749],
  [0, 1, -1, 1, -1565],
  [1, 0, 0, 1, -1491],
  [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410],
  [0, 1, 0, -1, -1344],
  [1, 0, 0, -1, -1335],
  [0, 0, 3, 1, 1107],
  [4, 0, 0, -1, 1021],
  [4, 0, -1, 1, 833],
  [0, 0, 1, -3, 777],
  [4, 0, -2, 1, 671],
  [2, 0, 0, -3, 607],
  [2, 0, 2, -1, 596],
  [2, -1, 1, -1, 491],
  [2, 0, -2, 1, -451],
  [0, 0, 3, -1, 439],
  [2, 0, 2, 1, 422],
  [2, 0, -3, -1, 421],
  [2, 1, -1, 1, -366],
  [2, 1, 0, 1, -351],
  [4, 0, 0, 1, 331],
  [2, -1, 1, 1, 315],
  [2, -2, 0, -1, 302],
  [0, 0, 1, 3, -283],
  [2, 1, 1, -1, -229],
  [1, 1, 0, -1, 223],
  [1, 1, 0, 1, 223],
  [0, 1, -2, -1, -220],
  [2, 1, -1, -1, -220],
  [1, 0, 1, 1, -185],
  [2, -1, -2, -1, 181],
  [0, 1, 2, 1, -177],
  [4, 0, -2, -1, 176],
  [4, -1, -1, -1, 166],
  [1, 0, 1, -1, -164],
  [4, 0, 1, -1, 132],
  [1, 0, -1, -1, -119],
  [4, -1, 0, -1, 115],
  [2, -2, 0, 1, 107],
];

export type MoonPhaseName =
  | 'new'
  | 'waxing-crescent'
  | 'first-quarter'
  | 'waxing-gibbous'
  | 'full'
  | 'waning-gibbous'
  | 'last-quarter'
  | 'waning-crescent';

export interface LunarPosition {
  /** Geocentric apparent equatorial position. */
  equatorial: EquatorialCoords;
  /** Topocentric equatorial position — corrected for the observer's offset from Earth's centre. */
  topocentric: EquatorialCoords;
  /** Geometric altitude and azimuth from the topocentric position. */
  horizontal: HorizontalCoords;
  /** Altitude as seen, refraction applied. */
  apparentAltitude: number;
  /** Angular radius of the disc, radians. 0.0043–0.0049 (0.49°–0.56° across). */
  angularRadius: number;
  /** Earth–Moon distance, km. */
  distanceKm: number;
  /** Equatorial horizontal parallax, radians. */
  parallax: number;
  /** Sun–Earth–Moon phase angle, radians. 0 = full, π = new. */
  phaseAngle: number;
  /** Illuminated fraction of the disc, 0..1. */
  illuminatedFraction: number;
  /**
   * Position angle of the midpoint of the bright limb, radians, measured eastward from the
   * north celestial pole.
   */
  brightLimbAngle: number;
  /**
   * Bright-limb angle rotated into the observer's frame: 0 means the lit edge points straight
   * up on screen, increasing clockwise. This is what the moon material actually uses.
   */
  brightLimbScreenAngle: number;
  /** Parallactic angle, radians — the tilt between celestial north and the local vertical. */
  parallacticAngle: number;
  /** Age of the lunation in days, 0 at new moon. */
  ageDays: number;
  phaseName: MoonPhaseName;
  /** True while the illuminated fraction is increasing. */
  waxing: boolean;
  /** Sub-solar direction on the lunar surface, for shading the albedo texture. */
  sunDirection: { x: number; y: number; z: number };
}

/** Mean synodic month, days. */
export const SYNODIC_MONTH_DAYS = 29.530588853;

export function lunarPosition(
  time: JulianDate,
  location: GeoLocation,
  conditions?: AtmosphereConditions,
): LunarPosition {
  const { T } = time;
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;

  // Mean elements (Meeus 47.1 – 47.5), degrees.
  const Lp = normalizeDegrees(
    218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000,
  );
  const D = normalizeDegrees(
    297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000,
  );
  const M = normalizeDegrees(357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000);
  const Mp = normalizeDegrees(
    134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000,
  );
  const F = normalizeDegrees(
    93.272095 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000,
  );

  // Further arguments for the additive terms (Venus, Jupiter and the flattening of the Earth).
  const A1 = normalizeDegrees(119.75 + 131.849 * T);
  const A2 = normalizeDegrees(53.09 + 479264.29 * T);
  const A3 = normalizeDegrees(313.45 + 481266.484 * T);

  // Eccentricity correction: terms involving the Sun's anomaly are scaled because Earth's
  // orbital eccentricity is itself slowly changing.
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const E2 = E * E;

  let sumL = 0;
  let sumR = 0;
  for (const [d, m, mp, f, cl, cr] of TERMS_LR) {
    const argument = d * D + m * M + mp * Mp + f * F;
    const eccentricity = m === 0 ? 1 : Math.abs(m) === 1 ? E : E2;
    sumL += cl * eccentricity * sinDeg(argument);
    sumR += cr * eccentricity * cosDeg(argument);
  }

  let sumB = 0;
  for (const [d, m, mp, f, cb] of TERMS_B) {
    const argument = d * D + m * M + mp * Mp + f * F;
    const eccentricity = m === 0 ? 1 : Math.abs(m) === 1 ? E : E2;
    sumB += cb * eccentricity * sinDeg(argument);
  }

  // Additive terms (Meeus, p. 342).
  sumL += 3958 * sinDeg(A1) + 1962 * sinDeg(Lp - F) + 318 * sinDeg(A2);
  sumB +=
    -2235 * sinDeg(Lp) +
    382 * sinDeg(A3) +
    175 * sinDeg(A1 - F) +
    175 * sinDeg(A1 + F) +
    127 * sinDeg(Lp - Mp) -
    115 * sinDeg(Lp + Mp);

  const { deltaPsi, trueObliquity } = nutation(T);

  const longitude = normalizeRadians((Lp + sumL / 1000000) * DEG_TO_RAD + deltaPsi);
  const latitude = (sumB / 1000000) * DEG_TO_RAD;
  const distanceKm = 385000.56 + sumR / 1000;

  const equatorial = eclipticToEquatorial({ longitude, latitude, distance: distanceKm }, trueObliquity);

  // Equatorial horizontal parallax (Meeus 47.), then the topocentric correction (ch. 40).
  const parallax = Math.asin(EARTH_RADIUS_KM / distanceKm);
  const lst = localSiderealTime(time.jd, T, location.longitudeDeg);
  const geocentricHourAngle = hourAngle(lst, equatorial.rightAscension);
  const topocentric = toTopocentric(equatorial, geocentricHourAngle, parallax, location);

  const topoHourAngle = hourAngle(lst, topocentric.rightAscension);
  const horizontal = equatorialToHorizontal(
    topocentric.declination,
    topoHourAngle,
    location.latitudeDeg,
  );

  // Topocentric semidiameter: the disc is fractionally larger when it is overhead because the
  // observer is one Earth radius closer to it.
  const geocentricSemidiameter = (358473400 / distanceKm) * ARCSEC_TO_RAD;
  const angularRadius = geocentricSemidiameter * (1 + Math.sin(horizontal.altitude) * Math.sin(parallax));

  // --- Phase geometry (Meeus ch. 48) -------------------------------------------------------
  const sun = solarPosition(time, location, conditions);
  const sunDistanceKm = sun.distanceAu * AU_KM;

  const elongation = angularSeparation(
    sun.equatorial.rightAscension,
    sun.equatorial.declination,
    equatorial.rightAscension,
    equatorial.declination,
  );
  const phaseAngle = Math.atan2(
    sunDistanceKm * Math.sin(elongation),
    distanceKm - sunDistanceKm * Math.cos(elongation),
  );
  const illuminatedFraction = (1 + Math.cos(phaseAngle)) / 2;

  // Position angle of the bright limb (Meeus 48.5). Measured from the north celestial pole,
  // eastward. Uses the geocentric positions, which is the definition.
  const deltaRa = sun.equatorial.rightAscension - equatorial.rightAscension;
  const brightLimbAngle = normalizeRadians(
    Math.atan2(
      Math.cos(sun.equatorial.declination) * Math.sin(deltaRa),
      Math.sin(sun.equatorial.declination) * Math.cos(equatorial.declination) -
        Math.cos(sun.equatorial.declination) * Math.sin(equatorial.declination) * Math.cos(deltaRa),
    ),
  );

  // Parallactic angle (Meeus 14.1): the angle at the body between the direction to the
  // celestial pole and the direction to the zenith. Subtracting it from the bright-limb angle
  // is what turns a celestial quantity into the on-screen tilt of the crescent.
  const phi = location.latitudeDeg * DEG_TO_RAD;
  const parallacticAngle = Math.atan2(
    Math.sin(topoHourAngle),
    Math.tan(phi) * Math.cos(topocentric.declination) -
      Math.sin(topocentric.declination) * Math.cos(topoHourAngle),
  );

  // Age of the lunation, from the mean elongation. Good to a few hours, which is all the HUD
  // needs; the illuminated fraction above is the precise quantity.
  const ageDays = (normalizeDegrees(D) / 360) * SYNODIC_MONTH_DAYS;
  const waxing = normalizeDegrees(D) < 180;

  return {
    equatorial,
    topocentric,
    horizontal,
    apparentAltitude: applyRefraction(horizontal.altitude, conditions),
    angularRadius,
    distanceKm,
    parallax,
    phaseAngle,
    illuminatedFraction,
    brightLimbAngle,
    brightLimbScreenAngle: normalizeRadians(brightLimbAngle - parallacticAngle),
    parallacticAngle,
    ageDays,
    phaseName: classifyPhase(illuminatedFraction, waxing),
    waxing,
    sunDirection: subSolarDirection(phaseAngle, brightLimbAngle, parallacticAngle),
  };
}

/**
 * Geocentric → topocentric equatorial (Meeus 40.2).
 * `elevationM` is folded in through ρ, so an observer on a mountain gets a slightly different
 * moon than one at sea level. From a boat that is a fraction of an arcsecond, but the term
 * costs nothing and its absence would be a lie.
 */
function toTopocentric(
  equatorial: EquatorialCoords,
  hourAngleRad: number,
  parallax: number,
  location: GeoLocation,
): EquatorialCoords {
  const phi = location.latitudeDeg * DEG_TO_RAD;
  const u = Math.atan(EARTH_POLAR_RATIO * Math.tan(phi));
  const heightRatio = location.elevationM / (EARTH_RADIUS_KM * 1000);
  const rhoSinPhi = EARTH_POLAR_RATIO * Math.sin(u) + heightRatio * Math.sin(phi);
  const rhoCosPhi = Math.cos(u) + heightRatio * Math.cos(phi);

  const sinParallax = Math.sin(parallax);
  const cosDec = Math.cos(equatorial.declination);
  const sinDec = Math.sin(equatorial.declination);

  const denominator = cosDec - rhoCosPhi * sinParallax * Math.cos(hourAngleRad);
  const deltaRa = Math.atan2(-rhoCosPhi * sinParallax * Math.sin(hourAngleRad), denominator);
  const declination = Math.atan2((sinDec - rhoSinPhi * sinParallax) * Math.cos(deltaRa), denominator);

  return {
    rightAscension: normalizeRadians(equatorial.rightAscension + deltaRa),
    declination,
    distance: equatorial.distance,
  };
}

function classifyPhase(illuminatedFraction: number, waxing: boolean): MoonPhaseName {
  if (illuminatedFraction < 0.02) return 'new';
  if (illuminatedFraction > 0.98) return 'full';
  if (Math.abs(illuminatedFraction - 0.5) < 0.04) return waxing ? 'first-quarter' : 'last-quarter';
  if (illuminatedFraction < 0.5) return waxing ? 'waxing-crescent' : 'waning-crescent';
  return waxing ? 'waxing-gibbous' : 'waning-gibbous';
}

/**
 * Unit vector towards the Sun in the Moon's *apparent disc* frame, where +X is screen-right,
 * +Y is screen-up and +Z is towards the observer.
 *
 * The moon shader dots this against the surface normal of a sphere, which reproduces the real
 * terminator — curved, correctly tilted, and sweeping across genuine craters — instead of
 * masking a circle with another circle.
 */
function subSolarDirection(
  phaseAngle: number,
  brightLimbAngle: number,
  parallacticAngle: number,
): { x: number; y: number; z: number } {
  // Screen angle of the lit side: 0 = up, increasing clockwise.
  const screenAngle = brightLimbAngle - parallacticAngle;
  const sinPhase = Math.sin(phaseAngle);
  return {
    x: sinPhase * Math.sin(screenAngle),
    y: sinPhase * Math.cos(screenAngle),
    z: Math.cos(phaseAngle),
  };
}

/**
 * Moonlight illuminance on a surface normal to the beam, in lux.
 *
 * Full moon at the zenith at mean distance is 0.267 lux — the standard measured figure, and
 * the one the brief calls for. Phase falloff uses Allen's empirical lunar phase function,
 * which is markedly steeper than the (1+cos i)/2 illuminated fraction: a half moon is about a
 * *tenth* of a full moon, not a half, because of shadowing in the lunar regolith. That
 * non-linearity is why quarter-moon nights feel so much darker than they "should".
 */
export function lunarIlluminanceLux(
  apparentAltitudeRad: number,
  distanceKm: number,
  phaseAngleRad: number,
): number {
  const altitudeDeg = apparentAltitudeRad * RAD_TO_DEG;
  if (altitudeDeg < -0.9) return 0;

  const phaseDeg = Math.min(180, Math.abs(phaseAngleRad * RAD_TO_DEG));
  // Allen (1976): Δm = 0.026|i| + 4×10⁻⁹ i⁴ magnitudes of dimming relative to full.
  const magnitudeLoss = 0.026 * phaseDeg + 4e-9 * phaseDeg ** 4;
  const phaseFactor = 10 ** (-0.4 * magnitudeLoss);

  const distanceFactor = (384400 / distanceKm) ** 2;

  const airMass =
    1 / (Math.sin(apparentAltitudeRad) + 0.50572 * (altitudeDeg + 6.07995) ** -1.6364);
  const transmittance = 0.7 ** airMass ** 0.678;

  return (
    0.267 * phaseFactor * distanceFactor * transmittance * Math.max(0, Math.sin(apparentAltitudeRad))
  );
}

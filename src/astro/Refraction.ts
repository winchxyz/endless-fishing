import { DEG_TO_RAD, RAD_TO_DEG } from './AstroTime.js';

/**
 * Atmospheric refraction.
 *
 * The atmosphere lifts everything near the horizon. At the horizon itself the effect is about
 * 34′ — larger than the Sun's own diameter — which is why the Sun is still fully visible when
 * it is geometrically already below the horizon, and why sunset is defined at a geometric
 * altitude of −0.833° rather than 0°.
 *
 * Two formulae, and the direction matters:
 *
 *   Bennett (1982)      apparent altitude → refraction. Use when you have measured the
 *                       altitude of something you can see.
 *   Sæmundsson (1986)   true altitude → refraction. Use when you have *computed* a geometric
 *                       altitude and want to know where it will appear.
 *
 * We almost always want Sæmundsson, because everything here starts as a computed geometric
 * altitude. Bennett is exported because the rise/set solver inverts the relation.
 */

/** Standard sea-level conditions the formulae are calibrated for. */
const STANDARD_PRESSURE_MBAR = 1010;
const STANDARD_TEMPERATURE_C = 10;

export interface AtmosphereConditions {
  pressureMbar: number;
  temperatureC: number;
}

export const STANDARD_ATMOSPHERE: AtmosphereConditions = {
  pressureMbar: STANDARD_PRESSURE_MBAR,
  temperatureC: STANDARD_TEMPERATURE_C,
};

/**
 * Scale factor for non-standard air. Refraction goes with density, so it rises with pressure
 * and falls with temperature. The game feeds real barometric pressure from the weather system,
 * which means a deep low genuinely changes where the sun sets — by a few arcseconds, but it is
 * the correct few arcseconds.
 */
function densityFactor(conditions: AtmosphereConditions): number {
  return (
    (conditions.pressureMbar / STANDARD_PRESSURE_MBAR) *
    (283 / (273 + conditions.temperatureC))
  );
}

/**
 * Sæmundsson: refraction in radians for a *true* (geometric) altitude in radians.
 * Below about −1.9° the formula turns over and is meaningless, so it is clamped there.
 */
export function refractionFromTrueAltitude(
  trueAltitudeRad: number,
  conditions: AtmosphereConditions = STANDARD_ATMOSPHERE,
): number {
  const h = Math.max(trueAltitudeRad * RAD_TO_DEG, -1.9);
  const arcmin = 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * DEG_TO_RAD);
  return Math.max(0, arcmin) * densityFactor(conditions) * (DEG_TO_RAD / 60);
}

/**
 * Bennett: refraction in radians for an *apparent* altitude in radians.
 */
export function refractionFromApparentAltitude(
  apparentAltitudeRad: number,
  conditions: AtmosphereConditions = STANDARD_ATMOSPHERE,
): number {
  const h = Math.max(apparentAltitudeRad * RAD_TO_DEG, -1.0);
  const arcmin = 1 / Math.tan((h + 7.31 / (h + 4.4)) * DEG_TO_RAD);
  return Math.max(0, arcmin) * densityFactor(conditions) * (DEG_TO_RAD / 60);
}

/** Geometric altitude → the altitude an observer actually sees. */
export function applyRefraction(
  trueAltitudeRad: number,
  conditions: AtmosphereConditions = STANDARD_ATMOSPHERE,
): number {
  return trueAltitudeRad + refractionFromTrueAltitude(trueAltitudeRad, conditions);
}

/**
 * Vertical compression of a disc near the horizon.
 *
 * Refraction is stronger at the lower limb than the upper, so the setting sun is visibly
 * squashed into an oval. This returns the ratio of apparent vertical to horizontal diameter
 * for a disc of the given angular radius centred at the given true altitude — about 0.82 at
 * the horizon, i.e. an 18% squash, which matches photographs.
 */
export function horizonFlattening(
  trueAltitudeRad: number,
  angularRadiusRad: number,
  conditions: AtmosphereConditions = STANDARD_ATMOSPHERE,
): number {
  const upper = applyRefraction(trueAltitudeRad + angularRadiusRad, conditions);
  const lower = applyRefraction(trueAltitudeRad - angularRadiusRad, conditions);
  const apparentDiameter = upper - lower;
  return Math.min(1, Math.max(0.5, apparentDiameter / (2 * angularRadiusRad)));
}

/**
 * Dip of the horizon in radians for an eye height above sea level.
 *
 * From a boat the eye is a couple of metres up, so the true horizon sits slightly *below*
 * astronomical level — about 2.5′ at 2 m. Small, but it is the difference between the sun
 * touching the sea and the sun touching a line that is not quite the sea.
 */
export function horizonDip(eyeHeightMetres: number): number {
  if (eyeHeightMetres <= 0) return 0;
  // 1.75 arcminutes per sqrt(metre), the standard refracted-Earth value.
  return (1.75 * Math.sqrt(eyeHeightMetres)) * (DEG_TO_RAD / 60);
}

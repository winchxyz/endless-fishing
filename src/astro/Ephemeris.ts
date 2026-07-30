import { RAD_TO_DEG, astroTime, type JulianDate } from './AstroTime.js';
import type { GeoLocation } from './Coordinates.js';
import { lunarIlluminanceLux, lunarPosition, type LunarPosition } from './LunarPosition.js';
import type { AtmosphereConditions } from './Refraction.js';
import { localSiderealTime } from './SiderealTime.js';
import {
  solarIlluminanceLux,
  solarPosition,
  twilightPhase,
  type SolarPosition,
  type TwilightPhase,
} from './SolarPosition.js';

/**
 * The per-frame ephemeris snapshot.
 *
 * This is the single object that connects the astronomy to everything visible. It is computed
 * once per frame in `world/Sky.ts` and read — never recomputed — by the atmosphere, the light
 * rig, the environment probe, the ocean's glitter path, the exposure controller, the colour
 * grade, the navigation lights, the fishing bite table and the HUD.
 *
 * It is deliberately a plain data object with no three.js types, so `astro/` stays pure and
 * unit-testable. `Sky` copies the direction vectors into `Vector3`s once per frame.
 */

export interface Direction {
  x: number;
  y: number;
  z: number;
}

export interface EphemerisState {
  time: JulianDate;
  location: GeoLocation;
  sun: SolarPosition;
  moon: LunarPosition;

  /** World-space unit vector towards the Sun. +X east, +Y up, −Z north. */
  sunDirection: Direction;
  sunDirectionRefracted: Direction;
  moonDirection: Direction;

  sunAltitudeDeg: number;
  sunAzimuthDeg: number;
  moonAltitudeDeg: number;
  moonAzimuthDeg: number;

  /** Direct-beam illuminance in lux, already attenuated by air mass. */
  sunIlluminanceLux: number;
  moonIlluminanceLux: number;

  twilight: TwilightPhase;
  /**
   * Continuous 0..1 blend from full night to full day, driven by solar altitude across the
   * −18°..+6° band. Nothing in the game switches on `twilight`; everything lerps on this.
   */
  dayFactor: number;
  /** Local apparent sidereal time in radians. Rotates the star sphere. */
  siderealTime: number;
}

/** Radians of solar altitude spanned by the night → day ramp. */
const NIGHT_ALTITUDE_DEG = -18;
const DAY_ALTITUDE_DEG = 6;

/**
 * Altitude and azimuth to a world-space direction.
 * Azimuth is measured from north, eastward; the world uses +X east, +Y up, −Z north.
 */
export function horizontalToDirection(altitudeRad: number, azimuthRad: number): Direction {
  const cosAltitude = Math.cos(altitudeRad);
  return {
    x: cosAltitude * Math.sin(azimuthRad),
    y: Math.sin(altitudeRad),
    z: -cosAltitude * Math.cos(azimuthRad),
  };
}

export function computeEphemeris(
  epochMs: number,
  location: GeoLocation,
  conditions?: AtmosphereConditions,
): EphemerisState {
  const time = astroTime(epochMs);
  const sun = solarPosition(time, location, conditions);
  const moon = lunarPosition(time, location, conditions);

  const sunAltitudeDeg = sun.horizontal.altitude * RAD_TO_DEG;
  const moonAltitudeDeg = moon.horizontal.altitude * RAD_TO_DEG;

  // Smootherstep across the twilight band. Smoother than smoothstep at both ends, which
  // matters because the eye is very good at spotting the moment a light "starts" changing.
  const raw = (sunAltitudeDeg - NIGHT_ALTITUDE_DEG) / (DAY_ALTITUDE_DEG - NIGHT_ALTITUDE_DEG);
  const t = Math.min(1, Math.max(0, raw));
  const dayFactor = t * t * t * (t * (t * 6 - 15) + 10);

  return {
    time,
    location,
    sun,
    moon,
    sunDirection: horizontalToDirection(sun.horizontal.altitude, sun.horizontal.azimuth),
    sunDirectionRefracted: horizontalToDirection(sun.apparentAltitude, sun.horizontal.azimuth),
    moonDirection: horizontalToDirection(moon.apparentAltitude, moon.horizontal.azimuth),
    sunAltitudeDeg,
    sunAzimuthDeg: sun.horizontal.azimuth * RAD_TO_DEG,
    moonAltitudeDeg,
    moonAzimuthDeg: moon.horizontal.azimuth * RAD_TO_DEG,
    sunIlluminanceLux: solarIlluminanceLux(sun.apparentAltitude, sun.distanceAu),
    moonIlluminanceLux: lunarIlluminanceLux(moon.apparentAltitude, moon.distanceKm, moon.phaseAngle),
    twilight: twilightPhase(sunAltitudeDeg),
    dayFactor,
    siderealTime: localSiderealTime(time.jd, time.T, location.longitudeDeg),
  };
}

/**
 * Which body should own the shadow-casting directional light.
 *
 * Not a hard switch at sunset: through nautical twilight the sun is gone but the sky is still
 * far brighter than the moon, and a hard handover would snap every shadow in the scene. The
 * blend weight is the ratio of the two illuminances, so the transfer happens exactly when the
 * moon genuinely becomes the dominant source — which on a clear night with a full moon is
 * around −10° solar altitude, and on a new-moon night never really happens at all.
 */
export function dominantLightBlend(state: EphemerisState): number {
  const sun = state.sunIlluminanceLux;
  const moon = state.moonIlluminanceLux;
  // Skylight keeps contributing well after the sun is down; approximate its diffuse
  // contribution so the moon does not take over the instant the disc dips.
  const skyGlow = Math.max(0, 40 * Math.exp(state.sunAltitudeDeg / 3.2));
  const total = sun + skyGlow + moon;
  return total <= 0 ? 0 : moon / total;
}

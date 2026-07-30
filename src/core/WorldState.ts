import type { EphemerisState } from '../astro/Ephemeris.js';

/**
 * The frozen per-frame snapshot every system reads.
 *
 * Written by exactly two systems — `Sky` fills in the ephemeris and lighting, `Weather` fills
 * in the wind and the sea state — and read by everyone. Nothing else writes to it, and no
 * system reaches into another system to ask a question that could be answered from here.
 *
 * The wind vector in particular is the single source of truth named in CLAUDE.md: the ocean
 * spectrum, the flag, the cloud drift, the rain slant, the spray direction, the gulls and the
 * boat's drift at anchor all read this one value, which is why they can never disagree.
 */
export interface WorldState {
  /** Null only during the first frame, before Sky has run once. */
  ephemeris: EphemerisState | null;

  /** Metres per second, in world space. Y is always 0; wind is horizontal. */
  windX: number;
  windZ: number;
  /** Magnitude of the wind vector, m/s. */
  windSpeed: number;
  /** Direction the wind is blowing *towards*, radians, measured from north eastward. */
  windDirection: number;
  /** Beaufort force 0–12, derived from wind speed by the real scale. */
  beaufort: number;
  /** Significant wave height in metres, from the spectrum. */
  significantWaveHeight: number;
  /** Fetch in kilometres — how far the wind has blown over open water. Feeds JONSWAP. */
  fetchKm: number;

  /** 0 = clear, 1 = solid overcast. Drives sky flattening and cloud density. */
  cloudiness: number;
  /** 0 = dry, 1 = heaviest rain. */
  precipitation: number;
  /** Visibility in metres. 50–250 in sea mist, tens of kilometres on a clear day. */
  visibility: number;
  /** Sea-level pressure, hPa. Shown on the HUD barometer and drives the synoptic model. */
  pressureHpa: number;
  /** Air temperature, Celsius. Feeds the refraction model. */
  temperatureC: number;

  /** Height of mean water level above datum, metres. Semi-diurnal equilibrium tide. */
  tideHeight: number;

  /** Camera exposure multiplier after adaptation. */
  exposure: number;
  /** Total scene illuminance, lux. What the exposure controller adapts to. */
  sceneIlluminanceLux: number;
}

export function createWorldState(): WorldState {
  return {
    ephemeris: null,
    windX: 0,
    windZ: 0,
    windSpeed: 0,
    windDirection: 0,
    beaufort: 0,
    significantWaveHeight: 0,
    fetchKm: 200,
    cloudiness: 0.2,
    precipitation: 0,
    visibility: 25000,
    pressureHpa: 1013.25,
    temperatureC: 12,
    tideHeight: 0,
    exposure: 1,
    sceneIlluminanceLux: 10000,
  };
}

/**
 * Beaufort force from wind speed in m/s, using the real scale boundaries.
 *
 * The scale is defined by wind speed ranges, not by a formula, so this is a table lookup
 * against the standard limits rather than the `(v/0.836)^(2/3)` approximation — which is off
 * by a whole force at several points and would put the wrong sea state on screen.
 */
const BEAUFORT_UPPER_LIMITS = [0.5, 1.5, 3.3, 5.5, 7.9, 10.7, 13.8, 17.1, 20.7, 24.4, 28.4, 32.6];

export function beaufortFromWindSpeed(metresPerSecond: number): number {
  for (let force = 0; force < BEAUFORT_UPPER_LIMITS.length; force += 1) {
    const limit = BEAUFORT_UPPER_LIMITS[force];
    if (limit !== undefined && metresPerSecond < limit) return force;
  }
  return 12;
}

import { DEG_TO_RAD, normalizeRadians } from './AstroTime.js';

/**
 * Coordinate systems and the transforms between them.
 *
 * Conventions used everywhere in this project, chosen once and not deviated from:
 *
 *   Azimuth   measured from **north**, increasing **eastward**. North 0, east π/2, south π.
 *             (Meeus measures from south; we convert at the boundary, in `equatorialToHorizontal`.)
 *   Altitude  above the true horizon, positive up.
 *   Longitude **east positive**. West of Greenwich is negative.
 *
 * The world-space mapping into three.js, applied in `astro/Ephemeris.ts` and nowhere else:
 *   +X = east, +Y = up, −Z = north. A body at altitude `a`, azimuth `A` is at
 *   ( cos a · sin A, sin a, −cos a · cos A ).
 */

export interface GeoLocation {
  latitudeDeg: number;
  longitudeDeg: number;
  /** Metres above mean sea level. Matters only for lunar parallax and horizon dip. */
  elevationM: number;
}

export interface EclipticCoords {
  /** Ecliptic longitude λ, radians. */
  longitude: number;
  /** Ecliptic latitude β, radians. */
  latitude: number;
  /** Distance. Kilometres for the Moon, astronomical units for the Sun. */
  distance: number;
}

export interface EquatorialCoords {
  /** Right ascension α, radians, in [0, 2π). */
  rightAscension: number;
  /** Declination δ, radians. */
  declination: number;
  /** Distance in the same unit it arrived in. */
  distance: number;
}

export interface HorizontalCoords {
  /** Geometric altitude, radians. No refraction applied. */
  altitude: number;
  /** Azimuth from north, eastward, radians, in [0, 2π). */
  azimuth: number;
}

/** Ecliptic → equatorial (Meeus 13.3 / 13.4). `obliquity` is the *true* obliquity. */
export function eclipticToEquatorial(
  coords: EclipticCoords,
  obliquity: number,
): EquatorialCoords {
  const sinLambda = Math.sin(coords.longitude);
  const cosLambda = Math.cos(coords.longitude);
  const sinBeta = Math.sin(coords.latitude);
  const cosBeta = Math.cos(coords.latitude);
  const sinEps = Math.sin(obliquity);
  const cosEps = Math.cos(obliquity);

  const rightAscension = normalizeRadians(
    Math.atan2(sinLambda * cosEps - (sinBeta / cosBeta) * sinEps, cosLambda),
  );
  const declination = Math.asin(sinBeta * cosEps + cosBeta * sinEps * sinLambda);
  return { rightAscension, declination, distance: coords.distance };
}

/**
 * Equatorial → horizontal (Meeus 13.5 / 13.6), converted to north-based azimuth.
 * `hourAngleRad` is local apparent sidereal time minus right ascension.
 */
export function equatorialToHorizontal(
  declination: number,
  hourAngleRad: number,
  latitudeDeg: number,
): HorizontalCoords {
  const phi = latitudeDeg * DEG_TO_RAD;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinDec = Math.sin(declination);
  const cosDec = Math.cos(declination);
  const sinH = Math.sin(hourAngleRad);
  const cosH = Math.cos(hourAngleRad);

  const altitude = Math.asin(sinPhi * sinDec + cosPhi * cosDec * cosH);
  // Meeus gives azimuth from south; adding π puts it on our north-based convention.
  const azimuthFromSouth = Math.atan2(sinH, cosH * sinPhi - (sinDec / cosDec) * cosPhi);
  return { altitude, azimuth: normalizeRadians(azimuthFromSouth + Math.PI) };
}

/**
 * Equatorial → galactic (IAU 1958 pole, precessed to J2000).
 *
 * Used to place the Milky Way band exactly where it belongs rather than approximately.
 * The north galactic pole is at α = 192.85948°, δ = 27.12825°, and the galactic centre is at
 * galactic longitude 0 with the ascending node at α = 282.86°.
 */
const NGP_RA = 192.85948 * DEG_TO_RAD;
const NGP_DEC = 27.12825 * DEG_TO_RAD;
const GALACTIC_NODE_LON = 122.93192 * DEG_TO_RAD;

export function equatorialToGalactic(
  rightAscension: number,
  declination: number,
): { longitude: number; latitude: number } {
  const sinDec = Math.sin(declination);
  const cosDec = Math.cos(declination);
  const deltaRa = rightAscension - NGP_RA;

  const sinB = sinDec * Math.sin(NGP_DEC) + cosDec * Math.cos(NGP_DEC) * Math.cos(deltaRa);
  const latitude = Math.asin(Math.min(1, Math.max(-1, sinB)));
  const y = cosDec * Math.sin(deltaRa);
  const x = sinDec * Math.cos(NGP_DEC) - cosDec * Math.sin(NGP_DEC) * Math.cos(deltaRa);
  const longitude = normalizeRadians(GALACTIC_NODE_LON - Math.atan2(y, x));
  return { longitude, latitude };
}

/** Galactic → equatorial. The inverse of the above; used to lay out the Milky Way mesh. */
export function galacticToEquatorial(
  longitude: number,
  latitude: number,
): { rightAscension: number; declination: number } {
  const sinB = Math.sin(latitude);
  const cosB = Math.cos(latitude);
  const deltaL = GALACTIC_NODE_LON - longitude;

  const sinDec = sinB * Math.sin(NGP_DEC) + cosB * Math.cos(NGP_DEC) * Math.cos(deltaL);
  const declination = Math.asin(Math.min(1, Math.max(-1, sinDec)));
  const y = cosB * Math.sin(deltaL);
  const x = sinB * Math.cos(NGP_DEC) - cosB * Math.sin(NGP_DEC) * Math.cos(deltaL);
  return { rightAscension: normalizeRadians(Math.atan2(y, x) + NGP_RA), declination };
}

/**
 * Angular separation between two equatorial positions, radians (Meeus 17.1).
 * Uses the haversine-style form so it stays accurate for small separations, which matters
 * for the Sun–Moon elongation that drives the lunar phase.
 */
export function angularSeparation(
  ra1: number,
  dec1: number,
  ra2: number,
  dec2: number,
): number {
  const dRa = ra2 - ra1;
  const cosD =
    Math.sin(dec1) * Math.sin(dec2) + Math.cos(dec1) * Math.cos(dec2) * Math.cos(dRa);
  if (cosD > 0.9999999) {
    // Near-coincident: fall back to the small-angle form to avoid acos losing precision.
    const x = Math.cos(dec2) * Math.sin(dRa);
    const y = Math.cos(dec1) * Math.sin(dec2) - Math.sin(dec1) * Math.cos(dec2) * Math.cos(dRa);
    const z = Math.sin(dec1) * Math.sin(dec2) + Math.cos(dec1) * Math.cos(dec2) * Math.cos(dRa);
    return Math.atan2(Math.hypot(x, y), z);
  }
  return Math.acos(Math.min(1, Math.max(-1, cosD)));
}

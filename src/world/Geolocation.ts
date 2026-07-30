import { DEFAULT_LATITUDE_DEG, DEFAULT_LONGITUDE_DEG } from '../core/Settings.js';

/**
 * Where the player is, for the sky to be correct above them.
 *
 * The fallback chain the brief asks for, in order and non-blocking:
 *
 *   1. `navigator.geolocation`, requested once, with a short timeout. Never awaited before the
 *      first frame — a permission prompt must not hold up the loading screen, and a player who
 *      ignores it should still get a game.
 *   2. The IANA timezone from `Intl.DateTimeFormat`, mapped to the coordinates of its
 *      representative city. Accurate to a few hundred kilometres, which for solar altitude is
 *      a couple of degrees — visibly better than nothing.
 *   3. 32.08 N, 34.78 E.
 *
 * The timezone table below is not exhaustive; it covers the zones that carry most of the
 * world's population plus every zone at a latitude extreme enough to change the character of
 * the sky, because getting the *latitude* roughly right is what decides whether there is a
 * long dusk or a fifteen-minute one.
 */

export interface Location {
  latitudeDeg: number;
  longitudeDeg: number;
  source: 'geolocation' | 'timezone' | 'default';
}

const TIMEZONE_COORDINATES: Readonly<Record<string, readonly [number, number]>> = {
  'Africa/Cairo': [30.04, 31.24],
  'Africa/Johannesburg': [-26.2, 28.05],
  'Africa/Lagos': [6.52, 3.38],
  'Africa/Nairobi': [-1.29, 36.82],
  'America/Anchorage': [61.22, -149.9],
  'America/Argentina/Buenos_Aires': [-34.6, -58.38],
  'America/Bogota': [4.71, -74.07],
  'America/Chicago': [41.88, -87.63],
  'America/Denver': [39.74, -104.99],
  'America/Halifax': [44.65, -63.57],
  'America/Lima': [-12.05, -77.04],
  'America/Los_Angeles': [34.05, -118.24],
  'America/Mexico_City': [19.43, -99.13],
  'America/New_York': [40.71, -74.01],
  'America/Sao_Paulo': [-23.55, -46.63],
  'America/Toronto': [43.65, -79.38],
  'America/Vancouver': [49.28, -123.12],
  'Asia/Bangkok': [13.76, 100.5],
  'Asia/Dubai': [25.2, 55.27],
  'Asia/Hong_Kong': [22.32, 114.17],
  'Asia/Jakarta': [-6.21, 106.85],
  'Asia/Jerusalem': [32.08, 34.78],
  'Asia/Kolkata': [22.57, 88.36],
  'Asia/Manila': [14.6, 120.98],
  'Asia/Seoul': [37.57, 126.98],
  'Asia/Shanghai': [31.23, 121.47],
  'Asia/Singapore': [1.35, 103.82],
  'Asia/Tokyo': [35.68, 139.69],
  'Atlantic/Reykjavik': [64.15, -21.94],
  'Australia/Brisbane': [-27.47, 153.03],
  'Australia/Melbourne': [-37.81, 144.96],
  'Australia/Perth': [-31.95, 115.86],
  'Australia/Sydney': [-33.87, 151.21],
  'Europe/Amsterdam': [52.37, 4.9],
  'Europe/Athens': [37.98, 23.73],
  'Europe/Berlin': [52.52, 13.4],
  'Europe/Brussels': [50.85, 4.35],
  'Europe/Copenhagen': [55.68, 12.57],
  'Europe/Dublin': [53.35, -6.26],
  'Europe/Helsinki': [60.17, 24.94],
  'Europe/Istanbul': [41.01, 28.98],
  'Europe/Lisbon': [38.72, -9.14],
  'Europe/London': [51.51, -0.13],
  'Europe/Madrid': [40.42, -3.7],
  'Europe/Moscow': [55.76, 37.62],
  'Europe/Oslo': [59.91, 10.75],
  'Europe/Paris': [48.86, 2.35],
  'Europe/Prague': [50.08, 14.44],
  'Europe/Rome': [41.9, 12.5],
  'Europe/Stockholm': [59.33, 18.07],
  'Europe/Vienna': [48.21, 16.37],
  'Europe/Warsaw': [52.23, 21.01],
  'Europe/Zurich': [47.38, 8.54],
  'Pacific/Auckland': [-36.85, 174.76],
  'Pacific/Honolulu': [21.31, -157.86],
};

/** Timezone-derived guess. Synchronous, so the first frame can use it immediately. */
export function locationFromTimezone(): Location {
  let zone = '';
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    zone = '';
  }
  const match = TIMEZONE_COORDINATES[zone];
  if (match !== undefined) {
    return { latitudeDeg: match[0], longitudeDeg: match[1], source: 'timezone' };
  }
  return {
    latitudeDeg: DEFAULT_LATITUDE_DEG,
    longitudeDeg: DEFAULT_LONGITUDE_DEG,
    source: 'default',
  };
}

/**
 * Ask the browser, falling back down the chain. Always resolves, never rejects — a denied
 * permission is an expected outcome, not an error, and must not surface as console noise.
 */
export function requestLocation(): Promise<Location> {
  const fallback = locationFromTimezone();
  if (typeof navigator === 'undefined' || navigator.geolocation === undefined) {
    return Promise.resolve(fallback);
  }

  return new Promise<Location>((resolve) => {
    let settled = false;
    const finish = (location: Location): void => {
      if (settled) return;
      settled = true;
      resolve(location);
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        finish({
          latitudeDeg: position.coords.latitude,
          longitudeDeg: position.coords.longitude,
          source: 'geolocation',
        });
      },
      () => finish(fallback),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );

    // Some browsers leave the prompt open indefinitely rather than firing the error callback,
    // so the fallback resolves on its own schedule regardless.
    window.setTimeout(() => finish(fallback), 9000);
  });
}

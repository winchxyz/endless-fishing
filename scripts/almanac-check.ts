import { computeEphemeris } from '../src/astro/Ephemeris.js';
import { dayEvents } from '../src/astro/RiseSet.js';
import type { GeoLocation } from '../src/astro/Coordinates.js';
import { RAD_TO_DEG } from '../src/astro/AstroTime.js';

/**
 * Independent cross-check against a published almanac.
 *
 * Run with `npx tsx scripts/almanac-check.ts [YYYY-MM-DD] [lat] [lon] [tzOffsetHours]`.
 * Prints rise/set times and the lunar phase so they can be compared by eye against the
 * US Naval Observatory or timeanddate.com. This is not a unit test — it is the manual
 * verification step the brief asks for before phase 1 is called complete, and it stays in the
 * repo so the check can be repeated for any date and place.
 */

const [dateArg, latArg, lonArg, tzArg] = process.argv.slice(2);

const location: GeoLocation = {
  latitudeDeg: latArg === undefined ? 32.08 : Number.parseFloat(latArg),
  longitudeDeg: lonArg === undefined ? 34.78 : Number.parseFloat(lonArg),
  elevationM: 0,
};
const tzOffsetHours = tzArg === undefined ? 3 : Number.parseFloat(tzArg);

const epochMs =
  dateArg === undefined
    ? Date.now()
    : Date.parse(`${dateArg}T12:00:00Z`) - tzOffsetHours * 3600000;

/** Rounded to the nearest minute, because that is how almanacs publish these. */
function local(ms: number | null): string {
  if (ms === null) return '     —';
  const shifted = new Date(Math.round((ms + tzOffsetHours * 3600000) / 60000) * 60000);
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  return ` ${hh}:${mm}`;
}

const events = dayEvents(location, epochMs);
const state = computeEphemeris(epochMs, location);

const lines = [
  `Location        ${location.latitudeDeg.toFixed(4)} N, ${location.longitudeDeg.toFixed(4)} E  (UTC${tzOffsetHours >= 0 ? '+' : ''}${tzOffsetHours})`,
  `Date            ${new Date(epochMs + tzOffsetHours * 3600000).toISOString().slice(0, 10)} local`,
  '',
  `Astronomical dawn ${local(events.astronomicalDawn)}`,
  `Nautical dawn     ${local(events.nauticalDawn)}`,
  `Civil dawn        ${local(events.civilDawn)}`,
  `Sunrise           ${local(events.sunrise)}`,
  `Solar noon        ${local(events.solarNoon)}`,
  `Sunset            ${local(events.sunset)}`,
  `Civil dusk        ${local(events.civilDusk)}`,
  `Nautical dusk     ${local(events.nauticalDusk)}`,
  `Astronomical dusk ${local(events.astronomicalDusk)}`,
  '',
  `Moonrise          ${local(events.moonrise)}`,
  `Moonset           ${local(events.moonset)}`,
  `Moon phase        ${state.moon.phaseName}, ${(state.moon.illuminatedFraction * 100).toFixed(1)}% illuminated`,
  `Moon age          ${state.moon.ageDays.toFixed(2)} days`,
  `Moon distance     ${state.moon.distanceKm.toFixed(0)} km  (diameter ${(2 * state.moon.angularRadius * RAD_TO_DEG * 60).toFixed(1)}')`,
  '',
  `Right now:  sun alt ${state.sunAltitudeDeg.toFixed(2)} deg, az ${state.sunAzimuthDeg.toFixed(2)} deg  (${state.twilight})`,
  `            moon alt ${state.moonAltitudeDeg.toFixed(2)} deg, az ${state.moonAzimuthDeg.toFixed(2)} deg`,
  `            sun ${state.sunIlluminanceLux.toFixed(0)} lux, moon ${state.moonIlluminanceLux.toFixed(3)} lux`,
];

process.stdout.write(`${lines.join('\n')}\n`);

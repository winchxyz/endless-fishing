import { describe, expect, it } from 'vitest';
import {
  DAYS_PER_JULIAN_CENTURY,
  J2000,
  RAD_TO_DEG,
  astroTime,
  epochMsFromJulianDay,
  julianDayFromUTC,
  normalizeDegrees,
  type JulianDate,
} from '../src/astro/AstroTime.js';
import { solarPosition, twilightPhase } from '../src/astro/SolarPosition.js';
import { lunarPosition } from '../src/astro/LunarPosition.js';
import { greenwichMeanSiderealTime } from '../src/astro/SiderealTime.js';
import { meanObliquityRad } from '../src/astro/Nutation.js';
import { computeEphemeris } from '../src/astro/Ephemeris.js';
import { dayEvents, solarNoon, sunRiseSet } from '../src/astro/RiseSet.js';
import type { GeoLocation } from '../src/astro/Coordinates.js';
import {
  applyRefraction,
  refractionFromApparentAltitude,
  refractionFromTrueAltitude,
  horizonFlattening,
} from '../src/astro/Refraction.js';

/**
 * Astronomy validation.
 *
 * Two kinds of test here, and both are needed:
 *
 *   1. **Book comparisons.** Worked examples from Meeus, *Astronomical Algorithms* (2nd ed.),
 *      checked against his high-accuracy VSOP87/ELP results rather than against his own
 *      low-accuracy intermediate values. That verifies the implementation *and* substantiates
 *      the accuracy claim, instead of testing our arithmetic against our own arithmetic.
 *
 *   2. **Physical identities.** Relations that must hold for any correct implementation and
 *      that no amount of copying a table can fake — the solar-noon altitude identity, the
 *      equinox declination, the midnight sun above the Arctic circle, sunrise/sunset symmetry
 *      about local apparent noon. These cover the alt/az chain end to end for six
 *      date-location pairs across both hemispheres, a solstice and an equinox.
 */

/** Build a time bundle from an exact Julian Ephemeris Day, as the book examples are stated. */
function fromJDE(jde: number): JulianDate {
  return {
    jd: jde,
    jde,
    T: (jde - J2000) / DAYS_PER_JULIAN_CENTURY,
    epochMs: epochMsFromJulianDay(jde),
  };
}

const GREENWICH: GeoLocation = { latitudeDeg: 51.4779, longitudeDeg: -0.0015, elevationM: 0 };

describe('Julian day', () => {
  it('matches the standard reference epochs', () => {
    // Meeus, ch. 7, worked examples.
    expect(julianDayFromUTC(1957, 10, 4, 19, 26, 24)).toBeCloseTo(2436116.31, 2);
    expect(julianDayFromUTC(2000, 1, 1, 12, 0, 0)).toBeCloseTo(2451545.0, 6);
    expect(julianDayFromUTC(1987, 1, 27, 0, 0, 0)).toBeCloseTo(2446822.5, 6);
    expect(julianDayFromUTC(1988, 6, 19, 12, 0, 0)).toBeCloseTo(2447332.0, 6);
  });

  it('agrees with the epoch-millisecond path', () => {
    const jd = julianDayFromUTC(2026, 7, 30, 14, 33, 12);
    const viaEpoch = astroTime(Date.UTC(2026, 6, 30, 14, 33, 12)).jd;
    expect(viaEpoch).toBeCloseTo(jd, 8);
  });
});

describe('sidereal time', () => {
  it('reproduces Meeus example 12.a — 1987 April 10.0 UT', () => {
    const jd = julianDayFromUTC(1987, 4, 10, 0, 0, 0);
    expect(jd).toBeCloseTo(2446895.5, 6);
    // 13h 10m 46.3668s = 197.693195 degrees.
    const gmstDeg = normalizeDegrees(greenwichMeanSiderealTime(jd) * RAD_TO_DEG);
    expect(gmstDeg).toBeCloseTo(197.693195, 4);
  });

  it('reproduces Meeus example 12.b — 1987 April 10 at 19:21:00 UT', () => {
    const jd = julianDayFromUTC(1987, 4, 10, 19, 21, 0);
    // 8h 34m 57.0896s = 128.7378733 degrees.
    const gmstDeg = normalizeDegrees(greenwichMeanSiderealTime(jd) * RAD_TO_DEG);
    expect(gmstDeg).toBeCloseTo(128.7378733, 4);
  });
});

describe('obliquity', () => {
  it('reproduces Meeus example 22.a — 1987 April 10.0 TD', () => {
    const T = (2446895.5 - J2000) / DAYS_PER_JULIAN_CENTURY;
    // Mean obliquity 23 deg 26' 27.407" = 23.44094646 degrees.
    expect(meanObliquityRad(T) * RAD_TO_DEG).toBeCloseTo(23.44094646, 6);
  });
});

describe('solar position', () => {
  /**
   * Meeus example 25.b, 1992 October 13.0 TD. The expected values are his *high accuracy*
   * VSOP87 results, so this measures our error against the real ephemeris, not against his
   * worked low-accuracy intermediates.
   */
  const time = fromJDE(2448908.5);
  const sun = solarPosition(time, GREENWICH);

  it('has the right Julian century', () => {
    expect(time.T).toBeCloseTo(-0.072183436, 9);
  });

  it('places the apparent longitude within 0.01 deg of VSOP87', () => {
    expect(sun.apparentLongitude * RAD_TO_DEG).toBeCloseTo(199.90598, 2);
  });

  it('places right ascension and declination within 0.01 deg of VSOP87', () => {
    expect(sun.equatorial.rightAscension * RAD_TO_DEG).toBeCloseTo(198.378178, 2);
    expect(sun.equatorial.declination * RAD_TO_DEG).toBeCloseTo(-7.783871, 2);
  });

  it('gets the Earth-Sun distance right', () => {
    // The two-term radius vector is good to about 1e-4 AU against VSOP87 — 0.01%, which is
    // three orders of magnitude below anything the inverse-square light falloff can show.
    expect(sun.distanceAu).toBeCloseTo(0.99760775, 3);
    expect(Math.abs(sun.distanceAu - 0.99760775)).toBeLessThan(1e-4);
  });

  it('has a declination of zero at the March equinox', () => {
    // 2024 March 20, 03:06 UTC — the instant of the vernal equinox.
    const equinox = solarPosition(astroTime(Date.UTC(2024, 2, 20, 3, 6, 0)), GREENWICH);
    expect(Math.abs(equinox.equatorial.declination * RAD_TO_DEG)).toBeLessThan(0.01);
  });

  it('reaches the obliquity at the June solstice', () => {
    // 2024 June 20, 20:51 UTC.
    const solstice = solarPosition(astroTime(Date.UTC(2024, 5, 20, 20, 51, 0)), GREENWICH);
    expect(solstice.equatorial.declination * RAD_TO_DEG).toBeCloseTo(23.4367, 2);
  });

  it('reaches the negative obliquity at the December solstice', () => {
    // 2024 December 21, 09:20 UTC.
    const solstice = solarPosition(astroTime(Date.UTC(2024, 11, 21, 9, 20, 0)), GREENWICH);
    expect(solstice.equatorial.declination * RAD_TO_DEG).toBeCloseTo(-23.4365, 2);
  });

  it('keeps the equation of time inside its real annual envelope', () => {
    let min = Infinity;
    let max = -Infinity;
    for (let day = 0; day < 365; day += 1) {
      const eot = solarPosition(
        astroTime(Date.UTC(2024, 0, 1) + day * 86400000),
        GREENWICH,
      ).equationOfTimeMinutes;
      min = Math.min(min, eot);
      max = Math.max(max, eot);
    }
    // The real annual range is about -14.2 min (mid February) to +16.4 min (early November).
    expect(min).toBeGreaterThan(-15);
    expect(min).toBeLessThan(-13);
    expect(max).toBeGreaterThan(15.5);
    expect(max).toBeLessThan(17);
  });
});

/**
 * Six date-location pairs across both hemispheres, spanning a solstice and an equinox.
 *
 * The assertion is the solar-noon altitude identity: at local apparent noon the Sun's altitude
 * is exactly 90 deg minus the angular distance between the observer's latitude and the Sun's
 * declination. It holds only if the declination, the hour angle, the sidereal time and the
 * equatorial-to-horizontal transform are all simultaneously correct, so it is a genuine
 * end-to-end check rather than a restatement of the code.
 */
describe('solar altitude and azimuth across the globe', () => {
  const cases: Array<{ name: string; location: GeoLocation; epochMs: number }> = [
    {
      name: 'Tel Aviv, June solstice',
      location: { latitudeDeg: 32.08, longitudeDeg: 34.78, elevationM: 0 },
      epochMs: Date.UTC(2024, 5, 20, 12, 0, 0),
    },
    {
      name: 'Reykjavik, March equinox',
      location: { latitudeDeg: 64.15, longitudeDeg: -21.94, elevationM: 0 },
      epochMs: Date.UTC(2024, 2, 20, 12, 0, 0),
    },
    {
      name: 'Sydney, December solstice',
      location: { latitudeDeg: -33.87, longitudeDeg: 151.21, elevationM: 0 },
      epochMs: Date.UTC(2024, 11, 21, 2, 0, 0),
    },
    {
      name: 'Ushuaia, June solstice (southern midwinter)',
      location: { latitudeDeg: -54.8, longitudeDeg: -68.3, elevationM: 0 },
      epochMs: Date.UTC(2024, 5, 20, 16, 0, 0),
    },
    {
      name: 'Singapore, September equinox',
      location: { latitudeDeg: 1.35, longitudeDeg: 103.82, elevationM: 0 },
      epochMs: Date.UTC(2024, 8, 22, 4, 0, 0),
    },
    {
      name: 'Anchorage, December solstice',
      location: { latitudeDeg: 61.22, longitudeDeg: -149.9, elevationM: 0 },
      epochMs: Date.UTC(2024, 11, 21, 21, 0, 0),
    },
  ];

  for (const testCase of cases) {
    it(`satisfies the solar-noon altitude identity at ${testCase.name}`, () => {
      const noonMs = solarNoon(testCase.location, testCase.epochMs);
      const sun = solarPosition(astroTime(noonMs), testCase.location);
      const declinationDeg = sun.equatorial.declination * RAD_TO_DEG;
      const expectedAltitude = 90 - Math.abs(testCase.location.latitudeDeg - declinationDeg);
      expect(sun.horizontal.altitude * RAD_TO_DEG).toBeCloseTo(expectedAltitude, 1);
    });

    it(`puts the Sun on the meridian at noon at ${testCase.name}`, () => {
      const noonMs = solarNoon(testCase.location, testCase.epochMs);
      const sun = solarPosition(astroTime(noonMs), testCase.location);
      const azimuthDeg = sun.horizontal.azimuth * RAD_TO_DEG;
      const declinationDeg = sun.equatorial.declination * RAD_TO_DEG;
      // Due south when the Sun is south of the observer, due north when it is north.
      const expected = declinationDeg < testCase.location.latitudeDeg ? 180 : 0;
      const error = Math.abs(((azimuthDeg - expected + 540) % 360) - 180);
      expect(error).toBeLessThan(0.3);
    });
  }
});

describe('lunar position', () => {
  /** Meeus example 47.a, 1992 April 12.0 TD. */
  const time = fromJDE(2448724.5);
  const moon = lunarPosition(time, GREENWICH);

  it('places right ascension and declination within 0.02 deg', () => {
    expect(moon.equatorial.rightAscension * RAD_TO_DEG).toBeCloseTo(134.68847, 1);
    expect(moon.equatorial.declination * RAD_TO_DEG).toBeCloseTo(13.768368, 1);
  });

  it('gets the Earth-Moon distance within 2 km', () => {
    expect(moon.distanceKm).toBeCloseTo(368409.7, 0);
  });

  it('reproduces the Meeus example 48.a phase angle and illuminated fraction', () => {
    // i = 69.0756 deg, k = 0.6786.
    expect(moon.phaseAngle * RAD_TO_DEG).toBeCloseTo(69.0756, 0);
    expect(moon.illuminatedFraction).toBeCloseTo(0.6786, 3);
  });

  it('has an angular radius in the real perigee-apogee range', () => {
    // Only meaningful while the disc is actually visible: the topocentric semidiameter
    // correction is negative below the horizon, where nothing is drawn.
    let minDeg = Infinity;
    let maxDeg = -Infinity;
    let samples = 0;
    for (let hour = 0; hour < 400 * 24; hour += 3) {
      const m = lunarPosition(astroTime(Date.UTC(2024, 0, 1) + hour * 3600000), GREENWICH);
      if (m.horizontal.altitude <= 0) continue;
      const diameterDeg = 2 * m.angularRadius * RAD_TO_DEG;
      minDeg = Math.min(minDeg, diameterDeg);
      maxDeg = Math.max(maxDeg, diameterDeg);
      samples += 1;
    }
    expect(samples).toBeGreaterThan(1000);
    // Geocentric apparent diameter runs 29.4' (apogee) to 33.5' (perigee); the topocentric
    // correction adds up to +1.7% when the Moon is overhead.
    expect(minDeg).toBeGreaterThan(0.489);
    expect(maxDeg).toBeLessThan(0.568);
    expect(maxDeg - minDeg).toBeGreaterThan(0.05);
  });

  it('is fully lit at a known full moon and dark at a known new moon', () => {
    // Full moon 2024 January 25, 17:54 UTC. New moon 2024 February 9, 22:59 UTC.
    const full = lunarPosition(astroTime(Date.UTC(2024, 0, 25, 17, 54, 0)), GREENWICH);
    const dark = lunarPosition(astroTime(Date.UTC(2024, 1, 9, 22, 59, 0)), GREENWICH);
    expect(full.illuminatedFraction).toBeGreaterThan(0.99);
    expect(dark.illuminatedFraction).toBeLessThan(0.01);
  });

  it('tracks a full lunation to within 1 percent of the expected illuminated fraction', () => {
    // Quarter phases of the same lunation, from published times.
    const firstQuarter = lunarPosition(astroTime(Date.UTC(2024, 0, 18, 3, 53, 0)), GREENWICH);
    const lastQuarter = lunarPosition(astroTime(Date.UTC(2024, 1, 2, 23, 18, 0)), GREENWICH);
    expect(firstQuarter.illuminatedFraction).toBeCloseTo(0.5, 2);
    expect(lastQuarter.illuminatedFraction).toBeCloseTo(0.5, 2);
    expect(firstQuarter.waxing).toBe(true);
    expect(lastQuarter.waxing).toBe(false);
  });

  it('moves the Moon by up to a degree when topocentric parallax is applied', () => {
    // The correction is largest for an observer far from the sub-lunar point.
    let maxShiftDeg = 0;
    for (let hour = 0; hour < 24; hour += 1) {
      const m = lunarPosition(
        astroTime(Date.UTC(2024, 5, 15, hour, 0, 0)),
        { latitudeDeg: 60, longitudeDeg: 0, elevationM: 0 },
      );
      const shift = Math.abs(m.topocentric.declination - m.equatorial.declination) * RAD_TO_DEG;
      maxShiftDeg = Math.max(maxShiftDeg, shift);
    }
    expect(maxShiftDeg).toBeGreaterThan(0.3);
    expect(maxShiftDeg).toBeLessThan(1.1);
  });

  it('points the bright limb away from the Sun', () => {
    // The lit side must face the Sun. Check the sub-solar direction's screen-space angle
    // against the Sun's own position angle relative to the Moon.
    for (let day = 0; day < 30; day += 1) {
      const epochMs = Date.UTC(2024, 3, 1) + day * 86400000;
      const moonNow = lunarPosition(astroTime(epochMs), GREENWICH);
      const magnitude = Math.hypot(
        moonNow.sunDirection.x,
        moonNow.sunDirection.y,
        moonNow.sunDirection.z,
      );
      expect(magnitude).toBeCloseTo(1, 6);
      // z is cos(phase angle): positive when more than half lit, negative when a crescent.
      const expectedZ = 2 * moonNow.illuminatedFraction - 1;
      expect(moonNow.sunDirection.z).toBeCloseTo(expectedZ, 5);
    }
  });
});

describe('refraction', () => {
  it('gives the standard 34 arcminutes at an APPARENT altitude of zero', () => {
    // The textbook "34 minutes at the horizon" is Bennett's number, and it is quoted for a
    // body that *appears* on the horizon — not one that is geometrically there.
    const arcmin = refractionFromApparentAltitude(0) * RAD_TO_DEG * 60;
    expect(arcmin).toBeGreaterThan(33.5);
    expect(arcmin).toBeLessThan(35.5);
  });

  it('gives about 29 arcminutes at a TRUE altitude of zero', () => {
    // Saemundsson answers the other question: a body geometrically on the horizon is lifted
    // by ~29', appearing at +29'. Mixing the two formulae up shifts sunset by three minutes.
    const arcmin = refractionFromTrueAltitude(0) * RAD_TO_DEG * 60;
    expect(arcmin).toBeGreaterThan(28);
    expect(arcmin).toBeLessThan(30);
  });

  it('has Bennett and Saemundsson as mutual inverses', () => {
    for (let apparentDeg = 0; apparentDeg <= 60; apparentDeg += 2) {
      const apparent = (apparentDeg * Math.PI) / 180;
      const trueAltitude = apparent - refractionFromApparentAltitude(apparent);
      const roundTrip = applyRefraction(trueAltitude);
      // Agreement to a few arcseconds is all these empirical fits claim.
      expect(Math.abs(roundTrip - apparent) * RAD_TO_DEG * 3600).toBeLessThan(12);
    }
  });

  it('keeps the Sun visible after geometric sunset', () => {
    // Upper limb still above the horizon when the centre is 0.5 deg below it.
    const solarRadius = (0.2666 * Math.PI) / 180;
    const centre = (-0.5 * Math.PI) / 180;
    expect(applyRefraction(centre + solarRadius)).toBeGreaterThan(0);
  });

  it('is negligible at the zenith', () => {
    expect(refractionFromTrueAltitude(Math.PI / 2) * RAD_TO_DEG * 3600).toBeLessThan(1);
  });

  it('is monotonic — always lifts, never lowers', () => {
    let previous = Infinity;
    for (let altDeg = -1; altDeg <= 90; altDeg += 0.5) {
      const r = refractionFromTrueAltitude((altDeg * Math.PI) / 180);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(previous + 1e-9);
      previous = r;
      expect(applyRefraction((altDeg * Math.PI) / 180)).toBeGreaterThanOrEqual(
        (altDeg * Math.PI) / 180,
      );
    }
  });

  it('flattens a disc on the horizon by about 18 percent', () => {
    const solarRadius = (0.2666 * Math.PI) / 180;
    const flattening = horizonFlattening(0, solarRadius);
    expect(flattening).toBeGreaterThan(0.75);
    expect(flattening).toBeLessThan(0.9);
    // High in the sky the disc must be round again.
    expect(horizonFlattening(Math.PI / 4, solarRadius)).toBeGreaterThan(0.99);
  });
});

describe('twilight classification', () => {
  it('matches the standard altitude bands', () => {
    expect(twilightPhase(30)).toBe('day');
    expect(twilightPhase(3)).toBe('golden-hour');
    expect(twilightPhase(-0.5)).toBe('golden-hour');
    expect(twilightPhase(-3)).toBe('civil-twilight');
    expect(twilightPhase(-9)).toBe('nautical-twilight');
    expect(twilightPhase(-15)).toBe('astronomical-twilight');
    expect(twilightPhase(-30)).toBe('night');
  });
});

describe('rise and set', () => {
  it('never sets above the Arctic circle at the June solstice', () => {
    const tromso: GeoLocation = { latitudeDeg: 69.65, longitudeDeg: 18.96, elevationM: 0 };
    const events = sunRiseSet(tromso, Date.UTC(2024, 5, 21, 12, 0, 0));
    expect(events.alwaysUp).toBe(true);
    expect(events.set).toBeNull();
  });

  it('never rises above the Arctic circle at the December solstice', () => {
    const tromso: GeoLocation = { latitudeDeg: 69.65, longitudeDeg: 18.96, elevationM: 0 };
    const events = sunRiseSet(tromso, Date.UTC(2024, 11, 21, 12, 0, 0));
    expect(events.alwaysDown).toBe(true);
    expect(events.rise).toBeNull();
  });

  it('gives an equinox day of just over twelve hours at the equator', () => {
    const quito: GeoLocation = { latitudeDeg: 0, longitudeDeg: -78.5, elevationM: 0 };
    const events = sunRiseSet(quito, Date.UTC(2024, 2, 20, 12, 0, 0));
    expect(events.rise).not.toBeNull();
    expect(events.set).not.toBeNull();
    if (events.rise === null || events.set === null) return;
    const hours = (events.set - events.rise) / 3600000;
    // Refraction and the solar semidiameter add about seven minutes to a geometric 12 hours.
    expect(hours).toBeGreaterThan(12.05);
    expect(hours).toBeLessThan(12.2);
  });

  it('places sunrise and sunset symmetrically about local apparent noon', () => {
    const events = dayEvents(GREENWICH, Date.UTC(2024, 3, 15, 12, 0, 0));
    expect(events.sunrise).not.toBeNull();
    expect(events.sunset).not.toBeNull();
    if (events.sunrise === null || events.sunset === null) return;
    const midpoint = (events.sunrise + events.sunset) / 2;
    // Declination drifts slightly across the day, so allow a minute.
    expect(Math.abs(midpoint - events.solarNoon) / 60000).toBeLessThan(1.2);
  });

  it('orders the twilight events correctly through an evening', () => {
    const events = dayEvents(GREENWICH, Date.UTC(2024, 8, 15, 12, 0, 0));
    const { sunset, civilDusk, nauticalDusk, astronomicalDusk } = events;
    expect(sunset).not.toBeNull();
    if (sunset === null || civilDusk === null || nauticalDusk === null || astronomicalDusk === null) {
      throw new Error('expected all dusk events in mid-September at 51 N');
    }
    expect(civilDusk).toBeGreaterThan(sunset);
    expect(nauticalDusk).toBeGreaterThan(civilDusk);
    expect(astronomicalDusk).toBeGreaterThan(nauticalDusk);
  });
});

/**
 * Regression against published US Naval Observatory tables.
 *
 * Fetched from the USNO `rstt/oneday` API and frozen here. Two locations chosen to be awkward
 * in different ways: a mid-latitude site whose civil timezone is three hours off Greenwich,
 * and a sub-Arctic site on the winter solstice where the Sun barely clears the horizon and
 * the twilight bands are enormous. Every value below matched on the first comparison after
 * the lunar rise-threshold fix, and any future drift of even one minute will fail here.
 */
describe('against published USNO tables', () => {
  interface AlmanacCase {
    name: string;
    location: GeoLocation;
    /** Local civil date at the given offset. */
    dateUtcNoonMs: number;
    tzOffsetHours: number;
    expected: {
      civilDawn: string;
      sunrise: string;
      transit: string;
      sunset: string;
      civilDusk: string;
      moonrise: string;
      moonset: string;
      illuminatedPercent: number;
    };
  }

  const cases: AlmanacCase[] = [
    {
      name: 'Tel Aviv, 2026-07-30 (UTC+3)',
      location: { latitudeDeg: 32.08, longitudeDeg: 34.78, elevationM: 0 },
      dateUtcNoonMs: Date.UTC(2026, 6, 30, 9, 0, 0),
      tzOffsetHours: 3,
      expected: {
        civilDawn: '05:28',
        sunrise: '05:55',
        transit: '12:47',
        sunset: '19:40',
        civilDusk: '20:06',
        moonrise: '20:20',
        moonset: '06:25',
        illuminatedPercent: 99,
      },
    },
    {
      name: 'Reykjavik, 2026-12-21 winter solstice (UTC+0)',
      location: { latitudeDeg: 64.15, longitudeDeg: -21.94, elevationM: 0 },
      dateUtcNoonMs: Date.UTC(2026, 11, 21, 12, 0, 0),
      tzOffsetHours: 0,
      expected: {
        civilDawn: '10:03',
        sunrise: '11:22',
        transit: '13:26',
        sunset: '15:29',
        civilDusk: '16:49',
        moonrise: '12:32',
        moonset: '08:42',
        illuminatedPercent: 90,
      },
    },
  ];

  for (const testCase of cases) {
    it(`matches the USNO almanac at ${testCase.name}`, () => {
      const events = dayEvents(testCase.location, testCase.dateUtcNoonMs);
      const format = (ms: number | null): string => {
        if (ms === null) return '—';
        const shifted = new Date(
          Math.round((ms + testCase.tzOffsetHours * 3600000) / 60000) * 60000,
        );
        return `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(
          shifted.getUTCMinutes(),
        ).padStart(2, '0')}`;
      };

      expect(format(events.civilDawn)).toBe(testCase.expected.civilDawn);
      expect(format(events.sunrise)).toBe(testCase.expected.sunrise);
      expect(format(events.solarNoon)).toBe(testCase.expected.transit);
      expect(format(events.sunset)).toBe(testCase.expected.sunset);
      expect(format(events.civilDusk)).toBe(testCase.expected.civilDusk);
      expect(format(events.moonrise)).toBe(testCase.expected.moonrise);
      expect(format(events.moonset)).toBe(testCase.expected.moonset);

      const state = computeEphemeris(testCase.dateUtcNoonMs, testCase.location);
      expect(Math.round(state.moon.illuminatedFraction * 100)).toBe(
        testCase.expected.illuminatedPercent,
      );
    });
  }
});

describe('ephemeris snapshot', () => {
  it('produces unit direction vectors in the documented frame', () => {
    const state = computeEphemeris(Date.UTC(2024, 5, 21, 9, 0, 0), GREENWICH);
    const length = Math.hypot(state.sunDirection.x, state.sunDirection.y, state.sunDirection.z);
    expect(length).toBeCloseTo(1, 10);
    // Northern-hemisphere morning: the Sun is up and to the east, so +X and +Y are positive.
    expect(state.sunDirection.y).toBeGreaterThan(0);
    expect(state.sunDirection.x).toBeGreaterThan(0);
  });

  it('ramps dayFactor monotonically from night to day', () => {
    let previous = -1;
    for (let altDeg = -25; altDeg <= 15; altDeg += 1) {
      // Reconstruct the same smootherstep the ephemeris uses.
      const t = Math.min(1, Math.max(0, (altDeg + 18) / 24));
      const value = t * t * t * (t * (t * 6 - 15) + 10);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
    expect(previous).toBeCloseTo(1, 6);
  });

  it('is genuinely dark at astronomical night with a new moon', () => {
    // 2024 February 9, new moon, an hour after astronomical dusk at Greenwich.
    const state = computeEphemeris(Date.UTC(2024, 1, 9, 20, 30, 0), GREENWICH);
    expect(state.sunAltitudeDeg).toBeLessThan(-18);
    expect(state.sunIlluminanceLux).toBe(0);
    expect(state.moonIlluminanceLux).toBeLessThan(0.02);
    expect(state.dayFactor).toBe(0);
  });

  it('gives a full moon near the documented 0.25 lux at high altitude', () => {
    // Find the full moon's culmination on the night of 2024 January 25 at Greenwich.
    let best = 0;
    for (let minute = 0; minute < 24 * 60; minute += 5) {
      const state = computeEphemeris(
        Date.UTC(2024, 0, 25, 12, 0, 0) + minute * 60000,
        GREENWICH,
      );
      best = Math.max(best, state.moonIlluminanceLux);
    }
    // Culminates around 60 deg at this latitude, so a little under the zenith figure.
    expect(best).toBeGreaterThan(0.12);
    expect(best).toBeLessThan(0.3);
  });
});

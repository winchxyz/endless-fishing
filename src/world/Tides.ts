import type { GeoLocation } from '../astro/Coordinates.js';
import { computeEphemeris } from '../astro/Ephemeris.js';
import { hourAngle } from '../astro/SiderealTime.js';
import type { Engine, System } from '../core/Engine.js';

/**
 * The tide, from the real Sun and Moon.
 *
 * This is Newton's equilibrium tide, not a sine of the wall clock. The height at an instant is
 * the tide-generating potential of each body evaluated at the observer's latitude and the
 * body's *geocentric* hour angle and declination, which the ephemeris already knows to a few
 * arcseconds.
 *
 * Everything a player recognises about tides falls out of that sum rather than being scripted:
 *
 *   * Two highs and two lows in a **lunar** day of 24 h 50 m, because the potential's dominant
 *     term goes as cos 2H and H is the *Moon's* hour angle, not the Sun's. The tide is
 *     therefore fifty minutes later every day, exactly as a tide table shows.
 *   * Spring tides at new and full moon and neaps at the quarters, because at syzygy the two
 *     bodies share an hour angle (or differ by exactly 180°, which cos 2H cannot tell apart)
 *     and their semi-diurnal terms add, while at quadrature they are 90° apart and subtract.
 *   * Diurnal inequality — one of the day's two highs visibly taller than the other — whenever
 *     the Moon is well off the equator, from the cos H term the same expansion produces.
 *
 * The absolute scale is *not* the equilibrium value. A rigid-Earth equilibrium tide has a range
 * of only about 0.54 m at springs; real coasts see several times that because the shelf and the
 * basin resonate with the forcing. `TIDAL_AMPLIFICATION` is that shelf response, and it is the
 * one number here chosen for the look of the coastline rather than derived.
 */

/** Mean radius of the Earth, metres. */
const EARTH_RADIUS_M = 6371000;
/** Moon mass in Earth masses. */
const MOON_MASS_RATIO = 0.0123000371;
/** Sun mass in Earth masses. */
const SUN_MASS_RATIO = 332946.0487;
/** Astronomical unit, metres. */
const AU_M = 1.495978707e11;

/**
 * Shelf amplification. The solar-to-lunar ratio, the spring-neap ratio and the phase are all
 * derived; only the overall gain is a choice, and this one puts spring range at about 1.7 m and
 * neap range at about 0.6 m — a modest northern-coast tide rather than a Bay of Fundy one.
 */
const TIDAL_AMPLIFICATION = 3.2;

/**
 * Lunitidal interval: how long high water lags the Moon's transit, hours.
 *
 * Water has inertia and the basin takes time to fill, so nowhere on Earth does high water
 * coincide with the Moon overhead. The real interval is a property of each port and is
 * tabulated as its "establishment"; a single mean value is the right idealisation for an
 * endless procedural coast, and it is applied by evaluating the potential in the past rather
 * than by phase-shifting a sine, so it stays correct as the Moon's own motion varies.
 */
const LUNITIDAL_INTERVAL_HOURS = 1.8;

/** Hours ahead the HUD forecast looks. Covers three semi-diurnal cycles with room to spare. */
const FORECAST_HOURS = 38;
/** Sampling interval of the forecast scan, minutes. */
const FORECAST_STEP_MINUTES = 6;

export type TideDirection = 'flood' | 'ebb';

export interface TideEvent {
  /** UTC epoch milliseconds of the turn. */
  epochMs: number;
  /** Water level at the turn, metres relative to mean sea level. */
  heightM: number;
  kind: 'high' | 'low';
}

/**
 * Equilibrium tide height from one body, metres.
 *
 * `ζ = (M/M⊕)(a/d)³ · a · (3cos²θ − 1)/2`, with θ the geocentric zenith angle. Substituting
 * `cos θ = sinφ sinδ + cosφ cosδ cos H` and expanding produces the long-period, diurnal
 * (cos H) and semi-diurnal (cos 2H) species; there is nothing to add by hand.
 */
function bodyTide(
  massRatio: number,
  distanceM: number,
  latitudeRad: number,
  declinationRad: number,
  hourAngleRad: number,
): number {
  const ratio = EARTH_RADIUS_M / distanceM;
  const coefficient = massRatio * ratio * ratio * ratio * EARTH_RADIUS_M;
  const cosZenith =
    Math.sin(latitudeRad) * Math.sin(declinationRad) +
    Math.cos(latitudeRad) * Math.cos(declinationRad) * Math.cos(hourAngleRad);
  return coefficient * 1.5 * (cosZenith * cosZenith - 1 / 3);
}

/**
 * Water level at an instant, metres above mean sea level.
 *
 * Pure: give it a time and a place and it answers, which is what lets the HUD forecast and the
 * unit tests use exactly the code the frame loop uses.
 *
 * The *geocentric* equatorial coordinates are the right ones here even though the sky is drawn
 * from topocentric ones — the potential is raised by where the body is relative to the Earth's
 * centre, not relative to the observer's eye.
 */
export function tideHeightAt(epochMs: number, location: GeoLocation): number {
  const forcingMs = epochMs - LUNITIDAL_INTERVAL_HOURS * 3600000;
  const state = computeEphemeris(forcingMs, location);
  const latitude = (location.latitudeDeg * Math.PI) / 180;

  const moon = state.moon.equatorial;
  const sun = state.sun.equatorial;

  const lunar = bodyTide(
    MOON_MASS_RATIO,
    state.moon.distanceKm * 1000,
    latitude,
    moon.declination,
    hourAngle(state.siderealTime, moon.rightAscension),
  );
  const solar = bodyTide(
    SUN_MASS_RATIO,
    state.sun.distanceAu * AU_M,
    latitude,
    sun.declination,
    hourAngle(state.siderealTime, sun.rightAscension),
  );

  return (lunar + solar) * TIDAL_AMPLIFICATION;
}

/**
 * Every high and low water in the next `hours`.
 *
 * A coarse scan brackets each turn, then the vertex of the parabola through the three samples
 * around it gives the time. That is exact for a parabola and the tide curve is locally very
 * close to one, so six-minute samples land the turn inside half a minute — finer than a tide
 * table prints.
 */
export function forecastTides(
  epochMs: number,
  location: GeoLocation,
  hours = FORECAST_HOURS,
  stepMinutes = FORECAST_STEP_MINUTES,
): TideEvent[] {
  const stepMs = stepMinutes * 60000;
  const samples = Math.max(3, Math.ceil((hours * 60) / stepMinutes));
  const events: TideEvent[] = [];

  let previous = tideHeightAt(epochMs - stepMs, location);
  let current = tideHeightAt(epochMs, location);

  for (let i = 1; i <= samples; i += 1) {
    const time = epochMs + i * stepMs;
    const next = tideHeightAt(time, location);
    const rising = current > previous;
    const falling = current > next;

    if (rising === falling) {
      // `current` is a local extremum of the three-point window. The parabola through the
      // samples turns at this offset, in units of the sample interval.
      const denominator = previous - 2 * current + next;
      const offset = denominator === 0 ? 0 : (0.5 * (previous - next)) / denominator;
      const turnMs = time - stepMs + offset * stepMs;
      events.push({
        epochMs: turnMs,
        heightM: tideHeightAt(turnMs, location),
        kind: rising ? 'high' : 'low',
      });
    }

    previous = current;
    current = next;
  }

  return events;
}

/**
 * Writes `world.tideHeight`, and nothing else.
 *
 * Runs between Sky (which produces the ephemeris) and Ocean (whose mean water level is this
 * value), so every system downstream sees one water level for the frame.
 */
export class Tides implements System {
  readonly name = 'tides';
  readonly priority = 5;

  /** Turns of the tide from now to the end of the forecast window, earliest first. */
  private events: TideEvent[] = [];
  private forecastEpochMs = 0;
  private location: GeoLocation = { latitudeDeg: 0, longitudeDeg: 0, elevationM: 0 };

  private height = 0;
  private lastHeight = 0;
  private high = 0;
  private low = 0;

  /** Water level this frame, metres above mean sea level. Mirrors `world.tideHeight`. */
  get heightM(): number {
    return this.height;
  }

  /** Highest water in the forecast window — the top of the wet-sand band on the beaches. */
  get highWaterMarkM(): number {
    return this.high;
  }

  /** Lowest water in the forecast window — the bottom of the band. */
  get lowWaterMarkM(): number {
    return this.low;
  }

  /** Which way the water is going. The HUD says "flooding" or "ebbing"; the fish care too. */
  get direction(): TideDirection {
    return this.height >= this.lastHeight ? 'flood' : 'ebb';
  }

  /** Next high water, or null in the vanishingly rare case that none falls in the window. */
  nextHighWater(): TideEvent | null {
    return this.nextOf('high');
  }

  nextLowWater(): TideEvent | null {
    return this.nextOf('low');
  }

  /** The whole forecast, for a HUD tide curve. */
  get forecast(): readonly TideEvent[] {
    return this.events;
  }

  update(_dt: number, engine: Engine): void {
    const settings = engine.settings.world;
    const epochMs = engine.time.epochMs;

    // Rebuild when the player moves the boat to a new latitude, or once the earliest predicted
    // turn is behind us. That is a handful of ephemeris evaluations every six hours, rather
    // than three hundred every frame.
    const first = this.events[0];
    const stale =
      first === undefined ||
      first.epochMs <= epochMs ||
      Math.abs(epochMs - this.forecastEpochMs) > 6 * 3600000 ||
      this.location.latitudeDeg !== settings.latitudeDeg ||
      this.location.longitudeDeg !== settings.longitudeDeg;

    if (stale) {
      this.location = {
        latitudeDeg: settings.latitudeDeg,
        longitudeDeg: settings.longitudeDeg,
        elevationM: 0,
      };
      this.forecastEpochMs = epochMs;
      this.events = forecastTides(epochMs, this.location);
      this.refreshMarks();
    }

    this.lastHeight = this.height;
    this.height = tideHeightAt(epochMs, this.location);
    engine.world.tideHeight = this.height;
  }

  private nextOf(kind: 'high' | 'low'): TideEvent | null {
    for (const event of this.events) {
      if (event.kind === kind) return event;
    }
    return null;
  }

  /**
   * The band the beach has to cover. Taken from the forecast rather than from the spring range
   * so a neap week genuinely leaves a narrower strip of wet sand than a spring week does.
   */
  private refreshMarks(): void {
    let high = 0;
    let low = 0;
    for (const event of this.events) {
      if (event.heightM > high) high = event.heightM;
      if (event.heightM < low) low = event.heightM;
    }
    this.high = high;
    this.low = low;
  }
}

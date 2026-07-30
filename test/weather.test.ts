import { describe, expect, it } from 'vitest';
import { beaufortFromWindSpeed } from '../src/core/WorldState.js';
import {
  BEAUFORT_UPPER_LIMITS_MS,
  WEATHER_STATES,
  WeatherModel,
  continuousBeaufort,
  createSynopticSample,
  type SynopticSample,
  type WeatherStateName,
} from '../src/world/Weather.js';

/**
 * Weather validation.
 *
 * The synoptic model is the one piece of this subsystem that can be tested without a GPU, and
 * the four things worth testing are the four things that would be invisible when wrong:
 *
 *   1. **The Beaufort scale is the real one.** The scale is defined by wind-speed limits, not by
 *      a formula, and `Weather.ts` keeps its own copy of those limits in order to interpolate
 *      *within* a force. Two copies of a table is a bug waiting to happen, so this asserts they
 *      agree at every boundary and on both sides of it.
 *   2. **The field is a function.** Same seed, same position, same hour, same weather — because
 *      "the same seed gives the same world" has to survive a system that is driven by noise.
 *   3. **It is continuous.** A weather system that teleports is the failure mode this whole
 *      design exists to avoid, so the wind is walked through a full simulated day and every
 *      step of it is checked against a bound.
 *   4. **All eight states happen, and in a physically possible order.** Reachability is easy to
 *      lose to a threshold that is a fraction too tight; ordering is what the brief actually
 *      cares about, and it is asserted directly rather than assumed from the damping.
 */

/** A northern sea, matching the art direction, and the shipped default seed. */
const SEED = 0x5eed_f15e;
const LATITUDE = 55;
/** Simulation step, seconds. The engine's frame time; the model is stepped on the world clock. */
const STEP_SECONDS = 2;

function runFor(model: WeatherModel, hours: number, onSample?: (m: WeatherModel) => void): void {
  const steps = Math.round((hours * 3600) / STEP_SECONDS);
  for (let i = 0; i < steps; i += 1) {
    model.step(STEP_SECONDS, 0, 0);
    onSample?.(model);
  }
}

function angleDelta(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

describe('Beaufort scale', () => {
  it('reproduces the real boundaries exactly', () => {
    // The published scale, restated here rather than imported, so that a change to either copy
    // in the source has to be justified against the literature and not against the other copy.
    const limits = [0.5, 1.5, 3.3, 5.5, 7.9, 10.7, 13.8, 17.1, 20.7, 24.4, 28.4, 32.6];
    expect([...BEAUFORT_UPPER_LIMITS_MS]).toEqual(limits);

    for (let force = 0; force < limits.length; force += 1) {
      const limit = limits[force] ?? 0;
      // A limit is the *exclusive* top of its force and the inclusive bottom of the next.
      expect(beaufortFromWindSpeed(limit - 1e-9)).toBe(force);
      expect(beaufortFromWindSpeed(limit)).toBe(force + 1);
    }
    expect(beaufortFromWindSpeed(0)).toBe(0);
    expect(beaufortFromWindSpeed(40)).toBe(12);
  });

  it('interpolates inside a force without changing which force it is', () => {
    for (let v = 0; v <= 40; v += 0.01) {
      const continuous = continuousBeaufort(v);
      expect(Math.floor(continuous)).toBe(beaufortFromWindSpeed(v));
    }
    // Exactly on a boundary the fractional part must be zero, or the state memberships would
    // straddle two forces at the one speed where the scale is unambiguous.
    for (let force = 0; force < BEAUFORT_UPPER_LIMITS_MS.length; force += 1) {
      const limit = BEAUFORT_UPPER_LIMITS_MS[force] ?? 0;
      expect(continuousBeaufort(limit)).toBeCloseTo(force + 1, 10);
    }
    expect(continuousBeaufort(-5)).toBe(0);
  });

  it('gives every state a window inside the scale it claims', () => {
    for (const state of WEATHER_STATES) {
      expect(state.beaufortLow).toBeLessThanOrEqual(state.beaufortHigh);
      expect(state.beaufortHigh).toBeLessThanOrEqual(12);
      expect(state.cloudiness).toBeGreaterThanOrEqual(0);
      expect(state.cloudiness).toBeLessThanOrEqual(1);
      expect(state.visibilityM).toBeGreaterThan(0);
    }
    expect(WEATHER_STATES).toHaveLength(8);
  });
});

describe('the synoptic field', () => {
  it('is deterministic for a fixed seed', () => {
    const a = new WeatherModel(SEED, LATITUDE);
    const b = new WeatherModel(SEED, LATITUDE);
    const sampleA = createSynopticSample();
    const sampleB = createSynopticSample();

    for (let hour = 0; hour < 400; hour += 3.7) {
      const x = hour * 1300 - 40000;
      const z = 25000 - hour * 700;
      a.probeAt(x, z, hour, sampleA);
      b.probeAt(x, z, hour, sampleB);
      for (const key of Object.keys(sampleA) as (keyof SynopticSample)[]) {
        expect(sampleB[key]).toBe(sampleA[key]);
      }
    }
  });

  it('gives a different world to a different seed', () => {
    const a = new WeatherModel(SEED, LATITUDE);
    const b = new WeatherModel(SEED + 1, LATITUDE);
    const sampleA = createSynopticSample();
    const sampleB = createSynopticSample();
    let differences = 0;
    for (let hour = 0; hour < 200; hour += 5) {
      a.probeAt(0, 0, hour, sampleA);
      b.probeAt(0, 0, hour, sampleB);
      if (Math.abs(sampleA.pressureHpa - sampleB.pressureHpa) > 0.5) differences += 1;
    }
    expect(differences).toBeGreaterThan(30);
  });

  it('replays identically when stepped twice', () => {
    const a = new WeatherModel(SEED, LATITUDE);
    const b = new WeatherModel(SEED, LATITUDE);
    runFor(a, 2);
    runFor(b, 2);
    expect(b.state).toBe(a.state);
    expect(b.current.windSpeed).toBe(a.current.windSpeed);
    expect(b.current.cloudiness).toBe(a.current.cloudiness);
    expect(b.fetch).toBe(a.fetch);
  });

  it('keeps every quantity inside its physical range', () => {
    const model = new WeatherModel(SEED, LATITUDE);
    runFor(model, 8, (m) => {
      const s = m.current;
      expect(s.pressureHpa).toBeGreaterThan(940);
      expect(s.pressureHpa).toBeLessThan(1070);
      expect(s.windSpeed).toBeGreaterThanOrEqual(0);
      expect(s.windSpeed).toBeLessThanOrEqual(27);
      expect(s.cloudiness).toBeGreaterThanOrEqual(0);
      expect(s.cloudiness).toBeLessThanOrEqual(1);
      expect(s.precipitation).toBeGreaterThanOrEqual(0);
      expect(s.precipitation).toBeLessThanOrEqual(1);
      expect(s.visibilityM).toBeGreaterThan(50);
      expect(s.visibilityM).toBeLessThan(40000);
      expect(Number.isFinite(s.windDirection)).toBe(true);
      expect(m.fetch).toBeGreaterThanOrEqual(25);
      expect(m.fetch).toBeLessThanOrEqual(700);
    });
  });
});

describe('continuity over a simulated day', () => {
  /**
   * Bounds for one minute of real time, which is about three quarters of an hour of synoptic
   * time. A cold front can genuinely take the wind up several metres a second and swing it most
   * of a quadrant in that long, so these are set to admit real weather and reject a jump — they
   * are a small fraction of the model's full range (0–26 m/s, a whole circle), which is what
   * "continuous" has to mean for a field that is deliberately allowed to change.
   */
  const MAX_SPEED_CHANGE_PER_MINUTE = 6;
  const MAX_DIRECTION_CHANGE_PER_MINUTE = Math.PI / 2;
  /** Below force 2 the direction of the wind is not a physically meaningful quantity at sea. */
  const DIRECTION_VALID_ABOVE_MS = 2.5;

  it('never jumps between consecutive minutes', () => {
    const model = new WeatherModel(SEED, LATITUDE);
    const stepsPerMinute = 60 / STEP_SECONDS;
    let previousSpeed = -1;
    let previousDirection = 0;
    let worstSpeed = 0;
    let worstDirection = 0;

    for (let minute = 0; minute < 24 * 60; minute += 1) {
      for (let i = 0; i < stepsPerMinute; i += 1) model.step(STEP_SECONDS, 0, 0);
      const { windSpeed, windDirection } = model.current;
      if (previousSpeed >= 0) {
        worstSpeed = Math.max(worstSpeed, Math.abs(windSpeed - previousSpeed));
        if (windSpeed > DIRECTION_VALID_ABOVE_MS && previousSpeed > DIRECTION_VALID_ABOVE_MS) {
          worstDirection = Math.max(
            worstDirection,
            Math.abs(angleDelta(windDirection, previousDirection)),
          );
        }
      }
      previousSpeed = windSpeed;
      previousDirection = windDirection;
    }

    expect(worstSpeed).toBeLessThan(MAX_SPEED_CHANGE_PER_MINUTE);
    expect(worstDirection).toBeLessThan(MAX_DIRECTION_CHANGE_PER_MINUTE);
  });

  it('moves smoothly on the frame clock too', () => {
    // Per simulation step the bound is much tighter, which is the statement that actually
    // matters on screen: nothing the player can see is allowed to step.
    const model = new WeatherModel(SEED, LATITUDE);
    let previous = -1;
    let worst = 0;
    runFor(model, 6, (m) => {
      if (previous >= 0) worst = Math.max(worst, Math.abs(m.current.windSpeed - previous));
      previous = m.current.windSpeed;
    });
    expect(worst).toBeLessThan(0.5);
  });

  it('cloud and visibility take minutes rather than seconds to change', () => {
    const model = new WeatherModel(SEED, LATITUDE);
    let previousCloud = -1;
    let worstCloud = 0;
    runFor(model, 12, (m) => {
      if (previousCloud >= 0) worstCloud = Math.max(worstCloud, Math.abs(m.current.cloudiness - previousCloud));
      previousCloud = m.current.cloudiness;
    });
    // The cloud fraction is damped with a time constant near three minutes, so a single two
    // second step can only ever close about one per cent of the way to its target.
    expect(worstCloud).toBeLessThan(0.02);
  });
});

describe('state classification', () => {
  /**
   * Severity ladder used only by the ordering assertions below. Fog is deliberately absent: it
   * is orthogonal to the rest — it is about the airmass and the absence of wind, not about how
   * bad the weather is — and it can legitimately sit next to almost anything.
   */
  const LADDER: Record<WeatherStateName, number> = {
    'dead-calm': 0,
    'light-breeze': 1,
    'partly-cloudy': 2,
    overcast: 3,
    rain: 4,
    thunderstorm: 5,
    storm: 6,
    fog: -1,
  };
  const FAIR: readonly WeatherStateName[] = ['dead-calm', 'light-breeze', 'partly-cloudy', 'fog'];

  function walk(seed: number, latitudeDeg: number, hours: number): WeatherStateName[] {
    const model = new WeatherModel(seed, latitudeDeg);
    const sequence: WeatherStateName[] = [];
    let last: WeatherStateName | undefined;
    runFor(model, hours, (m) => {
      const state = m.state;
      if (state !== last) {
        sequence.push(state);
        last = state;
      }
    });
    return sequence;
  }

  it('reaches all eight states over a long run', () => {
    const seen = new Set(walk(SEED, LATITUDE, 20));
    for (const state of WEATHER_STATES) {
      expect(seen).toContain(state.name);
    }
  });

  it('reaches all eight in the southern hemisphere as well', () => {
    // The Coriolis term changes sign below the equator, so the whole circulation runs the other
    // way. If that sign were wrong the wind would blow out of lows instead of into them and the
    // cloudy states would become unreachable — which is exactly what this catches.
    const seen = new Set(walk(SEED, -42, 20));
    for (const state of WEATHER_STATES) {
      expect(seen).toContain(state.name);
    }
  });

  it('never goes from clear to storm without clouding over first', () => {
    for (const seed of [SEED, 1, 12345, 777_777]) {
      const sequence = walk(seed, LATITUDE, 20);
      expect(sequence.length).toBeGreaterThan(20);
      for (let i = 1; i < sequence.length; i += 1) {
        const from = sequence[i - 1];
        const to = sequence[i];
        if (from === undefined || to === undefined) continue;
        const clearToStorm = FAIR.includes(from) && to === 'storm';
        const stormToClear = from === 'storm' && FAIR.includes(to);
        expect(clearToStorm || stormToClear, `illegal transition ${from} -> ${to}`).toBe(false);
      }
      // Stronger: every arrival at a storm is reached through weather that is already thick.
      const arrivals = sequence.filter((_, i) => sequence[i] === 'storm' && i > 0);
      expect(arrivals.length).toBeGreaterThan(0);
      for (let i = 1; i < sequence.length; i += 1) {
        if (sequence[i] !== 'storm') continue;
        expect(['overcast', 'rain', 'thunderstorm']).toContain(sequence[i - 1]);
      }
    }
  });

  it('never climbs more than three rungs of the severity ladder at once', () => {
    const sequence = walk(SEED, LATITUDE, 20);
    for (let i = 1; i < sequence.length; i += 1) {
      const from = sequence[i - 1];
      const to = sequence[i];
      if (from === undefined || to === undefined) continue;
      const a = LADDER[from];
      const b = LADDER[to];
      if (a < 0 || b < 0) continue;
      expect(Math.abs(a - b), `${from} -> ${to}`).toBeLessThanOrEqual(3);
    }
  });

  it('reports a blend towards a real neighbouring state', () => {
    const model = new WeatherModel(SEED, LATITUDE);
    runFor(model, 4, (m) => {
      expect(m.blend).toBeGreaterThanOrEqual(0);
      expect(m.blend).toBeLessThanOrEqual(1);
      expect(WEATHER_STATES.map((s) => s.name)).toContain(m.neighbour.name);
    });
  });

  it('pins the state when a weather override is set', () => {
    for (const state of WEATHER_STATES) {
      const model = new WeatherModel(SEED, LATITUDE);
      model.setOverride(state.name);
      runFor(model, 0.5);
      expect(model.state).toBe(state.name);
      expect(model.blend).toBe(0);
      // A pinned state still arrives smoothly rather than snapping, so the cloud fraction is
      // on its way to the target after half an hour rather than sitting exactly on it.
      expect(Math.abs(model.current.cloudiness - state.cloudiness)).toBeLessThan(0.05);
    }
  });

  it('releases the override again', () => {
    const model = new WeatherModel(SEED, LATITUDE);
    model.setOverride('storm');
    runFor(model, 0.5);
    expect(model.state).toBe('storm');
    model.setOverride(null);
    runFor(model, 2);
    expect(model.state).not.toBe('storm');
  });
});

describe('the barometer', () => {
  it('falls before the cloud thickens', () => {
    // The physical claim the whole model rests on: cloud follows *falling* pressure, so over a
    // long run the trend and the cloud fraction must be negatively correlated.
    const model = new WeatherModel(SEED, LATITUDE);
    let sum = 0;
    let trendSum = 0;
    let cloudSum = 0;
    let trendSq = 0;
    let cloudSq = 0;
    let n = 0;
    runFor(model, 16, (m) => {
      const t = m.current.trendHpaPerHour;
      const c = m.current.cloudiness;
      sum += t * c;
      trendSum += t;
      cloudSum += c;
      trendSq += t * t;
      cloudSq += c * c;
      n += 1;
    });
    const covariance = sum / n - (trendSum / n) * (cloudSum / n);
    const spread =
      Math.sqrt(trendSq / n - (trendSum / n) ** 2) * Math.sqrt(cloudSq / n - (cloudSum / n) ** 2);
    expect(covariance / spread).toBeLessThan(-0.2);
  });

  it('sees severe weather coming before it arrives', () => {
    // Every onset of a storm must have been announced beforehand. The check is on the *onset*
    // and not on the whole episode, because once the storm is overhead there is nothing left to
    // forecast — the barometer's job is the half hour before it, and that is what is asserted.
    const model = new WeatherModel(SEED, LATITUDE);
    const warning = { approaching: false, minutesAway: 0 };
    let warned = 0;
    let onsets = 0;
    let unannounced = 0;
    let lastWarnedAt = Number.NEGATIVE_INFINITY;
    let previousState = model.state;
    let minute = 0;

    for (let i = 0; i < (20 * 3600) / STEP_SECONDS; i += 1) {
      model.step(STEP_SECONDS, 0, 0);
      minute += STEP_SECONDS / 60;
      const state = model.state;
      if (i % 30 === 0) {
        model.forecast(0, 0, warning);
        if (warning.approaching) {
          warned += 1;
          lastWarnedAt = minute;
          expect(warning.minutesAway).toBeGreaterThanOrEqual(0);
          expect(warning.minutesAway).toBeLessThanOrEqual(30);
        }
      }
      if (state === 'storm' && previousState !== 'storm') {
        onsets += 1;
        if (minute - lastWarnedAt > 40) unannounced += 1;
      }
      previousState = state;
    }

    expect(warned).toBeGreaterThan(0);
    expect(onsets).toBeGreaterThan(0);
    expect(unannounced).toBe(0);
  });
});

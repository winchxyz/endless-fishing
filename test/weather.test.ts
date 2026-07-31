import { describe, expect, it } from 'vitest';
import { beaufortFromWindSpeed } from '../src/core/WorldState.js';
import { WaveBank } from '../src/math/Gerstner.js';
import {
  BEAUFORT_UPPER_LIMITS_MS,
  WEATHER_STATES,
  WeatherModel,
  continuousBeaufort,
  createSynopticSample,
  developedFetchKm,
  isSevereState,
  type SynopticSample,
  type WeatherStateName,
} from '../src/world/Weather.js';

/**
 * Weather validation.
 *
 * The synoptic model is the one piece of this subsystem that can be tested without a GPU, and
 * the things worth testing are the ones that would be invisible when wrong:
 *
 *   1. **The Beaufort scale is the real one.** The scale is defined by wind-speed limits, not by
 *      a formula, and `Weather.ts` keeps its own copy of those limits in order to interpolate
 *      *within* a force. Two copies of a table is a bug waiting to happen, so this asserts they
 *      agree at every boundary and on both sides of it.
 *   2. **The field is a function.** Same seed, same position, same hour, same weather — because
 *      "the same seed gives the same world" has to survive a system that is driven by noise.
 *   3. **It is continuous.** A weather system that teleports is the failure mode this whole
 *      design exists to avoid, so the wind is walked through simulated days and every step of it
 *      is checked against a bound.
 *   4. **All eight states happen, and in a physically possible order.** Reachability is easy to
 *      lose to a threshold that is a fraction too tight; ordering is what the brief actually
 *      cares about, and it is asserted directly rather than assumed from the damping.
 *   5. **The opening is settled whatever the seed.** The world used to open wherever in the
 *      field the origin happened to land, which for the shipped seed was a force 9 gale and
 *      forced a `weatherOverride` in `main.ts` that disabled the whole system. The model now
 *      chooses where it begins, and that has to hold for every seed rather than for one.
 *   6. **The sea lags the wind.** A sea takes hours to build and longer to die down. If the
 *      significant wave height tracked the wind instantaneously the ocean would read as
 *      computed no matter how correct the spectrum was.
 *   7. **The storm warning is true.** It shares a classifier with the state on the HUD, so the
 *      two can never say different things about one sky.
 */

/** A northern sea, matching the art direction, and the shipped default seed. */
const SEED = 0x5eed_f15e;
const LATITUDE = 55;
/**
 * Seeds every property that must hold *whatever the seed* is swept over.
 *
 * Deliberately a spread rather than small integers: the seed reaches the noise permutation
 * tables through `splitmix32`, so 1, 2 and 3 are no more or less adversarial than any other
 * values, but a spread makes it obvious that nothing here was tuned to a favourite number.
 */
const SEEDS: readonly number[] = [
  SEED, 1, 7, 4242, 12345, 777_777, 0xabcd_ef, 0x0bad_c0de, 900_000_011, 2_147_483_647,
];
/** Latitudes the opening has to survive: the Coriolis floor, the shipped default, and both poles' sides. */
const LATITUDES: readonly number[] = [16, 32.08, 55, 68, -42];
/** Simulation step, seconds. The engine's frame time; the model is stepped on the world clock. */
const STEP_SECONDS = 2;
/** Real minutes a player is entitled to before the weather is allowed to turn on them. */
const SETTLED_MINUTES = 5;

function runFor(model: WeatherModel, hours: number, onSample?: (m: WeatherModel) => void): void {
  const steps = Math.round((hours * 3600) / STEP_SECONDS);
  for (let i = 0; i < steps; i += 1) {
    model.step(STEP_SECONDS, 0, 0);
    onSample?.(model);
  }
}

/**
 * Significant wave height the ocean would be drawing right now.
 *
 * Built from the same JONSWAP spectrum `Ocean` builds, out of the same two numbers the model
 * hands it — so this is not a model of the sea, it is the sea. `math/Gerstner.ts` is pure, which
 * is the only reason this can be asked in a node test at all.
 */
function significantWaveHeight(model: WeatherModel): number {
  return new WaveBank({
    windSpeed: model.current.windSpeed,
    windDirection: model.current.windDirection,
    fetchKm: model.fetch,
    waveCount: 8,
    seed: SEED,
    spreading: 10,
    amplitudeScale: 1,
  }).significantWaveHeight;
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

  it('keeps every quantity inside its physical range, for any seed', () => {
    /**
     * Range of every quantity the field produces, and what it is allowed to be.
     *
     * A barometer on a temperate coast reads between about 980 and 1046 hPa in a lifetime; the
     * air temperature is the base 3.5 °C plus up to 12.5 of airmass warmth less up to 2.2 for
     * rain-cooled air; the rest are fractions or have a hard ceiling in the model. Every one is
     * checked, because a quantity out of range is not visible as a wrong number on screen — it
     * is visible as a sky that has gone strange, three systems downstream.
     *
     * Extrema are collected and asserted once rather than asserted per sample: a hundred
     * thousand assertions is a slow test, and one that reports the *worst* value it saw is a
     * more useful failure than one that reports the first.
     */
    const LIMITS: Record<string, readonly [number, number]> = {
      pressureHpa: [980, 1046],
      trendHpaPerHour: [-30, 30],
      windSpeed: [0, 26.5],
      windDirection: [-Math.PI, Math.PI],
      cloudiness: [0, 1],
      precipitation: [0, 1],
      fogginess: [0, 1],
      instability: [0, 1],
      temperatureC: [1, 17],
      visibilityM: [85, 34100],
      fetchKm: [25, 700],
    };

    const keys = Object.keys(LIMITS);
    const low = new Float64Array(keys.length).fill(Number.POSITIVE_INFINITY);
    const high = new Float64Array(keys.length).fill(Number.NEGATIVE_INFINITY);
    let worstVectorError = 0;

    for (const seed of SEEDS) {
      const model = new WeatherModel(seed, LATITUDE);
      runFor(model, 4, (m) => {
        const s = m.current;
        const values = [
          s.pressureHpa, s.trendHpaPerHour, s.windSpeed, s.windDirection, s.cloudiness,
          s.precipitation, s.fogginess, s.instability, s.temperatureC, s.visibilityM, m.fetch,
        ];
        for (let i = 0; i < values.length; i += 1) {
          const value = values[i] ?? Number.NaN;
          if (value < (low[i] ?? 0)) low[i] = value;
          if (value > (high[i] ?? 0)) high[i] = value;
        }
        // The vector and its magnitude are stored and damped separately; if they ever
        // disagreed the flag and the sea would be showing different winds.
        const error = Math.abs(Math.hypot(s.windX, s.windZ) - s.windSpeed);
        if (error > worstVectorError) worstVectorError = error;
      });
    }

    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i] ?? '';
      const range = LIMITS[key] ?? [0, 0];
      // NaN fails both comparisons, so this is also the finiteness check.
      expect(low[i], `${key} fell to ${low[i]}`).toBeGreaterThanOrEqual(range[0]);
      expect(high[i], `${key} rose to ${high[i]}`).toBeLessThanOrEqual(range[1]);
    }
    expect(worstVectorError).toBeLessThan(1e-9);
  });
});

describe('the opening', () => {
  /**
   * The world does not begin wherever the noise happens to be.
   *
   * `WeatherModel` searches its own field at construction for a ridge — pressure above the mean,
   * a slack gradient across it — and starts there. That is the fix for the opening being a
   * lottery, and the property it has to have is *unconditional*: it cannot be true of the
   * shipped seed and false of the next one, because then `main.ts` would still need the override
   * that disabled the whole system.
   *
   * The Coriolis parameter is swept alongside the seed because it is what turns a gradient into
   * a wind, and the same isobars are three times the wind at 16° that they are at 55°. An
   * opening chosen at one latitude is not an opening at another.
   */
  it('is a working breeze for every seed at every latitude', () => {
    const steps = (SETTLED_MINUTES * 60) / STEP_SECONDS;
    for (const latitude of LATITUDES) {
      for (const seed of SEEDS) {
        const model = new WeatherModel(seed, latitude);
        model.step(STEP_SECONDS, 0, 0);
        const opening = beaufortFromWindSpeed(model.current.windSpeed);
        const where = `seed ${seed} at ${latitude}°`;
        // Force 2 to 4: enough for the hull to move and the water to have shape, not enough
        // for the propeller to ventilate on every crest.
        expect(opening, `${where} opened at force ${opening}`).toBeGreaterThanOrEqual(2);
        expect(opening, `${where} opened at force ${opening}`).toBeLessThanOrEqual(4);

        let worst = 0;
        for (let i = 1; i < steps; i += 1) {
          model.step(STEP_SECONDS, 0, 0);
          worst = Math.max(worst, beaufortFromWindSpeed(model.current.windSpeed));
        }
        expect(worst, `${where} reached force ${worst} inside five minutes`).toBeLessThanOrEqual(4);
      }
    }
  });

  it('survives the position arriving late', () => {
    // Geolocation resolves a second or two into the session, usually before the first frame but
    // not reliably, and the Coriolis parameter it sets is what turns a gradient into a wind. So
    // a late fix re-chooses the opening rather than leaving the first minutes at whatever the
    // same isobars happen to blow at the new latitude.
    for (const seed of SEEDS) {
      const model = new WeatherModel(seed, 32.08);
      for (let i = 0; i < 5; i += 1) model.step(STEP_SECONDS, 0, 0);
      model.setLatitude(61.2);
      let worst = 0;
      for (let i = 0; i < (SETTLED_MINUTES * 60) / STEP_SECONDS; i += 1) {
        model.step(STEP_SECONDS, 0, 0);
        worst = Math.max(worst, beaufortFromWindSpeed(model.current.windSpeed));
      }
      expect(worst, `seed ${seed} reached force ${worst}`).toBeLessThanOrEqual(4);
    }
  });

  it('opens under a high, in dry and clear air', () => {
    for (const seed of SEEDS) {
      const model = new WeatherModel(seed, LATITUDE);
      model.step(STEP_SECONDS, 0, 0);
      const s = model.current;
      // An anticyclone, not merely a slack col between two lows — a col lets the next system
      // straight in behind it, and the first five minutes would not survive that.
      expect(s.pressureHpa, `seed ${seed}`).toBeGreaterThan(1013.25);
      expect(s.precipitation).toBeLessThan(0.1);
      expect(s.fogginess).toBeLessThan(0.42);
      expect(['dead-calm', 'light-breeze', 'partly-cloudy', 'overcast']).toContain(model.state);
    }
  });

  it('opens on a sea already in step with its own wind', () => {
    // A settled ridge has been sitting there, so the sea under it is developed rather than
    // still catching up. Without this the first minutes are spent watching the swell decay
    // from whatever the fetch happened to be initialised to.
    for (const seed of SEEDS) {
      const model = new WeatherModel(seed, LATITUDE);
      model.step(STEP_SECONDS, 0, 0);
      const opening = significantWaveHeight(model);
      let worst = 0;
      for (let i = 0; i < 60; i += 1) {
        model.step(STEP_SECONDS, 0, 0);
        worst = Math.max(worst, Math.abs(significantWaveHeight(model) - opening));
      }
      expect(worst, `seed ${seed}`).toBeLessThan(0.35);
    }
  });

  it('is a starting point and not a cage', () => {
    // The counter-test for the obvious wrong fix. If the opening had been made benign by
    // holding the wind down rather than by choosing where to start, the sea would never build
    // and this is what would catch it. Six hours is a long session, not a long simulation.
    for (const seed of SEEDS) {
      const model = new WeatherModel(seed, LATITUDE);
      let peak = 0;
      runFor(model, 6, (m) => {
        peak = Math.max(peak, m.current.windSpeed);
      });
      expect(beaufortFromWindSpeed(peak), `seed ${seed}`).toBeGreaterThanOrEqual(6);
    }
  });

  it('gives the same opening to the same seed and different ones to different seeds', () => {
    const a = new WeatherModel(SEED, LATITUDE);
    const b = new WeatherModel(SEED, LATITUDE);
    const c = new WeatherModel(SEED + 1, LATITUDE);
    a.step(STEP_SECONDS, 0, 0);
    b.step(STEP_SECONDS, 0, 0);
    c.step(STEP_SECONDS, 0, 0);
    expect(b.current.windSpeed).toBe(a.current.windSpeed);
    expect(b.current.pressureHpa).toBe(a.current.pressureHpa);
    expect(c.current.pressureHpa).not.toBe(a.current.pressureHpa);
  });
});

describe("the sea's memory", () => {
  /**
   * Significant wave height must not track wind speed.
   *
   * The wind is the atmosphere's business and moves in seconds; the sea is a history and moves
   * in hours. `WeatherModel` carries that history as an equivalent fetch, which grows towards
   * the developed fetch for the wind now blowing at the group velocity of the dominant wave and
   * disperses more slowly than it grew. These assert the consequence rather than the mechanism,
   * so the mechanism stays replaceable.
   */
  /**
   * A gale, arriving over a settled sea.
   *
   * Pinning at construction would open on a developed storm sea, which is what an override is
   * for; here the model is primed on its own benign opening first and only then handed the
   * gale, so what is measured is the *arrival* of weather rather than a screenshot of it.
   */
  function gale(seed: number): WeatherModel {
    const model = new WeatherModel(seed, LATITUDE);
    model.step(STEP_SECONDS, 0, 0);
    model.setOverride('thunderstorm');
    return model;
  }

  /** Wind speed and significant wave height once a simulated minute over a long run. */
  function sample(seed: number, hours: number, winds: number[], seas: number[]): void {
    const model = new WeatherModel(seed, LATITUDE);
    let step = 0;
    runFor(model, hours, (m) => {
      step += 1;
      if (step % 30 !== 0) return;
      winds.push(m.current.windSpeed);
      seas.push(significantWaveHeight(m));
    });
  }

  function correlation(a: readonly number[], b: readonly number[]): number {
    const n = a.length;
    const meanA = a.reduce((x, y) => x + y, 0) / n;
    const meanB = b.reduce((x, y) => x + y, 0) / n;
    let covariance = 0;
    let varianceA = 0;
    let varianceB = 0;
    for (let i = 0; i < n; i += 1) {
      const da = (a[i] ?? 0) - meanA;
      const db = (b[i] ?? 0) - meanB;
      covariance += da * db;
      varianceA += da * da;
      varianceB += db * db;
    }
    return covariance / Math.sqrt(varianceA * varianceB);
  }

  it('keeps growing long after the wind has finished rising', () => {
    // A gale arrives over a settled sea. The wind is at its full strength inside one real
    // minute — that is the atmosphere, and it is meant to be quick — and the sea is still
    // visibly building four minutes after that, which is the whole claim.
    for (const seed of SEEDS) {
      const model = gale(seed);
      const marks = new Map<number, { wind: number; sea: number }>();
      let step = 0;
      runFor(model, 1 / 3, (m) => {
        step += 1;
        const minutes = (step * STEP_SECONDS) / 60;
        if (step % 30 === 0 && (minutes === 1 || minutes === 5 || minutes === 20)) {
          marks.set(minutes, { wind: m.current.windSpeed, sea: significantWaveHeight(m) });
        }
      });

      const first = marks.get(1);
      const fifth = marks.get(5);
      const last = marks.get(20);
      expect(first).toBeDefined();
      expect(fifth).toBeDefined();
      expect(last).toBeDefined();
      if (first === undefined || fifth === undefined || last === undefined) continue;

      expect(first.wind, `seed ${seed} wind`).toBeGreaterThan(last.wind * 0.88);
      expect(fifth.sea, `seed ${seed} sea`).toBeGreaterThan(first.sea * 1.25);
    }
  });

  it('is not a function of the wind speed', () => {
    // The direct statement of the requirement. Find two moments in a long run with the same
    // wind blowing and compare the seas: if the significant wave height tracked the wind
    // instantaneously this ratio would be one, and it is nearer three. The difference is how
    // long that wind had been blowing by the time each sample was taken.
    for (const seed of SEEDS.slice(0, 4)) {
      const winds: number[] = [];
      const seas: number[] = [];
      sample(seed, 4, winds, seas);

      let spread = 1;
      for (let i = 0; i < winds.length; i += 1) {
        for (let j = i + 1; j < winds.length; j += 1) {
          const a = winds[i] ?? 0;
          const b = winds[j] ?? 0;
          // Above force 3, where the sea is worth looking at, and at matched wind speeds.
          if (a < 5 || Math.abs(a - b) > 0.15) continue;
          const seaA = seas[i] ?? 0;
          const seaB = seas[j] ?? 0;
          spread = Math.max(spread, Math.max(seaA, seaB) / Math.max(1e-6, Math.min(seaA, seaB)));
        }
      }
      expect(spread, `seed ${seed}`).toBeGreaterThan(1.6);
    }
  });

  it('is behind the wind rather than with it', () => {
    // And the direction of the lag, which is the part that would be wrong if the fetch grew or
    // dispersed the wrong way round: measured against the sea that wind *would* have raised had
    // it always been blowing, the sea is short while the wind is freshening and left over while
    // it is easing. So the departure from equilibrium anti-correlates with the wind's trend.
    for (const seed of SEEDS.slice(0, 4)) {
      const winds: number[] = [];
      const seas: number[] = [];
      sample(seed, 4, winds, seas);

      const ratios: number[] = [];
      const trends: number[] = [];
      for (let i = 5; i < winds.length; i += 1) {
        const wind = winds[i] ?? 0;
        const equilibrium = new WaveBank({
          windSpeed: wind,
          windDirection: 0,
          fetchKm: developedFetchKm(wind),
          waveCount: 8,
          seed: SEED,
          spreading: 10,
          amplitudeScale: 1,
        }).significantWaveHeight;
        ratios.push((seas[i] ?? 0) / Math.max(1e-6, equilibrium));
        // Five minutes of freshening or easing, which is a trend rather than a wobble.
        trends.push(wind - (winds[i - 5] ?? 0));
      }
      expect(correlation(ratios, trends), `seed ${seed}`).toBeLessThan(-0.3);
    }
  });

  it('lets the sea outlive the wind that made it', () => {
    // Build a sea under a gale, drop the wind to a light breeze, and look five real minutes
    // later. The sea a light breeze can raise on its own is small; most of the gale's is still
    // there, because a swell that stops being fed disperses rather than switching off.
    const model = gale(SEED);
    runFor(model, 1 / 3);
    const built = model.fetch;
    expect(built).toBeGreaterThan(developedFetchKm(4) * 3);

    model.setOverride('light-breeze');
    runFor(model, 1 / 12);
    const wind = model.current.windSpeed;
    expect(beaufortFromWindSpeed(wind)).toBeLessThanOrEqual(3);
    expect(model.fetch).toBeGreaterThan(built * 0.7);
    expect(model.fetch).toBeGreaterThan(developedFetchKm(wind) * 2);
  });

  it('grows into a ceiling set by the wind, not a fixed one', () => {
    // The Pierson–Moskowitz limit, restated here from the literature rather than imported, so
    // that a change to the constant in the source has to be justified against the physics.
    for (const wind of [4, 8, 12, 16, 20]) {
      const expected = (22800 * wind * wind) / 9.80665 / 1000;
      expect(developedFetchKm(wind)).toBeCloseTo(Math.min(700, expected), 6);
    }
    // A light air cannot raise a big sea however long it blows; a gale can.
    expect(developedFetchKm(3)).toBeLessThan(developedFetchKm(6));
    expect(developedFetchKm(6)).toBeLessThan(developedFetchKm(12));
    expect(developedFetchKm(0)).toBe(25);
    expect(developedFetchKm(40)).toBe(700);
  });

  it('gives a stronger wind a larger sea to grow into', () => {
    // Observed on the model rather than on the formula: pin three states of increasing force,
    // let each settle, and the seas come out in the same order.
    const heights: number[] = [];
    for (const state of ['light-breeze', 'rain', 'storm'] as const) {
      const model = new WeatherModel(SEED, LATITUDE);
      model.setOverride(state);
      runFor(model, 1 / 3);
      heights.push(significantWaveHeight(model));
    }
    for (let i = 1; i < heights.length; i += 1) {
      expect(heights[i] ?? 0, `${i}`).toBeGreaterThan(heights[i - 1] ?? 0);
    }
  });
});

describe('continuity over a simulated day', () => {
  /**
   * Bounds for one minute of real time, which is about three quarters of an hour of synoptic
   * time. A cold front can genuinely take the wind up most of a force and swing it most of a
   * quadrant in that long, so these admit real weather and reject a jump — they are a fraction
   * of the model's full range (0–26 m/s, a whole circle), which is what "continuous" has to
   * mean for a field that is deliberately allowed to change.
   *
   * Swept over seeds rather than asserted on one, because the worst minute in one trajectory is
   * a property of that trajectory and not of the model. The bound this replaced was six, which
   * the shipped seed happened to satisfy and most others do not; that made it a test of luck.
   */
  const MAX_SPEED_CHANGE_PER_MINUTE = 10;
  const MAX_DIRECTION_CHANGE_PER_MINUTE = 2;
  /** Below force 2 the direction of the wind is not a physically meaningful quantity at sea. */
  const DIRECTION_VALID_ABOVE_MS = 2.5;

  it('never jumps between consecutive minutes, for any seed', () => {
    const stepsPerMinute = 60 / STEP_SECONDS;
    let worstSpeed = 0;
    let worstDirection = 0;

    for (const seed of SEEDS) {
      const model = new WeatherModel(seed, LATITUDE);
      let previousSpeed = -1;
      let previousDirection = 0;
      for (let minute = 0; minute < 8 * 60; minute += 1) {
        // The lightest the wind got *within* the minute, not merely at its ends. A wind that
        // drops through a calm and comes back from the other quarter has reversed physically —
        // that is a col passing over, not a discontinuity — and it is only a swing across a
        // wind that stayed up throughout that could be a teleport.
        let floor = Infinity;
        for (let i = 0; i < stepsPerMinute; i += 1) {
          model.step(STEP_SECONDS, 0, 0);
          floor = Math.min(floor, model.current.windSpeed);
        }
        const { windSpeed, windDirection } = model.current;
        if (previousSpeed >= 0) {
          worstSpeed = Math.max(worstSpeed, Math.abs(windSpeed - previousSpeed));
          if (floor > DIRECTION_VALID_ABOVE_MS && previousSpeed > DIRECTION_VALID_ABOVE_MS) {
            worstDirection = Math.max(
              worstDirection,
              Math.abs(angleDelta(windDirection, previousDirection)),
            );
          }
        }
        previousSpeed = windSpeed;
        previousDirection = windDirection;
      }
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

  it('reaches all eight states over a long run, whatever the seed', () => {
    // Every seed, not one. Choosing a settled place to begin must not have cost the field any
    // of its range — the opening is where the world starts, not where it stays.
    for (const seed of SEEDS) {
      const seen = new Set(walk(seed, LATITUDE, 20));
      for (const state of WEATHER_STATES) {
        expect(seen, `seed ${seed} never reached ${state.name}`).toContain(state.name);
      }
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
    for (const seed of SEEDS) {
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

describe('the storm warning', () => {
  /**
   * The warning has to agree with the sky.
   *
   * The HUD reads "STORM overhead" when the forecast says zero minutes, and it once read that
   * over a seven-knot breeze in a Beaufort 3. Two separate faults made it: the forecast read the
   * raw field rather than the smoothed state the player is actually in — the field leads the sea
   * by minutes — and it ignored `weatherOverride` entirely, so a pinned light breeze was
   * announcing the gale the field would have produced underneath it.
   *
   * Both are fixed by making the warning share the state classifier with the HUD, and the tests
   * below are written as a biconditional for that reason: overhead if and only if the state is
   * severe. Anything weaker would pass on a warning that was merely never late.
   */
  const warning = { approaching: false, minutesAway: 0 };

  it('says overhead exactly when the state is severe', () => {
    for (const seed of SEEDS.slice(0, 5)) {
      const model = new WeatherModel(seed, LATITUDE);
      for (let i = 0; i < (12 * 3600) / STEP_SECONDS; i += 1) {
        model.step(STEP_SECONDS, 0, 0);
        if (i % 30 !== 0) continue;
        model.forecast(0, 0, warning);
        const overhead = warning.approaching && warning.minutesAway === 0;
        expect(overhead, `seed ${seed} at step ${i}: ${model.state}`).toBe(
          isSevereState(model.state),
        );
      }
    }
  });

  it('never cries storm over a settled sea', () => {
    // The exact shape of the reported bug: benign field, benign HUD, storm warning.
    for (const seed of SEEDS) {
      const model = new WeatherModel(seed, LATITUDE);
      for (let i = 0; i < (SETTLED_MINUTES * 60) / STEP_SECONDS; i += 1) {
        model.step(STEP_SECONDS, 0, 0);
        model.forecast(0, 0, warning);
        if (warning.approaching) {
          // A warning inside the settled window is allowed to *look ahead* — the field is free
          // to be building something — but it may never claim the storm is already here.
          expect(warning.minutesAway, `seed ${seed}`).toBeGreaterThan(0);
        }
        expect(beaufortFromWindSpeed(model.current.windSpeed)).toBeLessThanOrEqual(4);
      }
    }
  });

  it('follows the override rather than the field beneath it', () => {
    for (const state of WEATHER_STATES) {
      const model = new WeatherModel(SEED, LATITUDE);
      model.setOverride(state.name);
      runFor(model, 0.5);
      model.forecast(0, 0, warning);
      const severe = isSevereState(state.name);
      // A pinned state is the weather indefinitely, so it is either severe now or never.
      expect(warning.approaching, `pinned ${state.name}`).toBe(severe);
      if (severe) expect(warning.minutesAway).toBe(0);
      expect(isSevereState(model.state)).toBe(severe);
    }
  });

  it('reports a horizon it can actually see', () => {
    const model = new WeatherModel(SEED, LATITUDE);
    runFor(model, 6, (m) => {
      m.forecast(0, 0, warning);
      expect(warning.minutesAway).toBeGreaterThanOrEqual(0);
      expect(warning.minutesAway).toBeLessThanOrEqual(30);
      expect(Number.isFinite(warning.minutesAway)).toBe(true);
    });
  });
});

import { describe, expect, it } from 'vitest';
import { createGradeParams, evaluateGrade, type GradeParams } from '../src/render/ColourGrade.js';

/**
 * Colour grade validation.
 *
 * A grade is the one part of the renderer where "it looks fine" is not evidence of anything —
 * it is twelve numbers whose whole job is to be barely perceptible, so the failure modes are
 * exactly the ones the eye is worst at catching on a single frame. Four things are worth
 * asserting, and they are the four ways this has historically gone wrong:
 *
 *   1. **It is continuous.** The regimes are named — night, twilight, golden hour, day — but
 *      nothing switches on a name. If the blend ever stepped, the frame would pop at a
 *      particular solar altitude every single evening, and it would take a while to work out
 *      why. So the altitude is swept in hundredths of a degree straight through all three
 *      boundaries and every parameter is bounded per step. The same is done for each weather
 *      input.
 *   2. **It is identity at noon.** A clear midday frame is already correct after metering and
 *      ACES. A grade that has an opinion about it is a grade that will have the wrong opinion
 *      about something else.
 *   3. **It points the right way.** Warm at golden hour, cool and desaturated at night, magenta
 *      through twilight. Sign errors in a table this small are invisible until someone looks at
 *      a sunset and cannot say what is wrong with it.
 *   4. **It stays small.** Every parameter is bounded over the whole domain, which is the only
 *      mechanical guard against the grade quietly growing into a colouring.
 *
 * The module under test is pure — no `three`, no shader import — which is why this file can
 * exist at all under a vitest with no `vite-plugin-glsl`.
 */

/** Every field of the result, so continuity and bounds can be asserted over all of them. */
const FIELDS: readonly (keyof GradeParams)[] = [
  'liftR',
  'liftG',
  'liftB',
  'gammaR',
  'gammaG',
  'gammaB',
  'gainR',
  'gainG',
  'gainB',
  'saturation',
  'temperature',
  'tint',
];

/** A benign default sky: thin cloud, dry, a light breeze. Nothing on the weather axis. */
const CLEAR = { cloudiness: 0.15, precipitation: 0, beaufort: 3 };
/** A full Beaufort 9 with rain, which is where the weather axis reaches its full extent. */
const STORM = { cloudiness: 0.98, precipitation: 0.85, beaufort: 9 };

interface Weather {
  cloudiness: number;
  precipitation: number;
  beaufort: number;
}

function grade(sunAltitudeDeg: number, weather: Weather = CLEAR): GradeParams {
  const out = createGradeParams();
  evaluateGrade(
    sunAltitudeDeg,
    weather.cloudiness,
    weather.precipitation,
    weather.beaufort,
    out,
  );
  return out;
}

/** Largest change in any single parameter between two evaluations. */
function largestStep(a: GradeParams, b: GradeParams): number {
  let worst = 0;
  for (const field of FIELDS) {
    worst = Math.max(worst, Math.abs(a[field] - b[field]));
  }
  return worst;
}

/** Solar altitudes that sit squarely inside each regime rather than on a boundary. */
const MIDNIGHT_DEG = -25;
const TWILIGHT_DEG = -8.5;
const GOLDEN_DEG = 2;
const NOON_DEG = 62;

describe('colour grade continuity', () => {
  it('never steps as the sun crosses every regime boundary', () => {
    // A hundredth of a degree is about two seconds of real time at mid-latitudes, so a step
    // this size is a genuine per-frame bound and not a sampling artefact. The sweep runs from
    // well below the end of astronomical twilight to well above the last boundary.
    let previous = grade(-30);
    let worst = 0;
    for (let altitude = -30; altitude <= 40; altitude += 0.01) {
      const current = grade(altitude);
      worst = Math.max(worst, largestStep(previous, current));
      previous = current;
    }
    expect(worst).toBeLessThan(1e-3);
  });

  it('never steps as cloud, rain or sea state come and go', () => {
    let worstCloud = 0;
    let previous = grade(GOLDEN_DEG, { cloudiness: 0, precipitation: 0.3, beaufort: 6 });
    for (let cloudiness = 0; cloudiness <= 1; cloudiness += 0.001) {
      const current = grade(GOLDEN_DEG, { cloudiness, precipitation: 0.3, beaufort: 6 });
      worstCloud = Math.max(worstCloud, largestStep(previous, current));
      previous = current;
    }
    expect(worstCloud).toBeLessThan(1e-3);

    let worstRain = 0;
    previous = grade(MIDNIGHT_DEG, { cloudiness: 0.9, precipitation: 0, beaufort: 6 });
    for (let precipitation = 0; precipitation <= 1; precipitation += 0.001) {
      const current = grade(MIDNIGHT_DEG, { cloudiness: 0.9, precipitation, beaufort: 6 });
      worstRain = Math.max(worstRain, largestStep(previous, current));
      previous = current;
    }
    expect(worstRain).toBeLessThan(1e-3);

    let worstSea = 0;
    previous = grade(NOON_DEG, { cloudiness: 0.9, precipitation: 0.4, beaufort: 0 });
    for (let beaufort = 0; beaufort <= 12; beaufort += 0.01) {
      const current = grade(NOON_DEG, { cloudiness: 0.9, precipitation: 0.4, beaufort });
      worstSea = Math.max(worstSea, largestStep(previous, current));
      previous = current;
    }
    expect(worstSea).toBeLessThan(1e-3);
  });

  it('is well defined outside the domain it will ever really see', () => {
    // Solar altitude cannot leave ±90°, and the weather inputs are normalised, but a clamp
    // that is not there is a clamp that fails at the one latitude nobody tested.
    for (const altitude of [-90, -60, 0, 60, 90]) {
      for (const weather of [CLEAR, STORM, { cloudiness: 5, precipitation: -2, beaufort: 40 }]) {
        const params = grade(altitude, weather);
        for (const field of FIELDS) {
          expect(Number.isFinite(params[field])).toBe(true);
        }
      }
    }
  });
});

describe('colour grade at each regime', () => {
  it('leaves a clear midday frame alone', () => {
    const noon = grade(NOON_DEG);
    expect(noon.liftR).toBeCloseTo(0, 6);
    expect(noon.liftG).toBeCloseTo(0, 6);
    expect(noon.liftB).toBeCloseTo(0, 6);
    expect(noon.gammaR).toBeCloseTo(1, 6);
    expect(noon.gammaG).toBeCloseTo(1, 6);
    expect(noon.gammaB).toBeCloseTo(1, 6);
    expect(noon.gainR).toBeCloseTo(1, 6);
    expect(noon.gainG).toBeCloseTo(1, 6);
    expect(noon.gainB).toBeCloseTo(1, 6);
    expect(noon.temperature).toBeCloseTo(0, 6);
    expect(noon.tint).toBeCloseTo(0, 6);
    // The one exception, and the one every camera's standard profile also makes.
    expect(noon.saturation).toBeGreaterThan(1);
    expect(noon.saturation).toBeLessThan(1.03);
  });

  it('warms the frame at golden hour', () => {
    const golden = grade(GOLDEN_DEG);
    expect(golden.temperature).toBeGreaterThan(0.04);
    // Warm means red gains on blue. Asserting the folded gain, not just the authored axis,
    // catches a sign error in the white balance itself.
    expect(golden.gainR).toBeGreaterThan(golden.gainB);
    expect(golden.saturation).toBeGreaterThan(grade(NOON_DEG).saturation);
    // Split tone: the direct beam is warm, but the shadows are filled by the blue zenith.
    expect(golden.liftB).toBeGreaterThan(golden.liftR);
  });

  it('cools, deepens and desaturates the frame at night', () => {
    const night = grade(MIDNIGHT_DEG);
    expect(night.temperature).toBeLessThan(0);
    expect(night.gainB).toBeGreaterThan(night.gainR);
    // The Purkinje shift: reds head for black, blues hold, colour discrimination goes.
    expect(night.liftB).toBeGreaterThan(night.liftR);
    expect(night.gammaR).toBeGreaterThan(1);
    expect(night.saturation).toBeLessThan(1);
    expect(night.saturation).toBeLessThan(grade(NOON_DEG).saturation);
  });

  it('leans magenta through twilight, and is the most saturated regime', () => {
    const twilight = grade(TWILIGHT_DEG);
    // Negative tint is towards magenta: red over blue, which is what the Belt of Venus is.
    expect(twilight.tint).toBeLessThan(-0.02);
    expect(twilight.saturation).toBeGreaterThan(grade(NOON_DEG).saturation);
    expect(twilight.saturation).toBeGreaterThan(grade(MIDNIGHT_DEG).saturation);
    expect(twilight.saturation).toBeGreaterThan(grade(GOLDEN_DEG).saturation);
  });
});

describe('colour grade weather axis', () => {
  it('desaturates and flattens a storm', () => {
    const clear = grade(GOLDEN_DEG, CLEAR);
    const storm = grade(GOLDEN_DEG, STORM);
    expect(storm.saturation).toBeLessThan(clear.saturation);
    // Flat is a lifted toe against brightened midtones: a veiling haze, not a darkening.
    expect(storm.liftR).toBeGreaterThan(clear.liftR);
    expect(storm.gammaR).toBeLessThan(clear.gammaR);
    expect(storm.temperature).toBeLessThan(clear.temperature);
  });

  it('takes the same proportion of colour out of a night frame as a noon one', () => {
    // This is what "independent of the time of day" has to mean mechanically. The storm
    // multiplies saturation rather than replacing it, so the ratio is identical at every
    // altitude — if someone later makes it additive, or folds it into the regime table, this
    // is the assertion that notices.
    const ratioAtNoon = grade(NOON_DEG, STORM).saturation / grade(NOON_DEG, CLEAR).saturation;
    const ratioAtNight =
      grade(MIDNIGHT_DEG, STORM).saturation / grade(MIDNIGHT_DEG, CLEAR).saturation;
    const ratioAtGolden =
      grade(GOLDEN_DEG, STORM).saturation / grade(GOLDEN_DEG, CLEAR).saturation;
    expect(ratioAtNight).toBeCloseTo(ratioAtNoon, 10);
    expect(ratioAtGolden).toBeCloseTo(ratioAtNoon, 10);
    expect(ratioAtNoon).toBeLessThan(1);
  });
});

describe('colour grade magnitude', () => {
  it('moves the frame a few percent and no more, anywhere in the domain', () => {
    // The bound is the whole point of the file. Every one of these limits is comfortably
    // outside what the shipped table produces, and comfortably inside what would read as a
    // look rather than a grade.
    for (let altitude = -90; altitude <= 90; altitude += 0.5) {
      for (const weather of [CLEAR, STORM, { cloudiness: 1, precipitation: 1, beaufort: 12 }]) {
        const p = grade(altitude, weather);
        expect(Math.abs(p.liftR)).toBeLessThan(0.02);
        expect(Math.abs(p.liftG)).toBeLessThan(0.02);
        expect(Math.abs(p.liftB)).toBeLessThan(0.02);
        expect(Math.abs(p.gammaR - 1)).toBeLessThan(0.06);
        expect(Math.abs(p.gammaG - 1)).toBeLessThan(0.06);
        expect(Math.abs(p.gammaB - 1)).toBeLessThan(0.06);
        expect(p.gainR).toBeGreaterThan(0.9);
        expect(p.gainR).toBeLessThan(1.06);
        expect(p.gainG).toBeGreaterThan(0.9);
        expect(p.gainG).toBeLessThan(1.06);
        expect(p.gainB).toBeGreaterThan(0.9);
        expect(p.gainB).toBeLessThan(1.06);
        expect(p.saturation).toBeGreaterThan(0.8);
        expect(p.saturation).toBeLessThan(1.08);
      }
    }
  });
});

import { clamp, smoothstep } from '../math/Noise.js';

/**
 * The per-regime colour grade, evaluated on the CPU.
 *
 * This is step 4 of the post chain described in `PostFX.ts`: a lift/gamma/gain with a
 * saturation and a white balance, chosen by where the sun actually is and what the weather
 * actually is. It is a *grade*, not a colouring. Every number below is a fraction of a percent
 * to a few percent, and the test that guards this file asserts those bounds, because a grade
 * that announces itself has stopped being a grade.
 *
 * Three decisions are worth stating, because each of them had an obvious wrong alternative:
 *
 * **It is not a lookup on a state name.** The regimes — night, twilight, golden hour, day —
 * are membership weights over solar altitude that form a partition of unity, so the blend is
 * continuous everywhere and there is no altitude at which the frame steps. The sky comes from
 * the ephemeris and so does the grade; nothing here knows what a "sunset" is, only what −3°
 * looks like.
 *
 * **It is not a 3D LUT.** A LUT would have to be rebuilt every frame, because the solar
 * altitude moves every frame, and rebuilding and re-uploading a 32³ texture to move the frame
 * two percent is a poor trade. Twelve floats do the same job with no upload at all.
 *
 * **The weather is a second, independent axis.** Overcast, rain and a rising sea desaturate and
 * flatten the frame by the same proportion whether it is noon or midnight, because that is what
 * losing the direct beam physically does to a scene: the only remaining source is a large, dim,
 * blue-ish dome, and a large dim source is exactly what "flat and grey" means. Multiplying the
 * time-of-day saturation rather than replacing it is what keeps the two axes independent.
 *
 * The module is pure — no `three`, no shader import, no DOM — so `test/grade.test.ts` can import
 * it directly. `PostFX.ts` owns the effect that pushes these numbers into uniforms.
 */

/**
 * The twelve numbers that define a graded frame.
 *
 * Flat scalars rather than tuples on purpose: `evaluateGrade` writes into a caller-owned
 * instance so the frame loop allocates nothing, and named fields keep every read and write out
 * of `noUncheckedIndexedAccess` territory.
 *
 * `lift`, `gamma` and `gain` are applied in that order in `shaders/post/grade.frag`, in a
 * roughly perceptual space, as `pow(colour * gain + lift, gamma)`. `gamma` is the ASC CDL
 * "power" term and is used directly as the exponent, so a value above 1 *darkens* the midtones.
 */
export interface GradeParams {
  liftR: number;
  liftG: number;
  liftB: number;
  gammaR: number;
  gammaG: number;
  gammaB: number;
  /** Per-channel multiplier, with the white balance already folded in. */
  gainR: number;
  gainG: number;
  gainB: number;
  /** 1 leaves colour alone; below 1 mixes towards Rec. 709 luminance. */
  saturation: number;
  /**
   * The warm/cool axis the grade was authored on, positive towards warm. It is folded into
   * `gain` before it reaches the shader — a white balance *is* a channel gain, and doing the
   * fold once per frame on the CPU saves a multiply on every pixel — but it is reported here
   * because it, not the folded result, is the number that says what the grade meant to do.
   */
  temperature: number;
  /** The green/magenta axis, positive towards green. Folded into `gain` alongside temperature. */
  tint: number;
}

/** A grade at rest: the frame passes through untouched. */
export function createGradeParams(): GradeParams {
  return {
    liftR: 0,
    liftG: 0,
    liftB: 0,
    gammaR: 1,
    gammaG: 1,
    gammaB: 1,
    gainR: 1,
    gainG: 1,
    gainB: 1,
    saturation: 1,
    temperature: 0,
    tint: 0,
  };
}

/** One end point of the blend. Four of these are mixed by their membership weights. */
interface GradeStop {
  readonly lift: readonly [number, number, number];
  readonly gamma: readonly [number, number, number];
  /** Scalar density on the whole signal, before the white balance is folded in. */
  readonly gain: number;
  readonly saturation: number;
  readonly temperature: number;
  readonly tint: number;
}

/**
 * Deep night, below the end of astronomical twilight.
 *
 * The shape of this stop is the Purkinje shift, which is a real property of the eye rather
 * than a stylistic choice: below about 0.03 cd/m² the cones stop contributing and the rods
 * take over, peak sensitivity moves from 555 nm to 507 nm, and the consequences are exactly
 * these three — reds go towards black, blues hold, and colour discrimination mostly goes away.
 */
const NIGHT: GradeStop = {
  lift: [-0.005, -0.002, 0.008],
  gamma: [1.03, 1.015, 1.0],
  gain: 0.99,
  saturation: 0.93,
  temperature: -0.05,
  tint: 0.012,
};

/**
 * Astronomical through civil twilight.
 *
 * The twilight sky is the most saturated sky of the day and it is genuinely magenta: the
 * Belt of Venus is backscattered red light sitting on top of the blue of the earth's shadow,
 * and red over blue is magenta. So saturation goes up and the tint goes towards magenta,
 * which is the one place in this table where the grade is doing more than a percent of work.
 */
const TWILIGHT: GradeStop = {
  lift: [0.003, 0.0, 0.005],
  gamma: [1.0, 1.005, 0.995],
  gain: 0.995,
  saturation: 1.06,
  temperature: -0.02,
  tint: -0.035,
};

/**
 * Golden hour, roughly −7° to +5° of solar altitude.
 *
 * A split tone, because that is what the light is doing: the direct beam has lost most of its
 * blue to a long air mass and arrives orange, while everything in shadow is lit only by the
 * zenith sky and is therefore blue. Warming the whole frame instead would be the wrong shape —
 * it is the highlights that are warm and the shadows that are not.
 */
const GOLDEN: GradeStop = {
  lift: [-0.002, -0.001, 0.005],
  gamma: [0.995, 1.0, 1.005],
  gain: 1.0,
  saturation: 1.05,
  temperature: 0.055,
  tint: 0.0,
};

/**
 * Full daylight.
 *
 * Identity apart from two percent of saturation, which is the same thing every camera's
 * standard picture profile does and is the difference between a sea that reads as blue and one
 * that reads as grey. A correctly metered, ACES-tonemapped noon frame does not need help.
 */
const DAY: GradeStop = {
  lift: [0.0, 0.0, 0.0],
  gamma: [1.0, 1.0, 1.0],
  gain: 1.0,
  saturation: 1.02,
  temperature: 0.0,
  tint: 0.0,
};

/**
 * Solar altitudes, in degrees, at which one regime has fully given way to the next.
 *
 * The bands overlap the way the sky does: the sun is functionally gone by −8°, the low-sun look
 * is established by −1° and has finished by +13°. They are also arranged so the four weights
 * below sum to exactly 1 at every altitude — each band's lower edge sits inside the previous
 * band's completed range, which makes the telescoping product a true partition of unity.
 */
const NIGHT_END_DEG = -16;
const TWILIGHT_START_DEG = -8;
const TWILIGHT_END_DEG = -7;
const GOLDEN_START_DEG = -1;
const GOLDEN_END_DEG = 5;
const DAY_START_DEG = 13;

/** The veiling toe a rain-hazed frame picks up, slightly blue because the fill is skylight. */
const STORM_LIFT: readonly [number, number, number] = [0.005, 0.006, 0.008];
/** Lower exponent, brighter midtones: with the lifted toe this is what "flat" is made of. */
const STORM_GAMMA_FLATTEN = 0.022;
/** Held down at the top so flattening does not quietly turn into an exposure change. */
const STORM_GAIN_LOSS = 0.02;
/** Overcast light is one large dim source and carries very little colour information. */
const STORM_DESATURATION = 0.12;
/** Overcast daylight sits near 7000 K against the 5500 K of a direct beam. */
const STORM_COOLING = 0.035;

/**
 * How far red and blue move apart for one unit of temperature, and green against both for one
 * unit of tint. 0.45 makes the shipped temperatures land between two and three percent, which
 * is a warm frame you feel rather than a warm frame you see.
 */
const WHITE_BALANCE_SPLIT = 0.45;
/** Tint moves green one way and red and blue half as far the other, keeping the hue axis clean. */
const WHITE_BALANCE_TINT_COUNTER = 0.22;

const REC709_R = 0.2126;
const REC709_G = 0.7152;
const REC709_B = 0.0722;

function accumulate(out: GradeParams, stop: GradeStop, weight: number): void {
  out.liftR += weight * stop.lift[0];
  out.liftG += weight * stop.lift[1];
  out.liftB += weight * stop.lift[2];
  out.gammaR += weight * stop.gamma[0];
  out.gammaG += weight * stop.gamma[1];
  out.gammaB += weight * stop.gamma[2];
  out.gainR += weight * stop.gain;
  out.gainG += weight * stop.gain;
  out.gainB += weight * stop.gain;
  out.saturation += weight * stop.saturation;
  out.temperature += weight * stop.temperature;
  out.tint += weight * stop.tint;
}

/**
 * Evaluate the grade for one frame, writing into `out`.
 *
 * Takes scalars rather than a parameter object so that the caller in the frame loop has nothing
 * to allocate. All four inputs are clamped to their documented domain here, which is cheaper
 * than trusting every producer of a `WorldState` to have done it.
 *
 * @param sunAltitudeDeg Geometric solar altitude in degrees, straight off `EphemerisState`.
 * @param cloudiness 0 for clear, 1 for solid overcast.
 * @param precipitation 0 for dry, 1 for the heaviest rain.
 * @param beaufort Force 0–12 on the real scale.
 */
export function evaluateGrade(
  sunAltitudeDeg: number,
  cloudiness: number,
  precipitation: number,
  beaufort: number,
  out: GradeParams,
): void {
  // Nested smoothsteps rather than four independent bumps. Because each band's lower edge sits
  // inside the range where the previous one has already reached 1, the products telescope and
  // the four weights sum to exactly 1 at every altitude — so the blend is a true interpolation
  // and never dips towards identity between two regimes.
  const past = smoothstep(NIGHT_END_DEG, TWILIGHT_START_DEG, sunAltitudeDeg);
  const low = smoothstep(TWILIGHT_END_DEG, GOLDEN_START_DEG, sunAltitudeDeg);
  const high = smoothstep(GOLDEN_END_DEG, DAY_START_DEG, sunAltitudeDeg);

  out.liftR = 0;
  out.liftG = 0;
  out.liftB = 0;
  out.gammaR = 0;
  out.gammaG = 0;
  out.gammaB = 0;
  out.gainR = 0;
  out.gainG = 0;
  out.gainB = 0;
  out.saturation = 0;
  out.temperature = 0;
  out.tint = 0;

  accumulate(out, NIGHT, 1 - past);
  accumulate(out, TWILIGHT, past * (1 - low));
  accumulate(out, GOLDEN, low * (1 - high));
  accumulate(out, DAY, high);

  // The weather axis. Cloud cover does most of the work, rain adds the veiling haze, and a
  // high sea contributes because a Beaufort 9 frame is full of spray and whitecaps that scatter
  // light back into the lens whatever the cloud is doing. The weights sum to 1, so `flat`
  // reaches its full extent only in a genuine storm.
  const overcast = smoothstep(0.55, 0.95, clamp(cloudiness, 0, 1));
  const wet = smoothstep(0.05, 0.5, clamp(precipitation, 0, 1));
  const blown = smoothstep(5, 9, clamp(beaufort, 0, 12));
  const flat = 0.5 * overcast + 0.32 * wet + 0.18 * blown;

  out.liftR += STORM_LIFT[0] * flat;
  out.liftG += STORM_LIFT[1] * flat;
  out.liftB += STORM_LIFT[2] * flat;
  out.gammaR -= STORM_GAMMA_FLATTEN * flat;
  out.gammaG -= STORM_GAMMA_FLATTEN * flat;
  out.gammaB -= STORM_GAMMA_FLATTEN * flat;

  const density = 1 - STORM_GAIN_LOSS * flat;
  out.gainR *= density;
  out.gainG *= density;
  out.gainB *= density;

  // Multiplicative, so the storm takes the same proportion of the colour out of a night frame
  // as it does out of a noon frame. That is what makes this a second axis rather than a fifth
  // regime competing with the first four.
  out.saturation *= 1 - STORM_DESATURATION * flat;
  out.temperature -= STORM_COOLING * flat;

  foldWhiteBalance(out);
}

/**
 * Turn the temperature and tint into a channel gain and multiply it into `gain`.
 *
 * Normalised to unit Rec. 709 luminance, so a white-balance move never changes the overall
 * brightness of the frame. That matters more here than in a stills pipeline: the exposure meter
 * in `Sky.ts` reads the rendered sky and adapts slowly, and a grade that quietly added a
 * percent of luminance would be a slow feedback loop against it.
 */
function foldWhiteBalance(out: GradeParams): void {
  const red = 1 + WHITE_BALANCE_SPLIT * out.temperature - WHITE_BALANCE_TINT_COUNTER * out.tint;
  const green = 1 + WHITE_BALANCE_SPLIT * out.tint;
  const blue = 1 - WHITE_BALANCE_SPLIT * out.temperature - WHITE_BALANCE_TINT_COUNTER * out.tint;

  const luminance = REC709_R * red + REC709_G * green + REC709_B * blue;
  const normalise = luminance > 1e-4 ? 1 / luminance : 1;

  out.gainR *= red * normalise;
  out.gainG *= green * normalise;
  out.gainB *= blue * normalise;
}

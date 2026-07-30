import { PRNG } from './PRNG.js';

/**
 * The wave field. **This file is the single source of truth for the shape of the sea.**
 *
 * `src/shaders/lib/gerstner.glsl` is a line-for-line mirror of `evaluate` below, and
 * `npm run verify` reads the GPU's displacement back and compares it against this code at four
 * thousand sample points. If they disagree by more than a millimetre the build fails, because
 * a boat that floats through a wave instead of on it is the single most obvious way an ocean
 * can be wrong.
 *
 * The waves are **not hand-tuned**. Amplitudes, wavenumbers and directions are importance-
 * sampled from a JONSWAP spectrum parameterised by wind speed and fetch, with a cos^2s
 * directional spreading function. So the sea has the correct significant wave height, the
 * correct peak period and the correct directional spread for the wind that is actually
 * blowing — Beaufort 3 looks like Beaufort 3, and Beaufort 9 is genuinely frightening, without
 * anyone having chosen a number.
 *
 * Why Gerstner rather than an FFT: see DECISIONS.md §1. The short version is that the renderer
 * choice rules out compute shaders, and a spectrum-sampled Gerstner sum with irrational
 * frequency ratios has correct statistics and no visible repeat period.
 */

const GRAVITY = 9.80665;

export interface WaveComponent {
  /** Amplitude in metres — half the crest-to-trough height of this component. */
  amplitude: number;
  /** Angular wavenumber, radians per metre. k = 2π/λ. */
  wavenumber: number;
  /** Angular frequency, radians per second. Tied to k by the deep-water dispersion relation. */
  frequency: number;
  /** Unit direction of travel in the XZ plane. */
  directionX: number;
  directionZ: number;
  /** Phase offset, radians. Randomised per component from the seed. */
  phase: number;
  /**
   * Horizontal pinch, 0..1. Gerstner waves sharpen crests by displacing points horizontally;
   * past a threshold the surface self-intersects and produces the classic "wave turning inside
   * out" artefact. This is clamped at bank construction so the sum can never exceed it.
   */
  steepness: number;
}

export interface SpectrumParameters {
  /** Wind speed at 10 m above the surface, m/s. The U10 that every ocean formula wants. */
  windSpeed: number;
  /** Direction the wind blows *towards*, radians, measured from north eastward. */
  windDirection: number;
  /** Fetch — the distance of open water the wind has crossed, kilometres. */
  fetchKm: number;
  /** How many components to sum. 5 on the low preset, 8 on ultra. */
  waveCount: number;
  /** Seed, so the same conditions always produce the same sea. */
  seed: number;
  /**
   * Directional spreading exponent. Higher is a tighter, more organised swell; lower is the
   * confused short-crested chop of a rising wind. 10 is a reasonable wind sea.
   */
  spreading: number;
  /** Global scale on the resulting amplitudes. Used by the weather system to ease transitions. */
  amplitudeScale: number;
}

export interface Displacement {
  x: number;
  y: number;
  z: number;
}

/**
 * JONSWAP energy density at angular frequency ω, m²·s/rad.
 *
 * The Pierson–Moskowitz form multiplied by the JONSWAP peak-enhancement factor, which is what
 * distinguishes a young, fetch-limited sea (a sharp peak — the North Sea in a rising wind)
 * from a fully developed one (broad and smooth — mid-Atlantic swell).
 */
export function jonswapDensity(
  omega: number,
  windSpeed: number,
  fetchMetres: number,
  peakEnhancement = 3.3,
): number {
  if (omega <= 0 || windSpeed <= 0) return 0;

  const dimensionlessFetch = (GRAVITY * fetchMetres) / (windSpeed * windSpeed);
  const alpha = 0.076 * dimensionlessFetch ** -0.22;
  const peakOmega = 22 * (GRAVITY / windSpeed) * dimensionlessFetch ** -0.33;

  const sigma = omega <= peakOmega ? 0.07 : 0.09;
  const r = Math.exp(-((omega - peakOmega) ** 2) / (2 * sigma * sigma * peakOmega * peakOmega));

  const pm =
    ((alpha * GRAVITY * GRAVITY) / omega ** 5) * Math.exp(-1.25 * (peakOmega / omega) ** 4);
  return pm * peakEnhancement ** r;
}

/** Peak angular frequency of a fetch-limited JONSWAP sea. */
export function peakFrequency(windSpeed: number, fetchMetres: number): number {
  if (windSpeed <= 0) return 1;
  const dimensionlessFetch = (GRAVITY * fetchMetres) / (windSpeed * windSpeed);
  return 22 * (GRAVITY / windSpeed) * dimensionlessFetch ** -0.33;
}

/**
 * The bank of wave components, plus the statistics that describe it.
 *
 * Rebuilt whenever the wind changes materially. Reading the significant wave height off a
 * rebuilt bank is how the HUD and the boat's handling model learn about the sea state — they
 * are told by the spectrum, not by a weather state's hard-coded number.
 */
export class WaveBank {
  readonly components: WaveComponent[] = [];
  /** Significant wave height, metres: the mean height of the highest third, = 4√m₀. */
  readonly significantWaveHeight: number;
  /** Period of the spectral peak, seconds. */
  readonly peakPeriod: number;
  /** Largest possible vertical displacement, for clipmap bounds and camera clearance. */
  readonly maxAmplitude: number;

  constructor(parameters: SpectrumParameters) {
    const {
      windSpeed,
      windDirection,
      fetchKm,
      waveCount,
      seed,
      spreading,
      amplitudeScale,
    } = parameters;

    const fetchMetres = Math.max(1000, fetchKm * 1000);
    const speed = Math.max(0.2, windSpeed);
    const omegaPeak = peakFrequency(speed, fetchMetres);
    this.peakPeriod = (2 * Math.PI) / omegaPeak;

    const random = new PRNG(seed);

    // Sample from 0.6·ωp to 3.2·ωp. Below that the energy is negligible for a wind sea; above
    // it the wavelengths are shorter than the mesh can resolve and belong to the detail normal
    // maps instead. Geometric spacing puts more components where the energy is.
    const omegaMin = omegaPeak * 0.62;
    const omegaMax = omegaPeak * 3.2;
    const count = Math.max(3, Math.floor(waveCount));

    let varianceSum = 0;
    let amplitudeSum = 0;

    for (let i = 0; i < count; i += 1) {
      // Geometric progression with a small irrational jitter. The jitter is what kills the
      // repeat period: with commensurate frequencies the whole surface returns to its starting
      // configuration on a fixed cycle, and on open water that pulse is very visible.
      const t = (i + 0.5) / count;
      const jitter = 1 + (random.next() - 0.5) * 0.22;
      const omega = omegaMin * (omegaMax / omegaMin) ** t * jitter;

      // Width of this component's slice of the spectrum, for converting density to amplitude.
      const tLow = i / count;
      const tHigh = (i + 1) / count;
      const deltaOmega =
        omegaMin * ((omegaMax / omegaMin) ** tHigh - (omegaMax / omegaMin) ** tLow);

      // Directional spreading: cos^2s(Δθ/2), sampled by inverting a coarse CDF. Long waves
      // hold the wind direction closely; short chop scatters much more widely, which is what
      // makes a real sea short-crested rather than a set of parallel ridges.
      const localSpreading = spreading * Math.min(1, (omegaPeak / omega) ** 2.5) + 1.2;
      const spreadAngle = sampleSpreading(random.next(), localSpreading);
      const direction = windDirection + spreadAngle;

      const density = jonswapDensity(omega, speed, fetchMetres);
      // a = √(2·S(ω)·Δω), the standard conversion from energy density to component amplitude.
      let amplitude = Math.sqrt(Math.max(0, 2 * density * deltaOmega)) * amplitudeScale;

      // Deep-water dispersion: ω² = g·k.
      const wavenumber = (omega * omega) / GRAVITY;

      // Cap individual steepness. k·a above ~0.4 is past the breaking limit for a single
      // component; real waves at that point stop being sinusoidal and start being foam, which
      // the foam term handles instead.
      const maxAmplitude = 0.42 / wavenumber;
      amplitude = Math.min(amplitude, maxAmplitude);

      varianceSum += (amplitude * amplitude) / 2;
      amplitudeSum += amplitude;

      this.components.push({
        amplitude,
        wavenumber,
        frequency: omega,
        // Azimuth is measured from north (−Z) eastward (+X), so the travel direction is
        // (sin θ, cos θ) in (x, z) with z negated — the same convention as the celestial frame.
        directionX: Math.sin(direction),
        directionZ: -Math.cos(direction),
        phase: random.next() * Math.PI * 2,
        // Filled in below: steepness is normalised across the whole bank so the *sum* of
        // k·a·Q stays under 1, whatever the component count. Exceeding it folds the surface
        // through itself, which reads as the water turning inside out.
        steepness: 0,
      });
    }

    // Normalise steepness across the bank so the total pinch is bounded regardless of count.
    let steepnessBudget = 0;
    for (const component of this.components) {
      steepnessBudget += component.wavenumber * component.amplitude;
    }
    const scale = steepnessBudget > 0 ? Math.min(1, 0.85 / steepnessBudget) : 0;
    for (const component of this.components) {
      component.steepness = scale;
    }

    this.significantWaveHeight = 4 * Math.sqrt(varianceSum);
    this.maxAmplitude = amplitudeSum;
  }

  /**
   * Displacement of the water surface for a point whose *undisplaced* position is (x, z).
   *
   * This is the reference implementation. `shaders/lib/gerstner.glsl` mirrors it exactly and
   * the parity harness in `npm run verify` proves it.
   */
  evaluate(x: number, z: number, time: number, out: Displacement): Displacement {
    let dx = 0;
    let dy = 0;
    let dz = 0;

    for (let i = 0; i < this.components.length; i += 1) {
      const c = this.components[i];
      if (c === undefined) continue;
      const projection = c.directionX * x + c.directionZ * z;
      const theta = c.wavenumber * projection - c.frequency * time + c.phase;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      const pinch = c.steepness * c.amplitude;

      dx += pinch * c.directionX * cosTheta;
      dy += c.amplitude * sinTheta;
      dz += pinch * c.directionZ * cosTheta;
    }

    out.x = dx;
    out.y = dy;
    out.z = dz;
    return out;
  }

  /**
   * Surface height at a *world* position.
   *
   * Gerstner waves displace horizontally as well as vertically, so the point that ends up
   * above (x, z) started somewhere else. This inverts that with fixed-point iteration: guess
   * that the origin was (x, z), see where it lands, correct by the error, repeat. Four
   * iterations converge to well under a millimetre for any steepness the bank permits, and it
   * is the difference between a hull that sits in the water and one that skates over it.
   */
  heightAt(x: number, z: number, time: number, out?: Displacement): number {
    const scratch = out ?? { x: 0, y: 0, z: 0 };
    let originX = x;
    let originZ = z;

    for (let iteration = 0; iteration < 4; iteration += 1) {
      this.evaluate(originX, originZ, time, scratch);
      const errorX = x - (originX + scratch.x);
      const errorZ = z - (originZ + scratch.z);
      originX += errorX;
      originZ += errorZ;
    }

    this.evaluate(originX, originZ, time, scratch);
    return scratch.y;
  }

  /**
   * Analytic surface normal at an undisplaced position.
   *
   * Differentiated in closed form rather than sampled with finite differences: at the
   * wavelengths involved a finite-difference normal is either noisy (small epsilon) or
   * flattened (large epsilon), and it costs three extra evaluations.
   */
  normalAt(x: number, z: number, time: number, out: Displacement): Displacement {
    // Partial derivatives of the displaced position with respect to the undisplaced x and z.
    let dPdxX = 1;
    let dPdxY = 0;
    let dPdxZ = 0;
    let dPdzX = 0;
    let dPdzY = 0;
    let dPdzZ = 1;

    for (let i = 0; i < this.components.length; i += 1) {
      const c = this.components[i];
      if (c === undefined) continue;
      const projection = c.directionX * x + c.directionZ * z;
      const theta = c.wavenumber * projection - c.frequency * time + c.phase;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);

      const pinch = c.steepness * c.amplitude * c.wavenumber;
      const slope = c.amplitude * c.wavenumber;

      dPdxX -= pinch * c.directionX * c.directionX * sinTheta;
      dPdxZ -= pinch * c.directionX * c.directionZ * sinTheta;
      dPdxY += slope * c.directionX * cosTheta;

      dPdzX -= pinch * c.directionZ * c.directionX * sinTheta;
      dPdzZ -= pinch * c.directionZ * c.directionZ * sinTheta;
      dPdzY += slope * c.directionZ * cosTheta;
    }

    // Normal is the cross product of the two tangents, oriented upwards.
    const nx = dPdzY * dPdxZ - dPdzZ * dPdxY;
    const ny = dPdzZ * dPdxX - dPdzX * dPdxZ;
    const nz = dPdzX * dPdxY - dPdzY * dPdxX;
    const length = Math.hypot(nx, ny, nz) || 1;

    out.x = nx / length;
    out.y = ny / length;
    out.z = nz / length;
    return out;
  }

  /**
   * Jacobian determinant of the horizontal displacement.
   *
   * Below 1 the surface is compressing; below zero it has folded through itself, which
   * physically corresponds to a breaking crest. This is what drives foam — foam appears where
   * the water is genuinely piling up, not where a noise texture happens to be bright.
   */
  jacobianAt(x: number, z: number, time: number): number {
    let jxx = 1;
    let jxz = 0;
    let jzx = 0;
    let jzz = 1;

    for (let i = 0; i < this.components.length; i += 1) {
      const c = this.components[i];
      if (c === undefined) continue;
      const projection = c.directionX * x + c.directionZ * z;
      const theta = c.wavenumber * projection - c.frequency * time + c.phase;
      const sinTheta = Math.sin(theta);
      const pinch = c.steepness * c.amplitude * c.wavenumber * sinTheta;

      jxx -= pinch * c.directionX * c.directionX;
      jxz -= pinch * c.directionX * c.directionZ;
      jzx -= pinch * c.directionZ * c.directionX;
      jzz -= pinch * c.directionZ * c.directionZ;
    }

    return jxx * jzz - jxz * jzx;
  }

  /** Flatten the bank into the layout the shader's uniform array expects. */
  toUniformArray(target: Float32Array): number {
    const stride = 4;
    const count = Math.min(this.components.length, Math.floor(target.length / (stride * 2)));
    for (let i = 0; i < count; i += 1) {
      const c = this.components[i];
      if (c === undefined) continue;
      // vec4 A: direction.xz, amplitude, wavenumber
      target[i * stride] = c.directionX;
      target[i * stride + 1] = c.directionZ;
      target[i * stride + 2] = c.amplitude;
      target[i * stride + 3] = c.wavenumber;
      // vec4 B: frequency, phase, steepness, unused
      const offset = count * stride + i * stride;
      target[offset] = c.frequency;
      target[offset + 1] = c.phase;
      target[offset + 2] = c.steepness;
      target[offset + 3] = 0;
    }
    return count;
  }
}

/**
 * Sample the cos^2s spreading function by numerically inverting its CDF.
 *
 * A closed-form inverse does not exist for arbitrary s, but the distribution is smooth, narrow
 * and evaluated a handful of times at bank construction, so a 64-bin CDF and a linear search
 * is both exact enough and irrelevant to the frame budget.
 */
function sampleSpreading(u: number, s: number): number {
  const BINS = 64;
  const half = Math.PI / 2;
  let total = 0;
  const weights = new Float64Array(BINS);

  for (let i = 0; i < BINS; i += 1) {
    const angle = -half + ((i + 0.5) / BINS) * Math.PI;
    const w = Math.cos(angle / 2) ** (2 * s);
    weights[i] = w;
    total += w;
  }
  if (total <= 0) return 0;

  let cumulative = 0;
  const target = u * total;
  for (let i = 0; i < BINS; i += 1) {
    cumulative += weights[i] ?? 0;
    if (cumulative >= target) {
      return -half + ((i + 0.5) / BINS) * Math.PI;
    }
  }
  return 0;
}

/**
 * Significant wave height for a fully developed sea at a given wind speed.
 *
 * Used to sanity-check the sampled bank against the Beaufort scale: at force 6 (12.5 m/s) the
 * real answer is around 3 m, at force 9 (22 m/s) around 7 m. If the bank drifts far from this
 * the spectrum sampling has a bug, and the tests assert it.
 */
export function fullyDevelopedWaveHeight(windSpeed: number): number {
  return 0.0246 * windSpeed * windSpeed;
}

/**
 * Simplex noise (2D/3D) and fractal Brownian motion.
 *
 * Used for the synoptic pressure field that drives weather, island heightfields, seabed
 * relief and cloud shape. The permutation table is seeded, so the world stays deterministic.
 *
 * Simplex rather than Perlin because the 3D case is what the weather field and the cloud
 * volume both want, and Perlin's axis-aligned directional bias is very visible in a slowly
 * drifting cloud layer.
 */

import { splitmix32 } from './PRNG.js';

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const F3 = 1 / 3;
const G3 = 1 / 6;

const GRAD3 = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0,
  -1, 1, 0, 1, -1, 0, -1, -1,
]);

export class Noise {
  private readonly perm = new Uint8Array(512);
  private readonly permMod12 = new Uint8Array(512);

  constructor(seed: number) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) p[i] = i;

    const mix = splitmix32(seed);
    for (let i = 255; i > 0; i -= 1) {
      const j = mix() % (i + 1);
      const a = p[i] ?? 0;
      p[i] = p[j] ?? 0;
      p[j] = a;
    }
    for (let i = 0; i < 512; i += 1) {
      const v = p[i & 255] ?? 0;
      this.perm[i] = v;
      this.permMod12[i] = v % 12;
    }
  }

  /** 2D simplex noise in roughly [-1, 1]. */
  noise2(xin: number, yin: number): number {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);

    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = (this.permMod12[ii + (this.perm[jj] ?? 0)] ?? 0) * 3;
    const gi1 = (this.permMod12[ii + i1 + (this.perm[jj + j1] ?? 0)] ?? 0) * 3;
    const gi2 = (this.permMod12[ii + 1 + (this.perm[jj + 1] ?? 0)] ?? 0) * 3;

    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      t0 *= t0;
      n += t0 * t0 * ((GRAD3[gi0] ?? 0) * x0 + (GRAD3[gi0 + 1] ?? 0) * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      t1 *= t1;
      n += t1 * t1 * ((GRAD3[gi1] ?? 0) * x1 + (GRAD3[gi1 + 1] ?? 0) * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      t2 *= t2;
      n += t2 * t2 * ((GRAD3[gi2] ?? 0) * x2 + (GRAD3[gi2 + 1] ?? 0) * y2);
    }
    return 70 * n;
  }

  /** 3D simplex noise in roughly [-1, 1]. */
  noise3(xin: number, yin: number, zin: number): number {
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const z0 = zin - (k - t);

    let i1: number;
    let j1: number;
    let k1: number;
    let i2: number;
    let j2: number;
    let k2: number;
    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      } else if (x0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1;
      } else {
        i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1;
      }
    } else if (y0 < z0) {
      i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1;
    } else if (x0 < z0) {
      i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1;
    } else {
      i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
    }

    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3;
    const y2 = y0 - j2 + 2 * G3;
    const z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3;
    const y3 = y0 - 1 + 3 * G3;
    const z3 = z0 - 1 + 3 * G3;

    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;
    const gi0 = (this.permMod12[ii + (this.perm[jj + (this.perm[kk] ?? 0)] ?? 0)] ?? 0) * 3;
    const gi1 =
      (this.permMod12[ii + i1 + (this.perm[jj + j1 + (this.perm[kk + k1] ?? 0)] ?? 0)] ?? 0) * 3;
    const gi2 =
      (this.permMod12[ii + i2 + (this.perm[jj + j2 + (this.perm[kk + k2] ?? 0)] ?? 0)] ?? 0) * 3;
    const gi3 =
      (this.permMod12[ii + 1 + (this.perm[jj + 1 + (this.perm[kk + 1] ?? 0)] ?? 0)] ?? 0) * 3;

    let n = 0;
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 > 0) {
      t0 *= t0;
      n +=
        t0 * t0 *
        ((GRAD3[gi0] ?? 0) * x0 + (GRAD3[gi0 + 1] ?? 0) * y0 + (GRAD3[gi0 + 2] ?? 0) * z0);
    }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 > 0) {
      t1 *= t1;
      n +=
        t1 * t1 *
        ((GRAD3[gi1] ?? 0) * x1 + (GRAD3[gi1 + 1] ?? 0) * y1 + (GRAD3[gi1 + 2] ?? 0) * z1);
    }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 > 0) {
      t2 *= t2;
      n +=
        t2 * t2 *
        ((GRAD3[gi2] ?? 0) * x2 + (GRAD3[gi2 + 1] ?? 0) * y2 + (GRAD3[gi2 + 2] ?? 0) * z2);
    }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 > 0) {
      t3 *= t3;
      n +=
        t3 * t3 *
        ((GRAD3[gi3] ?? 0) * x3 + (GRAD3[gi3 + 1] ?? 0) * y3 + (GRAD3[gi3 + 2] ?? 0) * z3);
    }
    return 32 * n;
  }

  /** Fractal Brownian motion, normalised to roughly [-1, 1]. */
  fbm2(x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let amplitude = 1;
    let frequency = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i += 1) {
      sum += amplitude * this.noise2(x * frequency, y * frequency);
      norm += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return norm === 0 ? 0 : sum / norm;
  }

  fbm3(x: number, y: number, z: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let amplitude = 1;
    let frequency = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i += 1) {
      sum += amplitude * this.noise3(x * frequency, y * frequency, z * frequency);
      norm += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return norm === 0 ? 0 : sum / norm;
  }

  /**
   * Ridged multifractal, in [0, 1]. Island silhouettes and cumulonimbus anvils both want
   * sharp ridges rather than the rounded blobs plain fBm gives.
   */
  ridged2(x: number, y: number, octaves = 5, lacunarity = 2, gain = 0.5): number {
    let amplitude = 1;
    let frequency = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i += 1) {
      const n = 1 - Math.abs(this.noise2(x * frequency, y * frequency));
      sum += amplitude * n * n;
      norm += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return norm === 0 ? 0 : sum / norm;
  }
}

/** Smooth Hermite interpolation, clamped. The single most-used helper in the codebase. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function clamp(x: number, min: number, max: number): number {
  return x < min ? min : x > max ? max : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Frame-rate independent exponential smoothing.
 * `rate` is the fraction of the remaining distance closed per second.
 */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * dt);
}

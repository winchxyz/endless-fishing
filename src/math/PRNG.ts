/**
 * Deterministic pseudo-random numbers.
 *
 * The world is endless and chunk-streamed, so "same seed, same world" only holds if a chunk
 * generates identically no matter when it is visited or what was generated before it. That
 * rules out a single global stream: every chunk derives its own generator from
 * `hash3(seed, chunkX, chunkZ)`, which is what `deriveStream` is for.
 *
 * `sfc32` is the core — 128 bits of state, passes PractRand well past any budget we will use,
 * and is four integer ops per sample. It is seeded through `splitmix32` so that adjacent
 * integer seeds produce completely decorrelated streams.
 */

const UINT32 = 4294967296;

/** SplitMix32 — used to expand a single integer seed into well-mixed state words. */
export function splitmix32(seed: number): () => number {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    return (z ^ (z >>> 15)) >>> 0;
  };
}

/** Order-independent integer hash. Stable across platforms; the basis of chunk determinism. */
export function hash3(a: number, b: number, c: number): number {
  let h = 0x9e3779b9 ^ (a >>> 0);
  h = Math.imul(h ^ (b >>> 0), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = Math.imul(h ^ (c >>> 0), 0x27d4eb2f) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x165667b1) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

export class PRNG {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number) {
    const mix = splitmix32(seed);
    this.a = mix();
    this.b = mix();
    this.c = mix();
    this.d = mix();
    // Discard the first few outputs so low-entropy seeds do not show up in the first sample.
    for (let i = 0; i < 12; i += 1) this.next();
  }

  /** Uniform in [0, 1). */
  next(): number {
    const t = (this.a + this.b) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.d = (this.d + 1) >>> 0;
    const result = (t + this.d) >>> 0;
    this.c = (this.c + result) >>> 0;
    return result / UINT32;
  }

  /** Uniform in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max]. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  /** Standard normal, Box–Muller. Used for wave phase jitter and fish size distributions. */
  gaussian(mean = 0, stdDev = 1): number {
    // `next()` can return exactly 0, and log(0) is -Infinity, so nudge it off the boundary.
    const u1 = Math.max(this.next(), Number.EPSILON);
    const u2 = this.next();
    return mean + stdDev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /** Pick one element. Returns undefined only for an empty array. */
  pick<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) return undefined;
    return items[Math.floor(this.next() * items.length)];
  }

  /** In-place Fisher–Yates. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      const a = items[i];
      const b = items[j];
      if (a !== undefined && b !== undefined) {
        items[i] = b;
        items[j] = a;
      }
    }
    return items;
  }

  /**
   * Weighted pick. Weights need not sum to 1; they are normalised here.
   * Returns -1 only if every weight is zero or the list is empty.
   */
  weightedIndex(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += Math.max(0, w);
    if (total <= 0) return -1;
    let roll = this.next() * total;
    for (let i = 0; i < weights.length; i += 1) {
      roll -= Math.max(0, weights[i] ?? 0);
      if (roll <= 0) return i;
    }
    return weights.length - 1;
  }

  /** A fresh, independent stream for a sub-object — a chunk, an island, a fish. */
  static deriveStream(seed: number, x: number, z: number): PRNG {
    return new PRNG(hash3(seed, x | 0, z | 0));
  }
}

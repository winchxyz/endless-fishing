import { PRNG } from '../math/PRNG.js';

/**
 * The streaming grid the endless world is built on.
 *
 * Generic over its payload because islands, props and floating debris all want the same three
 * guarantees and none of them want to reimplement them:
 *
 *   1. **Determinism that does not depend on history.** A chunk's contents come from
 *      `PRNG.deriveStream(seed, cx, cz)` and nothing else — no shared cursor, no counter, no
 *      "what was generated before". Sail east for ten minutes and back and the same island is
 *      there, with the same trees on it, because the same three integers produced it.
 *   2. **A hard budget on work per frame.** Streaming that builds "everything missing" the
 *      moment the player crosses a boundary is what produces the half-second stutter every
 *      thirty seconds that makes an open world feel cheap. Chunks are created a few per frame,
 *      nearest first, and the horizon fills in over a second or two that nobody notices.
 *   3. **Pooling.** A chunk leaving range hands its payload back rather than freeing it, so
 *      sailing in a straight line settles into a steady state with no allocation and no GPU
 *      buffer churn at all.
 *
 * Allocation in the frame loop is zero. The candidate cells are a fixed offset table built once
 * and walked with a cursor; the live set is kept in dense parallel arrays rather than iterated
 * out of the `Map`, because a `Map` iterator is an allocation and there is one of these grids
 * per subsystem.
 */

/** How the grid makes, recycles and destroys whatever it is streaming. */
export interface ChunkFactory<T> {
  /** Metres along one edge of a chunk. */
  readonly chunkSize: number;
  /** Build a payload for a cell. Called only when the pool is empty or `reset` is absent. */
  create(cx: number, cz: number, rng: PRNG): T;
  /**
   * Re-seed a pooled payload for a different cell. Implement this to get pooling; without it
   * every cell builds fresh, which is correct but churns.
   */
  reset?(payload: T, cx: number, cz: number, rng: PRNG): void;
  /** The cell left range. Hide the payload; keep its buffers. */
  retire(payload: T): void;
  /** The payload is being thrown away for good. Free GPU memory here. */
  destroy(payload: T): void;
}

export interface ChunkGridOptions {
  /** Chunks created per `update`. Two is enough to fill a horizon in a couple of seconds. */
  creationBudget?: number;
  /**
   * Extra range, in chunks, a loaded cell keeps before it is retired. Without it a player
   * hovering on a boundary would thrash one ring of chunks in and out every frame.
   */
  hysteresis?: number;
  /** Payloads kept in the pool. Beyond this they are destroyed. */
  poolLimit?: number;
}

/**
 * Pack a cell coordinate pair into one exact double.
 *
 * `Number` is exact to 2⁵³, so this is collision-free for |cz| < 2²² and |cx| < 2³¹ — about
 * 1.6 billion metres of ocean in each direction at any sane chunk size.
 */
const CX_STRIDE = 0x800000;

function cellKey(cx: number, cz: number): number {
  return cx * CX_STRIDE + cz;
}

export class ChunkGrid<T> {
  private readonly factory: ChunkFactory<T>;
  private readonly seed: number;
  private readonly creationBudget: number;
  private readonly hysteresis: number;
  private readonly poolLimit: number;

  /** Cell key → index into the dense arrays below. */
  private readonly slots = new Map<number, number>();
  private readonly payloads: T[] = [];
  private readonly keys: number[] = [];
  private readonly coords: number[] = [];
  private readonly pool: T[] = [];

  /** (dx, dz) pairs covering the draw radius, sorted nearest first. */
  private offsets = new Int32Array(0);
  private radius = 0;
  private radiusSquared = 0;
  private retireRadiusSquared = 0;

  private centreX = 0;
  private centreZ = 0;
  /** Cursor into `offsets`. Reaching the end means the horizon is complete. */
  private scanIndex = 0;
  private centred = false;

  constructor(factory: ChunkFactory<T>, seed: number, options: ChunkGridOptions = {}) {
    this.factory = factory;
    this.seed = seed >>> 0;
    this.creationBudget = Math.max(1, options.creationBudget ?? 2);
    this.hysteresis = Math.max(0, options.hysteresis ?? 1);
    this.poolLimit = Math.max(0, options.poolLimit ?? 24);
    this.setDrawDistance(factory.chunkSize * 3);
  }

  /** Number of cells currently live. */
  get count(): number {
    return this.payloads.length;
  }

  /** Live payloads, dense. Index-safe to walk in a frame loop; do not mutate. */
  get active(): readonly T[] {
    return this.payloads;
  }

  /** True once every cell inside the draw distance exists. */
  get settled(): boolean {
    return this.centred && this.scanIndex >= this.offsets.length;
  }

  /** World-space centre of the live payload at `index`, X component. */
  centreXOf(index: number): number {
    return ((this.coords[index * 2] ?? 0) + 0.5) * this.factory.chunkSize;
  }

  centreZOf(index: number): number {
    return ((this.coords[index * 2 + 1] ?? 0) + 0.5) * this.factory.chunkSize;
  }

  get(cx: number, cz: number): T | undefined {
    const slot = this.slots.get(cellKey(cx, cz));
    return slot === undefined ? undefined : this.payloads[slot];
  }

  /**
   * Rebuild the candidate table for a new draw distance.
   *
   * Sorted by squared distance so the cursor always creates the nearest missing cell first —
   * which is the one the player is about to sail into.
   */
  setDrawDistance(metres: number): void {
    const radius = Math.max(1, Math.ceil(metres / this.factory.chunkSize));
    if (radius === this.radius && this.offsets.length > 0) return;

    this.radius = radius;
    this.radiusSquared = radius * radius;
    const retire = radius + this.hysteresis;
    this.retireRadiusSquared = retire * retire;

    const candidates: number[] = [];
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (dx * dx + dz * dz > this.radiusSquared) continue;
        candidates.push(dx, dz);
      }
    }

    const order: number[] = [];
    for (let i = 0; i < candidates.length; i += 2) order.push(i);
    order.sort((a, b) => {
      const ax = candidates[a] ?? 0;
      const az = candidates[a + 1] ?? 0;
      const bx = candidates[b] ?? 0;
      const bz = candidates[b + 1] ?? 0;
      return ax * ax + az * az - (bx * bx + bz * bz);
    });

    const packed = new Int32Array(order.length * 2);
    for (let i = 0; i < order.length; i += 1) {
      const source = order[i] ?? 0;
      packed[i * 2] = candidates[source] ?? 0;
      packed[i * 2 + 1] = candidates[source + 1] ?? 0;
    }
    this.offsets = packed;
    this.scanIndex = 0;
    this.sweep();
  }

  /** Stream around a world position. Call once per frame. */
  update(worldX: number, worldZ: number): void {
    const size = this.factory.chunkSize;
    const cx = Math.floor(worldX / size);
    const cz = Math.floor(worldZ / size);

    if (!this.centred || cx !== this.centreX || cz !== this.centreZ) {
      this.centreX = cx;
      this.centreZ = cz;
      this.centred = true;
      this.scanIndex = 0;
      this.sweep();
    }

    let created = 0;
    while (this.scanIndex < this.offsets.length && created < this.creationBudget) {
      const index = this.scanIndex;
      this.scanIndex += 2;
      const x = cx + (this.offsets[index] ?? 0);
      const z = cz + (this.offsets[index + 1] ?? 0);
      if (this.slots.has(cellKey(x, z))) continue;
      this.spawn(x, z);
      created += 1;
    }
  }

  dispose(): void {
    for (const payload of this.payloads) this.factory.destroy(payload);
    for (const payload of this.pool) this.factory.destroy(payload);
    this.payloads.length = 0;
    this.keys.length = 0;
    this.coords.length = 0;
    this.pool.length = 0;
    this.slots.clear();
    this.centred = false;
  }

  private spawn(cx: number, cz: number): void {
    const rng = PRNG.deriveStream(this.seed, cx, cz);
    const recycled = this.factory.reset === undefined ? undefined : this.pool.pop();

    let payload: T;
    if (recycled === undefined) {
      payload = this.factory.create(cx, cz, rng);
    } else {
      payload = recycled;
      this.factory.reset?.(payload, cx, cz, rng);
    }

    this.slots.set(cellKey(cx, cz), this.payloads.length);
    this.payloads.push(payload);
    this.keys.push(cellKey(cx, cz));
    this.coords.push(cx, cz);
  }

  /** Retire every live cell now outside the retire radius. Runs only when the centre moves. */
  private sweep(): void {
    for (let i = this.payloads.length - 1; i >= 0; i -= 1) {
      const dx = (this.coords[i * 2] ?? 0) - this.centreX;
      const dz = (this.coords[i * 2 + 1] ?? 0) - this.centreZ;
      if (dx * dx + dz * dz <= this.retireRadiusSquared) continue;
      this.release(i);
    }
  }

  /** Swap-remove, so the dense arrays stay dense and nothing is copied. */
  private release(index: number): void {
    const payload = this.payloads[index];
    const key = this.keys[index];
    if (payload === undefined || key === undefined) return;

    this.factory.retire(payload);
    this.slots.delete(key);

    const last = this.payloads.length - 1;
    if (index !== last) {
      const movedPayload = this.payloads[last];
      const movedKey = this.keys[last];
      if (movedPayload !== undefined && movedKey !== undefined) {
        this.payloads[index] = movedPayload;
        this.keys[index] = movedKey;
        this.coords[index * 2] = this.coords[last * 2] ?? 0;
        this.coords[index * 2 + 1] = this.coords[last * 2 + 1] ?? 0;
        this.slots.set(movedKey, index);
      }
    }
    this.payloads.length = last;
    this.keys.length = last;
    this.coords.length = last * 2;

    if (this.factory.reset !== undefined && this.pool.length < this.poolLimit) {
      this.pool.push(payload);
    } else {
      this.factory.destroy(payload);
    }
  }
}

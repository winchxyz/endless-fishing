import { Noise, clamp, lerp, smoothstep } from '../math/Noise.js';
import { PRNG } from '../math/PRNG.js';

/**
 * The land, as arithmetic.
 *
 * Everything solid in the world — the shape of an island, where the beach is, which trees grow
 * on it, which rock a lighthouse stands on — is a pure function of the world seed and a position.
 * No `three`, no GPU, no history. That is what makes "same seed, same world" true rather than
 * aspirational, and it is why this file is the one the unit tests can actually reach.
 *
 * Three properties are load-bearing and all three fall out of the same decision:
 *
 *   1. **The heightfield is one global function, not a per-chunk one.** `heightAt` takes a world
 *      position and answers. A chunk mesh is a *sampling* of it, so two chunks meeting at an edge
 *      cannot disagree — they evaluated the same function at the same point. Terrain that is
 *      generated per tile and then stitched is where seams come from, and there is nothing to
 *      stitch here.
 *   2. **An island's influence is exactly zero outside its radius.** Not "very small" — zero, by
 *      an early return. So it does not matter how wide a net a query casts for nearby islands:
 *      including one that cannot reach the point adds an exact 0. That is what lets the search
 *      window be centred on the *point's* lattice cell, which changes as you cross a cell
 *      boundary, without the answer changing with it.
 *   3. **Islands combine with `max`, not with a sum.** `max` is order-independent in floating
 *      point and a sum is not, so two code paths that visit the same islands in different orders
 *      still agree bit for bit.
 *
 * The lattice is deliberately coarser than the chunk grid: islands are rare and large, chunks are
 * small and streamed, and tying the two together would either give one island per chunk or force
 * islands to be chunk-sized.
 */

/** Metres along one edge of an island lattice cell. At most one island is born in each. */
export const ISLAND_CELL_M = 1024;
/** Metres along one edge of a streamed terrain chunk. */
export const TERRAIN_CHUNK_M = 256;
/** Metres along one edge of a streamed prop chunk. */
export const PROP_CHUNK_M = 512;
/**
 * Seabed depth in open water, metres. The ocean shader carries the same number as its default;
 * away from land the two agree by construction, and near land `depthAt` is what shoals it.
 */
export const OPEN_WATER_DEPTH_M = 55;

/**
 * Largest island radius, metres. The one-ring search in `heightAt` is only correct while this is
 * smaller than `ISLAND_CELL_M`: an island two cells away is at least one full cell distant, so it
 * cannot reach. Raising the radius past the cell size silently reintroduces seams.
 */
const MAX_ISLAND_RADIUS_M = 420;
const MIN_ISLAND_RADIUS_M = 150;
/** Island centres are jittered within this fraction of their cell, keeping them inside it. */
const CENTRE_JITTER = 0.3;
/** Fraction of lattice cells that carry an island. */
const ISLAND_DENSITY = 0.34;
/** Height of the top of the beach above mean water, metres — above the highest spring tide. */
const BEACH_CREST_M = 2.2;
/** Depth at the outer toe of the beach face, metres. Below this is the drop-off. */
const SURF_DEPTH_M = 2.6;

/** Independent PRNG streams. Sharing one would couple a tree's position to a buoy's. */
const SALT_ISLAND = 0x0015_1a4d;
const SALT_VEGETATION = 0x007e_ee51;
const SALT_PROPS = 0x009d_041e;

/** Spatial frequencies, cycles per metre. */
const SEABED_FREQUENCY = 0.00035;
const COAST_FREQUENCY = 0.0016;

/**
 * Island cache size. An endless world would grow an unbounded map, so it is emptied wholesale
 * once it passes this — cheaper and far less code than an LRU, and the cost of refilling a few
 * thousand small objects is invisible next to the meshing it saves.
 */
const ISLAND_CACHE_LIMIT = 4096;

/** Metres of swash above the still waterline that stay wet even at the top of the tide. */
const SWASH_ALLOWANCE_M = 0.25;
/** How much of the tide's fall the sand has not yet dried out over. */
const DRYING_FRACTION = 0.9;

export interface Island {
  readonly cellX: number;
  readonly cellZ: number;
  readonly centreX: number;
  readonly centreZ: number;
  readonly radius: number;
  /** Height of the massif above the beach crest at its highest, metres. */
  readonly height: number;
  /** Normalised radius at which the beach crest gives way to the beach face. */
  readonly beachInner: number;
  /** Normalised radius at which the beach face reaches the surf floor. */
  readonly beachOuter: number;
  /** Where the massif rises, as a fraction of `beachInner` — so it always stands inland of it. */
  readonly massifEdge: number;
  /** 0 = rounded moorland, 1 = ridged and quarried. */
  readonly ruggedness: number;
  readonly ridgeFrequency: number;
  /** Offset into the noise field, so no two islands are the same rock twice. */
  readonly noiseX: number;
  readonly noiseZ: number;
}

/** Downhill slope of the heightfield, metres per metre. */
export interface Gradient {
  dx: number;
  dz: number;
}

export function createGradient(): Gradient {
  return { dx: 0, dz: 0 };
}

/** Height extremes of a sampled chunk, for culling and for choosing what to put on it. */
export interface GridStats {
  min: number;
  max: number;
}

export function createGridStats(): GridStats {
  return { min: 0, max: 0 };
}

function cellKey(cx: number, cz: number): number {
  return cx * 0x800000 + cz;
}

export class WorldField {
  readonly seed: number;
  private readonly relief: Noise;
  private readonly coast: Noise;
  private readonly detail: Noise;
  private readonly islands = new Map<number, Island | null>();

  constructor(seed: number) {
    this.seed = seed >>> 0;
    // Three permutation tables rather than one sampled at three frequencies: shared tables put a
    // faint correlation between the seabed and the coastline, and a coastline that bends where
    // the seabed happens to bend is the sort of thing you cannot unsee once you have seen it.
    this.relief = new Noise(this.seed ^ 0x51ed);
    this.coast = new Noise(this.seed ^ 0xc0a5);
    this.detail = new Noise(this.seed ^ 0xd37a);
  }

  /** The island born in a lattice cell, or null. Cached; the result is a pure function. */
  islandAt(cellX: number, cellZ: number): Island | null {
    const key = cellKey(cellX, cellZ);
    const cached = this.islands.get(key);
    if (cached !== undefined) return cached;
    if (this.islands.size >= ISLAND_CACHE_LIMIT) this.islands.clear();

    const rng = PRNG.deriveStream(this.seed ^ SALT_ISLAND, cellX, cellZ);
    let island: Island | null = null;
    if (rng.bool(ISLAND_DENSITY)) {
      const centreX = (cellX + 0.5 + rng.range(-CENTRE_JITTER, CENTRE_JITTER)) * ISLAND_CELL_M;
      const centreZ = (cellZ + 0.5 + rng.range(-CENTRE_JITTER, CENTRE_JITTER)) * ISLAND_CELL_M;
      // Radius and height are drawn independently, which is what puts both bare skerries and
      // proper crags in the same sea. A fixed aspect ratio makes every island a scaled copy.
      const beachInner = rng.range(0.42, 0.58);
      island = {
        cellX,
        cellZ,
        centreX,
        centreZ,
        radius: rng.range(MIN_ISLAND_RADIUS_M, MAX_ISLAND_RADIUS_M),
        height: rng.range(9, 96),
        beachInner,
        beachOuter: beachInner + rng.range(0.2, 0.34),
        massifEdge: rng.range(0.45, 0.88),
        ruggedness: rng.range(0.2, 0.95),
        ridgeFrequency: rng.range(0.0045, 0.011),
        noiseX: rng.range(-6000, 6000),
        noiseZ: rng.range(-6000, 6000),
      };
    }

    this.islands.set(key, island);
    return island;
  }

  /** Bed elevation with no island on it, metres relative to mean sea level. Always negative. */
  seabedAt(x: number, z: number): number {
    const relief = this.relief.fbm2(x * SEABED_FREQUENCY, z * SEABED_FREQUENCY, 4);
    return -OPEN_WATER_DEPTH_M + relief * 11;
  }

  /**
   * Bed elevation including any island, metres relative to mean sea level.
   *
   * Positive is dry land at mean water; the tide then moves the actual waterline across it, which
   * is the whole point of building the coast this way round.
   */
  heightAt(x: number, z: number): number {
    const bed = this.seabedAt(x, z);
    const cellX = Math.floor(x / ISLAND_CELL_M);
    const cellZ = Math.floor(z / ISLAND_CELL_M);

    let lift = 0;
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const island = this.islandAt(cellX + dx, cellZ + dz);
        if (island === null) continue;
        const contribution = this.liftAt(island, x, z, -bed);
        if (contribution > lift) lift = contribution;
      }
    }
    return bed + lift;
  }

  /** Water depth below mean sea level, metres. Zero on land. The ocean and the fish shoal on it. */
  depthAt(x: number, z: number): number {
    return Math.max(0, -this.heightAt(x, z));
  }

  /** Central-difference gradient of the heightfield. Four field evaluations; not for inner loops. */
  gradientAt(x: number, z: number, out: Gradient): Gradient {
    const h = 1.5;
    out.dx = (this.heightAt(x + h, z) - this.heightAt(x - h, z)) / (2 * h);
    out.dz = (this.heightAt(x, z + h) - this.heightAt(x, z - h)) / (2 * h);
    return out;
  }

  /**
   * How far an island lifts the bed at a point, metres. Zero outside its radius, exactly.
   *
   * Three terms, and a real coast is the boundary between the first two:
   *
   *   * **The drop-off** carries the bed from the open seabed at the rim up to the surf floor a
   *     few metres down. Shaped as `s(2 − s)` rather than as a plain smoothstep so the shallow
   *     part is wide and the steep part is at the foot — which is where a shoal actually is, and
   *     which is what gives the fish somewhere to gather.
   *   * **The beach face** carries it from the surf floor to the crest, a couple of metres above
   *     the highest spring tide. This is the band the tide moves across, and it is the reason the
   *     whole island profile is built in absolute depths rather than in fractions: the crest lands
   *     at the same height above mean water on every island, so the wet-sand band in the shader
   *     lands in the same place too.
   *   * **The massif** sits on top of the crest and is where the rock is. Where it comes almost
   *     to the water there is a cliff; where it stops well inland there is a strand. One noise
   *     field decides which, per sector, so a single island has both — as real ones do.
   *
   * `localDepth` is the seabed at *this* point, not at the island's centre. Using the centre's
   * would make the crest ride up and down with the seabed relief underneath it, and a beach whose
   * height above the water depends on what the seabed happens to be doing is not a beach.
   */
  private liftAt(island: Island, x: number, z: number, localDepth: number): number {
    const dx = x - island.centreX;
    const dz = z - island.centreZ;
    const distanceSquared = dx * dx + dz * dz;
    if (distanceSquared >= island.radius * island.radius) return 0;

    const t = Math.sqrt(distanceSquared) / island.radius;
    const wobble = this.coast.fbm2(
      (x + island.noiseX) * COAST_FREQUENCY,
      (z + island.noiseZ) * COAST_FREQUENCY,
      3,
    );

    const inner = clamp(island.beachInner + wobble * 0.11, 0.28, 0.86);
    const outer = clamp(island.beachOuter + wobble * 0.08, inner + 0.06, 0.96);

    // `smoothstep(1, edge, t)` is exactly 0 at t = 1 for any edge below 1, and that identity is
    // what the whole seamlessness argument rests on: an island contributes nothing at all outside
    // its radius, so which cells a query happens to search cannot change the answer.
    const s = smoothstep(1, outer, t);
    const shelf = s * (2 - s);
    const beach = smoothstep(outer, inner, t);

    const surfLift = localDepth - SURF_DEPTH_M;
    // Dunes and blowouts along the crest. Sampled at its own frequency rather than reusing the
    // coastline noise, or the tallest dunes would always sit on the same part of every island.
    const dune = this.detail.fbm2(
      (x + island.noiseX) * 0.011,
      (z + island.noiseZ) * 0.011,
      2,
    );
    const crestLift = localDepth + BEACH_CREST_M + dune * 1.0;
    const lift = shelf * surfLift + beach * (crestLift - surfLift);

    const massifEdge = clamp(island.massifEdge * inner + wobble * 0.09, 0.06, inner - 0.03);
    const massif = smoothstep(massifEdge, massifEdge * 0.2, t);
    if (massif <= 0) return lift;

    const nx = (x + island.noiseX) * island.ridgeFrequency;
    const nz = (z + island.noiseZ) * island.ridgeFrequency;
    const ridged = this.relief.ridged2(nx, nz, 5);
    const rolling = this.detail.fbm2(nx, nz, 4) * 0.5 + 0.5;
    const shape = lerp(rolling, ridged, island.ruggedness);

    return lift + massif * massif * island.height * shape;
  }

  /**
   * Peak bed elevation anywhere in a terrain chunk, from a coarse scan.
   *
   * The streaming grid asks this of every cell it is about to create and skips the ones that are
   * open water, which is most of them. Twenty-five field evaluations against nine thousand is the
   * difference between a chunk costing nothing and a chunk costing a frame.
   */
  chunkPeak(cx: number, cz: number): number {
    const step = TERRAIN_CHUNK_M / 4;
    let peak = Number.NEGATIVE_INFINITY;
    for (let j = 0; j <= 4; j += 1) {
      for (let i = 0; i <= 4; i += 1) {
        const height = this.heightAt(cx * TERRAIN_CHUNK_M + i * step, cz * TERRAIN_CHUNK_M + j * step);
        if (height > peak) peak = height;
      }
    }
    return peak;
  }

  /**
   * Sample a terrain chunk onto a regular lattice, with a one-cell halo.
   *
   * `out` must hold `(segments + 3)²` floats and is indexed `j * (segments + 3) + i`, with i = 1
   * and i = segments + 1 landing exactly on the chunk's own edges. The halo exists so that the
   * finite-difference normals at those edges are *central* differences like everywhere else —
   * one-sided normals on the boundary are how a seamless heightfield still ends up with a visible
   * crease along every chunk edge.
   *
   * Positions are `globalIndex * step` and never `origin + local * step`. That is not fussiness:
   * `256 / 96` is not exact in binary, so the two spellings disagree in the last bit and the
   * shared edge of two chunks would be sampled at two different places.
   */
  sampleChunkGrid(cx: number, cz: number, segments: number, out: Float32Array, stats: GridStats): void {
    const step = TERRAIN_CHUNK_M / segments;
    const stride = segments + 3;
    const baseI = cx * segments - 1;
    const baseJ = cz * segments - 1;

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let j = 0; j < stride; j += 1) {
      const z = (baseJ + j) * step;
      const row = j * stride;
      for (let i = 0; i < stride; i += 1) {
        const height = this.heightAt((baseI + i) * step, z);
        out[row + i] = height;
        if (height < min) min = height;
        if (height > max) max = height;
      }
    }
    stats.min = min;
    stats.max = max;
  }
}

/**
 * Bilinear height lookup into a sampled chunk grid.
 *
 * Vegetation and props inside a chunk are planted on *this* rather than on `heightAt`, so that
 * a tree sits on the triangle that is actually drawn instead of on the analytic surface the
 * triangle approximates. The difference is a few centimetres and it is the difference between a
 * trunk standing on the ground and a trunk floating over a valley.
 */
export function sampleGrid(
  grid: Float32Array,
  segments: number,
  cx: number,
  cz: number,
  x: number,
  z: number,
): number {
  const step = TERRAIN_CHUNK_M / segments;
  const stride = segments + 3;
  const u = clamp((x - cx * TERRAIN_CHUNK_M) / step + 1, 0, stride - 1.0001);
  const v = clamp((z - cz * TERRAIN_CHUNK_M) / step + 1, 0, stride - 1.0001);
  const i = Math.floor(u);
  const j = Math.floor(v);
  const fu = u - i;
  const fv = v - j;
  const row = j * stride + i;
  const h00 = grid[row] ?? 0;
  const h10 = grid[row + 1] ?? 0;
  const h01 = grid[row + stride] ?? 0;
  const h11 = grid[row + stride + 1] ?? 0;
  return lerp(lerp(h00, h10, fu), lerp(h01, h11, fu), fv);
}

/** Slope magnitude at a point of a sampled grid, metres per metre. */
export function gridSlope(
  grid: Float32Array,
  segments: number,
  cx: number,
  cz: number,
  x: number,
  z: number,
): number {
  const step = TERRAIN_CHUNK_M / segments;
  const east = sampleGrid(grid, segments, cx, cz, x + step, z);
  const west = sampleGrid(grid, segments, cx, cz, x - step, z);
  const north = sampleGrid(grid, segments, cx, cz, x, z - step);
  const south = sampleGrid(grid, segments, cx, cz, x, z + step);
  return Math.hypot((east - west) / (2 * step), (south - north) / (2 * step));
}

// ---------------------------------------------------------------------------- the wet band
//
// Mirrored, deliberately and knowingly, in `shaders/terrain/terrain.frag`. The shader needs it
// per pixel and the game needs it on the CPU — to know where a crab pot can sit, and so a test
// can assert that the band moves with the tide at all. Both spellings are three lines, and the
// two constants below are the whole of the shared contract.

/**
 * How wet the sand is at a height, 0 dry to 1 saturated.
 *
 * The physical claim is only this: the sand that is wet is the sand the tide has uncovered but
 * not yet dried. So the band's width is the distance the water has *fallen* since high water —
 * nothing at the top of the tide, the entire range at low water on a spring — and its bottom is
 * always the waterline itself, wherever the tide has put it.
 */
export function wetSandWetness(surfaceY: number, tideHeight: number, highWaterMark: number): number {
  const span = SWASH_ALLOWANCE_M + Math.max(0, highWaterMark - tideHeight) * DRYING_FRACTION;
  return 1 - smoothstep(0, span, surfaceY - tideHeight);
}

/** Height above mean water at which the sand is dry again, metres. The top of the dark band. */
export function wetSandTopM(tideHeight: number, highWaterMark: number): number {
  return tideHeight + SWASH_ALLOWANCE_M + Math.max(0, highWaterMark - tideHeight) * DRYING_FRACTION;
}

// ------------------------------------------------------------------------------- vegetation

/** Candidate trees per chunk edge. The grid is jittered, so this is a density, not a pattern. */
const TREE_GRID = 10;
/** Candidate grass tufts per chunk edge. */
const GRASS_GRID = 32;
export const TREE_CAPACITY = TREE_GRID * TREE_GRID;
export const GRASS_CAPACITY = GRASS_GRID * GRASS_GRID;
/** Floats per tree: x, y, z, yaw, scale, species. */
export const TREE_STRIDE = 6;
/** Floats per grass tuft: x, y, z, yaw, scale. */
export const GRASS_STRIDE = 5;
/** Tree species built by `Vegetation.ts`. */
export const TREE_SPECIES = 2;

/** Metres above mean water below which nothing takes root — it is salt-scoured shingle. */
const TREE_LINE_LOW_M = 3.4;
const GRASS_LINE_LOW_M = 1.6;
/** Slopes, metres per metre, above which soil does not stay put. */
const TREE_MAX_SLOPE = 0.7;
const GRASS_MAX_SLOPE = 0.95;

export interface ChunkContent {
  cx: number;
  cz: number;
  treeCount: number;
  grassCount: number;
  readonly trees: Float32Array;
  readonly grass: Float32Array;
}

export function createChunkContent(): ChunkContent {
  return {
    cx: 0,
    cz: 0,
    treeCount: 0,
    grassCount: 0,
    trees: new Float32Array(TREE_CAPACITY * TREE_STRIDE),
    grass: new Float32Array(GRASS_CAPACITY * GRASS_STRIDE),
  };
}

/**
 * Plant a chunk.
 *
 * The stream is derived from `(seed, cx, cz)` here rather than taken from the caller, so that
 * what grows on a chunk cannot depend on what the caller had generated before it. That is the
 * one rule the whole streaming design rests on and it is cheap enough to enforce locally.
 *
 * Every accepted candidate is written, always, and the renderer draws a *prefix* of the list
 * according to the instance-density setting. Filtering by density during generation would make
 * the quality preset change which trees exist, which is a different world on Low than on Ultra.
 */
export function fillChunkContent(
  field: WorldField,
  cx: number,
  cz: number,
  grid: Float32Array,
  segments: number,
  out: ChunkContent,
): void {
  out.cx = cx;
  out.cz = cz;
  out.treeCount = 0;
  out.grassCount = 0;

  const rng = PRNG.deriveStream(field.seed ^ SALT_VEGETATION, cx, cz);
  const originX = cx * TERRAIN_CHUNK_M;
  const originZ = cz * TERRAIN_CHUNK_M;

  // Woodland is patchy at a scale of a couple of hundred metres. Without the mask a slope either
  // has trees everywhere it can or none at all, and an island reads as a lawn with a haircut.
  const treeStep = TERRAIN_CHUNK_M / TREE_GRID;
  for (let j = 0; j < TREE_GRID; j += 1) {
    for (let i = 0; i < TREE_GRID; i += 1) {
      const x = originX + (i + rng.next()) * treeStep;
      const z = originZ + (j + rng.next()) * treeStep;
      const y = sampleGrid(grid, segments, cx, cz, x, z);
      if (y < TREE_LINE_LOW_M) continue;
      if (gridSlope(grid, segments, cx, cz, x, z) > TREE_MAX_SLOPE) continue;
      // Exposure thins the wood as it climbs: the top of a northern island is bare.
      if (!rng.bool(clamp(1.25 - y / 70, 0.06, 0.9))) continue;

      const base = out.treeCount * TREE_STRIDE;
      out.trees[base] = x;
      out.trees[base + 1] = y;
      out.trees[base + 2] = z;
      out.trees[base + 3] = rng.range(0, Math.PI * 2);
      out.trees[base + 4] = rng.range(0.62, 1.35);
      out.trees[base + 5] = rng.int(0, TREE_SPECIES - 1);
      out.treeCount += 1;
    }
  }

  const grassStep = TERRAIN_CHUNK_M / GRASS_GRID;
  for (let j = 0; j < GRASS_GRID; j += 1) {
    for (let i = 0; i < GRASS_GRID; i += 1) {
      const x = originX + (i + rng.next()) * grassStep;
      const z = originZ + (j + rng.next()) * grassStep;
      const y = sampleGrid(grid, segments, cx, cz, x, z);
      if (y < GRASS_LINE_LOW_M) continue;
      if (gridSlope(grid, segments, cx, cz, x, z) > GRASS_MAX_SLOPE) continue;

      const base = out.grassCount * GRASS_STRIDE;
      out.grass[base] = x;
      out.grass[base + 1] = y;
      out.grass[base + 2] = z;
      out.grass[base + 3] = rng.range(0, Math.PI * 2);
      out.grass[base + 4] = rng.range(0.7, 1.4);
      out.grassCount += 1;
    }
  }
}

// ------------------------------------------------------------------------------------ props

export const PROP_KINDS = [
  'lighthouse',
  'buoy',
  'jetty',
  'wreck',
  'arch',
  'crate',
  'bottle',
] as const;

export type PropKind = (typeof PROP_KINDS)[number];

/** Floats per prop: kind index, x, y, z, yaw, scale, tint, phase. */
export const PROP_STRIDE = 8;
export const PROP_CAPACITY = 12;

export interface PropChunk {
  cx: number;
  cz: number;
  count: number;
  readonly data: Float32Array;
}

export function createPropChunk(): PropChunk {
  return { cx: 0, cz: 0, count: 0, data: new Float32Array(PROP_CAPACITY * PROP_STRIDE) };
}

/**
 * Furnish a chunk.
 *
 * Everything is placed by *asking the ground what it is*, never by rolling a die for a kind and
 * then hunting for somewhere to put it. A jetty appears where there is a beach with sheltered
 * water off it; a lighthouse appears on a headland high enough to be worth marking; a wreck
 * appears on the shoal that would have wrecked it. That is why the furniture looks deliberate
 * even though nothing about it was authored.
 */
export function fillPropChunk(field: WorldField, cx: number, cz: number, out: PropChunk): void {
  out.cx = cx;
  out.cz = cz;
  out.count = 0;

  const rng = PRNG.deriveStream(field.seed ^ SALT_PROPS, cx, cz);
  const gradient = createGradient();
  const candidates = 14;

  for (let i = 0; i < candidates && out.count < PROP_CAPACITY; i += 1) {
    const x = (cx + rng.next()) * PROP_CHUNK_M;
    const z = (cz + rng.next()) * PROP_CHUNK_M;
    const height = field.heightAt(x, z);
    field.gradientAt(x, z, gradient);
    const slope = Math.hypot(gradient.dx, gradient.dz);
    // Downhill, which on a coast is the way out to sea. Jetties and beams both point this way.
    const seaward = Math.atan2(-gradient.dx, -gradient.dz);

    let kind: PropKind | null = null;
    let y = height;
    if (height > 9 && height < 70 && slope < 0.5 && rng.bool(0.22)) {
      kind = 'lighthouse';
    } else if (height > 6 && slope > 0.9 && rng.bool(0.45)) {
      kind = 'arch';
      y = 0;
    } else if (height > -0.6 && height < 1.4 && slope < 0.16 && rng.bool(0.35)) {
      kind = 'jetty';
      y = 0;
    } else if (height > -4.5 && height < -1 && rng.bool(0.2)) {
      kind = 'wreck';
      y = height;
    } else if (height < -8 && height > -48 && rng.bool(0.45)) {
      // Channel markers: the depth window is only met on the flank of an island, which is
      // exactly where a buoyed channel would be.
      kind = 'buoy';
      y = 0;
    } else if (height < -3 && rng.bool(0.04)) {
      // Flotsam is deliberately rare. A sea with a crate every fifty metres is a landfill, and
      // the point of a collectable is that finding one is worth something.
      kind = rng.bool(0.6) ? 'crate' : 'bottle';
      y = 0;
    }
    if (kind === null) continue;

    const base = out.count * PROP_STRIDE;
    out.data[base] = PROP_KINDS.indexOf(kind);
    out.data[base + 1] = x;
    out.data[base + 2] = y;
    out.data[base + 3] = z;
    out.data[base + 4] = kind === 'jetty' || kind === 'arch' ? seaward : rng.range(0, Math.PI * 2);
    out.data[base + 5] = rng.range(0.8, 1.25);
    out.data[base + 6] = rng.next();
    out.data[base + 7] = rng.range(0, Math.PI * 2);
    out.count += 1;
  }
}

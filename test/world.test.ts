import { describe, expect, it } from 'vitest';
import {
  GRASS_STRIDE,
  ISLAND_CELL_M,
  OPEN_WATER_DEPTH_M,
  PROP_KINDS,
  PROP_STRIDE,
  TERRAIN_CHUNK_M,
  TREE_STRIDE,
  WorldField,
  createChunkContent,
  createGridStats,
  createPropChunk,
  fillChunkContent,
  fillPropChunk,
  sampleGrid,
  wetSandTopM,
  wetSandWetness,
  type ChunkContent,
} from '../src/world/WorldField.js';

/**
 * The land, validated without a GPU.
 *
 * `WorldField.ts` is deliberately pure — no `three`, no DOM, no history — so the four claims the
 * whole streaming design rests on can be asserted directly rather than inferred from a
 * screenshot. Each of these is a bug that would be either invisible or unbearable in the build:
 *
 *   1. **The same seed is the same world.** Not "looks similar": byte-identical chunk contents,
 *      because sailing east for ten minutes and back has to put the same tree on the same rock.
 *   2. **Order does not matter.** A chunk's contents come from `(seed, cx, cz)` and nothing else,
 *      so a world explored in a different order is the same world. This is the property a shared
 *      PRNG cursor silently destroys, and it fails in a way nobody notices until a player
 *      complains that an island moved.
 *   3. **Chunks meet exactly.** The shared edge of two neighbours is sampled from both sides and
 *      required to agree *bit for bit*, not to within a tolerance — a seam is either impossible
 *      or it is a matter of luck, and only the first of those is worth shipping.
 *   4. **The wet band tracks the tide.** The dark strip of saturated sand is the thing that makes
 *      a coastline read as a coastline, and its geometry is a claim about the world: its foot is
 *      the waterline and its width is the distance the water has fallen since high tide.
 */

/** The shipped default seed. */
const SEED = 0x5eed_f15e;
/** LOD 0 sampling resolution — the same number `Islands.ts` builds its fine mesh at. */
const SEGMENTS = 96;

function gridFor(field: WorldField, cx: number, cz: number): Float32Array {
  const grid = new Float32Array((SEGMENTS + 3) * (SEGMENTS + 3));
  field.sampleChunkGrid(cx, cz, SEGMENTS, grid, createGridStats());
  return grid;
}

function contentFor(field: WorldField, cx: number, cz: number): ChunkContent {
  const content = createChunkContent();
  fillChunkContent(field, cx, cz, gridFor(field, cx, cz), SEGMENTS, content);
  return content;
}

function contentSignature(content: ChunkContent): string {
  const parts: string[] = [`${content.cx}/${content.cz}`, `t${content.treeCount}`, `g${content.grassCount}`];
  for (let i = 0; i < content.treeCount * TREE_STRIDE; i += 1) parts.push(String(content.trees[i]));
  for (let i = 0; i < content.grassCount * GRASS_STRIDE; i += 1) parts.push(String(content.grass[i]));
  return parts.join(',');
}

/**
 * Cells chosen to straddle several island lattice cells, so the sample includes open water,
 * a whole island, and the awkward case of a chunk that only clips an island's rim.
 */
const CELLS: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 1],
  [4, 4],
  [-1, 2],
  [-5, -3],
  [7, -6],
  [12, 9],
  [-14, 11],
];

describe('the island heightfield', () => {
  it('is a pure function of position', () => {
    const a = new WorldField(SEED);
    const b = new WorldField(SEED);
    for (let i = 0; i < 400; i += 1) {
      const x = i * 137.5 - 12000;
      const z = 9000 - i * 91.3;
      expect(b.heightAt(x, z)).toBe(a.heightAt(x, z));
      expect(b.depthAt(x, z)).toBe(a.depthAt(x, z));
    }
  });

  it('does not depend on the order positions are queried in', () => {
    // The island cache is the one piece of mutable state in the field. Walking the same points
    // forwards and then backwards is what would expose a cache that leaked between cells.
    const field = new WorldField(SEED);
    const forwards: number[] = [];
    for (let i = 0; i < 300; i += 1) forwards.push(field.heightAt(i * 53.7, i * -31.1));
    for (let i = 299; i >= 0; i -= 1) {
      expect(field.heightAt(i * 53.7, i * -31.1)).toBe(forwards[i]);
    }
  });

  it('gives a different world to a different seed', () => {
    const a = new WorldField(SEED);
    const b = new WorldField(SEED + 1);
    let differences = 0;
    for (let i = 0; i < 300; i += 1) {
      const x = i * 211 - 20000;
      const z = i * -173 + 8000;
      if (Math.abs(a.heightAt(x, z) - b.heightAt(x, z)) > 0.5) differences += 1;
    }
    expect(differences).toBeGreaterThan(60);
  });

  it('is open water where there is no island', () => {
    const field = new WorldField(SEED);
    // The seabed is the open-water depth plus relief, and nothing anywhere may be above the
    // beach crest by more than the tallest island the generator can produce.
    for (let i = 0; i < 500; i += 1) {
      const height = field.heightAt(i * 317.3, i * -223.7);
      expect(height).toBeGreaterThan(-OPEN_WATER_DEPTH_M - 14);
      expect(height).toBeLessThan(140);
      expect(Number.isFinite(height)).toBe(true);
    }
  });

  it('rises above water somewhere, and stays below it in the deeps', () => {
    const field = new WorldField(SEED);
    let land = 0;
    let deep = 0;
    for (let cz = -6; cz <= 6; cz += 1) {
      for (let cx = -6; cx <= 6; cx += 1) {
        const peak = field.chunkPeak(cx, cz);
        if (peak > 2) land += 1;
        if (peak < -30) deep += 1;
      }
    }
    expect(land).toBeGreaterThan(4);
    expect(deep).toBeGreaterThan(4);
  });

  it('never lets an island poke through more than one lattice cell away', () => {
    // The one-ring search in `heightAt` is only sound while an island cannot reach across a whole
    // cell. Asserting the invariant directly means a future radius change cannot quietly break
    // the seamlessness the next test depends on.
    const field = new WorldField(SEED);
    for (let cellZ = -4; cellZ <= 4; cellZ += 1) {
      for (let cellX = -4; cellX <= 4; cellX += 1) {
        const island = field.islandAt(cellX, cellZ);
        if (island === null) continue;
        expect(island.radius).toBeLessThan(ISLAND_CELL_M);
        expect(Math.floor(island.centreX / ISLAND_CELL_M)).toBe(cellX);
        expect(Math.floor(island.centreZ / ISLAND_CELL_M)).toBe(cellZ);
      }
    }
  });
});

describe('chunk boundaries', () => {
  it('agrees exactly along a shared edge in x', () => {
    const field = new WorldField(SEED);
    const stride = SEGMENTS + 3;
    let checkedLand = 0;

    for (const cell of CELLS) {
      const [cx, cz] = cell;
      const left = gridFor(field, cx, cz);
      const right = gridFor(field, cx + 1, cz);
      for (let j = 0; j < stride; j += 1) {
        // i = SEGMENTS + 1 in the left chunk and i = 1 in the right one are the same world point.
        const a = left[j * stride + SEGMENTS + 1];
        const b = right[j * stride + 1];
        expect(a).toBe(b);
        if ((a ?? 0) > 0) checkedLand += 1;
      }
    }
    // A seam test that only ever compared open water would pass on a broken generator.
    expect(checkedLand).toBeGreaterThan(0);
  });

  it('agrees exactly along a shared edge in z', () => {
    const field = new WorldField(SEED);
    const stride = SEGMENTS + 3;
    for (const cell of CELLS) {
      const [cx, cz] = cell;
      const near = gridFor(field, cx, cz);
      const far = gridFor(field, cx, cz + 1);
      for (let i = 0; i < stride; i += 1) {
        expect(near[(SEGMENTS + 1) * stride + i]).toBe(far[stride + i]);
      }
    }
  });

  it('agrees at the corner where four chunks meet', () => {
    const field = new WorldField(SEED);
    const stride = SEGMENTS + 3;
    const [cx, cz] = [3, 1];
    const nw = gridFor(field, cx, cz);
    const ne = gridFor(field, cx + 1, cz);
    const sw = gridFor(field, cx, cz + 1);
    const se = gridFor(field, cx + 1, cz + 1);

    const corner = nw[(SEGMENTS + 1) * stride + SEGMENTS + 1];
    expect(ne[(SEGMENTS + 1) * stride + 1]).toBe(corner);
    expect(sw[stride + SEGMENTS + 1]).toBe(corner);
    expect(se[stride + 1]).toBe(corner);
  });

  it('samples the grid at the same points the analytic field reports', () => {
    // The grid is a `Float32Array` because it is a vertex buffer's source, so the comparison is
    // against the single-precision value. That is not a weakening of the seam guarantee — it is
    // the reason for it: two chunks round the same double to the same float, which is what makes
    // "exact agreement" survive the trip to the GPU.
    const field = new WorldField(SEED);
    const grid = gridFor(field, 3, 1);
    const stride = SEGMENTS + 3;
    const step = TERRAIN_CHUNK_M / SEGMENTS;
    for (let j = 1; j < stride - 1; j += 17) {
      for (let i = 1; i < stride - 1; i += 13) {
        const x = (3 * SEGMENTS + i - 1) * step;
        const z = (1 * SEGMENTS + j - 1) * step;
        expect(grid[j * stride + i]).toBe(Math.fround(field.heightAt(x, z)));
      }
    }
  });

  it('interpolates inside a chunk without leaving the sampled range', () => {
    const field = new WorldField(SEED);
    const stats = createGridStats();
    const grid = new Float32Array((SEGMENTS + 3) * (SEGMENTS + 3));
    field.sampleChunkGrid(4, 4, SEGMENTS, grid, stats);
    for (let i = 0; i < 200; i += 1) {
      const x = (4 + i / 200) * TERRAIN_CHUNK_M;
      const z = (4 + ((i * 7) % 200) / 200) * TERRAIN_CHUNK_M;
      const height = sampleGrid(grid, SEGMENTS, 4, 4, x, z);
      expect(height).toBeGreaterThanOrEqual(stats.min);
      expect(height).toBeLessThanOrEqual(stats.max);
    }
  });
});

describe('chunk contents', () => {
  it('are identical for the same seed', () => {
    const a = new WorldField(SEED);
    const b = new WorldField(SEED);
    for (const cell of CELLS) {
      const [cx, cz] = cell;
      expect(contentSignature(contentFor(b, cx, cz))).toBe(contentSignature(contentFor(a, cx, cz)));
    }
  });

  it('do not depend on the order chunks are visited in', () => {
    const forwards = new WorldField(SEED);
    const backwards = new WorldField(SEED);
    const shuffled = new WorldField(SEED);

    const inOrder = CELLS.map((cell) => contentSignature(contentFor(forwards, cell[0], cell[1])));

    const reversed: string[] = new Array(CELLS.length).fill('');
    for (let i = CELLS.length - 1; i >= 0; i -= 1) {
      const cell = CELLS[i];
      if (cell === undefined) continue;
      reversed[i] = contentSignature(contentFor(backwards, cell[0], cell[1]));
    }

    // And a third pass that revisits cells, which is what streaming actually does when a player
    // sails back and forth across a boundary.
    const revisited: string[] = new Array(CELLS.length).fill('');
    for (const index of [4, 0, 9, 4, 2, 7, 0, 1, 3, 5, 6, 8, 9, 2]) {
      const cell = CELLS[index];
      if (cell === undefined) continue;
      revisited[index] = contentSignature(contentFor(shuffled, cell[0], cell[1]));
    }

    expect(reversed).toEqual(inOrder);
    expect(revisited).toEqual(inOrder);
  });

  it('plants nothing below the strand line and nothing on a cliff', () => {
    const field = new WorldField(SEED);
    let planted = 0;
    for (const cell of CELLS) {
      const [cx, cz] = cell;
      const grid = gridFor(field, cx, cz);
      const content = createChunkContent();
      fillChunkContent(field, cx, cz, grid, SEGMENTS, content);
      planted += content.treeCount + content.grassCount;

      for (let i = 0; i < content.treeCount; i += 1) {
        const base = i * TREE_STRIDE;
        const y = content.trees[base + 1] ?? 0;
        expect(y).toBeGreaterThan(3);
        expect(content.trees[base + 4]).toBeGreaterThan(0);
        // Species must index a geometry that exists, or a whole chunk of trees is invisible.
        expect(content.trees[base + 5]).toBeGreaterThanOrEqual(0);
        expect(content.trees[base + 5]).toBeLessThan(2);
      }
      for (let i = 0; i < content.grassCount; i += 1) {
        expect(content.grass[i * GRASS_STRIDE + 1]).toBeGreaterThan(1.5);
      }
    }
    expect(planted).toBeGreaterThan(0);
  });

  it('places props on ground that suits them', () => {
    const field = new WorldField(SEED);
    const chunk = createPropChunk();
    let lighthouses = 0;
    let floating = 0;

    for (let cz = -8; cz <= 8; cz += 1) {
      for (let cx = -8; cx <= 8; cx += 1) {
        fillPropChunk(field, cx, cz, chunk);
        for (let slot = 0; slot < chunk.count; slot += 1) {
          const base = slot * PROP_STRIDE;
          const kind = PROP_KINDS[chunk.data[base] ?? -1];
          expect(kind).toBeDefined();
          const x = chunk.data[base + 1] ?? 0;
          const z = chunk.data[base + 3] ?? 0;
          const ground = field.heightAt(x, z);
          if (kind === 'lighthouse') {
            lighthouses += 1;
            expect(ground).toBeGreaterThan(9);
          }
          if (kind === 'crate' || kind === 'bottle' || kind === 'buoy') {
            floating += 1;
            expect(ground).toBeLessThan(0);
          }
        }
      }
    }
    expect(lighthouses).toBeGreaterThan(0);
    expect(floating).toBeGreaterThan(0);
  });

  it('gives props the same layout however the chunks are visited', () => {
    const a = new WorldField(SEED);
    const b = new WorldField(SEED);
    const first = createPropChunk();
    const second = createPropChunk();
    const order: readonly (readonly [number, number])[] = [
      [2, 3],
      [-4, 5],
      [0, 0],
      [2, 3],
      [11, -7],
    ];

    const signatures = new Map<string, string>();
    for (const cell of order) {
      fillPropChunk(a, cell[0], cell[1], first);
      signatures.set(`${cell[0]}/${cell[1]}`, first.data.slice(0, first.count * PROP_STRIDE).join(','));
    }
    for (let i = order.length - 1; i >= 0; i -= 1) {
      const cell = order[i];
      if (cell === undefined) continue;
      fillPropChunk(b, cell[0], cell[1], second);
      expect(second.data.slice(0, second.count * PROP_STRIDE).join(',')).toBe(
        signatures.get(`${cell[0]}/${cell[1]}`),
      );
    }
  });
});

describe('the wet sand band', () => {
  /** A spring range for this coast: `Tides.ts` puts high water near 0.85 m at springs. */
  const HIGH_WATER = 0.85;

  it('has its foot exactly at the waterline', () => {
    for (const tide of [-0.85, -0.4, 0, 0.4, 0.85]) {
      // Sand at the water's edge is saturated, whatever the state of the tide.
      expect(wetSandWetness(tide, tide, HIGH_WATER)).toBeCloseTo(1, 12);
      // And sand a hand's breadth under the water is not "drier" than the water's edge.
      expect(wetSandWetness(tide - 0.1, tide, HIGH_WATER)).toBeCloseTo(1, 12);
    }
  });

  it('moves up and down with the tide', () => {
    let previous = Number.NEGATIVE_INFINITY;
    for (const tide of [-0.85, -0.5, 0, 0.5, 0.85]) {
      const top = wetSandTopM(tide, HIGH_WATER);
      expect(top).toBeGreaterThan(previous);
      // The band always sits above the water it was left by.
      expect(top).toBeGreaterThan(tide);
      previous = top;
    }
  });

  it('is widest at low water and closes up at high water', () => {
    const atLow = wetSandTopM(-0.85, HIGH_WATER) - -0.85;
    const atMid = wetSandTopM(0, HIGH_WATER) - 0;
    const atHigh = wetSandTopM(HIGH_WATER, HIGH_WATER) - HIGH_WATER;
    expect(atLow).toBeGreaterThan(atMid);
    expect(atMid).toBeGreaterThan(atHigh);
    // At the top of the tide there is nothing left uncovered to be drying, so the band is only
    // the swash. That is the observation the whole model is built to reproduce.
    expect(atHigh).toBeLessThan(0.3);
    expect(atLow).toBeGreaterThan(1.5);
  });

  it('is narrower on a neap than on a spring', () => {
    // Same state of the tide, smaller range: less sand has been uncovered, so less of it is wet.
    const spring = wetSandTopM(-0.85, 0.85) - -0.85;
    const neap = wetSandTopM(-0.3, 0.3) - -0.3;
    expect(neap).toBeLessThan(spring);
  });

  it('falls monotonically from the waterline to dry sand', () => {
    const tide = -0.4;
    const top = wetSandTopM(tide, HIGH_WATER);
    let previous = 1.0001;
    for (let y = tide; y <= top + 0.5; y += 0.02) {
      const wetness = wetSandWetness(y, tide, HIGH_WATER);
      expect(wetness).toBeLessThanOrEqual(previous);
      expect(wetness).toBeGreaterThanOrEqual(0);
      previous = wetness;
    }
    expect(wetSandWetness(top, tide, HIGH_WATER)).toBeCloseTo(0, 12);
  });
});

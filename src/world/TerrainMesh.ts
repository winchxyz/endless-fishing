import { BufferAttribute, BufferGeometry, Mesh, Sphere, type ShaderMaterial } from 'three';
import { TERRAIN_CHUNK_M, type GridStats } from './WorldField.js';

/**
 * The mesh side of an island chunk: topology, buffers and the skirt.
 *
 * Separated from `Islands.ts` because it is a different kind of thing — this file knows about
 * lattices and winding order and nothing about streaming, tides or trees. Two decisions in it are
 * worth knowing before reading the code:
 *
 *   * **The index buffer is built once per LOD and shared by every chunk.** Topology never
 *     changes; only the heights do. So a chunk's vertex arrays are allocated once at its
 *     resolution and rewritten in place when the chunk is re-seeded, and nothing is allocated
 *     while the world is streaming.
 *   * **Every chunk has a skirt.** Neighbouring chunks can be at different levels of detail, and
 *     while they agree exactly at the lattice points they share, the *interpolation* between
 *     those points does not — so a fine chunk beside a coarse one leaves a hairline of sky
 *     showing through the join. A curtain hung from the perimeter and dropped fourteen metres
 *     covers it, costs four rows of triangles, and is never seen from anywhere else.
 */

/** How far the skirt hangs below the chunk edge, metres. Wider than any LOD mismatch. */
export const SKIRT_DROP_M = 14;

/** One resolution of one chunk's terrain. Buffers are allocated once and rewritten in place. */
export interface TerrainLevel {
  readonly segments: number;
  readonly geometry: BufferGeometry;
  readonly mesh: Mesh;
  readonly position: Float32Array;
  readonly normal: Float32Array;
  /** Grid indices around the perimeter, in ring order, for the skirt. */
  readonly ring: Int32Array;
}

/**
 * The index buffer for one LOD.
 *
 * The winding of the grid quads is the ocean clipmap's, so an up-facing triangle faces the sky.
 * The skirt's is derived from a single traversal of the perimeter — walk the ring one way and one
 * winding faces outward the whole way round, which is why the ring is built rather than the four
 * edges being handled separately with four sign conventions to get wrong.
 */
export function buildTerrainIndex(segments: number): BufferAttribute {
  const stride = segments + 1;
  const grid = stride * stride;
  const index: number[] = [];

  for (let j = 0; j < segments; j += 1) {
    for (let i = 0; i < segments; i += 1) {
      const a = j * stride + i;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }

  const ring = perimeterRing(segments);
  for (let i = 0; i < ring.length; i += 1) {
    const t0 = ring[i] ?? 0;
    const t1 = ring[(i + 1) % ring.length] ?? 0;
    const s0 = grid + i;
    const s1 = grid + ((i + 1) % ring.length);
    index.push(t0, t1, s0, t1, s1, s0);
  }

  return new BufferAttribute(new Uint32Array(index), 1);
}

/** Grid indices around the chunk edge, in a single consistent traversal. */
export function perimeterRing(segments: number): Int32Array {
  const stride = segments + 1;
  const ring: number[] = [];
  for (let i = 0; i < segments; i += 1) ring.push(i);
  for (let j = 0; j < segments; j += 1) ring.push(j * stride + segments);
  for (let i = segments; i > 0; i -= 1) ring.push(segments * stride + i);
  for (let j = segments; j > 0; j -= 1) ring.push(j * stride);
  return new Int32Array(ring);
}

export function createTerrainLevel(
  segments: number,
  index: BufferAttribute | undefined,
  material: ShaderMaterial,
): TerrainLevel {
  const ring = perimeterRing(segments);
  const stride = segments + 1;
  const vertices = stride * stride + ring.length;
  const position = new Float32Array(vertices * 3);
  const normal = new Float32Array(vertices * 3);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('normal', new BufferAttribute(normal, 3));
  if (index !== undefined) geometry.setIndex(index);
  geometry.boundingSphere = new Sphere();

  const mesh = new Mesh(geometry, material);
  // The mesh never moves relative to its parent LOD, so its local matrix is the identity and
  // there is no reason to recompute it sixty times a second.
  mesh.matrixAutoUpdate = false;
  return { segments, geometry, mesh, position, normal, ring };
}

/**
 * Rewrite one LOD's vertices from the sampled grid.
 *
 * The coarse levels take every second and every fourth vertex of the fine sampling rather than
 * being sampled separately, so all three share the lattice exactly and a chunk at LOD 2 still
 * meets its LOD 0 neighbour on the same points.
 *
 * Normals are central differences on the *fine* lattice at every level, including the chunk's own
 * edges — which is what the one-cell halo in `sampleChunkGrid` exists for. Taking them from the
 * decimated lattice instead would make the shading of a coarse chunk visibly disagree with its
 * fine neighbour along the join, which is worse than the geometric mismatch the skirt hides.
 */
export function fillTerrainLevel(
  level: TerrainLevel,
  grid: Float32Array,
  fineSegments: number,
  stats: GridStats,
): void {
  const stride = level.segments + 1;
  const gridStride = fineSegments + 3;
  const decimate = fineSegments / level.segments;
  const step = TERRAIN_CHUNK_M / level.segments;
  const fineStep = TERRAIN_CHUNK_M / fineSegments;
  const half = TERRAIN_CHUNK_M / 2;

  for (let j = 0; j < stride; j += 1) {
    const gj = j * decimate + 1;
    for (let i = 0; i < stride; i += 1) {
      const gi = i * decimate + 1;
      const row = gj * gridStride + gi;

      const dhdx = ((grid[row + 1] ?? 0) - (grid[row - 1] ?? 0)) / (2 * fineStep);
      const dhdz = ((grid[row + gridStride] ?? 0) - (grid[row - gridStride] ?? 0)) / (2 * fineStep);
      const inverse = 1 / Math.sqrt(dhdx * dhdx + 1 + dhdz * dhdz);

      const v = (j * stride + i) * 3;
      level.position[v] = i * step - half;
      level.position[v + 1] = grid[row] ?? 0;
      level.position[v + 2] = j * step - half;
      level.normal[v] = -dhdx * inverse;
      level.normal[v + 1] = inverse;
      level.normal[v + 2] = -dhdz * inverse;
    }
  }

  const skirtBase = stride * stride;
  for (let i = 0; i < level.ring.length; i += 1) {
    const source = (level.ring[i] ?? 0) * 3;
    const target = (skirtBase + i) * 3;
    level.position[target] = level.position[source] ?? 0;
    level.position[target + 1] = (level.position[source + 1] ?? 0) - SKIRT_DROP_M;
    level.position[target + 2] = level.position[source + 2] ?? 0;
    level.normal[target] = level.normal[source] ?? 0;
    level.normal[target + 1] = level.normal[source + 1] ?? 1;
    level.normal[target + 2] = level.normal[source + 2] ?? 0;
  }

  level.geometry.getAttribute('position').needsUpdate = true;
  level.geometry.getAttribute('normal').needsUpdate = true;

  // The chunk is authored about its own centre, so the bounding sphere is too. Written in place;
  // three's own `computeBoundingSphere` would walk ten thousand vertices we have already summed.
  const sphere = level.geometry.boundingSphere;
  if (sphere !== null) {
    sphere.center.set(0, (stats.min + stats.max) / 2, 0);
    sphere.radius = Math.hypot(half, half) + (stats.max - stats.min) / 2 + SKIRT_DROP_M;
  }
}

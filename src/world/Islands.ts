import {
  BufferGeometry,
  Color,
  DoubleSide,
  InstancedMesh,
  LOD,
  Matrix4,
  Quaternion,
  ShaderMaterial,
  Vector2,
  Vector3,
  type BufferAttribute,
  type Texture,
} from 'three';
import type { Engine, System } from '../core/Engine.js';
import type { MaterialLibrary } from '../render/Materials.js';
import { skyEnvironment, updateWorldLight, worldLightUniforms } from '../render/WorldLighting.js';
import { clamp } from '../math/Noise.js';
import { ChunkGrid, type ChunkFactory } from './Chunks.js';
import {
  buildTerrainIndex,
  createTerrainLevel,
  fillTerrainLevel,
  type TerrainLevel,
} from './TerrainMesh.js';
import { buildGrassTuft, buildTree, type TreeGeometry } from './Vegetation.js';
import {
  GRASS_CAPACITY,
  GRASS_STRIDE,
  TERRAIN_CHUNK_M,
  TREE_CAPACITY,
  TREE_SPECIES,
  TREE_STRIDE,
  WorldField,
  createChunkContent,
  createGridStats,
  fillChunkContent,
  type ChunkContent,
  type GridStats,
} from './WorldField.js';
import type { Tides } from './Tides.js';
import terrainVert from '../shaders/terrain/terrain.vert';
import terrainFrag from '../shaders/terrain/terrain.frag';
import foliageVert from '../shaders/terrain/foliage.vert';
import foliageFrag from '../shaders/terrain/foliage.frag';
import propVert from '../shaders/world/prop.vert';
import propFrag from '../shaders/world/prop.frag';

/**
 * Islands: the heightfield, its three levels of detail, and everything growing on it.
 *
 * The shape itself lives in `WorldField.ts` and is a pure function of position, which is what
 * makes a chunk mesh a *sampling* rather than a generation — two chunks meeting at an edge
 * evaluated the same function at the same lattice point and cannot disagree. That is the whole
 * reason there is no stitching code anywhere in this file.
 *
 * What is here is the part that needs a GPU:
 *
 *   * **Three LODs from one sampling.** The fine grid is sampled once at 96 segments and the
 *     coarser levels take every second and every fourth vertex of it. They therefore share the
 *     lattice exactly, so a chunk at LOD 2 still meets its LOD 0 neighbour on the same points —
 *     the only thing that differs is which of them are drawn, and a downward skirt round every
 *     chunk covers the sliver where the interpolation between them does not match.
 *   * **The waterline is the tide.** Nothing about the beach is baked. `uTideHeight` moves and
 *     the sand goes under; the dark, glossy band of wet sand between the marks widens as the
 *     water falls and closes up at the top of a neap, because its width *is* the distance the
 *     tide has dropped. That band is the thing that makes a coast read as a coast.
 *   * **The heavy machinery is pooled separately from the cells.** Nine tenths of the ocean is
 *     ocean, and a chunk payload that carried a quarter of a megabyte of vertex buffers whether
 *     or not it had any land in it would cost more than a hundred megabytes to stream a horizon.
 *     A cell is four numbers; the meshes are borrowed from a small pool of *rigs* and handed
 *     straight back when a cell turns out to be open water or leaves range.
 *
 * Steady-state allocation is zero: rigs are reused, their vertex buffers are sized once per LOD
 * level and rewritten in place, and the instance matrices likewise.
 */

/** Segments along a chunk edge, per LOD. Each must divide the first exactly. */
const LOD_SEGMENTS = [96, 48, 24] as const;
/** Metres at which each LOD takes over. */
const LOD_DISTANCES = [0, 380, 900] as const;
/** Streaming radius for terrain, metres, clamped from the draw-distance setting. */
const MIN_TERRAIN_DISTANCE_M = 1200;
const MAX_TERRAIN_DISTANCE_M = 2600;
/**
 * Meshed chunks resident at once. At the largest draw distance a typical seed has fewer than
 * thirty land cells in range; the cap is what bounds the memory when a seed puts an archipelago
 * under the boat, and the cost of exceeding it is that the furthest island waits a moment.
 */
const MAX_RIGS = 40;
/** Chunks beyond these ranges keep their terrain but drop their vegetation. */
const TREE_DISTANCE_M = 700;
const GRASS_DISTANCE_M = 170;
/** A chunk whose highest point is below this is open water and gets no mesh at all. */
const LAND_THRESHOLD_M = -7;

/** Metres of tip deflection per metre of height at 10 m/s of wind. */
const GRASS_BEND = 0.055;
const LEAF_BEND = 0.02;

/** Machair and marram: olive, desaturated, never a lawn green. */
const GRASS_BASE = new Color(0.045, 0.058, 0.032);
const GRASS_TIP = new Color(0.112, 0.124, 0.07);
/** Scots pine needles under a northern sky. */
const LEAF_BASE = new Color(0.028, 0.045, 0.03);
const LEAF_TIP = new Color(0.055, 0.078, 0.042);

const matrix = new Matrix4();
const scratchPosition = new Vector3();
const scratchRotation = new Quaternion();
const scratchScale = new Vector3();
const yAxis = new Vector3(0, 1, 0);

/** Everything a land chunk needs to be drawn. Borrowed from a pool, never owned by a cell. */
interface TerrainRig {
  readonly lod: LOD;
  readonly levels: readonly TerrainLevel[];
  readonly heights: Float32Array;
  readonly stats: GridStats;
  readonly content: ChunkContent;
  readonly trunks: readonly InstancedMesh[];
  readonly canopies: readonly InstancedMesh[];
  readonly grass: InstancedMesh;
}

/** A streamed cell. Four numbers and a borrowed rig, so open water costs nothing to hold. */
interface IslandChunk {
  land: boolean;
  centreX: number;
  centreZ: number;
  rig: TerrainRig | null;
}

export class Islands implements System {
  readonly name = 'islands';
  readonly priority = 15;

  readonly field: WorldField;

  private readonly engine: Engine;
  private readonly terrainMaterial: ShaderMaterial;
  private readonly grassMaterial: ShaderMaterial;
  private readonly leafMaterial: ShaderMaterial;
  private readonly barkMaterial: ShaderMaterial;
  private readonly trees: readonly TreeGeometry[];
  private readonly tuft: BufferGeometry;
  private readonly indices: readonly BufferAttribute[];
  private readonly grid: ChunkGrid<IslandChunk>;
  /** Every rig ever built, for disposal, and the subset currently free. */
  private readonly rigs: TerrainRig[] = [];
  private readonly freeRigs: TerrainRig[] = [];
  private density = 1;

  private constructor(engine: Engine, sand: MapSet, rock: MapSet, bark: Texture | null) {
    this.engine = engine;
    this.field = new WorldField(engine.settings.world.seed);

    this.terrainMaterial = new ShaderMaterial({
      vertexShader: terrainVert,
      fragmentShader: terrainFrag,
      uniforms: {
        ...worldLightUniforms(),
        uSandAlbedo: { value: sand.albedo },
        uSandNormal: { value: sand.normal },
        uSandOrm: { value: sand.orm },
        uRockAlbedo: { value: rock.albedo },
        uRockNormal: { value: rock.normal },
        uRockOrm: { value: rock.orm },
        uTideHeight: { value: 0 },
        uHighWaterMark: { value: 0.9 },
        uLowWaterMark: { value: -0.9 },
        uTime: { value: 0 },
      },
    });

    this.grassMaterial = createFoliageMaterial(0, GRASS_BASE, GRASS_TIP, GRASS_BEND, GRASS_DISTANCE_M);
    this.leafMaterial = createFoliageMaterial(1, LEAF_BASE, LEAF_TIP, LEAF_BEND, TREE_DISTANCE_M);

    this.barkMaterial = new ShaderMaterial({
      vertexShader: propVert,
      fragmentShader: propFrag,
      uniforms: {
        ...worldLightUniforms(),
        uAlbedo: { value: bark },
        uMapStrength: { value: bark === null ? 0 : 1 },
        uMapScale: { value: new Vector2(1, 0.55) },
        uRoughness: { value: 0.88 },
        uMetalness: { value: 0 },
        // Trees do not stand in the sea, so the splash line sits below anything they reach.
        uSplashLine: { value: -6 },
        uTideHeight: { value: 0 },
      },
    });

    const seed = engine.settings.world.seed;
    this.trees = [buildTree(0, seed ^ 0x7c01), buildTree(1, seed ^ 0x7c02)];
    this.tuft = buildGrassTuft(seed ^ 0x67a5);
    this.indices = LOD_SEGMENTS.map((segments) => buildTerrainIndex(segments));

    this.grid = new ChunkGrid<IslandChunk>(this.factory, seed ^ 0x1a5d, {
      // One cell per frame. Open water is twenty-five field evaluations and costs nothing, but a
      // cell that turns out to hold land is ten thousand, and two of those in a frame is a hitch.
      creationBudget: 1,
      hysteresis: 1,
      poolLimit: 64,
    });
    this.applyQuality();
  }

  /**
   * Load the three scanned surfaces the island needs and build the system.
   *
   * The library hands back `MeshStandardMaterial`s and all this wants is their maps: the terrain
   * is drawn by a custom program that shades from the ephemeris, exactly as the ocean does, so it
   * must *not* be enrolled in the cascaded shadow map — a CSM-patched material is summed once per
   * cascade, and the beach would come out four times too bright.
   */
  static async create(engine: Engine, materials: MaterialLibrary): Promise<Islands> {
    const [sand, rock, bark] = await Promise.all([
      materials.load('Ground054', { repeat: 1 }),
      materials.load('Rock064', { repeat: 1 }),
      materials.load('Bark014', { repeat: 1 }),
    ]);
    return new Islands(engine, mapsOf(sand), mapsOf(rock), bark.map);
  }

  /** Water depth below mean sea level, metres. Zero on land. The ocean and the fish shoal on it. */
  seabedDepthAt(x: number, z: number): number {
    return this.field.depthAt(x, z);
  }

  /** Bed elevation relative to mean sea level, metres. Positive is dry at mean water. */
  heightAt(x: number, z: number): number {
    return this.field.heightAt(x, z);
  }

  update(_dt: number, engine: Engine): void {
    const world = engine.world;
    const camera = engine.camera.position;
    this.grid.update(camera.x, camera.z);

    const tides = engine.get<Tides>('tides');
    const uniforms = this.terrainMaterial.uniforms;
    setNumber(uniforms, 'uTideHeight', world.tideHeight);
    setNumber(uniforms, 'uTime', engine.loop.elapsed);
    if (tides !== undefined) {
      setNumber(uniforms, 'uHighWaterMark', tides.highWaterMarkM);
      setNumber(uniforms, 'uLowWaterMark', tides.lowWaterMarkM);
    }
    setNumber(this.barkMaterial.uniforms, 'uTideHeight', world.tideHeight);

    for (const material of [this.grassMaterial, this.leafMaterial]) {
      const wind = material.uniforms['uWind'];
      if (wind !== undefined) (wind.value as Vector2).set(world.windX, world.windZ);
      setNumber(material.uniforms, 'uTime', engine.loop.elapsed);
    }

    const environment = skyEnvironment(engine);
    updateWorldLight(uniforms, engine, environment);
    updateWorldLight(this.grassMaterial.uniforms, engine, environment);
    updateWorldLight(this.leafMaterial.uniforms, engine, environment);
    updateWorldLight(this.barkMaterial.uniforms, engine, environment);

    // Vegetation is culled by range here rather than by the streaming radius, so the terrain can
    // run out to the horizon while the grass — thousands of triangles a chunk — stays inside the
    // distance at which an individual blade is more than a pixel wide.
    const treeRange = TREE_DISTANCE_M * TREE_DISTANCE_M;
    const grassRange = GRASS_DISTANCE_M * GRASS_DISTANCE_M;
    for (const chunk of this.grid.active) {
      const rig = chunk.rig;
      if (!chunk.land || rig === null) continue;
      rig.lod.update(engine.camera);
      const dx = chunk.centreX - camera.x;
      const dz = chunk.centreZ - camera.z;
      const distance = dx * dx + dz * dz;
      const trees = distance < treeRange;
      for (let i = 0; i < rig.trunks.length; i += 1) {
        const trunk = rig.trunks[i];
        const canopy = rig.canopies[i];
        if (trunk !== undefined) trunk.visible = trees && trunk.count > 0;
        if (canopy !== undefined) canopy.visible = trees && canopy.count > 0;
      }
      rig.grass.visible = distance < grassRange && rig.grass.count > 0;
    }
  }

  onSettingsChanged(): void {
    this.applyQuality();
  }

  dispose(): void {
    this.grid.dispose();
    for (const rig of this.rigs) this.destroyRig(rig);
    this.rigs.length = 0;
    this.freeRigs.length = 0;
    this.terrainMaterial.dispose();
    this.grassMaterial.dispose();
    this.leafMaterial.dispose();
    this.barkMaterial.dispose();
    this.tuft.dispose();
    for (const tree of this.trees) {
      tree.trunk.dispose();
      tree.canopy.dispose();
    }
  }

  private applyQuality(): void {
    const graphics = this.engine.settings.graphics;
    this.density = clamp(graphics.instanceDensity, 0.1, 1);
    this.grid.setDrawDistance(
      clamp(graphics.drawDistance, MIN_TERRAIN_DISTANCE_M, MAX_TERRAIN_DISTANCE_M),
    );
  }

  // ------------------------------------------------------------------------ chunk lifecycle

  private readonly factory: ChunkFactory<IslandChunk> = {
    chunkSize: TERRAIN_CHUNK_M,
    create: (cx, cz): IslandChunk => {
      const chunk: IslandChunk = { land: false, centreX: 0, centreZ: 0, rig: null };
      this.seed(chunk, cx, cz);
      return chunk;
    },
    reset: (chunk, cx, cz): void => {
      this.seed(chunk, cx, cz);
    },
    retire: (chunk): void => {
      this.release(chunk);
    },
    destroy: (chunk): void => {
      this.release(chunk);
    },
  };

  /**
   * Re-seed a cell.
   *
   * The coarse peak test comes first and rejects almost everything: most of an ocean is ocean,
   * and twenty-five field evaluations to decide that is a rounding error next to the ten thousand
   * a mesh would cost.
   */
  private seed(chunk: IslandChunk, cx: number, cz: number): void {
    chunk.centreX = (cx + 0.5) * TERRAIN_CHUNK_M;
    chunk.centreZ = (cz + 0.5) * TERRAIN_CHUNK_M;

    if (this.field.chunkPeak(cx, cz) < LAND_THRESHOLD_M) {
      chunk.land = false;
      this.release(chunk);
      return;
    }

    const rig = chunk.rig ?? this.borrowRig();
    if (rig === null) {
      // Every rig is spoken for. The cell stays unmeshed and will be picked up when the grid next
      // re-centres, which is the frame after the player moves — not a state anything can settle in.
      chunk.land = false;
      return;
    }
    chunk.rig = rig;
    chunk.land = true;

    const fine = LOD_SEGMENTS[0] ?? 96;
    this.field.sampleChunkGrid(cx, cz, fine, rig.heights, rig.stats);

    rig.lod.visible = true;
    rig.lod.position.set(chunk.centreX, 0, chunk.centreZ);
    rig.lod.updateMatrix();
    rig.lod.updateMatrixWorld(true);
    for (const level of rig.levels) fillTerrainLevel(level, rig.heights, fine, rig.stats);

    fillChunkContent(this.field, cx, cz, rig.heights, fine, rig.content);
    this.plant(rig);
  }

  /** Write a chunk's vegetation into its rig's instance buffers. */
  private plant(rig: TerrainRig): void {
    const content = rig.content;
    for (const trunk of rig.trunks) trunk.count = 0;
    for (const canopy of rig.canopies) canopy.count = 0;

    // The density setting takes a *prefix* of the generated list rather than re-rolling it, so
    // dropping to Low thins the wood instead of planting a different one.
    const treeLimit = Math.round(content.treeCount * this.density);
    for (let i = 0; i < treeLimit; i += 1) {
      const base = i * TREE_STRIDE;
      const species = content.trees[base + 5] ?? 0;
      const trunk = rig.trunks[species];
      const canopy = rig.canopies[species];
      if (trunk === undefined || canopy === undefined) continue;
      scratchPosition.set(
        content.trees[base] ?? 0,
        content.trees[base + 1] ?? 0,
        content.trees[base + 2] ?? 0,
      );
      scratchRotation.setFromAxisAngle(yAxis, content.trees[base + 3] ?? 0);
      const size = content.trees[base + 4] ?? 1;
      scratchScale.set(size, size, size);
      matrix.compose(scratchPosition, scratchRotation, scratchScale);
      trunk.setMatrixAt(trunk.count, matrix);
      canopy.setMatrixAt(canopy.count, matrix);
      trunk.count += 1;
      canopy.count += 1;
    }

    const grassLimit = Math.round(content.grassCount * this.density);
    for (let i = 0; i < grassLimit; i += 1) {
      const base = i * GRASS_STRIDE;
      scratchPosition.set(
        content.grass[base] ?? 0,
        content.grass[base + 1] ?? 0,
        content.grass[base + 2] ?? 0,
      );
      scratchRotation.setFromAxisAngle(yAxis, content.grass[base + 3] ?? 0);
      const size = content.grass[base + 4] ?? 1;
      scratchScale.set(size, size, size);
      matrix.compose(scratchPosition, scratchRotation, scratchScale);
      rig.grass.setMatrixAt(i, matrix);
    }
    rig.grass.count = grassLimit;

    for (let i = 0; i < rig.trunks.length; i += 1) {
      finishInstances(rig.trunks[i]);
      finishInstances(rig.canopies[i]);
    }
    finishInstances(rig.grass);
  }

  // ------------------------------------------------------------------------------- rig pool

  private borrowRig(): TerrainRig | null {
    const pooled = this.freeRigs.pop();
    if (pooled !== undefined) return pooled;
    if (this.rigs.length >= MAX_RIGS) return null;
    const rig = this.buildRig();
    this.rigs.push(rig);
    return rig;
  }

  private release(chunk: IslandChunk): void {
    const rig = chunk.rig;
    chunk.rig = null;
    chunk.land = false;
    if (rig === null) return;
    rig.lod.visible = false;
    rig.grass.visible = false;
    for (const trunk of rig.trunks) trunk.visible = false;
    for (const canopy of rig.canopies) canopy.visible = false;
    this.freeRigs.push(rig);
  }

  private buildRig(): TerrainRig {
    const fine = LOD_SEGMENTS[0] ?? 96;
    const lod = new LOD();
    // Level selection is driven from `update` rather than from the renderer's own hook, so it
    // happens once per frame against the main camera and cannot be re-run by another pass.
    lod.autoUpdate = false;
    const levels = LOD_SEGMENTS.map((segments, level) => {
      const built = createTerrainLevel(segments, this.indices[level], this.terrainMaterial);
      lod.addLevel(built.mesh, LOD_DISTANCES[level] ?? 0);
      return built;
    });

    const trunks: InstancedMesh[] = [];
    const canopies: InstancedMesh[] = [];
    for (let species = 0; species < TREE_SPECIES; species += 1) {
      const tree = this.trees[species];
      if (tree === undefined) continue;
      trunks.push(new InstancedMesh(tree.trunk, this.barkMaterial, TREE_CAPACITY));
      canopies.push(new InstancedMesh(tree.canopy, this.leafMaterial, TREE_CAPACITY));
    }
    const grass = new InstancedMesh(this.tuft, this.grassMaterial, GRASS_CAPACITY);

    lod.visible = false;
    grass.visible = false;
    for (const mesh of trunks) mesh.visible = false;
    for (const mesh of canopies) mesh.visible = false;
    this.engine.scene.add(lod, grass, ...trunks, ...canopies);

    return {
      lod,
      levels,
      heights: new Float32Array((fine + 3) * (fine + 3)),
      stats: createGridStats(),
      content: createChunkContent(),
      trunks,
      canopies,
      grass,
    };
  }

  private destroyRig(rig: TerrainRig): void {
    this.engine.scene.remove(rig.lod, rig.grass, ...rig.trunks, ...rig.canopies);
    for (const level of rig.levels) level.geometry.dispose();
    rig.grass.dispose();
    for (const trunk of rig.trunks) trunk.dispose();
    for (const canopy of rig.canopies) canopy.dispose();
  }
}

interface MapSet {
  albedo: Texture | null;
  normal: Texture | null;
  orm: Texture | null;
}

function mapsOf(material: {
  map: Texture | null;
  normalMap: Texture | null;
  roughnessMap: Texture | null;
}): MapSet {
  return { albedo: material.map, normal: material.normalMap, orm: material.roughnessMap };
}

function setNumber(
  uniforms: Record<string, { value: unknown } | undefined>,
  name: string,
  value: number,
): void {
  const uniform = uniforms[name];
  if (uniform !== undefined) uniform.value = value;
}

function finishInstances(mesh: InstancedMesh | undefined): void {
  if (mesh === undefined) return;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.visible = mesh.count > 0;
  if (mesh.count > 0) mesh.computeBoundingSphere();
}

function createFoliageMaterial(
  leafMask: number,
  base: Color,
  tip: Color,
  bend: number,
  fadeEnd: number,
): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: foliageVert,
    fragmentShader: foliageFrag,
    uniforms: {
      ...worldLightUniforms(),
      uWind: { value: new Vector2() },
      uTime: { value: 0 },
      uBendScale: { value: bend },
      uLeafMask: { value: leafMask },
      uBaseColour: { value: base.clone() },
      uTipColour: { value: tip.clone() },
      uFadeStart: { value: fadeEnd * 0.75 },
      uFadeEnd: { value: fadeEnd },
    },
    // Blades and cards are single quads standing in for something with two sides. Culling them
    // would blank half of every tuft the moment the camera crossed their plane.
    side: DoubleSide,
  });
}

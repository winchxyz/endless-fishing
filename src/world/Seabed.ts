import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Engine, System } from '../core/Engine.js';
import { ChunkGrid, type ChunkFactory } from './Chunks.js';
import { Noise, clamp } from '../math/Noise.js';
import type { PRNG } from '../math/PRNG.js';
import type { WaveBank } from '../math/Gerstner.js';
import { skyEnvironment, updateWorldLight, worldLightUniforms } from '../render/WorldLighting.js';
import type { UnderwaterOptics } from './Underwater.js';
import seabedVert from '../shaders/underwater/seabed.vert';
import seabedFrag from '../shaders/underwater/seabed.frag';

/**
 * The ground under the water: banks, gullies, kelp, boulders and the odd wreck.
 *
 * The heightfield is a pure function of world position and the world seed, which is the whole
 * design. Chunks do not blend, stitch or overlap: two neighbours share an edge because they
 * evaluate the *same function* at the *same coordinates*, and the tests assert that the shared
 * column agrees bit for bit from both sides. Normals come from finite differences on the field
 * rather than from the triangles, for the same reason — a per-chunk `computeVertexNormals` sees
 * only half the neighbourhood at an edge and leaves a lit seam every chunk boundary.
 *
 * The relief is North Sea rather than reef: broad sandy banks separated by tide-scoured gullies,
 * running from about fifteen metres on the shallowest bank down to eighty in the channels. Kelp
 * only grows on the banks, because kelp is a plant and needs light, and that one constraint is
 * what makes the seabed read as a place with a shape rather than as noise.
 *
 * Everything down here draws with one program — see `seabed.vert` for why — so a chunk is three
 * draw calls plus a wreck, and the whole visible seafloor is under a hundred.
 */

/** Metres along one edge of a seabed chunk, and lattice cells across it. */
export const SEABED_CHUNK_SIZE = 128;
export const SEABED_RESOLUTION = 32;

/** Mean depth of the shelf, metres below datum, before relief. */
const SHELF_DEPTH = -38;
/** Peak-to-peak relief of the banks, and the maximum depth a gully cuts below them. */
const BANK_RELIEF = 22;
const GULLY_DEPTH = 24;

/** Depth band kelp will grow in. Below thirty metres of northern water there is not enough light. */
const KELP_MIN_DEPTH = 6;
const KELP_MAX_DEPTH = 28;
/** Kelp will not hold on ground steeper than this, expressed as a gradient. */
const KELP_MAX_SLOPE = 0.32;

const MAX_KELP_PER_CHUNK = 96;
const MAX_ROCKS_PER_CHUNK = 28;
/** Chance a chunk holds a wreck. Rare enough that finding one is an event. */
const WRECK_CHANCE = 0.022;

/** Material identifiers, mirrored in `seabed.frag`. */
const MATERIAL_SEDIMENT = 0;
const MATERIAL_KELP = 1;
const MATERIAL_ROCK = 2;
const MATERIAL_WRECK = 3;

/**
 * World coordinate of lattice column `index` in chunk `chunk`.
 *
 * The single place a seabed vertex gets its position, called by the mesh builder and by the
 * continuity test. `chunk * size` and `(index / resolution) * size` are both exact for the
 * integers involved, so the last column of one chunk and the first column of the next produce
 * the identical double, and the field therefore produces the identical height.
 */
export function seabedVertexCoordinate(
  chunk: number,
  index: number,
  resolution: number,
  size: number,
): number {
  return chunk * size + (index / resolution) * size;
}

/**
 * The heightfield itself. Pure, seeded, and independent of anything that has been visited.
 */
export class SeabedField {
  private readonly banks: Noise;
  private readonly gullies: Noise;
  private readonly ripples: Noise;

  constructor(seed: number) {
    this.banks = new Noise(seed ^ 0x5eab);
    this.gullies = new Noise(seed ^ 0x9611);
    this.ripples = new Noise(seed ^ 0x2c07);
  }

  /** Seabed elevation at a world position, metres relative to datum. Always negative. */
  heightAt(x: number, z: number): number {
    const bank = this.banks.fbm2(x * 0.0013, z * 0.0013, 4) * BANK_RELIEF;
    // Ridged noise *carves* rather than piles: the ridge lines become channels, which is what a
    // tide-scoured shelf looks like from a multibeam survey and not at all what plain fBm gives.
    const ridge = this.gullies.ridged2(x * 0.0009, z * 0.0009, 3);
    const gully = ridge * ridge * GULLY_DEPTH;
    // Sand waves. Long, low, and the only thing at this scale the eye can use to judge distance
    // once the water has taken every other cue away.
    const sand = this.ripples.fbm2(x * 0.035, z * 0.035, 2) * 0.55;
    return SHELF_DEPTH + bank - gully + sand;
  }

  /**
   * Surface normal, by central differences on the field.
   *
   * Deliberately not derived from the mesh: a chunk's triangles stop at its edge, so a mesh
   * normal there is computed from half a neighbourhood and disagrees with the one the next chunk
   * computes for the same vertex. The field has no edges, so this does not either.
   */
  normalAt(x: number, z: number, out: Vector3): Vector3 {
    const step = 1.5;
    const dx = this.heightAt(x + step, z) - this.heightAt(x - step, z);
    const dz = this.heightAt(x, z + step) - this.heightAt(x, z - step);
    return out.set(-dx, 2 * step, -dz).normalize();
  }

  /** Gradient magnitude — rise over run. Decides where kelp can hold and where rock shows. */
  slopeAt(x: number, z: number): number {
    const step = 1.5;
    const dx = this.heightAt(x + step, z) - this.heightAt(x - step, z);
    const dz = this.heightAt(x, z + step) - this.heightAt(x, z - step);
    return Math.hypot(dx, dz) / (2 * step);
  }

  /**
   * Fill a chunk's lattice heights, row-major, `(resolution + 1)²` of them.
   *
   * Exposed so the continuity test walks exactly the code the mesh builder walks rather than a
   * reimplementation of it, which is the only way that test proves anything.
   */
  sampleChunk(
    cx: number,
    cz: number,
    resolution: number,
    size: number,
    out: Float32Array,
  ): Float32Array {
    const stride = resolution + 1;
    for (let iz = 0; iz <= resolution; iz += 1) {
      const worldZ = seabedVertexCoordinate(cz, iz, resolution, size);
      for (let ix = 0; ix <= resolution; ix += 1) {
        const worldX = seabedVertexCoordinate(cx, ix, resolution, size);
        out[iz * stride + ix] = this.heightAt(worldX, worldZ);
      }
    }
    return out;
  }
}

/** Attach the two attributes `seabed.vert` needs to a geometry built by three's primitives. */
function tag(geometry: BufferGeometry, material: number, swayHeight = 0): BufferGeometry {
  const position = geometry.getAttribute('position');
  const sway = new Float32Array(position.count);
  const kind = new Float32Array(position.count);
  for (let i = 0; i < position.count; i += 1) {
    kind[i] = material;
    sway[i] = swayHeight > 0 ? clamp(position.getY(i) / swayHeight, 0, 1) : 0;
  }
  geometry.setAttribute('aSway', new BufferAttribute(sway, 1));
  geometry.setAttribute('aMaterial', new BufferAttribute(kind, 1));
  return geometry;
}

/**
 * A kelp frond: two blades crossed at right angles.
 *
 * A single card disappears edge-on, and a real *Laminaria* blade is split into straps anyway, so
 * the cross costs one extra quad strip and removes the one angle from which a kelp bed vanishes.
 * The width profile is narrow at the stipe, broadest a third of the way up and tapering to the
 * tip, which is the actual outline of the plant.
 */
function buildKelpFrond(height: number): BufferGeometry {
  const SEGMENTS = 6;
  const halfWidth = height * 0.075;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (const axis of [0, 1]) {
    const base = positions.length / 3;
    for (let i = 0; i <= SEGMENTS; i += 1) {
      const t = i / SEGMENTS;
      const width = halfWidth * Math.sin(Math.PI * t ** 0.62) * (1 - 0.35 * t);
      for (const side of [-1, 1]) {
        const offset = side * width;
        positions.push(axis === 0 ? offset : 0, t * height, axis === 0 ? 0 : offset);
        uvs.push(side * 0.5 + 0.5, t);
      }
    }
    for (let i = 0; i < SEGMENTS; i += 1) {
      const a = base + i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return tag(geometry, MATERIAL_KELP, height);
}

/** A boulder. One shape, made unrecognisable by per-instance rotation and non-uniform scale. */
function buildBoulder(): BufferGeometry {
  const geometry = new IcosahedronGeometry(1, 1);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    // A deterministic radial dent, so every boulder in every session is the same boulder and the
    // shape can be authored by eye rather than re-rolled per chunk.
    const dent = 0.78 + 0.22 * Math.sin(x * 5.1 + y * 3.3) * Math.cos(z * 4.7 - y * 2.1);
    position.setXYZ(i, x * dent, y * dent * 0.72, z * dent);
  }
  geometry.computeVertexNormals();
  return tag(geometry, MATERIAL_ROCK);
}

/**
 * A wreck: a small coaster, broken-backed and half buried.
 *
 * Worth the sixty lines because it is the one landmark on an otherwise featureless shelf, and
 * because the species table already says a conger wants one. Built once and instanced by
 * transform, so a hundred chunks cost one geometry.
 */
function buildWreck(): BufferGeometry {
  const parts: BufferGeometry[] = [
    // Hull, snapped just abaft midships — the two halves sit at different angles, which is what
    // actually happens to a hull that has settled across a gully.
    new BoxGeometry(4.6, 3.2, 13).translate(0, 0.4, -5.5),
    new BoxGeometry(4.4, 3.0, 9).rotateX(0.16).rotateZ(0.3).translate(0.8, -0.2, 5.4),
    // Bow, faired off with a cylinder laid on its side.
    new CylinderGeometry(2.3, 1.2, 4.4, 8).rotateX(Math.PI / 2).translate(0, 0.4, -13.4),
    // Deckhouse and funnel, still standing on the forward half.
    new BoxGeometry(3.4, 2.4, 4.2).translate(0, 2.9, -3.2),
    new CylinderGeometry(0.85, 0.95, 2.6, 10).translate(0, 5.2, -2.4),
    // The mast, gone over the side and lying across the deck.
    new CylinderGeometry(0.22, 0.3, 11, 7).rotateZ(1.32).translate(3.4, 1.9, -7.5),
    // Frames showing where the plating has gone.
    new BoxGeometry(4.8, 0.3, 0.35).translate(0, 1.6, -1.2),
    new BoxGeometry(4.8, 0.3, 0.35).translate(0, 1.5, 0.6),
  ];
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  // Sunk into the bed: a wreck that sits on the sand like a model reads as a prop.
  merged.translate(0, -1.4, 0);
  return tag(merged, MATERIAL_WRECK);
}

interface SeabedChunk {
  readonly group: Group;
  readonly geometry: BufferGeometry;
  readonly kelp: InstancedMesh;
  readonly rocks: InstancedMesh;
  readonly wreck: Mesh;
}

/** The slice of the ocean the seabed needs: the surface height, and the swell driving the kelp. */
export interface SwellSource {
  heightAt(x: number, z: number): number;
  readonly waveBank: WaveBank;
}

const scratchMatrix = new Matrix4();
const scratchPosition = new Vector3();
const scratchQuaternion = new Quaternion();
const scratchScale = new Vector3();
const scratchNormal = new Vector3();
const UP = new Vector3(0, 1, 0);

export class Seabed implements System, ChunkFactory<SeabedChunk> {
  readonly name = 'seabed';
  /** After the ocean, before the entities that need to know where the bottom is. */
  readonly priority = 12;
  readonly chunkSize = SEABED_CHUNK_SIZE;

  readonly field: SeabedField;

  private readonly root = new Group();
  private readonly material: ShaderMaterial;
  private readonly kelpGeometry: BufferGeometry;
  private readonly boulderGeometry: BufferGeometry;
  private readonly wreckGeometry: BufferGeometry;
  private readonly grid: ChunkGrid<SeabedChunk>;
  private readonly swell: SwellSource;
  private optics: UnderwaterOptics | null = null;
  private kelpBudget: number;
  private rockBudget: number;

  constructor(engine: Engine, swell: SwellSource) {
    this.swell = swell;
    this.field = new SeabedField(engine.settings.world.seed);

    const graphics = engine.settings.graphics;
    this.kelpBudget = Math.round(MAX_KELP_PER_CHUNK * clamp(graphics.instanceDensity, 0.1, 1));
    this.rockBudget = Math.round(MAX_ROCKS_PER_CHUNK * clamp(graphics.instanceDensity, 0.1, 1));

    this.kelpGeometry = buildKelpFrond(1);
    this.boulderGeometry = buildBoulder();
    this.wreckGeometry = buildWreck();

    this.material = new ShaderMaterial({
      name: 'seabed',
      vertexShader: seabedVert,
      fragmentShader: seabedFrag,
      uniforms: {
        ...worldLightUniforms(),
        uTime: { value: 0 },
        uCurrent: { value: new Vector2(0.06, 0.03) },
        uSurgeDirection: { value: new Vector2(1, 0) },
        uSurgeFrequency: { value: 0.8 },
        uSurgeSpeed: { value: 0.2 },
        uSwayScale: { value: 0.9 },
        uCaustics: { value: null },
        uCausticsScale: { value: 9 },
        uCausticsOffset: { value: new Vector2() },
        uCausticsPhase: { value: 0 },
        uCausticsStrength: { value: 0 },
        uWaterLevel: { value: 0 },
        uTurbidity: { value: 0.32 },
      },
      // Kelp blades have no thickness, and a camera under the bed in a gully should still see
      // ground rather than the inside of the world.
      side: DoubleSide,
    });

    this.grid = new ChunkGrid<SeabedChunk>(this, engine.settings.world.seed ^ 0x0bed, {
      creationBudget: 2,
      poolLimit: 12,
    });
    this.grid.setDrawDistance(drawDistanceFor(graphics.drawDistance));

    this.root.name = 'seabed';
    engine.scene.add(this.root);
  }

  /** Seabed elevation under a world position. The query `Fish` keeps its shoals above. */
  floorHeightAt(x: number, z: number): number {
    return this.field.heightAt(x, z);
  }

  /**
   * Hand the seabed the underwater optics.
   *
   * Structurally the same arrangement as `Ocean.setCloudShadows`: the caustic sheet, its drift
   * and the water's turbidity are the `Underwater` system's business, and the seabed only needs
   * to be told what they are this frame.
   */
  setOptics(source: UnderwaterOptics): void {
    this.optics = source;
  }

  update(_dt: number, engine: Engine): void {
    const camera = engine.camera.position;
    this.grid.update(camera.x, camera.z);

    const uniforms = this.material.uniforms;
    setNumber(uniforms, 'uTime', engine.loop.elapsed);
    setNumber(uniforms, 'uWaterLevel', this.swell.heightAt(camera.x, camera.z));

    // The kelp is moved by the swell overhead, not by the wind. Orbital velocity decays as
    // e^(−k·h) with depth, so the same sea that thrashes a bed in fifteen metres leaves one in
    // sixty perfectly still — which is exactly what a diver sees and costs one exponential.
    const depth = Math.max(1, -this.field.heightAt(camera.x, camera.z));
    let dominant = 0;
    let surgeSpeed = 0;
    let surgeFrequency = 0.8;
    const components = this.swell.waveBank.components;
    for (let i = 0; i < components.length; i += 1) {
      const wave = components[i];
      if (wave === undefined || wave.amplitude <= dominant) continue;
      dominant = wave.amplitude;
      surgeFrequency = wave.frequency;
      surgeSpeed = wave.amplitude * wave.frequency * Math.exp(-wave.wavenumber * depth);
      const direction = uniforms['uSurgeDirection'];
      if (direction !== undefined) {
        (direction.value as Vector2).set(wave.directionX, wave.directionZ);
      }
    }
    setNumber(uniforms, 'uSurgeFrequency', surgeFrequency);
    setNumber(uniforms, 'uSurgeSpeed', Math.min(1.2, surgeSpeed));

    // The tidal set. Weak, slow, and always there — kelp with no steady lean at all looks like
    // it is standing in a swimming pool.
    const current = uniforms['uCurrent'];
    if (current !== undefined) {
      const world = engine.world;
      (current.value as Vector2).set(world.windX * 0.012, world.windZ * 0.012);
    }

  }

  /**
   * The optics are read here rather than in `update` on purpose.
   *
   * `Underwater` runs at priority 35 and the seabed at 12, so its caustic phase for this frame
   * does not exist yet when `update` runs. `beforeRender` is after every system's `update`, which
   * is the difference between the light on the sand being this frame's swell and last frame's.
   */
  beforeRender(engine: Engine): void {
    const uniforms = this.material.uniforms;
    updateWorldLight(uniforms, engine, skyEnvironment(engine));

    const optics = this.optics;
    if (optics === null) return;
    const caustics = uniforms['uCaustics'];
    if (caustics !== undefined) caustics.value = optics.caustics;
    setNumber(uniforms, 'uCausticsScale', optics.causticsScale);
    setNumber(uniforms, 'uCausticsPhase', optics.causticsPhase);
    setNumber(uniforms, 'uCausticsStrength', optics.causticsStrength);
    setNumber(uniforms, 'uTurbidity', optics.turbidity);
    const offset = uniforms['uCausticsOffset'];
    if (offset !== undefined) {
      (offset.value as Vector2).set(optics.causticsOffsetX, optics.causticsOffsetZ);
    }
  }

  onSettingsChanged(engine: Engine): void {
    const graphics = engine.settings.graphics;
    this.kelpBudget = Math.round(MAX_KELP_PER_CHUNK * clamp(graphics.instanceDensity, 0.1, 1));
    this.rockBudget = Math.round(MAX_ROCKS_PER_CHUNK * clamp(graphics.instanceDensity, 0.1, 1));
    this.grid.setDrawDistance(drawDistanceFor(graphics.drawDistance));
  }

  dispose(): void {
    this.grid.dispose();
    this.material.dispose();
    this.kelpGeometry.dispose();
    this.boulderGeometry.dispose();
    this.wreckGeometry.dispose();
    this.root.clear();
  }

  // --- ChunkFactory ---------------------------------------------------------------------------

  create(cx: number, cz: number, rng: PRNG): SeabedChunk {
    const geometry = buildGroundLattice();
    const group = new Group();

    const ground = new Mesh(geometry, this.material);
    ground.receiveShadow = true;
    group.add(ground);

    const kelp = new InstancedMesh(this.kelpGeometry, this.material, MAX_KELP_PER_CHUNK);
    kelp.count = 0;
    kelp.frustumCulled = false;
    group.add(kelp);

    const rocks = new InstancedMesh(this.boulderGeometry, this.material, MAX_ROCKS_PER_CHUNK);
    rocks.count = 0;
    rocks.frustumCulled = false;
    group.add(rocks);

    const wreck = new Mesh(this.wreckGeometry, this.material);
    wreck.visible = false;
    group.add(wreck);

    this.root.add(group);
    const chunk: SeabedChunk = { group, geometry, kelp, rocks, wreck };
    this.fill(chunk, cx, cz, rng);
    return chunk;
  }

  reset(chunk: SeabedChunk, cx: number, cz: number, rng: PRNG): void {
    this.fill(chunk, cx, cz, rng);
  }

  retire(chunk: SeabedChunk): void {
    chunk.group.visible = false;
  }

  destroy(chunk: SeabedChunk): void {
    this.root.remove(chunk.group);
    chunk.geometry.dispose();
    chunk.kelp.dispose();
    chunk.rocks.dispose();
  }

  /**
   * Write a chunk's ground, weed and rock for a cell.
   *
   * The lattice's x and z never change — every chunk is the same grid translated — so only the
   * heights and normals are rewritten, and a recycled chunk touches two attributes instead of
   * rebuilding a buffer.
   */
  private fill(chunk: SeabedChunk, cx: number, cz: number, rng: PRNG): void {
    const size = SEABED_CHUNK_SIZE;
    const resolution = SEABED_RESOLUTION;
    const originX = cx * size;
    const originZ = cz * size;
    chunk.group.position.set(originX, 0, originZ);
    chunk.group.visible = true;

    const position = chunk.geometry.getAttribute('position');
    const normal = chunk.geometry.getAttribute('normal');
    let vertex = 0;
    for (let iz = 0; iz <= resolution; iz += 1) {
      const worldZ = seabedVertexCoordinate(cz, iz, resolution, size);
      for (let ix = 0; ix <= resolution; ix += 1) {
        const worldX = seabedVertexCoordinate(cx, ix, resolution, size);
        position.setY(vertex, this.field.heightAt(worldX, worldZ));
        this.field.normalAt(worldX, worldZ, scratchNormal);
        normal.setXYZ(vertex, scratchNormal.x, scratchNormal.y, scratchNormal.z);
        vertex += 1;
      }
    }
    position.needsUpdate = true;
    normal.needsUpdate = true;
    chunk.geometry.computeBoundingSphere();

    this.scatterKelp(chunk, originX, originZ, rng);
    this.scatterRocks(chunk, originX, originZ, rng);
    this.placeWreck(chunk, originX, originZ, rng);
  }

  private scatterKelp(chunk: SeabedChunk, originX: number, originZ: number, rng: PRNG): void {
    let placed = 0;
    for (let attempt = 0; attempt < this.kelpBudget; attempt += 1) {
      const localX = rng.next() * SEABED_CHUNK_SIZE;
      const localZ = rng.next() * SEABED_CHUNK_SIZE;
      const worldX = originX + localX;
      const worldZ = originZ + localZ;
      const height = this.field.heightAt(worldX, worldZ);
      const depth = -height;
      // Light and holdfast, in that order. Kelp is a plant that has to stay attached.
      if (depth < KELP_MIN_DEPTH || depth > KELP_MAX_DEPTH) continue;
      if (this.field.slopeAt(worldX, worldZ) > KELP_MAX_SLOPE) continue;

      // Fronds grow taller in deeper, calmer water and stunt in the surge on top of a bank.
      const length = 1.1 + 2.4 * clamp((depth - KELP_MIN_DEPTH) / 16, 0, 1) * rng.range(0.7, 1.3);
      scratchPosition.set(localX, height, localZ);
      scratchQuaternion.setFromAxisAngle(UP, rng.next() * Math.PI * 2);
      scratchScale.set(rng.range(0.75, 1.25), length, rng.range(0.75, 1.25));
      scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);
      chunk.kelp.setMatrixAt(placed, scratchMatrix);
      placed += 1;
    }
    chunk.kelp.count = placed;
    chunk.kelp.visible = placed > 0;
    chunk.kelp.instanceMatrix.needsUpdate = true;
  }

  private scatterRocks(chunk: SeabedChunk, originX: number, originZ: number, rng: PRNG): void {
    let placed = 0;
    for (let attempt = 0; attempt < this.rockBudget; attempt += 1) {
      const localX = rng.next() * SEABED_CHUNK_SIZE;
      const localZ = rng.next() * SEABED_CHUNK_SIZE;
      const worldX = originX + localX;
      const worldZ = originZ + localZ;
      // Boulders sit where the sediment has been scoured off, which is on the slopes of the
      // gullies rather than out on the flat.
      const slope = this.field.slopeAt(worldX, worldZ);
      if (rng.next() > 0.15 + slope * 2.2) continue;

      const height = this.field.heightAt(worldX, worldZ);
      const radius = rng.range(0.35, 1.9);
      // Bedded in by a third of their radius. A sphere resting exactly on the surface reads as a
      // ball bearing dropped on the sand.
      scratchPosition.set(localX, height - radius * 0.3, localZ);
      scratchQuaternion.setFromAxisAngle(
        scratchNormal.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize(),
        rng.next() * Math.PI * 2,
      );
      scratchScale.set(radius * rng.range(0.8, 1.3), radius, radius * rng.range(0.8, 1.3));
      scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);
      chunk.rocks.setMatrixAt(placed, scratchMatrix);
      placed += 1;
    }
    chunk.rocks.count = placed;
    chunk.rocks.visible = placed > 0;
    chunk.rocks.instanceMatrix.needsUpdate = true;
  }

  private placeWreck(chunk: SeabedChunk, originX: number, originZ: number, rng: PRNG): void {
    const wreck = chunk.wreck;
    if (rng.next() > WRECK_CHANCE) {
      wreck.visible = false;
      return;
    }
    const localX = rng.range(20, SEABED_CHUNK_SIZE - 20);
    const localZ = rng.range(20, SEABED_CHUNK_SIZE - 20);
    const height = this.field.heightAt(originX + localX, originZ + localZ);
    wreck.visible = true;
    wreck.position.set(localX, height, localZ);
    // Listed over, the way a hull that has lost its buoyancy settles, and lying whichever way
    // the tide left her.
    wreck.rotation.set(rng.range(-0.12, 0.12), rng.next() * Math.PI * 2, rng.range(0.15, 0.42));
  }
}

/**
 * The lattice every chunk shares, as a fresh buffer.
 *
 * Positions are chunk-local so the shader never sees a coordinate with kilometres of magnitude
 * and centimetres of meaning; the group's transform supplies the world offset.
 */
function buildGroundLattice(): BufferGeometry {
  const resolution = SEABED_RESOLUTION;
  const size = SEABED_CHUNK_SIZE;
  const stride = resolution + 1;
  const vertices = stride * stride;

  const positions = new Float32Array(vertices * 3);
  const normals = new Float32Array(vertices * 3);
  const uvs = new Float32Array(vertices * 2);
  const sway = new Float32Array(vertices);
  const material = new Float32Array(vertices);
  const indices = new Uint16Array(resolution * resolution * 6);

  let vertex = 0;
  for (let iz = 0; iz <= resolution; iz += 1) {
    for (let ix = 0; ix <= resolution; ix += 1) {
      positions[vertex * 3] = (ix / resolution) * size;
      positions[vertex * 3 + 2] = (iz / resolution) * size;
      normals[vertex * 3 + 1] = 1;
      uvs[vertex * 2] = ix / resolution;
      uvs[vertex * 2 + 1] = iz / resolution;
      sway[vertex] = 0;
      material[vertex] = MATERIAL_SEDIMENT;
      vertex += 1;
    }
  }

  let index = 0;
  for (let iz = 0; iz < resolution; iz += 1) {
    for (let ix = 0; ix < resolution; ix += 1) {
      const a = iz * stride + ix;
      indices[index] = a;
      indices[index + 1] = a + stride;
      indices[index + 2] = a + 1;
      indices[index + 3] = a + 1;
      indices[index + 4] = a + stride;
      indices[index + 5] = a + stride + 1;
      index += 6;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setAttribute('aSway', new BufferAttribute(sway, 1));
  geometry.setAttribute('aMaterial', new BufferAttribute(material, 1));
  geometry.setIndex(new BufferAttribute(indices, 1));
  return geometry;
}

/**
 * How far the seabed streams.
 *
 * A small fraction of the island draw distance, because there is no point drawing ground the
 * water has already absorbed to nothing: even from above the surface, the ocean's own Jerlov
 * extinction leaves nothing of the bed past a few hundred metres of slant path.
 */
function drawDistanceFor(drawDistance: number): number {
  return clamp(drawDistance * 0.07, 200, 300);
}

function setNumber(
  uniforms: Record<string, { value: unknown } | undefined>,
  name: string,
  value: number,
): void {
  const uniform = uniforms[name];
  if (uniform !== undefined) uniform.value = value;
}

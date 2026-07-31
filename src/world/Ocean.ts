import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  Mesh,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Texture,
} from 'three';
import type { Engine, System } from '../core/Engine.js';
import { WaveBank, type Displacement, type SpectrumParameters } from '../math/Gerstner.js';
import { createFoamTexture, createOceanDetailNormal } from '../render/ProceduralTextures.js';
import { checkGerstnerParity, type ParityResult } from '../render/GerstnerParity.js';
import { beaufortFromWindSpeed } from '../core/WorldState.js';
import type { Sky } from './Sky.js';
import oceanVert from '../shaders/ocean/ocean.vert';
import oceanFrag from '../shaders/ocean/ocean.frag';

/**
 * The endless ocean.
 *
 * Geometry is a clipmap: a fine square block around the camera surrounded by rings of
 * progressively coarser cells, merged into a **single** buffer with per-vertex cell size, so
 * the entire sea from a metre away to eighteen kilometres out is one draw call. Levels snap to
 * their own lattices and geomorph into one another at their shared boundaries — see the vertex
 * shader for why both of those are load-bearing rather than optimisations.
 *
 * The wave field itself comes from `math/Gerstner.ts`, which is also what the buoyancy solver
 * queries. There is exactly one wave bank; the GPU gets it as a uniform array and the physics
 * evaluates it directly, so the hull cannot be riding a different sea from the one on screen.
 */

/** Maximum wave components the shader is compiled for. Must match MAX_WAVES in the GLSL. */
const MAX_WAVES = 8;

/** Cell size of the innermost level, metres. Half a metre resolves a hull's waterline. */
const BASE_CELL_SIZE = 0.55;

/** How far the seabed is below mean water level in open water, metres. */
const OPEN_WATER_DEPTH = 55;

/**
 * Radius the clipmap must reach, metres, whatever the quality preset says.
 *
 * The sea has to extend past the horizon or a wedge of below-horizon sky shows between the water
 * and the sky — the horizon band. With curvature applied in the vertex shader the surface folds
 * away beyond sqrt(2 * eyeHeight * R), so "past the horizon" means past the horizon of the
 * highest eye the camera can reach: the orbit camera tops out around twenty metres, which puts
 * its horizon at sixteen kilometres. Rings beyond that are hidden behind nearer water and cost
 * nothing but a handful of triangles, whereas one ring short is a line across every frame.
 */
const HORIZON_REACH_M = 16000;

export class Ocean implements System {
  readonly name = 'ocean';
  readonly priority = 10;

  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;
  private geometry: BufferGeometry;

  private bank: WaveBank;
  private waveTime = 0;
  private readonly waveA = new Float32Array(MAX_WAVES * 4);
  private readonly waveB = new Float32Array(MAX_WAVES * 4);
  private readonly scratch: Displacement = { x: 0, y: 0, z: 0 };

  private refraction: WebGLRenderTarget;
  private refractionScale: number;

  private readonly detailNormal: Texture;
  private readonly foamTexture: Texture;

  /** Spectrum the current bank was built from, so we only rebuild when it actually changes. */
  private spectrum: SpectrumParameters;

  constructor(engine: Engine) {
    const graphics = engine.settings.graphics;

    this.spectrum = {
      windSpeed: 6,
      windDirection: 0,
      fetchKm: engine.world.fetchKm,
      waveCount: graphics.waveCount,
      seed: engine.settings.world.seed,
      spreading: 10,
      amplitudeScale: 1,
    };
    this.bank = new WaveBank(this.spectrum);

    this.detailNormal = engine.resources.track(createOceanDetailNormal(512, engine.settings.world.seed));
    this.foamTexture = engine.resources.track(createFoamTexture(512, engine.settings.world.seed ^ 0x9e37));

    this.refractionScale = graphics.refractionScale;
    this.refraction = createRefractionTarget(1, 1);

    this.material = new ShaderMaterial({
      vertexShader: oceanVert,
      fragmentShader: oceanFrag,
      defines: { MAX_WAVES },
      uniforms: {
        uWaveA: { value: this.waveA },
        uWaveB: { value: this.waveB },
        uWaveCount: { value: 0 },
        uWaveTime: { value: 0 },
        uRingCentre: { value: new Vector2() },
        uCameraPosition: { value: new Vector3() },
        uWaterLevel: { value: 0 },
        uTime: { value: 0 },
        uSunDirection: { value: new Vector3(0, 1, 0) },
        uSunColour: { value: new Color(1, 1, 1) },
        uSunIlluminance: { value: 1 },
        uMoonDirection: { value: new Vector3(0, -1, 0) },
        uMoonColour: { value: new Color(0.72, 0.8, 1) },
        uMoonIlluminance: { value: 0 },
        uSunAngularRadius: { value: 0.00465 },
        uMoonAngularRadius: { value: 0.00452 },
        uEnvironment: { value: null },
        uEnvironmentIntensity: { value: 1 },
        uDetailNormal: { value: this.detailNormal },
        uFoam: { value: this.foamTexture },
        uWindDirection: { value: new Vector2(1, 0) },
        uWindSpeed: { value: 6 },
        uSeabedDepth: { value: OPEN_WATER_DEPTH },
        uTurbidity: { value: 0.15 },
        uFoamAmount: { value: 1 },
        uRefraction: { value: this.refraction.texture },
        uResolution: { value: new Vector2(1, 1) },
        uRefractionStrength: { value: 0.06 },
        uCloudShadow: { value: null },
        uCloudShadowMatrix: { value: new Matrix4() },
        uCloudShadowStrength: { value: 0 },
      },
      // The camera can pass through a crest, and a back-facing wave that vanishes is far more
      // objectionable than the cost of drawing both sides of a surface this simple.
      side: DoubleSide,
      transparent: false,
      depthWrite: true,
    });

    this.geometry = buildClipmap(
      graphics.oceanGridResolution,
      ringsForHorizon(graphics.oceanGridResolution, graphics.oceanRings),
      BASE_CELL_SIZE,
    );
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0;
    this.mesh.receiveShadow = true;

    this.uploadBank();
    engine.scene.add(this.mesh);
  }

  /**
   * Hand the ocean the cloud layer's shadow mask.
   *
   * Structurally typed rather than importing `Clouds`, so `world/Ocean` does not depend on
   * `world/Clouds` — the ocean does not care what casts the shadow, only that something does.
   *
   * This is the feature the brief singles out as doing more for a living sky than any other,
   * and it is worth being clear about why: without it a broken-cloud day lights the entire sea
   * uniformly, which reads as an overcast sky no matter what is drawn overhead. With it, the
   * water goes from bright to slate and back as the cloud field drifts, and the sea suddenly
   * has weather happening *to* it.
   */
  setCloudShadows(source: { shadowTexture: Texture | null; shadowMatrix: Matrix4 }): void {
    this.cloudShadows = source;
  }

  private cloudShadows: { shadowTexture: Texture | null; shadowMatrix: Matrix4 } | null = null;

  /** Significant wave height of the sea currently on screen, metres. */
  get significantWaveHeight(): number {
    return this.bank.significantWaveHeight;
  }

  get peakPeriod(): number {
    return this.bank.peakPeriod;
  }

  get waveBank(): WaveBank {
    return this.bank;
  }

  /**
   * Water surface height at a world position — the query the buoyancy solver lives on.
   *
   * Evaluates the same bank the vertex shader does, inverting the horizontal displacement so
   * the answer is the height *at* (x, z) rather than the height of the point that started
   * there. See `WaveBank.heightAt`.
   */
  heightAt(x: number, z: number): number {
    return this.waterLevel + this.bank.heightAt(x, z, this.waveTime, this.scratch);
  }

  /**
   * Run the CPU/GPU wave parity harness against the live wave bank.
   *
   * Exposed here rather than owned by the harness because the packed uniform arrays and the
   * wave clock are this system's private state, and a copy of them kept anywhere else would be
   * exactly the second source of truth this whole arrangement exists to prevent.
   */
  parityCheck(engine: Engine): ParityResult {
    const countUniform = this.material.uniforms['uWaveCount'];
    const count = typeof countUniform?.value === 'number' ? countUniform.value : 0;
    return checkGerstnerParity(engine.renderer, this.bank, this.waveTime, this.waveA, this.waveB, count);
  }

  /** Surface normal at a world position, for aligning the bobber and spawning spray. */
  normalAt(x: number, z: number, out: Vector3): Vector3 {
    this.bank.normalAt(x, z, this.waveTime, this.scratch);
    return out.set(this.scratch.x, this.scratch.y, this.scratch.z);
  }

  /** Mean water level, shifted by the tide. */
  private waterLevel = 0;

  fixedUpdate(dt: number): void {
    // Wave phase advances on the fixed clock so the physics and the render agree exactly.
    this.waveTime += dt;
  }

  update(_dt: number, engine: Engine): void {
    const world = engine.world;
    this.waterLevel = world.tideHeight;

    this.rebuildIfNeeded(engine);

    const uniforms = this.material.uniforms;
    setNumber(uniforms, 'uWaveTime', this.waveTime);
    setNumber(uniforms, 'uTime', engine.loop.elapsed);
    setNumber(uniforms, 'uWaterLevel', this.waterLevel);
    setNumber(uniforms, 'uWindSpeed', world.windSpeed);
    setNumber(uniforms, 'uFoamAmount', 1);

    const centre = uniforms['uRingCentre'];
    if (centre !== undefined) {
      (centre.value as Vector2).set(engine.camera.position.x, engine.camera.position.z);
    }
    const cameraUniform = uniforms['uCameraPosition'];
    if (cameraUniform !== undefined) {
      (cameraUniform.value as Vector3).copy(engine.camera.position);
    }
    const windUniform = uniforms['uWindDirection'];
    if (windUniform !== undefined) {
      const length = Math.hypot(world.windX, world.windZ) || 1;
      (windUniform.value as Vector2).set(world.windX / length, world.windZ / length);
    }

    const ephemeris = world.ephemeris;
    if (ephemeris !== null) {
      const sun = uniforms['uSunDirection'];
      if (sun !== undefined) {
        (sun.value as Vector3).set(
          ephemeris.sunDirectionRefracted.x,
          ephemeris.sunDirectionRefracted.y,
          ephemeris.sunDirectionRefracted.z,
        );
      }
      const moon = uniforms['uMoonDirection'];
      if (moon !== undefined) {
        (moon.value as Vector3).set(
          ephemeris.moonDirection.x,
          ephemeris.moonDirection.y,
          ephemeris.moonDirection.z,
        );
      }
      // Illuminance is divided by π to convert to the radiance a Lambertian surface would
      // return, which is the quantity the specular term below actually wants.
      setNumber(uniforms, 'uSunIlluminance', (ephemeris.sunIlluminanceLux / Math.PI) * (1 - world.cloudiness * 0.9));
      setNumber(uniforms, 'uMoonIlluminance', ephemeris.moonIlluminanceLux / Math.PI);
      // The true apparent radii, which vary by a couple of percent over a year for the sun and
      // by twelve for the moon. The specular lobe is widened to match them, so feeding it the
      // real numbers rather than an average costs nothing and keeps a perigee moon's glitter
      // path the size it should be.
      setNumber(uniforms, 'uSunAngularRadius', ephemeris.sun.angularRadius);
      setNumber(uniforms, 'uMoonAngularRadius', ephemeris.moon.angularRadius);
    }
  }

  beforeRender(engine: Engine): void {
    // Refraction: the scene as seen *through* the water, captured with the water itself hidden.
    // Rendered at a fraction of the main resolution because it is only ever sampled through a
    // distorted, absorbing medium — detail below a few pixels cannot survive the trip.
    const width = Math.max(2, Math.round(engine.width * engine.pixelRatio * this.refractionScale));
    const height = Math.max(2, Math.round(engine.height * engine.pixelRatio * this.refractionScale));
    if (this.refraction.width !== width || this.refraction.height !== height) {
      this.refraction.setSize(width, height);
    }

    const previousTarget = engine.renderer.getRenderTarget();
    this.mesh.visible = false;
    engine.renderer.setRenderTarget(this.refraction);
    engine.renderer.clear();
    engine.renderer.render(engine.scene, engine.camera);
    engine.renderer.setRenderTarget(previousTarget);
    this.mesh.visible = true;

    const uniforms = this.material.uniforms;
    const resolution = uniforms['uResolution'];
    if (resolution !== undefined) {
      // The shader indexes the refraction buffer by main-framebuffer coordinates, so the
      // resolution it divides by is the *main* one, not the reduced target's.
      (resolution.value as Vector2).set(
        engine.width * engine.pixelRatio,
        engine.height * engine.pixelRatio,
      );
    }

    // The environment probe is the ocean's mirror. It is a plain cubemap rather than the PMREM
    // one because water is nearly specular: a roughness-prefiltered lookup would blur away
    // exactly the horizon detail the reflection is made of.
    const sky = engine.get<Sky>('sky');
    const environment = uniforms['uEnvironment'];
    if (environment !== undefined && sky !== undefined) environment.value = sky.probe.cubeTexture;

    const shadowTexture = this.cloudShadows?.shadowTexture ?? null;
    const shadowUniform = uniforms['uCloudShadow'];
    if (shadowUniform !== undefined) shadowUniform.value = shadowTexture;
    const matrixUniform = uniforms['uCloudShadowMatrix'];
    if (matrixUniform !== undefined && this.cloudShadows !== null) {
      (matrixUniform.value as Matrix4).copy(this.cloudShadows.shadowMatrix);
    }
    // No mask, no shadow — and none on an overcast day either, where there is no direct beam
    // left to interrupt and a moving pattern would look like a projector fault.
    const strength = uniforms['uCloudShadowStrength'];
    if (strength !== undefined) {
      strength.value = shadowTexture === null ? 0 : 1 - engine.world.cloudiness * 0.85;
    }
  }

  onSettingsChanged(engine: Engine): void {
    const graphics = engine.settings.graphics;
    this.refractionScale = graphics.refractionScale;

    const rebuilt = buildClipmap(
      graphics.oceanGridResolution,
      ringsForHorizon(graphics.oceanGridResolution, graphics.oceanRings),
      BASE_CELL_SIZE,
    );
    this.geometry.dispose();
    this.geometry = rebuilt;
    this.mesh.geometry = rebuilt;

    if (graphics.waveCount !== this.spectrum.waveCount) {
      this.spectrum = { ...this.spectrum, waveCount: graphics.waveCount };
      this.bank = new WaveBank(this.spectrum);
      this.uploadBank();
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.refraction.dispose();
  }

  private rebuildIfNeeded(engine: Engine): void {
    const world = engine.world;
    const windDirection = Math.atan2(world.windX, -world.windZ);

    // Rebuilding the bank re-randomises phases, which would visibly jolt the sea, so it only
    // happens when the wind has moved enough to matter. Between rebuilds the weather system's
    // amplitude scale carries the change smoothly.
    const speedChanged = Math.abs(world.windSpeed - this.spectrum.windSpeed) > 0.6;
    const directionChanged = Math.abs(angleDelta(windDirection, this.spectrum.windDirection)) > 0.12;
    const fetchChanged = Math.abs(world.fetchKm - this.spectrum.fetchKm) > 40;
    // Sea state is *read off* the spectrum rather than chosen, so the HUD, the boat's handling
    // model and the fishing tables all learn it from the same place the waves came from.
    world.beaufort = beaufortFromWindSpeed(world.windSpeed);

    if (!speedChanged && !directionChanged && !fetchChanged) {
      world.significantWaveHeight = this.bank.significantWaveHeight;
      return;
    }

    this.spectrum = {
      ...this.spectrum,
      windSpeed: world.windSpeed,
      windDirection,
      fetchKm: world.fetchKm,
      // A young sea under a rising wind is short-crested and confused; a long-fetch swell is
      // organised. Tying the spreading exponent to Beaufort is what makes force 3 look like
      // force 3 rather than like a scaled-down force 9.
      spreading: 14 - Math.min(9, beaufortFromWindSpeed(world.windSpeed)),
    };
    this.bank = new WaveBank(this.spectrum);
    this.uploadBank();
    world.significantWaveHeight = this.bank.significantWaveHeight;
  }

  private uploadBank(): void {
    this.waveA.fill(0);
    this.waveB.fill(0);
    const packed = new Float32Array(MAX_WAVES * 8);
    const count = this.bank.toUniformArray(packed);
    this.waveA.set(packed.subarray(0, count * 4));
    this.waveB.set(packed.subarray(count * 4, count * 8));
    setNumber(this.material.uniforms, 'uWaveCount', count);
  }
}

function setNumber(
  uniforms: Record<string, { value: unknown } | undefined>,
  name: string,
  value: number,
): void {
  const uniform = uniforms[name];
  if (uniform !== undefined) uniform.value = value;
}

/**
 * Ring count needed to cover `HORIZON_REACH_M`, never fewer than the preset asks for.
 *
 * Each level doubles the cell size, so the half-extent doubles too and the count grows
 * logarithmically: the Low preset needs six more rings than its five, and Ultra needs two. Those
 * rings are the same vertex count as any other — they are simply larger — so the cost is a fixed
 * number of triangles per ring rather than anything proportional to the area covered.
 */
function ringsForHorizon(resolution: number, presetRings: number): number {
  const cellsPerSide = Math.max(16, Math.floor(resolution / 2) * 2);
  let rings = Math.max(1, presetRings);
  while ((cellsPerSide * BASE_CELL_SIZE * 2 ** (rings - 1)) / 2 < HORIZON_REACH_M) rings += 1;
  return rings;
}

function angleDelta(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

function createRefractionTarget(width: number, height: number): WebGLRenderTarget {
  return new WebGLRenderTarget(width, height, {
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
    generateMipmaps: false,
  });
}

/**
 * Build the merged clipmap geometry.
 *
 * Level 0 is a solid `resolution × resolution` block of `baseCell`-sized quads. Every level
 * after it doubles the cell size and drops its central quarter, which the finer level already
 * covers. Each vertex carries its level's cell size and half-extent so the vertex shader can
 * snap and morph without needing a draw call per level.
 */
function buildClipmap(resolution: number, levels: number, baseCell: number): BufferGeometry {
  const positions: number[] = [];
  const cellSizes: number[] = [];
  const ringExtents: number[] = [];
  const indices: number[] = [];

  const cellsPerSide = Math.max(16, Math.floor(resolution / 2) * 2);

  for (let level = 0; level < levels; level += 1) {
    const cell = baseCell * 2 ** level;
    const halfExtent = (cellsPerSide * cell) / 2;
    // Level 0 is solid; every other level is a ring whose hole is the previous level's extent.
    const holeHalfExtent = level === 0 ? 0 : halfExtent / 2;

    const vertexBase = positions.length / 3;
    const stride = cellsPerSide + 1;

    for (let iz = 0; iz <= cellsPerSide; iz += 1) {
      const z = -halfExtent + iz * cell;
      for (let ix = 0; ix <= cellsPerSide; ix += 1) {
        const x = -halfExtent + ix * cell;
        positions.push(x, 0, z);
        cellSizes.push(cell);
        ringExtents.push(halfExtent);
      }
    }

    for (let iz = 0; iz < cellsPerSide; iz += 1) {
      for (let ix = 0; ix < cellsPerSide; ix += 1) {
        const x0 = -halfExtent + ix * cell;
        const z0 = -halfExtent + iz * cell;
        const x1 = x0 + cell;
        const z1 = z0 + cell;
        // Drop quads entirely inside the hole. The comparison uses the quad's *inner* corner
        // so the ring's innermost row of quads is kept and its edge lands exactly on the
        // finer level's outer edge.
        if (
          holeHalfExtent > 0 &&
          Math.max(Math.abs(x0), Math.abs(x1)) <= holeHalfExtent &&
          Math.max(Math.abs(z0), Math.abs(z1)) <= holeHalfExtent
        ) {
          continue;
        }

        const a = vertexBase + iz * stride + ix;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('aCellSize', new BufferAttribute(new Float32Array(cellSizes), 1));
  geometry.setAttribute('aRingExtent', new BufferAttribute(new Float32Array(ringExtents), 1));
  geometry.setIndex(indices);
  // Frustum culling is off for this mesh — it is always centred on the camera and always
  // visible — so an accurate bounding volume would be computed and then never used.
  geometry.boundingSphere = null;
  return geometry;
}

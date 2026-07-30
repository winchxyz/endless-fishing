import {
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  Color,
  CustomBlending,
  DataTexture,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  Mesh,
  NoColorSpace,
  OneFactor,
  RGBAFormat,
  RedFormat,
  RepeatWrapping,
  ShaderMaterial,
  SrcAlphaFactor,
  UnsignedByteType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  ZeroFactor,
  type Camera,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';
import type { Engine, System } from '../core/Engine.js';
import { FullScreenPass } from '../render/FullScreenPass.js';
import { SKY_LAYER } from '../render/EnvironmentProbe.js';
import { PRNG } from '../math/PRNG.js';
import { clamp, damp, lerp, smoothstep } from '../math/Noise.js';
import type { Sky } from './Sky.js';
import type { Weather } from './Weather.js';
import cloudsVert from '../shaders/clouds/clouds.vert';
import cloudsFrag from '../shaders/clouds/clouds.frag';
import cloudShadowFrag from '../shaders/clouds/cloudshadow.frag';

/**
 * The cloud layer, and the shadows it throws on the water.
 *
 * Four programs out of three shader files, arranged so that the expensive one runs as few times
 * as it can get away with:
 *
 *   * the **march**, once per frame into a buffer at `settings.graphics.cloudScale`, from the
 *     main camera. This is the whole cost of the system and the reason the buffer exists;
 *   * the **resolve**, a scene-resident triangle on the default layer that reads that buffer
 *     back at full resolution and blends it under everything solid;
 *   * the **probe march**, a second scene-resident triangle on `SKY_LAYER` only, at a third of
 *     the steps. The environment probe renders that layer alone, so this is what puts the clouds
 *     into the image-based lighting — and therefore into the reflection on the water, which is
 *     where a cloud layer that stops at the horizon gives itself away;
 *   * the **shadow mask**, a top-down transmittance map marched from the sea up towards the sun.
 *
 * The three noise volumes are generated here rather than downloaded. A cloud volume has to tile
 * exactly in all three axes or the deck shows a seam every few kilometres, and no photographic
 * source can do that. They cost a fraction of a second at boot and nothing afterwards.
 */

// --- volume layout ----------------------------------------------------------------------------

/** Edge of the shape volume, packed as an 8x8 grid of slices into a 512x512 texture. */
const SHAPE_SIZE = 64;
const SHAPE_TILES_X = 8;
const SHAPE_TILES_Y = 8;
/** Edge of the erosion volume, packed as an 8x4 grid into 256x128. */
const DETAIL_SIZE = 32;
const DETAIL_TILES_X = 8;
const DETAIL_TILES_Y = 4;
const BLUE_NOISE_SIZE = 64;

/** Half-width of the square of sea the shadow mask covers, metres. */
const SHADOW_EXTENT_M = 2200;

/** Cloud drift relative to the surface wind. The deck runs faster than the sea does. */
const WIND_ALOFT_FACTOR = 1.6;

const SUNLIGHT_WARM = new Color(1.0, 0.62, 0.36);
const SUNLIGHT_NOON = new Color(1.0, 0.96, 0.92);
const MOONLIGHT_COLOUR = new Color(0.72, 0.8, 1.0);

/**
 * Three cloud archetypes, blended by the weather state rather than switched between.
 *
 * The numbers are from the sky rather than from taste: fair-weather cumulus have their bases
 * near a kilometre and tops around two, a stratus deck sits low and thin, and a mature
 * cumulonimbus runs from under a kilometre to the tropopause. The extinction figures put the
 * optical depth of each through its own thickness at roughly 15, 25 and 60, which is why you can
 * see the sun through the edge of a cumulus and not through the middle of a storm cell.
 */
interface CloudProfile {
  baseM: number;
  topM: number;
  convection: number;
  anvil: number;
  /** Extinction per metre at unit density. */
  density: number;
  erosion: number;
  shapeScaleM: number;
}

const CUMULUS: CloudProfile = { baseM: 950, topM: 2350, convection: 0.78, anvil: 0, density: 0.055, erosion: 0.28, shapeScaleM: 4200 };
const STRATUS: CloudProfile = { baseM: 380, topM: 1050, convection: 0.04, anvil: 0, density: 0.042, erosion: 0.1, shapeScaleM: 7200 };
const CUMULONIMBUS: CloudProfile = { baseM: 720, topM: 8600, convection: 1, anvil: 1, density: 0.085, erosion: 0.2, shapeScaleM: 5400 };

export class Clouds implements System {
  readonly name = 'clouds';
  readonly priority = 2;

  private readonly geometry: BufferGeometry;
  private readonly uniforms: Record<string, { value: unknown }>;
  private readonly marchMaterial: ShaderMaterial;
  private readonly probeMaterial: ShaderMaterial;
  private readonly resolveMaterial: ShaderMaterial;
  private readonly shadowMaterial: ShaderMaterial;

  private readonly resolveMesh: Mesh;
  private readonly probeMesh: Mesh;
  private readonly pass = new FullScreenPass();

  private cloudTarget: WebGLRenderTarget;
  private shadowTarget: WebGLRenderTarget;
  private shadowValid = false;

  private readonly shapeNoise: DataTexture;
  private readonly detailNoise: DataTexture;
  private readonly blueNoise: DataTexture;

  private readonly shadowMatrixValue = new Matrix4();
  private readonly scratchSun = new Color();
  private readonly scene: Scene;

  /** Damped cloud geometry, so a change of state grows the deck rather than swapping it. */
  private readonly profile: CloudProfile = { ...CUMULUS };
  private cloudScale: number;
  private shadowResolution: number;
  private weather: Weather | undefined;
  private sky: Sky | undefined;

  constructor(engine: Engine) {
    const graphics = engine.settings.graphics;
    const seed = engine.settings.world.seed;
    this.cloudScale = graphics.cloudScale;
    this.shadowResolution = shadowResolutionFor(graphics.cloudScale);

    this.shapeNoise = engine.resources.track(createShapeVolume(seed ^ 0x5c10_0d5a));
    this.detailNoise = engine.resources.track(createDetailVolume(seed ^ 0x0e7a_1102));
    this.blueNoise = engine.resources.track(createBlueNoise(BLUE_NOISE_SIZE, (seed ^ 0x1b1e_0000) >>> 0));

    this.cloudTarget = createCloudTarget(1, 1);
    this.shadowTarget = createShadowTarget(this.shadowResolution);

    // One uniform object shared by all four materials. three looks every uniform up by name in
    // the compiled program and silently skips the ones a given program does not declare, so the
    // shared object is safe — and it means the per-frame update writes each value exactly once
    // instead of four times. The two view matrices are the exception: they are rewritten by the
    // probe mesh for each cube face and put back by `beforeRender` before the march.
    this.uniforms = {
      uInverseProjection: { value: new Matrix4() },
      uCameraWorld: { value: new Matrix4() },
      uCameraPosition: { value: new Vector3() },
      uShapeNoise: { value: this.shapeNoise },
      uShapeLayout: { value: new Vector3(SHAPE_TILES_X, SHAPE_TILES_Y, SHAPE_SIZE) },
      uShapeTexel: { value: new Vector2(1 / (SHAPE_SIZE * SHAPE_TILES_X), 1 / (SHAPE_SIZE * SHAPE_TILES_Y)) },
      uDetailNoise: { value: this.detailNoise },
      uDetailLayout: { value: new Vector3(DETAIL_TILES_X, DETAIL_TILES_Y, DETAIL_SIZE) },
      uDetailTexel: { value: new Vector2(1 / (DETAIL_SIZE * DETAIL_TILES_X), 1 / (DETAIL_SIZE * DETAIL_TILES_Y)) },
      uBlueNoise: { value: this.blueNoise },
      uBlueNoiseTexel: { value: new Vector2(1 / BLUE_NOISE_SIZE, 1 / BLUE_NOISE_SIZE) },

      uCloudBaseM: { value: CUMULUS.baseM },
      uCloudTopM: { value: CUMULUS.topM },
      uInvThickness: { value: 1 / (CUMULUS.topM - CUMULUS.baseM) },
      uCoverage: { value: 0.3 },
      uConvection: { value: CUMULUS.convection },
      uAnvil: { value: 0 },
      uDensityScale: { value: CUMULUS.density },
      uWindOffset: { value: new Vector2() },
      uShapeScaleM: { value: CUMULUS.shapeScaleM },
      uDetailScaleM: { value: 520 },
      uErosion: { value: CUMULUS.erosion },

      uSunDirection: { value: new Vector3(0, 1, 0) },
      uSunColour: { value: new Color(1, 1, 1) },
      uSunIrradiance: { value: 0 },
      uMoonDirection: { value: new Vector3(0, -1, 0) },
      uMoonColour: { value: MOONLIGHT_COLOUR.clone() },
      uMoonIrradiance: { value: 0 },
      uSkyViewLut: { value: null },
      uSkyIntensity: { value: 1 },
      uAltitudeKm: { value: 0.0022 },
      uVisibility: { value: 25000 },
      // 0.62 puts the forward lobe at about 100 000 cd/m² against a noon sun, which is what a
      // photograph of a backlit cumulus edge actually measures.
      uPhaseG: { value: 0.62 },
      uPowder: { value: 0.6 },
      uPrecipitation: { value: 0 },
      uLightningFlash: { value: 0 },
      uLightningPosition: { value: new Vector3() },

      uCloudBuffer: { value: this.cloudTarget.texture },
      uShadowCentre: { value: new Vector2() },
      uShadowExtent: { value: SHADOW_EXTENT_M },
      uShadowStrength: { value: 0 },
    };

    this.marchMaterial = this.createMaterial(cloudsFrag, {
      CLOUD_MARCH: '',
      CLOUD_STEPS: String(marchSteps(graphics.cloudSteps)),
      CLOUD_LIGHT_STEPS: String(lightSteps(graphics.cloudSteps)),
      CLOUD_SCATTER_OCTAVES: '3',
    });
    this.probeMaterial = this.createMaterial(cloudsFrag, {
      CLOUD_MARCH: '',
      CLOUD_STEPS: String(probeSteps(graphics.cloudSteps)),
      CLOUD_LIGHT_STEPS: '3',
      CLOUD_SCATTER_OCTAVES: '2',
    });
    this.resolveMaterial = this.createMaterial(cloudsFrag, { CLOUD_RESOLVE: '' });
    this.shadowMaterial = this.createMaterial(cloudShadowFrag, {
      CLOUD_SHADOW_STEPS: String(shadowSteps(graphics.cloudSteps)),
    });

    // Additive over a background the cloud's own transmittance has already attenuated. The
    // material is *not* `transparent`, so it stays in the opaque queue and is sorted by
    // renderOrder — a transparent material would be drawn after the ocean and the boat, and the
    // clouds would end up in front of them.
    for (const material of [this.resolveMaterial, this.probeMaterial]) {
      material.blending = CustomBlending;
      material.blendSrc = OneFactor;
      material.blendDst = SrcAlphaFactor;
      material.blendSrcAlpha = ZeroFactor;
      material.blendDstAlpha = SrcAlphaFactor;
    }

    this.geometry = clipSpaceTriangle();
    this.resolveMesh = new Mesh(this.geometry, this.resolveMaterial);
    this.resolveMesh.frustumCulled = false;
    this.resolveMesh.renderOrder = -999;

    this.probeMesh = new Mesh(this.geometry, this.probeMaterial);
    this.probeMesh.frustumCulled = false;
    this.probeMesh.renderOrder = -999;
    // Layer 1 *only*, so the main camera never pays for the march twice.
    this.probeMesh.layers.set(SKY_LAYER);
    this.probeMesh.onBeforeRender = (
      _renderer: WebGLRenderer,
      _scene: Scene,
      camera: Camera,
    ): void => {
      this.pushCamera(camera);
    };

    this.scene = engine.scene;
    this.scene.add(this.resolveMesh, this.probeMesh);
  }

  /**
   * Sun transmittance over the sea around the camera, single channel. Null until the first
   * frame has been rendered. The ocean multiplies its direct sun term by this and nothing else.
   */
  get shadowTexture(): Texture | null {
    return this.shadowValid ? this.shadowTarget.texture : null;
  }

  /** World position to shadow-mask UV. `(matrix * vec4(worldPos, 1)).xy` is the lookup. */
  get shadowMatrix(): Matrix4 {
    return this.shadowMatrixValue;
  }

  update(dt: number, engine: Engine): void {
    const world = engine.world;
    const uniforms = this.uniforms;
    this.weather ??= engine.get<Weather>('weather');
    this.sky ??= engine.get<Sky>('sky');

    // Drift. The offset moves *against* the wind because it is added to the sample position: a
    // feature the field put at P is found at P − offset once the offset grows, which is the
    // cloud moving downwind. One shared wind vector, the same one the sea and the flag use.
    const step = Math.min(dt, 0.1) * WIND_ALOFT_FACTOR;
    const offset = uniforms['uWindOffset']?.value;
    if (offset instanceof Vector2) {
      offset.x -= world.windX * step;
      offset.y -= world.windZ * step;
    }

    this.updateProfile(dt, world.cloudiness, this.weather?.instability ?? 0);

    setNumber(uniforms, 'uCoverage', world.cloudiness);
    setNumber(uniforms, 'uVisibility', world.visibility);
    setNumber(uniforms, 'uPrecipitation', world.precipitation);
    setNumber(uniforms, 'uCloudBaseM', this.profile.baseM);
    setNumber(uniforms, 'uCloudTopM', this.profile.topM);
    setNumber(uniforms, 'uInvThickness', 1 / Math.max(50, this.profile.topM - this.profile.baseM));
    setNumber(uniforms, 'uConvection', this.profile.convection);
    setNumber(uniforms, 'uAnvil', this.profile.anvil);
    setNumber(uniforms, 'uDensityScale', this.profile.density);
    setNumber(uniforms, 'uErosion', this.profile.erosion);
    setNumber(uniforms, 'uShapeScaleM', this.profile.shapeScaleM);

    this.updateLighting(engine);
    this.updateLightning();
  }

  /**
   * Both marches and the shadow mask run here rather than in `update`, because both of them draw
   * into their own targets and doing that from inside `update` would capture a scene that only
   * half the systems have finished writing to.
   */
  beforeRender(engine: Engine): void {
    const width = Math.max(2, Math.round(engine.width * engine.pixelRatio * this.cloudScale));
    const height = Math.max(2, Math.round(engine.height * engine.pixelRatio * this.cloudScale));
    if (this.cloudTarget.width !== width || this.cloudTarget.height !== height) {
      this.cloudTarget.setSize(width, height);
    }

    this.pushCamera(engine.camera);
    this.pass.render(engine.renderer, this.marchMaterial, this.cloudTarget);

    this.renderShadowMask(engine);
  }

  onSettingsChanged(engine: Engine): void {
    const graphics = engine.settings.graphics;
    this.cloudScale = graphics.cloudScale;

    // Step counts are compile-time constants, not uniforms: GLSL ES 1.00 wants a constant loop
    // bound, and a program per quality level is exactly the trade CLAUDE.md asks for — the
    // compile is paid once when the setting changes rather than as a branch on every fragment.
    setDefine(this.marchMaterial, 'CLOUD_STEPS', marchSteps(graphics.cloudSteps));
    setDefine(this.marchMaterial, 'CLOUD_LIGHT_STEPS', lightSteps(graphics.cloudSteps));
    setDefine(this.probeMaterial, 'CLOUD_STEPS', probeSteps(graphics.cloudSteps));
    setDefine(this.shadowMaterial, 'CLOUD_SHADOW_STEPS', shadowSteps(graphics.cloudSteps));

    const resolution = shadowResolutionFor(graphics.cloudScale);
    if (resolution !== this.shadowResolution) {
      this.shadowResolution = resolution;
      this.shadowTarget.setSize(resolution, resolution);
      this.shadowValid = false;
    }
  }

  dispose(): void {
    this.scene.remove(this.resolveMesh, this.probeMesh);
    this.geometry.dispose();
    this.marchMaterial.dispose();
    this.probeMaterial.dispose();
    this.resolveMaterial.dispose();
    this.shadowMaterial.dispose();
    this.cloudTarget.dispose();
    this.shadowTarget.dispose();
    this.pass.dispose();
    // The three volumes are on the ResourceManager's ledger, which disposes them with the rest.
  }

  private createMaterial(fragment: string, defines: Record<string, string>): ShaderMaterial {
    return new ShaderMaterial({
      vertexShader: cloudsVert,
      fragmentShader: fragment,
      uniforms: this.uniforms,
      defines,
      depthTest: false,
      depthWrite: false,
      transparent: false,
      // The clip-space triangle has no meaningful winding, so culling would drop it at random.
      side: 2,
    });
  }

  /** Push a camera's matrices into the shared uniforms. Called per cube face and per frame. */
  private pushCamera(camera: Camera): void {
    const inverse = this.uniforms['uInverseProjection']?.value;
    if (inverse instanceof Matrix4) inverse.copy(camera.projectionMatrix).invert();
    const world = this.uniforms['uCameraWorld']?.value;
    if (world instanceof Matrix4) world.copy(camera.matrixWorld);
    const position = this.uniforms['uCameraPosition']?.value;
    if (position instanceof Vector3) position.setFromMatrixPosition(camera.matrixWorld);
  }

  /**
   * Blend the three archetypes and ease the deck towards the result.
   *
   * Instability decides how much of the sky is doing something vertical, and cloud fraction
   * decides between a broken field of cumulus and a closed stratus deck. Damping the geometry
   * rather than the weights means the base can only ever descend and the tops climb at a few
   * metres a second, which is roughly what they really do and is certainly what stops a deck
   * from teleporting when the classification changes its mind.
   */
  private updateProfile(dt: number, cloudiness: number, instability: number): void {
    const storm = smoothstep(0.45, 0.8, instability);
    const flat = (1 - storm) * smoothstep(0.55, 0.92, cloudiness) * (1 - smoothstep(0.15, 0.45, instability));
    const fair = Math.max(0, 1 - storm - flat);

    const rate = 0.06;
    const step = Math.min(dt, 0.1);
    this.profile.baseM = damp(this.profile.baseM, mix3(fair, flat, storm, 'baseM'), rate, step);
    this.profile.topM = damp(this.profile.topM, mix3(fair, flat, storm, 'topM'), rate, step);
    this.profile.convection = damp(this.profile.convection, mix3(fair, flat, storm, 'convection'), rate, step);
    this.profile.anvil = damp(this.profile.anvil, mix3(fair, flat, storm, 'anvil'), rate, step);
    this.profile.density = damp(this.profile.density, mix3(fair, flat, storm, 'density'), rate, step);
    this.profile.erosion = damp(this.profile.erosion, mix3(fair, flat, storm, 'erosion'), rate, step);
    this.profile.shapeScaleM = damp(this.profile.shapeScaleM, mix3(fair, flat, storm, 'shapeScaleM'), rate, step);
  }

  private updateLighting(engine: Engine): void {
    const uniforms = this.uniforms;
    const ephemeris = engine.world.ephemeris;

    const sky = this.sky;
    if (sky !== undefined) {
      const lut = uniforms['uSkyViewLut'];
      if (lut !== undefined) lut.value = sky.atmosphere.skyViewLut;
      setNumber(uniforms, 'uSkyIntensity', sky.skyIntensity);
    }
    if (ephemeris === null) return;

    const sun = uniforms['uSunDirection']?.value;
    if (sun instanceof Vector3) {
      sun.set(
        ephemeris.sunDirectionRefracted.x,
        ephemeris.sunDirectionRefracted.y,
        ephemeris.sunDirectionRefracted.z,
      );
    }
    const moon = uniforms['uMoonDirection']?.value;
    if (moon instanceof Vector3) {
      moon.set(ephemeris.moonDirection.x, ephemeris.moonDirection.y, ephemeris.moonDirection.z);
    }

    // The same warming ramp the sky's light rig uses, and for the same reason: it is Rayleigh
    // extinction along the beam, not a colour choice. Clouds catching a low sun go orange
    // because the light reaching them is orange.
    const warmth = 1 - smoothstep(0, 18, ephemeris.sunAltitudeDeg);
    this.scratchSun.copy(SUNLIGHT_NOON).lerp(SUNLIGHT_WARM, warmth * warmth);
    const sunColour = uniforms['uSunColour']?.value;
    if (sunColour instanceof Color) sunColour.copy(this.scratchSun);

    // Irradiance in lux, not divided by π: the phase function carries the normalisation, so the
    // sunlit face of a cumulus lands near 10 000 cd/m² and its backlit edge near 100 000, which
    // is the ratio a light meter reads off a real one.
    setNumber(uniforms, 'uSunIrradiance', ephemeris.sunIlluminanceLux);
    setNumber(uniforms, 'uMoonIrradiance', ephemeris.moonIlluminanceLux);
  }

  private updateLightning(): void {
    const weather = this.weather;
    const flash = weather?.lightningFlash ?? 0;
    setNumber(this.uniforms, 'uLightningFlash', flash);
    const strike = weather?.lastStrike;
    const position = this.uniforms['uLightningPosition']?.value;
    if (flash > 0 && strike !== undefined && position instanceof Vector3) {
      position.set(strike.x, this.profile.baseM + 200, strike.z);
    }
  }

  /**
   * Render the shadow mask, centred on the camera and snapped to its own texel grid.
   *
   * The snap is not an optimisation. Without it the mask's world origin moves by a fraction of a
   * texel every frame, every texel resamples slightly differently, and the shadows crawl across
   * the water with a shimmer that is far more distracting than the shadows are worth.
   */
  private renderShadowMask(engine: Engine): void {
    const uniforms = this.uniforms;
    const sun = uniforms['uSunDirection']?.value;
    const sunHeight = sun instanceof Vector3 ? sun.y : 0;
    const strength = smoothstep(0.02, 0.1, sunHeight) * smoothstep(0.02, 0.16, engine.world.cloudiness);
    setNumber(uniforms, 'uShadowStrength', strength);

    const texel = (SHADOW_EXTENT_M * 2) / this.shadowResolution;
    const centreX = Math.round(engine.camera.position.x / texel) * texel;
    const centreZ = Math.round(engine.camera.position.z / texel) * texel;
    const centre = uniforms['uShadowCentre']?.value;
    if (centre instanceof Vector2) centre.set(centreX, centreZ);

    // World -> UV. Row 0 takes X to u and row 1 takes Z to v; the mask is axis-aligned, so this
    // is a scale and an offset and nothing else.
    const span = SHADOW_EXTENT_M * 2;
    this.shadowMatrixValue.set(
      1 / span, 0, 0, 0.5 - centreX / span,
      0, 0, 1 / span, 0.5 - centreZ / span,
      0, 0, 0, 0,
      0, 0, 0, 1,
    );

    this.pass.render(engine.renderer, this.shadowMaterial, this.shadowTarget);
    this.shadowValid = true;
  }
}

function mix3(fair: number, flat: number, storm: number, key: keyof CloudProfile): number {
  return CUMULUS[key] * fair + STRATUS[key] * flat + CUMULONIMBUS[key] * storm;
}

function setNumber(uniforms: Record<string, { value: unknown } | undefined>, name: string, value: number): void {
  const uniform = uniforms[name];
  if (uniform !== undefined) uniform.value = value;
}

function setDefine(material: ShaderMaterial, name: string, value: number): void {
  const defines = material.defines;
  if (defines === undefined) return;
  const next = String(value);
  if (defines[name] === next) return;
  defines[name] = next;
  material.needsUpdate = true;
}

/** Steps for the main march. The first thing the degradation ladder cuts, and it shows. */
function marchSteps(cloudSteps: number): number {
  return Math.max(8, Math.min(96, Math.round(cloudSteps)));
}

function lightSteps(cloudSteps: number): number {
  return cloudSteps >= 40 ? 6 : cloudSteps >= 24 ? 5 : 4;
}

/** The probe is 128² at most and refreshed a face at a time, so it can be much cheaper. */
function probeSteps(cloudSteps: number): number {
  return Math.max(8, Math.round(cloudSteps / 3));
}

function shadowSteps(cloudSteps: number): number {
  return cloudSteps >= 40 ? 16 : cloudSteps >= 24 ? 12 : 8;
}

function shadowResolutionFor(cloudScale: number): number {
  return Math.max(256, Math.min(2048, Math.round(2048 * cloudScale)));
}

function createCloudTarget(width: number, height: number): WebGLRenderTarget {
  return new WebGLRenderTarget(width, height, {
    // Half float because the buffer carries physical radiance — a backlit cloud edge is six
    // figures of cd/m², and an 8-bit target would band the sky into terraces.
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
    colorSpace: NoColorSpace,
  });
}

function createShadowTarget(resolution: number): WebGLRenderTarget {
  const target = new WebGLRenderTarget(resolution, resolution, {
    format: RedFormat,
    type: UnsignedByteType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
    colorSpace: NoColorSpace,
  });
  // Clamped, so a sample from outside the covered square reads the edge rather than wrapping a
  // shadow from four kilometres away onto the far side of the boat.
  target.texture.wrapS = ClampToEdgeWrapping;
  target.texture.wrapT = ClampToEdgeWrapping;
  return target;
}

/** A single triangle covering clip space, with the UVs the cloud vertex shader reads. */
function clipSpaceTriangle(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
  );
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  geometry.boundingSphere = null;
  return geometry;
}

// --- the noise volumes ------------------------------------------------------------------------
//
// Everything below has to be *exactly periodic in all three axes*, because the volumes are tiled
// through the deck every few kilometres and a seam in a cloud layer is visible from the far side
// of the map. That rules out the project's simplex generator, which does not tile, so both the
// value noise and the Worley cells here wrap their integer lattice coordinates at the period.
//
// The packing is a 2D atlas of slices rather than a 3D texture: WebGL2 has 3D textures but only
// through GLSL ES 3.00, and this shader tree is written against three's ESSL 1.00 path.

/** Integer lattice hash, wrapped at `period`, so the field it drives is genuinely periodic. */
function latticeHash(ix: number, iy: number, iz: number, period: number, seed: number): number {
  const x = ((ix % period) + period) % period;
  const y = ((iy % period) + period) % period;
  const z = ((iz % period) + period) % period;
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1103515245) + seed) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smootherstep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Periodic value noise in [0, 1], tiling exactly at `period` lattice cells. */
function periodicValue3(x: number, y: number, z: number, period: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = smootherstep(x - ix);
  const fy = smootherstep(y - iy);
  const fz = smootherstep(z - iz);

  const c000 = latticeHash(ix, iy, iz, period, seed);
  const c100 = latticeHash(ix + 1, iy, iz, period, seed);
  const c010 = latticeHash(ix, iy + 1, iz, period, seed);
  const c110 = latticeHash(ix + 1, iy + 1, iz, period, seed);
  const c001 = latticeHash(ix, iy, iz + 1, period, seed);
  const c101 = latticeHash(ix + 1, iy, iz + 1, period, seed);
  const c011 = latticeHash(ix, iy + 1, iz + 1, period, seed);
  const c111 = latticeHash(ix + 1, iy + 1, iz + 1, period, seed);

  const x00 = c000 + (c100 - c000) * fx;
  const x10 = c010 + (c110 - c010) * fx;
  const x01 = c001 + (c101 - c001) * fx;
  const x11 = c011 + (c111 - c011) * fx;
  const y0 = x00 + (x10 - x00) * fy;
  const y1 = x01 + (x11 - x01) * fy;
  return y0 + (y1 - y0) * fz;
}

function periodicFbm3(
  x: number,
  y: number,
  z: number,
  basePeriod: number,
  octaves: number,
  seed: number,
): number {
  let sum = 0;
  let norm = 0;
  let amplitude = 1;
  let frequency = 1;
  for (let i = 0; i < octaves; i += 1) {
    sum += amplitude * periodicValue3(x * frequency, y * frequency, z * frequency, basePeriod * frequency, seed + i * 131);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return norm === 0 ? 0 : sum / norm;
}

/**
 * Periodic Worley (cellular) field over a `size³` volume, in [0, 1] with 1 at a feature point.
 *
 * Worley rather than more fBm because cloud billows are round and packed, and that is exactly
 * what a distance-to-nearest-point field looks like when you invert it. Plain fBm gives soft
 * lumps that read as smoke; Worley is what makes a cumulus look like it is made of cauliflower.
 */
function worleyField(size: number, frequency: number, seed: number): Float32Array {
  const cells = frequency * frequency * frequency;
  const points = new Float32Array(cells * 3);
  const random = new PRNG(seed);
  for (let i = 0; i < cells; i += 1) {
    points[i * 3] = random.next();
    points[i * 3 + 1] = random.next();
    points[i * 3 + 2] = random.next();
  }

  const field = new Float32Array(size * size * size);
  const scale = frequency / size;
  for (let z = 0; z < size; z += 1) {
    const fz = (z + 0.5) * scale;
    const iz = Math.floor(fz);
    for (let y = 0; y < size; y += 1) {
      const fy = (y + 0.5) * scale;
      const iy = Math.floor(fy);
      for (let x = 0; x < size; x += 1) {
        const fx = (x + 0.5) * scale;
        const ix = Math.floor(fx);
        let nearest = 4;
        for (let dz = -1; dz <= 1; dz += 1) {
          const cz = ((iz + dz) % frequency + frequency) % frequency;
          for (let dy = -1; dy <= 1; dy += 1) {
            const cy = ((iy + dy) % frequency + frequency) % frequency;
            for (let dx = -1; dx <= 1; dx += 1) {
              const cx = ((ix + dx) % frequency + frequency) % frequency;
              const base = ((cz * frequency + cy) * frequency + cx) * 3;
              // The cell index wraps but the *position* does not, which is what makes the
              // field periodic without folding the distances back on themselves.
              const px = ix + dx + (points[base] ?? 0);
              const py = iy + dy + (points[base + 1] ?? 0);
              const pz = iz + dz + (points[base + 2] ?? 0);
              const ex = px - fx;
              const ey = py - fy;
              const ez = pz - fz;
              const d = ex * ex + ey * ey + ez * ez;
              if (d < nearest) nearest = d;
            }
          }
        }
        field[(z * size + y) * size + x] = 1 - Math.min(1, Math.sqrt(nearest));
      }
    }
  }
  return field;
}

/** Write a `size³` volume into an atlas of slices and hand back a texture. */
function packVolume(
  size: number,
  tilesX: number,
  tilesY: number,
  fill: (index: number, channel: Uint8Array, offset: number) => void,
): DataTexture {
  const width = size * tilesX;
  const height = size * tilesY;
  const data = new Uint8Array(width * height * 4);
  for (let z = 0; z < size; z += 1) {
    const tileX = (z % tilesX) * size;
    const tileY = Math.floor(z / tilesX) * size;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const source = (z * size + y) * size + x;
        const destination = ((tileY + y) * width + tileX + x) * 4;
        fill(source, data, destination);
      }
    }
  }
  const texture = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function toByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(clamp(value, 0, 1) * 255)));
}

/**
 * The base shape volume.
 *
 * R is Perlin-Worley; G, B and A are Worley at three doubling frequencies, which the shader
 * combines into the threshold that carves the base back into individual clouds. Both fields are
 * stretched to their own extremes before packing, for the reason given on `stretch`.
 */
function createShapeVolume(seed: number): DataTexture {
  const size = SHAPE_SIZE;
  const worley4 = worleyField(size, 4, seed);
  const worley8 = worleyField(size, 8, seed + 1);
  const worley16 = worleyField(size, 16, seed + 2);

  const voxels = size * size * size;
  const perlin = new Float32Array(voxels);
  for (let z = 0; z < size; z += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        perlin[(z * size + y) * size + x] =
          periodicFbm3((x / size) * 4, (y / size) * 4, (z / size) * 4, 4, 4, seed + 3);
      }
    }
  }
  stretch(perlin);

  // Perlin-Worley: the value field pulled up towards the Worley one, which gives a base that is
  // billowy where the cells are and connected where they are not.
  const shape = new Float32Array(voxels);
  for (let i = 0; i < voxels; i += 1) {
    const worleyFbm = (worley4[i] ?? 0) * 0.625 + (worley8[i] ?? 0) * 0.25 + (worley16[i] ?? 0) * 0.125;
    shape[i] = lerp(worleyFbm, 1, perlin[i] ?? 0);
  }
  stretch(shape);

  return packVolume(size, SHAPE_TILES_X, SHAPE_TILES_Y, (index, data, offset) => {
    data[offset] = toByte(shape[index] ?? 0);
    data[offset + 1] = toByte(worley4[index] ?? 0);
    data[offset + 2] = toByte(worley8[index] ?? 0);
    data[offset + 3] = toByte(worley16[index] ?? 0);
  });
}

/**
 * Rescale a field to its own extremes, in place.
 *
 * Summed octaves pile up around their mean — four of them span barely a third of [0, 1] — and
 * the base-shape remap in the shader then has almost nothing to work with, which turns the deck
 * into a slab with soft edges instead of a field of separate clouds. The volume is finite, so
 * this is exact rather than an estimate: there is nothing to sample that is not in these two
 * numbers.
 */
function stretch(field: Float32Array): void {
  let lowest = Number.POSITIVE_INFINITY;
  let highest = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < field.length; i += 1) {
    const value = field[i] ?? 0;
    if (value < lowest) lowest = value;
    if (value > highest) highest = value;
  }
  const span = Math.max(1e-4, highest - lowest);
  for (let i = 0; i < field.length; i += 1) {
    field[i] = ((field[i] ?? 0) - lowest) / span;
  }
}

/** The erosion volume: three Worley frequencies, no base channel. */
function createDetailVolume(seed: number): DataTexture {
  const size = DETAIL_SIZE;
  const worley4 = worleyField(size, 4, seed);
  const worley8 = worleyField(size, 8, seed + 1);
  const worley16 = worleyField(size, 16, seed + 2);
  return packVolume(size, DETAIL_TILES_X, DETAIL_TILES_Y, (index, data, offset) => {
    data[offset] = toByte(worley4[index] ?? 0);
    data[offset + 1] = toByte(worley8[index] ?? 0);
    data[offset + 2] = toByte(worley16[index] ?? 0);
    data[offset + 3] = 255;
  });
}

/**
 * Blue noise by void-and-cluster (Ulichney, 1993).
 *
 * A white-noise dither leaves low-frequency blotches that survive every filter downstream and
 * show up as smears in the cloud. Blue noise puts all of its error above the frequencies the
 * upsample keeps, which is why the same number of march steps looks perhaps twice as clean. The
 * pattern is toroidal by construction, so tiling it across the frame is seamless.
 *
 * Two energy fields are kept rather than one: the ranking rule inverts halfway through, from
 * "the tightest cluster of ones" to "the tightest cluster of zeros", and tracking both makes
 * that a lookup instead of a second convolution.
 */
function createBlueNoise(size: number, seed: number): DataTexture {
  const count = size * size;
  const binary = new Uint8Array(count);
  const energyOnes = new Float64Array(count);
  const energyZeros = new Float64Array(count);
  const rank = new Int32Array(count);

  const radius = 5;
  const sigma = 1.9;
  const span = radius * 2 + 1;
  const kernel = new Float64Array(span * span);
  let kernelSum = 0;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const weight = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      kernel[(dy + radius) * span + dx + radius] = weight;
      kernelSum += weight;
    }
  }
  energyZeros.fill(kernelSum);

  const splat = (index: number, sign: number): void => {
    const px = index % size;
    const py = (index / size) | 0;
    for (let dy = -radius; dy <= radius; dy += 1) {
      const y = (py + dy + size) % size;
      for (let dx = -radius; dx <= radius; dx += 1) {
        const x = (px + dx + size) % size;
        const weight = (kernel[(dy + radius) * span + dx + radius] ?? 0) * sign;
        const target = y * size + x;
        energyOnes[target] = (energyOnes[target] ?? 0) + weight;
        energyZeros[target] = (energyZeros[target] ?? 0) - weight;
      }
    }
  };

  const set = (index: number, value: number): void => {
    if (binary[index] === value) return;
    binary[index] = value;
    splat(index, value === 1 ? 1 : -1);
  };

  /** Index of the largest void (`want` 0) or the tightest cluster (`want` 1). */
  const extreme = (want: number, field: Float64Array, maximise: boolean): number => {
    let bestIndex = -1;
    let best = maximise ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
    for (let i = 0; i < count; i += 1) {
      if (binary[i] !== want) continue;
      const value = field[i] ?? 0;
      if (maximise ? value > best : value < best) {
        best = value;
        bestIndex = i;
      }
    }
    return bestIndex;
  };

  const random = new PRNG(seed);
  const initial = Math.max(1, Math.round(count / 10));
  let placed = 0;
  while (placed < initial) {
    const index = random.int(0, count - 1);
    if (binary[index] === 1) continue;
    set(index, 1);
    placed += 1;
  }

  // Phase 0: shuffle the seed pattern until moving the tightest cluster into the largest void
  // no longer changes anything. This is what turns random points into evenly spaced ones.
  for (let guard = 0; guard < count * 4; guard += 1) {
    const cluster = extreme(1, energyOnes, true);
    if (cluster < 0) break;
    set(cluster, 0);
    const empty = extreme(0, energyOnes, false);
    if (empty < 0 || empty === cluster) {
      set(cluster, 1);
      break;
    }
    set(empty, 1);
  }

  const prototype = binary.slice();

  // Phase 1: rank the seed pattern from the inside out, removing the tightest cluster each time.
  for (let order = placed - 1; order >= 0; order -= 1) {
    const cluster = extreme(1, energyOnes, true);
    if (cluster < 0) break;
    set(cluster, 0);
    rank[cluster] = order;
  }

  // Phase 2: put the seed pattern back and keep filling the largest void.
  for (let i = 0; i < count; i += 1) set(i, prototype[i] ?? 0);
  const half = count >> 1;
  for (let order = placed; order < half; order += 1) {
    const empty = extreme(0, energyOnes, false);
    if (empty < 0) break;
    set(empty, 1);
    rank[empty] = order;
  }

  // Phase 3: past halfway the minority class is the zeros, so the rule inverts — fill the
  // tightest cluster of zeros rather than the largest void of ones.
  for (let order = half; order < count; order += 1) {
    const cluster = extreme(0, energyZeros, true);
    if (cluster < 0) break;
    set(cluster, 1);
    rank[cluster] = order;
  }

  const data = new Uint8Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    const value = Math.min(255, Math.round(((rank[i] ?? 0) / count) * 256));
    const offset = i * 4;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  // Repeat, because the dither is indexed by gl_FragCoord and has to tile across the frame.
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

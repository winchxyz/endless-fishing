import {
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  Color,
  type Material,
  Matrix4,
  Mesh,
  ShaderMaterial,
  Texture,
  Vector2,
  Vector3,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import type { Engine, System } from '../core/Engine.js';
import { SKY_LAYER, EnvironmentProbe } from '../render/EnvironmentProbe.js';
import { Atmosphere } from './Atmosphere.js';
import { SkyLibrary, type SkyEntry, type SkyWeatherFamily } from './SkyLibrary.js';
import { StarField } from './StarField.js';
import { computeEphemeris, dominantLightBlend, type EphemerisState } from '../astro/Ephemeris.js';
import { lunarIlluminanceLux } from '../astro/LunarPosition.js';
import { SOLAR_CONSTANT_LUX } from '../astro/SolarPosition.js';
import { horizonFlattening } from '../astro/Refraction.js';
import { damp, clamp, lerp as mix, smoothstep } from '../math/Noise.js';
import skyVert from '../shaders/sky/sky.vert';
import skyFrag from '../shaders/sky/sky.frag';

/**
 * The sky system: atmosphere, celestial bodies, star field, light rig and exposure.
 *
 * This is the system that turns the ephemeris into photons. Everything downstream — the
 * ocean's specular path, the boat's shading, the colour grade, when the navigation lights come
 * on, when the fish bite — reads the result rather than deciding for itself what time it is.
 *
 * Units are physical throughout: illuminance in lux, radiance in candela per square metre.
 * The sun is 100 000 lux at noon and the full moon is a quarter of a lux, a ratio of 400 000
 * to one, and the exposure controller is what makes both of them look right on a screen with
 * a contrast ratio of about a thousand.
 */

/** Colour temperature of moonlight as the eye reports it, not as a spectrometer does. */
const MOONLIGHT_COLOUR = new Color(0.72, 0.80, 1.0);
const SUNLIGHT_WARM = new Color(1.0, 0.62, 0.36);
const SUNLIGHT_NOON = new Color(1.0, 0.96, 0.92);

/**
 * Calibration for the lunar disc's surface radiance.
 *
 * The NASA albedo map is an sRGB image with a mean well above the Moon's true 0.12 geometric
 * albedo, and the Lommel-Seeliger term in the shader peaks around 0.5 rather than 1. This
 * constant folds both out so that a full moon at the zenith renders at roughly the measured
 * 4000 cd/m².
 */
const MOON_DISC_CALIBRATION = 5.6;

/** Metres of eye height above the sea, for horizon dip and the atmosphere's observer altitude. */
const DEFAULT_EYE_HEIGHT_M = 2.2;

/**
 * Frames between exposure meter readings.
 *
 * `readRenderTargetPixels` stalls the pipeline, so this is not something to do every frame —
 * but the sky changes over minutes and the adaptation is deliberately slow, so four readings a
 * second is far more than the eye can distinguish from continuous.
 */
const EXPOSURE_SAMPLE_INTERVAL = 15;

/**
 * Floor on the illuminance the exposure controller will adapt to, lux.
 *
 * A meter with unbounded gain renders every scene as mid-grey, which is right for a camera and
 * wrong for an eye: dark adaptation saturates. Below roughly the light of a moonless, starlit sky
 * there is no more gain to be had — you do not see a black sea as grey, you see it as black with
 * a few stars over it — and a controller that keeps opening up simply amplifies the airglow floor
 * until the whole frame is white. That is exactly what it did: a genuinely dark night metered to
 * an exposure of 8149 and rendered as a blank white image.
 *
 * The value is set so a moonless sky at its airglow radiance of about 1.8e-4 cd/m² lands around
 * 0.06 in linear display units — dark, but with a readable horizon and visible stars.
 */
const MIN_ADAPTED_ILLUMINANCE_LUX = 6e-3;

/**
 * Fraction of the beam a closed cloud deck passes down, diffused.
 *
 * A stratus sheet a few hundred metres thick transmits about a fifth of what falls on it — which
 * is why an overcast noon still meters around fifteen thousand lux rather than the couple of
 * hundred you would get if cloud simply switched the sun off.
 */
const DECK_TRANSMISSION = 0.18;

export class Sky implements System {
  readonly name = 'sky';
  readonly priority = 0;

  readonly atmosphere = new Atmosphere();
  readonly library: SkyLibrary;
  readonly stars: StarField;
  readonly probe: EnvironmentProbe;

  private readonly dome: Mesh;
  private readonly material: ShaderMaterial;
  private readonly csm: CSM;

  private readonly sunDirection = new Vector3(0, 1, 0);
  private readonly moonDirection = new Vector3(0, -1, 0);
  private readonly lightDirection = new Vector3(0, -1, 0);
  private readonly lightColour = new Color();
  private readonly moonSunDirection = new Vector3(0, 0, 1);
  private readonly libration = new Vector2();
  private readonly inverseProjection = new Matrix4();

  private weather: SkyWeatherFamily = 'partly-cloudy';
  private adaptedIlluminance = 10000;
  private measuredSkyIlluminance = 10000;
  /**
   * Luminance the sky shader adds on top of the scattering tables after dark, cd/m².
   *
   * Kept here because the exposure meter reads the sky-view table, and that table is built for
   * the sun alone: at night it is exactly zero, while the shader is drawing moonlight and airglow
   * over it. Without this the meter is blind to the only light in the frame.
   */
  private nightFloorLuminance = 0;
  private exposureSampleCountdown = 0;
  /** False until the first real measurement lands, so boot does not fade in from a guess. */
  private adaptationPrimed = false;

  private constructor(engine: Engine, library: SkyLibrary, stars: StarField) {
    this.library = library;
    this.stars = stars;

    this.material = new ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      uniforms: {
        uInverseProjection: { value: new Matrix4() },
        uCameraWorld: { value: new Matrix4() },
        uSkyViewLut: { value: this.atmosphere.skyViewLut },
        uTransmittanceLut: { value: this.atmosphere.transmittanceLut },
        uHdriA: { value: null },
        uHdriB: { value: null },
        uHdriBlend: { value: 0 },
        uHdriRotationA: { value: 0 },
        uHdriRotationB: { value: 0 },
        uHdriInvMeanA: { value: 1 },
        uHdriInvMeanB: { value: 1 },
        uHdriWeight: { value: 0 },
        uCloudiness: { value: 0.2 },
        uSunDirection: { value: new Vector3(0, 1, 0) },
        uMoonDirection: { value: new Vector3(0, -1, 0) },
        uSunAngularRadius: { value: 0.00465 },
        uMoonAngularRadius: { value: 0.00452 },
        uSunFlattening: { value: 1 },
        uSunRadiance: { value: new Vector3() },
        uMoonRadiance: { value: new Vector3() },
        uMoonAlbedo: { value: null },
        uMoonNormal: { value: null },
        uMoonSunDirection: { value: new Vector3(0, 0, 1) },
        uMoonNorthAngle: { value: 0 },
        uMoonLibration: { value: new Vector2() },
        uEarthshine: { value: 0 },
        uAltitudeKm: { value: DEFAULT_EYE_HEIGHT_M / 1000 },
        uSkyIntensity: { value: SOLAR_CONSTANT_LUX },
        uMoonSkyRadiance: { value: new Vector3() },
        uAirglowRadiance: { value: new Vector3() },
      },
      depthTest: false,
      depthWrite: false,
      // The dome is a clip-space triangle; culling would depend on a winding it does not have.
      side: 2,
    });

    this.dome = new Mesh(clipSpaceTriangle(), this.material);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -1000;
    this.dome.layers.enable(SKY_LAYER);
    this.dome.onBeforeRender = (
      _renderer: WebGLRenderer,
      _scene: Scene,
      camera: Camera,
    ): void => {
      // Runs for the main camera *and* for each of the probe's six cube faces, which is
      // exactly why the view ray is reconstructed here rather than pushed once per frame.
      const uniforms = this.material.uniforms;
      const inverse = uniforms['uInverseProjection'];
      const world = uniforms['uCameraWorld'];
      if (inverse !== undefined) {
        (inverse.value as Matrix4).copy(this.inverseProjection.copy(camera.projectionMatrix).invert());
      }
      if (world !== undefined) (world.value as Matrix4).copy(camera.matrixWorld);
    };

    // The Milky Way joins the probe; the star catalogue deliberately does not.
    //
    // A star is a point source with no angular size at all. In a 128-pixel cubemap face one star
    // occupies a whole texel — three quarters of a degree — which over-represents it by five
    // orders of magnitude, and the water then reflects that texel off every wave facet whose
    // normal happens to point at it. The result was a sea of blown white sparks on a moonless
    // night. Starlight contributes about a millionth of moonlight's illuminance, so dropping it
    // from the image-based lighting costs nothing measurable and removes the aliasing entirely.
    // The Milky Way is a smooth surface brightness rather than a point, so it stays.
    this.stars.milkyWay.layers.enable(SKY_LAYER);

    const graphics = engine.settings.graphics;
    this.csm = new CSM({
      maxFar: 1400,
      cascades: Math.max(1, graphics.shadowCascades),
      mode: 'practical',
      parent: engine.scene,
      shadowMapSize: graphics.shadowMapSize,
      lightDirection: this.lightDirection.clone(),
      camera: engine.camera,
      lightIntensity: 1,
      shadowBias: -0.0005,
    });
    this.csm.fade = true;

    this.probe = new EnvironmentProbe(engine.renderer, graphics.probeResolution);
  }

  static async create(engine: Engine): Promise<Sky> {
    const [library, stars] = await Promise.all([
      SkyLibrary.load(engine.resources),
      StarField.load(engine.resources),
    ]);
    const sky = new Sky(engine, library, stars);

    // Eagerly load the panoramas the current moment actually needs, so the first frame is
    // never drawn with a placeholder sky; the rest stream in behind the loading screen.
    const ephemeris = computeEphemeris(engine.time.epochMs, sky.location(engine));
    const selection = library.select(sky.weather, ephemeris.sunAltitudeDeg);
    await Promise.all([library.ensureLoaded(selection.a), library.ensureLoaded(selection.b)]);

    // The lunar maps wrap in longitude (the far limb is continuous) but must clamp in latitude,
    // or the pole texel bleeds round to the opposite pole and puts a bright seam on the limb.
    const [albedo, normal] = await Promise.all([
      engine.resources.loadTexture('processed/moon/albedo.webp', { srgb: true }),
      engine.resources.loadTexture('processed/moon/normal.webp', { srgb: false }),
    ]);
    albedo.wrapT = ClampToEdgeWrapping;
    normal.wrapT = ClampToEdgeWrapping;
    sky.setUniform('uMoonAlbedo', albedo);
    sky.setUniform('uMoonNormal', normal);

    engine.scene.add(sky.dome, sky.stars.milkyWay, sky.stars.points);
    return sky;
  }

  /**
   * Abandon the adapted exposure and re-meter from scratch on the next frame.
   *
   * Adaptation is deliberately slow — it models an eye, and an eye takes minutes to cross the
   * five decades between noon and a moonlit sea. That is right when time flows, and wrong when
   * time *jumps*: overriding the clock is a cut, not a sunset, and crawling towards the new
   * exposure means every screenshot of a night is a photograph of a black frame.
   */
  resetAdaptation(): void {
    this.exposureSampleCountdown = 0;
    this.adaptationPrimed = false;
  }

  /**
   * Luminance the shader adds to every sky direction after dark, cd/m².
   *
   * Read by the debug API so `photometry()` reports what is on screen rather than what is in the
   * table. A night sky that is plainly visible in the frame and reports a zenith luminance of
   * zero is instrumentation that lies, and it is what sent two sessions looking in the wrong
   * place for the blown-out night.
   */
  get nightFloor(): number {
    return this.nightFloorLuminance;
  }

  /** Scale from the atmosphere LUT's units to candela per square metre. */
  get skyIntensity(): number {
    const uniform = this.material.uniforms['uSkyIntensity'];
    return typeof uniform?.value === 'number' ? uniform.value : SOLAR_CONSTANT_LUX;
  }

  /**
   * Enrol a material in the cascaded shadow map.
   *
   * CSM puts one full-intensity `DirectionalLight` in the scene per cascade, and relies on
   * each material being patched to select the right one. A material that never registers is
   * lit by all of them at once — three or four times too bright on the High and Ultra presets,
   * which reads as a blown-out object rather than as a missing shadow, so it is easy to
   * misdiagnose. Every PBR material in the scene must come through here.
   */
  registerShadowMaterial(material: Material): void {
    this.csm.setupMaterial(material);
  }

  /** The weather family the sky library should draw from. Set by the weather system. */
  setWeather(family: SkyWeatherFamily): void {
    this.weather = family;
  }

  update(dt: number, engine: Engine): void {
    const world = engine.world;
    const location = this.location(engine);
    const conditions = {
      pressureMbar: world.pressureHpa,
      temperatureC: world.temperatureC,
    };

    const state = computeEphemeris(engine.time.epochMs, location, conditions);
    world.ephemeris = state;

    this.sunDirection.set(
      state.sunDirectionRefracted.x,
      state.sunDirectionRefracted.y,
      state.sunDirectionRefracted.z,
    );
    this.moonDirection.set(state.moonDirection.x, state.moonDirection.y, state.moonDirection.z);

    this.updateAtmosphere(engine, state);
    this.updateHdri(state, world.cloudiness);
    this.updateCelestialUniforms(state, conditions);
    this.updateLights(state, world.cloudiness);
    this.updateExposure(dt, engine, state, world);

    const nightFactor = 1 - smoothstep(-14, -3, state.sunAltitudeDeg);
    this.stars.update(state, engine.camera.position, engine.loop.elapsed, nightFactor);
    this.library.tick();

    this.csm.update();

    const probeChanged = this.probe.update(
      engine.renderer,
      engine.scene,
      engine.settings.graphics.probeFacesPerFrame,
    );
    if (probeChanged) {
      const texture = this.probe.texture;
      if (texture !== null) engine.scene.environment = texture;
    }
  }

  onSettingsChanged(engine: Engine): void {
    const graphics = engine.settings.graphics;
    this.probe.setResolution(engine.renderer, graphics.probeResolution);
    // Star sprite size scales with render height so the field looks the same at any resolution.
    const pixelScale = (engine.height * engine.pixelRatio) / 480;
    const magnitudeLimit = graphics.preset === 'low' ? 5.2 : graphics.preset === 'medium' ? 6.0 : 6.5;
    this.stars.configure(pixelScale, magnitudeLimit, 1);
  }

  resize(_width: number, height: number): void {
    this.stars.configure(height / 480, 6.5, 1);
    this.csm.updateFrustums();
  }

  dispose(): void {
    this.csm.dispose();
    this.probe.dispose();
    this.atmosphere.dispose();
    this.stars.dispose();
    this.library.dispose();
    this.material.dispose();
    this.dome.geometry.dispose();
    // The lunar textures are owned by the ResourceManager's ledger, not by us.
  }

  private location(engine: Engine): { latitudeDeg: number; longitudeDeg: number; elevationM: number } {
    return {
      latitudeDeg: engine.settings.world.latitudeDeg,
      longitudeDeg: engine.settings.world.longitudeDeg,
      elevationM: DEFAULT_EYE_HEIGHT_M,
    };
  }

  private updateAtmosphere(engine: Engine, state: EphemerisState): void {
    const rebuilt = this.atmosphere.update(
      engine.renderer,
      state.sunAltitudeDeg,
      DEFAULT_EYE_HEIGHT_M / 1000,
      Math.max(16, Math.round(engine.settings.graphics.cloudSteps * 0.6)),
    );
    if (rebuilt) this.probe.invalidate();
  }

  private updateHdri(state: EphemerisState, cloudiness: number): void {
    const selection = this.library.select(this.weather, state.sunAltitudeDeg);
    const textureA = this.library.texture(selection.a);
    const textureB = this.library.texture(selection.b);

    // Until a panorama is resident, fall back to whichever one is, and if neither is, drop the
    // structure weight to zero so the analytic sky simply shows through unmodulated. A missing
    // texture must never produce a black sky.
    const resolvedA = textureA ?? textureB ?? null;
    const resolvedB = textureB ?? textureA ?? null;

    this.setUniform('uHdriA', resolvedA);
    this.setUniform('uHdriB', resolvedB);
    this.setUniform('uHdriBlend', textureA === undefined ? 1 : textureB === undefined ? 0 : selection.blend);
    this.setUniform('uHdriRotationA', this.library.rotationFor(selection.a, state.sunAzimuthDeg));
    this.setUniform('uHdriRotationB', this.library.rotationFor(selection.b, state.sunAzimuthDeg));
    this.setUniform('uHdriInvMeanA', this.library.inverseMeanLuminance(selection.a));
    this.setUniform('uHdriInvMeanB', this.library.inverseMeanLuminance(selection.b));

    // How much cloud structure to overlay. Even a "clear" sky gets a little, because a real
    // clear sky is never perfectly smooth, but it rises steeply with cloud fraction.
    const available = resolvedA !== null ? 1 : 0;

    // Fade the panorama out through twilight.
    //
    // The night skies in the library were photographed at Qwantani in South Africa, and like
    // almost every real night photograph they carry a band of sodium light-pollution glow along
    // the horizon. Normalised and multiplied into the analytic sky at up to three times, that
    // band became a hard orange stripe across the horizon of an ocean a thousand miles from the
    // nearest town — someone else's streetlights, in our sky.
    //
    // This is also what the design always called for: after dark the sky is the analytic model,
    // the star catalogue and the Milky Way, with the panorama reduced to low-frequency ambient.
    const daylight = smoothstep(-8, 2, state.sunAltitudeDeg);
    const structureWeight = clamp(0.18 + cloudiness * 0.72, 0, 0.95) * mix(0.06, 1, daylight);
    this.setUniform('uHdriWeight', available * structureWeight);
    this.setUniform('uCloudiness', cloudiness);
  }

  private updateCelestialUniforms(
    state: EphemerisState,
    conditions: { pressureMbar: number; temperatureC: number },
  ): void {
    const sunUniform = this.material.uniforms['uSunDirection'];
    if (sunUniform !== undefined) (sunUniform.value as Vector3).copy(this.sunDirection);
    const moonUniform = this.material.uniforms['uMoonDirection'];
    if (moonUniform !== undefined) (moonUniform.value as Vector3).copy(this.moonDirection);

    this.setUniform('uSunAngularRadius', state.sun.angularRadius);
    this.setUniform('uMoonAngularRadius', state.moon.angularRadius);
    this.setUniform(
      'uSunFlattening',
      horizonFlattening(state.sun.horizontal.altitude, state.sun.angularRadius, conditions),
    );

    // Radiance of the solar disc: total irradiance spread over the disc's solid angle. The
    // extinction along the view ray is applied in the shader from the transmittance LUT, so
    // this is the top-of-atmosphere value scaled only by the Earth-Sun distance.
    const sunSolidAngle = Math.PI * state.sun.angularRadius * state.sun.angularRadius;
    const sunRadiance =
      SOLAR_CONSTANT_LUX / (state.sun.distanceAu * state.sun.distanceAu) / sunSolidAngle;
    this.setVectorUniform('uSunRadiance', sunRadiance, sunRadiance, sunRadiance);

    // The lunar disc's radiance must NOT include the phase: the shader produces the phase from
    // the sub-solar direction, and folding it in here as well would darken a crescent twice.
    // So this is evaluated as if the Moon were full, at its true distance and altitude.
    const fullMoonIlluminance = lunarIlluminanceLux(
      Math.max(0.01, state.moon.apparentAltitude),
      state.moon.distanceKm,
      0,
    );
    const moonSolidAngle = Math.PI * state.moon.angularRadius * state.moon.angularRadius;
    const moonRadiance = (fullMoonIlluminance / moonSolidAngle) * MOON_DISC_CALIBRATION;
    this.setVectorUniform('uMoonRadiance', moonRadiance, moonRadiance, moonRadiance);

    this.moonSunDirection.set(
      state.moon.sunDirection.x,
      state.moon.sunDirection.y,
      state.moon.sunDirection.z,
    );
    const moonSun = this.material.uniforms['uMoonSunDirection'];
    if (moonSun !== undefined) (moonSun.value as Vector3).copy(this.moonSunDirection);

    this.setUniform('uMoonNorthAngle', state.moon.northScreenAngle);
    this.libration.set(state.moon.librationLongitude, state.moon.librationLatitude);
    const librationUniform = this.material.uniforms['uMoonLibration'];
    if (librationUniform !== undefined) (librationUniform.value as Vector2).copy(this.libration);

    // Earthshine tracks how lit the Earth looks from the Moon, which is the complement of the
    // Moon's own phase — brightest under a thin crescent, exactly as photographs show.
    const earthPhase = 1 - state.moon.illuminatedFraction;
    this.setUniform('uEarthshine', moonRadiance * 0.014 * earthPhase * earthPhase);

    // Moonlight scattered by the atmosphere. Roughly 0.4% of the incident illuminance ends up
    // as sky radiance, which puts a full moon at the measured ~0.001 cd/m². Bluer than the
    // direct beam because Rayleigh scattering is, and because mesopic vision shifts blue.
    const moonSky = (state.moonIlluminanceLux * 0.004) / Math.PI;
    this.setVectorUniform('uMoonSkyRadiance', moonSky * 0.72, moonSky * 0.84, moonSky * 1.0);

    // Airglow and integrated starlight — the floor the sky never goes below, and the reason a
    // moonless sea still has a visible horizon. Fades out as soon as there is any real light.
    const airglow = 2.4e-4 * (1 - state.dayFactor);
    this.setVectorUniform('uAirglowRadiance', airglow * 0.62, airglow * 0.78, airglow * 1.0);

    // Hand the same floor to the exposure meter.
    //
    // The two terms above are added by the fragment shader on top of the sky-view table, and that
    // table is a function of the sun alone — after dark it is identically zero. So the meter,
    // which reads the table, sees a black sky while the shader is drawing a lit one, opens up
    // without limit, and renders midnight as a white frame. The factors are the hemispheric means
    // of the shader's own `upness` falloffs (0.45..1 for the moon term, 0.6..1 for airglow), and
    // the Rayleigh phase factor integrates to exactly one over the hemisphere, so it drops out.
    this.nightFloorLuminance =
      luminanceOfRgb(moonSky * 0.72, moonSky * 0.84, moonSky) * 0.85 +
      luminanceOfRgb(airglow * 0.62, airglow * 0.78, airglow) * 0.9;
  }

  private updateLights(state: EphemerisState, cloudiness: number): void {
    const moonWeight = dominantLightBlend(state);

    // Slerp the direction rather than switching. At handover both bodies are near the horizon
    // and contributing almost nothing, so the shadows swing round without anyone noticing —
    // whereas a hard swap would snap every shadow in the scene through ninety degrees.
    this.lightDirection
      .copy(this.sunDirection)
      .multiplyScalar(1 - moonWeight)
      .addScaledVector(this.moonDirection, moonWeight);
    if (this.lightDirection.lengthSq() < 1e-8) this.lightDirection.set(0, 1, 0);
    this.lightDirection.normalize().negate();

    // Warm the sunlight as it approaches the horizon. This is not a colour ramp for effect —
    // it is the same Rayleigh extinction the sky is using, sampled along the beam.
    const warmth = 1 - smoothstep(0, 18, state.sunAltitudeDeg);
    const sunColour = SUNLIGHT_NOON.clone().lerp(SUNLIGHT_WARM, warmth * warmth);
    this.lightColour.copy(sunColour).lerp(MOONLIGHT_COLOUR, moonWeight);

    // Cloud cover kills the directional component and hands the energy to the sky probe.
    const directBlocked = 1 - cloudiness * 0.92;
    const illuminance =
      (state.sunIlluminanceLux * (1 - moonWeight) + state.moonIlluminanceLux * moonWeight) *
      directBlocked;

    this.csm.lightDirection.copy(this.lightDirection);
    this.csm.lightIntensity = illuminance;
    for (const light of this.csm.lights) {
      light.color.copy(this.lightColour);
      light.intensity = illuminance;
      light.castShadow = illuminance > 40;
    }
  }

  private updateExposure(
    dt: number,
    engine: Engine,
    state: EphemerisState,
    world: {
      exposure: number;
      sceneIlluminanceLux: number;
      cloudiness: number;
      precipitation: number;
    },
  ): void {
    // Meter from the sky that was actually rendered, not from a model of it.
    //
    // The first version estimated skylight from solar altitude with an exponential fit. It was
    // right at noon and two stops out at civil dawn, because no closed form tracks what a
    // multiple-scattering atmosphere really does through twilight. Reading three texels out of
    // the sky-view table costs a pipeline flush a few times a second and is exact by
    // construction: whatever the atmosphere produces, the exposure follows it.
    //
    // Sampling the zenith, the horizon and a point between them approximates the hemisphere well
    // enough for metering. The weights lean towards the horizon, and that is a statement about
    // this scene rather than about the sky: nearly the whole frame is water, water at a grazing
    // angle is a mirror, and what it mirrors is the sky just above the horizon. Weighting the
    // zenith heavily — which is right for a landscape — over-exposed twilight by two stops,
    // because at twilight the horizon glow is many times the zenith and it is the horizon glow
    // that fills the frame.
    //
    // Each of the three is the mean of a whole *row*, which is a full turn of azimuth, and that
    // matters more than the weights do. The table's azimuth is measured from the sun, so the
    // single texels this used to read at u = 0.5 were all on the anti-solar meridian — the
    // darkest line in the sky. At twilight the western horizon runs an order of magnitude above
    // the eastern one, so the meter opened up for the dark half and pushed the bright half
    // through white: a civil twilight with no gradient left in it, the sky metering 1.53 where a
    // photographer would have put it near 0.7, and every colour in the frame washing towards the
    // magenta that ACES gives a clipped warm highlight. A row read is one flush, the same as one
    // texel, so the exact average is also the cheap answer.
    this.exposureSampleCountdown -= 1;
    if (this.exposureSampleCountdown <= 0) {
      this.exposureSampleCountdown = EXPOSURE_SAMPLE_INTERVAL;
      const scale = this.skyIntensity;
      const rowAt = (v: number): number =>
        this.atmosphere.meanSkyViewRowLuminance(engine.renderer, v) * scale;
      const skyLuminance = 0.28 * rowAt(1.0) + 0.32 * rowAt(0.75) + 0.4 * rowAt(0.53);
      // Radiance over the hemisphere back to illuminance on a horizontal surface. The night
      // floor is added here rather than sampled because it never enters the table at all.
      this.measuredSkyIlluminance = (skyLuminance + this.nightFloorLuminance) * Math.PI;
    }

    // Specular allowance.
    //
    // Metering on diffuse illuminance alone is right for a matte scene and badly wrong for
    // water. A full moon delivers about a quarter of a lux, which asks for an exposure around
    // 13 — and at that exposure the moon's glitter path, which is a near-mirror reflection of a
    // source hundreds of thousands of times brighter than the sky, blows out across a third of
    // the frame. A photographer metering the same scene would stop down for the highlight.
    //
    // So the meter is told about the specular the way an incident meter cannot be: the direct
    // beam counts for more than its diffuse worth, because a rough water surface returns far more
    // towards the eye in the glitter path than it scatters everywhere else.
    //
    // The allowance used to be five, which was compensating for a defect rather than describing
    // the scene: the specular lobe in `ocean.frag` was narrower than the half-degree source
    // lighting it, so the highlight carried the whole of the moon's energy in a fraction of the
    // solid angle it belongs in and blew out however far the meter stopped down. With the lobe
    // widened to the source's real angular size, five stops the frame down so far that a
    // moonlit sea renders black except for the path itself. One is an allowance; five was a
    // patch over the shading.
    const SPECULAR_GAIN = 1;
    const specular = (state.sunIlluminanceLux * 0.02 + state.moonIlluminanceLux) * SPECULAR_GAIN;

    // Cloud does not remove the light, it diffuses it — and the meter has to know the difference.
    //
    // The direct beam is what a deck blocks, and `WorldLighting` already docks every light in the
    // scene by the same `1 − 0.9·cover`. The meter did not, so under an overcast it went on
    // believing in twenty-six thousand lux of sunshine that was not reaching the water, stopped
    // down for it, and rendered a bright grey day as dusk. But simply removing the beam is just
    // as wrong: a stratus sheet passes roughly a fifth of what falls on it and re-emits it over
    // the whole sky, which is why an overcast noon still reads fifteen thousand lux on a real
    // meter. Both halves are here. Rain closes the deck further, which is what makes a squall
    // genuinely dark rather than merely grey.
    const cover = world.cloudiness;
    const beam = 1 - cover * 0.9;
    const transmitted = DECK_TRANSMISSION * (1 - world.precipitation * 0.7);
    const above = state.sunIlluminanceLux + state.moonIlluminanceLux;

    // The sky term is the whole of the night floor now that the meter can see it, so there is no
    // longer a constant standing in for it — only a guard against a divide by zero if every
    // source is somehow off at once.
    const total = Math.max(
      1e-9,
      above * beam * 0.35 +
        above * cover * transmitted +
        specular * beam +
        this.measuredSkyIlluminance * (1 - cover * 0.85),
    );

    // Adaptation is deliberately slow, and slower going dark than going bright — which is how
    // eyes behave, and which stops a cloud crossing the sun from pumping the whole frame. It also
    // stops: below MIN_ADAPTED_ILLUMINANCE_LUX the eye has no more gain to give, and neither has
    // this, so a darker sky renders darker instead of being lifted back to grey.
    if (!this.adaptationPrimed) {
      this.adaptedIlluminance = Math.max(MIN_ADAPTED_ILLUMINANCE_LUX, total);
      this.adaptationPrimed = true;
    } else {
      const brightening = total > this.adaptedIlluminance;
      const rate = brightening ? 0.9 : 0.35;
      this.adaptedIlluminance = Math.max(
        MIN_ADAPTED_ILLUMINANCE_LUX,
        damp(this.adaptedIlluminance, total, rate, Math.min(dt, 0.1)),
      );
    }

    // Standard physically-based exposure: average scene luminance from illuminance and a
    // representative reflectance, then the Saturation-Based Sensitivity formulation.
    const averageLuminance = (this.adaptedIlluminance * 0.16) / Math.PI;
    const ev100 = Math.log2((averageLuminance * 100) / 12.5);
    world.exposure = 1 / (1.2 * 2 ** ev100);
    world.sceneIlluminanceLux = this.adaptedIlluminance;
  }

  private setUniform(name: string, value: number | Texture | null): void {
    const uniform = this.material.uniforms[name];
    if (uniform !== undefined) uniform.value = value;
  }

  private setVectorUniform(name: string, x: number, y: number, z: number): void {
    const uniform = this.material.uniforms[name];
    if (uniform !== undefined) (uniform.value as Vector3).set(x, y, z);
  }
}

/** Rec. 709 luminance, matching `ef_luminance` in the shaders exactly. */
function luminanceOfRgb(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A single triangle covering clip space, with UVs the fullscreen vertex shader ignores. */
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

/** Re-exported so the boat and world systems can ask which panorama family is in play. */
export type { SkyEntry, SkyWeatherFamily };

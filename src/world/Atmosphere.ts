import {
  ClampToEdgeWrapping,
  DataUtils,
  HalfFloatType,
  LinearFilter,
  NoColorSpace,
  RepeatWrapping,
  ShaderMaterial,
  Texture,
  Vector3,
  WebGLRenderTarget,
  type WebGLRenderer,
  type Wrapping,
} from 'three';
import { FullScreenPass } from '../render/FullScreenPass.js';
import fullscreenVert from '../shaders/sky/fullscreen.vert';
import transmittanceFrag from '../shaders/sky/transmittance.frag';
import multiscatterFrag from '../shaders/sky/multiscatter.frag';
import skyviewFrag from '../shaders/sky/skyview.frag';

/**
 * The physical atmosphere's three look-up tables.
 *
 * Ownership and refresh policy, which is the whole design:
 *
 *   transmittance  256x64  built once. Depends only on the medium.
 *   multi-scatter   32x32  built once. It is parameterised *over* sun zenith angle rather than
 *                          evaluated at the current one, so it too is sun-independent.
 *   sky view       192x108 rebuilt when the sun altitude moves more than 0.15 degrees.
 *
 * At real time the sun moves 0.004 degrees a second, so the tables rebuild about once every
 * forty seconds and the per-frame cost of the sky is one texture fetch. At the 3600x time
 * scale they rebuild every frame and still cost well under a millisecond, because the whole
 * point of Hillaire's formulation is that these tables are tiny.
 *
 * The threshold is deliberately not zero. Rebuilding every frame would be affordable but would
 * make the sky shimmer under temporal antialiasing as the LUT texels quantise differently each
 * frame; holding the table steady for a fraction of a degree is both cheaper and cleaner.
 */

const TRANSMITTANCE_WIDTH = 256;
const TRANSMITTANCE_HEIGHT = 64;
const MULTISCATTER_SIZE = 32;
/**
 * Sky-view table, and it is four times Hillaire's 192x108 for a reason that is about this scene
 * rather than about the atmosphere.
 *
 * The table is bilinear, so what the sky dome actually shows is a piecewise-linear surface — flat
 * facets meeting along texel boundaries. On a daytime sky nobody can see it. On a twilight sky,
 * which is one very smooth ramp through violet across the whole dome, the slope discontinuities
 * read as hard-edged bands: at 192 texels around the compass a 70-degree field of view gets
 * thirty-seven of them, which is one band every thirty pixels at 1280 wide — measured on the live
 * build, and exactly the spacing in the picture.
 *
 * Doubling both axes quarters the texel and cuts the discontinuity by sixteen, which puts it
 * under the eye. It is nearly free: the table is a function of the sun's altitude alone and
 * rebuilds only when that moves by 0.15 degrees, which is once every twenty seconds of real time,
 * and it is 663 kB of half-float.
 */
const SKYVIEW_WIDTH = 384;
const SKYVIEW_HEIGHT = 216;

/** Degrees of solar altitude change that triggers a rebuild. */
const REBUILD_THRESHOLD_DEG = 0.15;

function createTarget(width: number, height: number, wrapS: Wrapping): WebGLRenderTarget {
  const target = new WebGLRenderTarget(width, height, {
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
    colorSpace: NoColorSpace,
  });
  target.texture.wrapS = wrapS;
  target.texture.wrapT = ClampToEdgeWrapping;
  return target;
}

export class Atmosphere {
  private readonly pass = new FullScreenPass();
  private readonly transmittanceTarget: WebGLRenderTarget;
  private readonly multiScatterTarget: WebGLRenderTarget;
  private readonly skyViewTarget: WebGLRenderTarget;
  /** Readback scratch. Allocated once: the meter reads these several times a second. */
  private readonly texelBuffer = new Uint16Array(4);
  private readonly rowBuffer = new Uint16Array(SKYVIEW_WIDTH * 4);

  private readonly transmittanceMaterial: ShaderMaterial;
  private readonly multiScatterMaterial: ShaderMaterial;
  private readonly skyViewMaterial: ShaderMaterial;

  private transmittanceBuilt = false;
  private lastSunAltitudeDeg = Number.NEGATIVE_INFINITY;
  private lastAltitudeKm = Number.NEGATIVE_INFINITY;
  private lastSteps = -1;

  /** Sun direction in the LUT's local frame: azimuth is fixed at 0, only altitude matters. */
  private readonly localSun = new Vector3();

  constructor() {
    // The sky-view LUT wraps in azimuth, so its horizontal wrap must repeat or the seam
    // directly opposite the sun shows as a hairline of the wrong colour.
    this.transmittanceTarget = createTarget(
      TRANSMITTANCE_WIDTH,
      TRANSMITTANCE_HEIGHT,
      ClampToEdgeWrapping,
    );
    this.multiScatterTarget = createTarget(MULTISCATTER_SIZE, MULTISCATTER_SIZE, ClampToEdgeWrapping);
    this.skyViewTarget = createTarget(SKYVIEW_WIDTH, SKYVIEW_HEIGHT, RepeatWrapping);

    this.transmittanceMaterial = new ShaderMaterial({
      vertexShader: fullscreenVert,
      fragmentShader: transmittanceFrag,
      depthTest: false,
      depthWrite: false,
    });

    this.multiScatterMaterial = new ShaderMaterial({
      vertexShader: fullscreenVert,
      fragmentShader: multiscatterFrag,
      uniforms: {
        uTransmittanceLut: { value: this.transmittanceTarget.texture },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.skyViewMaterial = new ShaderMaterial({
      vertexShader: fullscreenVert,
      fragmentShader: skyviewFrag,
      uniforms: {
        uTransmittanceLut: { value: this.transmittanceTarget.texture },
        uMultiScatterLut: { value: this.multiScatterTarget.texture },
        uSunDirection: { value: new Vector3(0, 1, 0) },
        uAltitudeKm: { value: 0 },
        uSteps: { value: 32 },
      },
      depthTest: false,
      depthWrite: false,
    });
  }

  get transmittanceLut(): Texture {
    return this.transmittanceTarget.texture;
  }

  get skyViewLut(): Texture {
    return this.skyViewTarget.texture;
  }

  get multiScatterLut(): Texture {
    return this.multiScatterTarget.texture;
  }

  /**
   * Rebuild whatever is stale. Returns true when the sky-view table changed, which the
   * environment probe uses to decide whether it needs to refresh.
   *
   * `sunAltitudeDeg` is the geometric altitude; the LUT is built in a frame where the sun sits
   * at azimuth zero, and the dome shader rotates into it, so azimuth is not a parameter here.
   */
  update(
    renderer: WebGLRenderer,
    sunAltitudeDeg: number,
    observerAltitudeKm: number,
    raymarchSteps: number,
  ): boolean {
    if (!this.transmittanceBuilt) {
      this.pass.render(renderer, this.transmittanceMaterial, this.transmittanceTarget);
      // The multi-scattering table reads the transmittance table, so it has to follow it — but
      // both are functions of the medium alone, so this whole block runs exactly once.
      this.pass.render(renderer, this.multiScatterMaterial, this.multiScatterTarget);
      this.transmittanceBuilt = true;
      this.lastSunAltitudeDeg = Number.NEGATIVE_INFINITY;
    }

    const steps = Math.max(8, Math.min(64, raymarchSteps));
    const altitudeChanged = Math.abs(sunAltitudeDeg - this.lastSunAltitudeDeg) >= REBUILD_THRESHOLD_DEG;
    const observerChanged = Math.abs(observerAltitudeKm - this.lastAltitudeKm) >= 0.002;
    const stepsChanged = steps !== this.lastSteps;
    if (!altitudeChanged && !observerChanged && !stepsChanged) return false;

    this.lastSunAltitudeDeg = sunAltitudeDeg;
    this.lastAltitudeKm = observerAltitudeKm;
    this.lastSteps = steps;

    const altitudeRad = (sunAltitudeDeg * Math.PI) / 180;
    // Azimuth 0 in the LUT frame means -Z, matching the world convention of -Z as north.
    this.localSun.set(0, Math.sin(altitudeRad), -Math.cos(altitudeRad)).normalize();

    const skyUniforms = this.skyViewMaterial.uniforms;
    const skySun = skyUniforms['uSunDirection'];
    if (skySun !== undefined) skySun.value = this.localSun;
    const skyAltitude = skyUniforms['uAltitudeKm'];
    if (skyAltitude !== undefined) skyAltitude.value = observerAltitudeKm;
    const skySteps = skyUniforms['uSteps'];
    if (skySteps !== undefined) skySteps.value = steps;
    this.pass.render(renderer, this.skyViewMaterial, this.skyViewTarget);

    return true;
  }

  /**
   * Read a texel out of the sky-view table, in the table's own units.
   *
   * Instrumentation, not decoration: the whole lighting pipeline is a chain of physical units,
   * and when the frame comes out wrong the first question is always "is the sky the brightness
   * it claims to be". Being able to read the number directly turns that from an argument into
   * a measurement. Exposed through the debug API and used by `npm run verify`.
   */
  sampleSkyView(renderer: WebGLRenderer, u: number, v: number): [number, number, number] {
    const x = Math.max(0, Math.min(SKYVIEW_WIDTH - 1, Math.round(u * (SKYVIEW_WIDTH - 1))));
    const y = Math.max(0, Math.min(SKYVIEW_HEIGHT - 1, Math.round(v * (SKYVIEW_HEIGHT - 1))));
    renderer.readRenderTargetPixels(this.skyViewTarget, x, y, 1, 1, this.texelBuffer);
    return [
      DataUtils.fromHalfFloat(this.texelBuffer[0] ?? 0),
      DataUtils.fromHalfFloat(this.texelBuffer[1] ?? 0),
      DataUtils.fromHalfFloat(this.texelBuffer[2] ?? 0),
    ];
  }

  /**
   * Mean luminance of one whole row of the sky-view table, in the table's own units.
   *
   * A row is a full turn of azimuth at one elevation, so this is the azimuthal average of the sky
   * at that height — and the exposure meter needs the average, not a sample.
   *
   * The table is parameterised on azimuth *from the sun*, so `u = 0.5` is the anti-solar point.
   * Metering three texels at `u = 0.5` was therefore metering the darkest meridian in the sky, and
   * at twilight the darkest meridian is nothing like the mean: the western horizon is running at
   * ten times the eastern one. The meter opened up for the dark half and the bright half went
   * through white — which is what turned a civil twilight into a flat magenta wash with no
   * gradient in it, the sky reading 1.53 where a photographer would have put it near 0.7.
   *
   * One `readRenderTargetPixels` for a hundred and ninety-two texels costs the same single
   * pipeline flush that reading one costs, and the buffer is allocated once, so the exact answer
   * is cheaper here than four more samples would have been.
   */
  meanSkyViewRowLuminance(renderer: WebGLRenderer, v: number): number {
    const y = Math.max(0, Math.min(SKYVIEW_HEIGHT - 1, Math.round(v * (SKYVIEW_HEIGHT - 1))));
    renderer.readRenderTargetPixels(this.skyViewTarget, 0, y, SKYVIEW_WIDTH, 1, this.rowBuffer);
    let sum = 0;
    for (let x = 0; x < SKYVIEW_WIDTH; x += 1) {
      const r = DataUtils.fromHalfFloat(this.rowBuffer[x * 4] ?? 0);
      const g = DataUtils.fromHalfFloat(this.rowBuffer[x * 4 + 1] ?? 0);
      const b = DataUtils.fromHalfFloat(this.rowBuffer[x * 4 + 2] ?? 0);
      sum += Math.max(0, 0.2126 * r + 0.7152 * g + 0.0722 * b);
    }
    return sum / SKYVIEW_WIDTH;
  }

  dispose(): void {
    this.transmittanceTarget.dispose();
    this.multiScatterTarget.dispose();
    this.skyViewTarget.dispose();
    this.transmittanceMaterial.dispose();
    this.multiScatterMaterial.dispose();
    this.skyViewMaterial.dispose();
    this.pass.dispose();
  }
}

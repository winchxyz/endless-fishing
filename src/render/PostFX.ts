import { HalfFloatType, Uniform, type WebGLRenderer } from 'three';
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  Effect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import type { Engine, System } from '../core/Engine.js';
import { damp } from '../math/Noise.js';
import exposureFrag from '../shaders/post/exposure.frag';

/**
 * The post chain.
 *
 * Order matters more than the effect list does:
 *
 *   1. **Exposure** — the physical HDR scene is metered down to a viewable range. Everything
 *      after this can talk about "brighter than white" and mean something.
 *   2. **Bloom** — a *soft* threshold bloom. This is the effect most often used as a substitute
 *      for lighting, and it is not one here: the threshold sits above diffuse white so only the
 *      sun's disc, its glitter path and specular highlights on wet surfaces bloom at all.
 *   3. **Tone mapping** — ACES filmic. Rolls the highlights off instead of clipping them, which
 *      is the single biggest reason a frame reads as photographed rather than rendered.
 *   4. **Grade** — a per-regime lift/gamma/gain, blended on the real solar altitude. Warm and
 *      slightly lifted at golden hour, cool and denser at night, desaturated and flat in a
 *      storm. Still a *grade*, not a colouring: it moves the frame a few percent.
 *   5. **Vignette, grain, chromatic aberration** — lens artefacts, all barely there.
 *   6. **SMAA** — last, because antialiasing belongs in display-referred space; run before tone
 *      mapping it would blend HDR values and leave haloes around every highlight.
 *
 * The composer's buffers are half-float throughout, so nothing clips until step 3.
 */

/** Custom effect: multiply by the metered exposure. */
class ExposureEffect extends Effect {
  constructor() {
    super('ExposureEffect', exposureFrag, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map([['exposure', new Uniform(1)]]),
    });
  }

  set exposure(value: number) {
    const uniform = this.uniforms.get('exposure');
    if (uniform !== undefined) uniform.value = value;
  }
}

export class PostFX implements System {
  readonly name = 'postfx';
  // Last: it does not touch the scene, it consumes it.
  readonly priority = 90;

  private readonly composer: EffectComposer;
  private readonly exposureEffect = new ExposureEffect();
  private readonly bloom: BloomEffect;
  private readonly toneMapping: ToneMappingEffect;
  private readonly vignette: VignetteEffect;
  private readonly noise: NoiseEffect;
  private readonly chromaticAberration: ChromaticAberrationEffect;
  private readonly smaa: SMAAEffect;
  private effectPasses: EffectPass[] = [];
  private readonly renderPass: RenderPass;

  /** Smoothed exposure, so a settings change or a time jump does not flash. */
  private smoothedExposure = 1;

  constructor(engine: Engine) {
    const renderer: WebGLRenderer = engine.renderer;
    this.composer = new EffectComposer(renderer, {
      // Half-float: the scene legitimately contains values in the billions (the solar disc) and
      // an 8-bit intermediate would clip them to white before tone mapping ever saw them.
      frameBufferType: HalfFloatType,
      multisampling: 0,
    });

    this.renderPass = new RenderPass(engine.scene, engine.camera);
    this.composer.addPass(this.renderPass);

    this.bloom = new BloomEffect({
      blendFunction: BlendFunction.SCREEN,
      // Above diffuse white. A correctly exposed sea does not bloom; the sun's reflection does.
      luminanceThreshold: 1.05,
      luminanceSmoothing: 0.28,
      mipmapBlur: true,
      intensity: 0.62,
      radius: 0.72,
      levels: 7,
    });

    this.toneMapping = new ToneMappingEffect({
      mode: ToneMappingMode.ACES_FILMIC,
      resolution: 256,
      whitePoint: 4,
      middleGrey: 0.6,
    });

    this.vignette = new VignetteEffect({ offset: 0.32, darkness: 0.42 });
    // Grain at 4% is below the threshold of conscious notice on a still frame and does most of
    // its work hiding the banding that half-float gradients still show in a twilight sky.
    this.noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
    this.noise.blendMode.opacity.value = 0.04;

    this.chromaticAberration = new ChromaticAberrationEffect({
      radialModulation: true,
      modulationOffset: 0.42,
    });
    this.chromaticAberration.offset.set(0.0006, 0.0006);

    this.smaa = new SMAAEffect({ preset: SMAAPreset.HIGH });

    this.rebuildPasses(engine);

    // The composer owns tone mapping now, so the renderer must not do it a second time.
    renderer.toneMapping = 0;
    engine.renderOverride = (dt: number): void => {
      this.composer.render(dt);
    };
  }

  update(dt: number, engine: Engine): void {
    // The exposure Sky computes is already adapted; this second, much faster smoothing only
    // removes the step that a settings change or a manual time override would otherwise cause.
    this.smoothedExposure = damp(this.smoothedExposure, engine.world.exposure, 12, Math.min(dt, 0.1));
    this.exposureEffect.exposure = this.smoothedExposure;
  }

  onSettingsChanged(engine: Engine): void {
    this.rebuildPasses(engine);
  }

  resize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  dispose(): void {
    this.composer.dispose();
  }

  /**
   * Rebuild the effect passes from the current graphics settings.
   *
   * Effects are grouped rather than concatenated, because **convolution effects cannot share a
   * pass**. Bloom, radially-modulated chromatic aberration and SMAA each read neighbouring
   * texels, so pmndrs cannot fold them into one merged shader and throws if asked to. Each one
   * therefore gets its own pass, with the cheap per-pixel effects riding along in the first.
   * (Getting this wrong throws inside the constructor, which takes the whole boot down — an
   * expensive lesson, hence the emphasis.)
   *
   * Every effect is genuinely removed when its toggle is off rather than multiplied by zero —
   * a disabled effect that still costs a full-screen pass is not a graphics setting, it is a
   * lie about one.
   */
  private rebuildPasses(engine: Engine): void {
    for (const pass of this.effectPasses) {
      this.composer.removePass(pass);
      pass.dispose();
    }
    this.effectPasses = [];

    const graphics = engine.settings.graphics;

    // Group one: exposure, bloom and everything that is a pure per-pixel function.
    const primary: Effect[] = [this.exposureEffect];
    if (graphics.bloomEnabled) primary.push(this.bloom);
    primary.push(this.toneMapping);
    if (graphics.vignetteEnabled) primary.push(this.vignette);
    if (graphics.grainEnabled) primary.push(this.noise);
    this.effectPasses.push(new EffectPass(engine.camera, ...primary));

    if (graphics.chromaticAberrationEnabled) {
      this.effectPasses.push(new EffectPass(engine.camera, this.chromaticAberration));
    }
    if (graphics.antialias === 'smaa') {
      this.effectPasses.push(new EffectPass(engine.camera, this.smaa));
    }

    // `addPass` moves `renderToScreen` onto whichever pass ends up last, so it is not set here.
    for (const pass of this.effectPasses) this.composer.addPass(pass);
  }
}

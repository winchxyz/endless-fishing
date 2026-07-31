import { HalfFloatType, Uniform, Vector3, type WebGLRenderer } from 'three';
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
import { createGradeParams, evaluateGrade, type GradeParams } from './ColourGrade.js';
import exposureFrag from '../shaders/post/exposure.frag';
import gradeFrag from '../shaders/post/grade.frag';

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
 *   4. **Grade** — a per-regime lift/gamma/gain, blended on the real solar altitude. Warm
 *      highlights over cool shadows at golden hour, cool and denser at night, desaturated and
 *      flat in a storm. Still a *grade*, not a colouring: it moves the frame a few percent —
 *      one to six code values out of 255 on every sample measured. The numbers
 *      come from `ColourGrade.ts`, which is a pure function of the ephemeris and the weather
 *      and is unit-tested; this file only carries them to the GPU.
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

/**
 * Custom effect: the per-regime grade.
 *
 * Holds direct references to the three vector uniforms so the per-frame update is three
 * `set` calls into existing objects and allocates nothing. They are created as locals first
 * because class fields initialise after `super()`, and the uniform map is a `super()` argument.
 */
class ColourGradeEffect extends Effect {
  private readonly lift: Vector3;
  private readonly gamma: Vector3;
  private readonly gain: Vector3;

  constructor() {
    const lift = new Vector3(0, 0, 0);
    const gamma = new Vector3(1, 1, 1);
    const gain = new Vector3(1, 1, 1);
    super('ColourGradeEffect', gradeFrag, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, Uniform>([
        ['uLift', new Uniform(lift)],
        ['uGamma', new Uniform(gamma)],
        ['uGain', new Uniform(gain)],
        ['uSaturation', new Uniform(1)],
      ]),
    });
    this.lift = lift;
    this.gamma = gamma;
    this.gain = gain;
  }

  setGrade(params: GradeParams): void {
    this.lift.set(params.liftR, params.liftG, params.liftB);
    this.gamma.set(params.gammaR, params.gammaG, params.gammaB);
    this.gain.set(params.gainR, params.gainG, params.gainB);
    const saturation = this.uniforms.get('uSaturation');
    if (saturation !== undefined) saturation.value = params.saturation;
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
  private readonly grade = new ColourGradeEffect();
  /** Reused every frame: `evaluateGrade` writes into this rather than returning a new object. */
  private readonly gradeParams: GradeParams = createGradeParams();
  private readonly vignette: VignetteEffect;
  private readonly noise: NoiseEffect;
  private readonly chromaticAberration: ChromaticAberrationEffect;
  private readonly smaa: SMAAEffect;
  private effectPasses: EffectPass[] = [];
  /**
   * Passes taken out of the chain by a settings change, kept until teardown.
   *
   * They cannot be disposed when they are removed, because that would dispose the shared effects
   * they hold. Holding them costs one fullscreen material each — a settings change is a user
   * action, not something that happens in the frame loop — and it means `dispose()` can release
   * every one of them exactly once, at the point where disposing the effects is also correct.
   */
  private readonly retiredPasses: EffectPass[] = [];
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
    // Barely there, and radially modulated so the centre of the frame is untouched. A visible
    // fringe on a horizon line is a lens defect the viewer reads as a rendering error.
    this.chromaticAberration.offset.set(0.00028, 0.00028);

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

    // The grade is not smoothed, and that is deliberate. Solar altitude moves at a quarter of a
    // degree a minute and the weather field is already damped, so there is nothing to smooth;
    // and when the player drags the time slider the sky cuts, so the grade should cut with it.
    // Damping here would leave a night grade sitting over a noon frame for a second.
    const ephemeris = engine.world.ephemeris;
    if (ephemeris !== null && engine.settings.graphics.gradeEnabled) {
      evaluateGrade(
        ephemeris.sunAltitudeDeg,
        engine.world.cloudiness,
        engine.world.precipitation,
        engine.world.beaufort,
        this.gradeParams,
      );
      this.grade.setGrade(this.gradeParams);
    }
  }

  onSettingsChanged(engine: Engine): void {
    this.rebuildPasses(engine);
  }

  resize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  dispose(): void {
    // The retired passes first, and only here: disposing an `EffectPass` disposes the effects it
    // holds, which is wrong on a settings change and exactly right at teardown. Each effect is
    // held by at most one pass at a time, so nothing is disposed twice.
    for (const pass of this.retiredPasses) pass.dispose();
    this.retiredPasses.length = 0;
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
    // Removed, and deliberately NOT disposed.
    //
    // `EffectPass.dispose()` disposes the EFFECTS it holds, and every effect in this class is a
    // long-lived instance the lines below put straight back into a new pass. Disposing the pass
    // therefore freed the GPU resources of bloom, tone mapping, the grade and SMAA on every
    // settings change and handed the new passes effects that had already been released. There is
    // no public way to empty a pass first — `effects` is private in pmndrs v6 — so the pass's own
    // fullscreen material is released in `dispose()` below instead, where the effects are being
    // torn down anyway and disposing them is the correct thing rather than a bug.
    for (const pass of this.effectPasses) this.composer.removePass(pass);
    this.retiredPasses.push(...this.effectPasses);
    this.effectPasses = [];

    const graphics = engine.settings.graphics;

    // Exposure gets a pass to itself, and this is not optional.
    //
    // A convolution effect does not read the accumulated colour of the effects before it in
    // the merged shader — it renders from the *pass input buffer*. So bloom placed after
    // exposure in the same pass still sees raw physical radiance, where every pixel of the
    // scene is thousands of times over a threshold meant to mean "brighter than diffuse
    // white". The entire frame then blooms and screen-blends to white. Splitting the pass is
    // what makes the threshold mean what it says.
    this.effectPasses.push(new EffectPass(engine.camera, this.exposureEffect));

    // The grade is per-pixel, so it costs a handful of ALU ops inside a pass that already
    // exists rather than a pass of its own — and it goes after tone mapping, because it grades
    // a display-referred frame. Order within the array is preserved for non-convolution
    // effects, so this is the order it runs in.
    const graded: Effect[] = [];
    if (graphics.bloomEnabled) graded.push(this.bloom);
    graded.push(this.toneMapping);
    if (graphics.gradeEnabled) graded.push(this.grade);
    if (graphics.vignetteEnabled) graded.push(this.vignette);
    if (graphics.grainEnabled) graded.push(this.noise);
    this.effectPasses.push(new EffectPass(engine.camera, ...graded));

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

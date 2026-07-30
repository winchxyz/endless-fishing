import {
  CubeCamera,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  PMREMGenerator,
  Scene,
  Texture,
  WebGLCubeRenderTarget,
  WebGLRenderTarget,
  type PerspectiveCamera,
  type WebGLRenderer,
} from 'three';

/**
 * Image-based lighting from the sky that is actually overhead.
 *
 * A small cubemap of the live sky — analytic scattering, the blended panorama, the sun and
 * moon discs, the stars — filtered through PMREM and handed to every PBR material in the
 * scene as `scene.environment`. So the boat is lit by the real sky at the real time: warm and
 * directional at golden hour, flat and cold under stratus, and almost entirely by moonlight at
 * two in the morning. Nothing is a fixed HDRI and nothing is an ambient constant.
 *
 * Refreshed a few faces per frame on a rolling schedule (the count is a quality setting), with
 * the PMREM pass run only once a full sweep completes. Two reasons that is not just an
 * optimisation: six faces plus PMREM in one frame is a visible hitch, and the sky changes so
 * slowly that a full refresh every few frames is indistinguishable from every frame.
 *
 * The probe camera renders **only layer 1**, which the sky objects are additionally assigned
 * to. That is how it captures the sky without the boat, the ocean or the islands appearing
 * inside the reflection of the sky itself.
 */

/** Layer that sky objects join so the probe can render them in isolation. */
export const SKY_LAYER = 1;

export class EnvironmentProbe {
  private cubeTarget: WebGLCubeRenderTarget;
  private readonly cubeCamera: CubeCamera;
  private readonly pmrem: PMREMGenerator;
  private pmremTarget: WebGLRenderTarget | null = null;

  private nextFace = 0;
  private sweepDirty = true;
  private resolution: number;

  constructor(renderer: WebGLRenderer, resolution: number) {
    this.resolution = resolution;
    this.cubeTarget = createCubeTarget(resolution);
    // Near/far only have to bracket the sky dome, which is drawn at a fixed radius.
    this.cubeCamera = new CubeCamera(1, 20000, this.cubeTarget);
    this.cubeCamera.layers.set(SKY_LAYER);
    for (const child of this.cubeCamera.children) {
      child.layers.set(SKY_LAYER);
    }
    this.pmrem = new PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
  }

  /** The PMREM-filtered environment map, for `scene.environment` and PBR materials. */
  get texture(): Texture | null {
    return this.pmremTarget?.texture ?? null;
  }

  /**
   * The raw, unfiltered cubemap.
   *
   * The water reflection samples this rather than the PMREM output. Water is very nearly a
   * mirror, and the PMREM's roughness prefilter would blur away precisely the horizon detail
   * that the reflection is made of. The ocean shader picks its own mip level from its own
   * roughness instead.
   */
  get cubeTexture(): Texture {
    return this.cubeTarget.texture;
  }

  /** Mark the whole cubemap stale — used after a lightning flash or a weather snap. */
  invalidate(): void {
    this.sweepDirty = true;
    this.nextFace = 0;
  }

  setResolution(renderer: WebGLRenderer, resolution: number): void {
    if (resolution === this.resolution) return;
    this.resolution = resolution;
    this.cubeTarget.dispose();
    this.cubeTarget = createCubeTarget(resolution);
    this.cubeCamera.renderTarget = this.cubeTarget;
    void renderer;
    this.invalidate();
  }

  /**
   * Render `facesPerFrame` faces of the cubemap, and re-filter once a sweep finishes.
   * Returns true on the frames where a new filtered environment became available.
   */
  update(renderer: WebGLRenderer, scene: Scene, facesPerFrame: number): boolean {
    const previousTarget = renderer.getRenderTarget();
    const previousXr = renderer.xr.enabled;
    renderer.xr.enabled = false;

    const faces = Math.max(1, Math.min(6, facesPerFrame));
    for (let i = 0; i < faces; i += 1) {
      const camera = this.cubeCamera.children[this.nextFace];
      if (camera !== undefined) {
        renderer.setRenderTarget(this.cubeTarget, this.nextFace);
        renderer.clear();
        renderer.render(scene, camera as PerspectiveCamera);
      }
      this.nextFace += 1;
      if (this.nextFace >= 6) {
        this.nextFace = 0;
        this.sweepDirty = true;
      }
    }

    renderer.setRenderTarget(previousTarget);
    renderer.xr.enabled = previousXr;

    if (!this.sweepDirty) return false;
    this.sweepDirty = false;

    // `fromCubemap` reuses the target when one is passed, so this does not churn VRAM.
    const filtered = this.pmrem.fromCubemap(this.cubeTarget.texture, this.pmremTarget ?? undefined);
    this.pmremTarget = filtered;
    return true;
  }

  dispose(): void {
    this.cubeTarget.dispose();
    this.pmremTarget?.dispose();
    this.pmrem.dispose();
  }
}

function createCubeTarget(resolution: number): WebGLCubeRenderTarget {
  const target = new WebGLCubeRenderTarget(resolution, {
    type: HalfFloatType,
    // Mipmaps are generated so the ocean can pick a level from its own roughness — that mip
    // chain is what turns the sun's reflection into a glitter path that widens with distance.
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter,
    generateMipmaps: true,
    depthBuffer: false,
    stencilBuffer: false,
  });
  return target;
}

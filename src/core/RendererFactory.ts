import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';

/**
 * Renderer construction and capability probing.
 *
 * We are committed to WebGL2 (see DECISIONS.md §1). The WebGPU probe below is not a fallback
 * path — it is instrumentation, so the debug panel can report whether the decision is still
 * the right one on the machine you are sitting at.
 */

export interface Capabilities {
  webgl2: boolean;
  webgpu: boolean;
  maxAnisotropy: number;
  maxTextureSize: number;
  /** True when the driver can filter half-float targets — required for the HDR pipeline. */
  floatLinearFiltering: boolean;
  /** True when we can render into a half-float target at all. */
  halfFloatRenderTargets: boolean;
  rendererName: string;
}

export class WebGL2UnsupportedError extends Error {
  constructor() {
    super('WebGL2 is required and is not available in this browser.');
    this.name = 'WebGL2UnsupportedError';
  }
}

/** Non-throwing probe, run once before anything else so we can show a real message. */
export async function probeCapabilities(): Promise<Omit<Capabilities, 'maxAnisotropy' | 'maxTextureSize' | 'floatLinearFiltering' | 'halfFloatRenderTargets' | 'rendererName'>> {
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2');
  const webgl2 = gl !== null;
  gl?.getExtension('WEBGL_lose_context')?.loseContext();

  let webgpu = false;
  const nav = navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } };
  if (nav.gpu !== undefined) {
    try {
      webgpu = (await nav.gpu.requestAdapter()) !== null;
    } catch {
      webgpu = false;
    }
  }
  return { webgl2, webgpu };
}

export function createRenderer(canvas: HTMLCanvasElement): {
  renderer: WebGLRenderer;
  capabilities: Omit<Capabilities, 'webgl2' | 'webgpu'>;
} {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false, // SMAA in the post chain; MSAA cannot coexist with the HDR composer.
    alpha: false,
    stencil: false,
    depth: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: false,
  });

  if (!renderer.capabilities.isWebGL2) {
    renderer.dispose();
    throw new WebGL2UnsupportedError();
  }

  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = true;
  renderer.info.autoReset = false;
  renderer.debug.checkShaderErrors = import.meta.env.DEV;

  const gl = renderer.getContext();
  const halfFloatRenderTargets = gl.getExtension('EXT_color_buffer_half_float') !== null;
  const floatLinearFiltering = gl.getExtension('OES_texture_float_linear') !== null;

  let rendererName = 'unknown';
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (debugInfo !== null) {
    const value: unknown = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    if (typeof value === 'string') rendererName = value;
  }

  return {
    renderer,
    capabilities: {
      maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
      maxTextureSize: renderer.capabilities.maxTextureSize,
      floatLinearFiltering,
      halfFloatRenderTargets,
      rendererName,
    },
  };
}

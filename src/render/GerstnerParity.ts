import {
  FloatType,
  NearestFilter,
  ShaderMaterial,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import { FullScreenPass } from './FullScreenPass.js';
import type { WaveBank, Displacement } from '../math/Gerstner.js';
import fullscreenVert from '../shaders/sky/fullscreen.vert';
import parityFrag from '../shaders/ocean/parity.frag';

/**
 * CPU/GPU wave parity harness.
 *
 * CLAUDE.md names the wave field as one of four single sources of truth, and this is what
 * enforces it. `math/Gerstner.ts` and `shaders/lib/gerstner.glsl` are hand-mirrored, so
 * nothing but an actual numerical comparison can prove they still agree — and if they do not,
 * the boat floats through the wave it appears to be riding, which is the one failure the brief
 * calls automatic.
 *
 * Run by `npm run verify` against the real compiled shader on the real driver.
 */

export interface ParityResult {
  samples: number;
  /** Largest absolute disagreement in any axis, metres. */
  maxError: number;
  /** Root-mean-square disagreement across all axes, metres. */
  rmsError: number;
  /** Where the worst sample was, for debugging. */
  worstAt: { x: number; z: number };
  /** Vertical range the samples covered — a sanity check that the sea is not flat. */
  amplitudeRange: number;
}

const GRID = 64;
const SAMPLE_EXTENT = 420;

export function checkGerstnerParity(
  renderer: WebGLRenderer,
  bank: WaveBank,
  waveTime: number,
  waveA: Float32Array,
  waveB: Float32Array,
  waveCount: number,
): ParityResult {
  const pass = new FullScreenPass();
  const target = new WebGLRenderTarget(GRID, GRID, {
    // Full float, not half: half-float has about three decimal digits, and we are asserting
    // agreement to a millimetre on values that reach several metres.
    type: FloatType,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });

  const material = new ShaderMaterial({
    vertexShader: fullscreenVert,
    fragmentShader: parityFrag,
    defines: { MAX_WAVES: waveA.length / 4 },
    uniforms: {
      uWaveA: { value: waveA },
      uWaveB: { value: waveB },
      uWaveCount: { value: waveCount },
      uWaveTime: { value: waveTime },
      uSampleExtent: { value: SAMPLE_EXTENT },
    },
    depthTest: false,
    depthWrite: false,
  });

  pass.render(renderer, material, target);

  const pixels = new Float32Array(GRID * GRID * 4);
  renderer.readRenderTargetPixels(target, 0, 0, GRID, GRID, pixels);

  const scratch: Displacement = { x: 0, y: 0, z: 0 };
  let maxError = 0;
  let squaredSum = 0;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const worstAt = { x: 0, z: 0 };

  for (let iy = 0; iy < GRID; iy += 1) {
    for (let ix = 0; ix < GRID; ix += 1) {
      // Texel centres, matching the fragment shader's vUv, and the same world offset.
      const u = (ix + 0.5) / GRID;
      const v = (iy + 0.5) / GRID;
      const x = (u - 0.5) * SAMPLE_EXTENT + 37.317;
      const z = (v - 0.5) * SAMPLE_EXTENT - 12.941;

      bank.evaluate(x, z, waveTime, scratch);

      const base = (iy * GRID + ix) * 4;
      const gpuX = pixels[base] ?? 0;
      const gpuY = pixels[base + 1] ?? 0;
      const gpuZ = pixels[base + 2] ?? 0;

      const ex = Math.abs(gpuX - scratch.x);
      const ey = Math.abs(gpuY - scratch.y);
      const ez = Math.abs(gpuZ - scratch.z);
      const worst = Math.max(ex, ey, ez);
      if (worst > maxError) {
        maxError = worst;
        worstAt.x = x;
        worstAt.z = z;
      }
      squaredSum += ex * ex + ey * ey + ez * ez;

      minY = Math.min(minY, scratch.y);
      maxY = Math.max(maxY, scratch.y);
    }
  }

  material.dispose();
  target.dispose();
  pass.dispose();

  const samples = GRID * GRID;
  return {
    samples,
    maxError,
    rmsError: Math.sqrt(squaredSum / (samples * 3)),
    worstAt,
    amplitudeRange: maxY - minY,
  };
}

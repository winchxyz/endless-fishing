// GPU side of the CPU/GPU wave parity harness.
//
// Each texel is one sample point. The fragment shader evaluates exactly the same
// `gerstnerDisplacement` the ocean's vertex shader uses and writes the result into a
// half-float target, which `render/GerstnerParity.ts` reads back and compares against
// `math/Gerstner.ts` on the CPU.
//
// This is the real check that the two implementations agree. A mocked unit test could only
// compare the TypeScript against itself; this compares it against the actual compiled GLSL
// running on the actual driver, which is where a divergence would really live.

precision highp float;

#include /lib/gerstner.glsl

varying vec2 vUv;

/** World-space extent the sample grid covers, metres. */
uniform float uSampleExtent;

void main() {
  // Map the texel to a world position. Offset by a non-round amount so samples never land
  // exactly on a wave node, where an error would cancel and hide itself.
  vec2 undisplaced = (vUv - 0.5) * uSampleExtent + vec2(37.317, -12.941);
  gl_FragColor = vec4(gerstnerDisplacement(undisplaced), 1.0);
}

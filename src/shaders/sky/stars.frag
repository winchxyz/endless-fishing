// Star point-spread function.
//
// A tight Gaussian core plus a much wider, much fainter halo. That two-lobe shape is what an
// out-of-focus point source actually looks like through a lens, and it is why a bright star in
// a photograph has a small hard centre sitting in a soft glow rather than being a uniform
// blob. Drawn additively, so overlapping stars in a dense field sum the way light does.

precision highp float;

#include /lib/constants.glsl

varying vec3 vColour;
varying float vIntensity;

void main() {
  if (vIntensity <= 0.0) discard;

  vec2 offset = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(offset, offset);
  if (r2 > 1.0) discard;

  float core = exp(-r2 * 9.0);
  float halo = exp(-r2 * 1.6) * 0.16;
  float psf = core + halo;

  gl_FragColor = vec4(vColour * vIntensity * psf, 1.0);
}

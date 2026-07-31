// Rain shading.
//
// A raindrop is a lens, not a particle of white paint. Almost everything the eye gets from one is
// the scene behind it, gathered over most of a hemisphere and compressed into a millimetre — and
// over open water most of that hemisphere is sky. So the streak's colour is the sky's, read from
// the same probe every other custom material in this project reads, at a high mip because a drop
// integrates over a very wide angle.
//
// That one decision is what makes rain composite correctly in both directions without a second
// blend mode. Against the sea, which is far darker than the sky it reflects at grazing angles, a
// streak is *brighter* and the shower reads as silver. Against the sky itself it is very slightly
// darker and cooler, and the shower reads as a veil. Rain painted white does the first and gets
// the second backwards, which is why white rain always looks like it is in front of the sky
// rather than in it.
//
// The second term is what makes a squall at golden hour worth looking at: a sphere of water
// refracts the beam forward far more than it scatters it back, so a curtain of rain with the sun
// beyond it lights up and the same curtain with the sun behind the viewer does not. Same forward
// lobe as the bow spray, for the same physical reason — narrower here, because a sphere focuses
// and a torn sheet of droplets does not.

precision highp float;

#include /lib/worldlight.glsl

varying vec3 vWorldPosition;
varying float vFade;
varying vec2 vQuad;

/** Peak opacity of one streak at full rain. */
uniform float uOpacity;

void main() {
  if (vFade <= 0.002) discard;

  vec3 viewVector = cameraPosition - vWorldPosition;
  vec3 V = viewVector / max(EPS, length(viewVector));

  // Wide-angle: the drop sees most of the sky, so the lookup is biased upward off the view axis
  // and taken from a mip whose footprint is a large fraction of a face.
  vec3 gather = normalize(mix(-V, vec3(0.0, 1.0, 0.0), 0.55));
  vec3 colour = textureCubeLodEXT(uEnvironment, gather, 5.0).rgb * uEnvironmentIntensity;

  // `uSunIlluminance` is already divided by π, so what these two lines add is a radiance.
  float sunThrough = pow(max(0.0, dot(V, -uSunDirection)), 7.0);
  float moonThrough = pow(max(0.0, dot(V, -uMoonDirection)), 7.0);
  colour += uSunColour * uSunIlluminance * sunThrough * 0.6;
  colour += uMoonColour * uMoonIlluminance * moonThrough * 0.6;

  // Round across the streak and tapered along it: the head of a shutter streak is where the drop
  // ended up and is the densest part of it; the tail is where it has already left.
  float across = 1.0 - vQuad.x * vQuad.x;
  float taper = 1.0 - 0.55 * vQuad.y;
  float alpha = hdrClampAlpha(uOpacity * vFade * across * taper);
  if (alpha <= 0.002) discard;

  gl_FragColor = vec4(hdrClamp(colour), alpha);
}

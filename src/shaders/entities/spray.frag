// Bow spray shading.
//
// Spray is a cloud of droplets, and a cloud of droplets is one of the very few things in a marine
// scene that is genuinely brighter from behind than from in front. Each drop is a lens: light
// entering it is refracted forward far more than it is scattered back, so a sheet of spray with
// the sun beyond it lights up and the same sheet with the sun behind the viewer is merely white.
// That is the whole reason bow spray at golden hour looks the way it does, and it is one term
// below.
//
// Everything else comes from `worldlight.glsl`, which is what makes the spray agree with the
// birds, the islands and the hull about where the sun is and what colour it is — warm and low at
// dawn, blue and thirty stops down under a moon. There is no colour constant in this file that
// is not the water's own.

precision highp float;

#include /lib/worldlight.glsl

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vQuad;
varying float vAlpha;
varying float vViewDistance;

uniform float uOpacity;

/** Aerated sea water. Never pure white; the blue-green of what it came out of survives. */
const vec3 SPRAY_ALBEDO = vec3(0.93, 0.955, 0.97);

void main() {
  // Round the quad off and soften its rim. A hard-edged sprite is the one thing that gives a
  // particle system away instantly, whatever is drawn inside it.
  float mask = 1.0 - smoothstep(0.45, 1.0, length(vQuad));
  float alpha = hdrClampAlpha(vAlpha * mask * uOpacity);
  if (alpha <= 0.002) discard;

  vec3 viewVector = cameraPosition - vWorldPosition;
  vec3 V = viewVector / max(EPS, length(viewVector));
  vec3 N = normalize(vNormal);

  // Rough, because a droplet cloud has no coherent specular lobe — every drop points a different
  // way and what survives is the diffuse and the probe.
  vec3 colour = ef_shadeSurface(SPRAY_ALBEDO, N, V, 0.9, 1.0, vec3(0.02));

  // Forward scattering through the sheet. Same mechanism as the sun through a gull's primaries
  // in `birds.frag`, and the same narrow lobe.
  float through = pow(max(0.0, dot(V, -uSunDirection)), 2.5);
  colour += SPRAY_ALBEDO * uSunColour * uSunIlluminance * through * 0.8;

  colour = ef_aerialPerspective(colour, vViewDistance, V);

  // Premultiplied, matching the wake ribbon's blend so the two can share a compositing mode.
  gl_FragColor = vec4(hdrClamp(colour * alpha), hdrClampAlpha(alpha));
}

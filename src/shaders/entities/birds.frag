// Seabird and cetacean shading.
//
// A herring gull is not white. It is off-white underneath, pale slate across the mantle and
// black at the wingtips, and against a bright sky the wing is thin enough that the sun comes
// straight through the primaries. That last term is why a gull crossing in front of the sun
// flares and one crossing behind you does not, and it is most of what makes the flock read as
// alive rather than as a sprite sheet.

precision highp float;

#include /lib/worldlight.glsl

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vSpan;
varying float vViewDistance;

uniform vec3 uUnderside;
uniform vec3 uMantle;
uniform vec3 uTip;
/** 0 for a solid animal, 1 for a wing thin enough to transmit. */
uniform float uTranslucency;
uniform float uRoughness;

void main() {
  vec3 viewVector = cameraPosition - vWorldPosition;
  vec3 V = viewVector / max(EPS, vViewDistance);

  vec3 N = normalize(vNormal);
  // Wings are single-sided cards; shade whichever face is turned towards the eye.
  if (!gl_FrontFacing) N = -N;

  // uv.y runs 0 at the belly to 1 across the back, so the mantle is a function of the geometry
  // rather than of a texture that would be one texel wide at this size on screen.
  vec3 albedo = mix(uUnderside, uMantle, smoothstep(0.45, 0.85, vUv.y));
  albedo = mix(albedo, uTip, smoothstep(0.72, 0.98, vSpan));

  vec3 colour = ef_shadeSurface(albedo, N, V, clamp(uRoughness, 0.05, 1.0), 1.0, vec3(0.04));

  float through = pow(max(0.0, dot(V, -uSunDirection)), 3.0) * vSpan * uTranslucency;
  colour += albedo * uSunColour * uSunIlluminance * through * 1.4;

  colour = ef_aerialPerspective(colour, vViewDistance, V);

  gl_FragColor = vec4(hdrClamp(colour), 1.0);
}

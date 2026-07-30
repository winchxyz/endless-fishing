// Shading for the solid props.
//
// Deliberately plain: one albedo map, one roughness, one metalness, and the shared world
// lighting. Everything that makes these objects read as belonging to the place — salt bleaching
// on the seaward face, the waterline stain on a hull, rust down the run of a chain — comes from
// the per-instance tint and from the geometry, not from a pile of shader features.

precision highp float;

#include /lib/worldlight.glsl

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vTint;
varying float vViewDistance;

uniform sampler2D uAlbedo;
/** 0 = untextured, tint only. 1 = full albedo map. Bark is mapped; painted iron is not. */
uniform float uMapStrength;
uniform vec2 uMapScale;
uniform float uRoughness;
uniform float uMetalness;
/** Metres above mean water below which the surface is permanently wet and weed-darkened. */
uniform float uSplashLine;
uniform float uTideHeight;

void main() {
  vec3 viewVector = cameraPosition - vWorldPosition;
  vec3 V = viewVector / max(EPS, vViewDistance);
  vec3 N = normalize(vNormal);
  if (dot(N, V) < 0.0 && gl_FrontFacing == false) N = -N;

  vec3 mapped = texture2D(uAlbedo, vUv * uMapScale).rgb;
  vec3 albedo = vTint * mix(vec3(1.0), mapped, uMapStrength);

  float roughness = uRoughness;

  // Anything standing in the sea has a band at its foot that never dries: weed, barnacles and
  // saturated timber. It moves with the tide, so a piling at low water shows a dark collar that
  // is under water six hours later.
  float wet = 1.0 - smoothstep(0.0, 0.55, vWorldPosition.y - (uTideHeight + uSplashLine));
  albedo *= mix(1.0, 0.34, wet);
  albedo = mix(albedo, albedo * vec3(0.82, 0.95, 0.86), wet);
  roughness = mix(roughness, 0.18, wet * 0.85);

  vec3 f0 = mix(vec3(0.04), albedo, uMetalness);
  vec3 diffuse = albedo * (1.0 - uMetalness);

  vec3 colour = ef_shadeSurface(diffuse, N, V, clamp(roughness, 0.05, 1.0), 1.0, f0);
  colour = ef_aerialPerspective(colour, vViewDistance, V);

  gl_FragColor = vec4(hdrClamp(colour), 1.0);
}

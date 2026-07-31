// Direct + image-based lighting for the solid world: terrain, props, foliage, birds.
//
// These surfaces cannot use three's own material chain. The light rig is a CSM, which is a
// *stack* of directional lights — one per cascade, each at full intensity — and a material that
// has not been patched by `CSM.setupMaterial` sums all of them and comes out three or four times
// too bright, with three or four overlapping shadow maps. The ocean already solved this by
// shading from the ephemeris uniforms directly, and everything here follows it, so the whole
// world is lit by exactly one description of where the sun is.
//
// Radiance in, radiance out, in real units. No tone mapping and no gamma: that is the
// composer's job, and doing it twice is what makes a frame look like a shader toy.

#ifndef ENDLESS_FISHING_WORLDLIGHT
#define ENDLESS_FISHING_WORLDLIGHT

#include /lib/constants.glsl
#include /lib/airlight.glsl

uniform vec3 uSunDirection;
uniform vec3 uSunColour;
/** Sun illuminance already divided by π — the radiance a white lambertian surface returns. */
uniform float uSunIlluminance;
uniform vec3 uMoonDirection;
uniform vec3 uMoonColour;
uniform float uMoonIlluminance;
/** The sky probe's raw cubemap. Its mip chain stands in for roughness prefiltering. */
uniform samplerCube uEnvironment;
uniform float uEnvironmentIntensity;
/** Meteorological visibility, metres. Drives the aerial perspective below. */
uniform float uVisibility;

float ef_ggx(float nDotH, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float d = nDotH * nDotH * (a2 - 1.0) + 1.0;
  return a2 / max(EPS, PI * d * d);
}

float ef_smith(float nDotV, float nDotL, float roughness) {
  float k = roughness * roughness * 0.5;
  return (nDotV / (nDotV * (1.0 - k) + k)) * (nDotL / (nDotL * (1.0 - k) + k));
}

vec3 ef_fresnel(float cosTheta, vec3 f0) {
  float m = clamp(1.0 - cosTheta, 0.0, 1.0);
  float m2 = m * m;
  return f0 + (1.0 - f0) * m2 * m2 * m;
}

/**
 * One directional source, diffuse + GGX specular.
 *
 * The horizon fade is not cosmetic: the ephemeris keeps handing us a sun a fraction of a degree
 * below the horizon while refraction still shows its disc, and a hard cut at y = 0 puts a
 * visible line across every lit surface at the moment of sunset.
 */
vec3 ef_directLight(
    vec3 L, vec3 colour, float illuminance,
    vec3 N, vec3 V, vec3 albedo, vec3 f0, float roughness) {
  if (illuminance <= 0.0) return vec3(0.0);

  float nDotL = dot(N, L);
  if (nDotL <= 0.0) return vec3(0.0);

  float horizon = smoothstep(-0.035, 0.02, L.y);
  if (horizon <= 0.0) return vec3(0.0);

  float nDotV = max(1e-3, dot(N, V));
  vec3 H = normalize(L + V);
  float nDotH = max(0.0, dot(N, H));

  float D = ef_ggx(nDotH, roughness);
  float G = ef_smith(nDotV, nDotL, roughness);
  vec3 F = ef_fresnel(max(0.0, dot(H, V)), f0);
  vec3 specular = (D * G / (4.0 * nDotV * nDotL + EPS)) * F;

  return colour * illuminance * nDotL * horizon * (albedo * INV_PI * (1.0 - F) + specular);
}

/**
 * Full shading for an opaque world surface.
 *
 * `occlusion` is a plain multiplier on the ambient term only — occluding the direct sun as well
 * is the classic way an ambient-occlusion map turns into a dirt map.
 */
vec3 ef_shadeSurface(vec3 albedo, vec3 N, vec3 V, float roughness, float occlusion, vec3 f0) {
  vec3 colour = vec3(0.0);
  colour += ef_directLight(uSunDirection, uSunColour, uSunIlluminance, N, V, albedo, f0, roughness);
  colour += ef_directLight(uMoonDirection, uMoonColour, uMoonIlluminance, N, V, albedo, f0, roughness);

  // Ambient from the probe: a wide sample along the normal for diffuse, a mirror sample for the
  // specular lobe. Two fetches rather than a full split-sum approximation, which at these
  // roughnesses and against a sky this low-frequency is not a difference anyone can see.
  vec3 irradiance = textureCubeLodEXT(uEnvironment, N, 6.0).rgb * uEnvironmentIntensity;
  vec3 R = reflect(-V, N);
  vec3 reflection = textureCubeLodEXT(uEnvironment, R, roughness * 7.0).rgb * uEnvironmentIntensity;

  float nDotV = max(1e-3, dot(N, V));
  vec3 F = ef_fresnel(nDotV, f0);
  colour += albedo * irradiance * occlusion;
  colour += reflection * F * occlusion;

  return colour;
}

/**
 * Aerial perspective, Koschmieder's law.
 *
 * `visibility` is defined as the distance at which contrast falls to 2%, which fixes the
 * extinction coefficient at ln(50)/V — so the haze is not a tuned fog curve, it is the same
 * number the weather system puts on the HUD. The colour it fades towards is the sky in the
 * direction being looked at, sampled from the probe, which is why an island in front of a
 * sunset goes orange rather than grey.
 */
vec3 ef_aerialPerspective(vec3 colour, float distanceToCamera, vec3 V) {
  float extinction = 3.912 / max(200.0, uVisibility);
  float t = 1.0 - exp(-extinction * distanceToCamera);
  return mix(colour, ef_airLight(uEnvironment, uEnvironmentIntensity, V), t);
}

#endif

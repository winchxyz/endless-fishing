// Island surface: sand, wet sand, rock, turf.
//
// Three masks decide everything, and all three are read off the geometry rather than painted:
//
//   Slope      The gradient of the heightfield. Anything steeper than about 40° cannot hold
//              sand or soil, so it is bare rock. This is why the cliffs are where the cliffs
//              are and not where a texture artist put them.
//   Tide band  Sand exists between the tide marks and a little above; above the last high water
//              it gives way to turf, below the low water mark it runs on into the seabed.
//   Wetness    The band the tide has uncovered but not yet dried. This is the one that sells a
//              coastline: a dark, glossy strip of saturated sand whose *width* tracks the state
//              of the tide, wide at low water on a spring and almost gone at high water on a
//              neap. Without it a beach reads as a painted edge no matter how good the geometry.
//
// Wet sand is darker and shinier for a real reason. The water fills the gaps between grains and
// replaces sand–air interfaces with sand–water ones; less light is scattered straight back out,
// so more of it is absorbed on its way through, and the surface film is smooth enough to reflect
// the sky. Both effects are applied below, not one of them.

precision highp float;

#include /lib/worldlight.glsl

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying float vViewDistance;

uniform sampler2D uSandAlbedo;
uniform sampler2D uSandNormal;
uniform sampler2D uSandOrm;
uniform sampler2D uRockAlbedo;
uniform sampler2D uRockNormal;
uniform sampler2D uRockOrm;

/** Current water level, metres. The waterline moves with this and nothing else. */
uniform float uTideHeight;
/** Highest and lowest water in the current forecast window — the extent of the tide band. */
uniform float uHighWaterMark;
uniform float uLowWaterMark;
uniform float uTime;

const float SAND_SCALE = 0.28;
const float ROCK_SCALE = 0.11;

/** Northern beach sand: pale, cool, never golden. */
const vec3 SAND_TINT = vec3(0.82, 0.80, 0.74);
/** Machair and heather above the strand line. Olive, low albedo, no green screaming. */
const vec3 TURF_COLOUR = vec3(0.098, 0.116, 0.068);

/**
 * Triplanar sample. Cliffs are close to vertical, and a plain XZ projection on a vertical face
 * stretches one texel over the whole drop.
 */
vec4 triplanar(sampler2D tex, vec3 position, vec3 weights, float scale) {
  vec4 x = texture2D(tex, position.zy * scale);
  vec4 y = texture2D(tex, position.xz * scale);
  vec4 z = texture2D(tex, position.xy * scale);
  return x * weights.x + y * weights.y + z * weights.z;
}

/** Tangent-space normal applied to an up-facing surface mapped in the XZ plane. */
vec3 applyPlanarNormal(vec3 geometric, vec3 packed, float strength) {
  vec3 tangentNormal = packed * 2.0 - 1.0;
  vec3 slope = vec3(tangentNormal.x, 0.0, tangentNormal.y) * strength;
  return normalize(geometric + slope);
}

void main() {
  vec3 viewVector = cameraPosition - vWorldPosition;
  vec3 V = viewVector / max(EPS, vViewDistance);
  vec3 geometric = normalize(vNormal);

  // ------------------------------------------------------------------------------- masks
  float aboveWater = vWorldPosition.y - uTideHeight;
  float slope = 1.0 - clamp(geometric.y, 0.0, 1.0);
  float rockMask = smoothstep(0.24, 0.52, slope);

  // Above the last high water the sand runs out into turf, over about a metre and a half of
  // height — which on a shallow beach is tens of metres of ground, and on a steep one is a
  // sharp strand line. The geometry decides which, as it does on a real coast.
  float turfMask = smoothstep(uHighWaterMark + 0.3, uHighWaterMark + 1.8, vWorldPosition.y);
  turfMask *= 1.0 - rockMask;

  // ---------------------------------------------------------------------------- material
  vec3 weights = abs(geometric);
  weights = weights / max(EPS, weights.x + weights.y + weights.z);

  vec2 sandUv = vWorldPosition.xz * SAND_SCALE;
  vec3 sandAlbedo = texture2D(uSandAlbedo, sandUv).rgb * SAND_TINT;
  vec3 sandOrm = texture2D(uSandOrm, sandUv).rgb;
  vec3 sandNormal = texture2D(uSandNormal, sandUv).rgb;

  vec3 rockAlbedo = triplanar(uRockAlbedo, vWorldPosition, weights, ROCK_SCALE).rgb;
  vec3 rockOrm = triplanar(uRockOrm, vWorldPosition, weights, ROCK_SCALE).rgb;
  vec3 rockNormal = triplanar(uRockNormal, vWorldPosition, weights, ROCK_SCALE).rgb;

  // Turf keeps the sand map's high frequencies as its own clumping — heather and marram have
  // structure at the same scale — but none of its colour.
  float grain = ef_luminance(texture2D(uSandAlbedo, sandUv * 2.7).rgb);
  vec3 turfAlbedo = TURF_COLOUR * (0.55 + 0.9 * grain);

  vec3 albedo = mix(sandAlbedo, turfAlbedo, turfMask);
  albedo = mix(albedo, rockAlbedo, rockMask);

  float roughness = mix(mix(sandOrm.g, 0.92, turfMask), rockOrm.g, rockMask);
  float occlusion = mix(mix(sandOrm.r, sandOrm.r * 0.85, turfMask), rockOrm.r, rockMask);

  vec3 N = applyPlanarNormal(geometric, mix(sandNormal, rockNormal, rockMask), 1.0 - rockMask * 0.4);
  N = normalize(mix(N, geometric, smoothstep(120.0, 700.0, vViewDistance)));

  // -------------------------------------------------------------------------- wet sand
  //
  // How far above the water a point can be and still be soaked is the height the tide has
  // dropped since it turned. At high water that span is nothing and the strip disappears; at
  // low water on a spring it is the whole range and the beach is dark to the dune line.
  float dryingSpan = max(0.0, uHighWaterMark - uTideHeight);
  float wetness = 1.0 - smoothstep(0.0, 0.25 + dryingSpan * 0.9, aboveWater);
  wetness *= 1.0 - rockMask * 0.55;
  wetness *= 1.0 - turfMask;
  wetness = clamp(wetness, 0.0, 1.0);

  // Saturating the pores removes back-scatter, so less light escapes on the first bounce and
  // the sand darkens towards its own transmission colour rather than towards grey.
  albedo *= mix(1.0, 0.42, wetness);
  albedo = mix(albedo, albedo * vec3(0.94, 1.0, 1.02), wetness);
  roughness = mix(roughness, 0.13, wetness * wetness);

  // A film of water is dielectric with a much higher reflectance than damp sand, which is what
  // makes a wet beach mirror the sky at a grazing angle.
  vec3 f0 = mix(vec3(0.035), vec3(0.02), rockMask);
  f0 = mix(f0, vec3(0.05), wetness);

  vec3 colour = ef_shadeSurface(albedo, N, V, clamp(roughness, 0.05, 1.0), occlusion, f0);

  // ------------------------------------------------------------------------- swash line
  //
  // The thin bright line where the last wave ran up and drained. It lives in a narrow height
  // band just above the water, breathes on the swell period, and is off-white — foam that
  // reaches pure white is the fastest way to lose a photographic frame.
  float swashBand = 1.0 - smoothstep(0.0, 0.22, abs(aboveWater - 0.06));
  float breathe = 0.5 + 0.5 * sin(uTime * 0.7 + vWorldPosition.x * 0.05 + vWorldPosition.z * 0.037);
  float swash = swashBand * (0.35 + 0.65 * breathe) * (1.0 - rockMask * 0.7);
  vec3 skyAbove = textureCubeLodEXT(uEnvironment, vec3(0.0, 1.0, 0.0), 5.0).rgb * uEnvironmentIntensity;
  vec3 foamColour = (skyAbove * 0.5 + uSunColour * uSunIlluminance * 0.18) * vec3(0.94, 0.96, 0.97);
  colour = mix(colour, foamColour, clamp(swash, 0.0, 0.75));

  // Ground below the water is seen through the ocean's own refraction pass, which applies the
  // absorption. All this owes it is the loss on the way *in*, which is why it darkens with
  // depth but does not turn blue here.
  float submerged = smoothstep(0.0, -1.6, aboveWater);
  colour *= mix(1.0, 0.45, submerged);

  colour = ef_aerialPerspective(colour, vViewDistance, V);

  gl_FragColor = vec4(hdrClamp(colour), 1.0);
}

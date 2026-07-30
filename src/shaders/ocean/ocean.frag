// Ocean surface shading.
//
// The reference is a photograph of a northern sea, so the colour has to come from the physics
// rather than from a palette. Everything below is a real optical mechanism:
//
//   Fresnel            Water reflects almost nothing straight down (2%) and almost everything
//                      at a grazing angle (100%). That single curve is why the sea near your
//                      feet is dark green and the sea at the horizon is the colour of the sky,
//                      and it is the largest single contributor to a frame reading as water.
//   Absorption         Water is not blue; it *absorbs* red. Jerlov's measured coefficients for
//                      coastal and open water give green-grey shallows and deep slate offshore.
//   Subsurface         Light entering the back of a crest scatters forward through a thin sheet
//                      of water and glows. This is the effect that makes a low sun through a
//                      breaking wave look like a lamp behind green glass.
//   Glitter            The sun's reflection is not a blob but a long streak, because the
//                      distribution of sub-pixel wave slopes widens with distance. Rolling the
//                      unresolved normal variance into the GGX roughness reproduces the whole
//                      path — length, taper and all — with no special case.
//   Foam               Where the Jacobian of the horizontal displacement drops, the surface is
//                      piling up on itself. That is where real foam is, and nowhere else.

precision highp float;

#include /lib/constants.glsl

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying float vJacobian;
varying float vViewDistance;
varying vec2 vUndisplaced;

uniform vec3 uCameraPosition;
uniform float uTime;

// --- lighting -------------------------------------------------------------------------------
uniform vec3 uSunDirection;
uniform vec3 uSunColour;
uniform float uSunIlluminance;
uniform vec3 uMoonDirection;
uniform vec3 uMoonColour;
uniform float uMoonIlluminance;
uniform samplerCube uEnvironment;
uniform float uEnvironmentIntensity;

// --- water ----------------------------------------------------------------------------------
uniform sampler2D uDetailNormal;
uniform sampler2D uFoam;
uniform vec2 uWindDirection;
uniform float uWindSpeed;
/** Depth of the seabed below mean water level at this point, metres. */
uniform float uSeabedDepth;
/** 0 = clear offshore water, 1 = turbid coastal water. Interpolates the Jerlov coefficients. */
uniform float uTurbidity;
uniform float uFoamAmount;
uniform float uWaterLevel;

// --- refraction -----------------------------------------------------------------------------
uniform sampler2D uRefraction;
uniform vec2 uResolution;
uniform float uRefractionStrength;

/**
 * Diffuse attenuation coefficients, per metre, for red/green/blue.
 *
 * Jerlov water type I (clearest open ocean) and type 5C (turbid coastal). Red is absorbed an
 * order of magnitude faster than blue-green in clear water, which is the entire reason the
 * deep sea is the colour it is. In coastal water yellow substance and sediment lift the blue
 * absorption sharply, which is why an estuary is green-brown rather than blue.
 */
const vec3 ABSORPTION_OCEANIC = vec3(0.42, 0.072, 0.028);
const vec3 ABSORPTION_COASTAL = vec3(0.56, 0.19, 0.31);

/** Volume scattering: what comes back up out of the water column towards the eye. */
const vec3 SCATTER_OCEANIC = vec3(0.010, 0.038, 0.055);
const vec3 SCATTER_COASTAL = vec3(0.028, 0.062, 0.048);

/** Index of refraction of sea water at 550 nm. Gives F0 = 0.0203. */
const float WATER_F0 = 0.0203;

vec3 fresnelSchlick(float cosTheta, float f0) {
  float m = clamp(1.0 - cosTheta, 0.0, 1.0);
  float m2 = m * m;
  return vec3(f0 + (1.0 - f0) * m2 * m2 * m);
}

/** GGX normal distribution. */
float distributionGGX(float nDotH, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float d = nDotH * nDotH * (a2 - 1.0) + 1.0;
  return a2 / max(EPS, PI * d * d);
}

float smithGGX(float nDotV, float nDotL, float roughness) {
  float a = roughness * roughness;
  float k = a * 0.5;
  float gv = nDotV / (nDotV * (1.0 - k) + k);
  float gl = nDotL / (nDotL * (1.0 - k) + k);
  return gv * gl;
}

/**
 * Two scales of capillary ripple, scrolling along the wind.
 *
 * The texture packs one normal in RG and a second, coprime-period one in BA, so both scales
 * come from a single fetch. Both fade out with distance: past a few hundred metres their
 * wavelength is far below a pixel, and keeping them would alias into a shimmering mess rather
 * than adding detail. What replaces them is the roughness widening in the glitter term, which
 * is the statistically correct thing to do with detail you can no longer resolve.
 */
vec3 detailNormal(vec2 worldXZ, float distanceToCamera, float windFactor) {
  vec2 drift = uWindDirection * uTime * (0.35 + uWindSpeed * 0.05);

  vec4 a = texture2D(uDetailNormal, worldXZ * 0.055 + drift * 0.02);
  vec4 b = texture2D(uDetailNormal, worldXZ * 0.21 - drift * 0.045);

  vec2 slopeA = (a.rg * 2.0 - 1.0);
  vec2 slopeB = (b.ba * 2.0 - 1.0);

  float fadeA = 1.0 - smoothstep(180.0, 900.0, distanceToCamera);
  float fadeB = 1.0 - smoothstep(40.0, 260.0, distanceToCamera);

  vec2 slope = (slopeA * fadeA * 0.65 + slopeB * fadeB * 0.45) * windFactor;
  return normalize(vec3(slope.x, 1.0, slope.y));
}

void main() {
  vec3 viewVector = uCameraPosition - vWorldPosition;
  float viewDistance = length(viewVector);
  vec3 V = viewVector / max(EPS, viewDistance);

  // Ripples need wind to exist; on a glassy calm the surface really is a mirror.
  float windFactor = smoothstep(0.4, 5.0, uWindSpeed);

  // Flatten the wave normal towards vertical with distance.
  //
  // At the horizon a single pixel covers many whole wavelengths, so the slope it should show is
  // the *average* over all of them — which is flat — and shading it with whichever slope
  // happened to land at the sample point produces a band of violent specular sparkle that no
  // amount of antialiasing removes, because it is not an edge artefact, it is a signal the
  // pixel cannot represent. The energy is not thrown away: it comes back through the roughness
  // term below, which is the statistically correct place to put detail you cannot resolve.
  float unresolvedSlope = smoothstep(260.0, 2600.0, viewDistance);
  vec3 geometricNormal =
      normalize(mix(normalize(vNormal), vec3(0.0, 1.0, 0.0), unresolvedSlope * 0.88));
  vec3 ripple = detailNormal(vUndisplaced, viewDistance, windFactor);
  // Blend the ripple into the wave normal in the wave's own tangent frame, so a ripple on the
  // face of a swell tilts with the swell instead of always pointing up.
  vec3 N = normalize(vec3(
      geometricNormal.x + ripple.x,
      geometricNormal.y * ripple.y,
      geometricNormal.z + ripple.z));

  float nDotV = max(1e-3, dot(N, V));

  // ---------------------------------------------------------------------------- foam
  //
  // Two sources. The Jacobian catches breaking crests wherever they are, and it is genuinely
  // physical: below 1 the surface is compressing, below 0 it has folded. The wind term stops
  // a dead calm from producing whitecaps that could not exist.
  float compression = clamp(1.0 - vJacobian, 0.0, 2.0);
  float whitecapThreshold = mix(0.62, 0.22, smoothstep(4.0, 20.0, uWindSpeed));
  float crestFoam = smoothstep(whitecapThreshold, whitecapThreshold + 0.34, compression);

  vec4 foamSample = texture2D(uFoam, vUndisplaced * 0.09);
  float foamBreakup = foamSample.r * (0.55 + 0.45 * foamSample.b);
  float foamMask = clamp(crestFoam * uFoamAmount * (0.35 + foamBreakup), 0.0, 1.0);
  // Erode the edges with the fine channel so foam dissolves into the water rather than
  // fading uniformly to transparent.
  foamMask *= smoothstep(0.0, 0.35, foamMask + foamSample.g * 0.35 - 0.18);

  // ---------------------------------------------------------------------- reflection
  vec3 R = reflect(-V, N);
  // Never sample below the horizon: at a grazing angle the reflected ray can dip under the
  // surface, and a black sample there puts a hard dark band across the distance.
  R.y = max(R.y, 0.008);

  // Roughness carries the sub-pixel slope variance. Near the camera the normal map resolves
  // the ripples, so the surface is nearly smooth; at distance it cannot, so the roughness
  // grows to represent the same detail statistically. This is what turns the specular
  // highlight into a glitter path that stretches to the horizon.
  float unresolved = smoothstep(30.0, 1400.0, viewDistance);
  // The ceiling rises with the slope flattening above, so the sun's glitter path keeps the
  // energy the geometry gave up and simply spreads it, which is what a real glitter path is.
  float roughness = mix(0.028, 0.11 + 0.20 * windFactor, unresolved);
  roughness = mix(roughness, 0.34, unresolvedSlope);
  roughness = mix(roughness, 0.6, foamMask);

  // The probe cubemap's mip chain stands in for pre-filtered roughness.
  float mip = roughness * 7.0;
  vec3 reflection = textureCubeLodEXT(uEnvironment, R, mip).rgb * uEnvironmentIntensity;

  vec3 fresnel = fresnelSchlick(nDotV, WATER_F0);

  // ---------------------------------------------------------------------- refraction
  vec2 screenUv = gl_FragCoord.xy / uResolution;
  // Distortion shrinks with distance: a fixed offset in screen space is an enormous offset in
  // world space far away, which drags foreground colour onto the horizon.
  float distortionScale = uRefractionStrength / (1.0 + viewDistance * 0.06);
  vec2 refractedUv = clamp(screenUv + N.xz * distortionScale, vec2(0.002), vec2(0.998));
  vec3 behind = texture2D(uRefraction, refractedUv).rgb;

  // Optical depth of water between the eye and whatever is behind the surface. Grazing views
  // travel through far more water, which is why a distant sea is opaque and the water at your
  // feet is not.
  float pathLength = uSeabedDepth / max(0.12, nDotV);
  vec3 absorption = mix(ABSORPTION_OCEANIC, ABSORPTION_COASTAL, uTurbidity);
  vec3 scatterColour = mix(SCATTER_OCEANIC, SCATTER_COASTAL, uTurbidity);
  vec3 transmittance = exp(-absorption * pathLength);

  // Light that got into the water, bounced around and came back out.
  vec3 skyAbove = textureCubeLodEXT(uEnvironment, vec3(0.0, 1.0, 0.0), 5.0).rgb * uEnvironmentIntensity;
  vec3 sunlight = uSunColour * uSunIlluminance + uMoonColour * uMoonIlluminance;
  vec3 upwelling = scatterColour * (skyAbove * 0.55 + sunlight * 0.35 * max(0.0, uSunDirection.y));
  vec3 refracted = behind * transmittance + upwelling * (1.0 - transmittance);

  // ------------------------------------------------------------------- direct specular
  vec3 specular = vec3(0.0);
  vec3 subsurface = vec3(0.0);

  // The sun and the moon go through the same path — the moon's glitter track across the water
  // is the same physics as the sun's, four hundred thousand times dimmer.
  for (int light = 0; light < 2; light++) {
    vec3 L = light == 0 ? uSunDirection : uMoonDirection;
    vec3 colour = light == 0 ? uSunColour : uMoonColour;
    float illuminance = light == 0 ? uSunIlluminance : uMoonIlluminance;
    if (illuminance <= 0.0 || L.y <= -0.02) continue;

    vec3 H = normalize(L + V);
    float nDotL = max(0.0, dot(N, L));
    float nDotH = max(0.0, dot(N, H));

    float D = distributionGGX(nDotH, roughness);
    float G = smithGGX(nDotV, max(1e-3, nDotL), roughness);
    vec3 F = fresnelSchlick(max(0.0, dot(H, V)), WATER_F0);
    specular += (D * G / (4.0 * nDotV * max(1e-3, nDotL) + EPS)) * F * colour * illuminance * nDotL;

    // Subsurface: strongest looking into the sun through the back of a wave, and proportional
    // to how far the local surface has risen above the mean — that is, how thin the crest is.
    float backlight = pow(max(0.0, dot(V, -L)), 3.5);
    float crestHeight = clamp((vWorldPosition.y - uWaterLevel) * 0.55 + 0.35, 0.0, 1.0);
    float thinness = pow(crestHeight, 2.0) * max(0.0, 1.0 - abs(L.y) * 1.6);
    subsurface += colour * illuminance * backlight * thinness * 0.16;
  }

  // Subsurface colour is the water's own transmission colour — green-turquoise, because that
  // is what survives a few centimetres of sea water.
  subsurface *= vec3(0.32, 0.78, 0.62);

  // ------------------------------------------------------------------------ composite
  vec3 water = mix(refracted, reflection, fresnel) + specular + subsurface;

  // Foam is off-white and slightly blue in shadow, never pure white — pure white foam is the
  // single fastest way to make an ocean look like a shader demo.
  vec3 foamAmbient = skyAbove * 0.42;
  vec3 foamDirect = sunlight * 0.16 * max(0.0, dot(N, uSunDirection));
  vec3 foamColour = (foamAmbient + foamDirect) * vec3(0.94, 0.96, 0.97);
  vec3 colour = mix(water, foamColour, foamMask);

  gl_FragColor = vec4(hdrClamp(colour), 1.0);
}

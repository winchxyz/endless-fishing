// Shading for the wake ribbon.
//
// The ribbon is not a surface in its own right — the ocean is already drawn underneath it, and
// whatever the water does there is right. So this shader contributes exactly the two things the
// wake *adds* to that water, and nothing else:
//
//   * **Foam**, which covers it. Aerated water is opaque, so this is an over-blend, and the
//     texture, the fetch scale and the erosion curve are the ones `ocean.frag` uses for its own
//     whitecaps. That is deliberate: a wake made of a different white than the crests beside it
//     reads instantly as a decal stuck on the sea.
//   * **Glint**, which is added. The wake's crests tilt the surface, and a tilted surface catches
//     the sun and the moon somewhere the flat water beside it does not. That is what makes the V
//     read as a train of waves rather than as a painted stripe, and it is why the pattern is
//     brightest looking down-sun and nearly invisible looking up-sun, exactly as a real one is.
//
// Output is premultiplied — colour already multiplied by coverage — so the foam composites over
// the water while the specular is simply added on top of it, in one pass and one draw call.
//
// There is no aerial perspective here for the same reason `ocean.frag` has none: the sea beneath
// is unfogged, and fogging the foam on top of it would put a haze-coloured stripe on clear water.

precision highp float;

#include /lib/worldlight.glsl

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUndisplaced;
varying float vFoam;
varying float vFade;

uniform sampler2D uFoam;

/** Index of refraction of sea water at 550 nm, as a Schlick F0. Same value the ocean uses. */
const float WATER_F0 = 0.0203;

void main() {
  // The tail of the buffer and the far edges of the wedge are fully faded; there is nothing to
  // composite there and the ribbon is large enough on screen for the early out to be worth it.
  if (vFade <= 0.002) discard;

  vec3 viewVector = cameraPosition - vWorldPosition;
  float viewDistance = length(viewVector);
  vec3 V = viewVector / max(EPS, viewDistance);
  vec3 N = normalize(vNormal);

  vec4 foamSample = texture2D(uFoam, vUndisplaced * 0.09);
  float breakup = foamSample.r * (0.55 + 0.45 * foamSample.b);
  float coverage = clamp(vFoam * (0.35 + breakup), 0.0, 1.0);
  // Erode from the edges with the fine channel, so a dissipating wake thins out from its
  // boundary as if the water were absorbing it rather than fading uniformly to transparent.
  coverage *= smoothstep(0.0, 0.35, coverage + foamSample.g * 0.35 - 0.18);

  vec3 skyAbove = textureCubeLodEXT(uEnvironment, vec3(0.0, 1.0, 0.0), 5.0).rgb * uEnvironmentIntensity;
  vec3 sunlight = uSunColour * uSunIlluminance + uMoonColour * uMoonIlluminance;
  // Off-white and slightly blue in shadow. Pure white foam is the single fastest way to make an
  // ocean look like a shader demo.
  vec3 foamColour = (skyAbove * 0.42 + sunlight * 0.16 * max(0.0, dot(N, uSunDirection)))
      * vec3(0.94, 0.96, 0.97);

  // The sun and the moon go down the same path; the moon's track across a wake at night is the
  // same physics four hundred thousand times dimmer.
  float nDotV = max(1e-3, dot(N, V));
  vec3 specular = vec3(0.0);
  for (int light = 0; light < 2; light++) {
    vec3 L = light == 0 ? uSunDirection : uMoonDirection;
    vec3 colour = light == 0 ? uSunColour : uMoonColour;
    float illuminance = light == 0 ? uSunIlluminance : uMoonIlluminance;
    if (illuminance <= 0.0 || L.y <= -0.02) continue;

    // Foam scatters; clean water in the trough does not. Widening the lobe with coverage is
    // what stops the aerated near field from mirroring the sun as if it were glass.
    float roughness = mix(0.075, 0.55, coverage);
    vec3 H = normalize(L + V);
    float nDotL = max(1e-3, dot(N, L));
    float D = ef_ggx(max(0.0, dot(N, H)), roughness);
    float G = ef_smith(nDotV, nDotL, roughness);
    vec3 F = ef_fresnel(max(0.0, dot(H, V)), vec3(WATER_F0));
    specular += (D * G / (4.0 * nDotV * nDotL + EPS)) * F * colour * illuminance * nDotL;
  }

  // `vFoam` already carries the speed and the age envelope, so the coverage is the alpha;
  // folding `vFade` in again here would take the wake down twice for the same reason.
  float alpha = clamp(coverage, 0.0, 1.0);
  gl_FragColor = vec4(hdrClamp(foamColour * alpha + specular * vFade * 0.6), alpha);
}

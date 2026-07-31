// The colour a distant surface fades into.
//
// Its own file rather than a function in `constants.glsl`, because it samples a cubemap and
// `constants.glsl` is included by vertex shaders too — `textureCubeLodEXT` is only defined in
// three's fragment prefix, so putting it there takes out the spray and the rain at compile time
// on a machine where the extension is not silently available in both stages.

#ifndef ENDLESS_FISHING_AIRLIGHT
#define ENDLESS_FISHING_AIRLIGHT

#include /lib/constants.glsl

/**
 * The colour a distant surface fades into: the sky along the line of sight, from the probe.
 *
 * Two details, and both of them are the difference between haze and a grey wash.
 *
 * The direction is held above the horizon. The probe is a picture of the whole world, and its
 * lower hemisphere is the sea — which is far darker than the sky. Sampling it towards a distant
 * object means sampling *through* the horizon, and the answer comes back part sky and part water:
 * a sea fog at 120 m visibility that still drew a horizon forty code values deep, because the sea
 * was fading towards a colour that was itself half sea. What airlight actually is, is the light
 * scattered into the path by the air, and over open water at any distance worth fogging that is
 * the sky just above the horizon. Clamping the elevation is what says so.
 *
 * The mip is low for the same reason, and the elevation has to clear its footprint. Level 4
 * averages a sixty-degree cone, which puts the water straight back into the sample however the
 * direction is clamped. Level 1 is a sixty-four-pixel face — a degree and a half a texel — so a
 * bilinear fetch four degrees up sits entirely clear of the row of texels the horizon runs
 * through, which is the row that was doing the damage. Four degrees of elevation costs a few per
 * cent of radiance against the true horizon; the row it avoids cost twenty code values.
 *
 * Not level 0, and that is the other lesson this project has already paid for: a mip 0 texel is
 * seven tenths of a degree, which is about the size of the sun. A celestial disc is a delta
 * function the cube cannot represent, one texel takes its whole energy, and anything that reads
 * that texel back gets sixty thousand candelas where it expected sky. A degree and a half spreads
 * it over four times the area and the haze stays haze.
 */
vec3 ef_airLight(samplerCube environment, float intensity, vec3 V) {
  vec3 direction = normalize(vec3(-V.x, max(-V.y, 0.07), -V.z) + vec3(EPS, 0.0, 0.0));
  return textureCubeLodEXT(environment, direction, 1.0).rgb * intensity;
}

#endif

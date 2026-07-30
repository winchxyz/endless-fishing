// Shared numeric constants. Included by almost every shader in the project.

#ifndef ENDLESS_FISHING_CONSTANTS
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;
const float TWO_PI = 6.28318530717958647692;
const float HALF_PI = 1.57079632679489661923;
const float INV_PI = 0.31830988618379067154;
const float INV_FOUR_PI = 0.07957747154594766788;
const float DEG_TO_RAD = 0.01745329251994329577;
const float RAD_TO_DEG = 57.2957795130823208768;

// Guard for divisions that can legitimately approach zero at grazing angles.
const float EPS = 1e-6;

// three already provides `saturate` as a *macro* in its shader prefix. Defining a function of
// the same name is not a redefinition clash — the macro expands first and turns the definition
// itself into a syntax error. Guarding on the macro lets these shaders compile either way:
// under three they use its macro, and standalone they get real overloads.
#ifndef saturate
float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }
#endif

// Rec. 709 luminance. Used by the exposure controller, the foam mask and the grade.
//
// Named with a prefix rather than plain `luminance` because three injects its own
// `float luminance(const in vec3)` into every ShaderMaterial fragment shader as part of the
// tone-mapping chunk. Same maths, incompatible parameter qualifiers, and the resulting
// "function already has a body" takes the whole program down.
float ef_luminance(vec3 colour) {
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {
  return lowOut + (saturate((x - lowIn) / (highIn - lowIn))) * (highOut - lowOut);
}

/**
 * Clamp a physical radiance into the range a half-float buffer can carry.
 *
 * The scene is authored in real units, and the sun's disc is genuinely about 1.6 billion
 * candela per square metre. A half float tops out at 65504, so writing the true value stores
 * `Infinity` — and the bloom pass then averages that infinity down its mip chain and returns a
 * white frame. Every pixel. This is why noon rendered as a blank white image and midnight
 * rendered fine.
 *
 * 60000 is about four stops above a correctly exposed white at any time of day, which is all
 * the headroom ACES and the bloom threshold can actually use. The clamp is invisible: nothing
 * downstream can distinguish 60000 from 1.6e9 after tone mapping.
 *
 * The `equal` test also strips NaN, which would otherwise survive tone mapping as a black or
 * white speck that flickers.
 */
vec3 hdrClamp(vec3 colour) {
  vec3 safe = mix(colour, vec3(0.0), vec3(notEqual(colour, colour)));
  return min(safe, vec3(60000.0));
}

#endif

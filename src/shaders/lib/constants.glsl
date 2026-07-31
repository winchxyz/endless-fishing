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

/**
 * Linear remap with the input range clamped.
 *
 * The zero-span case is handled explicitly rather than left to the division. No call site is
 * meant to pass one, but the cloud field's coverage remap divides by `1.0 - (1.0 - cover)`, and
 * in float32 `1.0 - cover` rounds to exactly 1.0 for every cover below 2⁻²⁵ — so a sky damping
 * down to no cloud at all walks through a window where the span really is zero. That produces
 * 0/0, and `saturate` is not specified to remove a NaN: it is a `clamp`, and clamp's NaN
 * behaviour is implementation-defined. One NaN in the cloud march is a black pixel with the sky
 * erased behind it.
 */
float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {
  float span = highIn - lowIn;
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;
  return lowOut + saturate(t) * (highOut - lowOut);
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
 * It also has to strip NaN, and for a long time it did not.
 *
 * The previous form was `mix(colour, vec3(0.0), vec3(notEqual(colour, colour)))`, which reads
 * like a select and is not one: casting the bvec3 to a vec3 selects mix's FLOAT overload, and
 * that is defined as `x*(1-a) + y*a`. For a NaN lane that evaluates `NaN*0.0 + 0.0*1.0`, which
 * is still NaN. The bvec3 overload — the one that really is a select — only exists from GLSL ES
 * 3.00, and these programs compile as 1.00, so the portable answer is a ternary per component.
 *
 * This mattered: a NaN reaching the premultiplied cloud buffer erases the sky behind it, which
 * is what the black speckle was, and the guard that was added for it was on the alpha channel
 * while the NaN was in the colour.
 */
vec3 hdrClamp(vec3 colour) {
  vec3 safe;
  safe.x = colour.x == colour.x ? colour.x : 0.0;
  safe.y = colour.y == colour.y ? colour.y : 0.0;
  safe.z = colour.z == colour.z ? colour.z : 0.0;
  // Clamped at both ends. Radiance is never negative, and a negative infinity walked straight
  // through the old one-sided `min` and came out of the tone mapper as a black speck.
  return clamp(safe, vec3(0.0), vec3(60000.0));
}

/**
 * The alpha-channel half of `hdrClamp`, and it is not optional on a premultiplied blend.
 *
 * `dst' = src + dst·(1 − src.a)` means a NaN alpha does not merely fail to cover what is behind
 * it — it *erases* it, and bloom then averages that NaN across its whole mip chain. Every
 * material in this project that writes an alpha blends that way, and until now only the colour
 * was ever guarded: the cloud layer needed its own `ef_safeTransmittance` for exactly this, and
 * the wake and the spray had nothing at all.
 *
 * Zero rather than one, unlike the cloud's guard: these are additive-over materials where alpha
 * is coverage, so a bad sample should cover nothing. The cloud's alpha is a transmittance, where
 * the safe answer is the opposite.
 */
float hdrClampAlpha(float alpha) {
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);
}

#endif

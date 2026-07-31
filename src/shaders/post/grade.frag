// The colour grade.
//
// Runs after ACES and before SMAA, which is the only place it can run. Before tone mapping the
// signal is physical radiance in the thousands and a "lift" would mean nothing; after
// antialiasing it would be regrading blended edge pixels. Between the two, the frame is
// display-referred and lives in [0, 1], and a lift/gamma/gain means exactly what a colourist
// means by it.
//
// The parameters come from `render/ColourGrade.ts`, which derives them from the real solar
// altitude and the weather. Nothing is decided here; this is the applicator.
//
// This is a per-pixel effect, so it rides in the tone-mapping pass rather than costing a pass
// of its own. See the note in PostFX.rebuildPasses about why that distinction is load-bearing.

uniform vec3 uLift;
uniform vec3 uGamma;
uniform vec3 uGain;
uniform float uSaturation;

/**
 * Interleaved gradient noise. Jorge Jimenez's, and the point of it over a hash is that its error
 * is spectrally flat and stable under a per-pixel screen position, so it never clumps.
 */
float ef_gradientNoise(vec2 fragment) {
  return fract(52.9829189 * fract(dot(fragment, vec2(0.06711056, 0.00583715))));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Grade in an approximately perceptual space, not in linear light. A lift of one percent
  // applied to linear values would be a six percent lift on screen once the sRGB transfer runs
  // at the end of the chain, and the shadows would go milky at numbers that read as harmless.
  // The 2.2 power is the usual working-space approximation to that transfer; it departs from
  // the real piecewise curve only in the deepest part of the toe, well below where a grade of
  // this size does anything.
  vec3 display = pow(max(inputColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));

  display = display * uGain + uLift;

  // The decode back to linear is folded into the grade's own power term, so the round trip
  // costs one pow instead of two. `uGamma` is the ASC CDL power, applied directly: above 1
  // darkens the midtones.
  vec3 graded = pow(max(display, vec3(0.0)), uGamma * 2.2);

  // Saturation last and in linear light, because Rec. 709 luminance is defined on linear light.
  // Mixing towards a "luminance" computed from a display-encoded signal preserves something,
  // but not the luminance it claims to.
  float grey = dot(graded, vec3(0.2126, 0.7152, 0.0722));
  vec3 result = mix(vec3(grey), graded, uSaturation);

  // Dither, and it is not optional on this scene.
  //
  // The composer carries half floats the whole way and the frame buffer takes eight bits, so a
  // gradient that moves less than one code value over tens of pixels quantises into visible
  // steps. A twilight sky is exactly that gradient — the whole dome is a slow ramp through
  // violet — and it came out as a staircase of hard-edged bands across the top of the frame, on
  // the live build, with the grain effect already running. Grain is not a substitute: it blends
  // OVERLAY and therefore scales with the signal, so it does almost nothing in the dark end
  // where the banding is worst.
  //
  // Half a code value of triangular-PDF noise, from two decorrelated samples of the same cheap
  // hash. Triangular rather than uniform because it decorrelates the quantisation error from the
  // signal instead of merely spreading it — the difference between a gradient that looks smooth
  // and one that looks smooth except where it crosses a boundary. It is below the threshold of
  // notice on anything that is not a flat ramp, which is why it can run everywhere.
  vec2 fragment = gl_FragCoord.xy;
  float dither = ef_gradientNoise(fragment) - ef_gradientNoise(fragment + vec2(37.0, 17.0));
  result += dither / 255.0;

  // A saturation above 1 can drive a channel below zero, and the sRGB transfer at the end of
  // the chain would take a fractional power of it. Clamping to the display range is also the
  // honest thing to do here: after ACES there is no such thing as a colour outside [0, 1].
  outputColor = vec4(clamp(result, 0.0, 1.0), inputColor.a);
}

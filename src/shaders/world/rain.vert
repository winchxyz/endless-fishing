// Rain, integrated entirely on the GPU.
//
// A drop's whole life is a closed-form function of its seed and one clock, like the bow spray —
// but where spray is ballistic, rain is not. A raindrop reaches terminal velocity within a couple
// of metres of leaving the cloud and then falls at a constant speed for the next kilometre, so
// there is nothing to integrate at all: the field is a rigid lattice of drops translating at
// `wind + fall`, and every drop in the frame is that lattice sampled around the camera.
//
// Three things are worth reading before changing anything.
//
//   * **The lattice wraps around the camera, and the CPU pre-wraps the drift.** `uDrift` arrives
//     already reduced modulo the box on each axis, so it never grows and never loses precision,
//     however long the session runs. The `mod` here then re-centres the lattice on wherever the
//     boat has got to. Between them the player can steam for an hour in any direction and the
//     rain neither runs out nor slides past at the wrong speed.
//   * **A streak is a shutter, not a sprite.** What a camera records of a falling drop is the
//     distance it travelled while the shutter was open — `velocity × exposure time` — and that
//     is exactly what `uStreak` is. So the rain leans further and draws longer as the wind gets
//     up, for the same reason it does out of a real window, and neither of those is a tuned
//     constant. The one thing that *is* a rendering choice is how many drops there are; the
//     honest count for heavy rain is four thousand per cubic metre, far past any budget, so
//     each instance stands for a great many drops.
//   * **Width is in pixels, length is in metres.** A 2 mm drop at ten metres is a hundredth of a
//     pixel wide: sized in world space the whole field disappears into the sampling grid and what
//     survives is aliasing. Real rain photography shows streaks a pixel or two across at every
//     distance, because that is the point spread function of the lens rather than the size of the
//     drop, and that is what this reproduces — the quad is extruded perpendicular to the streak
//     in screen space, after projection.

precision highp float;

#include /lib/constants.glsl

/** x = ±0.5 across the streak, y = 0 at the head and 1 at the tail. */
attribute vec3 aCorner;
/** The drop's place in the lattice, metres, and its own randoms. */
attribute vec3 aOffset;
attribute vec2 aSeed;

/** Lattice extent, metres. The drop field is this box, wrapped, centred on the camera. */
uniform vec3 uBox;
/** Distance the whole lattice has fallen and blown, already reduced modulo `uBox`. */
uniform vec3 uDrift;
/** `(wind + fall) × shutter`: what one drop draws while the shutter is open, metres. */
uniform vec3 uStreak;
/** Half the drawing buffer, pixels. NDC times this is pixels. */
uniform vec2 uHalfResolution;
/** Streak width, pixels. */
uniform float uWidthPx;
/** Fraction of the budget currently falling, 0..1. */
uniform float uFill;
/** Mean water level, metres. Nothing is drawn below the sea. */
uniform float uWaterLevel;

varying vec3 vWorldPosition;
varying float vFade;
varying vec2 vQuad;

void main() {
  vQuad = vec2(aCorner.x * 2.0, aCorner.y);
  vFade = 0.0;
  vWorldPosition = cameraPosition;

  // Slots above the fill level are not raining. Sent outside the clip volume rather than scaled
  // to nothing, so a light shower costs no rasterisation for the drops it is not drawing.
  if (aSeed.x >= uFill) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  vec3 head = cameraPosition + mod(aOffset + uDrift - cameraPosition + uBox * 0.5, uBox) - uBox * 0.5;
  vWorldPosition = head;
  // Drops vary in size, and a bigger drop falls faster and therefore draws a longer streak. The
  // spread is the same one the drag law gives across the Marshall-Palmer size distribution.
  vec3 streak = uStreak * (0.7 + 0.6 * aSeed.y);

  vec4 clipHead = projectionMatrix * viewMatrix * vec4(head, 1.0);
  vec4 clipTail = projectionMatrix * viewMatrix * vec4(head + streak, 1.0);
  // Either end behind the eye and the perspective divide below is meaningless. One drop out of
  // nine thousand, and clipping it properly would cost every other drop the branch.
  if (clipHead.w <= EPS || clipTail.w <= EPS) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  vec2 pixelHead = clipHead.xy / clipHead.w * uHalfResolution;
  vec2 pixelTail = clipTail.xy / clipTail.w * uHalfResolution;
  vec2 along = pixelTail - pixelHead;
  float lengthPx = length(along);
  // A streak seen end-on has no direction to be perpendicular to. Straight up is as good an
  // answer as any and it is the only one that cannot produce a NaN.
  vec2 direction = lengthPx > 1e-3 ? along / lengthPx : vec2(0.0, 1.0);
  vec2 across = vec2(-direction.y, direction.x) * (uWidthPx * 0.5 * aCorner.x);

  vec4 clip = mix(clipHead, clipTail, aCorner.y);
  clip.xy += across / uHalfResolution * clip.w;
  gl_Position = clip;

  float distanceToEye = distance(head, cameraPosition);
  // Three fades, and each of them is hiding a real edge rather than decorating one: the drop
  // that is about to hit the lens, the wall of the lattice, and the sea the drop falls into.
  vFade =
      smoothstep(0.4, 1.4, distanceToEye) *
      (1.0 - smoothstep(uBox.x * 0.30, uBox.x * 0.46, distanceToEye)) *
      smoothstep(uWaterLevel - 0.1, uWaterLevel + 1.0, head.y) *
      // The gate is soft at its top edge so a slot switching on grows in rather than appearing.
      (1.0 - smoothstep(uFill - 0.08, uFill, aSeed.x));
}

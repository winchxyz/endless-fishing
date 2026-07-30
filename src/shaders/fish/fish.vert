// Fish body deformation — a travelling bend running from the head to the tail.
//
// This is the only thing standing between a school and a formation of arrows. Fish do not
// translate rigidly; they push water backwards with a wave that travels down the body faster
// than the fish itself moves, and the *phase* of that wave is what the eye reads as swimming.
// Rigid instances moving on smooth paths look like a screensaver no matter how good the shading.
//
// The kinematics are carangiform, which is what every species in this table is:
//
//   * The lateral displacement grows along the body as a quadratic envelope, not linearly. A
//     linear growth puts far too much motion in the middle of the fish and reads as a snake.
//     The coefficients below give a small head recoil around s = 0.06 — the head yaws slightly
//     *against* the tail, because the animal has to conserve angular momentum, and that tiny
//     counter-motion is one of the strongest cues that a thing is alive.
//   * The wave runs about one body length, so at any instant there is a little more than one
//     full bend visible from snout to tail.
//   * Phase and beat rate are per-instance attributes. Without them a school flexes in unison,
//     which is worse than not flexing at all.
//
// Everything is in body lengths, because `FishGeometry` builds every fish exactly one unit long
// and the instance matrix's scale is the specimen's length in metres. So one amplitude uniform
// is correct for a 20 cm herring and a 2 m halibut at the same time.

precision highp float;

#include /lib/constants.glsl

/** 0 at the snout, 1 at the tail tip. Written per vertex by `FishGeometry`. */
attribute float aSpine;
/** x: 0 on the body, rising to 1 at a fin's free edge. y: 1 on an eye. */
attribute vec2 aTrait;

/** Per instance: swim phase in radians, beat-rate multiplier, and a colour/size variation. */
attribute float aPhase;
attribute float aSwim;
attribute float aVariation;

uniform float uTime;
/** Tail-beat frequency at unit swim rate, hertz. A cruising fish beats two to three times a second. */
uniform float uBeatHz;
/** Lateral sway at the tail tip, in body lengths. */
uniform float uAmplitude;
/** Body lengths per travelling wave. Below 1 the fish reads as an eel. */
uniform float uWavelength;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec2 vTrait;
varying vec3 vLocal;
varying float vVariation;
varying float vViewDistance;

/**
 * Amplitude envelope along the body, and its derivative.
 *
 * A quadratic in the spine parameter: 0.04 at the snout, a shallow minimum just behind it, and
 * exactly 1 at the tail tip. Kept as a closed form rather than a smoothstep so the slope below
 * is exact — a finite-differenced slope here shows up as normals that shimmer along the flank.
 */
const float ENV_A0 = 0.04;
const float ENV_A1 = -0.12;
const float ENV_A2 = 1.08;

void main() {
  vec3 local = position;

  // The wave travels from head to tail, so the phase *lags* with the spine parameter.
  float phase = aPhase + uTime * TWO_PI * uBeatHz * aSwim;
  float k = TWO_PI / uWavelength;
  float wave = sin(phase - aSpine * k);
  float carrier = cos(phase - aSpine * k);

  float envelope = ENV_A0 + ENV_A1 * aSpine + ENV_A2 * aSpine * aSpine;
  float envelopeSlope = ENV_A1 + 2.0 * ENV_A2 * aSpine;

  float lateral = uAmplitude * envelope * wave;
  float lateralSlope = uAmplitude * (envelopeSlope * wave - envelope * carrier * k);

  // Fins are thin and lag the membrane they hang from. Squared so the root stays welded to the
  // body — a fin that shears at its root opens a visible slot on every beat.
  lateral += aTrait.x * aTrait.x * uAmplitude * 0.35 * sin(phase * 1.9 - aSpine * 9.0);

  local.x += lateral;

  // The geometry runs z = 0.5 - s, so a step aft is a step *down* in z and the slope with
  // respect to z is the negative of the slope with respect to s.
  float slopeZ = -lateralSlope;

  // Shear the normal by the inverse transpose of the bend. The bend is x' = x + L(z), whose
  // inverse transpose leaves x and y alone and takes L'(z)·n.x out of n.z. Skipping this is why
  // a bent fish so often lights as though it were still straight.
  vec3 bent = normalize(vec3(normal.x, normal.y, normal.z - slopeZ * normal.x));

  #ifdef USE_INSTANCING
    vec4 world = modelMatrix * instanceMatrix * vec4(local, 1.0);
    vec3 worldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * bent);
  #else
    vec4 world = modelMatrix * vec4(local, 1.0);
    vec3 worldNormal = normalize(mat3(modelMatrix) * bent);
  #endif

  vWorldPosition = world.xyz;
  vNormal = worldNormal;
  vUv = uv;
  vTrait = aTrait;
  vLocal = local;
  vVariation = aVariation;
  vViewDistance = distance(world.xyz, cameraPosition);

  gl_Position = projectionMatrix * viewMatrix * world;
}

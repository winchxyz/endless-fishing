// Bow spray, integrated entirely on the GPU.
//
// Every droplet's whole life — where it left the stem, how hard it was thrown, its ballistic
// arc, the moment it rejoins the sea — is a closed-form function of a per-particle seed and one
// clock. The CPU advances that clock, moves the emitter and sets a single emission level; it
// never touches a particle. Nothing here is integrated, so nothing here can drift, and a
// thousand droplets cost one draw call and no per-frame bandwidth at all.
//
// Three details are worth reading before changing anything:
//
//   * **Lifetimes are exact submultiples of the clock's wrap period.** A particle's phase is
//     `mod(uTime + phase, life)`; if `life` divides `uCycle` exactly then wrapping the clock
//     shifts that argument by a whole number of lives and no droplet moves. That is what lets
//     `uTime` stay a small number forever instead of losing a millisecond of float precision
//     every hour the session runs.
//   * **The emitter's own motion is undone.** A droplet is born where the bow *was* when it left,
//     reconstructed as `uEmitter − uEmitterVelocity·age`. Without that the whole plume is welded
//     to the boat and translates with it, which reads as a decal rather than as water left behind.
//   * **Droplets die on the water, not on a timer.** The surface height under each one comes from
//     the same Gerstner bank the ocean is drawn from, so spray thrown into a trough hangs a
//     fraction longer than spray thrown at a crest — and none of it ever sinks through the sea.

precision highp float;

#include /lib/constants.glsl
#include /lib/gerstner.glsl

/** Four independent uniform randoms, fixed at construction. */
attribute vec4 aSeed;
/** This particle's place in the budget, 0..1. Compared against the emission level. */
attribute float aSlot;

/** Wrapped simulation clock, seconds, and the period it wraps at. */
uniform float uTime;
uniform float uCycle;
/** The stem, and the hull's axes and velocity, in world space. */
uniform vec3 uEmitter;
uniform vec3 uEmitterRight;
uniform vec3 uEmitterForward;
uniform vec3 uEmitterVelocity;
/** The one wind vector in `WorldState`. Spray is light enough to be carried by it. */
uniform vec3 uWind;
/** 0..1. The fraction of the budget currently alight; see `Wake.updateSpray`. */
uniform float uEmission;
/** Speed the water leaves the stem at, m/s. */
uniform float uThrow;
/** Droplet diameter at mid-life, metres. */
uniform float uSize;
uniform float uWaterLevel;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vQuad;
varying float vAlpha;
varying float vViewDistance;

const float GRAVITY = 9.80665;
/** Mean Earth radius, metres. The sea is projected onto it; droplets over the sea must be too. */
const float EARTH_RADIUS_M = 6371000.0;

void main() {
  vQuad = position.xy * 2.0;
  vAlpha = 0.0;
  vNormal = vec3(0.0, 1.0, 0.0);
  vWorldPosition = uEmitter;
  vViewDistance = 1.0;

  // Slots above the emission level are not throwing water. Sent outside the clip volume rather
  // than scaled to nothing, so they cost no rasterisation at all.
  if (aSlot >= uEmission) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  float divisions = floor(mix(12.0, 26.0, aSeed.x));
  float life = uCycle / divisions;
  float age = mod(uTime + aSeed.y * uCycle, life);
  float age01 = age / life;

  // A sheet of water peels off the stem outboard and up, with a little of the boat's own way in
  // it. `fract` decorrelates the spread from the side, so the two halves of the plume are not
  // mirror images of each other.
  float side = aSeed.z < 0.5 ? -1.0 : 1.0;
  float spread = 0.35 + 0.85 * fract(aSeed.z * 17.0);
  vec3 launch = normalize(
      uEmitterRight * (side * spread) +
      vec3(0.0, 0.55 + 0.95 * aSeed.w, 0.0) +
      uEmitterForward * (0.1 + 0.5 * fract(aSeed.x * 7.0)));

  // Air drag takes most of the forward momentum out within a few tenths of a second, which is
  // why spray falls astern of the bow that threw it instead of keeping station with it.
  vec3 velocity = launch * uThrow * (0.6 + 0.7 * aSeed.w) + uEmitterVelocity * 0.35;
  vec3 centre = uEmitter - uEmitterVelocity * age + velocity * age + uWind * (age * 0.35);
  centre.y -= 0.5 * GRAVITY * age * age;

  // The droplet's world position is fed in as though it were an undisplaced coordinate. Inverting
  // the horizontal pinch properly would cost four more evaluations per particle to move this test
  // by a few centimetres on a droplet that lives for one second, which is not a trade worth making.
  float surface = uWaterLevel + gerstnerDisplacement(centre.xz).y;
  // Not a hard cut: a droplet arriving at the surface merges into it over the last few
  // centimetres, and a plume that blinks out along a line reads as a clipping plane.
  float alive = smoothstep(surface - 0.05, surface + 0.3, centre.y);
  float fade = smoothstep(0.0, 0.18, age01) * (1.0 - smoothstep(0.5, 1.0, age01));
  // The emission band is soft at its top edge so that a slot switching on grows in rather than
  // appearing at whatever point of its arc the clock happens to be at.
  float gate = 1.0 - smoothstep(uEmission - 0.1, uEmission, aSlot);

  vAlpha = fade * alive * gate;

  // Droplets atomise as they fly: one lump of water leaving the stem is a hundred by the top of
  // its arc, so the visible blob grows even as the water in it stays the same.
  float size = uSize * (0.55 + 0.8 * aSeed.x) * (0.4 + 1.1 * age01) * (0.35 + 0.65 * gate);

  // Billboard from the view basis rather than from a look-at, so the quad stays square under
  // any camera roll — and the boat rolls constantly.
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 toEye = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  vec3 offset = right * position.x + up * position.y;
  vec3 world = centre + offset * size;

  vWorldPosition = world;
  // A rounded normal rather than a flat card: the shading then rolls off across the sprite and
  // the puff reads as a volume of droplets instead of a lit postage stamp.
  vNormal = normalize(toEye + offset * 1.6);
  vViewDistance = distance(world, cameraPosition);

  // Dropped onto the same curved surface `ocean.vert` projects the sea onto, so a droplet is
  // occluded by the water in front of it at any range rather than floating over it.
  float horizontal = distance(world.xz, cameraPosition.xz);
  vec3 projected = vec3(world.x, world.y - (horizontal * horizontal) / (2.0 * EARTH_RADIUS_M), world.z);

  gl_Position = projectionMatrix * viewMatrix * vec4(projected, 1.0);
}

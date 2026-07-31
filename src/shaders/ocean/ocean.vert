// Ocean clipmap vertex shader.
//
// The grid is a set of concentric rings, each with twice the cell size of the one inside it,
// centred on the camera and snapped to its own lattice so the mesh never swims underneath the
// waves. Two problems come with that layout and both are solved here:
//
//   * **Cracks.** Where a fine ring meets a coarse one, the fine ring has twice as many
//     vertices along the shared edge, and the extra ones sit off the coarse edge — a T-junction
//     that opens a one-pixel slit of background through the water.
//   * **Popping.** A vertex that jumps from one lattice to another as the camera moves shows
//     up as a visible twitch on a slow swell.
//
// Both are fixed by geomorphing: over the outer quarter of each ring, every vertex slides
// smoothly towards the position it will occupy on the *next* ring's coarser lattice. By the
// shared edge the two lattices coincide exactly, so there is nothing left to crack and nothing
// left to pop.

precision highp float;

#include /lib/constants.glsl
#include /lib/gerstner.glsl

/**
 * Cell size and half-extent of the level this vertex belongs to.
 *
 * Per-vertex rather than per-draw so the whole clipmap — every level — is one merged geometry
 * and one draw call. Eight separate meshes would be eight materials to keep in step and eight
 * chances for them to disagree about the wave bank.
 */
attribute float aCellSize;
attribute float aRingExtent;

/** Camera position in the XZ plane. Each level snaps to its own lattice relative to this. */
uniform vec2 uRingCentre;
uniform vec3 uCameraPosition;
/** Mean water level, shifted by the tide. */
uniform float uWaterLevel;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying float vJacobian;
varying float vViewDistance;
varying vec2 vUndisplaced;

/** Fraction of the ring, measured from the centre, at which the morph begins. */
const float MORPH_START = 0.72;

/** Mean Earth radius, metres. */
const float EARTH_RADIUS_M = 6371000.0;

void main() {
  vec2 local = position.xz;
  vec2 worldXZ = local + uRingCentre;

  // Snap to this level's own lattice. Without it the mesh slides beneath the wave field as the
  // boat moves and the whole surface appears to crawl.
  vec2 fine = floor(worldXZ / aCellSize + 0.5) * aCellSize;
  vec2 coarse = floor(worldXZ / (aCellSize * 2.0) + 0.5) * (aCellSize * 2.0);

  // Chebyshev distance, because the levels are square rings: with a Euclidean measure the
  // morph would reach full strength at a different place along an edge than at a corner, and
  // the corner would crack.
  float edgeDistance = max(abs(local.x), abs(local.y)) / aRingExtent;
  float morph = smoothstep(MORPH_START, 1.0, edgeDistance);

  // By the shared boundary morph is 1, so this level lands on exactly the lattice the next
  // level out is already using. That is what closes the seam.
  vec2 undisplaced = mix(fine, coarse, morph);
  vUndisplaced = undisplaced;

  vec3 displacement = gerstnerDisplacement(undisplaced);

  vec3 normal;
  float jacobian;
  gerstnerSurface(undisplaced, normal, jacobian);

  vec3 world = vec3(
      undisplaced.x + displacement.x,
      uWaterLevel + displacement.y,
      undisplaced.y + displacement.z);

  vWorldPosition = world;
  vNormal = normal;
  vJacobian = jacobian;
  vViewDistance = distance(world, uCameraPosition);

  // Earth curvature.
  //
  // A flat sea plane never reaches the horizon. Its far edge sits at a depression of
  // atan(eyeHeight / radius), and the true horizon is at sqrt(2 * eyeHeight / R) — for any
  // finite plane the first is the larger, so a wedge of below-horizon sky shows between the
  // water and the sky, all the way round the compass. That wedge is the horizon band: about a
  // pixel on the High preset, fourteen on Low, and eight from the orbit camera. Dropping every
  // vertex by d²/2R makes the surface curve away exactly as the sea does, so the mesh's own
  // silhouette *is* the horizon and there is no wedge left to show through.
  //
  // Only the projected position is dropped. `vWorldPosition` stays on the plane, because it
  // feeds the crest-height and view-direction terms in the fragment shader, and a swell eight
  // kilometres out must not read as five metres below mean water level.
  float horizontal = distance(world.xz, uCameraPosition.xz);
  vec3 projected = vec3(world.x, world.y - horizontal * horizontal / (2.0 * EARTH_RADIUS_M), world.z);

  gl_Position = projectionMatrix * viewMatrix * vec4(projected, 1.0);
}

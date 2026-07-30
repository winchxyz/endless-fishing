// Instanced foliage: grass blades and tree leaf cards.
//
// One program for both because the motion is the same problem — a cantilever anchored at the
// root, bending under a load that is the *shared* wind vector from `WorldState`. The same
// number that raises the sea and slants the rain leans the grass, so a squall arriving looks
// like one event rather than four systems agreeing by coincidence.
//
// The bend goes as the square of the height along the stem, which is the static deflection of a
// uniformly loaded cantilever. A linear bend looks hinged at the base; this looks grown.

precision highp float;

#include /lib/constants.glsl

/** Randomises phase and size per instance so a meadow does not pulse in unison. */
attribute float aPhase;
/** How far this instance bends for a given wind. Grass ~1, a loaded branch card ~0.3. */
attribute float aStiffness;

/** Wind vector in world space, metres per second. */
uniform vec2 uWind;
uniform float uTime;
/** Metres of tip deflection per metre of height at 10 m/s. */
uniform float uBendScale;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vHeightFraction;
varying float vViewDistance;

void main() {
  vec3 local = position;

  #ifdef USE_INSTANCING
    vec3 rootWorld = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #else
    vec3 rootWorld = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #endif

  float windSpeed = length(uWind);
  vec2 windDir = windSpeed > EPS ? uWind / windSpeed : vec2(0.0, 1.0);

  // A gust is a wave travelling downwind, not a global multiplier. Watching one cross a field
  // is most of what reads as wind at all, and it costs one dot product.
  float gustPhase = dot(rootWorld.xz, windDir) * 0.055 - uTime * (0.6 + windSpeed * 0.09);
  float gust = 0.62 + 0.38 * sin(gustPhase);
  float flutter = sin(uTime * (2.4 + aPhase * 1.7) + aPhase * TWO_PI);

  // uv.y is 0 at the root and 1 at the tip for both blade and card geometry.
  float along = uv.y;
  float lean = along * along * aStiffness * uBendScale * windSpeed * (gust + 0.16 * flutter);

  local.xz += windDir * lean;
  // Bending shortens the stem's reach; without this the tips visibly stretch in a gust.
  local.y -= along * lean * lean * 0.35;

  #ifdef USE_INSTANCING
    vec4 world = modelMatrix * instanceMatrix * vec4(local, 1.0);
    vec3 worldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  #else
    vec4 world = modelMatrix * vec4(local, 1.0);
    vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
  #endif

  vWorldPosition = world.xyz;
  vNormal = worldNormal;
  vUv = uv;
  vHeightFraction = along;
  vViewDistance = distance(world.xyz, cameraPosition);

  gl_Position = projectionMatrix * viewMatrix * world;
}

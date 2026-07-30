// The seafloor, and everything standing on it.
//
// One program for the ground, the kelp, the boulders and the wrecks, because they differ in
// exactly one respect: how far the water moves them. `aSway` is 0 for anything rooted and rises
// to 1 at a kelp frond's tip, and `aMaterial` tells the fragment shader which of the four
// surfaces it is looking at. Four programs would have meant four sets of the same eight lighting
// and water uniforms, kept in step by hand.
//
// The bend is the same cantilever the grass uses — deflection as the square of the height along
// the stem, which is the static shape of a uniformly loaded beam — but it is driven by something
// else entirely. There is no wind at forty metres. What moves kelp is the *orbital velocity* of
// the swell passing overhead, which reverses twice a period and travels along the wave's own
// direction, plus whatever steady tidal current is running. So a kelp bed does not flutter: it
// leans one way, hangs, and leans back, all of it in step, and the phase of that sweep is taken
// from the same wave bank the surface geometry is built from.

precision highp float;

#include /lib/constants.glsl

/** 0 for anything rooted or rigid, 1 at the free tip of a frond. */
attribute float aSway;
/** 0 sediment, 1 kelp, 2 rock, 3 wreck steel. */
attribute float aMaterial;

/** Steady near-bed current, metres per second, in world XZ. */
uniform vec2 uCurrent;
/** Unit direction the swell travels, and its angular frequency — straight off the wave bank. */
uniform vec2 uSurgeDirection;
uniform float uSurgeFrequency;
/** Peak orbital velocity at the bed, metres per second. Falls off with depth in the TypeScript. */
uniform float uSurgeSpeed;
uniform float uTime;
/** Metres of tip deflection per metre-per-second of flow. */
uniform float uSwayScale;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vMaterial;
varying float vSway;
varying float vViewDistance;

void main() {
  vec3 local = position;

  #ifdef USE_INSTANCING
    vec3 rootWorld = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #else
    vec3 rootWorld = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #endif

  // The surge is a travelling wave, not a global oscillation: the phase depends on where on the
  // bed you are standing. Watching it cross a kelp bed is the whole effect.
  float wavenumber = uSurgeFrequency * uSurgeFrequency / 9.80665;
  float surgePhase = wavenumber * dot(uSurgeDirection, rootWorld.xz) - uSurgeFrequency * uTime;
  vec2 flow = uCurrent + uSurgeDirection * uSurgeSpeed * sin(surgePhase);

  float lean = aSway * aSway * uSwayScale;
  local.xz += flow * lean;
  // Leaning shortens a frond's reach. Without this the tips visibly stretch on every surge.
  local.y -= aSway * lean * lean * 0.4;

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
  vMaterial = aMaterial;
  vSway = aSway;
  vViewDistance = distance(world.xyz, cameraPosition);

  gl_Position = projectionMatrix * viewMatrix * world;
}

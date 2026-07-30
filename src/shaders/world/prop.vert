// Solid world props: tree trunks, the lighthouse, jetties, wrecks, arches, buoys, crates.
//
// Everything that is a rigid body and stands still is drawn by this one program. They are all
// instanced — including the ones that appear once per chunk — so that a chunk's props are a
// fixed, small number of draw calls whatever it happens to contain, and so that the tint
// attribute below can exist unconditionally rather than being an attribute some geometries
// carry and others do not.

precision highp float;

/** Per-instance albedo multiplier. Weathering, paint, and species variation in one attribute. */
attribute vec3 aTint;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vTint;
varying float vViewDistance;

void main() {
  #ifdef USE_INSTANCING
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vec3 worldNormal = mat3(modelMatrix) * mat3(instanceMatrix) * normal;
  #else
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 worldNormal = mat3(modelMatrix) * normal;
  #endif

  vWorldPosition = world.xyz;
  vNormal = normalize(worldNormal);
  vUv = uv;
  vTint = aTint;
  vViewDistance = distance(world.xyz, cameraPosition);

  gl_Position = projectionMatrix * viewMatrix * world;
}

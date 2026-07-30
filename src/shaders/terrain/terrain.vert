// Island terrain.
//
// The heightfield is evaluated on the CPU (see `world/Islands.ts`) because the buoyancy solver,
// the tree planter and the collision query all have to agree with the picture down to the
// centimetre, and a GPU-only heightfield can only ever be guessed at from the other side. So
// this shader does no displacement at all — it transforms, and hands the fragment stage the two
// things it needs that cannot be recovered downstream: the world position, for the tide band,
// and the geometric normal, for the sand/rock split.

precision highp float;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying float vViewDistance;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPosition = world.xyz;

  // The island meshes are only ever translated and uniformly scaled, so the normal matrix
  // reduces to a rotation and normalising after transform is exact rather than an approximation.
  vNormal = normalize(normalMatrix * normal);
  vViewDistance = distance(world.xyz, cameraPosition);

  gl_Position = projectionMatrix * viewMatrix * world;
}

// Milky Way band vertex shader.
//
// The mesh is a sphere carrying the same equatorial-to-horizontal rotation as the star field,
// so the direction interpolated here is already in equatorial coordinates and the fragment
// shader can convert straight to galactic latitude and longitude.

varying vec3 vEquatorial;

void main() {
  // `position` is in the object's own frame, which is the equatorial frame by construction.
  vEquatorial = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

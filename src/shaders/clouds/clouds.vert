// Cloud layer vertex shader.
//
// Shared by all four cloud programs — the offscreen march, the probe march, the resolve and the
// shadow mask — because all four are drawn as the same clip-space triangle and all four want the
// same two things out of it: the screen coordinate, and the world-space view ray.
//
// The ray is reconstructed from the inverse projection rather than interpolated from a dome mesh
// for the same reason the sky does it: a dome fine enough to keep the horizon straight against a
// flat sea costs more vertices than the whole cloud pass costs fragments, and the reconstruction
// is exact at every pixel rather than only at the vertices.
//
// gl_Position.z sits on the far plane so the layer loses every depth test against real geometry.

varying vec3 vViewRay;
varying vec2 vUv;

uniform mat4 uInverseProjection;
uniform mat4 uCameraWorld;

void main() {
  vUv = uv;

  vec4 clip = vec4(position.xy, 1.0, 1.0);
  vec4 viewSpace = uInverseProjection * clip;
  viewSpace /= viewSpace.w;
  // Direction only: taking the rotation part drops the camera translation, so the ray is a pure
  // heading and the clouds do not slide when the boat moves a metre.
  vViewRay = mat3(uCameraWorld) * viewSpace.xyz;

  gl_Position = clip;
}

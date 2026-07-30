// Sky dome vertex shader.
//
// Drawn as a single clip-space triangle rather than a tessellated dome: a dome mesh has to be
// very finely tessellated before the horizon stops showing polygonal steps against a flat sea,
// and reconstructing the view ray from the inverse projection is both exact and cheaper.
//
// gl_Position.z is pushed to the far plane so the sky loses every depth test against real
// geometry without needing depth writes disabled per-object.

varying vec3 vViewRay;

uniform mat4 uInverseProjection;
uniform mat4 uCameraWorld;

void main() {
  vec4 clip = vec4(position.xy, 1.0, 1.0);
  vec4 viewSpace = uInverseProjection * clip;
  viewSpace /= viewSpace.w;
  // Direction only: drop the camera translation by using the rotation part of the matrix.
  vViewRay = mat3(uCameraWorld) * viewSpace.xyz;
  gl_Position = clip;
}

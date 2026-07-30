// Fullscreen pass vertex shader for the atmosphere look-up tables.
// Draws a [-1,1] quad directly in clip space, so no camera matrices are involved.

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}

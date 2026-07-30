// Grass and leaf shading.
//
// Two things separate vegetation from a green-painted solid. Leaves *transmit*: a canopy lit
// from behind glows, and that backlit term is the single strongest cue that a tree is made of
// thin things rather than of plastic. And the shading normal is not the geometric one — a card
// standing in for a hundred leaves should shade like the cloud of leaves it represents, so the
// normal is pushed towards the vertical, which is why a blade of grass has a soft gradient
// along it instead of a hard terminator across the middle.

precision highp float;

#include /lib/worldlight.glsl

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vHeightFraction;
varying float vViewDistance;

/** 0 = the geometry is already the silhouette (a blade). 1 = cut a leaf cluster out of a card. */
uniform float uLeafMask;
uniform vec3 uBaseColour;
uniform vec3 uTipColour;
/** Fades an instance out over its last few metres of draw distance instead of popping it. */
uniform float uFadeStart;
uniform float uFadeEnd;

/**
 * A leaf cluster, from three overlapping lobes.
 *
 * Cheaper and sharper than a texture at this size, and it stays crisp under anisotropy — an
 * alpha-tested foliage texture is exactly where mip bleeding turns a canopy into grey mush.
 */
float clusterMask(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  float a = length(p * vec2(1.0, 1.25) - vec2(0.0, -0.15)) - 0.78;
  float b = length((p - vec2(0.42, 0.34)) * 1.7) - 0.62;
  float c = length((p + vec2(0.45, 0.22)) * 1.75) - 0.6;
  float d = min(a, min(b, c));
  // Nibble the outline so the silhouette is ragged rather than three obvious circles.
  d += 0.13 * sin(atan(p.y, p.x) * 9.0) * length(p);
  return 1.0 - smoothstep(-0.03, 0.05, d);
}

void main() {
  float mask = mix(1.0, clusterMask(vUv), uLeafMask);
  // Distance fade doubles as the alpha-test threshold, so an instance dissolves away instead of
  // vanishing between one frame and the next.
  float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, vViewDistance);
  if (mask * fade < 0.5) discard;

  vec3 viewVector = cameraPosition - vWorldPosition;
  vec3 V = viewVector / max(EPS, vViewDistance);

  vec3 geometric = normalize(vNormal);
  // Face the shading normal towards the viewer's side of the card, or half of every leaf
  // cluster in the tree is lit from behind for no reason.
  if (dot(geometric, V) < 0.0) geometric = -geometric;
  vec3 N = normalize(mix(geometric, vec3(0.0, 1.0, 0.0), 0.55));

  vec3 albedo = mix(uBaseColour, uTipColour, vHeightFraction);
  // Self-shadowing of the sward: the bottom of a blade sits in the mat of the one beside it.
  float occlusion = mix(0.35, 1.0, vHeightFraction);

  vec3 colour = ef_shadeSurface(albedo, N, V, 0.72, occlusion, vec3(0.028));

  // Transmission. Thin, so it only shows when the source is more or less behind the leaf, and
  // it carries the leaf's own colour because that is what the light was filtered through.
  float sunThrough = pow(max(0.0, dot(V, -uSunDirection)), 2.2);
  float moonThrough = pow(max(0.0, dot(V, -uMoonDirection)), 2.2);
  colour += albedo * 1.7 * (uSunColour * uSunIlluminance * sunThrough +
                            uMoonColour * uMoonIlluminance * moonThrough);

  colour = ef_aerialPerspective(colour, vViewDistance, V);

  gl_FragColor = vec4(hdrClamp(colour), 1.0);
}

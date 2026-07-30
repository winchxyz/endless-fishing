// Monofilament.
//
// A fishing line is not a thin cylinder painted grey. It is a transparent dielectric filament,
// and essentially everything you see of it is one of two things: the sky it is reflecting along
// its whole length, and a hard specular streak where it happens to sit near the mirror direction
// of the sun. The streak is what makes a line visible across fifteen metres of water in the
// afternoon and completely invisible ten minutes later, and reproducing that is the difference
// between "there is a line" and "there is a wire".
//
// So the lobe is Kajiya–Kay rather than GGX. A cylinder has no single normal: every direction in
// the plane perpendicular to its axis is a normal, so the specular highlight is a *ring* about
// the tangent rather than a spot, and the maths below is that ring written out. It is the same
// model hair uses, for the same geometric reason.
//
// Radiance in, radiance out, in real units. Tone mapping is the composer's job.

precision highp float;

#include /lib/constants.glsl

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vTangent;
varying float vAlong;
varying float vViewDistance;

uniform vec3 uSunDirection;
uniform vec3 uSunColour;
/** Sun illuminance already divided by π, matching every other surface in the game. */
uniform float uSunIlluminance;
uniform vec3 uMoonDirection;
uniform vec3 uMoonColour;
uniform float uMoonIlluminance;
/** Diffuse sky radiance. Monofilament has no colour of its own; this is most of what it shows. */
uniform vec3 uSkyRadiance;
uniform float uVisibility;
uniform vec3 uLineColour;
/** 0 slack, 1 at breaking strain. Drives how tight the glint is and how visible the line reads. */
uniform float uTension;
uniform float uOpacity;

/**
 * One directional source on a filament.
 *
 * `sinL` is the sine of the angle between the light and the axis, and it is the correct diffuse
 * term for a cylinder: a line lit end-on shows nothing, a line lit broadside shows its whole
 * projected width. The specular is the Kajiya–Kay ring, `cos(θ_L + θ_V)` expanded so no inverse
 * trigonometry is needed.
 *
 * The horizon fade is the same one `lib/worldlight.glsl` uses and for the same reason: refraction
 * keeps handing us a sun a fraction of a degree below the horizon while its disc is still
 * visible, and a hard cut at y = 0 puts a line across the frame at the moment of sunset.
 */
vec3 ef_filament(vec3 L, vec3 colour, float illuminance, vec3 T, vec3 V, float shine) {
  if (illuminance <= 0.0) return vec3(0.0);
  float horizon = smoothstep(-0.035, 0.02, L.y);
  if (horizon <= 0.0) return vec3(0.0);

  float tDotL = dot(T, L);
  float tDotV = dot(T, V);
  float sinL = sqrt(max(0.0, 1.0 - tDotL * tDotL));
  float sinV = sqrt(max(0.0, 1.0 - tDotV * tDotV));

  float specular = pow(max(0.0, sinL * sinV - tDotL * tDotV), shine);
  return colour * illuminance * horizon * (uLineColour * sinL * INV_PI + vec3(specular));
}

void main() {
  vec3 viewVector = cameraPosition - vWorldPosition;
  vec3 V = viewVector / max(EPS, vViewDistance);
  vec3 T = normalize(vTangent);
  vec3 N = normalize(vNormal);

  // Line under load is straighter, rounder and stretched thinner, so its highlight tightens.
  // Slack line is kinked and scatters the same energy over a much wider lobe.
  float shine = mix(26.0, 110.0, saturate(uTension));

  vec3 colour = ef_filament(uSunDirection, uSunColour, uSunIlluminance, T, V, shine);
  colour += ef_filament(uMoonDirection, uMoonColour, uMoonIlluminance, T, V, shine * 0.5);
  colour += uLineColour * uSkyRadiance;

  // Koschmieder, with the same extinction the rest of the world uses. At the ranges a line is
  // drawn at this is a small effect, but leaving it out is what makes a near object look pasted
  // over a hazy background.
  float extinction = 3.912 / max(200.0, uVisibility);
  float haze = 1.0 - exp(-extinction * vViewDistance);
  colour = mix(colour, uSkyRadiance, haze);

  // Coverage, not opacity. The drawn tube is many times thicker than 0.28 mm line, so the honest
  // statement is that it only ever fills a fraction of the pixels it touches — more of them up
  // close, fewer at range, and more at the silhouette where the view slices the long way through
  // the filament. Fading with distance is what stops a cast line crawling as a hard grey stipple.
  float rim = 1.0 - abs(dot(N, V));
  float alpha = uOpacity * mix(0.92, 0.30, smoothstep(3.0, 42.0, vViewDistance));
  alpha *= 0.55 + 0.45 * rim;
  // The last few centimetres at the float are hidden inside the antenna; fading them rather than
  // ending the tube abruptly avoids a visible seam wherever the float tilts.
  alpha *= 1.0 - smoothstep(0.94, 1.0, vAlong);
  alpha = saturate(alpha + uTension * 0.14);

  gl_FragColor = vec4(hdrClamp(colour), alpha);
}

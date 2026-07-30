// Star field vertex shader.
//
// Every star in the Yale Bright Star Catalogue down to magnitude 6.5 in one draw call. The
// positions are fixed in equatorial coordinates; the whole `Points` object carries a single
// rotation matrix rebuilt each frame from local apparent sidereal time and latitude, so the
// sky turns correctly through the night for nothing.
//
// Size and brightness come from the catalogue magnitude via the actual logarithmic scale, so
// the difference between Sirius and a naked-eye limit star is the real 400:1 in flux — not an
// artist's ramp. What is *not* physical is that a star is a point source: it has no angular
// size at all, and everything you see of it is the point-spread function of the eye or the
// lens. So the sprite is sized by brightness, the way a real out-of-focus PSF grows with flux,
// and the fragment shader gives it a Gaussian core with a faint halo.

#include /lib/constants.glsl

attribute float aMagnitude;
attribute vec3 aColour;

varying vec3 vColour;
varying float vIntensity;

/** Pixels per unit of sprite size at the current resolution and field of view. */
uniform float uPixelScale;
/** 0 in daylight, 1 once the sun is well below the horizon. */
uniform float uNightFactor;
/** Seconds, for scintillation. */
uniform float uTime;
/** Overall brightness multiplier from the exposure regime. */
uniform float uIntensity;
/** Faintest magnitude to draw. Lets the low preset thin the field without a rebuild. */
uniform float uMagnitudeLimit;

// Cheap deterministic hash for per-star scintillation phase.
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  // Direction from the *rotation* alone. The model matrix also carries the camera's world
  // position — the celestial sphere is re-centred on the viewer every frame — and including
  // that translation would tilt the whole sky by however far the boat has sailed.
  vec3 direction = normalize(mat3(modelMatrix) * position);

  // Flux relative to a magnitude-0 star. This is the definition of the magnitude scale:
  // five magnitudes is a factor of exactly 100.
  float flux = pow(10.0, -0.4 * aMagnitude);

  // Atmospheric extinction. About 0.2 magnitudes at the zenith and several near the horizon,
  // which is why constellations visibly fade as they set rather than winking out at 0 degrees.
  float altitude = direction.y;
  float airMass = 1.0 / max(0.05, altitude + 0.025 / (altitude + 0.04));
  float extinction = pow(10.0, -0.4 * 0.21 * airMass);

  // Scintillation: turbulence in the line of sight, so it scales with air mass and is
  // essentially absent overhead. Two incommensurate frequencies keep it from looking periodic.
  float phase = hash11(aMagnitude * 977.0 + position.x * 131.0 + position.z * 71.0) * TWO_PI;
  float twinkle = 1.0 + (airMass - 1.0) * 0.09 *
      (sin(uTime * 6.1 + phase) + 0.7 * sin(uTime * 11.3 + phase * 1.7));

  float visible = step(aMagnitude, uMagnitudeLimit) * smoothstep(-0.03, 0.02, altitude);
  vIntensity = flux * extinction * twinkle * uNightFactor * uIntensity * visible;
  vColour = aColour;

  // Sprite size grows slowly with flux — a quarter power, which is the exponent that makes a
  // magnitude range of 8 span a believable 4:1 of apparent size rather than 20:1.
  float size = uPixelScale * (0.55 + 1.35 * pow(flux, 0.25));

  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = clamp(size, 1.0, 9.0);
}

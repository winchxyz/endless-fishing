// Seafloor shading: silt, kelp, boulder and rusted steel, plus the light that reaches them.
//
// A northern seabed is not a reef. It is cold, low-contrast and almost colourless by the time
// the water has taken the red out — grey-brown sediment, olive weed, grey rock. The restraint is
// not a style choice: at thirty metres of coastal water the red channel has lost 99.99% of its
// energy, and any surface that still reads as warm is being lit by something that is not there.
//
// The one bright thing down here is the caustics. Light refracts through the moving surface and
// converges into a net of filaments on the bed, and it is *the* signal that there is a real sea
// above you rather than a fog volume. The pattern comes from `createCausticsTexture` and is
// driven by the wave bank the surface geometry itself is built from — same direction, same
// period — so the light on the sand and the shape of the swell overhead cannot disagree.
//
// Depth absorption uses Jerlov's coefficients. They are copied from
// `src/shaders/ocean/ocean.frag`, which owns them: the numbers below are that file's, verbatim.

precision highp float;

#include /lib/worldlight.glsl

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vMaterial;
varying float vSway;
varying float vViewDistance;

uniform sampler2D uCaustics;
/** Metres of seabed one tile of the caustic sheet covers. */
uniform float uCausticsScale;
/** Where the sheet has drifted to, metres, and the cross-fade between its two phases, 0..1. */
uniform vec2 uCausticsOffset;
uniform float uCausticsPhase;
/** Overall caustic strength. Zero at night and under solid overcast — there is no beam to bend. */
uniform float uCausticsStrength;

uniform float uWaterLevel;
uniform float uTurbidity;

// --- water optics, owned by shaders/ocean/ocean.frag ------------------------------------------
const vec3 ABSORPTION_OCEANIC = vec3(0.42, 0.072, 0.028);
const vec3 ABSORPTION_COASTAL = vec3(0.56, 0.19, 0.31);
const vec3 SCATTER_OCEANIC = vec3(0.010, 0.038, 0.055);
const vec3 SCATTER_COASTAL = vec3(0.028, 0.062, 0.048);

/** Cold silt with shell gravel through it. Linear sRGB. */
const vec3 SEDIMENT_COLOUR = vec3(0.125, 0.118, 0.096);
/** Laminaria. Olive-brown, and much darker than anyone expects until they see one wet. */
const vec3 KELP_COLOUR = vec3(0.042, 0.055, 0.026);
const vec3 ROCK_COLOUR = vec3(0.058, 0.061, 0.063);
/** Corroded plate, decades under. Iron oxide with the red already half taken out of it. */
const vec3 STEEL_COLOUR = vec3(0.062, 0.042, 0.030);

/** Value noise. Cheap mottling for the sediment and speckle for the rock; no texture needed. */
float hashNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  vec4 h = vec4(
      dot(i, vec2(127.1, 311.7)),
      dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7)),
      dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7)),
      dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7)));
  vec4 r = fract(sin(h) * 43758.5453);
  return mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);
}

/** See `fish.frag` — the fraction of the eye-to-fragment segment that is under water. */
float submergedPath(vec3 fragPosition, vec3 eye, float level) {
  float fragBelow = max(0.0, level - fragPosition.y);
  float eyeBelow = max(0.0, level - eye.y);
  if (fragBelow <= 0.0 && eyeBelow <= 0.0) return 0.0;

  float total = distance(eye, fragPosition);
  if (fragBelow > 0.0 && eyeBelow > 0.0) return total;
  return total * ((fragBelow + eyeBelow) / max(EPS, abs(eye.y - fragPosition.y)));
}

void main() {
  // Kelp is a blade with two sides and no thickness worth modelling.
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = (cameraPosition - vWorldPosition) / max(EPS, vViewDistance);

  vec3 albedo;
  float roughness;
  float occlusion = 1.0;

  if (vMaterial < 0.5) {
    // Sediment: two scales of mottling, plus ripple shading picked up from the geometry's own
    // normal. Sand ripples on a tide-swept bed run across the current and they are the reason a
    // flat seabed still reads as a surface with a direction to it.
    float coarse = hashNoise(vWorldPosition.xz * 0.09);
    float fine = hashNoise(vWorldPosition.xz * 1.7);
    albedo = SEDIMENT_COLOUR * (0.72 + 0.5 * coarse) * (0.86 + 0.28 * fine);
    roughness = 0.94;
  } else if (vMaterial < 1.5) {
    // Kelp thins and pales towards the tip, where it is a single translucent lamina.
    albedo = KELP_COLOUR * (0.7 + 0.75 * vSway) * (0.85 + 0.3 * hashNoise(vUv * 8.0));
    roughness = 0.42;
    // The base of a stand is buried in its own shade.
    occlusion = 0.35 + 0.65 * vSway;
  } else if (vMaterial < 2.5) {
    float speckle = hashNoise(vWorldPosition.xz * 3.1 + vWorldPosition.y);
    albedo = ROCK_COLOUR * (0.7 + 0.7 * speckle);
    roughness = 0.86;
  } else {
    float corrosion = hashNoise(vWorldPosition.xz * 1.3 + vWorldPosition.y * 0.7);
    albedo = mix(STEEL_COLOUR, STEEL_COLOUR * 1.9, corrosion);
    // Sixty years of encrusting growth: rougher than plate, and darker on the up-facing surfaces
    // where everything that falls through the water column lands.
    roughness = 0.78;
    occlusion = 0.55 + 0.45 * (1.0 - max(0.0, N.y));
  }

  float depthBelow = max(0.0, uWaterLevel - vWorldPosition.y);
  vec3 absorption = mix(ABSORPTION_OCEANIC, ABSORPTION_COASTAL, uTurbidity);
  vec3 scatterColour = mix(SCATTER_OCEANIC, SCATTER_COASTAL, uTurbidity);

  // --------------------------------------------------------------------------------- caustics
  //
  // Two channels of the same sheet at different phases, cross-faded, so the net writhes instead
  // of scrolling rigidly. Projected straight down, because refracted light arrives within
  // Snell's 48.6° of vertical however low the sun is, and a projection along the sun vector
  // would smear the pattern across the bed at sunset when it should still be nearly overhead.
  vec2 causticUv = (vWorldPosition.xz + uCausticsOffset) / max(0.5, uCausticsScale);
  float phaseA = texture2D(uCaustics, causticUv).r;
  float phaseB = texture2D(uCaustics, causticUv * 1.11 + 0.37).g;
  float caustic = mix(phaseA, phaseB, uCausticsPhase);
  // Caustics need an up-facing surface to land on, and they wash out with depth as the surface's
  // focal length runs out — past about thirty metres there is no pattern left, only an average.
  float reach = (1.0 - smoothstep(4.0, 32.0, depthBelow)) * max(0.0, N.y);
  float causticGain = 1.0 + caustic * uCausticsStrength * reach * 2.4;

  // ---------------------------------------------------------------------------------- shading
  vec3 colour = ef_shadeSurface(albedo, N, V, roughness, occlusion, vec3(0.035));
  // Snell's window caps how steeply a refracted ray can travel, so the shortest possible path
  // from the surface down to this depth is depth/cos(48.6°) and never less.
  vec3 downwelling = exp(-absorption * (depthBelow / 0.66));
  colour *= downwelling * causticGain;

  // ------------------------------------------------------------------------------------ water
  float path = submergedPath(vWorldPosition, cameraPosition, uWaterLevel);
  vec3 transmittance = exp(-absorption * path);
  vec3 skyAbove = textureCubeLodEXT(uEnvironment, vec3(0.0, 1.0, 0.0), 5.0).rgb * uEnvironmentIntensity;
  vec3 sunlight = uSunColour * uSunIlluminance + uMoonColour * uMoonIlluminance;
  vec3 inscatter =
      scatterColour * (skyAbove * 0.55 + sunlight * 0.35 * max(0.0, uSunDirection.y)) * downwelling;
  colour = colour * transmittance + inscatter * (1.0 - transmittance);

  // Only the dry part of the path gets Koschmieder haze — the seabed is visible from above the
  // surface through the ocean's refraction buffer, and double-counting the extinction there
  // turns two metres of clear shallows into fog.
  colour = ef_aerialPerspective(colour, max(0.0, vViewDistance - path), V);

  gl_FragColor = vec4(hdrClamp(colour), 1.0);
}

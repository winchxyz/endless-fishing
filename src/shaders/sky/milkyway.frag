// The Milky Way, drawn procedurally in true galactic coordinates.
//
// The IAU galactic pole is at RA 192.85948°, Dec 27.12825°, so given an equatorial direction
// the galactic latitude follows immediately — which means the band lands exactly where the
// real one does, tips over correctly through the night, and swaps hemispheres properly if you
// move the boat to Tasmania. That is the whole reason this is computed rather than sampled
// from a panorama: a photograph would have to be oriented by hand, and it would cost a quarter
// of the project's download budget (see DECISIONS.md §9).
//
// Structure, in the order it is layered:
//   * a thin disc profile, brightest at galactic latitude 0 and falling off over a few degrees;
//   * a central bulge towards Sagittarius at galactic longitude 0, which is genuinely the
//     brightest part of the sky on a dark night;
//   * fractal brightness variation, for the clumping of unresolved star clouds;
//   * the Great Rift — dark dust lanes carved *out* of the band, which are what make it read
//     as a real structure rather than an airbrushed smear.

precision highp float;

#include /lib/constants.glsl

varying vec3 vEquatorial;

uniform float uNightFactor;
uniform float uIntensity;
/** Direction of the observer's zenith in the same equatorial frame, for horizon extinction. */
uniform vec3 uZenithEquatorial;

// IAU 1958 galactic pole, precessed to J2000.
const float NGP_RA = 3.36603292;      // 192.85948 degrees
const float NGP_DEC = 0.473478800;    // 27.12825 degrees
const float GALACTIC_NODE = 2.14556804; // 122.93192 degrees

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amplitude * valueNoise(p);
    p *= 2.03;  // Not exactly 2, so octaves do not align into visible grid artefacts.
    amplitude *= 0.5;
  }
  return sum;
}

void main() {
  vec3 dir = normalize(vEquatorial);

  // Equatorial -> galactic. `dir` is (cos dec cos ra, cos dec sin ra, sin dec).
  float dec = asin(clamp(dir.z, -1.0, 1.0));
  float ra = atan(dir.y, dir.x);

  float sinDec = sin(dec);
  float cosDec = cos(dec);
  float deltaRa = ra - NGP_RA;

  float sinB = sinDec * sin(NGP_DEC) + cosDec * cos(NGP_DEC) * cos(deltaRa);
  float b = asin(clamp(sinB, -1.0, 1.0));
  float y = cosDec * sin(deltaRa);
  float x = sinDec * cos(NGP_DEC) - cosDec * sin(NGP_DEC) * cos(deltaRa);
  float l = GALACTIC_NODE - atan(y, x);

  // Disc profile. About 6 degrees of half-width, which matches how thick the band looks.
  float bDeg = b * RAD_TO_DEG;
  float disc = exp(-(bDeg * bDeg) / (2.0 * 7.0 * 7.0));

  // Central bulge towards Sagittarius, and a broad falloff away from it.
  float towardsCentre = cos(l);
  float bulge = exp(-(bDeg * bDeg) / (2.0 * 13.0 * 13.0)) * smoothstep(-0.2, 1.0, towardsCentre);
  float longitudeFalloff = 0.42 + 0.58 * smoothstep(-1.0, 1.0, towardsCentre);

  float band = disc * longitudeFalloff + bulge * 0.55;

  // Star-cloud clumping, in galactic coordinates so it moves with the band.
  vec2 galactic = vec2(l * 2.6, b * 7.0);
  float clumps = 0.55 + 0.9 * fbm(galactic * 2.2);

  // The Great Rift: dust lanes running along the band, strongest near the centre. Subtracted
  // rather than multiplied so they cut hard-edged voids instead of a general dimming.
  float rift = fbm(vec2(l * 3.4, b * 16.0) + 41.7);
  float dust = smoothstep(0.38, 0.72, rift) * disc * (0.35 + 0.5 * smoothstep(-0.3, 1.0, towardsCentre));

  float brightness = max(0.0, band * clumps - dust * 0.85);

  // Horizon extinction, same law as the stars — the band fades out well before it sets.
  float altitude = dot(dir, uZenithEquatorial);
  float airMass = 1.0 / max(0.05, altitude + 0.025 / (max(altitude, -0.03) + 0.04));
  float extinction = pow(10.0, -0.4 * 0.21 * airMass) * smoothstep(-0.02, 0.08, altitude);

  // Integrated starlight is slightly warm-white; the dust reddens what shines through it.
  vec3 tint = mix(vec3(0.78, 0.82, 1.0), vec3(1.0, 0.86, 0.68), dust * 0.7);

  float alpha = brightness * extinction * uNightFactor * uIntensity;
  if (alpha <= 0.0005) discard;
  gl_FragColor = vec4(tint * alpha, 1.0);
}

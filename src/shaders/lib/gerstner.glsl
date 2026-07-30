// Gerstner wave evaluation — the GPU mirror of `src/math/Gerstner.ts`.
//
// **This file and `math/Gerstner.ts` must stay identical in behaviour.** `npm run verify`
// renders `gerstnerDisplacement` for four thousand sample points, reads the buffer back and
// compares it against the TypeScript implementation; a disagreement of more than a millimetre
// fails the build. If you add a term here, add it there.
//
// The wave bank arrives as two packed uniform arrays rather than a struct array, because a
// struct array of 8 elements costs 8 separate uniform locations per field on some drivers and
// this costs two.
//
//   uWaveA[i] = (directionX, directionZ, amplitude, wavenumber)
//   uWaveB[i] = (frequency, phase, steepness, unused)

#ifndef ENDLESS_FISHING_GERSTNER
#define ENDLESS_FISHING_GERSTNER

#ifndef MAX_WAVES
#define MAX_WAVES 8
#endif

uniform vec4 uWaveA[MAX_WAVES];
uniform vec4 uWaveB[MAX_WAVES];
uniform int uWaveCount;
uniform float uWaveTime;

/** Displacement of the surface for a point whose undisplaced position is (x, z). */
vec3 gerstnerDisplacement(vec2 undisplaced) {
  vec3 displacement = vec3(0.0);

  for (int i = 0; i < MAX_WAVES; i++) {
    if (i >= uWaveCount) break;

    vec2 direction = uWaveA[i].xy;
    float amplitude = uWaveA[i].z;
    float wavenumber = uWaveA[i].w;
    float frequency = uWaveB[i].x;
    float phase = uWaveB[i].y;
    float steepness = uWaveB[i].z;

    float theta = wavenumber * dot(direction, undisplaced) - frequency * uWaveTime + phase;
    float cosTheta = cos(theta);
    float sinTheta = sin(theta);
    float pinch = steepness * amplitude;

    displacement.x += pinch * direction.x * cosTheta;
    displacement.y += amplitude * sinTheta;
    displacement.z += pinch * direction.y * cosTheta;
  }

  return displacement;
}

/**
 * Analytic surface normal and the Jacobian determinant, in one pass.
 *
 * Both come from the same partial derivatives, so computing them together halves the work
 * against calling two functions — and the vertex shader wants both: the normal for shading,
 * the Jacobian for the foam mask.
 */
void gerstnerSurface(vec2 undisplaced, out vec3 normal, out float jacobian) {
  // Partial derivatives of the displaced position with respect to undisplaced x and z.
  vec3 tangentX = vec3(1.0, 0.0, 0.0);
  vec3 tangentZ = vec3(0.0, 0.0, 1.0);

  for (int i = 0; i < MAX_WAVES; i++) {
    if (i >= uWaveCount) break;

    vec2 direction = uWaveA[i].xy;
    float amplitude = uWaveA[i].z;
    float wavenumber = uWaveA[i].w;
    float frequency = uWaveB[i].x;
    float phase = uWaveB[i].y;
    float steepness = uWaveB[i].z;

    float theta = wavenumber * dot(direction, undisplaced) - frequency * uWaveTime + phase;
    float cosTheta = cos(theta);
    float sinTheta = sin(theta);

    float pinch = steepness * amplitude * wavenumber;
    float slope = amplitude * wavenumber;

    tangentX.x -= pinch * direction.x * direction.x * sinTheta;
    tangentX.z -= pinch * direction.x * direction.y * sinTheta;
    tangentX.y += slope * direction.x * cosTheta;

    tangentZ.x -= pinch * direction.y * direction.x * sinTheta;
    tangentZ.z -= pinch * direction.y * direction.y * sinTheta;
    tangentZ.y += slope * direction.y * cosTheta;
  }

  normal = normalize(cross(tangentZ, tangentX));
  // Determinant of the horizontal part of the deformation. Below 1 the surface is piling up;
  // at or below 0 it has folded through itself, which is a breaking crest.
  jacobian = tangentX.x * tangentZ.z - tangentX.z * tangentZ.x;
}

#endif

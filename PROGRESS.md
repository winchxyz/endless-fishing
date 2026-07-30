# PROGRESS.md

## Done

### Phase 0 — Scaffold ✅

- Vite 8 + TypeScript 5, `strict` with `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`. `npm run build` is clean: **zero errors, zero warnings.**
- **Renderer decision made and committed: WebGL2.** Reasoning in `DECISIONS.md` §1 — the
  brief's own hard rules (pmndrs `postprocessing`, shaders in `.glsl` files) are both
  WebGL-only. A WebGPU probe runs at boot and reports into the debug panel.
- `core/`: `Engine` (system registry, frozen per-frame order), `Loop` (fixed 120 Hz sim with a
  spiral-of-death guard), `Input`, `Time`, `Settings` (four presets encoding the degradation
  priority), `ResourceManager`, `RendererFactory`, `DebugPanel` (`~`), `DebugApi`, `WorldState`.
- `math/`: seeded `PRNG` (sfc32), `Noise` (simplex, fBm, ridged).
- Asset pipeline: `npm run assets` is manifest-driven, checksum-locked, idempotent.
  **131 MB downloaded, 103 MB on disk** — inside the ~150 MB budget. `npm run textures` packs
  ORM, builds the lunar normal map from LOLA elevation, and repacks the star catalogue.
  `assets/CREDITS.md` is regenerated from the manifest every run.

### Phase 1 — Astronomy ✅

- `astro/` is pure — no three.js, no DOM. NOAA solar position, ELP-2000/82 lunar theory
  (full 60+60 term tables), topocentric parallax, bright-limb position angle, optical
  libration, Bennett *and* Sæmundsson refraction, nutation, sidereal time, galactic
  coordinates, numerical rise/set.
- **52 unit tests, all passing** — Meeus book comparisons against high-accuracy VSOP87/ELP
  values, plus physical identities across six sites in both hemispheres.
- **Verified against the US Naval Observatory.** Every rise, set, transit and twilight event
  matches *to the minute* at Tel Aviv (2026-07-30) and Reykjavík (2026-12-21, 64°N winter
  solstice); illuminated fraction to 0.4%. Frozen as a regression test. The check found two
  real bugs: a geocentric moonrise threshold applied to a topocentric altitude, and a search
  window anchored on the browser timezone rather than local solar time.

### Phase 2 — Sky ✅ (functional; grading not yet judged)

- Hillaire-style LUT atmosphere with ozone and multiple scattering. **Measured on the GPU:
  zenith 2784 cd/m², horizon 8424 cd/m² at solar noon** — real values for a clear sky.
- `SkyLibrary`: 18 CC0 pure-sky panoramas indexed by (weather, sun altitude), each one's baked
  sun position *derived* from its shooting coordinates and timestamp by the same NOAA solver
  that drives the live sun. The panorama modulates the analytic sky rather than replacing it.
- Sun disc with limb darkening and differential-refraction flattening; moon disc shaded by the
  true sub-solar direction over the NASA LROC albedo with LOLA-derived relief, Lommel-Seeliger
  limb behaviour, libration and earthshine.
- 8404-star field from the Yale Bright Star Catalogue, one draw call, magnitudes and B−V
  colours; procedural Milky Way in true galactic coordinates.
- Environment probe (rolling cubemap → PMREM) and CSM with a blended sun/moon handover.

### Phase 3 — Ocean ✅

- Clipmap merged into **one draw call** for the whole sea, with per-level lattice snapping and
  geomorphing that closes the cracks and the popping together.
- JONSWAP-sampled Gerstner bank — nothing hand-tuned. Significant wave height and peak period
  are read off the spectrum.
- **CPU/GPU parity measured on the real driver: 0.0059 mm max, 0.0012 mm RMS over 4096 sample
  points.** `npm run verify` fails above 1 mm.
- Water shading: Fresnel, probe reflection, screen-space refraction, Jerlov absorption,
  crest subsurface scattering, distance-widened GGX glitter, Jacobian-driven foam.

### Phase 5 — Post-processing ✅ (brought forward)

Implemented in phase 3 out of necessity: `ShaderMaterial` does not apply three's tone mapping,
so a scene authored in physical units clips to white without a composer. Exposure → bloom →
ACES → vignette/grain → chromatic aberration → SMAA, with convolution effects correctly split
across passes.

### Tooling ✅

- `npm run verify` — Playwright against a real GPU (RTX 4070). Fails on any console error or
  warning, runs the wave-parity harness, captures 19 frames (six times of day, plus every
  weather state at noon and golden hour), reports FPS and `renderer.info`.
- `npm run probe` equivalent (`scripts/probe.ts`) — single-frame photometry read-out for fast
  iteration on lighting.
- `scripts/almanac-check.ts` — reproducible astronomy cross-check against published tables.

## Measured

| | |
|---|---|
| GPU | RTX 4070 Laptop, ANGLE/D3D11 |
| Frame rate | **60 FPS locked** at 1080p, High preset, 1.1 ms CPU frame time |
| Draw calls | **23** (budget 300) |
| Triangles | 286,504 |
| Wave parity | 0.0059 mm max |
| Asset payload | 131 MB download / 103 MB disk / 67 MB shipped |

## Next

- **Phase 4 — Boat.** Procedural hull, 10-probe Archimedes buoyancy against `Ocean.heightAt`
  (which is written, tested and parity-verified — the solver has a correct surface to sit on),
  controls, spring-damped camera.
- Then phases 6–12: fishing loop, fish and underwater, world and islands, the weather system,
  UI and progression, polish, deployment.

## Known issues

1. **One console warning remains**, and the brief's standard is zero. It is an ANGLE/D3D
   shader-compiler note (`X4122: sum of 1 and -1.49e-17 cannot be represented accurately`)
   emitted through `THREE.WebGLProgram: Program Info Log`, not an error, and it comes from a
   shader with inlined trigonometric constants — almost certainly three's own PMREM blur, not
   project code. Not yet isolated conclusively.
2. **Colour grading has not been judged yet.** The frames render and the photometry is correct,
   but the per-regime LUT grade from §10 is not implemented and the frames have not had the
   "does it look like a photograph" pass the brief asks for after phases 2 and 5.
3. Weather states are currently driven only by the verify harness setting wind and cloud
   fraction directly; the synoptic simulation of phase 9 does not exist yet, so the eight
   states are not reachable in normal play.

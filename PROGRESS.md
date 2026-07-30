# PROGRESS.md

## Done

### Phase 0 — Scaffold ✅

- Vite 8 + TypeScript 5 in `strict` mode with `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`. `npm run build` is clean: **zero errors, zero warnings.**
- **Renderer decision made and committed: WebGL2.** Full reasoning in `DECISIONS.md` §1 — the
  brief's own hard rules (pmndrs `postprocessing`, shaders in `.glsl` files) are both
  WebGL-only, and TSL would move every shader back into TypeScript. A WebGPU capability probe
  runs at boot and reports into the debug panel so the call can be revisited.
- `core/`: `Engine` (system registry + frozen per-frame order), `Loop` (fixed 120 Hz sim with a
  spiral-of-death guard, variable render), `Input` (polled, edge events cleared per frame),
  `Time` (system clock by default; scale and override for screenshots only), `Settings`
  (reactive, four presets encoding the degradation priority), `ResourceManager` (per-URL cache
  + disposal ledger), `RendererFactory`, `DebugPanel` (lil-gui + stats.js behind `~`).
- `math/`: seeded `PRNG` (sfc32 + splitmix32, per-chunk stream derivation), `Noise`
  (2D/3D simplex, fBm, ridged).
- Asset pipeline: `npm run assets` is manifest-driven, checksum-locked and idempotent.
  **131 MB downloaded, 103 MB on disk — inside the ~150 MB budget.** 18 CC0 sky panoramas,
  11 CC0 PBR materials, NASA lunar albedo + LOLA elevation, Yale Bright Star Catalogue.
  `assets/CREDITS.md` is regenerated from the manifest every run.
- Loading screen driven by real resource counters, with a slow fade into the first clean frame.

### Phase 1 — Astronomy ✅

- `astro/` is pure: no three.js, no DOM. `AstroTime` (JD/JDE, observed ΔT table),
  `Nutation`, `SiderealTime` (GMST + equation of the equinoxes), `Coordinates`
  (ecliptic/equatorial/horizontal/galactic), `Refraction` (Bennett *and* Sæmundsson, plus
  horizon flattening and dip), `SolarPosition` (NOAA/Meeus ch. 25), `LunarPosition`
  (ELP-2000/82, full 60+60 term tables, topocentric parallax, bright-limb position angle),
  `RiseSet`, `Ephemeris`.
- **52 unit tests, all passing.** Book comparisons against Meeus's high-accuracy VSOP87/ELP
  results, plus physical identities that no amount of table-copying can fake: the solar-noon
  altitude identity at six sites across both hemispheres, equinox declination, midnight sun
  above the Arctic circle, sunrise/sunset symmetry about transit, refraction round-tripping.
- **Independent cross-check passed.** Every rise, set, transit and twilight event matches the
  US Naval Observatory *to the minute* at both Tel Aviv (2026-07-30) and Reykjavík
  (2026-12-21, 64°N winter solstice); illuminated fraction matches to 0.4%. Table in
  `DECISIONS.md`; frozen as a regression test. Two real bugs were caught by this and fixed:
  a geocentric moonrise threshold applied to a topocentric altitude (4 minutes of error), and
  a rise/set search window anchored on the browser's timezone rather than local solar time.

## Next

- **Phase 2 — Sky.** Analytic Rayleigh/Mie atmosphere, `SkyLibrary` with derived-sun azimuth
  alignment and baked-sun suppression, moon disc shaded by the real sub-solar direction with
  earthshine, ~9000-star field from the Yale catalogue with B−V colour, procedural Milky Way in
  galactic coordinates, environment probe → PMREM, cascaded shadows, sun/moon lights in lux.

## Known issues

- None open.

## Notes

- `requestAnimationFrame` does not fire in a non-composited browser pane, so in-pane
  screenshots are blank. This is an artifact of the harness, not the build; visual verification
  goes through Playwright (`npm run verify`).
- Performance target has not been measured yet — there is nothing on screen to measure. First
  real profiling pass lands with the ocean in Phase 3.

# PROGRESS.md

## Measured, on an RTX 4070 Laptop

| | |
|---|---|
| Frame rate | **60 FPS locked**, 1080p, High preset |
| Draw calls | **79** against a budget of 300 |
| Triangles | 313,562 |
| Tests | **80 passing** |
| CPU/GPU wave parity | 0.0059 mm max, 0.0012 mm RMS over 4096 points |
| Sky luminance at solar noon | 2784 cd/m² zenith, 8424 cd/m² horizon |
| Astronomy | every rise/set/transit matches the **US Naval Observatory to the minute** |
| Asset payload | 131 MB downloaded / 103 MB on disk / 67 MB shipped |

## Complete

**Phase 0 — Scaffold.** Vite 8 + TypeScript strict. Renderer decision made and committed:
WebGL2, because the brief's own hard rules (pmndrs `postprocessing`, shaders in `.glsl` files)
are both WebGL-only. Engine with a fixed 120 Hz sim and a variable render, polled input,
reactive settings whose four presets literally encode the degradation priority, resource
manager with a disposal ledger. Manifest-driven, checksum-locked CC0 asset pipeline.

**Phase 1 — Astronomy.** NOAA solar position, full 60+60-term ELP-2000/82 lunar theory with
topocentric parallax, bright-limb position angle and optical libration. Verified against
published USNO tables at two locations, including 64°N on the winter solstice. That check found
two real bugs.

**Phase 2 — Sky.** Hillaire LUT atmosphere with ozone and multiple scattering. 18 CC0 pure-sky
panoramas whose baked sun positions are *derived* from their shooting coordinates by the same
solver that drives the live sun. Moon disc with real NASA albedo, LOLA relief, libration,
Lommel-Seeliger limb and earthshine. 8404-star field in one draw call. Procedural Milky Way in
true galactic coordinates.

**Phase 3 — Ocean.** One draw call for the whole sea. JONSWAP-sampled Gerstner bank, nothing
hand-tuned. CPU/GPU parity proven on the real driver.

**Phase 4 — Boat.** 27 procedural parts, hull lofted from the same form the solver uses.
The agent found and analytically corrected two real defects: the probe quadrature was losing
two-thirds of the righting moment, and buoyancy acting at the keel trimmed the hull 7° by the head.

**Phase 5 — Post.** Brought forward out of necessity — `ShaderMaterial` does not apply three's
tone mapping, so a physically-authored scene clips to white without a composer.

**Phase 9 — Weather.** A genuine synoptic model: fBm pressure field, geostrophic wind with real
Coriolis, states as a classification *of* the field. Raymarched clouds lit by sun and moon.
**Cloud shadows on the water**, attenuating only the direct beam.

## In flight

Four agents building the fishing loop, fish and underwater, UI and progression, and islands and
props. Their substrate — bite model, species table, tides, chunk streaming, material library,
audio engine — is already in and compiling.

## Known issues

1. **The cloud layer bands into a hard strip at the horizon.** Visible in every daytime frame.
   Not yet diagnosed.
2. **The boat reads flat**, which points at its materials not sampling the environment probe.
   Not yet diagnosed.
3. **Night frames unverified** since the sky-floor fix. The moonlight-scattering and airglow
   terms are in and physically scaled, but I have not looked at a frame to confirm.
4. **One console warning** in dev builds — an ANGLE/D3D literal-precision note
   (`X4122`) from a shader with inlined trigonometric constants, almost certainly three's own
   PMREM blur. Absent from production builds, where `checkShaderErrors` is off.
5. **`npm run verify` is unreliable.** Its logs and the screenshot timestamps have disagreed
   across runs, which cost real time. Visual checks currently go through `scripts/probe.ts`,
   which captures a single frame and is trustworthy. The harness needs fixing properly.

## Not started

Phase 11 (polish, LOD tuning, final grade) and Phase 12 (production build, GitHub Pages
deployment, README with media). No live URL yet.

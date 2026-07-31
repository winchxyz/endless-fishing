# HANDOFF.md

**For a fresh session. Read this file first, then `CLAUDE.md`, then `DECISIONS.md`.**

---

## Your instructions

The owner wants a **playable, production-ready game**. Not a report, not a list of options.

- **Do not ask for confirmation.** Fix things. Deploy. Report when it is actually finished.
- **Verify every visual change on a rendered frame before deploying it.** The previous session
  deployed a shader change without looking at it and made the sky worse. `scripts/probe.ts`
  renders a frame and writes `screenshots/probe.png` in about 90 seconds. Look at it. Every time.
- **Do not trust `npm run verify`.** Its logs have disagreed with the screenshot timestamps.
  Use `scripts/probe.ts`.
- After any subagent failure, run `git status` before assuming its work was lost — agents write
  files as they go and usually survive an API error.

## Live site

**https://winchxyz.github.io/endless-fishing/** — GitHub repo `winchxyz/endless-fishing`.

Deployed by building and force-pushing `dist` to the `gh-pages` branch:

```bash
VITE_BASE=/endless-fishing/ npm run build
cd dist && git init -b gh-pages && git add -A && git commit -m "Deploy"
git push -f https://github.com/winchxyz/endless-fishing.git HEAD:gh-pages
```

`.github/workflows/deploy.yml` exists on disk but **is not in the repo** — the token has `repo`
scope but not `workflow`, so GitHub rejects any push containing it. To enable proper CI:
`gh auth refresh -s workflow`, then commit the file and switch Pages source to Actions.

## Build

```bash
npm install && npm run assets && npm run textures
npm run test:run     # 130 tests, all passing
npm run dev
npx tsx scripts/probe.ts "2026-06-21T16:10:00Z"   # renders screenshots/probe.png
```

---

## OPEN BUGS — this is the actual work

### 1. Orange band across the horizon. Not diagnosed. Highest priority.

A bright orange/red horizontal line sits exactly on the horizon, worst at night. Two failed
attempts, so do not repeat them:

- **Not** the cloud layer. It appeared in night frames taken before clouds, islands or props
  existed at all.
- **Not** HDRI light pollution. The night panoramas do carry sodium glow on the horizon and that
  is now faded out after dark — the band survived, so that was not it.

Untested lead: in `ocean.frag` the reflection ray is clamped with `R.y = max(R.y, 0.008)` so a
grazing view samples the environment probe's horizon row. If the probe's lowest row holds a warm
value (the sky's own horizon, or the sun-disc extinction term bleeding in), every grazing pixel
would reflect it as a hard line. Check what the probe cubemap actually contains near its
equator. Also check `sky.frag`'s solar-disc block: it applies
`sampleTransmittance(uTransmittanceLut, radius, uSunDirection.y)` with a *negative* sun altitude
at night, which is outside the LUT's meaningful domain.

### 2. Moon glitter path still clips to white

Improved but not fixed. Night exposure went 13.6 → 5.5 by giving the meter a specular allowance
(`SPECULAR_GAIN` in `Sky.updateExposure`). The highlight still blows. Either raise the gain, or
better, widen the GGX roughness floor at night in `ocean.frag` — the moon is a 0.5° disc, not a
point, and the specular lobe is currently narrower than the source.

### 3. Motion is invisible — this is why "WASD doesn't work"

The boat **does** move; the HUD speed responds (0.0 → 2.0 kn). But the camera is locked to the
boat, the ocean clipmap is camera-centred, and there are no fixed references, so nothing appears
to happen. The owner reads this as broken controls, and they are right that it is broken — as a
game, not as an input system.

Fix by adding what is missing: **a wake** (the brief asks for diverging Kelvin V-waves scaled by
speed), **bow spray**, and visible fixed landmarks. `Wake` was never written. This is the single
biggest gap between what exists and something that feels like a game.

### 4. No audio at all

`src/core/Audio.ts` is a complete Web Audio engine with a synthesis toolkit (noise buffers, FM
voices, procedural impulse-response reverb, positional panners) and it is **never instantiated**.
`AudioEngine.create(settings)` returns `AudioEngine | null`.

`src/world/AudioBeds.ts` — the system that would drive it from `WorldState` — **does not exist**;
the agent writing it was killed before it got there. It needs writing: wave noise scaled by
`significantWaveHeight` and `beaufort`, engine pitched by RPM, hull slap from the boat's vertical
acceleration, rain from `precipitation`, thunder delayed by real distance from
`weather.onLightning`, a low-pass when `underwater.isSubmerged`.

### 5. Save does not persist

`src/gameplay/Save.ts` is written and tested; nothing calls it. Progression, inventory and the
journal are all lost on reload.

### 6. Catch card never appears

`CatchCard` is constructed but nothing watches `fishing.state === 'landed'` to show it with
`fishing.lastCatch`. Fields map 1:1 onto `CatchCardData` except `personalBest`/`firstCatch`,
which only the journal knows.

### 7. NaN in the cloud march

Symptom is patched (`ef_safeTransmittance` guards the buffer alpha at both write and read,
because `saturate(NaN)` collapses to 0 and the premultiplied blend then multiplies the sky by
zero — that was the black speckle). The march still produces a NaN at grazing angles. Root cause
unfound.

### 8. Cloud layer bands at the horizon

`tFar = min(ef_shellExit(...), CLOUD_MAX_DISTANCE_M)` — the clamp bites at one elevation all the
way round the compass, so it lands as a hard horizontal edge. A previous attempt to fade the
layer where the clamp bites was reverted because it was deployed unverified and looked worse.
The diagnosis was right; the fix needs doing with a frame in hand.

### 9. Weather opens pinned

`main.ts` sets `settings.world.weatherOverride = 'light-breeze'` because the synoptic field is
deterministic and this seed lands it in a Beaufort 9 gale, which made the game unplayable on
load. That is a workaround. The proper fix is to seed the pressure field in a benign state and
let it evolve, so all eight weather states are reachable in normal play.

### 10. Not implemented from the brief

The per-regime LUT colour grade (§10) — `PostFX` has exposure, bloom, ACES, vignette, grain, CA
and SMAA, but **no grade**, and no GTAO, DoF, god rays or motion blur. Phase 11 (LOD tuning,
profiling) never happened. README has one screenshot, not the required matrix plus a storm GIF.

---

## What is solid — do not re-derive it

- **Astronomy.** Verified against the US Naval Observatory: every rise, set, transit and twilight
  event matches **to the minute** at Tel Aviv and at Reykjavík on the winter solstice. 52 tests.
  Reproduce: `npx tsx scripts/almanac-check.ts 2026-07-30 32.08 34.78 3`.
- **Ocean.** CPU/GPU wave agreement **0.0059 mm** over 4096 points, measured on the real driver.
  The whole sea is one draw call.
- **Sky photometry.** 2784 cd/m² zenith, 8424 horizon at solar noon. Real values.
- **Buoyancy.** Two real defects found and corrected analytically (probe quadrature losing two
  thirds of the righting moment; buoyancy at the keel trimming the hull 7° by the head).
- **Performance.** 60 FPS, ~150 draw calls against a 300 budget, on an RTX 4070.

---

## Gotchas that cost hours. Read these.

1. three injects `float luminance(const in vec3)` into every `ShaderMaterial` program. Never
   define your own — use `ef_luminance` from `lib/constants.glsl`.
2. three defines `saturate` as a **macro**. A same-named function is a syntax error pointing at
   your definition rather than at the collision.
3. Physical radiance must pass through `hdrClamp()`. The sun disc is 1.6×10⁹ cd/m²; half-float
   tops out at 65504 and stores `Infinity`, which bloom then averages across the whole frame.
4. **A convolution effect reads the pass input buffer, not the accumulated colour.** Bloom after
   exposure *in the same pass* still sees raw radiance. Exposure needs its own pass, and two
   convolution effects cannot share a pass — pmndrs throws inside the constructor, killing boot
   with no obvious link to the cause.
5. `ShaderMaterial` does not apply three's tone mapping. The composer owns it.
6. **CSM registration cuts both ways.** `MeshStandardMaterial` (boat, fishing rod) **must** call
   `sky.registerShadowMaterial()` or it is lit by every cascade at once. Custom `ShaderMaterial`s
   shading from the ephemeris via `worldlight.glsl` (ocean, fish, seabed, islands, props, birds)
   **must not**. 3–4 stops of error in either direction.
7. Texture fetches inside loops need `texture2DLodEXT(tex, uv, 0.0)`.
8. The exposure meter reads back from the sky-view LUT — measured, not modelled. An analytic fit
   was two stops out at civil dawn. Do not replace it with a curve.
9. Eye adaptation resets on a clock jump; a time override is a cut, not a sunset.
10. **vitest has no `vite-plugin-glsl`.** A test cannot transitively import anything that imports
    a `.vert`. That is why `WorldField.ts` is separate from `Islands.ts`, and why
    `test/fish.test.ts` mocks its shader modules.
11. **Draw order matters and is easy to get wrong.** The underwater murk shell at `renderOrder
    -500` sits over the sky (−1000) and stars (−900). Showing it for any submersion above zero
    blacked out every night frame. Anything full-screen needs its visibility condition checked
    against a real frame.

---

## Repository map

```
src/astro/     pure — the ephemeris. 52 tests. No three, no DOM.
src/math/      pure — Gerstner (mirrored by shaders/lib/gerstner.glsl), Noise, PRNG
src/core/      Engine, Loop, Input, Time, Settings, WorldState, ResourceManager, Audio, DebugApi
src/world/     Sky, Atmosphere, SkyLibrary, StarField, Ocean, Weather, Clouds, Tides, Chunks,
               Islands, WorldField, Vegetation, TerrainMesh, Props, PropGeometry, Seabed,
               Underwater
src/entities/  Boat, BoatGeometry, BoatCamera, Buoyancy, Bobber, FishingLine, Fish,
               FishGeometry, Birds, SeaLifeGeometry            (Wake MISSING)
src/gameplay/  Species, BiteModel, FishingSystem, FightModel, Progression, Inventory, Save,
               UiSystem
src/render/    PostFX, Materials, EnvironmentProbe, ProceduralTextures, WorldLighting,
               GerstnerParity, FullScreenPass
src/ui/        HUD, CatchCard, Journal, SettingsPanel, LoadingScreen — never imports three
src/shaders/   sky/ ocean/ clouds/ fish/ underwater/ terrain/ world/ entities/ line/ post/ lib/
scripts/       fetch-assets, process-textures, verify, probe, almanac-check
```

Everything is wired into `main.ts` except audio, save and the catch-card trigger.

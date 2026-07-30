# HANDOFF.md

Written to let a fresh session pick this up cold. Read `CLAUDE.md` first (conventions and the
four single-sources-of-truth), then `DECISIONS.md` (24 recorded decisions with reasoning), then
`PROGRESS.md` (measured numbers, five open issues). This file is the "what to do next" layer on
top of those.

---

## Start here

```bash
npm install
npm run assets      # 131 MB of CC0 assets, checksum-locked, idempotent
npm run textures    # ORM packing, lunar normal map, star catalogue -> binary
npm run test:run    # 80 tests
npm run dev
```

`npx tsx scripts/probe.ts "2026-06-21T16:10:00Z"` boots the game headless, prints photometry,
frame stats and console problems, and writes `screenshots/probe.png`. **This is the trustworthy
visual check.** `npm run verify` is not — see open issue 5.

---

## The state in one paragraph

The engine, the astronomy, the sky, the ocean, the boat, the weather and the UI are built and
measured: 60 FPS at 1080p, 79 draw calls against a 300 budget, 80 tests passing, CPU/GPU wave
agreement at 0.0059 mm, and rise/set times matching the US Naval Observatory to the minute. What
is missing is the connective tissue — the fishing state machine, the integration of the landed
subsystems into `main.ts`, then polish and deployment. **There is no live URL yet.**

---

## Next actions, in priority order

### 1. Write `src/gameplay/FishingSystem.ts`

The single highest-value missing file. Without it the game has no loop. Everything it needs
already exists and compiles:

| Dependency | Where | What it gives you |
|---|---|---|
| `evaluateBite`, `rollBite`, `BiteConditions`, `BiteFactors` | `src/gameplay/BiteModel.ts` | bite rate as a product of named factors |
| `selectSpecies`, `rollSpecimen`, `Species`, `CaughtFish` | `src/gameplay/Species.ts` | 12 species, two-stage rarity roll, log-normal mass |
| `Bobber` | `src/entities/Bobber.ts` | buoyancy with real vertical momentum |
| `FishingLine` | `src/entities/FishingLine.ts` | Gauss-Seidel relaxed line with sag and tension |
| `boat.rodTipWorldPosition(out)`, `boat.isAnchored` | `src/entities/Boat.ts` | where the rod is |
| `ocean.heightAt/normalAt` | `src/world/Ocean.ts` | where the water is |
| `world.significantWaveHeight`, `world.beaufort` | `src/core/WorldState.ts` | how rough it is |

It should be a `System` with `name: 'fishing'`, `priority: 40`, and an **explicit** state machine
— `idle → charging → casting → sinking → waiting → bite → fighting → landed | escaped → idle` —
with no booleans standing in for states. The fight must have feel: per-species rhythm from
`pull`/`runRate`/`stamina`, a snap threshold, a slack-loses-the-fish rule, and tension made
volatile by `significantWaveHeight`.

Also missing: `test/fishing.test.ts` and `test/progression.test.ts`.

### 2. Integrate everything into `src/main.ts`

Current registration order in `main.ts` is: Sky → Weather → Clouds → Ocean (with
`ocean.setCloudShadows(clouds)`) → Tides → Boat → BoatCamera → PostFX.

Not yet wired: `HUD`, `CatchCard`, `Journal`, `SettingsPanel`, `Progression`, `Inventory`,
`Save`, `AudioEngine`/audio beds, and whatever the fish and islands agents produced. The UI
needs a plain per-frame snapshot object built in `main.ts` — `src/core/DebugApi.ts` shows the
shape of the data available.

**Every PBR material must call `sky.registerShadowMaterial(material)`.** CSM adds one
full-intensity directional light per cascade; an unregistered material is lit by all of them and
renders 3–4× too bright, which reads as a blown-out object rather than a missing shadow.

### 3. Fix the two visible defects

- **Cloud banding at the horizon.** A hard strip in every daytime frame. Start in
  `src/shaders/clouds/clouds.frag` — likely the shell intersection or the march's near/far
  clamp at grazing angles.
- **The boat reads flat.** Probably its materials are not receiving `scene.environment`, or
  `envMapIntensity` is unset. Check that the probe's PMREM output is assigned before the boat's
  materials are compiled.

### 4. Verify the night sky

Moonlight scattering and airglow were added to `sky.frag` at measured magnitudes (full moon
≈ 0.001 cd/m² of sky, airglow ≈ 0.0002) but **never visually confirmed**. Run
`npx tsx scripts/probe.ts "2026-07-29T21:30:00Z"` — a real full moon — and look at the frame.

### 5. Fix `npm run verify`

Its logs claimed "Report written" while the screenshot timestamps showed files from an earlier
run. Probable cause: the spawned `npm run dev` tree is not being killed reliably on Windows, so
a stale server serves a stale page while a new one binds another port. `scripts/probe.ts` does
the same job for one frame and is reliable; the difference between them is where to look.

A harness you cannot trust is worse than none, because it makes you doubt correct results. Fix
it before trusting any more screenshots.

### 6. Then Phase 11 and 12

Polish, LOD tuning and the per-regime LUT colour grade (§10 of the brief — not implemented; the
`PostFX` chain has exposure, bloom, ACES, vignette, grain, CA and SMAA, but no grade, and no
GTAO, DoF, god rays or motion blur). Then the production build, GitHub Actions deployment to
Pages, and a README with screenshots and a storm GIF.

---

## Things that will bite you

These are all documented in `DECISIONS.md`, but they are the ones that cost hours:

1. **three injects `float luminance(const in vec3)` into every `ShaderMaterial` program.**
   Defining your own kills the whole program. Use `ef_luminance` from `lib/constants.glsl`.
2. **three defines `saturate` as a macro.** A same-named function becomes a syntax error, and
   the error points at the definition rather than the collision.
3. **Physical radiance must go through `hdrClamp()`.** The sun disc is 1.6×10⁹ cd/m²; half-float
   tops out at 65504, so the true value stores as `Infinity` and bloom averages that across the
   whole frame. White screen, no error.
4. **A convolution effect reads the pass input buffer, not the accumulated colour.** Bloom placed
   after exposure *in the same pass* sees raw radiance. Exposure gets its own pass, and two
   convolution effects cannot share a pass at all — pmndrs throws inside the constructor, which
   takes down boot with no obvious link to the cause.
5. **`ShaderMaterial` does not apply three's tone mapping.** A custom shader writing physical
   units goes straight to the framebuffer and clips. The composer owns tone mapping.
6. **Texture fetches inside loops need `texture2DLodEXT(tex, uv, 0.0)`**, or ANGLE warns about
   undefined derivatives.
7. **The exposure meter reads back from the sky-view LUT.** It is measured, not modelled — an
   analytic fit was two stops out at civil dawn. Do not replace it with a curve.
8. **Adaptation resets on a clock jump.** A time override is a cut, not a sunset; without the
   reset every night screenshot is a photograph of a black frame.

---

## Agent workflow notes

Roughly ten subagents were dispatched across this build; four returned reports and six were
killed by API errors (`403 Request not allowed`, connections dropped mid-response). **They write
files as they go, so their work usually survives the failure** — after any agent failure, check
`git status` before assuming the work is lost. That recovered six substantial modules.

Batches of two to four agents fared better than seven. Give each a disjoint file list and forbid
`src/main.ts`, then integrate by hand.

---

## Repository map

```
src/astro/     pure, no three, no DOM — the ephemeris. 52 of the 80 tests live here.
src/math/      pure — Gerstner (mirrored by shaders/lib/gerstner.glsl), Noise, PRNG
src/core/      Engine, Loop, Input, Time, Settings, WorldState, ResourceManager, DebugApi
src/world/     Sky, Atmosphere, SkyLibrary, StarField, Ocean, Weather, Clouds, Tides, Chunks
src/entities/  Boat, BoatGeometry, BoatCamera, Buoyancy, Bobber, FishingLine
src/gameplay/  Species, BiteModel, Progression, Inventory, Save   (FishingSystem MISSING)
src/render/    PostFX, Materials, EnvironmentProbe, ProceduralTextures, GerstnerParity
src/ui/        HUD, CatchCard, Journal, SettingsPanel, LoadingScreen — never imports three
src/shaders/   sky/ ocean/ clouds/ line/ terrain/ world/ entities/ post/ lib/
scripts/       fetch-assets, process-textures, verify, probe, almanac-check
```

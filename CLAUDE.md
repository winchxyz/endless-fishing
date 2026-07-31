# CLAUDE.md — Endless Fishing

Real-time WebGL2 ocean/fishing game. Physically-based sky driven by a live astronomical
ephemeris, spectrum-driven Gerstner ocean, hand-written buoyancy solver.

---

## Stack

| Concern | Choice |
|---|---|
| Build | Vite 8 + TypeScript 5 (`strict`, `noUncheckedIndexedAccess`) |
| Renderer | **three.js `WebGLRenderer` (WebGL2)** — see `DECISIONS.md` §1 |
| Post | `postprocessing` (pmndrs) `EffectComposer` |
| Shaders | `.glsl` / `.vert` / `.frag` files via `vite-plugin-glsl`. **Never** template strings in `.ts` |
| Debug | `lil-gui` (toggle `~`), `stats.js` |
| Tests | `vitest` (node env, pure math only — no WebGL in tests) |
| E2E / capture | `playwright` via `npm run verify` |
| Physics | Hand-written. No physics library. |

---

## Commands

```bash
npm run dev        # vite dev server
npm run build      # tsc --noEmit && vite build   (must be 0 errors, 0 warnings)
npm run preview    # serve dist/
npm run test       # vitest watch
npm run test:run   # vitest run  (CI)
npm run assets     # download + verify CC0 assets into assets/
npm run textures   # process downloaded textures -> KTX2 / ORM packing
npm run verify     # playwright: boot, assert zero console errors, capture screenshots, log FPS
npm run probe      # playwright: capture chosen moments, photometry, helm, horizon zooms
npm run media      # regenerate docs/media/ — the stills and the storm GIF the README shows
npm run lint       # tsc --noEmit
```

---

## Architecture

```
src/
  core/      Engine, Renderer, Loop, Input, Time, ResourceManager, Settings
  astro/     SolarPosition, LunarPosition, SiderealTime, StarCatalog, Refraction, AstroTime
  world/     Ocean, Sky, Atmosphere, Weather, Islands, Tides, Props
  entities/  Boat, Fish, FishingRod, Bobber, Birds, Wake (ribbon + bow spray)
  gameplay/  FishingSystem, CatchTable, Inventory, Progression, Journal
  render/    PostFX, Materials, LODManager, EnvironmentProbe, CSM
  shaders/   *.vert *.frag *.glsl
  ui/        HUD, Journal, Settings (HTML/CSS overlay)
  math/      Gerstner, Noise, PRNG
scripts/     fetch-assets.ts, process-textures.ts, verify.ts
assets/      git-ignored; populated by `npm run assets`
```

### Layering rules (enforce these in review)

1. `src/math/**` and `src/astro/**` are **pure**: no `three` import, no DOM, no globals.
   They are the only things unit-tested and they must stay trivially testable.
2. `src/core/**` may import `three` but knows nothing about the game.
3. `src/world`, `src/entities`, `src/render` may import `core`, `math`, `astro`.
4. `src/ui/**` never imports `three`. It receives a plain data snapshot each frame.
5. No system reaches into another system's internals. Systems read the frozen
   `WorldState` snapshot produced once per frame by `Engine`.

### The single sources of truth

There are exactly four, and duplicating any of them is a bug:

| Thing | Owner | Mirrored in |
|---|---|---|
| Wave displacement | `math/Gerstner.ts` | `shaders/lib/gerstner.glsl` — kept in sync by `test/gerstner.parity.test.ts` |
| Sky/celestial geometry | `astro/*` (pure) | nothing — every renderer *consumes* `EphemerisState` |
| Wind vector | `world/Weather.ts` | consumed by ocean spectrum, flags, clouds, rain, spray, birds, drift |
| Quality knobs | `core/Settings.ts` | systems subscribe to `settings.onChange` and rebuild |

If you add a wave term to the GLSL, you **must** add it to the TS and the parity test
will tell you. A boat that floats through a wave is a hard failure.

---

## Code conventions

- ES modules, named exports. Default exports only for the top-level `main.ts` entry.
- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
  Index access returns `T | undefined` — handle it, do not `!` your way out.
- No `any`. Use `unknown` + a narrowing guard.
- Angles: **radians everywhere internally.** Functions taking or returning degrees are
  suffixed `Deg` (`altitudeDeg`). Astronomy literature is in degrees, so `astro/` converts
  at its boundary and exposes radians.
- Time: internally always UTC + Julian Day (`number`). Never pass a local `Date` across a
  module boundary; pass a `JulianDate`.
- Units: SI. Metres, seconds, kilograms, radians, lux, kelvin.
- Allocation: **zero allocation in the frame loop.** Scratch `Vector3`/`Quaternion`
  instances are module-level `const` and reused. `update(dt)` must not `new` anything.
- Disposal: every class that creates GPU resources implements `dispose()`, and its owner
  calls it. `ResourceManager` tracks and asserts on leak in dev.
- Naming: `PascalCase` classes/types, `camelCase` values, `SCREAMING_SNAKE` module consts.
- Files are one concept each. A file over ~450 lines is a smell; split it.

### Shader conventions

- Shared GLSL lives in `src/shaders/lib/*.glsl` and is `#include`d (vite-plugin-glsl).
- Uniform names match the TS field name exactly (`uSunDirection` <-> `uniforms.uSunDirection`).
- All custom uniforms are prefixed `u`. Varyings `v`. Attributes `a`.
- Precision: `highp float` in every fragment shader that touches world position — the
  ocean is kilometres across and mediump will band visibly.
- Never `#ifdef` your way to a mega-shader. Prefer separate programs per weather-independent
  variant; the compile cost is paid once at load.

---

## Asset pipeline

- **Licence is a hard constraint: CC0 / public domain only.** Poly Haven, ambientCG,
  NASA/USGS. Every downloaded file is checksummed and listed in `assets/CREDITS.md`
  with source URL and licence. Nothing binary is ever committed to git.
- `npm run assets` is idempotent and must fully populate a fresh clone.
- `npm run textures` resizes to POT, packs ORM (occlusion=R, roughness=G, metal=B),
  and encodes KTX2/UASTC. Anisotropy is set to the device max at load time.
- If a needed texture is not available under an acceptable licence, it is generated
  procedurally and that is logged in `DECISIONS.md`.
- **Geometry is never downloaded.** Boat, fish, islands, trees and props are authored in
  Three.js geometry code. Textures are real; geometry is ours.

---

## Non-negotiables

1. Zero console errors **and warnings** in the browser. `npm run verify` fails on either.
2. `npm run build` emits zero errors and zero warnings.
3. The sky comes from the ephemeris. There is no hand-authored day/night timeline anywhere
   in this repo, and adding one is a rejected change.
4. No placeholders, no `TODO: implement later`, no commented-out code, no empty functions
   in a committed build.
5. Physical correctness where a real model exists: NOAA/Meeus for the sun, ELP-2000 for the
   moon, JONSWAP for the sea, Archimedes for buoyancy, Beaufort for sea state.

## Degradation priority

If Ultra cannot hold 60 fps, cut in exactly this order and stop as soon as target is met:
cloud steps → refraction/SSR resolution → SSAO → DoF/motion blur → shadow cascades →
draw distance & instance density → fish school counts.

**Never** cut, above the Low preset: ocean wave geometry resolution or wave count, the water
shading model, foam, ACES + grading, or astronomical accuracy. Those five are the product.

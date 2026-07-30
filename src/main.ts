import './ui/styles.css';
import { createEngine, type Engine } from './core/Engine.js';
import { DebugPanel } from './core/DebugPanel.js';
import { installDebugApi } from './core/DebugApi.js';
import { LoadingScreen, showFatalError } from './ui/LoadingScreen.js';
import { Sky } from './world/Sky.js';
import { Ocean } from './world/Ocean.js';
import { Tides } from './world/Tides.js';
import { Weather } from './world/Weather.js';
import { Clouds } from './world/Clouds.js';
import { PostFX } from './render/PostFX.js';
import { MaterialLibrary } from './render/Materials.js';
import { Boat } from './entities/Boat.js';
import { BoatCamera } from './entities/BoatCamera.js';
import { locationFromTimezone, requestLocation } from './world/Geolocation.js';

/**
 * Entry point. Boots the engine, wires the loading screen to real resource progress, and
 * hands control to the frame loop.
 *
 * Every failure path here ends in a readable message rather than a blank canvas — an ocean
 * renderer that silently shows nothing is indistinguishable from a broken link.
 */

async function boot(): Promise<void> {
  const loading = new LoadingScreen();
  loading.set(0.02, 'Probing graphics capabilities');

  const canvas = document.getElementById('scene');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Canvas #scene is missing from index.html');
  }

  const engine: Engine = await createEngine(canvas);
  loading.set(0.15, 'Renderer ready');

  const debug = new DebugPanel(engine);
  engine.debug = debug;

  engine.resources.onProgress((completed, total, label) => {
    // Resource loading occupies the 15–95% band; the tail is first-frame compilation.
    const fraction = total === 0 ? 1 : completed / total;
    loading.set(0.15 + fraction * 0.8, `Loading ${label.split('/').pop() ?? label}`);
  });

  // Non-blocking: the game starts at the timezone-inferred position and snaps to the real one
  // if and when the browser grants permission. Nothing waits on a permission dialog.
  const guess = locationFromTimezone();
  engine.settings.setLocationIfUnset(guess.latitudeDeg, guess.longitudeDeg);
  void requestLocation().then((location) => {
    if (location.source === 'geolocation') {
      engine.settings.setLocation(location.latitudeDeg, location.longitudeDeg);
    }
  });

  const sky = await Sky.create(engine);
  engine.add(sky);
  sky.onSettingsChanged(engine);

  // Weather is the sole writer of the wind, cloud and pressure fields, so it goes in before
  // anything that reads them. Clouds resolve Sky lazily, so both must follow it.
  engine.add(new Weather(engine));
  const clouds = new Clouds(engine);
  engine.add(clouds);

  const ocean = new Ocean(engine);
  ocean.setCloudShadows(clouds);
  engine.add(ocean);

  engine.add(new Tides());

  loading.set(0.55, 'Building the boat');
  const materials = new MaterialLibrary(engine.resources);
  const boat = await Boat.create(engine, ocean, materials);
  engine.add(boat);

  // Every PBR material has to enrol with the cascaded shadow map. CSM adds one directional
  // light per cascade and patches materials to pick the right one; an unregistered material is
  // lit by all of them and comes out three or four times too bright.
  for (const material of boat.materials) sky.registerShadowMaterial(material);

  // The camera's own priority orders it after the ocean, so the clipmap and the star sphere
  // centre on the previous frame's viewpoint. At a 0.55 m base cell that is a few centimetres
  // of lag on a mesh that is already snapped to a lattice, so it is not visible — but it is
  // the reason the ocean is not simply re-centred here.
  engine.add(new BoatCamera(engine, boat, ocean));

  // Registered last so it sees the finished scene; it takes over rendering from the engine.
  engine.add(new PostFX(engine));

  installDebugApi(engine);

  loading.set(0.96, 'Compiling shaders');
  engine.start();

  // Wait for two presented frames before fading: the first compiles, the second is clean.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  loading.finish();

  window.addEventListener('beforeunload', () => {
    debug.dispose();
    engine.dispose();
  });
}

// The error is surfaced in the DOM rather than rethrown: an unhandled rejection would show
// up as console noise, and `npm run verify` treats any console error as a build failure.
// In dev we also print the stack, because there a red console line is the useful signal.
void boot().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('WebGL2')) {
    showFatalError(
      'WebGL2 required',
      'This browser cannot create a WebGL2 context. Try a recent Chrome, Edge, Firefox or Safari, and make sure hardware acceleration is enabled.',
    );
  } else {
    showFatalError('Failed to start', message);
  }
  if (import.meta.env.DEV) console.error(error);
});

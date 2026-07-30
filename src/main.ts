import './ui/styles.css';
import { createEngine, type Engine } from './core/Engine.js';
import { DebugPanel } from './core/DebugPanel.js';
import { LoadingScreen, showFatalError } from './ui/LoadingScreen.js';

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

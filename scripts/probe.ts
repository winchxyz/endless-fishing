import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import sharp from 'sharp';

/**
 * Fast frame diagnostic.
 *
 * `verify.ts` takes three minutes because it captures nineteen frames and settles between each
 * one. This boots the dev server once and captures as many frames as you ask for inside a single
 * browser session, which is what makes chasing a lighting bug affordable: the fixed cost is the
 * server and the shader compile, and every additional moment after that is a few seconds.
 *
 * Every capture also writes a 4x nearest-neighbour zoom of the horizon, found by scanning for the
 * row of steepest vertical luminance gradient. A one-pixel artefact on a 1080-line frame is
 * invisible in a thumbnail and obvious in that crop, and the whole reason the horizon bug survived
 * two sessions is that nobody looked at it magnified.
 *
 * Usage:
 *   npx tsx scripts/probe.ts
 *   npx tsx scripts/probe.ts --times=2026-06-21T16:10:00Z,2026-06-21T21:30:00Z
 *   npx tsx scripts/probe.ts --times=... --graphics='{"chromaticAberrationEnabled":false}'
 *   npx tsx scripts/probe.ts --times=... --at=64.15,-21.94 --weather=storm --wind=18,240
 *   npx tsx scripts/probe.ts --times=... --ui --tag=with-hud --size=1600x900
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'screenshots');

/**
 * A port of its own, claimed strictly.
 *
 * Vite silently walks to the next free port when its default is taken, and the probe then
 * connects to whatever else happens to be sitting on 5173 — which cost an afternoon of frames
 * that were captured from a completely different working tree. `--strictPort` turns a collision
 * into an error instead of a wrong answer.
 */
const DEFAULT_PORT = 5199;

interface Options {
  port: number;
  times: string[];
  latitudeDeg: number;
  longitudeDeg: number;
  graphics: Record<string, unknown> | null;
  weather: string | null;
  windSpeed: number | null;
  windDirectionDeg: number;
  preset: string | null;
  showUi: boolean;
  tag: string;
  width: number;
  height: number;
  settleMs: number;
  /** Keys to hold down while the frame settles, e.g. `w` for the throttle. */
  hold: string[];
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    port: DEFAULT_PORT,
    times: [],
    latitudeDeg: 32.08,
    longitudeDeg: 34.78,
    graphics: null,
    weather: null,
    windSpeed: null,
    windDirectionDeg: 0,
    preset: null,
    showUi: false,
    tag: 'probe',
    width: 1280,
    height: 720,
    settleMs: 5000,
    hold: [],
  };

  for (const argument of argv) {
    const [rawKey = '', ...rest] = argument.split('=');
    const value = rest.join('=');
    switch (rawKey) {
      case '--times':
        options.times = value.split(',').filter((t) => t.length > 0);
        break;
      case '--at': {
        const [lat, lon] = value.split(',');
        if (lat !== undefined) options.latitudeDeg = Number(lat);
        if (lon !== undefined) options.longitudeDeg = Number(lon);
        break;
      }
      case '--graphics':
        options.graphics = JSON.parse(value) as Record<string, unknown>;
        break;
      case '--weather':
        options.weather = value;
        break;
      case '--wind': {
        const [speed, direction] = value.split(',');
        if (speed !== undefined) options.windSpeed = Number(speed);
        if (direction !== undefined) options.windDirectionDeg = Number(direction);
        break;
      }
      case '--preset':
        options.preset = value;
        break;
      case '--ui':
        options.showUi = true;
        break;
      case '--tag':
        options.tag = value;
        break;
      case '--size': {
        const [w, h] = value.split('x');
        if (w !== undefined) options.width = Number(w);
        if (h !== undefined) options.height = Number(h);
        break;
      }
      case '--settle':
        options.settleMs = Number(value);
        break;
      case '--port':
        options.port = Number(value);
        break;
      case '--hold':
        options.hold = value.split(',').filter((k) => k.length > 0);
        break;
      default:
        // A bare argument is a timestamp, which keeps the old one-shot invocation working.
        if (!rawKey.startsWith('--')) options.times.push(argument);
        break;
    }
  }

  if (options.times.length === 0) options.times = ['2026-06-21T09:45:00Z'];
  return options;
}

const options = parseArgs(process.argv.slice(2));
const URL = `http://127.0.0.1:${options.port}/`;

const server = spawn(
  'npx',
  ['vite', '--port', String(options.port), '--strictPort', '--host', '127.0.0.1'],
  { cwd: ROOT, shell: true, stdio: 'ignore' },
);

/**
 * Kill the whole tree.
 *
 * `npx` and the shell sit between this process and the vite server, so killing the child we
 * spawned leaves the server holding the port — which is how a dozen orphaned dev servers ended up
 * fighting over it. `/t` takes the descendants with it.
 */
function killServer(): void {
  if (server.pid !== undefined) {
    spawn('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' });
  }
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      const response = await fetch(URL, { method: 'HEAD' });
      if (response.ok || response.status === 404) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('dev server did not start');
}

/**
 * The row where the frame changes fastest vertically, which on an open ocean is the horizon.
 *
 * Averaging each row across the full width first is what makes this robust: a wave crest is a
 * local gradient, the horizon is a gradient the entire width of the frame agrees on.
 */
async function findHorizonRow(pngPath: string, height: number): Promise<number> {
  const { data, info } = await sharp(pngPath)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rowMeans = new Float64Array(info.height);
  for (let y = 0; y < info.height; y += 1) {
    let sum = 0;
    for (let x = 0; x < info.width; x += 1) sum += data[y * info.width + x] ?? 0;
    rowMeans[y] = sum / info.width;
  }

  let bestRow = Math.floor(info.height / 2);
  let bestGradient = -1;
  // Ignore the outer eighth: a vignette edge and the UI shell both produce large gradients that
  // are not the horizon.
  const margin = Math.floor(info.height / 8);
  for (let y = margin; y < info.height - margin; y += 1) {
    const gradient = Math.abs((rowMeans[y + 1] ?? 0) - (rowMeans[y - 1] ?? 0));
    if (gradient > bestGradient) {
      bestGradient = gradient;
      bestRow = y;
    }
  }
  return Math.round((bestRow / info.height) * height);
}

/** A 4x zoom of a band around the horizon, where one-pixel artefacts actually become visible. */
async function writeHorizonCrop(pngPath: string, cropPath: string): Promise<void> {
  const metadata = await sharp(pngPath).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width === 0 || height === 0) return;

  const horizon = await findHorizonRow(pngPath, height);
  const band = 24;
  const top = Math.max(0, Math.min(height - band * 2, horizon - band));
  const cropWidth = Math.min(width, 400);

  await sharp(pngPath)
    .extract({ left: Math.floor((width - cropWidth) / 2), top, width: cropWidth, height: band * 2 })
    .resize({ width: cropWidth * 4, kernel: 'nearest' })
    .png()
    .toFile(cropPath);
}

async function capture(page: Page, iso: string, index: number): Promise<unknown> {
  await page.evaluate((time) => {
    window.endlessFishing?.setTime(time);
  }, iso);

  // Held rather than pressed: the throttle is a state the systems sample each frame, not an edge,
  // and a wake or a bow spray only exists once the hull has had some seconds of way on. A frame
  // of a stationary boat proves nothing about either of them.
  for (const key of options.hold) await page.keyboard.down(key);
  await page.waitForTimeout(options.settleMs);

  const readout = await page.evaluate(() => {
    const api = window.endlessFishing;
    if (api === undefined) return null;
    return {
      photometry: api.photometry(),
      ephemeris: api.ephemeris(),
      helm: api.helm(),
      stats: api.stats(),
    };
  });

  const name = `${options.tag}-${String(index).padStart(2, '0')}`;
  const pngPath = resolve(OUT_DIR, `${name}.png`);
  // `preserveDrawingBuffer` is off, so reading the canvas back through a 2D context yields
  // nothing. Playwright's compositor capture is the only way to see what was actually drawn.
  await page.screenshot({ path: pngPath, type: 'png' });
  await writeHorizonCrop(pngPath, resolve(OUT_DIR, `${name}-horizon.png`));

  return { iso, file: `screenshots/${name}.png`, ...readout };
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  await waitForServer();

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-gpu', '--use-gl=angle', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({
    viewport: { width: options.width, height: options.height },
  });

  const problems: string[] = [];
  page.on('console', (message) => {
    const type = message.type();
    if (type !== 'error' && type !== 'warning') return;
    const text = message.text();
    // three prints a program's whole info log as a warning whenever it is non-empty, and ANGLE's
    // D3D backend puts advisory notes in there — including one from three's OWN PMREM prefilter
    // shader that no edit to this repository can remove. Anything containing `ERROR:` is a real
    // compile or link failure and is still reported. See `isDriverNote` in verify.ts.
    if (text.includes('THREE.WebGLProgram: Program Info Log:') && !text.includes('ERROR:')) return;
    problems.push(`[${type}] ${text}`);
  });
  page.on('pageerror', (error) => problems.push(`[pageerror] ${error.message}`));

  await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
  // Deliberately not `waitForFunction(ready)`: if boot fails the debug API never appears, and a
  // wait would throw away the very console output that says why. Wait a fixed interval and report
  // whatever state the page reached.
  await page.waitForTimeout(12000);

  const bootState = await page.evaluate(() => ({
    apiPresent: window.endlessFishing !== undefined,
    ready: window.endlessFishing?.ready() ?? false,
    fatal: document.querySelector('.fatal:not(noscript .fatal)')?.textContent ?? null,
  }));
  process.stdout.write(`boot: ${JSON.stringify(bootState)}\n`);

  await page.evaluate(
    (setup) => {
      const api = window.endlessFishing;
      if (api === undefined) return;
      api.setLocation(setup.latitudeDeg, setup.longitudeDeg);
      if (setup.preset !== null) api.setPreset(setup.preset as never);
      if (setup.graphics !== null) api.setGraphics(setup.graphics as never);
      if (setup.weather !== null) api.setWeather(setup.weather as never);
      if (setup.windSpeed !== null) api.setWind(setup.windSpeed, setup.windDirectionDeg);
      if (!setup.showUi) {
        const root = document.getElementById('ui-root');
        if (root !== null) root.style.display = 'none';
      }
    },
    {
      latitudeDeg: options.latitudeDeg,
      longitudeDeg: options.longitudeDeg,
      preset: options.preset,
      graphics: options.graphics,
      weather: options.weather,
      windSpeed: options.windSpeed,
      windDirectionDeg: options.windDirectionDeg,
      showUi: options.showUi,
    },
  );

  const frames: unknown[] = [];
  for (const [index, iso] of options.times.entries()) {
    frames.push(await capture(page, iso, index));
  }

  await browser.close();
  killServer();

  const report = { boot: bootState, options, frames, problems: problems.slice(0, 12) };
  const reportPath = resolve(OUT_DIR, `${options.tag}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(0);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  killServer();
  process.exit(1);
});

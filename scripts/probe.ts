import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

/**
 * Fast single-frame diagnostic.
 *
 * `verify.ts` takes three minutes because it captures nineteen frames and settles between each
 * one. This loads the dev server once, reports the photometry and the mean pixel value of the
 * frame at a chosen time, and exits — a few seconds per iteration when chasing a lighting bug.
 *
 * Usage: `npx tsx scripts/probe.ts [iso-timestamp]`
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'http://127.0.0.1:5173/';
const iso = process.argv[2] ?? '2026-06-21T09:45:00Z';

const server = spawn('npm', ['run', 'dev'], { cwd: ROOT, shell: true, stdio: 'ignore' });

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

async function main(): Promise<void> {
  await waitForServer();
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-gpu', '--use-gl=angle', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });

  const problems: string[] = [];
  page.on('console', (message) => {
    const type = message.type();
    if (type === 'error' || type === 'warning') problems.push(`[${type}] ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`[pageerror] ${error.message}`));

  await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
  // Deliberately not `waitForFunction(ready)`: if boot fails, the debug API never appears and
  // a wait would throw away the very console output that says why. Wait a fixed interval and
  // report whatever state the page reached.
  await page.waitForTimeout(14000);

  const bootState = await page.evaluate(() => ({
    apiPresent: window.endlessFishing !== undefined,
    ready: window.endlessFishing?.ready() ?? false,
    fatal: document.querySelector('.fatal:not(noscript .fatal)')?.textContent ?? null,
  }));
  process.stdout.write(`boot: ${JSON.stringify(bootState)}\n`);

  await page.evaluate((time) => {
    window.endlessFishing?.setLocation(32.08, 34.78);
    window.endlessFishing?.setTime(time);
  }, iso);
  await page.waitForTimeout(6000);

  const result = await page.evaluate(() => {
    const api = window.endlessFishing;
    if (api === undefined) return null;

    // Average the frame by drawing the WebGL canvas into a small 2D canvas.
    const source = document.getElementById('scene');
    let mean = [0, 0, 0];
    let saturatedFraction = 0;
    if (source instanceof HTMLCanvasElement) {
      const scratch = document.createElement('canvas');
      scratch.width = 96;
      scratch.height = 54;
      const context = scratch.getContext('2d');
      if (context !== null) {
        context.drawImage(source, 0, 0, scratch.width, scratch.height);
        const { data } = context.getImageData(0, 0, scratch.width, scratch.height);
        let r = 0;
        let g = 0;
        let b = 0;
        let saturated = 0;
        const pixels = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i] ?? 0;
          g += data[i + 1] ?? 0;
          b += data[i + 2] ?? 0;
          if ((data[i] ?? 0) > 250 && (data[i + 1] ?? 0) > 250 && (data[i + 2] ?? 0) > 250) {
            saturated += 1;
          }
        }
        mean = [r / pixels, g / pixels, b / pixels];
        saturatedFraction = saturated / pixels;
      }
    }
    return {
      photometry: api.photometry(),
      ephemeris: api.ephemeris(),
      stats: api.stats(),
      mean,
      saturatedFraction,
    };
  });

  // A frame to actually look at. `preserveDrawingBuffer` is off, so reading the canvas back
  // through a 2D context yields nothing — Playwright's compositor capture is the only way to
  // see what was drawn.
  await page.screenshot({ path: 'screenshots/probe.png', type: 'png' });

  await browser.close();
  if (server.pid !== undefined) {
    spawn('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' });
  }

  process.stdout.write(`${JSON.stringify({ iso, result, problems: problems.slice(0, 8) }, null, 2)}\n`);
  process.exit(0);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  if (server.pid !== undefined) {
    spawn('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' });
  }
  process.exit(1);
});

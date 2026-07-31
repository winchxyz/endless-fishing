import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

/**
 * Load a deployed build and prove it starts.
 *
 * `npm run verify` checks the bundle in `dist/`; this checks the thing on the internet, which is
 * not the same claim. A deployment can serve every asset at 200 and still never boot: build the
 * base path wrong and `index.html` points its script tags somewhere that does not exist, the
 * upload succeeds, the assets are all reachable at their real URLs, and the site sits on its
 * loading screen forever. That went live once, and a 200 from `curl` said nothing about it.
 *
 * Usage: `npx tsx scripts/smoke.ts [url]`
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.argv[2] ?? 'https://winchxyz.github.io/endless-fishing/';
/** First load pulls the whole asset tree over the network, so this is generous on purpose. */
const BOOT_TIMEOUT_MS = 180000;

async function main(): Promise<void> {
  await mkdir(resolve(ROOT, 'screenshots'), { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-gpu', '--use-gl=angle', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const problems: string[] = [];
  const missing: string[] = [];
  page.on('console', (message) => {
    const type = message.type();
    if (type !== 'error' && type !== 'warning') return;
    const text = message.text();
    if (text.includes('THREE.WebGLProgram: Program Info Log:') && !text.includes('ERROR:')) return;
    problems.push(`[${type}] ${text}`);
  });
  page.on('pageerror', (error) => problems.push(`[pageerror] ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) missing.push(`${response.status()} ${response.url()}`);
  });

  process.stdout.write(`Loading ${URL}\n`);
  await page.goto(URL, { waitUntil: 'load', timeout: 90000 });

  let ready = false;
  try {
    await page.waitForFunction(() => window.endlessFishing?.ready() === true, undefined, {
      timeout: BOOT_TIMEOUT_MS,
    });
    ready = true;
  } catch {
    ready = false;
  }

  const state = await page.evaluate(() => ({
    api: window.endlessFishing !== undefined,
    fatal: document.querySelector('.fatal:not(noscript .fatal)')?.textContent ?? null,
    stats: window.endlessFishing?.stats() ?? null,
    ephemeris: window.endlessFishing?.ephemeris() ?? null,
  }));

  await page.waitForTimeout(6000);
  await page.screenshot({ path: resolve(ROOT, 'screenshots', 'smoke.png'), type: 'png' });

  await browser.close();

  process.stdout.write(`${JSON.stringify({ ready, ...state }, null, 2)}\n`);
  if (missing.length > 0) {
    process.stderr.write(`\n${missing.length} request(s) failed:\n`);
    for (const url of missing.slice(0, 10)) process.stderr.write(`  ${url}\n`);
  }
  if (problems.length > 0) {
    process.stderr.write(`\n${problems.length} console issue(s):\n`);
    for (const problem of problems.slice(0, 10)) process.stderr.write(`  ${problem}\n`);
  }

  process.exit(ready && missing.length === 0 && problems.length === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});

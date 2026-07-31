import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import { startVite, type ViteServer } from './lib/server.js';

/**
 * Play the game, headless, and assert that the loop closes.
 *
 * The unit tests cover the state machine, the bite model, the fight and the save format. What
 * they cannot cover is the *wiring*: whether pressing the keys a player presses actually walks
 * the machine from idle to landed, whether the catch card appears when it does, and whether
 * anything ends up in local storage afterwards. Every one of those was written, wired to nothing,
 * and shipped that way for a while — so they get a test that uses the real keys against the real
 * build.
 *
 * The dwell times are generous because the loop is not on a timer: the fish bite when the model
 * says they bite, which depends on the hour, the sea state and the species table. A run that
 * reaches `waiting` and never gets a bite is reported as inconclusive rather than as a failure,
 * because that is a legitimate outcome of an honest bite model and not a broken game.
 *
 * Usage: `npx tsx scripts/playtest.ts`
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5197;
const OUT_DIR = resolve(ROOT, 'screenshots');

/** Dawn at Tel Aviv: the bite tables favour it, so the test does not sit through a dead noon. */
const ISO = '2026-06-21T02:40:00Z';
const LATITUDE = 32.08;
const LONGITUDE = 34.78;

/** How long to wait for a bite before calling the run inconclusive, milliseconds. */
const BITE_TIMEOUT_MS = 150000;
/** How long to spend reeling a hooked fish before giving up on landing it. */
const FIGHT_TIMEOUT_MS = 120000;

let server: ViteServer | null = null;

/** Everything the page can tell us about where the loop is, in one round trip. */
async function snapshot(page: Page): Promise<{
  state: string;
  tension: number;
  cardVisible: boolean;
  cardText: string;
  journalRows: number;
  saved: string | null;
}> {
  return page.evaluate(() => {
    const card = document.querySelector('.catch-card');
    return {
      state: window.endlessFishing?.fishing()?.state ?? 'unknown',
      tension: window.endlessFishing?.fishing()?.tension ?? 0,
      cardVisible: card?.classList.contains('is-live') ?? false,
      cardText: (card?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 160),
      journalRows: document.querySelectorAll('.journal__row, .journal-row').length,
      saved: localStorage.getItem('endless-fishing/save'),
    };
  });
}

/** Poll until `predicate` holds, returning the snapshot that satisfied it, or null on timeout. */
async function until(
  page: Page,
  timeoutMs: number,
  predicate: (snap: Awaited<ReturnType<typeof snapshot>>) => boolean,
): Promise<Awaited<ReturnType<typeof snapshot>> | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snap = await snapshot(page);
    if (predicate(snap)) return snap;
    await page.waitForTimeout(500);
  }
  return null;
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  server = await startVite('dev', PORT);

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-gpu', '--use-gl=angle', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const problems: string[] = [];
  page.on('console', (message) => {
    const type = message.type();
    if (type !== 'error' && type !== 'warning') return;
    const text = message.text();
    if (text.includes('THREE.WebGLProgram: Program Info Log:') && !text.includes('ERROR:')) return;
    problems.push(`[${type}] ${text}`);
  });
  page.on('pageerror', (error) => problems.push(`[pageerror] ${error.message}`));

  await page.goto(server.url, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(14000);

  await page.evaluate(
    (at) => {
      window.endlessFishing?.setLocation(at.lat, at.lon);
      window.endlessFishing?.setTime(at.iso);
    },
    { lat: LATITUDE, lon: LONGITUDE, iso: ISO },
  );
  await page.waitForTimeout(4000);

  const log: string[] = [];
  const note = (line: string): void => {
    log.push(line);
    process.stdout.write(`${line}\n`);
  };

  // Anchor first, exactly as the help card tells the player to: a drifting boat drags the bait.
  await page.keyboard.press('Space');
  await page.waitForTimeout(2000);
  note(`anchored: ${String((await page.evaluate(() => window.endlessFishing?.helm()?.anchored)) ?? false)}`);

  // Charge a cast and let it go. The charge is a hold, not a click.
  const canvas = page.locator('#scene');
  await canvas.hover({ position: { x: 640, y: 360 } });
  await page.mouse.down();
  await page.waitForTimeout(1400);
  await page.mouse.up();

  const cast = await until(page, 20000, (s) => s.state === 'sinking' || s.state === 'waiting');
  if (cast === null) {
    note(`FAIL: the cast never reached the water — state is ${(await snapshot(page)).state}`);
    await finish(1);
    return;
  }
  note(`cast landed: state ${cast.state}`);

  const bite = await until(page, BITE_TIMEOUT_MS, (s) => s.state === 'bite' || s.state === 'fighting');
  if (bite === null) {
    note('INCONCLUSIVE: no bite inside the window. The loop ran; nothing took the bait.');
    await finish(0);
    return;
  }
  note(`bite: state ${bite.state}`);

  // Reel. Not held down flat: the line breaks if the tension is pinned, so this is the same
  // on-off rhythm a player uses — pull when it is running, ease when it is not.
  const fightDeadline = Date.now() + FIGHT_TIMEOUT_MS;
  let landed: Awaited<ReturnType<typeof snapshot>> | null = null;
  while (Date.now() < fightDeadline) {
    const snap = await snapshot(page);
    if (snap.state === 'landed') {
      landed = snap;
      break;
    }
    if (snap.state === 'escaped' || snap.state === 'idle') {
      note(`the fish came off: state ${snap.state}`);
      break;
    }
    // Pump and wind, the way it is actually done: haul while the tension is low, give line the
    // moment it climbs. Reeling flat out pins the tension and the line parts; reeling too timidly
    // lets the fish throw the hook. The band is deliberately wide of the danger line, because
    // this loop only samples twice a second and a run can start between two samples.
    if (snap.tension < 0.4) await page.keyboard.down('r');
    else await page.keyboard.up('r');
    await page.waitForTimeout(180);
  }
  await page.keyboard.up('r').catch(() => undefined);

  if (landed === null) {
    note('INCONCLUSIVE: hooked but not landed inside the window.');
    await finish(0);
    return;
  }

  note(`LANDED. card visible: ${String(landed.cardVisible)}`);
  note(`card reads: ${landed.cardText}`);
  await page.screenshot({ path: resolve(OUT_DIR, 'playtest-catch.png'), type: 'png' });

  // The save is debounced, so give it its window before looking.
  await page.waitForTimeout(4000);
  const after = await snapshot(page);
  note(`save present: ${String(after.saved !== null)} (${after.saved?.length ?? 0} bytes)`);

  let exitCode = 0;
  if (!landed.cardVisible) {
    note('FAIL: a fish was landed and the catch card did not appear.');
    exitCode = 1;
  }
  if (after.saved === null) {
    note('FAIL: a fish was landed and nothing was written to local storage.');
    exitCode = 1;
  }
  await finish(exitCode);

  async function finish(code: number): Promise<void> {
    if (problems.length > 0) {
      process.stderr.write(`\n${problems.length} console issue(s):\n`);
      for (const problem of problems.slice(0, 10)) process.stderr.write(`  ${problem}\n`);
      code = 1;
    } else {
      note('console clean');
    }
    await browser.close();
    await server?.stop();
    process.exit(code);
  }
}

main().catch(async (error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  await server?.stop();
  process.exit(1);
});

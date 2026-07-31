import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import sharp from 'sharp';

/**
 * Regenerate the media the README shows.
 *
 * Everything under `docs/media/` is produced by this script and nothing else, so the pictures in
 * the README can never drift from what the code actually renders — re-run it after a change to
 * the sky, the sea or the post chain and the README is up to date by construction.
 *
 * The frames are captured at 1600x900 and written at 800 wide. That is not a compromise on
 * fidelity for its own sake: `screenshots/` is git-ignored precisely because captured frames are
 * build output, and the only reason these are committed is that a README on GitHub cannot fetch
 * anything that is not in the repository. Keeping them small is what makes committing them
 * defensible. See DECISIONS.md.
 *
 * Usage: `npx tsx scripts/media.ts`
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'docs', 'media');
const PORT = 5198;
const URL = `http://127.0.0.1:${PORT}/`;

const CAPTURE = { width: 1600, height: 900 };
const PUBLISH_WIDTH = 800;

/** Tel Aviv, which is where the almanac checks are anchored. */
const LATITUDE = 32.08;
const LONGITUDE = 34.78;

interface Still {
  readonly name: string;
  readonly iso: string;
  readonly note: string;
  /** Sky family override, or null to let the synoptic model decide. */
  readonly weather: string | null;
  /** Wind in m/s and its direction in degrees, or null to leave the field alone. */
  readonly wind: readonly [number, number] | null;
  /** Hold the throttle open while the frame settles. */
  readonly underWay: boolean;
}

const STILLS: readonly Still[] = [
  {
    name: '01-golden-hour',
    iso: '2026-06-21T16:30:00Z',
    note: 'sun +2.9 deg, under way',
    weather: null,
    wind: null,
    underWay: true,
  },
  { name: '02-dawn', iso: '2026-06-21T02:45:00Z', note: 'sun +1.0 deg', weather: null, wind: null, underWay: false },
  { name: '03-noon', iso: '2026-06-21T09:45:00Z', note: 'sun +81 deg', weather: null, wind: null, underWay: false },
  {
    name: '04-civil-twilight',
    iso: '2026-06-21T17:30:00Z',
    note: 'sun -8 deg',
    weather: null,
    wind: null,
    underWay: false,
  },
  {
    name: '05-night',
    iso: '2026-06-21T21:30:00Z',
    note: 'sun -34 deg, moon down',
    weather: null,
    wind: null,
    underWay: false,
  },
  {
    name: '06-overcast',
    iso: '2026-06-21T13:00:00Z',
    note: 'overcast, force 5',
    weather: 'overcast',
    wind: [11, 300],
    underWay: false,
  },
  {
    name: '07-storm',
    iso: '2026-06-21T13:00:00Z',
    note: 'storm, force 9',
    weather: 'storm',
    wind: [22, 240],
    underWay: false,
  },
];

/** Frames in the animation, and the delay between them in the file. */
const GIF_FRAMES = 24;
const GIF_DELAY_MS = 110;
const GIF_WIDTH = 480;

const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
  cwd: ROOT,
  shell: true,
  stdio: 'ignore',
});

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

async function stage(page: Page, still: Still): Promise<void> {
  await page.evaluate(
    (setup) => {
      const api = window.endlessFishing;
      if (api === undefined) return;
      api.setTime(setup.iso);
      if (setup.weather !== null) api.setWeather(setup.weather as never);
      if (setup.wind !== null) api.setWind(setup.wind[0], setup.wind[1]);
    },
    { iso: still.iso, weather: still.weather, wind: still.wind },
  );
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  await waitForServer();

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-gpu', '--use-gl=angle', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: CAPTURE });

  await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(14000);
  await page.evaluate(
    (at) => {
      window.endlessFishing?.setLocation(at.lat, at.lon);
      const root = document.getElementById('ui-root');
      if (root !== null) root.style.display = 'none';
    },
    { lat: LATITUDE, lon: LONGITUDE },
  );

  for (const still of STILLS) {
    await stage(page, still);
    if (still.underWay) {
      await page.keyboard.down('w');
      // Long enough for the boat to reach its terminal speed and lay the whole track buffer, so
      // the wake in the picture is the wake a player sees rather than one still growing.
      await page.waitForTimeout(40000);
    } else {
      await page.keyboard.up('w').catch(() => undefined);
      await page.waitForTimeout(7000);
    }

    const shot = await page.screenshot({ type: 'png' });
    await sharp(shot)
      .resize({ width: PUBLISH_WIDTH })
      .png({ compressionLevel: 9 })
      .toFile(resolve(OUT_DIR, `${still.name}.png`));
    process.stdout.write(`${still.name} (${still.note})\n`);
  }

  // ------------------------------------------------------------------------------- the storm
  await stage(page, {
    name: 'storm',
    iso: '2026-06-21T14:20:00Z',
    note: 'gif',
    weather: 'storm',
    wind: [24, 240],
    underWay: false,
  });
  await page.waitForTimeout(12000);

  const frames: Buffer[] = [];
  let frameWidth = 0;
  let frameHeight = 0;
  for (let index = 0; index < GIF_FRAMES; index += 1) {
    const shot = await page.screenshot({ type: 'png' });
    const { data, info } = await sharp(shot)
      .resize({ width: GIF_WIDTH })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    frameWidth = info.width;
    frameHeight = info.height;
    frames.push(data);
    await page.waitForTimeout(40);
  }

  // An animated GIF is one tall image of stacked frames with a declared page height, which is why
  // the frames are concatenated rather than handed over as a list.
  await sharp(Buffer.concat(frames), {
    raw: {
      width: frameWidth,
      height: frameHeight * frames.length,
      channels: 3,
      pageHeight: frameHeight,
    },
  })
    .gif({ loop: 0, delay: GIF_DELAY_MS })
    .toFile(resolve(OUT_DIR, 'storm.gif'));
  process.stdout.write(`storm.gif (${frames.length} frames)\n`);

  await browser.close();
  killServer();
  process.exit(0);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  killServer();
  process.exit(1);
});

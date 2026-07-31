import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import { startVite, type ViteServer } from './lib/server.js';
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

const CAPTURE = { width: 1600, height: 900 };
const PUBLISH_WIDTH = 800;

/** Tel Aviv, which is where the almanac checks are anchored. */
const LATITUDE = 32.08;
const LONGITUDE = 34.78;

interface Still {
  readonly name: string;
  readonly iso: string;
  readonly note: string;
  /**
   * Synoptic state to pin, or null to let the pressure field decide.
   *
   * Pinned rather than set through `setWind`, because the weather system rewrites the wind from
   * its own field every frame — poking the wind directly is overwritten before the next frame is
   * drawn, which is how the first storm capture came out as a flat blue calm.
   */
  readonly weather: string | null;
  /** Hold the throttle open while the frame settles. */
  readonly underWay: boolean;
  /** Seconds to let the sea build. A sea takes hours to raise, and the model has that lag in it. */
  readonly settleSeconds: number;
}

/**
 * Order matters, and it is not the order they appear in the README.
 *
 * The boat drifts between captures and drives during the one that is under way, so by the end of
 * a run it is a long way from where it started and quite possibly under a headland. The night
 * frame is the one that suffers from that, so it is taken first, while the boat is still in open
 * water, and the frame that needs the boat to travel is taken last.
 *
 * Every still pins a state, including the ones that are about the hour rather than the weather.
 * That is not the model being distrusted: it is that a matrix whose top four cells are labelled by
 * solar altitude has to *vary* by solar altitude, and leaving the weather to the field means the
 * dawn frame is whatever the field happened to build over the last two and a half hours. It built
 * a rain squall, and a rain squall at 1.4 km of visibility renders every one of those four cells
 * in the same single colour — correctly, which is the point. The weather cells carry the weather.
 */
const STILLS: readonly Still[] = [
  {
    name: '05-night',
    iso: '2026-06-21T21:30:00Z',
    note: 'sun -34 deg, moon down',
    weather: 'partly-cloudy',
    underWay: false,
    settleSeconds: 8,
  },
  { name: '02-dawn', iso: '2026-06-21T02:45:00Z', note: 'sun +1.0 deg', weather: 'light-breeze', underWay: false, settleSeconds: 8 },
  { name: '03-noon', iso: '2026-06-21T09:45:00Z', note: 'sun +81 deg', weather: 'light-breeze', underWay: false, settleSeconds: 8 },
  {
    name: '04-civil-twilight',
    iso: '2026-06-21T17:30:00Z',
    note: 'sun -8 deg',
    weather: 'light-breeze',
    underWay: false,
    settleSeconds: 7,
  },
  {
    name: '06-overcast',
    iso: '2026-06-21T13:00:00Z',
    note: 'overcast, force 5',
    weather: 'overcast',
    underWay: false,
    settleSeconds: 12,
  },
  {
    name: '07-storm',
    iso: '2026-06-21T13:00:00Z',
    note: 'storm, force 9',
    weather: 'storm',
    underWay: false,
    settleSeconds: 12,
  },
  {
    name: '01-golden-hour',
    iso: '2026-06-21T16:30:00Z',
    note: 'sun +2.9 deg, under way',
    weather: 'partly-cloudy',
    underWay: true,
    settleSeconds: 40,
  },
];

/** Frames in the animation, and the delay between them in the file. */
const GIF_FRAMES = 24;
const GIF_DELAY_MS = 110;
const GIF_WIDTH = 480;

let server: ViteServer | null = null;

/**
 * How much faster than real time the weather is run forward before a capture.
 *
 * Pinning a state does not make it true, it makes it the target: cloud cover damps with a time
 * constant of about 170 s and the sea takes longer still, which is exactly right for a weather
 * model and hopeless for a screenshot. Thirty real seconds at 300x is two and a half hours of
 * world time, which is enough for a gale to arrive properly — the wind builds, the sea builds
 * after it, the cloud thickens — rather than being asserted. The clock is then put back where
 * the still wants it, and the sky re-meters from scratch because a time override is a cut.
 */
const WEATHER_TIME_SCALE = 300;
const WEATHER_FORWARD_MS = 30000;

async function stage(page: Page, still: Still): Promise<void> {
  // Every still runs the field forward, including the ones with nothing pinned — and especially
  // those. Dropping the override does not undo the weather; it hands the field back to the model
  // with a Beaufort 9 in it, and the model damps out of that on its own time constants. Skipping
  // the forwarding for `weather: null` therefore photographed whatever the *previous* still had
  // built: the golden-hour hero shot is captured last, after the storm, and it came back with
  // 1.4 km of visibility over it — a sunset rendered in one colour, because the aerial
  // perspective was doing exactly what the weather told it to. Two and a half hours of world time
  // with no override is a sea that has moderated and air you can see through.
  await page.evaluate(
    (setup) => {
      window.endlessFishing?.setWeatherState(setup.weather);
      window.endlessFishing?.setTimeScale(setup.scale);
    },
    { weather: still.weather, scale: WEATHER_TIME_SCALE },
  );
  await page.waitForTimeout(WEATHER_FORWARD_MS);

  await page.evaluate(
    (setup) => {
      const api = window.endlessFishing;
      if (api === undefined) return;
      api.setTimeScale(1);
      if (setup.weather === null) api.setWeatherState(null);
      api.setTime(setup.iso);
    },
    { iso: still.iso, weather: still.weather },
  );
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  server = await startVite('dev', PORT);

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-gpu', '--use-gl=angle', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: CAPTURE });

  await page.goto(server.url, { waitUntil: 'load', timeout: 90000 });
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
    // Under way, the settle is also how long the boat has to reach its terminal speed and lay the
    // whole track buffer, so the wake in the picture is the wake a player sees rather than one
    // still growing. Standing still, it is how long the sea has to build: a sea takes hours to
    // raise and the model carries that lag, so a gale pinned a second ago is still a calm.
    if (still.underWay) await page.keyboard.down('w');
    else await page.keyboard.up('w').catch(() => undefined);
    await page.waitForTimeout(still.settleSeconds * 1000);

    const shot = await page.screenshot({ type: 'png' });
    // JPEG, not PNG. These are photographic frames of an ocean: PNG spends half a megabyte each
    // on noise that a quality-92 JPEG carries in a tenth of that, and the whole reason they are
    // committed at all is that a README cannot fetch anything outside the repository.
    await sharp(shot)
      .resize({ width: PUBLISH_WIDTH })
      .jpeg({ quality: 92, chromaSubsampling: '4:4:4', mozjpeg: true })
      .toFile(resolve(OUT_DIR, `${still.name}.jpg`));
    process.stdout.write(`${still.name} (${still.note})\n`);
  }

  // ------------------------------------------------------------------------------- the storm
  //
  // Straight on from the storm still above, so the sea is already up; only the clock moves.
  await stage(page, {
    name: 'storm',
    iso: '2026-06-21T14:20:00Z',
    note: 'gif',
    weather: 'storm',
    underWay: false,
    settleSeconds: 12,
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
  await server?.stop();
  process.exit(0);
}

main().catch(async (error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  await server?.stop();
  process.exit(1);
});

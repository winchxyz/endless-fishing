import { resolve } from 'node:path';
import sharp from 'sharp';

/**
 * Read a captured frame as numbers instead of as a picture.
 *
 * Two commands, and between them they are how every lighting bug in this project was actually
 * found. Looking at a screenshot tells you something is wrong; neither of these lets you
 * *believe* something is right without a number saying so.
 *
 *   rows   Mean R, G and B of each row over a column range, plus R−B.
 *          A one-pixel artefact on a 1080-line frame is invisible in a thumbnail and unmistakable
 *          in a table of twenty rows. The horizon band was identified this way after two sessions
 *          of looking at pictures had failed: the profile dipped *below* the sea plateau in green
 *          and blue while red held, which no post-processing effect in the chain can produce, and
 *          that ruled out the whole lens.
 *
 *   peak   The brightest single pixel in a region, and where it is.
 *
 *   crop   Extract a region and magnify it with a nearest-neighbour filter, so a zoom shows the
 *          pixels rather than an interpolation of them.
 *
 * Usage:
 *   npx tsx scripts/inspect.ts rows screenshots/look-00.png 300 330 1200 1900
 *   npx tsx scripts/inspect.ts crop screenshots/look-00.png 450 620 1000 460 2 out.png
 */

const [command, ...rest] = process.argv.slice(2);

async function rows(file: string, y0: number, y1: number, x0: number, x1: number): Promise<void> {
  const { data, info } = await sharp(resolve(file)).raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const left = Math.max(0, Math.min(info.width - 1, x0));
  const right = Math.max(left + 1, Math.min(info.width, x1));

  process.stdout.write('   y       R      G      B     R-B\n');
  for (let y = Math.max(0, y0); y <= Math.min(info.height - 1, y1); y += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    for (let x = left; x < right; x += 1) {
      const i = (y * info.width + x) * channels;
      r += data[i] ?? 0;
      g += data[i + 1] ?? 0;
      b += data[i + 2] ?? 0;
    }
    const n = right - left;
    process.stdout.write(
      `${String(y).padStart(4)}  ${(r / n).toFixed(1).padStart(6)} ${(g / n).toFixed(1).padStart(6)} ` +
        `${(b / n).toFixed(1).padStart(6)}  ${((r - b) / n).toFixed(1).padStart(6)}\n`,
    );
  }
}

async function crop(
  file: string,
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
  out: string,
): Promise<void> {
  await sharp(resolve(file))
    .extract({ left: x, top: y, width, height })
    // Nearest neighbour, deliberately: a magnified frame has to show the pixels that were drawn,
    // not a smooth interpolation of them. A one-pixel fringe disappears under a Lanczos resize.
    .resize({ width: Math.round(width * scale), kernel: 'nearest' })
    .png()
    .toFile(resolve(out));
  process.stdout.write(`${out}\n`);
}

/**
 * The brightest single pixel in a region, and where it is.
 *
 * `rows` averages, and an average is the wrong instrument for a two-pixel artefact: twenty blobs
 * three pixels wide, diluted across six hundred columns, read as nothing at all. Several rounds
 * of A/B on the night horizon were wasted on exactly that mistake — a feature that was plainly in
 * the picture measured as absent, and a row that measured bright turned out to be a different
 * feature entirely.
 */
async function peak(file: string, y0: number, y1: number, x0: number, x1: number): Promise<void> {
  const { data, info } = await sharp(resolve(file)).raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  let best = -1;
  let at = { x: 0, y: 0, r: 0, g: 0, b: 0 };
  for (let y = Math.max(0, y0); y <= Math.min(info.height - 1, y1); y += 1) {
    for (let x = Math.max(0, x0); x < Math.min(info.width, x1); x += 1) {
      const i = (y * info.width + x) * channels;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (luminance > best) {
        best = luminance;
        at = { x, y, r, g, b };
      }
    }
  }
  process.stdout.write(
    `peak luminance ${best.toFixed(1)} at (${at.x}, ${at.y}) = ${at.r}, ${at.g}, ${at.b}\n`,
  );
}

function number(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number, got ${String(value)}`);
  return parsed;
}

async function main(): Promise<void> {
  const [file] = rest;
  if (file === undefined) throw new Error('Usage: inspect.ts <rows|crop> <png> ...');

  if (command === 'rows') {
    await rows(
      file,
      number(rest[1], 'y0'),
      number(rest[2], 'y1'),
      number(rest[3], 'x0'),
      number(rest[4], 'x1'),
    );
    return;
  }
  if (command === 'peak') {
    await peak(
      file,
      number(rest[1], 'y0'),
      number(rest[2], 'y1'),
      number(rest[3], 'x0'),
      number(rest[4], 'x1'),
    );
    return;
  }
  if (command === 'crop') {
    const out = rest[6];
    if (out === undefined) throw new Error('crop needs an output path');
    await crop(
      file,
      number(rest[1], 'x'),
      number(rest[2], 'y'),
      number(rest[3], 'width'),
      number(rest[4], 'height'),
      number(rest[5], 'scale'),
      out,
    );
    return;
  }
  throw new Error(`Unknown command ${String(command)}. Expected \`rows\`, \`peak\` or \`crop\`.`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

/**
 * Yale Bright Star Catalogue reader and colour model.
 *
 * `scripts/process-textures.ts` repacks the ADC ASCII catalogue into a compact binary; this
 * reads it back. Roughly 9000 stars to magnitude 6.5 — everything a person with good eyes can
 * see from a dark sea, which is the point.
 *
 * Binary layout, little-endian:
 *   header  uint32 magic 0x42534335 ("BSC5"), uint32 version, uint32 count, uint32 reserved
 *   record  float32 right ascension (rad), float32 declination (rad),
 *           int16 V magnitude x100, int16 B−V colour index x100
 *
 * Records are sorted brightest first, so a quality preset can simply truncate the array.
 */

const MAGIC = 0x42534335;
const RECORD_BYTES = 12;
const HEADER_BYTES = 16;

export interface StarCatalog {
  count: number;
  /** Unit vectors in the equatorial frame: +X to RA 0 on the equator, +Z to the north pole. */
  positions: Float32Array;
  /** Apparent V magnitude, one per star. */
  magnitudes: Float32Array;
  /** Linear sRGB colour derived from the B−V index, three floats per star. */
  colours: Float32Array;
  brightestMagnitude: number;
  faintestMagnitude: number;
}

export function parseStarCatalog(buffer: ArrayBuffer): StarCatalog {
  const view = new DataView(buffer);
  if (buffer.byteLength < HEADER_BYTES) {
    throw new Error('Star catalogue is truncated: no header');
  }
  const magic = view.getUint32(0, true);
  if (magic !== MAGIC) {
    throw new Error(
      `Star catalogue has the wrong magic (0x${magic.toString(16)}) — re-run \`npm run textures\``,
    );
  }
  const count = view.getUint32(8, true);
  const expected = HEADER_BYTES + count * RECORD_BYTES;
  if (buffer.byteLength < expected) {
    throw new Error(
      `Star catalogue is truncated: expected ${expected} bytes for ${count} stars, got ${buffer.byteLength}`,
    );
  }

  const positions = new Float32Array(count * 3);
  const magnitudes = new Float32Array(count);
  const colours = new Float32Array(count * 3);

  let brightestMagnitude = Number.POSITIVE_INFINITY;
  let faintestMagnitude = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < count; i += 1) {
    const offset = HEADER_BYTES + i * RECORD_BYTES;
    const rightAscension = view.getFloat32(offset, true);
    const declination = view.getFloat32(offset + 4, true);
    const magnitude = view.getInt16(offset + 8, true) / 100;
    const colourIndex = view.getInt16(offset + 10, true) / 100;

    const cosDec = Math.cos(declination);
    positions[i * 3] = cosDec * Math.cos(rightAscension);
    positions[i * 3 + 1] = cosDec * Math.sin(rightAscension);
    positions[i * 3 + 2] = Math.sin(declination);

    magnitudes[i] = magnitude;
    brightestMagnitude = Math.min(brightestMagnitude, magnitude);
    faintestMagnitude = Math.max(faintestMagnitude, magnitude);

    const rgb = colourFromBV(colourIndex);
    colours[i * 3] = rgb[0];
    colours[i * 3 + 1] = rgb[1];
    colours[i * 3 + 2] = rgb[2];
  }

  return { count, positions, magnitudes, colours, brightestMagnitude, faintestMagnitude };
}

/**
 * B−V colour index → effective temperature, Ballesteros (2012).
 *
 * Derived from treating a star as two black bodies at the B and V band centres, so it is a
 * physical relation rather than a fit to a colour picker. Valid across the whole main sequence:
 * B−V = −0.33 gives about 21 000 K (Rigel, blue), 0.65 gives 5800 K (the Sun), 1.85 gives
 * about 3200 K (Betelgeuse, orange-red).
 */
export function temperatureFromBV(colourIndex: number): number {
  const bv = Math.min(2.5, Math.max(-0.4, colourIndex));
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

/**
 * Planckian locus → linear sRGB, normalised to unit luminance.
 *
 * Normalising to luminance rather than to peak channel matters: brightness comes from the
 * magnitude, and colour must not smuggle in an extra factor of two between a blue star and a
 * red one. The chromaticity fit is the standard CIE approximation for 1667–25000 K.
 */
export function colourFromBV(colourIndex: number): [number, number, number] {
  const kelvin = Math.min(25000, Math.max(1667, temperatureFromBV(colourIndex)));
  const t = kelvin;
  const invT = 1000 / t;

  let x: number;
  if (t < 4000) {
    x = -0.2661239 * invT ** 3 - 0.234358 * invT ** 2 + 0.8776956 * invT + 0.179910;
  } else {
    x = -3.0258469 * invT ** 3 + 2.1070379 * invT ** 2 + 0.2226347 * invT + 0.240390;
  }

  let y: number;
  if (t < 2222) {
    y = -1.1063814 * x ** 3 - 1.3481102 * x ** 2 + 2.18555832 * x - 0.20219683;
  } else if (t < 4000) {
    y = -0.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - 0.16748867;
  } else {
    y = 3.081758 * x ** 3 - 5.8733867 * x ** 2 + 3.75112997 * x - 0.37001483;
  }

  // xyY (Y = 1) → XYZ → linear sRGB.
  const X = x / Math.max(1e-6, y);
  const Z = (1 - x - y) / Math.max(1e-6, y);

  let r = 3.2404542 * X - 1.5371385 - 0.4985314 * Z;
  let g = -0.969266 * X + 1.8760108 + 0.041556 * Z;
  let b = 0.0556434 * X - 0.2040259 + 1.0572252 * Z;

  // Clip out-of-gamut chromaticities by desaturating towards white rather than clamping,
  // which would shift the hue of the bluest stars towards cyan.
  const lowest = Math.min(r, g, b);
  if (lowest < 0) {
    r -= lowest;
    g -= lowest;
    b -= lowest;
  }

  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (luminance <= 0) return [1, 1, 1];
  return [r / luminance, g / luminance, b / luminance];
}

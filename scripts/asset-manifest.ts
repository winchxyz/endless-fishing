/**
 * The asset manifest.
 *
 * Everything downloadable in the project is declared here, with its source and licence.
 * Nothing is fetched that is not on this list, and `fetch-assets.ts` writes
 * `assets/CREDITS.md` straight out of it, so the credits can never drift from reality.
 *
 * Licence rule: CC0 or public domain only. See DECISIONS.md.
 */

export type Licence = 'CC0-1.0' | 'PD-NASA' | 'PD-ADC';

/* ------------------------------------------------------------------ sky library */

/** Broad weather bucket a sky belongs to. Matches the runtime WeatherState families. */
export type SkyWeather = 'clear' | 'partly-cloudy' | 'overcast' | 'fog' | 'storm' | 'night';

export interface HdriEntry {
  /** Poly Haven slug. Also the on-disk filename stem. */
  slug: string;
  weather: SkyWeather;
  /**
   * Resolution tier fetched by the default ("web") profile. Hero skies — the ones the
   * player spends most time under — get 2k; the rest get 1k, which is still well above what
   * a 256px PMREM probe can resolve.
   */
  tier: 'hero' | 'secondary';
  /** Free-text note carried into CREDITS.md and the debug panel. */
  note: string;
}

/**
 * Sixteen skies spanning weather x sun altitude.
 *
 * Every one is a Poly Haven "pure sky": sky-only, no baked landmass in the lower hemisphere,
 * which is exactly what an open-ocean horizon needs. The baked sun altitude and azimuth are
 * NOT hand-entered — `fetch-assets.ts` pulls each sky's shooting coordinates and timestamp
 * from the Poly Haven API and the runtime computes the true solar position from them with
 * the same NOAA solver that drives the live sun. That is what makes the HDRI highlight and
 * the rendered sun disc line up exactly.
 */
export const HDRIS: readonly HdriEntry[] = [
  // Clear, sorted by sun altitude.
  { slug: 'qwantani_dawn_puresky', weather: 'clear', tier: 'hero', note: 'clear dawn, sun below horizon' },
  { slug: 'qwantani_sunrise_puresky', weather: 'clear', tier: 'secondary', note: 'clear sunrise' },
  { slug: 'qwantani_morning_puresky', weather: 'clear', tier: 'secondary', note: 'clear morning' },
  { slug: 'kloofendal_43d_clear_puresky', weather: 'clear', tier: 'hero', note: 'clear, sun 43 deg' },
  { slug: 'qwantani_noon_puresky', weather: 'clear', tier: 'hero', note: 'clear noon, high sun' },
  { slug: 'qwantani_late_afternoon_puresky', weather: 'clear', tier: 'secondary', note: 'clear late afternoon' },
  { slug: 'syferfontein_6d_clear_puresky', weather: 'clear', tier: 'secondary', note: 'clear, sun 6 deg — golden hour' },
  { slug: 'syferfontein_0d_clear_puresky', weather: 'clear', tier: 'hero', note: 'clear, sun on the horizon' },

  // Partly cloudy.
  { slug: 'citrus_orchard_puresky', weather: 'partly-cloudy', tier: 'secondary', note: 'cumulus at sunrise' },
  { slug: 'aristea_wreck_puresky', weather: 'partly-cloudy', tier: 'secondary', note: 'coastal cumulus, midday — shot on the Atlantic shoreline' },
  { slug: 'kloofendal_48d_partly_cloudy_puresky', weather: 'partly-cloudy', tier: 'hero', note: 'fair-weather cumulus, high sun' },
  { slug: 'table_mountain_2_puresky', weather: 'partly-cloudy', tier: 'hero', note: 'broken cloud at sunset' },
  { slug: 'qwantani_dusk_2_puresky', weather: 'partly-cloudy', tier: 'secondary', note: 'cloud at civil dusk' },

  // Overcast and storm. `snow_field` was shot at 50.9 N, which is exactly the flat northern
  // stratus light the whole art direction is aimed at.
  { slug: 'snow_field_puresky', weather: 'overcast', tier: 'hero', note: 'flat stratus deck at 51 N — the reference overcast' },
  { slug: 'kloppenheim_01_puresky', weather: 'overcast', tier: 'secondary', note: 'overcast at sunset' },
  { slug: 'kloofendal_overcast_puresky', weather: 'storm', tier: 'hero', note: 'dark flat deck — storm ambient base; cumulonimbus structure is volumetric, see DECISIONS.md' },

  // Fog and night.
  { slug: 'kloofendal_misty_morning_puresky', weather: 'fog', tier: 'hero', note: 'sea-mist analogue, low visibility' },
  { slug: 'qwantani_night_puresky', weather: 'night', tier: 'hero', note: 'moonless night, low-frequency ambient only' },
  { slug: 'qwantani_moonrise_puresky', weather: 'night', tier: 'secondary', note: 'moonrise, night ambient' },
];

/* -------------------------------------------------------------------- textures */

export interface TextureEntry {
  /** ambientCG asset id. */
  id: string;
  /** Where it is used, for CREDITS.md and for the material factory. */
  role: string;
  resolution: '1K' | '2K';
}

/**
 * Ten PBR materials from ambientCG (all CC0).
 *
 * Foam, the two scales of ocean detail normal, fish scales and the wet-sand band are NOT
 * here: they are generated procedurally by `process-textures.ts`. See DECISIONS.md — for
 * those five, procedural is not a licence workaround, it is the better answer, because each
 * one has to tile exactly and be parameterised (per species, per sea state) in a way no
 * photograph can be.
 */
export const TEXTURES: readonly TextureEntry[] = [
  { id: 'WoodFloor043', role: 'deck planking, varnished', resolution: '1K' },
  { id: 'Wood066', role: 'hull planking, painted and weathered', resolution: '1K' },
  { id: 'Planks023A', role: 'cabin and jetty timber', resolution: '1K' },
  { id: 'Metal063', role: 'rusted metal — fittings, chain, wreck plate', resolution: '1K' },
  { id: 'Metal032', role: 'brushed metal — cleats, rails, engine cowl', resolution: '1K' },
  { id: 'PaintedMetal006', role: 'buoy and hull paint', resolution: '1K' },
  { id: 'Rope001', role: 'mooring rope and rigging', resolution: '1K' },
  { id: 'Fabric030', role: 'canvas — flag, awning, tarpaulin', resolution: '1K' },
  { id: 'Ground054', role: 'beach sand, dry and wet', resolution: '1K' },
  { id: 'Rock064', role: 'cliff and shoreline rock', resolution: '1K' },
  { id: 'Bark014', role: 'tree bark', resolution: '1K' },
];

/** Which maps we keep out of each ambientCG archive. Everything else is discarded. */
export const WANTED_MAPS = [
  'Color',
  'NormalGL',
  'Roughness',
  'AmbientOcclusion',
  'Displacement',
  'Metalness',
] as const;

/* ------------------------------------------------------------------- astronomy */

export interface DirectEntry {
  url: string;
  /** Path under assets/, including filename. */
  dest: string;
  licence: Licence;
  source: string;
  credit: string;
  note: string;
}

export const DIRECT_FILES: readonly DirectEntry[] = [
  {
    url: 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_2k.tif',
    dest: 'moon/lroc_color_poles_2k.tif',
    licence: 'PD-NASA',
    source: 'https://svs.gsfc.nasa.gov/4720',
    credit: 'NASA Goddard Space Flight Center Scientific Visualization Studio / LRO LROC',
    note: 'Lunar colour albedo, equirectangular. Real maria and highlands, shaded at runtime by the true sub-solar direction.',
  },
  {
    url: 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_4_uint.tif',
    dest: 'moon/ldem_4_uint.tif',
    licence: 'PD-NASA',
    source: 'https://svs.gsfc.nasa.gov/4720',
    credit: 'NASA GSFC SVS / LRO LOLA',
    note: 'Lunar elevation model. Converted to a tangent-space normal map so crater relief catches the terminator.',
  },
  {
    url: 'http://tdc-www.harvard.edu/catalogs/bsc5.dat.gz',
    dest: 'stars/bsc5.dat.gz',
    licence: 'PD-ADC',
    source: 'http://tdc-www.harvard.edu/catalogs/bsc5.html',
    credit: 'Yale Bright Star Catalogue, 5th Revised Edition (Hoffleit & Warren 1991), via the Astronomical Data Center',
    note: 'Every star to magnitude ~7.1 with RA, Dec, V magnitude and B-V colour index. Repacked to a compact binary at build time.',
  },
];

/* --------------------------------------------------------------------- credits */

export const LICENCE_TEXT: Record<Licence, string> = {
  'CC0-1.0': 'CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/',
  'PD-NASA': 'Public domain — NASA media usage guidelines — https://www.nasa.gov/nasa-brand-center/images-and-media/',
  'PD-ADC': 'Public domain — Astronomical Data Center catalogue, freely redistributable',
};

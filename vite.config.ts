import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import glsl from 'vite-plugin-glsl';

// `base` is overridable so the same build can be served from a GitHub Pages subpath
// (`/endless-fishing/`) or from a domain root. CI sets VITE_BASE.
const base = process.env['VITE_BASE'] ?? '/';

/**
 * `assets/` is the public directory, so the sky panoramas, the processed textures and the star
 * catalogue are served at the paths the runtime asks for with no copy step. But it also holds
 * the *sources* those were built from — 75 MB of ambientCG JPEGs and NASA TIFFs that nothing
 * loads at runtime — and Vite has no way to exclude part of a public directory.
 *
 * So they are pruned after the bundle is written. Deleting from `dist` rather than
 * rearranging the asset tree keeps `fetch-assets.ts` and `process-textures.ts` writing to the
 * obvious places, and the list below is short enough to read at a glance.
 */
function prunePublishedSources(): Plugin {
  const SOURCE_ONLY = ['textures', 'moon/lroc_color_poles_2k.tif', 'moon/ldem_4_uint.tif', 'stars/bsc5.dat'];
  let outDir = 'dist';
  return {
    name: 'endless-fishing:prune-published-sources',
    apply: 'build',
    configResolved(config): void {
      outDir = config.build.outDir;
    },
    async closeBundle(): Promise<void> {
      await Promise.all(
        SOURCE_ONLY.map((path) => rm(resolve(outDir, path), { recursive: true, force: true })),
      );
    },
  };
}

export default defineConfig({
  base,
  publicDir: resolve(import.meta.dirname, 'assets'),
  plugins: [
    prunePublishedSources(),
    glsl({
      include: ['**/*.glsl', '**/*.vert', '**/*.frag'],
      // Duplicate #includes are a real bug in a shader tree this size — the ocean and the
      // underwater pass share half a dozen chunks — so warn rather than silently dedupe.
      warnDuplicatedImports: true,
      removeDuplicatedImports: true,
      defaultExtension: 'glsl',
      minify: false,
      watch: true,
      // `#include /lib/gerstner.glsl` resolves from here, so chunks are addressed the same
      // way from every shader regardless of how deep it sits.
      root: '/src/shaders/',
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
    // three + postprocessing legitimately exceed the 500 kB default; we split them into
    // their own chunk and raise the limit rather than leaving a warning in the build log.
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks(id: string): string | undefined {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/postprocessing')) return 'post';
          return undefined;
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
});

import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

// `base` is overridable so the same build can be served from a GitHub Pages subpath
// (`/endless-fishing/`) or from a domain root. CI sets VITE_BASE.
const base = process.env['VITE_BASE'] ?? '/';

export default defineConfig({
  base,
  plugins: [
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

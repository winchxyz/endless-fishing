import { defineConfig } from 'vitest/config';

// Only pure math is unit-tested (astro/, math/, gameplay tables). Nothing here touches
// WebGL, so the node environment is correct and fast.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    reporters: ['default'],
  },
});

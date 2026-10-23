import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

export default defineConfig({
  // The app intentionally preserves JSX; transform TSX only for these SSR tests.
  plugins: [{
    name: 'office-reviewer-test-tsx',
    enforce: 'pre',
    async transform(source, id) {
      if (!id.endsWith('.tsx')) return;
      return transform(source, { loader: 'tsx', jsx: 'automatic', format: 'esm' });
    },
  }],
  resolve: { alias: {
    '@': fileURLToPath(new URL('../client/src', import.meta.url)),
    '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
  } },
  test: {
    include: ['tests/officeReviewer*.test.ts', 'server/**/__tests__/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});

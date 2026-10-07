import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = fileURLToPath(new URL('.', import.meta.url));
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// One self-contained bundle per version (React, Markdown and styles inside). Output: dist/<version>/.
export default defineConfig({
  root: here,
  plugins: [react()],
  // The widget's CSS is plain CSS; never pick up the repository's Tailwind/PostCSS config.
  css: { postcss: { plugins: [] } },
  define: {
    __WIDGET_VERSION__: JSON.stringify(version),
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: `dist/${version}`,
    emptyOutDir: true,
    target: 'es2019',
    sourcemap: true,
    minify: 'esbuild',
    lib: {
      entry: 'src/widgetEntry.ts',
      name: 'SailAssistant',
      formats: ['iife', 'es'],
      fileName: (format) => (format === 'iife' ? `sail-assistant-widget.${version}.js` : `sail-assistant-widget.${version}.mjs`),
    },
    rollupOptions: { output: { extend: false } },
  },
});

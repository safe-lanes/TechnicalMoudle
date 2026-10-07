import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Mirrors Crewing: base /crewing/ in production builds.
export default defineConfig({
  base: '/crewing/',
  plugins: [react()],
});

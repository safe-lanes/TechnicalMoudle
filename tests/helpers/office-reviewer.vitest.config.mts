import path from 'node:path';

// Standalone scoped test configuration; leaves the application's configuration unchanged.
export default {
  test: { include: ['server/**/__tests__/**/*.test.ts'], globals: true },
  resolve: { alias: {
    '@': path.resolve(process.cwd(), 'client/src'),
    '@shared': path.resolve(process.cwd(), 'shared'),
  } },
};

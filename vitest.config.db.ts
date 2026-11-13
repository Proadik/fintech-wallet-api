import { defineConfig } from 'vitest/config';

// Tests that need a real PostgreSQL: `npm run test:db`
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    globalSetup: './test/global-setup.ts',
    include: ['**/*.db-spec.ts'],
  },
});

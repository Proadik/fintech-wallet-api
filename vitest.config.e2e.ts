import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    globalSetup: './test/global-setup.ts',
    include: ['**/*.e2e-spec.ts'],
  },
});

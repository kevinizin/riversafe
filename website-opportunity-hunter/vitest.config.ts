import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      '@woh/core': resolve(__dirname, 'packages/core/src'),
      '@woh/config': resolve(__dirname, 'packages/config/src'),
      '@woh/db': resolve(__dirname, 'packages/db/src'),
    },
  },
});

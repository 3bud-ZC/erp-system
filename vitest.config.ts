import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest config for pure-domain tests.
 *
 * Scope-limited on purpose: only files under tests/domain/** are picked up.
 * This guarantees we never accidentally pull in server-only modules
 * (Prisma client, Next request objects, etc.) into the unit test runner.
 */
export default defineConfig({
  test: {
    include: ['tests/domain/**/*.test.ts'],
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['lib/domain/**/*.ts'],
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});

import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: [
      'shared/tests/**/*.test.ts',
      'backend/tests/**/*.test.ts',
      'frontend/tests/**/*.test.ts',
    ],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});

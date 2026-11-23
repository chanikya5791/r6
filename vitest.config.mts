import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 180_000,
    // Integration test files each start their own containers; run files one at a time.
    fileParallelism: false,
  },
});

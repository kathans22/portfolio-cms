import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: './src/tests/globalSetup.ts',
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    // All test files share one in-memory MongoDB instance (see globalSetup.ts) and
    // setup.ts truncates collections in afterEach — running files concurrently causes
    // one file's cleanup to wipe data another file's test is still using.
    fileParallelism: false,
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],

    // Node by default: the engine suite needs no DOM and starting one for it would cost
    // seconds per file. The few tests that do need a DOM opt in per file with a
    // `// @vitest-environment jsdom` docblock.
    environment: 'node',

    /*
      Threads rather than the default forked processes.

      jsdom takes several seconds to boot, and on Windows a forked worker doing that can
      exceed the pool's startup window and fail with "Timeout waiting for worker to
      respond" — the file never runs, which reads like a broken test but is a cold start.
      Threads share the process and come up fast enough to avoid it.
    */
    pool: 'threads',

    // Headroom for the same cold start, so a slow machine reports a real result rather
    // than a timeout.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

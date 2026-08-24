import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],

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

    /*
      One worker, reused across files.

      Booting jsdom costs seconds, and the pool gives each new worker a fixed window to
      report in. Spinning up several in parallel on a loaded machine pushes some past it and
      they fail with "Timeout waiting for worker to respond" — the file never runs at all,
      which looks like a broken test but is a cold start. It was intermittent, which is worse
      than consistently broken: a green run proved nothing.

      A single reused worker pays the jsdom cost once instead of racing several starts. The
      suite is a few seconds slower and no longer flaky, which is the right trade for
      something whose job is to tell you the truth about the code.
    */
    poolOptions: {
      threads: { singleThread: true },
    },

    // Headroom for the same cold start, so a slow machine reports a real result rather
    // than a timeout.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

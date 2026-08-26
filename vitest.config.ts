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
      One file at a time, so only one worker is ever starting.

      Booting jsdom costs seconds, and the pool gives each new worker a fixed window to
      report in. Spinning up several in parallel on a loaded machine pushes some past it and
      they fail with "Timeout waiting for worker to respond" — the file never runs at all,
      which looks like a broken test but is a cold start.

      This was previously written as `poolOptions.threads.singleThread`, which Vitest 4
      REMOVED: it is still accepted in the config object but only to print a deprecation,
      then ignored. The suite ran fully parallel and all four jsdom files failed to start on
      every run. Keep this as the top-level option — `fileParallelism: false` pins the pool
      to a single worker (it overrides `maxWorkers` to 1) — and do not "restore" the nested
      form.

      The suite is a few seconds slower and no longer flaky, which is the right trade for
      something whose job is to tell you the truth about the code.
    */
    fileParallelism: false,

    // Headroom for the same cold start, so a slow machine reports a real result rather
    // than a timeout.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

import { defineConfig } from 'vitest/config'

/**
 * Live database security-posture checks (`npm run test:db`).
 *
 * Separate from vitest.config.ts on purpose: these hit the real project over
 * the network and need real credentials, so they must not run as part of the
 * hermetic `npm run test:run` suite. vitest.config.ts excludes this file for
 * the same reason.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['scripts/db-security.test.ts'],
    // One project, one posture — parallel workers would just duplicate the
    // same read-only queries against production.
    fileParallelism: false,
  },
})

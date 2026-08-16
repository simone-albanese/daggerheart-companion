import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      // `.tsx` is here because a component test has to be a `.tsx` file, and a
      // pattern that only names `.ts` would have collected none of them while
      // still reporting a green run. `tests/harness/collection.test.ts` holds
      // that line.
      include: [
        'tests/**/*.test.{ts,tsx}',
        'src/**/*.test.{ts,tsx}',
        'shared/**/*.test.{ts,tsx}',
      ],
      // Parser tests need the SRD PDF, which is deliberately not committed;
      // they skip themselves when it is absent. Everything else is hermetic.
      testTimeout: 30_000,
    },
  }),
);

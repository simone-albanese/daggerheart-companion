import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts', 'src/**/*.test.ts', 'shared/**/*.test.ts'],
      // Parser tests need the SRD PDF, which is deliberately not committed;
      // they skip themselves when it is absent. Everything else is hermetic.
      testTimeout: 30_000,
    },
  }),
);

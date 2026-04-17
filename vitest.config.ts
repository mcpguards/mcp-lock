import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/cli.ts',
        'src/commands/**',
        'src/registry/**',
        'src/resolver/package-resolver.ts',
        'src/config/known-paths.ts',
        'src/config/config-discovery.ts',
        'src/config/config-writer.ts',
        'src/output/table.ts',
        'src/output/logger.ts',
        'src/util/prompt.ts',
        'src/util/errors.ts',
        'src/util/fs-atomic.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    testTimeout: 15000,
  },
});

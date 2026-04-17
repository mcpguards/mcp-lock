import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { 'mcp-lock': 'src/cli.ts' },
  outDir: 'dist',
  format: ['esm'],
  target: 'node18',
  clean: true,
  dts: false,
  sourcemap: true,
  minify: false,
  outExtension: () => ({ js: '.js' }),
  banner: { js: '#!/usr/bin/env node' },
  noExternal: [/^(?!node:).*/],
  esbuildOptions(options) {
    options.outExtension = { '.js': '.js' };
  },
});

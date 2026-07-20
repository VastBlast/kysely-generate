import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts', './src/db.ts', './src/cli/bin.ts'],
  platform: 'node',
  fixedExtension: false,
  clean: true,
  exports: true,
  dts: true,
  cjsDefault: true,
  format: ['cjs', 'esm'],
  deps: {
    neverBundle: [/^bun(:.*)?$/], // bun:* e.g., bun:sqlite
  },
});

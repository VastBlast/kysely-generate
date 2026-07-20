import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const PACKAGE_ROOT = dirname(
  createRequire(import.meta.url).resolve('kysely-generate/package.json'),
);
const DEFAULT_OUT_DIR = join(PACKAGE_ROOT, 'dist');

export const DEFAULT_CJS_OUT_FILE = join(DEFAULT_OUT_DIR, 'db.d.cts');
export const DEFAULT_OUT_FILE = join(DEFAULT_OUT_DIR, 'db.d.ts');

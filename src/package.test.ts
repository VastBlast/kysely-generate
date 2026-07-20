import { execa } from 'execa';
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TEST_TIMEOUT = 60_000;

describe('package', () => {
  beforeAll(async () => {
    await execa`npm run build`;
  }, TEST_TIMEOUT);

  it(
    'exposes the generated DB declaration to ESM and CommonJS consumers',
    async () => {
      const directory = await mkdtemp(join(ROOT, '.package-test-'));

      try {
        const consumerDirectory = join(directory, 'packages', 'app');
        const packageDirectory = join(
          directory,
          'node_modules',
          'kysely-generate',
        );
        await mkdir(packageDirectory, { recursive: true });
        await mkdir(consumerDirectory, { recursive: true });
        await copyFile(
          join(ROOT, 'package.json'),
          join(packageDirectory, 'package.json'),
        );
        await cp(join(ROOT, 'dist'), join(packageDirectory, 'dist'), {
          recursive: true,
        });
        await writeFile(
          join(consumerDirectory, 'package.json'),
          JSON.stringify({
            name: 'kysely-generate-consumer',
            private: true,
            type: 'module',
          }),
        );
        await execa(
          process.execPath,
          [
            '--input-type=module',
            '--eval',
            [
              "import { generate } from 'kysely-generate';",
              'await generate({',
              '  db: {},',
              '  dialect: { introspector: { introspect: async () => ({ tables: [] }) } },',
              "  serializer: { serializeFile: () => 'export interface DB { users: { id: number } }\\n' },",
              '});',
            ].join('\n'),
          ],
          { cwd: consumerDirectory },
        );
        await writeFile(
          join(consumerDirectory, 'consumer.mts'),
          [
            "import { generate, type DB } from 'kysely-generate';",
            "const table: keyof DB = 'users';",
            'void generate;',
          ].join('\n'),
        );
        await writeFile(
          join(consumerDirectory, 'consumer.cts'),
          [
            "import { generate, type DB } from 'kysely-generate';",
            "const table: keyof DB = 'users';",
            'void generate;',
          ].join('\n'),
        );
        await writeFile(
          join(consumerDirectory, 'tsconfig.json'),
          JSON.stringify({
            compilerOptions: {
              module: 'NodeNext',
              moduleResolution: 'NodeNext',
              noEmit: true,
              skipLibCheck: true,
              strict: true,
              target: 'ES2022',
            },
            include: ['consumer.mts', 'consumer.cts'],
          }),
        );

        const result = await execa(
          process.execPath,
          [
            join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'),
            '--project',
            join(consumerDirectory, 'tsconfig.json'),
          ],
          { reject: false },
        );

        expect(
          result.exitCode,
          result.stdout || result.stderr || JSON.stringify(result),
        ).toBe(0);
        await execa(
          process.execPath,
          ['--input-type=module', '--eval', "await import('kysely-generate')"],
          { cwd: consumerDirectory },
        );
        await execa(
          process.execPath,
          ['--eval', "require('kysely-generate')"],
          {
            cwd: consumerDirectory,
          },
        );
      } finally {
        await rm(directory, { force: true, recursive: true });
      }
    },
    TEST_TIMEOUT,
  );
});

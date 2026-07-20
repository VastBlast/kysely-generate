import { deepStrictEqual } from 'node:assert';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConnectionStringParser } from './connection-string-parser';
import { describe, expect, it, vi } from 'vitest';

describe(ConnectionStringParser.name, () => {
  const parser = new ConnectionStringParser();

  it('should load environment files without writing directly to the console', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'kysely-generate-'));
    const envFile = join(directory, '.env');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await writeFile(envFile, 'KYSELY_GENERATE_TEST_URL=:memory:\n');
      parser.parse({
        connectionString: 'env(KYSELY_GENERATE_TEST_URL)',
        envFile,
      });

      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      delete process.env.KYSELY_GENERATE_TEST_URL;
      await rm(directory, { recursive: true });
    }
  });

  it('should trim whitespace around environment variable names', () => {
    process.env.KYSELY_GENERATE_TEST_URL = ':memory:';

    try {
      deepStrictEqual(
        parser.parse({
          connectionString: 'env( KYSELY_GENERATE_TEST_URL )',
        }),
        { connectionString: ':memory:', dialect: 'sqlite' },
      );
    } finally {
      delete process.env.KYSELY_GENERATE_TEST_URL;
    }
  });

  describe('postgres', () => {
    it('should infer the correct dialect name', () => {
      deepStrictEqual(
        parser.parse({
          connectionString: 'postgres://username:password@hostname/database',
        }),
        {
          connectionString: 'postgres://username:password@hostname/database',
          dialect: 'postgres',
        },
      );
      deepStrictEqual(
        parser.parse({
          connectionString: 'postgresql://username:password@hostname/database',
        }),
        {
          connectionString: 'postgresql://username:password@hostname/database',
          dialect: 'postgres',
        },
      );
      deepStrictEqual(
        parser.parse({
          connectionString: 'pg://username:password@hostname/database',
        }),
        {
          connectionString: 'postgres://username:password@hostname/database',
          dialect: 'postgres',
        },
      );
      deepStrictEqual(
        parser.parse({
          connectionString: 'PG://username:password@hostname/database',
        }),
        {
          connectionString: 'postgres://username:password@hostname/database',
          dialect: 'postgres',
        },
      );
      deepStrictEqual(
        parser.parse({
          connectionString: 'Postgres://username:password@hostname/database',
        }),
        {
          connectionString: 'Postgres://username:password@hostname/database',
          dialect: 'postgres',
        },
      );
      deepStrictEqual(
        parser.parse({
          connectionString: 'postgres://username:password@hostname/database',
          dialect: 'postgres-js',
        }),
        {
          connectionString: 'postgres://username:password@hostname/database',
          dialect: 'postgres-js',
        },
      );
    });
  });

  describe('mysql', () => {
    it('should infer the correct dialect name', () => {
      deepStrictEqual(
        parser.parse({
          connectionString: 'mysql://username:password@hostname/database',
        }),
        {
          connectionString: 'mysql://username:password@hostname/database',
          dialect: 'mysql',
        },
      );
      deepStrictEqual(
        parser.parse({
          connectionString: 'mysqlx://username:password@hostname/database',
        }),
        {
          connectionString: 'mysqlx://username:password@hostname/database',
          dialect: 'mysql',
        },
      );
      deepStrictEqual(
        parser.parse({
          connectionString: 'MYSQL://username:password@hostname/database',
        }),
        {
          connectionString: 'MYSQL://username:password@hostname/database',
          dialect: 'mysql',
        },
      );
    });
  });

  describe('sqlite', () => {
    it('should infer the correct dialect name', () => {
      deepStrictEqual(
        parser.parse({
          connectionString: 'C:/Program Files/sqlite3/db',
        }),
        {
          connectionString: 'C:/Program Files/sqlite3/db',
          dialect: 'sqlite',
        },
      );
      deepStrictEqual(
        parser.parse({
          connectionString: '/usr/local/bin',
        }),
        {
          connectionString: '/usr/local/bin',
          dialect: 'sqlite',
        },
      );
    });
  });

  describe('libsql', () => {
    it('should infer the correct dialect name', () => {
      deepStrictEqual(
        parser.parse({
          connectionString: 'libsql://token@hostname:port/db',
        }),
        {
          connectionString: 'libsql://token@hostname:port/db',
          dialect: 'libsql',
        },
      );
      deepStrictEqual(
        parser.parse({
          connectionString: 'libsql://hostname:port/db',
        }),
        {
          connectionString: 'libsql://hostname:port/db',
          dialect: 'libsql',
        },
      );
      deepStrictEqual(
        parser.parse({
          connectionString: 'LIBSQL://hostname:port/db',
        }),
        {
          connectionString: 'LIBSQL://hostname:port/db',
          dialect: 'libsql',
        },
      );
    });
  });
});

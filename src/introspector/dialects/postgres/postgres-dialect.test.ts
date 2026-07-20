import { Kysely, sql } from 'kysely';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { PostgresIntrospectorDialect } from './postgres-dialect';

const CONNECTION_STRING = 'postgres://user:password@localhost:5433/database';
const PARSER_OIDS = [1082, 1182, 1700, 1231] as const;
const TEST_TIMEOUT = 60_000;
type TypeParser = (value: string) => unknown;

const getGlobalTypeParser = pg.types.getTypeParser as unknown as (
  oid: number,
) => TypeParser;
const setGlobalTypeParser = pg.types.setTypeParser as unknown as (
  oid: number,
  parser: TypeParser,
) => void;

describe(PostgresIntrospectorDialect.name, () => {
  it('does not require pg.TypeOverrides', async () => {
    const typeOverrides = pg.TypeOverrides;
    Reflect.set(pg, 'TypeOverrides', undefined);

    try {
      const dialect =
        await new PostgresIntrospectorDialect().createKyselyDialect({
          connectionString: CONNECTION_STRING,
        });
      const db = new Kysely({ dialect });

      await db.destroy();
    } finally {
      Reflect.set(pg, 'TypeOverrides', typeOverrides);
    }
  });

  it('does not modify the global PostgreSQL type parsers', async () => {
    const originalParsers = PARSER_OIDS.map((oid) =>
      getGlobalTypeParser(oid),
    );

    try {
      const dialect = await new PostgresIntrospectorDialect({
        dateParser: 'string',
        numericParser: 'number',
      }).createKyselyDialect({ connectionString: CONNECTION_STRING });
      const db = new Kysely({ dialect });

      await db.destroy();

      for (const [index, oid] of PARSER_OIDS.entries()) {
        expect(getGlobalTypeParser(oid)).toBe(originalParsers[index]);
      }
    } finally {
      for (const [index, oid] of PARSER_OIDS.entries()) {
        setGlobalTypeParser(oid, originalParsers[index]!);
      }
    }
  });

  it(
    'applies configured parsers to date and numeric arrays',
    async () => {
      const dialect = new PostgresIntrospectorDialect({
        dateParser: 'string',
        numericParser: 'number-or-string',
      });
      const db = await dialect.introspector.connect({
        connectionString: CONNECTION_STRING,
        dialect,
      });

      try {
        const { rows } = await sql<{
          dates: (null | string)[];
          numerics: (null | number | string)[];
        }>`
          select
            array['2024-10-14'::date, null, '2024-10-15'::date] as dates,
            array[9007199254740993::numeric, 1.25::numeric, null] as numerics
        `.execute(db);

        expect(rows[0]).toStrictEqual({
          dates: ['2024-10-14', null, '2024-10-15'],
          numerics: ['9007199254740993', 1.25, null],
        });
      } finally {
        await db.destroy();
      }
    },
    TEST_TIMEOUT,
  );

  it(
    'preserves numeric array values in string mode',
    async () => {
      const dialect = new PostgresIntrospectorDialect({
        numericParser: 'string',
      });
      const db = await dialect.introspector.connect({
        connectionString: CONNECTION_STRING,
        dialect,
      });

      try {
        const { rows } = await sql<{ numerics: (null | string)[] }>`
          select array[9007199254740993::numeric, 1.25::numeric, null] as numerics
        `.execute(db);

        expect(rows[0]?.numerics).toStrictEqual([
          '9007199254740993',
          '1.25',
          null,
        ]);
      } finally {
        await db.destroy();
      }
    },
    TEST_TIMEOUT,
  );
});

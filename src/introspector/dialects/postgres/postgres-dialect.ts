import {
  type Dialect as KyselyDialect,
  PostgresDialect as KyselyPostgresDialect,
} from 'kysely';
import type { CustomTypesConfig } from 'pg';
import { parse as parsePostgresArray } from 'postgres-array';
import type { CreateKyselyDialectOptions } from '../../dialect';
import { IntrospectorDialect } from '../../dialect';
import type { DateParser } from './date-parser';
import { DEFAULT_DATE_PARSER } from './date-parser';
import type { NumericParser } from './numeric-parser';
import { DEFAULT_NUMERIC_PARSER } from './numeric-parser';
import { PostgresIntrospector } from './postgres-introspector';

const DATE_OID = 1082;
const DATE_ARRAY_OID = 1182;
const NUMERIC_OID = 1700;
const NUMERIC_ARRAY_OID = 1231;

const identity = (value: string) => value;

const createArrayParser = <T>(parser: (value: string) => T) => {
  return (value: string) => parsePostgresArray(value, parser);
};

type PostgresDialectOptions = {
  dateParser?: DateParser;
  defaultSchemas?: string[];
  domains?: boolean;
  numericParser?: NumericParser;
  partitions?: boolean;
};

export class PostgresIntrospectorDialect extends IntrospectorDialect {
  protected readonly options: PostgresDialectOptions;
  override readonly introspector: PostgresIntrospector;

  constructor(options?: PostgresDialectOptions) {
    super();

    this.introspector = new PostgresIntrospector({
      defaultSchemas: options?.defaultSchemas,
      domains: options?.domains,
      partitions: options?.partitions,
    });
    this.options = {
      dateParser: options?.dateParser ?? DEFAULT_DATE_PARSER,
      defaultSchemas: options?.defaultSchemas,
      domains: options?.domains ?? true,
      numericParser: options?.numericParser ?? DEFAULT_NUMERIC_PARSER,
    };
  }

  async createKyselyDialect(
    options: CreateKyselyDialectOptions,
  ): Promise<KyselyDialect> {
    const { default: pg } = await import('pg');
    const textParsers = new Map<number, (value: string) => unknown>();

    if (this.options.dateParser === 'string') {
      textParsers.set(DATE_OID, identity);
      textParsers.set(DATE_ARRAY_OID, createArrayParser(identity));
    }

    const numericParser =
      this.options.numericParser === 'number'
        ? Number
        : this.options.numericParser === 'number-or-string'
          ? (value: string) => {
              const number = Number(value);
              return number > Number.MAX_SAFE_INTEGER ||
                number < Number.MIN_SAFE_INTEGER
                ? value
                : number;
            }
          : identity;

    textParsers.set(NUMERIC_OID, numericParser);
    textParsers.set(NUMERIC_ARRAY_OID, createArrayParser(numericParser));

    const types: CustomTypesConfig = {
      getTypeParser: (oid, format) => {
        const parser = format !== 'binary' ? textParsers.get(oid) : undefined;
        return parser ?? pg.types.getTypeParser(oid, format);
      },
    };

    return new KyselyPostgresDialect({
      pool: new pg.Pool({
        connectionString: options.connectionString,
        ssl: options.ssl ? { rejectUnauthorized: false } : false,
        types,
      }),
    });
  }
}

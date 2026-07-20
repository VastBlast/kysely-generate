import { describe, expect, test } from 'vitest';
import { EnumCollection } from '../../enum-collection';
import {
  type PostgresArrayInspector,
  type PostgresDomainInspector,
  PostgresIntrospector,
} from './postgres-introspector';

type RawColumn = {
  auto_incrementing: string | null;
  column: string;
  column_description: string | null;
  has_default: boolean;
  not_null: boolean;
  schema: string;
  table: string;
  table_type: string;
  type: string;
  type_schema: string;
};

const parseTableMetadata = (introspector: PostgresIntrospector) => {
  return (
    introspector as unknown as {
      parseTableMetadata: (columns: RawColumn[]) => unknown[];
    }
  ).parseTableMetadata.bind(introspector);
};

const mergeTables = (introspector: PostgresIntrospector) => {
  return (
    introspector as unknown as {
      mergeTables: (tables: unknown[], materializedViews: unknown[]) => unknown[];
    }
  ).mergeTables.bind(introspector);
};

const column = ({
  schema,
  table,
  ...overrides
}: Partial<RawColumn> & Pick<RawColumn, 'schema' | 'table'>): RawColumn => ({
  auto_incrementing: null,
  column: 'id',
  column_description: null,
  has_default: false,
  not_null: true,
  schema,
  table,
  table_type: 'r',
  type: 'int4',
  type_schema: 'pg_catalog',
  ...overrides,
});

type TypeColumn = {
  dataType: string;
  dataTypeSchema: string;
  name: string;
};

const array = (
  arrayType: string,
  elementType: string,
  arrayTypeSchema = 'public',
  elementTypeSchema = arrayTypeSchema,
): PostgresArrayInspector => ({
  arrayType,
  arrayTypeSchema,
  elementType,
  elementTypeSchema,
});

const typeColumn = (
  dataType: string,
  name: string,
  dataTypeSchema = 'public',
): TypeColumn => ({ dataType, dataTypeSchema, name });

const inspectTypes = ({
  arrays,
  columns,
  domains = [],
  enums = new EnumCollection(),
}: {
  arrays?: PostgresArrayInspector[];
  columns: TypeColumn[];
  domains?: PostgresDomainInspector[];
  enums?: EnumCollection;
}) => {
  const metadata = new PostgresIntrospector().createDatabaseMetadata({
    arrays,
    domains,
    enums,
    partitions: [],
    tables: [
      {
        columns: columns.map((column) => ({
          ...column,
          hasDefaultValue: false,
          isAutoIncrementing: false,
          isNullable: false,
        })),
        isView: false,
        name: 'users',
        schema: 'public',
      },
    ],
  });

  return metadata.tables[0]!.columns;
};

describe(PostgresIntrospector.name, () => {
  test('resolves catalog arrays without guessing from underscores', () => {
    const columns = inspectTypes({
      arrays: [
        array('__status', '_status'),
        array('status_array', 'status'),
      ],
      columns: [
        typeColumn('_status', 'status'),
        typeColumn('__status', 'statuses'),
        typeColumn('status_array', 'renamed_statuses'),
      ],
      enums: new EnumCollection({
        'public._status': ['leading'],
        'public.status': ['active', 'inactive'],
      }),
    });

    expect(columns).toMatchObject([
      { dataType: '_status', enumValues: ['leading'], isArray: false },
      { dataType: '_status', enumValues: ['leading'], isArray: true },
      {
        dataType: 'status',
        enumValues: ['active', 'inactive'],
        isArray: true,
      },
    ]);
  });

  test('uses the root type schema for domains', () => {
    const columns = inspectTypes({
      arrays: [],
      columns: [typeColumn('_status_domain', 'status', 'domain_schema')],
      domains: [
        {
          rootType: 'status',
          rootTypeSchema: 'enum_schema',
          typeName: '_status_domain',
          typeSchema: 'domain_schema',
        },
      ],
      enums: new EnumCollection({
        'enum_schema.status': ['active', 'inactive'],
      }),
    });

    expect(columns[0]).toMatchObject({
      dataType: 'status',
      dataTypeSchema: 'enum_schema',
      enumValues: ['active', 'inactive'],
      isArray: false,
    });
  });

  test('resolves arrays of domains and domains over arrays', () => {
    const columns = inspectTypes({
      arrays: [
        array('status_domain_array', 'status_domain', 'domain_schema'),
        array('status_array', 'status', 'enum_schema'),
      ],
      columns: [
        typeColumn(
          'status_domain_array',
          'array_of_domains',
          'domain_schema',
        ),
        typeColumn(
          'status_array_domain',
          'domain_over_array',
          'domain_schema',
        ),
      ],
      domains: [
        {
          rootType: 'status',
          rootTypeSchema: 'enum_schema',
          typeName: 'status_domain',
          typeSchema: 'domain_schema',
        },
        {
          rootType: 'status_array',
          rootTypeSchema: 'enum_schema',
          typeName: 'status_array_domain',
          typeSchema: 'domain_schema',
        },
      ],
      enums: new EnumCollection({
        'enum_schema.status': ['active', 'inactive'],
      }),
    });

    expect(columns).toMatchObject([
      {
        dataType: 'status',
        dataTypeSchema: 'enum_schema',
        enumValues: ['active', 'inactive'],
        isArray: true,
      },
      {
        dataType: 'status',
        dataTypeSchema: 'enum_schema',
        enumValues: ['active', 'inactive'],
        isArray: true,
      },
    ]);
  });

  test('keeps array relationships isolated by schema', () => {
    const columns = inspectTypes({
      arrays: [
        array('values', 'text', 'first', 'pg_catalog'),
        array('values', 'int4', 'second', 'pg_catalog'),
      ],
      columns: [
        typeColumn('values', 'texts', 'first'),
        typeColumn('values', 'numbers', 'second'),
      ],
    });

    expect(columns).toMatchObject([
      {
        dataType: 'text',
        dataTypeSchema: 'pg_catalog',
        isArray: true,
      },
      {
        dataType: 'int4',
        dataTypeSchema: 'pg_catalog',
        isArray: true,
      },
    ]);
  });

  test('preserves the legacy array fallback without catalog data', () => {
    const columns = inspectTypes({
      columns: [
        typeColumn('__status', 'statuses'),
        typeColumn('status_domain_array', 'domain_statuses'),
      ],
      domains: [
        {
          arrayType: 'status_domain_array',
          rootType: 'status',
          rootTypeSchema: 'public',
          typeName: 'status_domain',
          typeSchema: 'public',
        },
      ],
      enums: new EnumCollection({
        'public._status': ['leading'],
        'public.status': ['active'],
      }),
    });

    expect(columns).toMatchObject([
      {
        dataType: '_status',
        enumValues: ['leading'],
        isArray: true,
      },
      {
        dataType: 'status',
        enumValues: ['active'],
        isArray: true,
      },
    ]);
  });

  test('keeps upstream table order when there are no materialized views', () => {
    const introspector = new PostgresIntrospector();
    const tables = [
      { columns: [], isView: false, name: 'z', schema: 'public' },
      { columns: [], isView: false, name: 'a', schema: 'public' },
    ];

    expect(mergeTables(introspector)(tables, [])).toBe(tables);
  });

  test('marks materialized views as views', () => {
    const introspector = new PostgresIntrospector();
    const tables = parseTableMetadata(introspector)([
      column({ schema: 'public', table: 'foo_bar_mv', table_type: 'm' }),
    ]);

    expect(tables).toHaveLength(1);
    expect(tables[0]).toMatchObject({
      isForeign: false,
      isView: true,
      name: 'foo_bar_mv',
      schema: 'public',
    });
    expect((tables[0] as any).columns).toHaveLength(1);
    expect((tables[0] as any).columns[0]).toMatchObject({
      comment: undefined,
      dataType: 'int4',
      dataTypeSchema: 'pg_catalog',
      hasDefaultValue: false,
      isAutoIncrementing: false,
      isNullable: false,
      name: 'id',
    });
  });

  test('groups columns by schema and table without collisions', () => {
    const introspector = new PostgresIntrospector();
    const tables = parseTableMetadata(introspector)([
      column({ schema: 'a.b', table: 'c', table_type: 'm' }),
      column({ schema: 'a', table: 'b.c', table_type: 'm' }),
    ]);

    expect(tables).toHaveLength(2);
    expect(tables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'c', schema: 'a.b' }),
        expect.objectContaining({ name: 'b.c', schema: 'a' }),
      ]),
    );
  });

  test('collects multiple columns for the same table', () => {
    const introspector = new PostgresIntrospector();
    const tables = parseTableMetadata(introspector)([
      column({ schema: 'public', table: 't', column: 'a' }),
      column({ schema: 'public', table: 't', column: 'b', not_null: false }),
    ]);

    expect(tables).toHaveLength(1);
    expect((tables[0] as any).columns).toHaveLength(2);
    expect((tables[0] as any).columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'a', isNullable: false }),
        expect.objectContaining({ name: 'b', isNullable: true }),
      ]),
    );
  });
});

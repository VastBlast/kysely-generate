import type {
  Kysely,
  ColumnMetadata as KyselyColumnMetaData,
  TableMetadata as KyselyTableMetadata,
} from 'kysely';
import { sql } from 'kysely';
import { EnumCollection } from '../../enum-collection';
import type { IntrospectOptions } from '../../introspector';
import { Introspector } from '../../introspector';
import type { ColumnMetadata } from '../../metadata/column-metadata';
import { DatabaseMetadata } from '../../metadata/database-metadata';
import type { TableMetadata } from '../../metadata/table-metadata';
import type { PostgresDB } from './postgres-db';

export type PostgresArrayInspector = {
  arrayType: string;
  arrayTypeSchema: string;
  elementType: string;
  elementTypeSchema: string;
};

export type PostgresDomainInspector = {
  arrayType?: string;
  rootType: string;
  rootTypeSchema?: string;
  typeName: string;
  typeSchema: string;
};

type PostgresDomainRow = Omit<PostgresDomainInspector, 'arrayType'> & {
  arrayType: string | null;
};

type PostgresTypeReference = {
  dataType: string;
  dataTypeSchema?: string;
};

const getTypeKey = (dataType: string, dataTypeSchema?: string) => {
  return `${dataTypeSchema ?? ''}\0${dataType}`;
};

export type TableReference = {
  schema?: string;
  name: string;
};

export type PostgresIntrospectorOptions = {
  defaultSchemas?: string[];
  domains?: boolean;
  partitions?: boolean;
};

type PostgresRawColumnMetadata = {
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

type PostgresTableMetadata = KyselyTableMetadata & {
  isForeign: false;
};

export class PostgresIntrospector extends Introspector<PostgresDB> {
  protected readonly options: PostgresIntrospectorOptions;

  constructor(options?: PostgresIntrospectorOptions) {
    super();

    this.options = {
      defaultSchemas:
        options?.defaultSchemas && options.defaultSchemas.length > 0
          ? options.defaultSchemas
          : ['public'],
      domains: options?.domains ?? true,
      partitions: options?.partitions,
    };
  }

  protected override async getTables(options: IntrospectOptions<PostgresDB>) {
    let tables = await options.db.introspection.getTables();
    const materializedViews = await this.getMaterializedViews(
      options.db.withoutPlugins(),
    );

    tables = this.mergeTables(tables, materializedViews);

    return this.filterTables(tables, options);
  }

  private async getMaterializedViews(db: Kysely<PostgresDB>) {
    // Kysely's built-in postgres introspector doesn't include materialized views (`relkind = 'm'`).
    const { rows } = await sql<PostgresRawColumnMetadata>`
      select
        a.attname as column,
        a.attnotnull as not_null,
        a.atthasdef as has_default,
        c.relname as table,
        c.relkind as table_type,
        ns.nspname as schema,
        typ.typname as type,
        dtns.nspname as type_schema,
        col_description(a.attrelid, a.attnum) as column_description,
        pg_get_serial_sequence(
          quote_ident(ns.nspname) || '.' || quote_ident(c.relname),
          a.attname
        ) as auto_incrementing
      from pg_catalog.pg_attribute as a
      inner join pg_catalog.pg_class as c on a.attrelid = c.oid
      inner join pg_catalog.pg_namespace as ns on c.relnamespace = ns.oid
      inner join pg_catalog.pg_type as typ on a.atttypid = typ.oid
      inner join pg_catalog.pg_namespace as dtns on typ.typnamespace = dtns.oid
      where c.relkind = 'm'
        and ns.nspname !~ '^pg_'
        and ns.nspname != 'information_schema'
        and ns.nspname != 'crdb_internal'
        and has_schema_privilege(ns.nspname, 'USAGE')
        and a.attnum >= 0
        and a.attisdropped != true
      order by ns.nspname, c.relname, a.attnum;
    `.execute(db);

    return this.parseTableMetadata(rows);
  }

  private mergeTables(
    tables: KyselyTableMetadata[],
    materializedViews: KyselyTableMetadata[],
  ) {
    if (materializedViews.length === 0) {
      return tables;
    }

    if (tables.length === 0) {
      return materializedViews;
    }

    const mergedTables = new Map<string, KyselyTableMetadata>();

    for (const table of [...tables, ...materializedViews]) {
      const key = `${table.schema ?? ''}\0${table.name}`;
      if (!mergedTables.has(key)) {
        mergedTables.set(key, table);
      }
    }

    return Array.from(mergedTables.values()).sort((left, right) => {
      const schemaComparison = (left.schema ?? '').localeCompare(
        right.schema ?? '',
      );
      if (schemaComparison !== 0) {
        return schemaComparison;
      }

      return left.name.localeCompare(right.name);
    });
  }

  private parseTableMetadata(columns: PostgresRawColumnMetadata[]) {
    const tables = new Map<string, PostgresTableMetadata>();

    for (const column of columns) {
      const key = `${column.schema}\0${column.table}`;
      let table = tables.get(key);

      if (!table) {
        table = {
          columns: [],
          isForeign: false,
          isView: column.table_type === 'v' || column.table_type === 'm',
          name: column.table,
          schema: column.schema,
        };
        tables.set(key, table);
      }

      table.columns.push({
        comment: column.column_description ?? undefined,
        dataType: column.type,
        dataTypeSchema: column.type_schema,
        hasDefaultValue: column.has_default,
        isAutoIncrementing: column.auto_incrementing !== null,
        isNullable: !column.not_null,
        name: column.column,
      });
    }

    return Array.from(tables.values());
  }

  createDatabaseMetadata({
    arrays,
    domains,
    enums,
    partitions,
    tables: rawTables,
  }: {
    arrays?: PostgresArrayInspector[];
    domains: PostgresDomainInspector[];
    enums: EnumCollection;
    partitions: TableReference[];
    tables: KyselyTableMetadata[];
  }) {
    const resolveType = this.createTypeResolver(domains, arrays);
    const tables = rawTables
      .map((table): TableMetadata => {
        const columns = table.columns.map((column): ColumnMetadata => {
          const { dataType, dataTypeSchema, isArray } = resolveType(column);
          const schema =
            dataTypeSchema ?? this.options.defaultSchemas?.[0] ?? 'public';
          const enumValues = enums.get(`${schema}.${dataType}`);

          return {
            comment: column.comment ?? null,
            dataType,
            dataTypeSchema,
            enumValues,
            hasDefaultValue: column.hasDefaultValue,
            isArray,
            isAutoIncrementing: column.isAutoIncrementing,
            isNullable: column.isNullable,
            name: column.name,
          };
        });

        const isPartition = partitions.some((partition) => {
          return (
            partition.schema === table.schema && partition.name === table.name
          );
        });

        return {
          columns,
          isPartition,
          isView: table.isView,
          name: table.name,
          schema: table.schema,
        };
      })
      .filter((table) => {
        return this.options.partitions ? true : !table.isPartition;
      });

    return new DatabaseMetadata({ enums, tables });
  }

  getRootType(
    column: KyselyColumnMetaData,
    domains: PostgresDomainInspector[],
  ) {
    const { dataType, isArray } = this.createTypeResolver(domains)(column);
    return isArray ? `_${dataType}` : dataType;
  }

  private createTypeResolver(
    domains: PostgresDomainInspector[],
    arrays?: PostgresArrayInspector[],
  ) {
    const arrayElements = new Map<string, PostgresTypeReference>();
    const domainRoots = new Map<string, PostgresTypeReference>();

    for (const domain of domains) {
      domainRoots.set(getTypeKey(domain.typeName, domain.typeSchema), {
        dataType: domain.rootType,
        dataTypeSchema: domain.rootTypeSchema ?? domain.typeSchema,
      });

      if (domain.arrayType) {
        arrayElements.set(getTypeKey(domain.arrayType, domain.typeSchema), {
          dataType: domain.typeName,
          dataTypeSchema: domain.typeSchema,
        });
      }
    }

    for (const array of arrays ?? []) {
      arrayElements.set(
        getTypeKey(array.arrayType, array.arrayTypeSchema),
        {
          dataType: array.elementType,
          dataTypeSchema: array.elementTypeSchema,
        },
      );
    }

    return (column: KyselyColumnMetaData) => {
      let dataType = column.dataType;
      let dataTypeSchema = column.dataTypeSchema;
      let isArray = false;
      const visitedTypes = new Set<string>();

      while (true) {
        const key = getTypeKey(dataType, dataTypeSchema);
        if (visitedTypes.has(key)) {
          break;
        }
        visitedTypes.add(key);

        const domainRoot = domainRoots.get(key);
        if (domainRoot) {
          dataType = domainRoot.dataType;
          dataTypeSchema = domainRoot.dataTypeSchema;
          continue;
        }

        const arrayElement = arrayElements.get(key);
        if (arrayElement) {
          dataType = arrayElement.dataType;
          dataTypeSchema = arrayElement.dataTypeSchema;
          isArray = true;
          continue;
        }

        if (arrays === undefined && dataType.startsWith('_')) {
          dataType = dataType.slice(1);
          isArray = true;
          const elementKey = getTypeKey(dataType, dataTypeSchema);
          if (
            domainRoots.has(elementKey) ||
            arrayElements.has(elementKey)
          ) {
            continue;
          }
        }

        break;
      }

      return { dataType, dataTypeSchema, isArray };
    };
  }

  async introspect(options: IntrospectOptions<PostgresDB>) {
    const tables = await this.getTables(options);

    const [arrays, domains, enums, partitions] = await Promise.all([
      this.introspectArrays(options.db),
      this.introspectDomains(options.db),
      this.introspectEnums(options.db),
      this.introspectPartitions(options.db),
    ]);

    return this.createDatabaseMetadata({
      arrays,
      domains,
      enums,
      partitions,
      tables,
    });
  }

  protected async introspectArrays(db: Kysely<PostgresDB>) {
    const result = await sql<PostgresArrayInspector>`
      select
        array_type.typname as "arrayType",
        array_namespace.nspname as "arrayTypeSchema",
        element_type.typname as "elementType",
        element_namespace.nspname as "elementTypeSchema"
      from pg_catalog.pg_type as element_type
      join pg_catalog.pg_type as array_type
        on array_type.oid = element_type.typarray
      join pg_catalog.pg_namespace as array_namespace
        on array_namespace.oid = array_type.typnamespace
      join pg_catalog.pg_namespace as element_namespace
        on element_namespace.oid = element_type.typnamespace;
    `.execute(db);

    return result.rows;
  }

  async introspectDomains(db: Kysely<PostgresDB>) {
    if (!this.options.domains) {
      return [];
    }

    const result = await sql<PostgresDomainRow>`
      with recursive domain_hierarchy as (
        select oid, typbasetype
        from pg_catalog.pg_type
        where typtype = 'd'
        and 'information_schema'::regnamespace::oid <> typnamespace

        union all

        select dh.oid, t.typbasetype
        from domain_hierarchy as dh
        join pg_catalog.pg_type as t on t.oid = dh.typbasetype
      )

      select
        array_type.typname as "arrayType",
        t.typname as "typeName",
        type_namespace.nspname as "typeSchema",
        bt.typname as "rootType",
        root_type_namespace.nspname as "rootTypeSchema"
      from domain_hierarchy as dh
      join pg_catalog.pg_type as t on dh.oid = t.oid
      join pg_catalog.pg_namespace as type_namespace
        on type_namespace.oid = t.typnamespace
      left join pg_catalog.pg_type as array_type on array_type.oid = t.typarray
      join pg_catalog.pg_type as bt on dh.typbasetype = bt.oid
      join pg_catalog.pg_namespace as root_type_namespace
        on root_type_namespace.oid = bt.typnamespace
      where bt.typbasetype = 0;
    `.execute(db);

    return result.rows.map(({ arrayType, ...domain }) => {
      return arrayType === null ? domain : { ...domain, arrayType };
    });
  }

  async introspectEnums(db: Kysely<PostgresDB>) {
    const enums = new EnumCollection();

    const rows = await db
      .withoutPlugins()
      .selectFrom('pg_type as type')
      .innerJoin('pg_enum as enum', 'type.oid', 'enum.enumtypid')
      .innerJoin(
        'pg_catalog.pg_namespace as namespace',
        'namespace.oid',
        'type.typnamespace',
      )
      .select([
        'namespace.nspname as schemaName',
        'type.typname as enumName',
        'enum.enumlabel as enumValue',
      ])
      .execute();

    for (const row of rows) {
      enums.add(`${row.schemaName}.${row.enumName}`, row.enumValue);
    }

    return enums;
  }

  async introspectPartitions(db: Kysely<PostgresDB>) {
    const result = await sql<TableReference>`
      select pg_namespace.nspname as schema, pg_class.relname as name
      from pg_inherits
      join pg_class on pg_inherits.inhrelid = pg_class.oid
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace;
    `.execute(db);

    return result.rows;
  }
}

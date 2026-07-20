import { EnumCollection } from '../../enum-collection';
import type { IntrospectOptions } from '../../introspector';
import { Introspector } from '../../introspector';
import { DatabaseMetadata } from '../../metadata/database-metadata';

const ROW_VERSION_TYPES = new Set(['rowversion', 'timestamp']);

export class MssqlIntrospector extends Introspector<any> {
  async introspect(options: IntrospectOptions<any>) {
    const tables = (await this.getTables(options)).map((table) => ({
      ...table,
      columns: table.columns.map((column) =>
        ROW_VERSION_TYPES.has(column.dataType.toLowerCase())
          ? { ...column, hasDefaultValue: true }
          : column,
      ),
    }));
    const enums = new EnumCollection();
    return new DatabaseMetadata({ enums, tables });
  }
}

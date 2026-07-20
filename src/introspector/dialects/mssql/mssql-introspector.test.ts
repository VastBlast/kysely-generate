import { describe, expect, it } from 'vitest';
import type { IntrospectOptions } from '../../introspector';
import { MssqlIntrospector } from './mssql-introspector';

class TestMssqlIntrospector extends MssqlIntrospector {
  protected override async getTables(_options: IntrospectOptions<any>) {
    return [
      {
        columns: ['timestamp', 'rowversion', 'binary'].map((dataType) => ({
          dataType,
          hasDefaultValue: false,
          isAutoIncrementing: false,
          isNullable: false,
          name: dataType,
        })),
        isView: false,
        name: 'records',
        schema: 'dbo',
      },
    ];
  }
}

describe(MssqlIntrospector.name, () => {
  it('marks row version columns as generated', async () => {
    const introspector = new TestMssqlIntrospector();
    const metadata = await introspector.introspect(
      {} as IntrospectOptions<any>,
    );

    expect(
      metadata.tables[0]?.columns.map(({ hasDefaultValue, name }) => ({
        hasDefaultValue,
        name,
      })),
    ).toStrictEqual([
      { hasDefaultValue: true, name: 'timestamp' },
      { hasDefaultValue: true, name: 'rowversion' },
      { hasDefaultValue: false, name: 'binary' },
    ]);
  });
});

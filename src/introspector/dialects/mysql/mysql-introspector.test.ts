import type { Kysely } from 'kysely';
import { describe, expect, it, vi } from 'vitest';
import type { MysqlDB } from './mysql-db';
import { MysqlIntrospector } from './mysql-introspector';

describe(MysqlIntrospector.name, () => {
  it('scopes enum introspection to the active database', async () => {
    const execute = vi.fn(async () => []);
    const where = vi.fn(() => ({ execute }));
    const select = vi.fn(() => ({ where }));
    const selectFrom = vi.fn(() => ({ select }));
    const db = {
      withoutPlugins: () => ({ selectFrom }),
    } as unknown as Kysely<MysqlDB>;

    await new MysqlIntrospector().introspectEnums(db);

    expect(where).toHaveBeenCalledWith(
      'TABLE_SCHEMA',
      '=',
      expect.objectContaining({ toOperationNode: expect.any(Function) }),
    );
  });
});

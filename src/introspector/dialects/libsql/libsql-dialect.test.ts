import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LibsqlIntrospectorDialect } from './libsql-dialect';

const dialectConstructor = vi.hoisted(() => vi.fn());

vi.mock('@libsql/kysely-libsql', () => ({
  LibsqlDialect: class {
    constructor(options: unknown) {
      dialectConstructor(options);
    }
  },
}));

describe(LibsqlIntrospectorDialect.name, () => {
  beforeEach(() => {
    dialectConstructor.mockClear();
  });

  it('decodes a URL-encoded authentication token', async () => {
    await new LibsqlIntrospectorDialect().createKyselyDialect({
      connectionString: 'libsql://abc%2Fdef%40x@host/db',
    });

    expect(dialectConstructor).toHaveBeenCalledWith({
      authToken: 'abc/def@x',
      url: 'libsql://host/db',
    });
  });

  it('preserves malformed percent sequences in authentication tokens', async () => {
    await new LibsqlIntrospectorDialect().createKyselyDialect({
      connectionString: 'libsql://abc%ZZ@host/db',
    });

    expect(dialectConstructor).toHaveBeenCalledWith({
      authToken: 'abc%ZZ',
      url: 'libsql://host/db',
    });
  });
});

import { MssqlDialect as KyselyMssqlDialect } from 'kysely';
import type { CreateKyselyDialectOptions } from '../../dialect';
import { IntrospectorDialect } from '../../dialect';
import { MssqlIntrospector } from './mssql-introspector';
import { parse as parseConnectionString } from '@tediousjs/connection-string';

const DEFAULT_MSSQL_PORT = 1433;

export class MssqlIntrospectorDialect extends IntrospectorDialect {
  override readonly introspector = new MssqlIntrospector();

  /**
   * @see https://www.connectionstrings.com/microsoft-data-sqlclient/using-a-non-standard-port/
   * @internal
   */
  protected async parseConnectionString(connectionString: string) {
    const parsed = parseConnectionString(connectionString);
    const tokens = parsed.get('server')!.split(',');
    const serverAndInstance = tokens![0]!.split('\\');
    const server = serverAndInstance![0]!;
    const instanceName = serverAndInstance![1];

    // Instance name and port are mutually exclusive.
    // See https://tediousjs.github.io/tedious/api-connection.html#:~:text=options.instanceName.
    const explicitPort = parsed.get('port');
    const port =
      instanceName === undefined
        ? explicitPort
          ? Number.parseInt(explicitPort, 10)
          : tokens?.[1]
            ? Number.parseInt(tokens?.[1]!, 10)
            : DEFAULT_MSSQL_PORT
        : undefined;

    return {
      database: parsed.get('database')!,
      instanceName,
      password: parsed.get('password')!,
      port,
      server,
      userName: parsed.get('user id')!,
      domain: parsed.get('domain')!,
      authenticationType: parsed.get('authentication')!
    };
  }

  async createKyselyDialect(options: CreateKyselyDialectOptions) {
    const tarn = await import('tarn');
    const tedious = await import('tedious');

    const { database, instanceName, password, port, server, userName, domain, authenticationType } =
      await this.parseConnectionString(options.connectionString);

    const authentication = {
      options: authenticationType === 'ntlm' ? { password, userName, domain } : { password, userName },
      type: authenticationType === 'ntlm' ? 'ntlm' as const : 'default' as const,
    }

    const connectionOptions = {
      database,
      encrypt: options.ssl ?? true,
      instanceName,
      port,
      trustServerCertificate: true,
    }

    return new KyselyMssqlDialect({
      tarn: {
        ...tarn,
        options: { min: 0, max: 1 },
      },
      tedious: {
        ...tedious,
        connectionFactory: () => {
          return new tedious.Connection({
            authentication,
            options: connectionOptions,
            server,
          });
        },
      },
    });
  }
}

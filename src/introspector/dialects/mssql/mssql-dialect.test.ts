import { deepStrictEqual } from 'node:assert';
import { describe, it } from 'vitest';
import { MssqlIntrospectorDialect } from './mssql-dialect';

describe('MssqlIntrospectorDialect', () => {
  describe('parseConnectionString', () => {
    it('should parse basic connection string', async () => {
      const dialect = new MssqlIntrospectorDialect();
      const result = await dialect['parseConnectionString'](
        'Server=mssql;Database=testdb;User Id=testuser;Password=testpass',
      );

      deepStrictEqual(result, {
        server: 'mssql',
        instanceName: undefined,
        port: 1433,
        database: 'testdb',
        userName: 'testuser',
        password: 'testpass',
        domain: undefined,
        authenticationType: undefined,
      });
    });

    it('should parse connection string with NTLM authentication', async () => {
      const dialect = new MssqlIntrospectorDialect();
      const result = await dialect['parseConnectionString'](
        'Server=mssql;Database=testdb;User Id=testuser;Password=testpass;Domain=testdomain;authentication=ntlm',
      );

      deepStrictEqual(result, {
        server: 'mssql',
        instanceName: undefined,
        port: 1433,
        database: 'testdb',
        userName: 'testuser',
        password: 'testpass',
        domain: 'testdomain',
        authenticationType: 'ntlm',
      });
    });

    it('should parse connection string with instance name', async () => {
      const dialect = new MssqlIntrospectorDialect();
      const result = await dialect['parseConnectionString'](
        'Server=mssql\\SQLEXPRESS;Database=testdb;User Id=testuser;Password=testpass',
      );

      deepStrictEqual(result, {
        server: 'mssql',
        instanceName: 'SQLEXPRESS',
        port: undefined,
        database: 'testdb',
        userName: 'testuser',
        password: 'testpass',
        domain: undefined,
        authenticationType: undefined,
      });
    });

    it('should parse connection string with custom port', async () => {
      const dialect = new MssqlIntrospectorDialect();
      const result = await dialect['parseConnectionString'](
        'Server=mssql,1435;Database=testdb;User Id=testuser;Password=testpass',
      );

      deepStrictEqual(result, {
        server: 'mssql',
        instanceName: undefined,
        port: 1435,
        database: 'testdb',
        userName: 'testuser',
        password: 'testpass',
        domain: undefined,
        authenticationType: undefined,
      });
    });

    it('should parse connection string with explicit port parameter', async () => {
      const dialect = new MssqlIntrospectorDialect();
      const result = await dialect['parseConnectionString'](
        'Server=mssql;Database=testdb;User Id=testuser;Password=testpass;port=1436',
      );

      deepStrictEqual(result, {
        server: 'mssql',
        instanceName: undefined,
        port: 1436,
        database: 'testdb',
        userName: 'testuser',
        password: 'testpass',
        domain: undefined,
        authenticationType: undefined,
      });
    });

    it('should prioritize instance name over port', async () => {
      const dialect = new MssqlIntrospectorDialect();
      const result = await dialect['parseConnectionString'](
        'Server=mssql\\SQLEXPRESS,1435;Database=testdb;User Id=testuser;Password=testpass',
      );

      deepStrictEqual(result, {
        server: 'mssql',
        instanceName: 'SQLEXPRESS',
        port: undefined,
        database: 'testdb',
        userName: 'testuser',
        password: 'testpass',
        domain: undefined,
        authenticationType: undefined,
      });
    });

    it('should parse connection string with IP address', async () => {
      const dialect = new MssqlIntrospectorDialect();
      const result = await dialect['parseConnectionString'](
        'Server=192.168.1.100,1433;Database=testdb;User Id=testuser;Password=testpass',
      );

      deepStrictEqual(result, {
        server: '192.168.1.100',
        instanceName: undefined,
        port: 1433,
        database: 'testdb',
        userName: 'testuser',
        password: 'testpass',
        domain: undefined,
        authenticationType: undefined,
      });
    });

    it('should parse connection string with localhost', async () => {
      const dialect = new MssqlIntrospectorDialect();
      const result = await dialect['parseConnectionString'](
        'Server=localhost;Database=testdb;User Id=testuser;Password=testpass',
      );

      deepStrictEqual(result, {
        server: 'localhost',
        instanceName: undefined,
        port: 1433,
        database: 'testdb',
        userName: 'testuser',
        password: 'testpass',
        domain: undefined,
        authenticationType: undefined,
      });
    });
  });
});

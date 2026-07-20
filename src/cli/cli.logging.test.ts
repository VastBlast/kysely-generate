import { describe, expect, it, vi } from 'vitest';
import { Logger } from '../generator/logger/logger';
import { Cli } from './cli';

describe(`${Cli.name} logging`, () => {
  it('redacts connection URLs from debug output', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const secret = 'database-password';

    try {
      await expect(
        new Cli().generate({
          logger: new Logger('debug'),
          url: `env("${secret})`,
        }),
      ).rejects.toThrow('Invalid connection string');

      const output = debug.mock.calls.flat().join(' ');
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain(secret);
    } finally {
      debug.mockRestore();
    }
  });
});

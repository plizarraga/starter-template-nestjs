import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { pinoRedaction } from './platform-logger.module';

describe('platform logger', () => {
  it('When credentials are logged, then the JSON output redacts them centrally', () => {
    const entries: string[] = [];
    const logger = pino(
      { redact: pinoRedaction },
      { write: (entry) => entries.push(entry) },
    );
    const credentials = {
      password: 'not-for-logs',
      context: { accessToken: 'not-for-logs', password: 'not-for-logs' },
      req: { headers: { authorization: 'Bearer not-for-logs' } },
    };

    logger.info(credentials, 'Authentication attempt');

    expect(entries[0]).not.toContain(credentials.password);
    expect(entries[0]).toContain('[Redacted]');
  });
});

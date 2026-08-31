import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
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

  it('When LOG_LEVEL is unset, then the logger defaults to info', async () => {
    const original = process.env.LOG_LEVEL;
    delete process.env.LOG_LEVEL;
    vi.resetModules();

    try {
      const { pinoRedaction: redaction } =
        (await import('./platform-logger.module.js')) as {
          pinoRedaction: { censor: string };
        };
      expect(redaction.censor).toBe('[Redacted]');
    } finally {
      process.env.LOG_LEVEL = original;
      vi.resetModules();
    }
  });
});

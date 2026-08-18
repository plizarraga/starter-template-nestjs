import { Writable } from 'node:stream';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import type { Logger } from 'nestjs-pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { defaultEnvironment } from '../support/default-environment';

describe('platform logging (e2e)', () => {
  let moduleRef: TestingModule;
  let logger: Logger;
  const chunks: string[] = [];
  const originalEnvironment = { ...process.env };

  beforeAll(async () => {
    process.env = { ...originalEnvironment, ...defaultEnvironment };
    const { pinoRedaction } = (await import(
      '../../src/platform/logging/platform-logger.module'
    )) as typeof import('../../src/platform/logging/platform-logger.module');
    const { Logger: PinoNestLogger } = (await import(
      'nestjs-pino'
    )) as typeof import('nestjs-pino');
    const captureStream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });

    moduleRef = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot({
          pinoHttp: {
            level: 'info',
            redact: pinoRedaction,
            stream: captureStream,
          },
        }),
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    logger = app.get(PinoNestLogger);
  }, 30_000);

  afterAll(async () => {
    await moduleRef?.close();
    process.env = originalEnvironment;
  });

  it('When a request-shaped payload carrying secrets is logged through the real pino wiring, then the secrets never reach the log output', () => {
    const secretPassword = 'do-not-leak-password-42';
    const secretToken = 'do-not-leak-bearer-token-42';

    logger.log({
      event: 'auth.login.failure',
      password: secretPassword,
      req: {
        body: { password: secretPassword },
        headers: { authorization: `Bearer ${secretToken}` },
      },
    });

    const output = chunks.join('');
    expect(output).not.toContain(secretPassword);
    expect(output).not.toContain(secretToken);
    expect(output).toContain('[Redacted]');
  });
});

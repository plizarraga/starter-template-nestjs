import { randomUUID } from 'node:crypto';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';

export type TestEnvironment = {
  databaseUrl: string;
  redisNamespace: string;
  redisUrl: string;
  schema: string;
  stop(): Promise<void>;
  verifyIsolation(): Promise<boolean>;
};

export async function createTestEnvironment(): Promise<TestEnvironment> {
  const database = `test_${randomUUID().replaceAll('-', '')}`;
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  const redisNamespace = `test:${randomUUID()}:`;
  const postgres = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase(database)
    .start();
  let redis: Awaited<ReturnType<RedisContainer['start']>> | undefined;

  try {
    const startedRedis = await new RedisContainer('redis:8-alpine').start();
    redis = startedRedis;
    const schemaResult = await postgres.exec([
      'psql',
      '--username',
      'test',
      '--dbname',
      database,
      '--command',
      `CREATE SCHEMA ${schema}`,
    ]);
    const namespaceResult = await startedRedis.exec([
      'redis-cli',
      'SET',
      `${redisNamespace}isolation`,
      'ready',
    ]);

    if (schemaResult.exitCode !== 0 || namespaceResult.exitCode !== 0) {
      throw new Error('Unable to initialize isolated test dependencies');
    }

    return {
      databaseUrl: postgres.getConnectionUri(),
      redisNamespace,
      redisUrl: startedRedis.getConnectionUrl(),
      schema,
      async stop() {
        await Promise.all([postgres.stop(), startedRedis.stop()]);
      },
      async verifyIsolation() {
        const schemaResult = await postgres.exec([
          'psql',
          '--username',
          'test',
          '--dbname',
          database,
          '--tuples-only',
          '--no-align',
          '--command',
          `SELECT EXISTS (SELECT FROM pg_namespace WHERE nspname = '${schema}')`,
        ]);
        const namespaceResult = await startedRedis.exec([
          'redis-cli',
          'GET',
          `${redisNamespace}isolation`,
        ]);

        return (
          schemaResult.exitCode === 0 &&
          schemaResult.output.trim() === 't' &&
          namespaceResult.exitCode === 0 &&
          namespaceResult.output.trim() === 'ready'
        );
      },
    };
  } catch (error) {
    await Promise.all([postgres.stop(), redis?.stop()]);
    throw error;
  }
}

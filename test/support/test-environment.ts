import { randomUUID } from 'node:crypto';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

export type TestEnvironment = {
  databaseUrl: string;
  schema: string;
  stop(): Promise<void>;
  verifyIsolation(): Promise<boolean>;
};

export async function createTestEnvironment(): Promise<TestEnvironment> {
  const database = `test_${randomUUID().replaceAll('-', '')}`;
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  const postgres = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase(database)
    .start();

  try {
    const schemaResult = await postgres.exec([
      'psql',
      '--username',
      'test',
      '--dbname',
      database,
      '--command',
      `CREATE SCHEMA ${schema}`,
    ]);
    if (schemaResult.exitCode !== 0) {
      throw new Error('Unable to initialize an isolated PostgreSQL schema');
    }

    return {
      databaseUrl: postgres.getConnectionUri(),
      schema,
      async stop() {
        await postgres.stop();
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
        return schemaResult.exitCode === 0 && schemaResult.output.trim() === 't';
      },
    };
  } catch (error) {
    await postgres.stop();
    throw error;
  }
}

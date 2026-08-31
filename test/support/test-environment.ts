import { execFile as executeFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const execFile = promisify(executeFile);

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

    // Apply the committed migrations rather than creating tables by hand, so a
    // suite cannot pass against a shape the real database does not have. For
    // PostgreSQL, Prisma takes the target schema from the connection string.
    const migrationUrl = new URL(postgres.getConnectionUri());
    migrationUrl.searchParams.set('schema', schema);
    await execFile('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: migrationUrl.toString() },
    });

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
        return (
          schemaResult.exitCode === 0 && schemaResult.output.trim() === 't'
        );
      },
    };
  } catch (error) {
    await postgres.stop();
    throw error;
  }
}

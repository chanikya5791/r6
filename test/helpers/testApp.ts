import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Pool } from 'pg';
import { createApp } from '../../src/app';
import { loadConfig, type Config } from '../../src/config';
import { createPool, migrate } from '../../src/db';
import { ensureAdmin } from '../../src/seedAdmin';
import { UserRepository } from '../../src/userRepository';

export interface TestContext {
  app: ReturnType<typeof createApp>;
  config: Config;
  pool: Pool;
  container: StartedPostgreSqlContainer;
  stop: () => Promise<void>;
}

process.env.LOG_LEVEL = 'silent';

export async function startTestApp(): Promise<TestContext> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const config = loadConfig({
    DATABASE_URL: container.getConnectionUri(),
    JWT_SECRET: 'test-secret',
    ADMIN_EMAIL: 'admin@test.local',
    ADMIN_PASSWORD: 'Admin123!',
  });
  const pool = createPool(config.databaseUrl);
  await migrate(pool);
  const users = new UserRepository(pool);
  await ensureAdmin(users, config);
  const app = createApp({ users, config });
  return {
    app,
    config,
    pool,
    container,
    stop: async () => {
      await pool.end();
      await container.stop();
    },
  };
}

import { createApp } from './app';
import { loadConfig } from './config';
import { createPool, migrate } from './db';
import { log } from './lib/logger';
import { ensureAdmin } from './seedAdmin';
import { UserRepository } from './userRepository';

async function main() {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);
  await migrate(pool);
  const users = new UserRepository(pool);
  await ensureAdmin(users, config);

  const server = createApp({ users, config }).listen(config.port, () => {
    log.info('users-api listening', { port: config.port });
  });

  const shutdown = () => {
    log.info('shutting down');
    server.close(() => void pool.end().then(() => process.exit(0)));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  log.error('failed to start', { err: String(err?.stack ?? err) });
  process.exit(1);
});

import express from 'express';
import type { Config } from './config';
import { errorHandler, notFoundHandler } from './lib/errors';
import { authenticate } from './middleware/auth';
import { requestContext } from './middleware/requestContext';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import type { UserRepository } from './userRepository';

export interface AppDeps {
  users: UserRepository;
  config: Config;
}

export function createApp({ users, config }: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(requestContext);

  app.get('/health', async (_req, res) => {
    try {
      await users.ping();
      res.json({ status: 'ok', service: 'users-api', checks: { postgres: 'up' } });
    } catch {
      res.status(503).json({ status: 'error', service: 'users-api', checks: { postgres: 'down' } });
    }
  });

  app.use('/auth', authRouter(users, config));
  app.use('/users', authenticate(config.jwtSecret), usersRouter(users));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

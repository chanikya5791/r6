export interface Config {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  adminEmail: string;
  adminPassword: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 3001),
    databaseUrl: env.DATABASE_URL ?? 'postgres://shoplite:shoplite@localhost:5432/users',
    jwtSecret: env.JWT_SECRET ?? 'dev-secret-change-me',
    jwtExpiresIn: env.JWT_EXPIRES_IN ?? '1h',
    adminEmail: (env.ADMIN_EMAIL ?? 'admin@shoplite.local').toLowerCase(),
    adminPassword: env.ADMIN_PASSWORD ?? 'Admin123!',
  };
}

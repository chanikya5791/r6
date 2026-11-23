import bcrypt from 'bcryptjs';
import type { Config } from './config';
import { log } from './lib/logger';
import type { UserRepository } from './userRepository';

/** Creates the admin account from ADMIN_EMAIL / ADMIN_PASSWORD if it does not exist yet. */
export async function ensureAdmin(users: UserRepository, config: Config): Promise<void> {
  const existing = await users.findByEmail(config.adminEmail);
  if (existing) return;
  const passwordHash = await bcrypt.hash(config.adminPassword, 10);
  await users.create({ email: config.adminEmail, name: 'Administrator', passwordHash, role: 'admin' });
  log.info('admin user created', { email: config.adminEmail });
}

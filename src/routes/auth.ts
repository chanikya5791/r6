import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import type { Config } from '../config';
import { conflict, unauthorized } from '../lib/errors';
import { signToken } from '../middleware/auth';
import { publicUser, type UserRepository } from '../userRepository';

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  name: z.string().trim().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export function authRouter(users: UserRepository, config: Config): Router {
  const router = Router();

  router.post('/register', async (req, res) => {
    const body = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await users.create({ email: body.email, name: body.name, passwordHash });
    if (!user) throw conflict('A user with this email already exists');
    res.status(201).location(`/users/${user.id}`).json(publicUser(user));
  });

  router.post('/login', async (req, res) => {
    const body = loginSchema.parse(req.body);
    const user = await users.findByEmail(body.email);
    // Compare against a dummy hash when the user does not exist so timing does not leak which emails exist.
    const ok = await bcrypt.compare(body.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw unauthorized('Invalid email or password');
    const token = signToken(user, config.jwtSecret, config.jwtExpiresIn);
    res.json({ token, tokenType: 'Bearer', expiresIn: config.jwtExpiresIn, user: publicUser(user) });
  });

  return router;
}

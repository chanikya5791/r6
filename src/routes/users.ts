import { Router } from 'express';
import { z } from 'zod';
import { forbidden, notFound } from '../lib/errors';
import { paginationSchema } from '../lib/pagination';
import { requireRole } from '../middleware/auth';
import { publicUser, type UserRepository } from '../userRepository';

const idSchema = z.string().uuid();

export function usersRouter(users: UserRepository): Router {
  const router = Router();

  router.get('/me', async (req, res) => {
    const user = await users.findById(req.user!.id);
    if (!user) throw notFound('User not found');
    res.json(publicUser(user));
  });

  router.get('/', requireRole('admin'), async (req, res) => {
    const { page, limit } = paginationSchema.parse(req.query);
    const { items, total } = await users.list(page, limit);
    res.json({ items, total, page, limit });
  });

  router.get('/:id', async (req, res) => {
    const id = req.params.id;
    if (req.user!.role !== 'admin' && req.user!.id !== id) throw forbidden();
    if (!idSchema.safeParse(id).success) throw notFound('User not found');
    const user = await users.findById(id);
    if (!user) throw notFound('User not found');
    res.json(publicUser(user));
  });

  return router;
}

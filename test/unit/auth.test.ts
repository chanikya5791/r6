import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../src/lib/errors';
import { authenticate, requireRole, signToken } from '../../src/middleware/auth';

const SECRET = 'unit-secret';
const customer = { id: '6f1f1c1e-0000-4000-8000-000000000001', email: 'c@x.io', role: 'customer' as const };
const admin = { id: '6f1f1c1e-0000-4000-8000-000000000002', email: 'a@x.io', role: 'admin' as const };

function app() {
  const a = express();
  a.get('/me', authenticate(SECRET), (req, res) => res.json(req.user));
  a.get('/admin', authenticate(SECRET), requireRole('admin'), (_req, res) => res.json({ ok: true }));
  a.use(errorHandler);
  return a;
}

describe('signToken', () => {
  it('puts the user id in sub and role/email in the payload', () => {
    const token = signToken(customer, SECRET, '1h');
    const payload = jwt.verify(token, SECRET) as jwt.JwtPayload;
    expect(payload.sub).toBe(customer.id);
    expect(payload.role).toBe('customer');
    expect(payload.email).toBe(customer.email);
    expect(payload.iss).toBe('shoplite-users-api');
    expect(payload.exp! - payload.iat!).toBe(3600);
  });
});

describe('authenticate', () => {
  it('accepts a valid bearer token and exposes req.user', async () => {
    const res = await request(app()).get('/me').set('Authorization', `Bearer ${signToken(customer, SECRET, '1h')}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(customer);
  });

  it.each([
    ['no header', undefined],
    ['wrong scheme', 'Basic abc'],
    ['garbage token', 'Bearer not-a-jwt'],
    ['token signed with another secret', `Bearer ${signToken(customer, 'other', '1h')}`],
  ])('rejects %s with 401', async (_name, header) => {
    const req = request(app()).get('/me');
    if (header) req.set('Authorization', header);
    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('reports expired tokens', async () => {
    const token = jwt.sign({ email: 'c@x.io', role: 'customer' }, SECRET, { subject: customer.id, expiresIn: -10 });
    const res = await request(app()).get('/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Token expired');
  });

  it('rejects tokens with an unknown role', async () => {
    const token = jwt.sign({ email: 'c@x.io', role: 'root' }, SECRET, { subject: customer.id });
    const res = await request(app()).get('/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});

describe('requireRole', () => {
  it('lets admins through', async () => {
    const res = await request(app()).get('/admin').set('Authorization', `Bearer ${signToken(admin, SECRET, '1h')}`);
    expect(res.status).toBe(200);
  });

  it('returns 403 for customers', async () => {
    const res = await request(app()).get('/admin').set('Authorization', `Bearer ${signToken(customer, SECRET, '1h')}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

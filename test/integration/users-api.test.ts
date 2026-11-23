import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expectMatchesSpec } from '../helpers/openapi';
import { startTestApp, type TestContext } from '../helpers/testApp';

let ctx: TestContext;
let n = 0;
const uniqueEmail = () => `user${Date.now()}-${n++}@test.local`;

async function register(email = uniqueEmail(), password = 'Password1!', name = 'Test User') {
  const res = await request(ctx.app).post('/auth/register').send({ email, password, name });
  return { res, email, password };
}

async function login(email: string, password: string) {
  const res = await request(ctx.app).post('/auth/login').send({ email, password });
  return res.body.token as string;
}

beforeAll(async () => {
  ctx = await startTestApp();
});

afterAll(async () => {
  await ctx?.stop();
});

describe('GET /health', () => {
  it('reports postgres up', async () => {
    const res = await request(ctx.app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.checks.postgres).toBe('up');
    expectMatchesSpec(res, '/health', 'get');
  });

  it('sets an X-Request-Id header and echoes one that is sent', async () => {
    const res = await request(ctx.app).get('/health').set('X-Request-Id', 'abc-123');
    expect(res.headers['x-request-id']).toBe('abc-123');
  });
});

describe('POST /auth/register', () => {
  it('creates a customer and never returns the password hash', async () => {
    const { res, email } = await register();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email, name: 'Test User', role: 'customer' });
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.headers.location).toBe(`/users/${res.body.id}`);
    expectMatchesSpec(res, '/auth/register', 'post');
  });

  it('treats emails case-insensitively when detecting duplicates', async () => {
    const email = uniqueEmail();
    await register(email);
    const { res } = await register(email.toUpperCase());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expectMatchesSpec(res, '/auth/register', 'post');
  });

  it('returns field-level validation errors', async () => {
    const res = await request(ctx.app).post('/auth/register').send({ email: 'nope', password: '1', name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual(['email', 'name', 'password']);
    expectMatchesSpec(res, '/auth/register', 'post');
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(ctx.app).post('/auth/register').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('cannot be used to create an admin', async () => {
    const res = await request(ctx.app)
      .post('/auth/register')
      .send({ email: uniqueEmail(), password: 'Password1!', name: 'Sneaky', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('customer');
  });
});

describe('POST /auth/login', () => {
  it('returns a JWT that works on /users/me', async () => {
    const { email, password } = await register();
    const res = await request(ctx.app).post('/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.tokenType).toBe('Bearer');
    expectMatchesSpec(res, '/auth/login', 'post');

    const me = await request(ctx.app).get('/users/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(email);
    expectMatchesSpec(me, '/users/me', 'get');
  });

  it.each([
    ['wrong password', (e: string) => ({ email: e, password: 'WrongPass1!' })],
    ['unknown email', () => ({ email: 'ghost@test.local', password: 'Password1!' })],
  ])('rejects %s with the same 401 message', async (_name, body) => {
    const { email } = await register();
    const res = await request(ctx.app).post('/auth/login').send(body(email));
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
    expectMatchesSpec(res, '/auth/login', 'post');
  });

  it('logs in the seeded admin', async () => {
    const res = await request(ctx.app).post('/auth/login').send({ email: 'admin@test.local', password: 'Admin123!' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });
});

describe('GET /users (admin only)', () => {
  it('returns 401 without a token', async () => {
    const res = await request(ctx.app).get('/users');
    expect(res.status).toBe(401);
    expectMatchesSpec(res, '/users', 'get');
  });

  it('returns 403 for customers', async () => {
    const { email, password } = await register();
    const res = await request(ctx.app).get('/users').set('Authorization', `Bearer ${await login(email, password)}`);
    expect(res.status).toBe(403);
    expectMatchesSpec(res, '/users', 'get');
  });

  it('pages through users for admins', async () => {
    for (let i = 0; i < 3; i++) await register();
    const token = await login('admin@test.local', 'Admin123!');
    const page1 = await request(ctx.app).get('/users?page=1&limit=2').set('Authorization', `Bearer ${token}`);
    expect(page1.status).toBe(200);
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.total).toBeGreaterThanOrEqual(4);
    expectMatchesSpec(page1, '/users', 'get');

    const page2 = await request(ctx.app).get('/users?page=2&limit=2').set('Authorization', `Bearer ${token}`);
    const ids1 = page1.body.items.map((u: { id: string }) => u.id);
    for (const u of page2.body.items) expect(ids1).not.toContain(u.id);
  });

  it('rejects bad paging parameters', async () => {
    const token = await login('admin@test.local', 'Admin123!');
    const res = await request(ctx.app).get('/users?limit=500').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expectMatchesSpec(res, '/users', 'get');
  });
});

describe('GET /users/:id', () => {
  it('lets a user read themself but not others', async () => {
    const a = await register();
    const b = await register();
    const tokenA = await login(a.email, a.password);

    const self = await request(ctx.app).get(`/users/${a.res.body.id}`).set('Authorization', `Bearer ${tokenA}`);
    expect(self.status).toBe(200);
    expectMatchesSpec(self, '/users/{id}', 'get');

    const other = await request(ctx.app).get(`/users/${b.res.body.id}`).set('Authorization', `Bearer ${tokenA}`);
    expect(other.status).toBe(403);
    expectMatchesSpec(other, '/users/{id}', 'get');
  });

  it('returns 404 to admins for unknown or malformed ids', async () => {
    const token = await login('admin@test.local', 'Admin123!');
    for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      const res = await request(ctx.app).get(`/users/${id}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expectMatchesSpec(res, '/users/{id}', 'get');
    }
  });
});

describe('unknown routes', () => {
  it('return a JSON 404', async () => {
    const res = await request(ctx.app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

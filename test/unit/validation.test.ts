import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config';
import { paginationSchema } from '../../src/lib/pagination';
import { loginSchema, registerSchema } from '../../src/routes/auth';

describe('registerSchema', () => {
  it('normalises email and trims name', () => {
    const parsed = registerSchema.parse({ email: '  Alice@Example.COM ', password: 'password1', name: ' Alice ' });
    expect(parsed).toEqual({ email: 'alice@example.com', password: 'password1', name: 'Alice' });
  });

  it.each([
    [{ email: 'not-an-email', password: 'password1', name: 'A' }, 'email'],
    [{ email: 'a@b.io', password: 'short', name: 'A' }, 'password'],
    [{ email: 'a@b.io', password: 'x'.repeat(73), name: 'A' }, 'password'],
    [{ email: 'a@b.io', password: 'password1', name: '   ' }, 'name'],
    [{ email: 'a@b.io', password: 'password1' }, 'name'],
  ])('rejects %j (bad %s)', (input, field) => {
    const result = registerSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((i) => i.path[0])).toContain(field);
  });
});

describe('loginSchema', () => {
  it('requires a password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.io', password: '' }).success).toBe(false);
  });
});

describe('paginationSchema', () => {
  it('applies defaults', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, limit: 20 });
  });
  it('coerces query strings', () => {
    expect(paginationSchema.parse({ page: '3', limit: '5' })).toEqual({ page: 3, limit: 5 });
  });
  it.each([{ page: '0' }, { limit: '101' }, { limit: 'abc' }, { page: '1.5' }])('rejects %j', (q) => {
    expect(paginationSchema.safeParse(q).success).toBe(false);
  });
});

describe('loadConfig', () => {
  it('has development defaults', () => {
    const c = loadConfig({});
    expect(c.port).toBe(3001);
    expect(c.adminEmail).toBe('admin@shoplite.local');
  });
  it('lower-cases the admin email', () => {
    expect(loadConfig({ ADMIN_EMAIL: 'Root@Example.com' }).adminEmail).toBe('root@example.com');
  });
});

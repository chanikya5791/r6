import type { Pool } from 'pg';
import type { Role } from './middleware/auth';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface UserWithHash extends User {
  passwordHash: string;
}

interface Row {
  id: string;
  email: string;
  name: string;
  role: Role;
  password_hash: string;
  created_at: Date;
}

const toUser = (r: Row): UserWithHash => ({
  id: r.id,
  email: r.email,
  name: r.name,
  role: r.role,
  createdAt: r.created_at.toISOString(),
  passwordHash: r.password_hash,
});

export const publicUser = ({ passwordHash: _ignored, ...user }: UserWithHash): User => user;

export class UserRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: { email: string; name: string; passwordHash: string; role?: Role }): Promise<UserWithHash | null> {
    const { rows } = await this.pool.query<Row>(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING *`,
      [input.email, input.name, input.passwordHash, input.role ?? 'customer'],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<UserWithHash | null> {
    const { rows } = await this.pool.query<Row>('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findById(id: string): Promise<UserWithHash | null> {
    const { rows } = await this.pool.query<Row>('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async list(page: number, limit: number): Promise<{ items: User[]; total: number }> {
    const [{ rows }, count] = await Promise.all([
      this.pool.query<Row>('SELECT * FROM users ORDER BY created_at, email LIMIT $1 OFFSET $2', [limit, (page - 1) * limit]),
      this.pool.query<{ count: string }>('SELECT count(*) FROM users'),
    ]);
    return { items: rows.map((r) => publicUser(toUser(r))), total: Number(count.rows[0].count) };
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }
}

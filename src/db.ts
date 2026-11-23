import { Pool } from 'pg';

export const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS users (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     email TEXT NOT NULL UNIQUE,
     name TEXT NOT NULL,
     password_hash TEXT NOT NULL,
     role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
];

export function createPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl, max: 10 });
}

export async function migrate(pool: Pool): Promise<void> {
  for (const sql of MIGRATIONS) await pool.query(sql);
}

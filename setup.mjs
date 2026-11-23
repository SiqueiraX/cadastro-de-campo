import { neon } from '@neondatabase/serverless';
if (!process.env.DATABASE_URL || !process.env.ADMIN_PASSWORD) {
  throw new Error('Conecte o Neon (DATABASE_URL) e configure ADMIN_PASSWORD antes do deploy.');
}
const sql = neon(process.env.DATABASE_URL);
await sql`CREATE TABLE IF NOT EXISTS campo_registros (
  id uuid PRIMARY KEY, dados jsonb NOT NULL, fachada bytea, medidor bytea
)`;

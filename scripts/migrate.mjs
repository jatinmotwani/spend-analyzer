// Applies db/schema.sql. Runs automatically before `next build` (so every
// Vercel deploy keeps the schema current) and via `npm run db:migrate`.
import { readFile } from 'node:fs/promises';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const required = process.argv.includes('--required');

if (!url) {
  const msg = 'DATABASE_URL is not set, so skipping database migration.';
  if (required) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(`⚠ ${msg}`);
  process.exit(0);
}

const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
const statements = schema
  .split(/;\s*$/m)
  .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
  .filter(Boolean);

const host = new URL(url).hostname;
if (host === 'localhost' || host === '127.0.0.1') {
  const { default: postgres } = await import('postgres');
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  for (const s of statements) await sql.unsafe(s);
  await sql.end();
} else {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(url);
  for (const s of statements) await sql.query(s);
}
console.log(`✓ Database schema is up to date (${statements.length} statements).`);

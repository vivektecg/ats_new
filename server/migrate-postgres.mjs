import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL or POSTGRES_URL is required to run migrations.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSL || process.env.DATABASE_SSL
    ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED === 'true' }
    : undefined,
});

const migrationsDir = join(process.cwd(), 'database', 'migrations');
const allFiles = (await readdir(migrationsDir))
  .filter(file => file.endsWith('.sql'))
  .sort();

await pool.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    file_name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`);

const applied = await pool.query('SELECT file_name FROM schema_migrations');
const appliedFiles = new Set(applied.rows.map(row => row.file_name));

for (const file of allFiles) {
  if (appliedFiles.has(file)) {
    console.log(`Skipping ${file}`);
    continue;
  }

  const sql = await readFile(join(migrationsDir, file), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(file_name) VALUES ($1)', [file]);
    await client.query('COMMIT');
    console.log(`Applied ${file}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Failed ${file}`);
    throw error;
  } finally {
    client.release();
  }
}

await pool.end();
console.log('PostgreSQL migrations complete.');

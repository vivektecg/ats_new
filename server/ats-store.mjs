import { mkdir, readFile, writeFile } from 'node:fs/promises';
import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const STORAGE_MODE = process.env.ATS_STORAGE || (DATABASE_URL ? 'postgres' : 'json');
const USE_POSTGRES = STORAGE_MODE === 'postgres' && Boolean(DATABASE_URL);
const ALLOW_JSON_STORAGE_IN_PRODUCTION = process.env.ALLOW_JSON_STORAGE_IN_PRODUCTION === 'true';

let pool;
let initialized;

function ensureSafeStorageMode() {
  const isProductionRuntime = process.env.NODE_ENV === 'production';
  if (isProductionRuntime && !USE_POSTGRES && !ALLOW_JSON_STORAGE_IN_PRODUCTION) {
    throw new Error(
      'Refusing to start the ATS API in production without PostgreSQL. ' +
      'Set DATABASE_URL and ATS_STORAGE=postgres, or explicitly set ALLOW_JSON_STORAGE_IN_PRODUCTION=true ' +
      'if you accept ephemeral JSON-file storage.',
    );
  }
}

function sslConfig() {
  if (!process.env.PGSSL && !process.env.DATABASE_SSL) return undefined;
  const rejectUnauthorized = process.env.PGSSL_REJECT_UNAUTHORIZED === 'true';
  return { rejectUnauthorized };
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: sslConfig(),
      max: Number(process.env.PGPOOL_MAX || 10),
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30_000),
      connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 10_000),
    });
  }
  return pool;
}

export function atsStorageMode() {
  return USE_POSTGRES ? 'postgres' : 'json';
}

async function ensurePostgresSchema() {
  if (!USE_POSTGRES) return;
  if (!initialized) {
    initialized = getPool().query(`
      CREATE TABLE IF NOT EXISTS ats_records (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (collection, id)
      );

      CREATE INDEX IF NOT EXISTS idx_ats_records_collection_updated
        ON ats_records(collection, updated_at DESC);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_ats_submissions_candidate_job_unique
        ON ats_records ((data->>'candidateId'), (data->>'jobId'))
        WHERE collection = 'submissions'
          AND data ? 'candidateId'
          AND data ? 'jobId';

      CREATE INDEX IF NOT EXISTS idx_ats_candidates_email
        ON ats_records ((LOWER(data->>'email')))
        WHERE collection = 'candidates'
          AND data ? 'email';

      CREATE INDEX IF NOT EXISTS idx_ats_candidates_phone
        ON ats_records ((regexp_replace(data->>'phone', '\\D', '', 'g')))
        WHERE collection = 'candidates'
          AND data ? 'phone';

      CREATE INDEX IF NOT EXISTS idx_ats_candidates_status
        ON ats_records ((data->>'status'))
        WHERE collection = 'candidates'
          AND data ? 'status';

      CREATE INDEX IF NOT EXISTS idx_ats_jobs_status
        ON ats_records ((data->>'status'))
        WHERE collection = 'jobs'
          AND data ? 'status';

      CREATE INDEX IF NOT EXISTS idx_ats_jobs_client_id
        ON ats_records ((data->>'clientId'))
        WHERE collection = 'jobs'
          AND data ? 'clientId';

      CREATE INDEX IF NOT EXISTS idx_ats_jobs_external_id
        ON ats_records ((data->>'externalJobId'))
        WHERE collection = 'jobs'
          AND data ? 'externalJobId';

      CREATE INDEX IF NOT EXISTS idx_ats_submissions_candidate_id
        ON ats_records ((data->>'candidateId'))
        WHERE collection = 'submissions'
          AND data ? 'candidateId';

      CREATE INDEX IF NOT EXISTS idx_ats_submissions_job_id
        ON ats_records ((data->>'jobId'))
        WHERE collection = 'submissions'
          AND data ? 'jobId';

      CREATE INDEX IF NOT EXISTS idx_ats_submissions_status
        ON ats_records ((data->>'status'))
        WHERE collection = 'submissions'
          AND data ? 'status';
    `);
  }
  await initialized;
}

function rowId(row, index = 0) {
  return String(row?.id || `record-${Date.now()}-${index}`);
}

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

function isUniqueViolation(error) {
  return error?.code === '23505';
}

export function createAtsStore({ collections, dataDir, jsonFile }) {
  ensureSafeStorageMode();
  const collectionSet = new Set(collections);

  async function readJsonDb() {
    try {
      const raw = await readFile(jsonFile, 'utf8');
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
      return {};
    }
  }

  async function writeJsonDb(db) {
    await mkdir(dataDir, { recursive: true });
    await writeFile(jsonFile, `${JSON.stringify(db, null, 2)}\n`);
  }

  async function readCollection(collection) {
    if (!collectionSet.has(collection)) return [];
    if (!USE_POSTGRES) {
      const db = await readJsonDb();
      return normalizeRows(db[collection]);
    }

    await ensurePostgresSchema();
    const result = await getPool().query(
      'SELECT data FROM ats_records WHERE collection = $1 ORDER BY updated_at DESC, created_at DESC',
      [collection],
    );
    return result.rows.map(row => row.data);
  }

  async function readDb() {
    if (!USE_POSTGRES) return readJsonDb();

    await ensurePostgresSchema();
    const result = await getPool().query(
      'SELECT collection, data FROM ats_records ORDER BY collection, updated_at DESC, created_at DESC',
    );
    const db = {};
    result.rows.forEach(row => {
      if (!collectionSet.has(row.collection)) return;
      db[row.collection] ??= [];
      db[row.collection].push(row.data);
    });
    return db;
  }

  async function replaceCollection(collection, rows) {
    const normalized = normalizeRows(rows);
    if (!USE_POSTGRES) {
      const db = await readJsonDb();
      db[collection] = normalized;
      await writeJsonDb(db);
      return normalized;
    }

    await ensurePostgresSchema();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM ats_records WHERE collection = $1', [collection]);
      for (const [index, row] of normalized.entries()) {
        await client.query(
          `INSERT INTO ats_records(collection, id, data, created_at, updated_at)
           VALUES ($1, $2, $3::jsonb, NOW(), NOW())`,
          [collection, rowId(row, index), JSON.stringify(row)],
        );
      }
      await client.query('COMMIT');
      return normalized;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function writeDb(db) {
    if (!USE_POSTGRES) return writeJsonDb(db);

    await ensurePostgresSchema();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      for (const collection of collectionSet) {
        if (!Object.prototype.hasOwnProperty.call(db, collection)) continue;
        const rows = normalizeRows(db[collection]);
        await client.query('DELETE FROM ats_records WHERE collection = $1', [collection]);
        for (const [index, row] of rows.entries()) {
          await client.query(
            `INSERT INTO ats_records(collection, id, data, created_at, updated_at)
             VALUES ($1, $2, $3::jsonb, NOW(), NOW())`,
            [collection, rowId(row, index), JSON.stringify(row)],
          );
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function upsertRows(collection, rows) {
    const normalized = normalizeRows(rows);
    if (!USE_POSTGRES) {
      const current = await readCollection(collection);
      const next = [...current];
      normalized.forEach(row => {
        const id = rowId(row);
        const index = next.findIndex(item => String(item.id) === id);
        if (index >= 0) next[index] = { ...next[index], ...row, id };
        else next.unshift({ ...row, id });
      });
      await replaceCollection(collection, next);
      return next;
    }

    await ensurePostgresSchema();
    for (const [index, row] of normalized.entries()) {
      const id = rowId(row, index);
      await getPool().query(
        `INSERT INTO ats_records(collection, id, data, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, NOW(), NOW())
         ON CONFLICT (collection, id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [collection, id, JSON.stringify({ ...row, id })],
      );
    }
    return readCollection(collection);
  }

  async function patchRow(collection, id, row) {
    if (!USE_POSTGRES) {
      const current = await readCollection(collection);
      const next = current.map(item => String(item.id) === String(id) ? row : item);
      await replaceCollection(collection, next);
      return { rows: next, row: next.find(item => String(item.id) === String(id)) };
    }

    await ensurePostgresSchema();
    const result = await getPool().query(
      `UPDATE ats_records
       SET data = $3::jsonb, updated_at = NOW()
       WHERE collection = $1 AND id = $2
       RETURNING data`,
      [collection, String(id), JSON.stringify({ ...row, id: String(id) })],
    );
    return { rows: await readCollection(collection), row: result.rows[0]?.data };
  }

  async function findSubmissionByCandidateJob(candidateId, jobId) {
    if (!candidateId || !jobId) return null;
    if (!USE_POSTGRES) {
      const submissions = await readCollection('submissions');
      return submissions.find(row => row.candidateId === candidateId && row.jobId === jobId) || null;
    }

    await ensurePostgresSchema();
    const result = await getPool().query(
      `SELECT data FROM ats_records
       WHERE collection = 'submissions'
         AND data->>'candidateId' = $1
         AND data->>'jobId' = $2
       LIMIT 1`,
      [candidateId, jobId],
    );
    return result.rows[0]?.data || null;
  }

  async function insertSubmission(row) {
    if (!USE_POSTGRES) {
      const current = await readCollection('submissions');
      const duplicate = current.find(item => item.candidateId === row.candidateId && item.jobId === row.jobId);
      if (duplicate) return { duplicate, rows: current };
      const rows = [row, ...current.filter(item => item.id !== row.id)];
      await replaceCollection('submissions', rows);
      return { row, rows };
    }

    await ensurePostgresSchema();
    try {
      await getPool().query(
        `INSERT INTO ats_records(collection, id, data, created_at, updated_at)
         VALUES ('submissions', $1, $2::jsonb, NOW(), NOW())`,
        [rowId(row), JSON.stringify(row)],
      );
      return { row, rows: await readCollection('submissions') };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return {
        duplicate: await findSubmissionByCandidateJob(row.candidateId, row.jobId),
        rows: await readCollection('submissions'),
      };
    }
  }

  return {
    mode: atsStorageMode(),
    readDb,
    writeDb,
    readCollection,
    replaceCollection,
    upsertRows,
    patchRow,
    insertSubmission,
  };
}

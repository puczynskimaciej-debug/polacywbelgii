// Read-only PostgreSQL snapshot for a staged D1 migration. Never commit output.
const { Pool } = require('pg');
const { mkdir, open, rename } = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const TABLES = ['ads_settings', 'ad_orders', 'ad_rate_limits', 'cms_users', 'cms_sessions', 'cms_login_limits', 'cms_audit'];
async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.NETLIFY_DB_URL;
  if (!connectionString) throw new Error('DATABASE_URL or NETLIFY_DB_URL is required');
  const directory = path.resolve(__dirname, '../cloudflare-export');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const target = path.join(directory, 'snapshot.json');
  const temporary = path.join(directory, `snapshot-${randomUUID()}.tmp`);
  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const snapshot = { format: 1, exportedAt: new Date().toISOString(), tables: {} };
    for (const table of TABLES) {
      const { rows } = await client.query(`SELECT * FROM ${table}`);
      snapshot.tables[table] = rows;
    }
    await client.query('COMMIT');
    const file = await open(temporary, 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(snapshot)); } finally { await file.close(); }
    await rename(temporary, target);
    console.log(`Snapshot written to ${target}`);
    for (const table of TABLES) console.log(`${table}: ${snapshot.tables[table].length} rows`);
    console.log('Contains password hashes, sessions and customer data. Keep it private.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

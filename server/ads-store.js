const { Pool } = require('pg');
const { getConnectionString } = require('@netlify/database');
const { defaults } = require('./ads-domain');
let pool;
let poolConnectionString;
function databaseConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try { return getConnectionString(); } catch { return undefined; }
}
function database() {
  const connectionString = databaseConnectionString();
  if (!connectionString) throw new Error('Database connection is not configured');
  if (!pool || poolConnectionString !== connectionString) {
    if (pool) pool.end().catch(() => {});
    poolConnectionString = connectionString;
    pool = new Pool({ connectionString, max: 3, connectionTimeoutMillis: 8000, idleTimeoutMillis: 10000 });
  }
  return pool;
}
async function transaction(work) {
  const client = await database().connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '12s'");
    await client.query('INSERT INTO ads_settings(id,data) VALUES(1,$1) ON CONFLICT DO NOTHING', [defaults()]);
    const { rows: [settings] } = await client.query('SELECT data,version FROM ads_settings WHERE id=1 FOR UPDATE');
    const result = await work(client, settings);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function settings() {
  const result = await database().query('SELECT data,version FROM ads_settings WHERE id=1');
  return result.rows[0] || { data: defaults(), version: 0 };
}
async function orders(client = database(), includeImages = true) { return (await client.query(`SELECT ${includeImages ? 'data' : "data - 'image'"} AS data FROM ad_orders ORDER BY created_at DESC`)).rows.map(row => row.data); }
async function order(id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '')) return null;
  return (await database().query('SELECT data FROM ad_orders WHERE id=$1', [id])).rows[0]?.data;
}
module.exports = { database, databaseConnectionString, transaction, settings, orders, order };

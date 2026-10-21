// Imports a private snapshot through the D1 query API. Dry-run by default.
// --apply only inserts missing rows. Existing D1 rows are never overwritten.
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const DATABASE_ID = 'be9435a1-b3ff-41dc-b70d-6f79f768d887';
const COLUMNS = {
  ads_settings: ['id', 'data', 'version'],
  ad_orders: ['id', 'data', 'created_at'],
  ad_rate_limits: ['key', 'started_at', 'attempts'],
  cms_users: ['id', 'email', 'name', 'password_hash', 'role', 'active', 'must_change_password', 'version', 'created_at'],
  cms_login_limits: ['key', 'started_at', 'attempts'],
  cms_audit: ['id', 'actor_id', 'action', 'target', 'created_at']
};

function parameter(value) {
  if (value === null) return null;
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
const same = (left, right) => JSON.stringify(parameter(left)) === JSON.stringify(parameter(right));

async function main() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required');
  const file = path.resolve(__dirname, '../cloudflare-export/snapshot.json');
  const snapshot = JSON.parse(await readFile(file, 'utf8'));
  if (snapshot.format !== 1 || !snapshot.tables || Object.keys(COLUMNS).some(table => !Array.isArray(snapshot.tables[table]))) throw new Error('Unsupported or incomplete snapshot');
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/d1/database/${DATABASE_ID}/query`;
  async function query(sql, params = []) {
    const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params }) });
    const data = await response.json();
    if (!response.ok || !data.success || !data.result?.[0]?.success) throw new Error(`D1 query failed: ${data.errors?.[0]?.message || response.status}`);
    return data.result[0].results || [];
  }
  const apply = process.argv.includes('--apply');
  let conflicts = 0;
  for (const [table, columns] of Object.entries(COLUMNS)) {
    const key = table === 'cms_audit' || table === 'ads_settings' ? 'id' : table === 'cms_users' || table === 'ad_orders' ? 'id' : 'key';
    const counts = { source: snapshot.tables[table].length, missing: 0, identical: 0, conflict: 0, inserted: 0 };
    for (const row of snapshot.tables[table]) {
      if (columns.some(column => !Object.hasOwn(row, column))) throw new Error(`Missing ${table} column in snapshot`);
      const existing = (await query(`SELECT ${columns.join(',')} FROM ${table} WHERE ${key}=?`, [parameter(row[key])]))[0];
      if (existing) {
        if (columns.every(column => same(row[column], existing[column]))) counts.identical++;
        else counts.conflict++;
        continue;
      }
      if (table === 'cms_users' && (await query('SELECT id FROM cms_users WHERE email=?', [row.email])).length) { counts.conflict++; continue; }
      if (table === 'cms_audit' && row.actor_id && !(await query('SELECT id FROM cms_users WHERE id=?', [row.actor_id])).length) {
        counts.conflict++;
        continue;
      }
      counts.missing++;
      if (!apply) continue;
      const params = [];
      const values = columns.map(column => {
        if (row[column] === null) return 'NULL';
        params.push(parameter(row[column]));
        return '?';
      });
      await query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${values.join(',')})`, params);
      counts.inserted++;
    }
    conflicts += counts.conflict;
    console.log(`${table}: ${JSON.stringify(counts)}`);
  }
  console.log(`cms_sessions: ${snapshot.tables.cms_sessions.length} preserved in private snapshot; not restored across origins and password resets`);
  if (!apply) console.log('Dry-run only. Use --apply after reviewing counts.');
  if (conflicts) { console.error(`${conflicts} conflicting rows require manual review; existing D1 data was preserved.`); process.exitCode = 2; }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

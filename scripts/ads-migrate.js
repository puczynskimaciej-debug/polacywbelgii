const fs = require('node:fs');
const { database } = require('../server/ads-store');
async function main() {
  const pool = database();
  try { await pool.query(fs.readFileSync(require.resolve('../deploy/ads.sql'), 'utf8')); console.log('Advertising schema ready.'); }
  finally { await pool.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

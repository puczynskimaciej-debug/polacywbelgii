const fs = require('node:fs');
const { database } = require('../server/ads-store');
async function main() {
  const pool = database();
  try { await pool.query(fs.readFileSync(require.resolve('../deploy/cms.sql'), 'utf8')); console.log('Tabele kont i sesji CMS są gotowe.'); }
  finally { await pool.end(); }
}
main().catch(error => { console.error(error.code || error.name); process.exitCode = 1; });

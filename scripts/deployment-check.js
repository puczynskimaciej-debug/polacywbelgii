const { readiness } = require('../server/deployment');
const { database } = require('../server/ads-store');
async function main() {
  try {
    const result = await readiness();
    console.log(JSON.stringify(result, null, 2));
    if (!result.ready) process.exitCode = 1;
  } finally {
    if (process.env.DATABASE_URL || process.env.NETLIFY_DB_URL) await database().end();
  }
}
main().catch(error => { console.error('Deployment check failed:', error.code || error.name); process.exitCode = 1; });

const { database, databaseConnectionString } = require('./ads-store');
const REQUIRED_TABLES = ['ads_settings', 'ad_orders', 'ad_rate_limits', 'cms_users', 'cms_sessions', 'cms_login_limits', 'cms_audit'];
async function readiness() {
  const checks = {
    databaseConfigured: Boolean(databaseConnectionString()),
    originConfigured: false,
    publishingConfigured: Boolean(process.env.CMS_GITHUB_TOKEN),
    databaseReachable: false,
    migrationsApplied: false,
    administratorExists: false
  };
  try {
    const origin = new URL(process.env.CMS_ORIGIN);
    checks.originConfigured = origin.origin === process.env.CMS_ORIGIN && (origin.protocol === 'https:' || (origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname)));
  } catch { /* Missing or invalid configuration is reported as false. */ }
  if (checks.databaseConfigured) {
    try {
      const { rows } = await database().query('SELECT name, to_regclass(name) IS NOT NULL AS present FROM unnest($1::text[]) AS name', [REQUIRED_TABLES]);
      checks.databaseReachable = true;
      checks.migrationsApplied = rows.every(row => row.present);
      if (checks.migrationsApplied) {
        const { rows: [row] } = await database().query("SELECT EXISTS(SELECT 1 FROM cms_users WHERE active=true AND role='admin') AS present");
        checks.administratorExists = row.present;
      }
    } catch { /* Do not emit database addresses, credentials or provider errors. */ }
  }
  return { ready: Object.values(checks).every(Boolean), checks };
}
module.exports = { readiness };

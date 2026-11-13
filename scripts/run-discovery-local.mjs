import { openLocalDb } from '../agent/local-db.mjs';
import { localGeminiKey } from '../agent/gemini.mjs';
import { runDiscovery } from '../cloudflare/discovery.mjs';

const kind = process.argv[2];
if (!['article','event'].includes(kind) || !process.argv.includes('--free-tier-confirmed')) throw new Error('Usage: node scripts/run-discovery-local.mjs <article|event> --free-tier-confirmed');
const key = localGeminiKey();
if (!key) throw new Error('GEMINI_API_KEY missing in agent/.dev.vars');
const sqlite = openLocalDb();
const prepare = (sql,values=[]) => ({ bind(...params) { return prepare(sql,params); }, async first() { return sqlite.prepare(sql).get(...values) || null; }, async all() { return {results:sqlite.prepare(sql).all(...values)}; }, async run() { const result=sqlite.prepare(sql).run(...values); return {meta:{changes:result.changes}}; } });
const DB = { prepare, async batch(statements) { sqlite.exec('BEGIN'); try { const output=[]; for(const statement of statements) output.push(await statement.run()); sqlite.exec('COMMIT'); return output; } catch(error) { sqlite.exec('ROLLBACK'); throw error; } } };
try {
  const result=await runDiscovery(kind,{DB,AI_AUTOMATION_ENABLED:'1',GEMINI_FREE_TIER_CONFIRMED:'1',GEMINI_API_KEY:key});
  console.log(JSON.stringify({kind,status:result.status,found:result.found || 0,created:result.created || 0,duplicates:result.duplicates || 0,errors:(result.errors || []).map(error=>({sourceId:error.sourceId,code:error.code}))}));
} finally { sqlite.close(); }

import { webcrypto } from 'node:crypto';
import fs from 'node:fs';
import { openLocalDb } from '../agent/local-db.mjs';
import { localGeminiKey } from '../agent/gemini.mjs';
import { processChatJobs } from '../cloudflare/ai-chat-worker.mjs';

globalThis.crypto ??= webcrypto;
if(!/^GEMINI_FREE_TIER_CONFIRMED=1$/m.test(fs.readFileSync(new URL('../.dev.vars',import.meta.url),'utf8')))throw new Error('Confirm the local Gemini Free Tier project in .dev.vars');
const sqlite=openLocalDb();
const prepare=(sql,values=[])=>({bind(...next){return prepare(sql,next);},async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){const result=sqlite.prepare(sql).run(...values);return {meta:{changes:result.changes}};}});
const DB={prepare,async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
try{
  const result=await processChatJobs({DB,GEMINI_API_KEY:localGeminiKey(),GEMINI_FREE_TIER_CONFIRMED:'1'});
  console.log(JSON.stringify(result));
  if(result.status==='failed')process.exitCode=1;
}finally{sqlite.close();}

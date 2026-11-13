import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprint } from './core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function localD1Path() {
  const directory = path.join(root,'.local','wrangler','v3','d1','miniflare-D1DatabaseObject');
  if (!fs.existsSync(directory)) throw new Error('Local D1 is missing; run npm run local:d1:setup');
  const files = fs.readdirSync(directory).filter(name => /^[a-f0-9]{64}\.sqlite$/.test(name));
  if (files.length !== 1) throw new Error(`Expected one local D1 database; found ${files.length}`);
  return path.join(directory,files[0]);
}
export function openLocalDb(filename) {
  const usingD1 = filename === undefined;
  filename ||= localD1Path();
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA busy_timeout=5000');
  if (!usingD1) {
    db.exec(fs.readFileSync(path.join(root, 'agent', 'migrations', '001_agent.sql'), 'utf8'));
    db.exec(fs.readFileSync(path.join(root, 'agent', 'migrations', '002_editorial.sql'), 'utf8'));
    db.exec(fs.readFileSync(path.join(root, 'agent', 'migrations', '003_content.sql'), 'utf8'));
    db.exec(fs.readFileSync(path.join(root, 'agent', 'migrations', '004_discovery.sql'), 'utf8'));
    db.exec(fs.readFileSync(path.join(root, 'agent', 'migrations', '005_chat.sql'), 'utf8'));
  } else if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='ai_editorial'").get()) throw new Error('Local D1 migrations are missing');
  return db;
}
export function loadLocalState(db, sources = []) {
  const items = db.prepare('SELECT payload_json FROM ai_items ORDER BY fetched_at').all().map(row => JSON.parse(row.payload_json));
  const drafts = db.prepare('SELECT c.id,e.status FROM ai_candidates c JOIN ai_editorial e ON e.candidate_id=c.id').all();
  const runs = db.prepare('SELECT started_at,found,created,duplicates,rejected,errors_json FROM ai_runs ORDER BY started_at').all().map(row => ({ at: row.started_at, found: row.found, created: row.created, duplicates: row.duplicates, rejected: row.rejected, errors: JSON.parse(row.errors_json) }));
  return { items, drafts, runs, sources };
}
export function syncLocalState(db, state) {
  db.exec('BEGIN');
  try {
    const source = db.prepare('INSERT OR IGNORE INTO ai_sources(id,url,type,language,region,interval_hours,priority,active) VALUES(?,?,?,?,?,?,?,?)');
    for (const row of state.sources || []) source.run(row.id, row.url, row.type, row.language, row.region, row.intervalHours, row.priority, Number(row.active));
    const item = db.prepare('INSERT OR IGNORE INTO ai_items(id,source_id,external_id,canonical_url,kind,title,summary,published_at,fetched_at,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?)');
    for (const row of state.items || []) item.run(fingerprint(`${row.sourceId}:${row.externalId || row.id}`).slice(0, 20), row.sourceId, row.externalId || row.id, row.canonicalUrl, row.kind, row.title, row.summary || '', row.publishedAt || null, row.fetchedAt, JSON.stringify(row));
    const draft = db.prepare('INSERT OR IGNORE INTO ai_candidates(id,item_id,kind,status,title,description,body,category,region,tags_json,sources_json,verification_json,event_json,ai_generated,cms_path,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    for (const row of state.drafts || []) draft.run(row.id, null, row.kind, row.status, row.title, row.description, row.body, row.category, row.region, JSON.stringify(row.tags || []), JSON.stringify(row.sources || []), JSON.stringify(row.verification || {}), row.event ? JSON.stringify(row.event) : null, Number(row.aiGenerated), row.cmsPath || null, row.createdAt, row.updatedAt);
    const editorial = db.prepare('INSERT OR IGNORE INTO ai_editorial(candidate_id,status,owner_kind,owner_id,proposed_publish_at,updated_at) VALUES(?,?,?,?,?,?)');
    for (const row of state.drafts || []) editorial.run(row.id, row.status === 'pending_review' ? 'pending_review' : 'draft', 'agent', 'agent', row.proposedPublishAt || null, row.updatedAt);
    const run = db.prepare('INSERT OR IGNORE INTO ai_runs(id,started_at,finished_at,found,created,duplicates,rejected,errors_json,status) VALUES(?,?,?,?,?,?,?,?,?)');
    for (const row of state.runs || []) run.run(fingerprint(row.at).slice(0, 20), row.at, row.at, row.found, row.created, row.duplicates, row.rejected, JSON.stringify(row.errors || []), 'completed');
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fixture = process.argv.includes('--fixture');
  const statePath = path.join(root, '.local', 'agent', fixture ? 'fixture-state.json' : 'state.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const db = openLocalDb(fixture ? ':memory:' : undefined);
  syncLocalState(db, state);
  console.log(JSON.stringify({ candidates: db.prepare('SELECT COUNT(*) AS n FROM ai_candidates').get().n, items: db.prepare('SELECT COUNT(*) AS n FROM ai_items').get().n, runs: db.prepare('SELECT COUNT(*) AS n FROM ai_runs').get().n }));
  db.close();
}

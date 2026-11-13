import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalUrl, fingerprint, verifyItem } from './core.mjs';
import { openLocalDb, syncLocalState } from './local-db.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidencePath = path.resolve(root,process.argv[2] || '');
const evidenceDir = path.join(root,'agent','evidence') + path.sep;
if (!evidencePath.startsWith(evidenceDir) || !evidencePath.endsWith('.json')) throw new Error('Use a JSON file from agent/evidence');
const item = JSON.parse(await fs.readFile(evidencePath,'utf8'));
const sources = JSON.parse(await fs.readFile(path.join(root,'agent','sources.json'),'utf8'));
if (!sources.some(source => source.id === item.sourceId && source.official) || !item.official || !['gov.pl','www.gov.pl','rjv.fgov.be','www.rjv.fgov.be'].includes(new URL(item.url).hostname)) throw new Error('Official source required');
const now = new Date();
const verification = verifyItem(item,now);
if (verification.status !== 'verified') throw new Error(`Evidence not verified: ${verification.issues.join(', ')}`);
const id = fingerprint(`${item.sourceId}:${item.externalId || item.id}`).slice(0,20);
const statePath = path.join(root,'.local','agent','state.json');
const state = JSON.parse(await fs.readFile(statePath,'utf8'));
state.sources = sources;
state.items ||= [];
const storedItem = { ...item, canonicalUrl:canonicalUrl(item.url), verification, fetchedAt:now.toISOString() };
const existingIndex = state.items.findIndex(existing => existing.sourceId === item.sourceId && existing.externalId === (item.externalId || item.id));
if (existingIndex === -1) state.items.push(storedItem);
else state.items[existingIndex] = storedItem;
const db = openLocalDb();
try {
  syncLocalState(db,state);
  db.prepare('UPDATE ai_items SET title=?,summary=?,fetched_at=?,payload_json=? WHERE id=?').run(item.title,item.summary || '',storedItem.fetchedAt,JSON.stringify(storedItem),id);
} finally { db.close(); }
const temp = `${statePath}.${process.pid}.tmp`;
await fs.writeFile(temp,JSON.stringify(state,null,2)+'\n');
await fs.rename(temp,statePath);
console.log(JSON.stringify({ itemId:id,verification:verification.status,source:item.url }));

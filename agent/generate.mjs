import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import cms from '../server/cms-content.js';
import { generateGeminiArticle } from './gemini.mjs';
import { fingerprint } from './core.mjs';
import { defaultEditorialConfig, proposeSlot, validateEditorialConfig } from './editorial.mjs';
import { openLocalDb, syncLocalState } from './local-db.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const id = process.argv[2];
if (!/^[a-f0-9]{20}$/.test(id || '')) throw new Error('Usage: node agent/generate.mjs <verified-item-id>');
const settingsDb = openLocalDb();
let editorialConfig;
let pendingCount;
let reservations;
let item;
try {
  editorialConfig = validateEditorialConfig(JSON.parse(settingsDb.prepare("SELECT value_json FROM ai_config WHERE key='editorial'").get()?.value_json || JSON.stringify(defaultEditorialConfig)));
  pendingCount = settingsDb.prepare("SELECT count(*) AS n FROM ai_editorial WHERE status='pending_review'").get().n;
  reservations = settingsDb.prepare("SELECT status,scheduled_at,proposed_publish_at FROM ai_editorial WHERE status IN ('draft','pending_review','scheduled','published')").all().map(row => ({ status:row.status,scheduledAt:row.scheduled_at,proposedPublishAt:row.proposed_publish_at }));
  const payload = settingsDb.prepare('SELECT payload_json FROM ai_items WHERE id=?').get(id)?.payload_json;
  item = payload ? JSON.parse(payload) : null;
}
finally { settingsDb.close(); }
if (pendingCount >= editorialConfig.maxPending) throw new Error('Editorial review queue is full');
if (!item || item.verification?.status !== 'verified' || !item.official || !item.claims?.length) throw new Error('Official verified item with claims is required');
const sources = [...new Set(item.claims.flatMap(claim => claim.sourceUrls || []))].map(url => ({ url }));
const claims = item.claims.map(claim => ({ text: claim.text, sourceUrl: claim.sourceUrls[0], ...(claim.statistic ? { year: claim.year, definition: claim.definition, unit: claim.unit } : {}) }));
const result = await generateGeminiArticle({ evidence: { topic: item.title, summary: item.summary, sources, claims }, retries: 0, maxOutputTokens: 3000 });
if (!sources.every(source => result.article.body.includes(source.url))) throw new Error('Generated article lacks source links');
await fs.mkdir(path.join(root,'.local','agent'),{ recursive:true });
await fs.writeFile(path.join(root,'.local','agent','gemini-last-response.json'),JSON.stringify(result,null,2)+'\n');
const slug = result.article.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
const front = { title: result.article.title, date: new Date().toISOString(), category: item.category, description: result.article.description, region: item.region, contentType: 'article' };
const markdown = `---\n${yaml.dump(front, { lineWidth: -1 })}---\n${result.article.body.trim()}\n`;
cms.validateContent(`src/content/articles/${slug}.md`, Buffer.from(markdown).toString('base64'));
const file = path.join(root, '.local', 'drafts', `${slug}.md`);
await fs.mkdir(path.dirname(file), { recursive: true });
await fs.writeFile(file, markdown, { flag: 'wx' });
const now = new Date().toISOString();
const draftId = fingerprint(`gemini:${id}`).slice(0, 20);
const db = openLocalDb();
try {
  if (db.prepare('SELECT 1 FROM ai_candidates WHERE id=?').get(draftId)) throw new Error('Article already generated');
  const draft = { id: draftId, kind: 'article', status: 'pending_review', aiGenerated: true, title: front.title, description: front.description, body: result.article.body, category: front.category, region: front.region, tags: [], createdAt: now, updatedAt: now, proposedPublishAt: proposeSlot(reservations,editorialConfig), sources: sources.map(source => ({ ...source, fetchedAt: now })), verification: { status: 'needs_review', issues: ['AI-generated text requires claim-by-claim editorial review'], checkedAt: now }, cmsPath: null, localPath: `.local/drafts/${slug}.md`, model: result.model, usage: result.usage };
  syncLocalState(db,{ sources: [], items: [], drafts: [draft], runs: [] });
} finally { db.close(); }
console.log(JSON.stringify({ localPath: `.local/drafts/${slug}.md`, model: result.model, usage: result.usage, status: 'pending_review' }));

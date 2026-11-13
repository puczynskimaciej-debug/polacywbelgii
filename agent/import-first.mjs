import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import cms from '../server/cms-content.js';
import { fingerprint } from './core.mjs';
import { proposeSlot } from './editorial.mjs';
import { openLocalDb, syncLocalState } from './local-db.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = 'ilu-polakow-mieszka-w-belgii';
const file = path.join(root, '.local', 'drafts', `${slug}.md`);
const source = await fs.readFile(file, 'utf8');
cms.validateContent(`src/content/articles/${slug}.md`, Buffer.from(source).toString('base64'));
const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
const data = yaml.load(match[1]);
const body = source.slice(match[0].length);
if (/43[,.]9\s*tys/i.test(body)) throw new Error('unverified statistic remains in draft');
const statePath = path.join(root, '.local', 'agent', 'state.json');
const state = await fs.readFile(statePath, 'utf8').then(JSON.parse).catch(error => {
  if (error.code === 'ENOENT') return { items: [], drafts: [], runs: [], sources: [] };
  throw error;
});
state.drafts ||= [];
const id = fingerprint(`curated:${slug}`).slice(0, 20);
const now = new Date().toISOString();
const draft = {
  id, kind: 'article', status: 'pending_review', aiGenerated: true, title: data.title,
  description: data.description, body, category: data.category, region: data.region, tags: ['statystyki', 'Polonia'],
  createdAt: state.drafts.find(entry => entry.id === id)?.createdAt || now, updatedAt: now,
  sources: [
    { url: 'https://publikacje.new.stat.gov.pl/portal-publikacje/informacja-o-rozmiarach-i-kierunkach-czasowej-emigracji-z-polski-w-latach-2020-2025', fetchedAt: now, publishedAt: '2026-08-12' },
    { url: 'https://ibsa.brussels/sites/default/files/publication/documents/Focus%2078.pdf', fetchedAt: now, publishedAt: '2025-10' },
    { url: 'https://statbel.fgov.be/en/news/36-belgian-population-has-foreign-background', fetchedAt: now, publishedAt: '2025-06-12' }
  ],
  verification: { status: 'needs_review', checkedAt: now, credibility: 'official', issues: ['Belgium-wide GUS figure not directly verified', 'regional Flanders/Wallonia breakdown unavailable'], claims: [
    { text: '17 475 mieszkańców Regionu Stołecznego Brukseli miało polskie obywatelstwo 1.01.2025', sourceUrl: 'https://ibsa.brussels/sites/default/files/publication/documents/Focus%2078.pdf', definition: 'current Polish citizenship', year: 2025, unit: 'persons' },
    { text: '23 268 mieszkańców Regionu Stołecznego Brukseli miało polskie obywatelstwo przy urodzeniu 1.01.2025', sourceUrl: 'https://ibsa.brussels/sites/default/files/publication/documents/Focus%2078.pdf', definition: 'Polish citizenship at birth', year: 2025, unit: 'persons' }
  ] },
  event: null, cmsPath: null, localPath: `.local/drafts/${slug}.md`, proposedPublishAt: proposeSlot(state.drafts.filter(entry => entry.id !== id).map(entry => ({ status: entry.status, scheduledAt: entry.scheduledAt, proposedPublishAt: entry.proposedPublishAt })))
};
state.drafts = [...state.drafts.filter(entry => entry.id !== id), draft];
await fs.mkdir(path.dirname(statePath), { recursive: true });
const temp = `${statePath}.${process.pid}.tmp`;
await fs.writeFile(temp, JSON.stringify(state, null, 2) + '\n');
await fs.rename(temp, statePath);
const db = openLocalDb();
try {
  syncLocalState(db, state);
  db.prepare("UPDATE ai_editorial SET status='pending_review',proposed_publish_at=?,updated_at=? WHERE candidate_id=? AND status='draft' AND approved_by IS NULL").run(draft.proposedPublishAt,now,id);
} finally { db.close(); }
console.log(JSON.stringify({ id, status: draft.status, verification: draft.verification.status, localPath: draft.localPath }));

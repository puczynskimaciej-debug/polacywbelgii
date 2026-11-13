import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import cms from '../server/cms-content.js';
import { openLocalDb } from './local-db.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const id = process.argv[2];
if (!/^[a-f0-9]{20}$/.test(id || '')) throw new Error('Usage: node agent/commit-reviewed-draft.mjs <candidate-id>');
const statePath = path.join(root,'.local','agent','state.json');
const state = JSON.parse(await fs.readFile(statePath,'utf8'));
const draft = state.drafts?.find(entry => entry.id === id);
if (!draft?.localPath) throw new Error('Local draft missing');
const file = path.resolve(root,draft.localPath);
if (!file.startsWith(path.join(root,'.local','drafts') + path.sep)) throw new Error('Draft path outside local directory');
const markdown = await fs.readFile(file,'utf8');
cms.validateContent(`src/content/articles/${path.basename(file)}`,Buffer.from(markdown).toString('base64'));
const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(markdown);
const front = yaml.load(match[1]);
const body = markdown.slice(match[0].length);
const urls = [...new Set([...body.matchAll(/https:\/\/[^\s)]+/g)].map(found => found[0]))].filter(url => ['www.gov.pl','www.rjv.fgov.be','www.mijnvakantierekening.be'].includes(new URL(url).hostname));
if (urls.length < 2 || !urls.every(url => body.includes(url))) throw new Error('Official source links missing');
const db = openLocalDb();
try {
  const current = db.prepare('SELECT c.updated_at,e.status,e.approved_by FROM ai_candidates c JOIN ai_editorial e ON e.candidate_id=c.id WHERE c.id=?').get(id);
  if (!current || current.status !== 'pending_review' || current.approved_by) throw new Error('Candidate is no longer an unapproved review draft');
  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    const updated = db.prepare('UPDATE ai_candidates SET title=?,description=?,body=?,category=?,region=?,sources_json=?,updated_at=? WHERE id=? AND updated_at=?').run(front.title,front.description,body,front.category,front.region,JSON.stringify(urls.map(url => ({ url,fetchedAt:now }))),now,id,current.updated_at);
    if (updated.changes !== 1) throw new Error('Candidate changed during editorial review');
    db.prepare('UPDATE ai_editorial SET revision=revision+1,updated_at=? WHERE candidate_id=?').run(now,id);
    db.prepare('INSERT INTO ai_candidate_history(candidate_id,previous_status,new_status,actor_id,at,note) VALUES(?,?,?,?,?,?)').run(id,'pending_review','pending_review','local-editor',now,'Fact-checked and revised Gemini draft');
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  Object.assign(draft,{ title:front.title,description:front.description,body,category:front.category,region:front.region,sources:urls.map(url => ({ url,fetchedAt:now })),updatedAt:now });
  const temp = `${statePath}.${process.pid}.tmp`;
  await fs.writeFile(temp,JSON.stringify(state,null,2)+'\n');
  await fs.rename(temp,statePath);
  console.log(JSON.stringify({ id,title:front.title,status:'pending_review',sources:urls.length,proposedPublishAt:db.prepare('SELECT proposed_publish_at FROM ai_editorial WHERE candidate_id=?').get(id).proposed_publish_at }));
} finally { db.close(); }

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { openLocalDb } from './local-db.mjs';
import { dueCandidates } from './editorial.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = (id, baseRoot = root) => {
  if (!/^[a-f0-9]{20}$/.test(id)) throw new Error('Invalid candidate ID');
  return { article: path.join(baseRoot,'src','content','articles',`ai-${id}.md`), html: path.join(baseRoot,'_site','artykuly',`ai-${id}`,'index.html') };
};
function markdown(row) {
  const front = { title: row.title, date: row.scheduled_at, category: row.category || 'Życie w Belgii', description: row.description, region: row.region || 'all', contentType: row.kind === 'event' ? 'event' : 'article' };
  return `---\n${yaml.dump(front,{ lineWidth: -1 })}---\n${row.body.trim()}\n`;
}
function rebuild() { execFileSync(process.execPath,[path.join(root,'node_modules','@11ty','eleventy','cmd.cjs')],{ cwd: root, stdio: 'pipe' }); }

export function publishLocal(db, now = new Date(), build = rebuild, baseRoot = root, onlyIds = null) {
  const rows = db.prepare('SELECT c.*,e.status AS editorial_status,e.scheduled_at,e.approved_by,e.approved_at,e.public_state FROM ai_candidates c JOIN ai_editorial e ON e.candidate_id=c.id').all().filter(row => !onlyIds || onlyIds.has(row.id));
  const due = dueCandidates(rows.map(row => ({ ...row, status: row.editorial_status, scheduledAt: row.scheduled_at, approvedBy: row.approved_by, approvedAt: row.approved_at, publicState: row.public_state })),now).filter(row => {
    const verification = JSON.parse(row.verification_json || '{}');
    if (verification.status !== 'verified') return false;
    if (row.kind !== 'event') return true;
    const event = JSON.parse(row.event_json || '{}');
    return verification.status === 'verified' && event.status === 'scheduled' && Date.parse(event.end || event.start) > now.getTime();
  });
  const dueEvents = due.filter(row => row.kind === 'event');
  const materialize = rows.filter(row => row.kind === 'article' && row.editorial_status === 'published' && row.public_state === 'visible' && row.approved_by && row.approved_at && JSON.parse(row.verification_json || '{}').status === 'verified' && !fs.existsSync(target(row.id,baseRoot).article));
  const withdrawn = rows.filter(row => row.kind !== 'event' && row.editorial_status === 'archived' && fs.existsSync(target(row.id, baseRoot).article));
  const touched = [];
  for (const row of [...due.filter(item => item.kind !== 'event'),...materialize]) {
    const files = target(row.id,baseRoot);
    if (fs.existsSync(files.article)) throw new Error(`Article path already exists: ${row.id}`);
    fs.writeFileSync(files.article,markdown(row),{ flag: 'wx' });
    touched.push({ row, ...files, kind: row.editorial_status === 'published' ? 'materialize' : 'publish' });
  }
  for (const row of withdrawn) {
    const files = target(row.id,baseRoot);
    if (!fs.existsSync(files.article)) throw new Error(`Missing published source: ${row.id}`);
    const originalArticle = fs.readFileSync(files.article);
    const originalHtml = fs.existsSync(files.html) ? fs.readFileSync(files.html) : null;
    fs.unlinkSync(files.article);
    if (fs.existsSync(files.html)) fs.unlinkSync(files.html);
    touched.push({ row, ...files, kind: 'withdraw', originalArticle, originalHtml });
  }
  if (touched.length) {
    try { build(); }
    catch (error) {
      for (const item of touched) {
        if (item.kind === 'publish' || item.kind === 'materialize') {
          if (fs.existsSync(item.article)) fs.unlinkSync(item.article);
          if (fs.existsSync(item.html)) fs.unlinkSync(item.html);
        } else {
          fs.writeFileSync(item.article,item.originalArticle);
          if (item.originalHtml) { fs.mkdirSync(path.dirname(item.html),{ recursive:true }); fs.writeFileSync(item.html,item.originalHtml); }
        }
      }
      throw error;
    }
  }
  for (const item of touched) {
    const exists = fs.existsSync(item.html);
    if (['publish','materialize'].includes(item.kind) && !exists || item.kind === 'withdraw' && exists) throw new Error(`Build visibility mismatch: ${item.row.id}`);
    if (item.kind === 'publish') {
      db.prepare("UPDATE ai_editorial SET status='published',public_state='visible',published_at=?,updated_at=?,revision=revision+1 WHERE candidate_id=? AND status='scheduled' AND public_state='hidden'").run(now.toISOString(),now.toISOString(),item.row.id);
      db.prepare('INSERT INTO ai_candidate_history(candidate_id,previous_status,new_status,actor_id,at,note) VALUES(?,?,?,?,?,?)').run(item.row.id,'scheduled','published','local-publisher',now.toISOString(),'HTML build verified');
    } else if (item.kind === 'withdraw') {
      db.prepare("UPDATE ai_editorial SET public_state='hidden',updated_at=?,revision=revision+1 WHERE candidate_id=? AND status='archived' AND public_state='visible'").run(now.toISOString(),item.row.id);
      db.prepare('INSERT INTO ai_candidate_history(candidate_id,previous_status,new_status,actor_id,at,note) VALUES(?,?,?,?,?,?)').run(item.row.id,'archived','archived','local-publisher',now.toISOString(),'HTML withdrawal verified');
    }
  }
  const publishedEvents = [];
  for (const row of dueEvents) {
    const update = db.prepare("UPDATE ai_editorial SET status='published',public_state='visible',published_at=?,updated_at=?,revision=revision+1 WHERE candidate_id=? AND status='scheduled' AND public_state='hidden' AND approved_by IS NOT NULL AND approved_at IS NOT NULL").run(now.toISOString(),now.toISOString(),row.id);
    if (update.changes) { db.prepare('INSERT INTO ai_candidate_history(candidate_id,previous_status,new_status,actor_id,at,note) VALUES(?,?,?,?,?,?)').run(row.id,'scheduled','published','local-publisher',now.toISOString(),'D1 event visibility verified'); publishedEvents.push(row.id); }
  }
  return { published: [...touched.filter(item => item.kind === 'publish').map(item => item.row.id),...publishedEvents], materialized: touched.filter(item => item.kind === 'materialize').map(item => item.row.id), withdrawn: touched.filter(item => item.kind === 'withdraw').map(item => item.row.id) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const db = openLocalDb();
  try { console.log(JSON.stringify(publishLocal(db))); } finally { db.close(); }
}

import { fail } from './common.mjs';

const CHUNK = 240000;
const now = () => new Date().toISOString();
const kindOf = path => path.endsWith('.md') ? 'article' : path.startsWith('src/Images/') ? 'media' : 'config';
const nameOf = path => path.split('/').at(-1);

async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function row(db, path) { return db.prepare('SELECT * FROM cms_content WHERE path=?').bind(path).first(); }
async function contentOf(db, path) {
  const result = await db.prepare('SELECT content FROM cms_content_chunks WHERE path=? ORDER BY position').bind(path).all();
  return (result.results || []).map(item => item.content).join('');
}
function fileView(row, content) {
  return { name: nameOf(row.path), path: row.path, sha: row.sha, type: 'file', size: Math.floor(content.length * 3 / 4), content, encoding: 'base64', download_url: row.kind === 'media' ? `/images/uploads/${nameOf(row.path)}` : null, status: row.kind === 'article' && row.status === 'draft' && row.scheduled_at ? 'scheduled' : row.status, scheduled_at: row.scheduled_at || null, published_at: row.published_at || null };
}

export async function listContent(db, path) {
  const prefix = `${path}/`;
  const result = await db.prepare("SELECT c.path,c.sha,c.kind,c.status,p.scheduled_at,p.published_at FROM cms_content c LEFT JOIN cms_article_publication p ON p.path=c.path WHERE c.path LIKE ? AND c.status!='withdrawn' ORDER BY c.path").bind(`${prefix}%`).all();
  return (result.results || []).filter(item => item.path.slice(prefix.length).indexOf('/') === -1).map(item => ({ name: nameOf(item.path), path: item.path, sha: item.sha, type: 'file', download_url: item.kind === 'media' ? `/images/uploads/${nameOf(item.path)}` : null, status: item.kind === 'article' && item.status === 'draft' && item.scheduled_at ? 'scheduled' : item.status, scheduled_at:item.scheduled_at, published_at:item.published_at }));
}

export async function readContent(db, path) {
  const found = await db.prepare('SELECT c.*,p.scheduled_at,p.published_at FROM cms_content c LEFT JOIN cms_article_publication p ON p.path=c.path WHERE c.path=?').bind(path).first();
  if (!found || found.status === 'withdrawn') fail('notFound', 404);
  return fileView(found, await contentOf(db, path));
}

export async function writeContent(db, path, value, expectedSha, user, status) {
  const previous = await row(db, path);
  if (previous && previous.sha !== expectedSha || !previous && expectedSha) fail('conflict', 409);
  const kind = kindOf(path);
  const nextStatus = kind === 'article' ? status || previous?.status || 'draft' : 'published';
  if (!['draft','published','withdrawn'].includes(nextStatus)) fail('validation');
  if (kind === 'article' && nextStatus === 'published' && user.role !== 'admin') fail('forbidden', 403);
  const sha = await digest(value);
  const timestamp = now();
  const statements = [];
  if (previous) {
    statements.push(db.prepare('INSERT INTO cms_content_history(path,sha,action,actor_id,actor_name,at,content) VALUES(?,?,?,?,?,?,?)').bind(path, previous.sha, 'revision', user.id, user.name, timestamp, kind === 'media' ? null : await contentOf(db, path)));
    statements.push(db.prepare('UPDATE cms_content SET sha=?,status=?,updated_at=?,updated_by=?,revision=revision+1 WHERE path=?').bind(sha, nextStatus, timestamp, user.id, path));
    statements.push(db.prepare('DELETE FROM cms_content_chunks WHERE path=?').bind(path));
  } else statements.push(db.prepare('INSERT INTO cms_content(path,sha,kind,status,created_at,updated_at,updated_by) VALUES(?,?,?,?,?,?,?)').bind(path, sha, kind, nextStatus, timestamp, timestamp, user.id));
  for (let offset = 0, position = 0; offset < value.length; offset += CHUNK, position++) statements.push(db.prepare('INSERT INTO cms_content_chunks(path,position,content) VALUES(?,?,?)').bind(path, position, value.slice(offset, offset + CHUNK)));
  if (kind === 'article' && nextStatus === 'published') statements.push(db.prepare('INSERT INTO cms_article_publication(path,scheduled_at,published_at,updated_at) VALUES(?,NULL,?,?) ON CONFLICT(path) DO UPDATE SET scheduled_at=NULL,published_at=COALESCE(cms_article_publication.published_at,excluded.published_at),updated_at=excluded.updated_at').bind(path,timestamp,timestamp));
  statements.push(db.prepare('INSERT INTO cms_content_history(path,sha,action,actor_id,actor_name,at) VALUES(?,?,?,?,?,?)').bind(path, sha, previous ? 'update' : 'create', user.id, user.name, timestamp));
  await db.batch(statements);
  return { content: { sha, path, status: nextStatus } };
}

export async function withdrawContent(db, path, expectedSha, user) {
  const previous = await row(db, path);
  if (!previous || previous.status === 'withdrawn') fail('notFound', 404);
  if (previous.sha !== expectedSha) fail('conflict', 409);
  if (previous.kind === 'article' && user.role !== 'admin') fail('forbidden', 403);
  const timestamp = now();
  await db.batch([
    db.prepare("UPDATE cms_content SET status='withdrawn',updated_at=?,updated_by=?,revision=revision+1 WHERE path=?").bind(timestamp, user.id, path),
    db.prepare('INSERT INTO cms_content_history(path,sha,action,actor_id,actor_name,at,content) VALUES(?,?,?,?,?,?,?)').bind(path, previous.sha, 'withdraw', user.id, user.name, timestamp, previous.kind === 'media' ? null : await contentOf(db, path))
  ]);
  return { content: null };
}

export async function changeArticlePublication(db, path, expectedSha, action, scheduledAt, user) {
  const found = await db.prepare('SELECT c.sha,c.kind,c.status,p.scheduled_at FROM cms_content c LEFT JOIN cms_article_publication p ON p.path=c.path WHERE c.path=?').bind(path).first();
  if (!found || found.kind !== 'article' || found.status === 'withdrawn') fail('notFound',404);
  if (found.sha !== expectedSha) fail('conflict',409);
  if (user.role !== 'admin') fail('forbidden',403);
  const current = found.status === 'draft' && found.scheduled_at ? 'scheduled' : found.status;
  const allowed = { draft:['publish-now','schedule'], scheduled:['publish-now','schedule','unschedule'], published:['withdraw'] };
  if (!allowed[current]?.includes(action)) fail('conflict',409);
  if (action === 'schedule' && (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(scheduledAt || '') || Date.parse(scheduledAt) <= Date.now())) fail('invalidSchedule',400);
  const timestamp = now();
  const next = action === 'publish-now' ? 'published' : 'draft';
  const scheduled = action === 'schedule' ? scheduledAt : null;
  const published = action === 'publish-now' ? timestamp : null;
  await db.batch([
    db.prepare('UPDATE cms_content SET status=?,updated_at=?,updated_by=?,revision=revision+1 WHERE path=? AND sha=?').bind(next,timestamp,user.id,path,expectedSha),
    db.prepare('INSERT INTO cms_article_publication(path,scheduled_at,published_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(path) DO UPDATE SET scheduled_at=excluded.scheduled_at,published_at=excluded.published_at,updated_at=excluded.updated_at').bind(path,scheduled,published,timestamp),
    db.prepare('INSERT INTO cms_content_history(path,sha,action,actor_id,actor_name,at) VALUES(?,?,?,?,?,?)').bind(path,found.sha,action,user.id,user.name,timestamp)
  ]);
  return { path, status: action === 'schedule' ? 'scheduled' : next, scheduled_at:scheduled, published_at:published };
}

export async function publishScheduledContent(db, timestamp = now()) {
  const rows = await db.prepare("SELECT c.path FROM cms_content c JOIN cms_article_publication p ON p.path=c.path WHERE c.kind='article' AND c.status='draft' AND p.scheduled_at<=? AND p.scheduled_at IS NOT NULL").bind(timestamp).all();
  const published=[];
  for (const {path} of rows.results || []) {
    const result = await db.prepare("UPDATE cms_content SET status='published',updated_at=?,revision=revision+1 WHERE path=? AND status='draft' AND EXISTS (SELECT 1 FROM cms_article_publication WHERE path=? AND scheduled_at<=? AND scheduled_at IS NOT NULL)").bind(timestamp,path,path,timestamp).run();
    if (!result.meta?.changes) continue;
    await db.batch([
      db.prepare('UPDATE cms_article_publication SET scheduled_at=NULL,published_at=?,updated_at=? WHERE path=?').bind(timestamp,timestamp,path),
      db.prepare('INSERT INTO cms_content_history(path,action,actor_name,at) VALUES(?,?,?,?)').bind(path,'publish-scheduled','publication-worker',timestamp)
    ]);
    published.push(path);
  }
  return { published };
}

export async function contentHistory(db) {
  const result = await db.prepare('SELECT id,path,sha,action,actor_name,at FROM cms_content_history ORDER BY id DESC LIMIT 50').all();
  return (result.results || []).map(item => ({ sha: item.sha || String(item.id), commit: { message: `CMS: ${item.action} ${item.path}`, author: { name: item.actor_name || 'Import', date: item.at } }, author: { login: item.actor_name || 'Import' }, html_url: null }));
}

export async function publicContent(db, kind) {
  const paths = await db.prepare("SELECT c.path,c.sha,c.kind,c.status,c.updated_at,p.published_at FROM cms_content c LEFT JOIN cms_article_publication p ON p.path=c.path WHERE c.kind=? AND c.status='published' ORDER BY COALESCE(p.published_at,c.updated_at) DESC").bind(kind).all();
  const rows = paths.results || [];
  if (!rows.length) return [];
  const chunks = await db.prepare('SELECT path,content FROM cms_content_chunks WHERE path LIKE ? ORDER BY path,position').bind(kind === 'article' ? 'src/content/articles/%' : kind === 'media' ? 'src/Images/uploads/%' : 'src/_data/%').all();
  const values = new Map();
  for (const chunk of chunks.results || []) values.set(chunk.path, (values.get(chunk.path) || '') + chunk.content);
  return rows.map(item => fileView(item, values.get(item.path) || ''));
}

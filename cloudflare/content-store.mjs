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
  return { name: nameOf(row.path), path: row.path, sha: row.sha, type: 'file', size: Math.floor(content.length * 3 / 4), content, encoding: 'base64', download_url: row.kind === 'media' ? `/images/uploads/${nameOf(row.path)}` : null, status: row.status };
}

export async function listContent(db, path) {
  const prefix = `${path}/`;
  const result = await db.prepare("SELECT path,sha,kind,status FROM cms_content WHERE path LIKE ? AND status!='withdrawn' ORDER BY path").bind(`${prefix}%`).all();
  return (result.results || []).filter(item => item.path.slice(prefix.length).indexOf('/') === -1).map(item => ({ name: nameOf(item.path), path: item.path, sha: item.sha, type: 'file', download_url: item.kind === 'media' ? `/images/uploads/${nameOf(item.path)}` : null, status: item.status }));
}

export async function readContent(db, path) {
  const found = await row(db, path);
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

export async function contentHistory(db) {
  const result = await db.prepare('SELECT id,path,sha,action,actor_name,at FROM cms_content_history ORDER BY id DESC LIMIT 50').all();
  return (result.results || []).map(item => ({ sha: item.sha || String(item.id), commit: { message: `CMS: ${item.action} ${item.path}`, author: { name: item.actor_name || 'Import', date: item.at } }, author: { login: item.actor_name || 'Import' }, html_url: null }));
}

export async function publicContent(db, kind) {
  const paths = await db.prepare("SELECT path,sha,kind,status,updated_at FROM cms_content WHERE kind=? AND status='published' ORDER BY updated_at DESC").bind(kind).all();
  const rows = paths.results || [];
  if (!rows.length) return [];
  const chunks = await db.prepare('SELECT path,content FROM cms_content_chunks WHERE path LIKE ? ORDER BY path,position').bind(kind === 'article' ? 'src/content/articles/%' : kind === 'media' ? 'src/Images/uploads/%' : 'src/_data/%').all();
  const values = new Map();
  for (const chunk of chunks.results || []) values.set(chunk.path, (values.get(chunk.path) || '') + chunk.content);
  return rows.map(item => fileView(item, values.get(item.path) || ''));
}

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { localD1Path } from '../agent/local-db.mjs';

const root = process.env.LOCAL_CMS_ORIGIN || 'http://127.0.0.1:8080';
const db = new DatabaseSync(localD1Path());
db.exec('PRAGMA busy_timeout=5000');
const id = randomUUID();
const token = randomBytes(32).toString('base64url');
const cookie = `__Host-pbe_session=${token}`;
const slug = `e2e-${id.slice(0, 12)}`;
const articlePath = `src/content/articles/${slug}.md`;
const imageName = `${slug}.png`;
const imagePath = `src/Images/uploads/${imageName}`;
const payload = Buffer.from(`---\ntitle: "Lokalny test CMS"\ndate: "${new Date().toISOString()}"\ncategory: "Test"\ndescription: "Test zapisu i widoczności"\nregion: "all"\ncontentType: "article"\n---\nTreść testowa.\n`).toString('base64');
const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6cocAAAAASUVORK5CYII=';
async function api(path, method = 'GET', body) {
  const response = await fetch(`${root}/api/cms-content?path=${encodeURIComponent(path)}`, { method, headers: { Cookie: cookie, Origin: root, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  return { status: response.status, data };
}
try {
  db.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(id, `${slug}@example.invalid`, 'CMS E2E', 'unused', 'admin');
  db.prepare('INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'), id, '2099-01-01T00:00:00Z');
  assert.equal((await api('src/_data/home.json')).status, 200);
  assert.equal((await api('src/content/articles')).status, 200);
  const created = await api(articlePath, 'PUT', { content: payload, status: 'draft' });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  assert.equal((await fetch(`${root}/artykuly/${slug}/`)).status, 404);
  const published = await api(articlePath, 'PUT', { content: payload, sha: created.data.content.sha, status: 'published' });
  assert.equal(published.status, 200, JSON.stringify(published.data));
  assert.equal((await fetch(`${root}/artykuly/${slug}/`)).status, 200);
  assert.match(await (await fetch(`${root}/artykuly/`)).text(), /Lokalny test CMS/);
  const media = await api(imagePath, 'PUT', { content: image });
  assert.equal(media.status, 200, JSON.stringify(media.data));
  assert.equal((await fetch(`${root}/images/uploads/${imageName}`)).status, 200);
  assert.equal((await api(articlePath, 'DELETE', { sha: published.data.content.sha })).status, 200);
  assert.equal((await fetch(`${root}/artykuly/${slug}/`)).status, 404);
  console.log('CMS D1 HTTP E2E: draft, publish, list, media, withdraw OK');
} finally {
  db.prepare('DELETE FROM cms_content WHERE path IN (?,?)').run(articlePath, imagePath);
  db.prepare('DELETE FROM cms_content_history WHERE path IN (?,?)').run(articlePath, imagePath);
  db.prepare('DELETE FROM cms_sessions WHERE user_id=?').run(id);
  db.prepare('DELETE FROM cms_users WHERE id=?').run(id);
  db.close();
}

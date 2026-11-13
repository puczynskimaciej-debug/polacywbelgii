import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openLocalDb, localD1Path } from '../agent/local-db.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'src/_data/home.json', 'src/_data/site.json',
  ...fs.readdirSync(path.join(root, 'src/content/articles')).filter(name => name.endsWith('.md') && !name.startsWith('ai-')).map(name => `src/content/articles/${name}`),
  ...(fs.existsSync(path.join(root, 'src/Images/uploads')) ? fs.readdirSync(path.join(root, 'src/Images/uploads')).map(name => `src/Images/uploads/${name}`) : [])
];
const db = openLocalDb();
const backup = path.join(root, '.local', `content-before-import-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
const timestamp = new Date().toISOString();
const imported = [], skipped = [];
try {
  db.exec(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
  db.exec('BEGIN');
  try {
    for (const relative of files) {
      const filename = path.join(root, relative);
      if (!fs.statSync(filename).isFile()) continue;
      const existing = db.prepare('SELECT sha FROM cms_content WHERE path=?').get(relative);
      if (existing) { skipped.push(relative); continue; }
      const base64 = fs.readFileSync(filename).toString('base64');
      const sha = createHash('sha256').update(base64).digest('hex');
      const kind = relative.endsWith('.md') ? 'article' : relative.startsWith('src/Images/') ? 'media' : 'config';
      db.prepare('INSERT INTO cms_content(path,sha,kind,status,created_at,updated_at,updated_by) VALUES(?,?,?,?,?,?,?)').run(relative, sha, kind, 'published', timestamp, timestamp, 'local-import');
      for (let offset = 0, position = 0; offset < base64.length; offset += 240000, position++) db.prepare('INSERT INTO cms_content_chunks(path,position,content) VALUES(?,?,?)').run(relative, position, base64.slice(offset, offset + 240000));
      db.prepare('INSERT INTO cms_content_history(path,sha,action,actor_name,at) VALUES(?,?,?,?,?)').run(relative, sha, 'import', 'Local import', timestamp);
      imported.push(relative);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  for (const relative of imported) {
    const actual = db.prepare('SELECT content FROM cms_content_chunks WHERE path=? ORDER BY position').all(relative).map(row => row.content).join('');
    if (!Buffer.from(actual, 'base64').equals(fs.readFileSync(path.join(root, relative)))) throw new Error(`Import verification failed: ${relative}`);
  }
  console.log(JSON.stringify({ database: localD1Path(), backup, imported: imported.length, skipped: skipped.length, verified: imported.length }));
} finally { db.close(); }

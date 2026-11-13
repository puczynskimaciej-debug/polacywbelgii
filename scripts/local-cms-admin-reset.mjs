import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from '../cloudflare/auth.mjs';
import { openLocalDb } from '../agent/local-db.mjs';

const address = 'kontakt@polacywbelgii.eu';
const password = randomBytes(36).toString('base64url');
const hash = await hashPassword(password);
const db = openLocalDb();
let result;
try {
  const existing = db.prepare('SELECT id,email FROM cms_users WHERE email=?').get(address);
  db.exec('BEGIN');
  try {
    if (existing) {
      db.prepare("UPDATE cms_users SET password_hash=?,role='admin',active=1,must_change_password=1,version=version+1 WHERE id=?").run(hash,existing.id);
      db.prepare('DELETE FROM cms_sessions WHERE user_id=?').run(existing.id);
      result = 'reset';
    } else {
      db.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,1)').run(randomUUID(),address,'Administrator Polacy w Belgii',hash,'admin');
      result = 'created';
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
} finally { db.close(); }

const secretDirectory = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(),'AppData','Local'),'PolacywBelgii');
await fs.mkdir(secretDirectory,{ recursive:true });
const secretPath = path.join(secretDirectory,'local-cms-admin-password.txt');
await fs.writeFile(secretPath,`${password}\n`,{ mode:0o600 });
console.log(JSON.stringify({ account:address,action:result,role:'admin',temporaryPasswordFile:secretPath,mustChangePassword:true }));

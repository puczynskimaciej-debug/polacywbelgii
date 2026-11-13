import { randomUUID } from 'node:crypto';
import { hashPassword } from '../cloudflare/auth.mjs';
import { openLocalDb } from '../agent/local-db.mjs';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
const { email, password } = JSON.parse(raw);
if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string') throw new Error('Valid email and password required');
const db = openLocalDb();
try {
  const address = email.trim().toLowerCase();
  if (db.prepare('SELECT id FROM cms_users WHERE email=?').get(address)) throw new Error('Local account already exists; no account was changed');
  const id = randomUUID();
  db.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(id,address,'Lokalny administrator',await hashPassword(password),'admin');
  console.log(`Created local CMS admin: ${address}`);
} finally { db.close(); }

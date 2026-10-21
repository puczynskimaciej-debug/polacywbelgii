// Generate a one-time SQL insert for an empty D1 CMS user table.
// Provide email/name/password through environment variables; output stays
// outside Git in cloudflare-export/. No existing user is changed.
import { randomUUID, webcrypto } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hashPassword } from '../cloudflare/auth.mjs';

globalThis.crypto ??= webcrypto;
const email = process.env.CMS_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const name = process.env.CMS_BOOTSTRAP_NAME?.trim();
const password = process.env.CMS_BOOTSTRAP_PASSWORD;
if (!email || !name || !password) throw new Error('CMS_BOOTSTRAP_EMAIL, CMS_BOOTSTRAP_NAME and CMS_BOOTSTRAP_PASSWORD are required');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length > 120) throw new Error('Invalid email or name');
const hash = await hashPassword(password);
const quote = value => `'${value.replace(/'/g, "''")}'`;
const sql = `-- Run once against D1 only after reviewing the target database.\nINSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password)\nSELECT ${quote(randomUUID())},${quote(email)},${quote(name)},${quote(hash)},'admin',1,1\nWHERE NOT EXISTS (SELECT 1 FROM cms_users);\n`;
const folder = resolve('cloudflare-export');
await mkdir(folder, { recursive: true, mode: 0o700 });
const target = resolve(folder, 'bootstrap-admin.sql');
await writeFile(target, sql, { mode: 0o600, flag: 'wx' });
console.log(`Bootstrap SQL written to ${target}. It will not replace existing users.`);

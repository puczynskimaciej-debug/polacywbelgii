import { fail, hex, sha256 } from './common.mjs';

const COOKIE = '__Host-pbe_session';
const ITERATIONS = 600000;
const CHAIN_ROUNDS = 6;
const ROUND_ITERATIONS = 100000;
const SESSION_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();
const bytes = hexValue => Uint8Array.from(hexValue.match(/../g) || [], pair => parseInt(pair, 16));

export function validatePassword(value) {
  if (typeof value !== 'string' || [...value].length < 15 || [...value].length > 128 || encoder.encode(value).length > 512) fail('passwordLength');
}
export async function hashPassword(password) {
  validatePassword(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await chainedDerive(encoder.encode(password), salt);
  return `pbkdf2-chain-sha256$${CHAIN_ROUNDS}$${ROUND_ITERATIONS}$${hex(salt)}$${hex(derived)}`;
}
async function chainedDerive(passwordBytes, salt) {
  let material = passwordBytes;
  for (let round = 0; round < CHAIN_ROUNDS; round++) {
    const key = await crypto.subtle.importKey('raw', material, 'PBKDF2', false, ['deriveBits']);
    const roundSalt = new Uint8Array(salt.length + 1);
    roundSalt.set(salt);
    roundSalt[salt.length] = round;
    material = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: roundSalt, iterations: ROUND_ITERATIONS }, key, 256));
  }
  return material;
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || encoder.encode(password).length > 512) return false;
  const chained = /^pbkdf2-chain-sha256\$(\d+)\$(\d+)\$([0-9a-f]{32})\$([0-9a-f]{64})$/.exec(encoded || '');
  if (chained) {
    if (Number(chained[1]) !== CHAIN_ROUNDS || Number(chained[2]) !== ROUND_ITERATIONS) return false;
    const actual = await chainedDerive(encoder.encode(password), bytes(chained[3]));
    const expected = bytes(chained[4]);
    let difference = 0;
    for (let index = 0; index < actual.length; index++) difference |= actual[index] ^ expected[index];
    return difference === 0;
  }
  const match = /^pbkdf2-sha256\$(\d+)\$([0-9a-f]{32})\$([0-9a-f]{64})$/.exec(encoded || '');
  if (!match || Number(match[1]) !== ITERATIONS) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes(match[2]), iterations: ITERATIONS }, key, 256));
  const expected = bytes(match[3]);
  let difference = 0;
  for (let index = 0; index < actual.length; index++) difference |= actual[index] ^ expected[index];
  return difference === 0;
}
export function checkOrigin(request, env) {
  const origin = new URL(request.url).origin;
  if (env.CMS_ORIGIN && env.CMS_ORIGIN !== origin) fail('configuration', 503);
  if (!['GET', 'HEAD'].includes(request.method) && (request.headers.get('origin') !== origin || request.headers.get('sec-fetch-site') === 'cross-site')) fail('origin', 403);
}
function token(request) {
  const cookie = request.headers.get('cookie') || '';
  const value = cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value || '') ? value : null;
}
export const sessionCookie = (value, maxAge = SESSION_SECONDS) => `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=${maxAge}`;
export async function currentUser(request, env, { admin = false, allowPasswordChange = false } = {}) {
  checkOrigin(request, env);
  const value = token(request);
  if (!value) fail('unauthorized', 401);
  const digest = await sha256(value);
  const user = await env.DB.prepare('SELECT u.* FROM cms_users u JOIN cms_sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1').bind(digest, new Date().toISOString()).first();
  if (!user) fail('unauthorized', 401);
  if (!allowPasswordChange && user.must_change_password) fail('passwordChangeRequired', 403);
  if (admin && user.role !== 'admin') fail('forbidden', 403);
  return user;
}
export const publicUser = user => ({ id: user.id, email: user.email, name: user.name, role: user.role, active: Boolean(user.active), mustChangePassword: Boolean(user.must_change_password), version: user.version });
export const email = value => { if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) fail('validation'); return value.trim().toLowerCase(); };
export const name = value => { if (typeof value !== 'string' || !value.trim() || value.length > 120) fail('validation'); return value.trim(); };
async function throttle(db, request, address, prefix = 'login') {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const windowStart = new Date(Date.now() - 15 * 60000).toISOString();
  for (const [key, limit] of [[`${prefix}:ip:${ip}`, 30], [`${prefix}:account:${address}`, 10]]) {
    const digest = await sha256(key);
    await db.prepare('INSERT INTO cms_login_limits(key,started_at,attempts) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN started_at<? THEN 1 ELSE attempts+1 END,started_at=CASE WHEN started_at<? THEN excluded.started_at ELSE started_at END').bind(digest, new Date().toISOString(), windowStart, windowStart).run();
    const row = await db.prepare('SELECT attempts FROM cms_login_limits WHERE key=?').bind(digest).first();
    if (row.attempts > limit) fail('rateLimit', 429);
  }
}
async function newSession(db, userId) {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const value = btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const digest = await sha256(value);
  await db.prepare('INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(digest, userId, new Date(Date.now() + SESSION_SECONDS * 1000).toISOString()).run();
  return value;
}
export async function login(request, env, input) {
  checkOrigin(request, env);
  const address = email(input.email);
  await throttle(env.DB, request, address);
  const user = await env.DB.prepare('SELECT * FROM cms_users WHERE email=?').bind(address).first();
  if (user?.password_hash?.startsWith('scrypt$')) fail('passwordResetRequired', 403);
  if (!user || !user.active || !await verifyPassword(input.password, user.password_hash)) fail('invalidCredentials', 401);
  const fresh = await env.DB.prepare('SELECT * FROM cms_users WHERE id=? AND active=1 AND password_hash=?').bind(user.id, user.password_hash).first();
  if (!fresh) fail('invalidCredentials', 401);
  const old = token(request);
  if (old) await env.DB.prepare('DELETE FROM cms_sessions WHERE token_hash=?').bind(await sha256(old)).run();
  const value = await newSession(env.DB, user.id);
  await env.DB.prepare('INSERT INTO cms_audit(actor_id,action,target) VALUES(?,?,?)').bind(user.id, 'login', user.id).run();
  return { user: publicUser(fresh), cookie: sessionCookie(value) };
}
export async function logout(request, env) {
  const value = token(request);
  if (value) await env.DB.prepare('DELETE FROM cms_sessions WHERE token_hash=?').bind(await sha256(value)).run();
  return sessionCookie('', 0);
}
export async function changePassword(request, env, input) {
  const user = await currentUser(request, env, { allowPasswordChange: true });
  await throttle(env.DB, request, user.email, 'password');
  if (!await verifyPassword(input.currentPassword, user.password_hash)) fail('invalidCredentials', 401);
  if (input.currentPassword === input.password) fail('passwordReuse');
  const next = await hashPassword(input.password);
  await env.DB.prepare('DELETE FROM cms_sessions WHERE user_id=?').bind(user.id).run();
  const update = await env.DB.prepare('UPDATE cms_users SET password_hash=?,must_change_password=0,version=version+1 WHERE id=? AND password_hash=?').bind(next, user.id, user.password_hash).run();
  if (!update.meta.changes) fail('conflict', 409);
  const value = await newSession(env.DB, user.id);
  await env.DB.prepare('INSERT INTO cms_audit(actor_id,action,target) VALUES(?,?,?)').bind(user.id, 'password-change', user.id).run();
  return sessionCookie(value);
}
export async function saveUser(request, env, input, create) {
  const actor = await currentUser(request, env, { admin: true });
  const address = email(input.email);
  const displayName = name(input.name);
  if (!['admin', 'editor'].includes(input.role) || typeof input.active !== 'boolean') fail('validation');
  const password = create || input.password ? await hashPassword(input.password) : null;
  if (create) {
    const id = crypto.randomUUID();
    try {
      await env.DB.batch([
        env.DB.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active) VALUES(?,?,?,?,?,?)').bind(id, address, displayName, password, input.role, Number(input.active)),
        env.DB.prepare('INSERT INTO cms_audit(actor_id,action,target) VALUES(?,?,?)').bind(actor.id, 'user-create', id)
      ]);
    } catch (error) { if (String(error).includes('UNIQUE')) fail('emailExists', 409); throw error; }
    return publicUser(await env.DB.prepare('SELECT * FROM cms_users WHERE id=?').bind(id).first());
  }
  if (!/^[0-9a-f-]{36}$/i.test(input.id || '')) fail('validation');
  const old = await env.DB.prepare('SELECT * FROM cms_users WHERE id=?').bind(input.id).first();
  if (!old) fail('notFound', 404);
  if (old.version !== input.version) fail('conflict', 409);
  if (actor.id === old.id && (input.role !== 'admin' || !input.active || password)) fail('selfModification');
  if (old.role === 'admin' && old.active && (input.role !== 'admin' || !input.active)) {
    const remaining = await env.DB.prepare("SELECT count(*) AS n FROM cms_users WHERE role='admin' AND active=1").first();
    if (remaining.n <= 1) fail('lastAdmin', 409);
  }
  if (password || old.role !== input.role || old.active !== Number(input.active) || old.email !== address) await env.DB.prepare('DELETE FROM cms_sessions WHERE user_id=?').bind(old.id).run();
  let updated;
  try {
    updated = await env.DB.prepare('UPDATE cms_users SET email=?,name=?,role=?,active=?,password_hash=COALESCE(?,password_hash),must_change_password=CASE WHEN ? IS NOT NULL THEN 1 ELSE must_change_password END,version=version+1 WHERE id=? AND version=?').bind(address, displayName, input.role, Number(input.active), password, password, old.id, old.version).run();
  } catch (error) { if (String(error).includes('UNIQUE')) fail('emailExists', 409); throw error; }
  if (!updated.meta.changes) fail('conflict', 409);
  await env.DB.prepare('INSERT INTO cms_audit(actor_id,action,target) VALUES(?,?,?)').bind(actor.id, password ? 'user-password-reset' : 'user-update', old.id).run();
  return publicUser(await env.DB.prepare('SELECT * FROM cms_users WHERE id=?').bind(old.id).first());
}

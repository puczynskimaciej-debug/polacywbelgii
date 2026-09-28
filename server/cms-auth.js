const { scrypt, randomBytes, randomUUID, createHash, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { database } = require('./ads-store');
const { fail } = require('./http');
const derive = promisify(scrypt);
const HASH_OPTIONS = { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 };
const SESSION_SECONDS = 8 * 60 * 60;
const digest = value => createHash('sha256').update(value).digest('hex');
function origin() {
  const value = process.env.CMS_ORIGIN;
  if (!value) fail('configuration', 503);
  const parsed = new URL(value);
  if (parsed.origin !== value || !(parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)))) fail('configuration', 503);
  return parsed;
}
function cookieName() { return origin().protocol === 'https:' ? '__Host-pbe_session' : 'pbe_session_dev'; }
function sessionCookie(token, maxAge = SESSION_SECONDS) { return `${cookieName()}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${origin().protocol === 'https:' ? '; Secure' : ''}`; }
function sessionToken(event) {
  const value = String(event.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(cookieName() + '='))?.slice(cookieName().length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value || '') ? value : null;
}
function checkOrigin(event) {
  if (event.headers.origin !== origin().origin || event.headers['sec-fetch-site'] === 'cross-site') fail('origin', 403);
}
function email(value) {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) fail('validation');
  return value.trim().toLowerCase();
}
function name(value) { if (typeof value !== 'string' || !value.trim() || value.length > 120) fail('validation'); return value.trim(); }
function validatePassword(value) { if (typeof value !== 'string' || [...value].length < 15 || [...value].length > 128 || Buffer.byteLength(value) > 512) fail('passwordLength'); }
async function hashPassword(password) {
  validatePassword(password);
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64, HASH_OPTIONS);
  return `scrypt$131072$8$1$${salt}$${hash.toString('hex')}`;
}
// A missing account still performs the same expensive derivation.
const DUMMY_HASH = `scrypt$131072$8$1$${'0'.repeat(32)}$${'0'.repeat(128)}`;
async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || Buffer.byteLength(password) > 512) return false;
  const parts = (encoded || DUMMY_HASH).split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt' || parts[1] !== '131072' || parts[2] !== '8' || parts[3] !== '1' || !/^[0-9a-f]{32}$/.test(parts[4]) || !/^[0-9a-f]{128}$/.test(parts[5])) return false;
  const actual = await derive(password, parts[4], 64, HASH_OPTIONS);
  return timingSafeEqual(actual, Buffer.from(parts[5], 'hex'));
}
function publicUser(user) { return { id: user.id, email: user.email, name: user.name, role: user.role, active: user.active, mustChangePassword: user.must_change_password, version: user.version }; }
async function currentUser(event, { admin = false, allowPasswordChange = false, client = database() } = {}) {
  const token = sessionToken(event);
  if (!token) fail('unauthorized', 401);
  const { rows: [user] } = await client.query(`SELECT u.* FROM cms_users u JOIN cms_sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true`, [digest(token)]);
  if (!user) fail('unauthorized', 401);
  if (!allowPasswordChange && user.must_change_password) fail('passwordChangeRequired', 403);
  if (admin && user.role !== 'admin') fail('forbidden', 403);
  if (!['GET', 'HEAD'].includes(event.httpMethod)) checkOrigin(event);
  return user;
}
async function transaction(work) {
  const client = await database().connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout='12s'");
    await client.query('SELECT pg_advisory_xact_lock(7342168)');
    const result = await work(client); await client.query('COMMIT'); return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function audit(client, actor, action, target) { await client.query('INSERT INTO cms_audit(actor_id,action,target) VALUES($1,$2,$3)', [actor || null, action, target]); }
async function newSession(client, userId) {
  const token = randomBytes(32).toString('base64url');
  await client.query('DELETE FROM cms_sessions WHERE expires_at <= now()');
  await client.query("INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')", [digest(token), userId]);
  return token;
}
async function throttle(event, account, prefix = 'login') {
  const ip = event.headers['x-nf-client-connection-ip'] || 'unknown';
  const keys = [[`${prefix}:ip:${ip}`, 30], [`${prefix}:account:${account}`, 10]];
  for (const [raw, limit] of keys) {
    const { rows: [row] } = await database().query(`INSERT INTO cms_login_limits(key,attempts) VALUES($1,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN cms_login_limits.started_at<now()-interval '15 minutes' THEN 1 ELSE cms_login_limits.attempts+1 END, started_at=CASE WHEN cms_login_limits.started_at<now()-interval '15 minutes' THEN now() ELSE cms_login_limits.started_at END RETURNING attempts`, [digest(raw)]);
    if (row.attempts > limit) fail('rateLimit', 429);
  }
  await database().query("DELETE FROM cms_login_limits WHERE started_at<now()-interval '1 day'");
}
async function login(event, input) {
  checkOrigin(event);
  const address = email(input.email);
  await throttle(event, address);
  const { rows: [user] } = await database().query('SELECT * FROM cms_users WHERE email=$1', [address]);
  const valid = await verifyPassword(input.password, user?.password_hash);
  if (!valid || !user?.active) fail('invalidCredentials', 401);
  return transaction(async client => {
    const { rows: [fresh] } = await client.query('SELECT * FROM cms_users WHERE id=$1 FOR UPDATE', [user.id]);
    if (!fresh.active || fresh.password_hash !== user.password_hash) fail('invalidCredentials', 401);
    const old = sessionToken(event);
    if (old) await client.query('DELETE FROM cms_sessions WHERE token_hash=$1', [digest(old)]);
    const token = await newSession(client, fresh.id);
    await audit(client, fresh.id, 'login', fresh.id);
    return { user: publicUser(fresh), cookie: sessionCookie(token) };
  });
}
async function changePassword(event, input) {
  const user = await currentUser(event, { allowPasswordChange: true });
  await throttle(event, user.email, 'password');
  if (!await verifyPassword(input.currentPassword, user.password_hash)) fail('invalidCredentials', 401);
  if (input.currentPassword === input.password) fail('passwordReuse');
  const hash = await hashPassword(input.password);
  return transaction(async client => {
    const fresh = await currentUser(event, { allowPasswordChange: true, client });
    if (fresh.password_hash !== user.password_hash) fail('conflict', 409);
    await client.query('UPDATE cms_users SET password_hash=$1,must_change_password=false,version=version+1 WHERE id=$2', [hash, user.id]);
    await client.query('DELETE FROM cms_sessions WHERE user_id=$1', [user.id]);
    const token = await newSession(client, user.id);
    await audit(client, user.id, 'password-change', user.id);
    return sessionCookie(token);
  });
}
async function saveUser(event, input, create) {
  await currentUser(event, { admin: true });
  const address = email(input.email); const displayName = name(input.name);
  if (!['admin', 'editor'].includes(input.role) || typeof input.active !== 'boolean') fail('validation');
  const hash = create || input.password ? await hashPassword(input.password) : null;
  return transaction(async client => {
    const actor = await currentUser(event, { admin: true, client });
    let userId = input.id;
    if (create) {
      userId = randomUUID();
      await client.query('INSERT INTO cms_users(id,email,name,password_hash,role,active) VALUES($1,$2,$3,$4,$5,$6)', [userId, address, displayName, hash, input.role, input.active]);
    } else {
      if (!/^[0-9a-f-]{36}$/i.test(userId || '')) fail('validation');
      const { rows: [old] } = await client.query('SELECT * FROM cms_users WHERE id=$1 FOR UPDATE', [userId]);
      if (!old) fail('notFound', 404);
      if (input.version !== old.version) fail('conflict', 409);
      if (actor.id === userId && (input.role !== 'admin' || !input.active || hash)) fail('selfModification');
      if (old.role === 'admin' && old.active && (input.role !== 'admin' || !input.active)) {
        const { rows: [count] } = await client.query("SELECT count(*)::integer AS total FROM cms_users WHERE role='admin' AND active=true");
        if (count.total <= 1) fail('lastAdmin', 409);
      }
      await client.query('UPDATE cms_users SET email=$1,name=$2,role=$3,active=$4,password_hash=COALESCE($5,password_hash),must_change_password=CASE WHEN $5::text IS NOT NULL THEN true ELSE must_change_password END,version=version+1 WHERE id=$6', [address, displayName, input.role, input.active, hash, userId]);
      // Changing access or credentials invalidates every existing session immediately.
      if (hash || old.role !== input.role || old.active !== input.active || old.email !== address) await client.query('DELETE FROM cms_sessions WHERE user_id=$1', [userId]);
    }
    await audit(client, actor.id, create ? 'user-create' : hash ? 'user-password-reset' : 'user-update', userId);
    return publicUser((await client.query('SELECT * FROM cms_users WHERE id=$1', [userId])).rows[0]);
  }).catch(error => { if (error.code === '23505') fail('emailExists', 409); throw error; });
}
module.exports = { email, name, digest, hashPassword, verifyPassword, publicUser, currentUser, checkOrigin, sessionCookie, sessionToken, transaction, audit, newSession, login, changePassword, saveUser };

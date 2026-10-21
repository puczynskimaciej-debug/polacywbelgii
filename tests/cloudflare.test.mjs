import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomUUID, webcrypto } from 'node:crypto';
import domain from '../server/ads-domain.js';
import { handleAds as adsRoute } from '../cloudflare/ads.mjs';
import { hashPassword, login, currentUser, logout } from '../cloudflare/auth.mjs';

globalThis.crypto ??= webcrypto;
function localDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../deploy/cloudflare-d1.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../deploy/cloudflare-d1-0002.sql', import.meta.url), 'utf8'));
  const prepare = (sql, values = []) => ({
    bind(...params) { return prepare(sql, params); },
    async first() { return sqlite.prepare(sql).get(...values) || null; },
    async all() { return { results: sqlite.prepare(sql).all(...values) }; },
    async run() { const result = sqlite.prepare(sql).run(...values); return { meta: { changes: result.changes } }; }
  });
  return {
    sqlite,
    prepare,
    async batch(statements) {
      sqlite.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    }
  };
}
const request = (path, method = 'GET', body, cookie) => new Request(`https://polacywbelgii.pages.dev${path}`, {
  method,
  headers: { ...(method !== 'GET' ? { Origin: 'https://polacywbelgii.pages.dev', 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body)
});

test('D1 email/password login, session and logout', async () => {
  const DB = localDb();
  const password = 'A long test password 12345';
  const hash = await hashPassword(password);
  const userId = randomUUID();
  DB.sqlite.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(userId, 'admin@example.com', 'Admin', hash, 'admin');
  const env = { DB };
  const result = await login(request('/api/cms-auth?action=login', 'POST', { email: 'admin@example.com', password }), env, { email: 'admin@example.com', password });
  assert.equal(result.user.email, 'admin@example.com');
  const cookie = result.cookie.split(';')[0];
  const session = await currentUser(request('/api/cms-auth?action=session', 'GET', undefined, cookie), env);
  assert.equal(session.email, 'admin@example.com');
  await logout(request('/api/cms-auth?action=logout', 'POST', {}, cookie), env);
  await assert.rejects(() => currentUser(request('/api/cms-auth?action=session', 'GET', undefined, cookie), env), { code: 'unauthorized' });
});

test('D1 ads API enforces per-day TOP capacity', async () => {
  const DB = localDb();
  const config = domain.defaults();
  config.markets.pl.enabled = true;
  config.markets.pl.prices.TOP = 500;
  config.markets.pl.prices.STANDARD = 200;
  DB.sqlite.prepare('INSERT INTO ads_settings(id,data,version) VALUES(1,?,1)').run(JSON.stringify(config));
  const env = { DB };
  const day = new Date(Date.parse(domain.today()) + 86400000).toISOString().slice(0, 10);
  for (let i = 0; i < 3; i++) {
    const body = { kind: 'text', type: 'TOP', language: 'pl', startDate: day, endDate: day, description: `Ogłoszenie testowe ${i}`, contact: 'kontakt', email: 'test@example.com', consent: true, requestId: randomUUID(), expectedDailyPrice: 500, expectedTotalPrice: 500 };
    const response = await adsRoute({ request: request('/api/ads?action=order', 'POST', body), env });
    assert.equal(response.status, i < 2 ? 201 : 409, JSON.stringify(await response.json()));
  }
  const publicResponse = await adsRoute({ request: request('/api/ads?action=public&language=pl'), env });
  assert.equal(publicResponse.status, 200);
  assert.equal((await publicResponse.json()).ads.length, 0); // pending orders are not public
});

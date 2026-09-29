import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright-core';
import deployment from '../server/deployment.js';
import health from '../server/handlers/health.js';
import { adapt } from '../server/netlify-adapter.mjs';

export function registerCmsTests({ store, auth, cmsAuth, cmsContent, ads, originalFetch, origin, adminPassword, adminCookie }) {
  test('modern Netlify adapter preserves cookies, request bodies and binary responses', async () => {
    const endpoint = adapt(cmsAuth.handler);
    const response = await endpoint(new Request(`${origin}/.netlify/functions/cms-auth?action=session`, { headers: { cookie: adminCookie() } }), { ip: '127.0.0.1' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).user.role, 'admin');
    const bytes = Buffer.from([137, 80, 78, 71]);
    const binary = adapt(async event => {
      assert.equal(event.body, 'payload');
      assert.equal(event.headers['x-nf-client-connection-ip'], '192.0.2.1');
      return { statusCode: 200, headers: { 'Content-Type': 'image/png', 'Set-Cookie': 'session=test; HttpOnly; Secure' }, body: bytes.toString('base64'), isBase64Encoded: true };
    });
    const image = await binary(new Request(`${origin}/image`, { method: 'POST', body: 'payload' }), { ip: '192.0.2.1' });
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), bytes);
    assert.equal(image.headers.get('set-cookie'), 'session=test; HttpOnly; Secure');
  });
  const password = 'Temporary test password 123!';
  const newPassword = 'Personal new password 456!';
  async function request(action, method = 'GET', input, cookie, headers = {}) {
    const result = await cmsAuth.handler({ httpMethod: method, headers: { origin, cookie, 'content-type': 'application/json', 'x-nf-client-connection-ip': randomUUID(), ...headers }, queryStringParameters: { action }, body: input === undefined ? undefined : JSON.stringify(input) });
    return { status: result.statusCode, data: JSON.parse(result.body), cookie: result.headers['Set-Cookie']?.split(';')[0], headers: result.headers };
  }
  async function createUser(extra = {}) {
    const input = { email: `${randomUUID()}@example.com`, name: 'Nowy użytkownik', role: 'editor', active: true, password, ...extra };
    const response = await request('users', 'POST', input, adminCookie());
    assert.equal(response.status, 201, JSON.stringify(response.data)); return { ...response.data.user, password: input.password };
  }
  async function content(method, query, input, cookie = adminCookie(), extraHeaders = {}) {
    const result = await cmsContent.handler({ httpMethod: method, headers: { origin, cookie, 'content-type': 'application/json', ...extraHeaders }, queryStringParameters: query, body: input ? JSON.stringify(input) : undefined });
    return { status: result.statusCode, data: JSON.parse(result.body) };
  }
  test('CMS: password hashes, login, opaque HttpOnly sessions, logout and expiry', async () => {
    const result = await request('login', 'POST', { email: 'ADMIN@EXAMPLE.COM', password: adminPassword });
    assert.equal(result.status, 200); assert.match(result.headers['Set-Cookie'], /HttpOnly; SameSite=Strict/);
    assert.equal(result.data.user.password_hash, undefined);
    const { rows: [row] } = await store.database().query("SELECT * FROM cms_users WHERE email='admin@example.com'");
    assert.notEqual(row.password_hash, adminPassword); assert.ok(await auth.verifyPassword(adminPassword, row.password_hash));
    assert.equal((await request('session', 'GET', undefined, result.cookie)).status, 200);
    assert.equal((await request('session', 'GET', undefined, undefined, { authorization: 'Bearer old_github_token' })).status, 401);
    await request('logout', 'POST', {}, result.cookie);
    assert.equal((await request('session', 'GET', undefined, result.cookie)).status, 401);
    const next = await request('login', 'POST', { email: row.email, password: adminPassword });
    await store.database().query('UPDATE cms_sessions SET expires_at=now()-interval \'1 second\' WHERE token_hash=$1', [auth.digest(next.cookie.split('=')[1])]);
    assert.equal((await request('session', 'GET', undefined, next.cookie)).status, 401);
    process.env.CMS_ORIGIN = 'https://polacywbelgii.eu';
    try { assert.match(auth.sessionCookie('test'), /^__Host-pbe_session=.*; Secure$/); } finally { process.env.CMS_ORIGIN = origin; }
  });
  test('CMS: origin checks, no public registration and durable login throttling', async () => {
    assert.equal((await request('login', 'POST', { email: 'admin@example.com', password: adminPassword }, undefined, { origin: 'https://evil.example' })).status, 403);
    assert.equal((await request('users', 'POST', { email: 'attacker@example.com' })).status, 401);
    const email = `${randomUUID()}@example.com`;
    const first = await request('login', 'POST', { email, password }); assert.equal(first.data.error, 'invalidCredentials');
    const key = auth.digest(`login:account:${email}`);
    await store.database().query('UPDATE cms_login_limits SET attempts=10 WHERE key=$1', [key]);
    assert.equal((await request('login', 'POST', { email, password })).status, 429);
    assert.equal((await request('login', 'POST', { email: 'admin@example.com', password: 'wrong password 999!' })).data.error, first.data.error);
  });
  test('CMS: forced password change, editor permissions, account blocking and session revocation', async () => {
    const user = await createUser();
    const logged = await request('login', 'POST', { email: user.email, password });
    assert.equal(logged.data.user.mustChangePassword, true);
    assert.equal((await content('GET', { path: 'src/_data/home.json' }, null, logged.cookie)).data.error, 'passwordChangeRequired');
    assert.equal((await request('users', 'GET', null, logged.cookie)).status, 403);
    const changed = await request('password', 'POST', { currentPassword: password, password: newPassword }, logged.cookie);
    assert.equal(changed.status, 200); assert.notEqual(changed.cookie, logged.cookie);
    assert.equal((await request('session', 'GET', null, logged.cookie)).status, 401);
    assert.equal((await request('users', 'GET', null, changed.cookie)).data.error, 'forbidden');
    const list = await request('users', 'GET', null, adminCookie());
    const current = list.data.users.find(item => item.id === user.id);
    const blocked = await request('users', 'PUT', { ...current, active: false }, adminCookie());
    assert.equal(blocked.status, 200);
    assert.equal((await request('session', 'GET', null, changed.cookie)).status, 401);
    assert.equal((await request('login', 'POST', { email: user.email, password: newPassword })).data.error, 'invalidCredentials');
    assert.equal((await request('users', 'PUT', { ...current, active: true }, adminCookie())).data.error, 'conflict');
    const own = list.data.users.find(item => item.email === 'admin@example.com');
    assert.equal((await request('users', 'PUT', { ...own, active: false }, adminCookie())).data.error, 'selfModification');
  });
  test('CMS: administrator password reset invalidates sessions and requires a new password', async () => {
    const user = await createUser(); const login = await request('login', 'POST', { email: user.email, password });
    const reset = await request('users', 'PUT', { ...user, password: newPassword }, adminCookie());
    assert.equal(reset.status, 200);
    assert.equal((await request('session', 'GET', null, login.cookie)).status, 401);
    assert.equal((await request('login', 'POST', { email: user.email, password })).status, 401);
    assert.equal((await request('login', 'POST', { email: user.email, password: newPassword })).data.user.mustChangePassword, true);
  });
  test('CMS: content proxy restricts paths, templates, methods and credentials', async () => {
    assert.equal((await content('GET', { path: 'src/_data/home.json' }, null, '')).status, 401);
    for (const filename of ['.github/workflows/deploy.yml', '.eleventy.js', 'src/content/articles/../../admin-app/app.js', 'src/content/articles/articles.json', 'https://evil.example']) assert.equal((await content('PUT', { path: filename }, { content: '' })).status, 403);
    assert.equal((await content('DELETE', { path: 'src/_data/home.json' }, { sha: 'a'.repeat(40) })).status, 403);
    for (const text of ['---\ntitle: "Danger"\npermalink: /admin/index.html\n---\nHello', '---\ntitle: "Danger"\ndate: "2026-01-01"\n---\n{{ process }}']) assert.equal((await content('PUT', { path: 'src/content/articles/danger.md' }, { content: Buffer.from(text).toString('base64') })).status, 400);
    assert.equal((await content('PUT', { path: 'src/_data/home.json' }, {}, adminCookie(), { origin: 'https://evil.example' })).status, 403);
    process.env.CMS_GITHUB_TOKEN = 'server_only_test_token';
    let observed;
    globalThis.fetch = async (url, options) => { observed = { url, options }; return { ok: true, status: 200, json: async () => ({ content: { sha: 'a'.repeat(40) } }) }; };
    try {
      const markdown = await readFile('src/content/articles/test.md', 'utf8');
      const result = await content('PUT', { path: 'src/content/articles/test.md', repo: 'attacker/repo', branch: 'bad' }, { content: Buffer.from(markdown).toString('base64'), branch: 'bad' });
      assert.equal(result.status, 200); assert.equal(observed.options.headers.Authorization, 'Bearer server_only_test_token');
      assert.equal(JSON.parse(observed.options.body).branch, 'main');
      assert.match(observed.url, /puczynskimaciej-debug\/poradnik-polaka-w-belgii\/contents/);
      assert.ok(!JSON.stringify(result).includes('server_only_test_token'));
    } finally { globalThis.fetch = originalFetch; }
  });
  test('deployment readiness blocks missing configuration and health reveals no diagnostics', async () => {
    const previous = process.env.CMS_GITHUB_TOKEN;
    try {
      delete process.env.CMS_GITHUB_TOKEN;
      const incomplete = await deployment.readiness();
      assert.equal(incomplete.ready, false);
      assert.equal(incomplete.checks.databaseReachable, true);
      assert.equal(incomplete.checks.migrationsApplied, true);
      assert.equal(incomplete.checks.publishingConfigured, false);
      const unavailable = await health.handler({ httpMethod: 'GET' });
      assert.equal(unavailable.statusCode, 503);
      assert.deepEqual(JSON.parse(unavailable.body), { ready: false });
      process.env.CMS_GITHUB_TOKEN = 'test_only_not_a_real_token';
      const complete = await deployment.readiness();
      assert.equal(complete.ready, true);
      const available = await health.handler({ httpMethod: 'GET' });
      assert.equal(available.statusCode, 200);
      assert.deepEqual(JSON.parse(available.body), { ready: true });
    } finally {
      if (previous === undefined) delete process.env.CMS_GITHUB_TOKEN; else process.env.CMS_GITHUB_TOKEN = previous;
    }
  });
  test('CMS browser: email login, create editor, first password change, edit content, logout', async () => {
    await store.database().query('TRUNCATE cms_login_limits');
    const files = new Map();
    for (const filename of ['src/_data/home.json', 'src/_data/site.json', 'src/content/articles/test.md', 'src/content/articles/test-praca.md', 'src/content/articles/test-weekend.md']) files.set(filename, await readFile(filename, 'utf8'));
    const filePayload = (filename, text) => ({ name: filename.split('/').pop(), path: filename, type: 'file', sha: createHash('sha1').update(text).digest('hex'), encoding: 'base64', content: Buffer.from(text).toString('base64') });
    globalThis.fetch = async (url, options = {}) => {
      if (!String(url).startsWith('https://api.github.com/')) return originalFetch(url, options);
      const pathname = decodeURIComponent(new URL(url).pathname); const filename = pathname.split('/contents/')[1];
      let payload;
      if (pathname.endsWith('/commits')) payload = [];
      else if (options.method === 'PUT') { const input = JSON.parse(options.body); files.set(filename, Buffer.from(input.content, 'base64').toString()); payload = { content: filePayload(filename, files.get(filename)) }; }
      else if (files.has(filename)) payload = filePayload(filename, files.get(filename));
      else if (filename === 'src/Images/uploads') payload = [];
      else if (filename === 'src/content/articles') payload = [...files].filter(([key]) => key.startsWith(filename + '/')).map(([key, value]) => filePayload(key, value));
      else return { ok: false, status: 404 };
      return { ok: true, status: 200, json: async () => payload };
    };
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, origin);
      const handler = { '/.netlify/functions/cms-auth': cmsAuth.handler, '/.netlify/functions/cms-content': cmsContent.handler, '/.netlify/functions/ads': ads.handler }[url.pathname];
      if (handler) {
        let body = ''; for await (const part of req) body += part;
        const result = await handler({ httpMethod: req.method, headers: req.headers, queryStringParameters: Object.fromEntries(url.searchParams), body });
        res.writeHead(result.statusCode, result.headers); res.end(result.isBase64Encoded ? Buffer.from(result.body, 'base64') : result.body); return;
      }
      const filename = path.resolve('_site', '.' + (url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname));
      if (!filename.startsWith(path.resolve('_site') + path.sep)) { res.writeHead(403); res.end(); return; }
      try { const bytes = await readFile(filename); res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(filename)] || 'application/octet-stream'); res.end(bytes); }
      catch { res.writeHead(404); res.end(); }
    });
    await new Promise(resolve => server.listen(8089, '127.0.0.1', resolve));
    const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
    try {
      const page = await browser.newPage(); const errors = []; const githubRequests = [];
      page.on('pageerror', error => errors.push(error.message)); page.on('request', req => { if (req.url().includes('api.github.com')) githubRequests.push(req.url()); });
      await page.goto(origin + '/admin/'); await page.locator('#login-form').waitFor({ state: 'visible' });
      for (const width of [360, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await page.screenshot({ path: `test-results/cms-login-${width}.png`, fullPage: true }); }
      await page.locator('#login-form [name="email"]').fill('admin@example.com'); await page.locator('#login-form [name="password"]').fill(adminPassword); await page.locator('#login-form button').click();
      await page.locator('#app-view').waitFor({ state: 'visible' }); await page.waitForFunction(() => document.querySelector('#article-count').textContent === '3');
      await page.locator('[data-view="users"]').click(); await page.locator('[data-action="new-user"]').click();
      const email = `${randomUUID()}@example.com`;
      for (const [key, value] of Object.entries({ name: 'Redaktor testowy', email, password })) await page.locator(`#user-form [name="${key}"]`).fill(value);
      await page.locator('#user-form [type="submit"]').click(); await page.waitForFunction(() => !document.querySelector('#user-dialog').open);
      await page.locator('#logout-button').click(); await page.locator('#login-form').waitFor({ state: 'visible' });
      await page.locator('#login-form [name="email"]').fill(email); await page.locator('#login-form [name="password"]').fill(password); await page.locator('#login-form button').click();
      await page.locator('#password-view').waitFor({ state: 'visible' });
      await page.locator('#account-password-form [name="currentPassword"]').fill(password);
      await page.locator('#account-password-form [name="password"]').fill(newPassword); await page.locator('#account-password-form [name="confirmPassword"]').fill(newPassword);
      await page.locator('#account-password-form [type="submit"]').click(); await page.locator('#app-view').waitFor({ state: 'visible' });
      assert.equal(await page.locator('[data-view="users"]').isVisible(), false);
      assert.equal(await page.evaluate(() => document.cookie), '');
      assert.equal(await page.evaluate(() => sessionStorage.getItem('pbe_github_token')), null);
      await page.waitForFunction(() => document.querySelector('#article-count').textContent === '3');
      await page.locator('[data-view="articles"]').click(); await page.locator('[data-edit-article="test"]').click();
      await page.locator('#article-form [name="title"]').fill('Artykuł zapisany bez konta GitHub');
      await page.locator('#article-form [type="submit"]').click(); await page.waitForFunction(() => !document.querySelector('#article-dialog').open);
      assert.match(files.get('src/content/articles/test.md'), /Artykuł zapisany bez konta GitHub/);
      await page.locator('[data-view="ads"]').click(); await page.waitForFunction(() => document.querySelector('#ads-prices').children.length > 0);
      await page.locator('#logout-button').click(); await page.locator('#login-form').waitFor({ state: 'visible' });
      assert.deepEqual(githubRequests, []); assert.deepEqual(errors, []);
    } finally { globalThis.fetch = originalFetch; await browser.close(); await new Promise(resolve => server.close(resolve)); }
  });
}

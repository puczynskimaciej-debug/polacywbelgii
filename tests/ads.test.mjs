import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import EmbeddedPostgres from 'embedded-postgres';
import { chromium } from 'playwright-core';
import domain from '../server/ads-domain.js';
import store from '../server/ads-store.js';
import ads from '../server/handlers/ads.js';
import cmsAuth from '../server/handlers/cms-auth.js';
import cmsContent from '../server/handlers/cms-content.js';
import auth from '../server/cms-auth.js';
import { registerCmsTests } from './cms-cases.mjs';

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5S8AAAAASUVORK5CYII=';
const day = domain.today();
const plus = n => new Date(Date.parse(day) + n * 86400000).toISOString().slice(0, 10);
const cluster = new EmbeddedPostgres({ databaseDir: path.resolve('test-results', `postgres-${randomUUID()}`), port: 55439, user: 'postgres', password: 'local-test-only', persistent: true, onLog: () => {}, onError: () => {} });
const originalFetch = globalThis.fetch;
let adminCookie;
const adminPassword = 'Test-only password 123456!';
const origin = 'http://127.0.0.1:8089';
const sample = (extra = {}) => ({ language: 'pl', type: 'STANDARD', startDate: day, endDate: day, company: 'Firma', title: 'Reklama', description: 'Opis reklamy', image, url: 'https://example.com', customerName: 'Jan Kowalski', email: 'jan@example.com', phone: '', consent: true, requestId: randomUUID(), expectedDailyPrice: 400, expectedTotalPrice: 400, ...extra });
async function call(action, method = 'GET', body, query = {}, admin = false) {
  const result = await ads.handler({ httpMethod: method, headers: { 'content-type': 'application/json', origin, 'x-nf-client-connection-ip': randomUUID(), ...(admin ? { cookie: adminCookie } : {}) }, queryStringParameters: { action, ...query }, body: body ? JSON.stringify(body) : undefined });
  return { status: result.statusCode, data: JSON.parse(result.body) };
}
async function reset() {
  await store.database().query('TRUNCATE ad_orders,ads_settings,ad_rate_limits');
  const settings = domain.defaults();
  for (const market of Object.values(settings.markets)) { market.enabled = true; market.prices = { TOP: 1000, STANDARD: 400 }; }
  await store.database().query('INSERT INTO ads_settings(id,data) VALUES(1,$1)', [settings]);
}
before(async () => {
  await mkdir('test-results', { recursive: true });
  await cluster.initialise(); await cluster.start();
  process.env.DATABASE_URL = 'postgresql://postgres:local-test-only@127.0.0.1:55439/postgres';
  process.env.CMS_ORIGIN = origin;
  await store.database().query(await readFile('deploy/ads.sql', 'utf8'));
  await store.database().query(await readFile('deploy/cms.sql', 'utf8'));
  const id = randomUUID();
  await store.database().query("INSERT INTO cms_users(id,email,name,password_hash,role,must_change_password) VALUES($1,'admin@example.com','Test Administrator',$2,'admin',false)", [id, await auth.hashPassword(adminPassword)]);
  adminCookie = auth.sessionCookie(await auth.newSession(store.database(), id)).split(';')[0];
});
after(async () => {
  globalThis.fetch = originalFetch; await store.database().end();
  const stopped = cluster.stop();
  // pg_ctl also works in restricted Windows sessions where taskkill is denied.
  if (process.platform === 'win32') await promisify(execFile)(path.resolve('node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe'), ['stop', '-D', cluster.options.databaseDir, '-m', 'fast', '-w'], { windowsHide: true });
  await stopped;
});

test('showcase ads stay active until cancelled and retain their marker after CMS edits', async () => {
  await reset();
  const created = await call('admin-order', 'POST', sample({ complimentary: true }), {}, true);
  assert.equal(created.status, 201);
  const order = { ...created.data, demoSet: 'showcase-2026-09-29' };
  await store.database().query('UPDATE ad_orders SET data=$1 WHERE id=$2', [order, order.id]);
  assert.equal(domain.status(order, '2035-01-01'), 'active');
  assert.equal(domain.status({ ...order, demoSet: undefined }, '2035-01-01'), 'ended');
  assert.equal(domain.availability([order], domain.defaults(), 'pl', 'STANDARD', '2035-01-01', '2035-01-01')[0].used, 1);
  const edited = await call('admin-order', 'PUT', { ...order, status: 'cancelled' }, {}, true);
  assert.equal(edited.status, 200);
  assert.equal(edited.data.demoSet, order.demoSet);
  assert.equal(domain.status(edited.data, '2035-01-01'), 'cancelled');
  assert.equal(domain.availability([edited.data], domain.defaults(), 'pl', 'STANDARD', '2035-01-01', '2035-01-01')[0].used, 0);
});

test('inclusive dates, leap years, Brussels timezone, strict inputs and privacy', () => {
  assert.equal(domain.dates('2028-02-28', '2028-03-01').length, 3);
  assert.equal(domain.dates('2026-11-10', '2026-11-19').length, 10);
  assert.throws(() => domain.dates('2026-02-30', '2026-03-02'));
  assert.equal(domain.today(new Date('2026-06-01T22:30:00Z')), '2026-06-02');
  assert.throws(() => domain.creative(sample({ url: 'javascript:alert(1)' })));
  assert.throws(() => domain.creative(sample({ image: 'data:image/svg+xml;base64,AAAA' })));
  assert.throws(() => domain.creative(sample({ image: 'data:image/png;base64,AAAA' })));
  assert.equal(domain.publicAd(sample()).email, undefined);
});
test('real concurrent PostgreSQL transactions: 10 STANDARD, 2 TOP, independent languages', async () => {
  await reset();
  const results = await Promise.all(Array.from({ length: 11 }, () => call('order', 'POST', sample())));
  assert.equal(results.filter(result => result.status === 201).length, 10);
  assert.equal(results.filter(result => result.data.error === 'full').length, 1);
  const top = await Promise.all(Array.from({ length: 3 }, () => call('order', 'POST', sample({ type: 'TOP', expectedDailyPrice: 1000, expectedTotalPrice: 1000 }))));
  assert.equal(top.filter(result => result.status === 201).length, 2);
  assert.equal(top.filter(result => result.data.error === 'full').length, 1);
  assert.equal((await call('order', 'POST', sample({ language: 'fr' }))).status, 201);
  const blocked = await call('order', 'POST', sample({ endDate: plus(5), expectedTotalPrice: 2400 }));
  assert.equal(blocked.data.error, 'full'); assert.equal(blocked.data.details[0].date, day);
});
test('price is server-owned, snapshot survives price change, request retries are idempotent', async () => {
  await reset();
  const input = sample({ endDate: plus(9), expectedTotalPrice: 4000, totalPrice: 1, dailyPrice: 1 });
  const result = await call('order', 'POST', input); assert.equal(result.data.totalPrice, 4000);
  const retry = await call('order', 'POST', input); assert.equal(result.data.id, retry.data.id);
  assert.equal((await store.orders()).length, 1);
  const changed = domain.defaults(); for (const market of Object.values(changed.markets)) { market.enabled = true; market.prices = { TOP: 1200, STANDARD: 500 }; }
  assert.equal((await call('admin-settings', 'PUT', { data: changed, version: 1 }, {}, true)).status, 200);
  assert.equal((await store.orders())[0].dailyPrice, 400);
  assert.equal((await call('order', 'POST', sample())).data.error, 'priceChanged');
  assert.equal((await call('order', 'POST', sample({ expectedDailyPrice: 1, expectedTotalPrice: 1 }))).data.error, 'priceChanged');
});
test('status transitions, visibility, cancellation, admin editing and privacy', async () => {
  await reset();
  const created = await call('admin-order', 'POST', sample({ status: 'approved' }), {}, true);
  assert.equal(created.status, 201);
  const order = created.data;
  assert.equal(domain.status({ ...order, startDate: plus(1) }), 'scheduled');
  assert.equal(domain.status(order), 'active');
  assert.equal(domain.status({ ...order, endDate: plus(-1) }), 'ended');
  assert.equal(domain.status({ ...order, status: 'pending' }), 'pending');
  const publicResult = await call('public', 'GET', null, { language: 'pl' });
  assert.equal(publicResult.data.ads.length, 1); assert.equal(publicResult.data.ads[0].email, undefined);
  assert.equal((await call('public', 'GET', null, { language: 'fr' })).data.ads.length, 0);
  const cancelled = await call('admin-order', 'PUT', { id: order.id, version: order.version, status: 'cancelled' }, {}, true);
  assert.equal(cancelled.status, 200);
  assert.equal((await call('public', 'GET', null, { language: 'pl' })).data.ads.length, 0);
  assert.equal((await call('admin-order', 'PUT', { id: order.id, version: order.version, status: 'approved' }, {}, true)).data.error, 'conflict');
  const availability = await call('availability', 'GET', null, sample());
  assert.equal(availability.data.daysAvailable[0].remaining, 10);
  assert.equal(JSON.stringify(availability.data).includes('jan@example'), false);
  assert.equal((await call('admin-orders')).status, 401);
  assert.equal((await call('admin-settings', 'PUT', { data: domain.defaults() })).status, 401);
});
test('manual capacity checks and moving a booking cannot bypass capacity; free campaigns', async () => {
  await reset();
  for (let i = 0; i < 2; i++) assert.equal((await call('admin-order', 'POST', sample({ type: 'TOP', complimentary: true }), {}, true)).status, 201);
  assert.equal((await call('admin-order', 'POST', sample({ type: 'TOP' }), {}, true)).data.error, 'full');
  const future = (await call('admin-order', 'POST', sample({ type: 'TOP', startDate: plus(1), endDate: plus(1), complimentary: true }), {}, true)).data;
  assert.equal(future.totalPrice, 0);
  assert.equal((await call('admin-order', 'PUT', { id: future.id, version: future.version, startDate: day, endDate: day }, {}, true)).data.error, 'full');
  assert.equal((await call('admin-orders', 'GET', null, {}, true)).data.orders.filter(order => order.effectiveStatus === 'scheduled').length, 1);
});

test('interior full day blocks the whole range; disabled market and stale updates fail safely', async () => {
  await reset();
  for (let i = 0; i < 2; i++) await call('admin-order', 'POST', sample({ type: 'TOP', startDate: plus(2), endDate: plus(2) }), {}, true);
  const blocked = await call('order', 'POST', sample({ type: 'TOP', endDate: plus(4), expectedDailyPrice: 1000, expectedTotalPrice: 5000 }));
  assert.equal(blocked.data.error, 'full'); assert.deepEqual(blocked.data.details.map(item => item.date), [plus(2)]);
  const settings = (await store.settings()).data; settings.markets.pl.enabled = false;
  assert.equal((await call('admin-settings', 'PUT', { data: settings, version: 1 }, {}, true)).status, 200);
  assert.equal((await call('admin-settings', 'PUT', { data: settings, version: 1 }, {}, true)).data.error, 'conflict');
  assert.equal((await call('order', 'POST', sample())).data.error, 'disabled');
  assert.equal((await call('order', 'POST', sample({ language: 'fr', status: 'approved', paymentStatus: 'paid' }))).data.status, 'pending');
  assert.equal((await store.orders()).find(order => order.language === 'fr').paymentStatus, 'unpaid');
});

test('public API excludes future, expired and pending advertisements without a rebuild', async () => {
  await reset();
  await call('admin-order', 'POST', sample({ title: 'Now' }), {}, true);
  await call('admin-order', 'POST', sample({ title: 'Future', startDate: plus(1), endDate: plus(1) }), {}, true);
  await call('order', 'POST', sample({ title: 'Pending' }));
  const expired = { ...(await store.orders())[0], id: randomUUID(), status: 'approved', title: 'Expired', startDate: plus(-2), endDate: plus(-1) };
  await store.database().query('INSERT INTO ad_orders(id,data) VALUES($1,$2)', [expired.id, expired]);
  assert.deepEqual((await call('public', 'GET', null, { language: 'pl' })).data.ads.map(ad => ad.title), ['Now']);
});

test('browser: real order, language switching, calendar, CMS and responsive layouts', async () => {
  await reset();
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const handler = { '/.netlify/functions/ads': ads.handler, '/.netlify/functions/cms-auth': cmsAuth.handler, '/.netlify/functions/cms-content': cmsContent.handler }[url.pathname];
    if (handler) {
      let body = ''; for await (const part of request) body += part;
      const result = await handler({ httpMethod: request.method, headers: request.headers, queryStringParameters: Object.fromEntries(url.searchParams), body });
      response.writeHead(result.statusCode, result.headers); response.end(result.isBase64Encoded ? Buffer.from(result.body, 'base64') : result.body); return;
    }
    const filename = path.resolve('_site', '.' + (url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname));
    if (!filename.startsWith(path.resolve('_site') + path.sep)) { response.writeHead(403); response.end(); return; }
    try { const bytes = await readFile(filename); response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' })[path.extname(filename)] || 'application/octet-stream'); response.end(bytes); }
    catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(8089, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  try {
    const page = await browser.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8089/zamow-ogloszenie/');
    await page.locator('#order-form').waitFor({state:'visible'});
    assert.equal(await page.locator('#order-calendar-step').isVisible(),false);
    await page.locator('[name=type][value=STANDARD]').check();
    await page.locator('[name=languages][value=fr]').check();
    await page.locator('#order-calendar button:not([disabled])').first().click();
    await page.locator('[data-copy=pl]').fill('Browser advert');
    await page.locator('[data-copy=fr]').fill('Annonce française');
    await page.locator('#order-form [name=contact]').fill('+32 123 456');
    await page.locator('#order-form [name=email]').fill('private@example.com');
    await page.locator('#order-form [name=consent]').check();
    await page.locator('#order-review').click();
    const submitted=page.waitForResponse(response=>response.url().includes('action=order-batch'));
    await page.locator('#order-confirm .button').click();
    const submittedResponse=await submitted;assert.equal(submittedResponse.status(),201,await submittedResponse.text());
    await page.waitForFunction(() => document.querySelector('#order-confirm').textContent.includes('Zamówienie zapisane'));
    assert.equal((await store.orders()).length,2);
    await page.locator('#order-close').click();
    for (const language of ['pl', 'fr']) await call('admin-order', 'POST', sample({ language, title: `Visible ${language}`, type: 'TOP' }), {}, true);
    await call('admin-order','POST',sample({kind:'text',type:'TOP',description:'Usługi dla mieszkańców Belgii. '.repeat(10),contact:'Telefon: +32 123 456'}),{},true);
    for (let i = 0; i < 9; i++) await call('admin-order', 'POST', sample({ title: `Standard ${i}` }), {}, true);
    await page.goto('http://127.0.0.1:8089/'); await page.waitForSelector('#ads-top .ad-card');
    assert.match(await page.locator('#ads-top').textContent(), /Visible pl/);
    assert.equal(await page.locator('#ads-top .ad-card').count(),2);
    assert.ok(await page.evaluate(()=>document.querySelector('#ads-top').getBoundingClientRect().bottom<=document.querySelector('.hero').getBoundingClientRect().top));
    await page.locator('.language-picker__button').click(); await page.locator('[data-lang="fr"]').click();
    await page.waitForFunction(() => document.querySelector('#ads-top').textContent.includes('Visible fr'));
    assert.doesNotMatch(await page.locator('#ads-top').textContent(), /Visible pl/);
    await page.locator('.hero a[href="/zamow-ogloszenie/"]').click();
    await page.locator('#order-form').waitFor();
    assert.equal(new URL(page.url()).pathname,'/');
    assert.equal(await page.locator('#order-title').textContent(),'Publier une annonce');
    assert.equal(await page.locator('[name=languages]').first().inputValue(),'pl');
    assert.equal(await page.locator('[name=languages][value=pl]').isChecked(),true);
    await page.locator('#order-close').click();
    await page.locator('.language-picker__button').click(); await page.locator('[data-lang="pl"]').click();
    await page.waitForSelector('#ads-standard .ad-card');
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: `test-results/ads-home-${width}.png`, fullPage: true });
    }
    await page.goto('http://127.0.0.1:8089/zamow-ogloszenie/');
    await page.locator('#order-form').waitFor(); await page.locator('[name=type][value=TOP]').check(); await page.waitForSelector('#order-calendar button');
    for (const width of [360, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await page.screenshot({ path: `test-results/ads-order-${width}.png`, fullPage: true }); }
    // Isolate the advertising CMS module while preserving the actual CMS HTML/CSS and API.
    await page.route('**/admin/app.js', route => route.fulfill({ contentType: 'text/javascript', body: "document.querySelector('#auth-view').hidden=true;document.querySelector('#app-view').hidden=false;document.querySelectorAll('.view').forEach(p=>p.classList.toggle('is-active',p.dataset.panel==='ads'));" }));
    await page.context().addCookies([{ name: 'pbe_session_dev', value: adminCookie.split('=')[1], url: origin, httpOnly: true, sameSite: 'Strict' }]);
    await page.goto('http://127.0.0.1:8089/admin/'); await page.locator('#ads-refresh').click();
    await page.waitForSelector('[data-ad-edit]');
    await page.locator('#ads-filters [name="status"]').selectOption('pending');
    assert.equal(await page.locator('[data-ad-edit]').count(), 1);
    await page.locator('[data-ad-edit]').first().click();
    await page.locator('#ads-dialog').waitFor({ state: 'visible' });
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.locator('#ads-dialog').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
      await page.screenshot({ path: `test-results/ads-dialog-${width}.png` });
    }
    await page.locator('#ads-edit [name="status"]').selectOption('approved');
    await page.locator('#ads-save').click();
    await page.waitForFunction(() => !document.querySelector('#ads-dialog').open);
    assert.equal((await store.orders()).find(order => order.title === 'Browser advert').status, 'approved');
    for (const width of [360, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await page.screenshot({ path: `test-results/ads-cms-${width}.png`, fullPage: true }); }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});

test('multi-language orders are atomic, idempotent and keep customer email private', async () => {
  await reset();
  const body={requestId:randomUUID(),type:'TOP',dates:[day,plus(2)],variants:[{language:'pl',text:'Polskie ogłoszenie'},{language:'fr',text:'Annonce française'}],contact:'+32 123',email:'private@example.com',consent:true,expectedTotalPrice:4000};
  const first=await call('order-batch','POST',body); assert.equal(first.status,201);assert.equal(first.data.totalPrice,4000);
  const retry=await call('order-batch','POST',body);assert.equal(retry.data.id,first.data.id);assert.equal((await store.orders()).length,4);
  await call('admin-order','POST',sample({type:'TOP',language:'fr',startDate:plus(2),endDate:plus(2)}),{},true);
  const blocked=await call('order-batch','POST',{...body,requestId:randomUUID()});assert.equal(blocked.status,409);assert.equal((await store.orders()).length,5);
  const pl=(await store.orders()).find(o=>o.language==='pl'&&o.startDate===day);
  const approved=await call('admin-order','PUT',{...pl,status:'approved'}, {},true);assert.equal(approved.status,200);
  const pub=await call('public','GET',null,{language:'pl'});assert.equal(pub.data.ads[0].contact,'+32 123');assert.ok(!JSON.stringify(pub.data).includes('private@example.com'));
  assert.equal((await call('order-batch','POST',{...body,requestId:randomUUID(),variants:[{language:'nl',text:'x'.repeat(401)}]})).status,400);
});

registerCmsTests({ store, auth, cmsAuth, cmsContent, ads, originalFetch, origin, adminPassword, adminCookie: () => adminCookie });

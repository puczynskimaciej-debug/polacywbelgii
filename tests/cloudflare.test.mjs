import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomUUID, webcrypto } from 'node:crypto';
import domain from '../server/ads-domain.js';
import { handleAds as adsRoute } from '../cloudflare/ads.mjs';
import { hashPassword, login, currentUser, logout } from '../cloudflare/auth.mjs';
import { sha256 } from '../cloudflare/common.mjs';
import { onRequest as aiEditorRoute } from '../cloudflare/ai-editor.mjs';
import { handleAdsPayment } from '../cloudflare/ads-payment.mjs';
import { publishDue } from '../cloudflare/publication.mjs';
import { publicEntry, publicEntries } from '../cloudflare/public-pages.mjs';

test('D1 publication tick requires approval, is idempotent, and withdrawal hides direct URL', async () => {
  const DB = localDb();
  DB.sqlite.exec(readFileSync(new URL('../agent/migrations/001_agent.sql', import.meta.url), 'utf8'));
  DB.sqlite.exec(readFileSync(new URL('../agent/migrations/002_editorial.sql', import.meta.url), 'utf8'));
  DB.sqlite.exec(readFileSync(new URL('../agent/migrations/003_content.sql', import.meta.url), 'utf8'));
  DB.sqlite.exec(readFileSync(new URL('../agent/migrations/006_article_fields.sql', import.meta.url), 'utf8'));
  DB.sqlite.exec(readFileSync(new URL('../agent/migrations/007_article_publication.sql', import.meta.url), 'utf8'));
  const good = '1'.repeat(20), bad = '2'.repeat(20);
  for (const id of [good,bad]) DB.sqlite.prepare('INSERT INTO ai_candidates(id,kind,status,title,description,body,sources_json,verification_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,'article','pending_review',`Article ${id}`,'Description','Body','[]','{}','2026-01-01','2026-01-01');
  for (const id of [good,bad]) DB.sqlite.prepare("INSERT INTO ai_editorial(candidate_id,status,owner_kind,owner_id,updated_at) VALUES(?,'pending_review','agent','agent','2026-01-01')").run(id);
  DB.sqlite.prepare("UPDATE ai_editorial SET status='scheduled',scheduled_at='2026-01-02T00:00:00Z',approved_by='admin',approved_at='2026-01-01T00:00:00Z' WHERE candidate_id=?").run(good);
  DB.sqlite.prepare('UPDATE ai_candidates SET verification_json=? WHERE id=?').run(JSON.stringify({ status:'verified' }),good);
  DB.sqlite.prepare('UPDATE ai_candidates SET article_fields_json=? WHERE id=?').run(JSON.stringify({title_nl:'Nederlandse titel',description_nl:'Beschrijving',body_nl:'Nederlandse tekst',title_fr:'Titre français',description_fr:'Description',body_fr:'Texte français',image:'/images/uploads/test.png',tags:'Belgia, poradnik'}),good);
  DB.sqlite.prepare("UPDATE ai_editorial SET status='scheduled',scheduled_at='2026-01-03T00:00:00Z' WHERE candidate_id=?").run(bad);
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) AS n FROM ai_editorial WHERE status='scheduled' AND public_state='hidden' AND approved_by IS NOT NULL AND approved_at IS NOT NULL AND scheduled_at<='2026-01-04T00:00:00.000Z'").get().n,1);
  assert.deepEqual((await publishDue(DB,new Date('2026-01-04T00:00:00Z'))).published,[good]);
  assert.deepEqual((await publishDue(DB,new Date('2026-01-04T00:00:00Z'))).published,[]);
  assert.equal((await publicEntry(DB,`ai-${good}`)).title,`Article ${good}`);
  assert.equal((await publicEntry(DB,`ai-${good}`)).title_nl,'Nederlandse titel');
  assert.equal((await publicEntry(DB,`ai-${good}`)).image,'/images/uploads/test.png');
  assert.equal(await publicEntry(DB,`ai-${bad}`),null);
  assert.equal((await publicEntries(DB,'article')).length,1);
  DB.sqlite.prepare("UPDATE ai_editorial SET status='archived',public_state='hidden' WHERE candidate_id=?").run(good);
  assert.equal(await publicEntry(DB,`ai-${good}`),null);
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) AS n FROM ai_candidate_history WHERE candidate_id=? AND new_status='published'").get(good).n,1);
});

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

test('sparse ad dates preserve exact 24-hour periods and count overlapping slots once', async () => {
  const today = domain.today();
  const add = days => new Date(Date.parse(today) + days * 86400000).toISOString().slice(0,10);
  for (const count of [1,2,10,90]) assert.equal(domain.selectedDates(Array.from({length:count},(_,index) => add(index))).length,count);
  assert.throws(() => domain.selectedDates(Array.from({length:91},(_,index) => add(index))),{code:'dates'});
  const dates = [add(2),add(5),add(10)];
  const periods = dates.map(date => domain.periodForDate(date));
  assert.deepEqual(periods.map(period => period.date),dates);
  assert.equal(periods.every(period => Date.parse(period.plannedEndAt) - Date.parse(period.plannedStartAt) === 86400000),true);
  const settings = domain.defaults(); settings.markets.pl.enabled = true; settings.markets.pl.prices.TOP = 1000;
  const overlapping = [{ id:'one', language:'pl', type:'TOP', status:'approved', source:'public', paymentStatus:'paid', periods:[{actualStartAt:'2027-01-01T10:00:00.000Z',actualEndAt:'2027-01-02T10:00:00.000Z'},{actualStartAt:'2027-01-02T00:00:00.000Z',actualEndAt:'2027-01-03T00:00:00.000Z'}] }];
  assert.equal(domain.availabilityWindow(overlapping,settings,'pl','TOP','2027-01-02T01:00:00.000Z','2027-01-02T02:00:00.000Z').used,1);
  const intermittent = {id:'gap',language:'pl',type:'TOP',source:'public',status:'approved',paymentStatus:'paid',periods:[{actualStartAt:'2027-01-01T00:00:00.000Z',actualEndAt:'2027-01-02T00:00:00.000Z'},{actualStartAt:'2027-01-05T00:00:00.000Z',actualEndAt:'2027-01-06T00:00:00.000Z'}]};
  assert.equal(domain.status(intermittent,'2027-01-03',new Date('2027-01-03T12:00:00Z')),'scheduled');
  assert.equal(domain.status(intermittent,'2027-01-05',new Date('2027-01-05T12:00:00Z')),'active');
  assert.equal(domain.quoteSelected(settings,{language:'pl',type:'TOP',dates}).totalPrice,3000);
  const DB = localDb(); DB.sqlite.prepare('INSERT INTO ads_settings(id,data,version) VALUES(1,?,1)').run(JSON.stringify(settings));
  const body = {requestId:randomUUID(),type:'TOP',kind:'text',region:'wallonia',primaryLanguage:'pl',dates,variants:[{language:'pl',text:'Sparse dates'}],contact:'test',email:'test@example.com',consent:true,termsAccepted:true,termsVersion:'draft-2026-11-11',earlyServiceRequest:false,expectedTotalPrice:3000};
  const response = await adsRoute({request:request('/api/ads?action=order-batch','POST',body),env:{DB}});
  assert.equal(response.status,201,await response.text());
  const saved = JSON.parse(DB.sqlite.prepare('SELECT data FROM ad_orders').get().data);
  assert.equal(saved.region,'wallonia'); assert.deepEqual(saved.periods.map(period => period.date),dates);
  assert.equal(saved.days,3); assert.equal(saved.totalPrice,3000);
});

test('administrator reschedules every sparse period in the same paid group', async () => {
  const DB = localDb(), settings = domain.defaults(); settings.markets.pl.enabled = true; settings.markets.pl.prices.TOP = 1000;
  DB.sqlite.exec(readFileSync(new URL('../deploy/cloudflare-d1-0003-stripe.sql', import.meta.url), 'utf8'));
  DB.sqlite.prepare('INSERT INTO ads_settings(id,data,version) VALUES(1,?,1)').run(JSON.stringify(settings));
  const now = Date.now(), add = days => new Date(Date.parse(domain.today()) + days * 86400000).toISOString().slice(0,10);
  const id = randomUUID(), groupId = randomUUID(), adminId = randomUUID(), token = 'C'.repeat(43);
  const periods = [add(1),add(4)].map(date => domain.periodForDate(date));
  const item = {id,groupId,source:'public',kind:'text',type:'TOP',language:'pl',status:'pending',paymentStatus:'paid',days:2,startDate:add(1),endDate:add(4),periods,version:1,createdAt:new Date(now).toISOString()};
  DB.sqlite.prepare('INSERT INTO ad_orders(id,data,created_at) VALUES(?,?,?)').run(id,JSON.stringify(item),item.createdAt);
  DB.sqlite.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(adminId,'sparse-admin@example.com','Admin','unused','admin');
  DB.sqlite.prepare('INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await sha256(token),adminId,'2099-01-01');
  const next = [add(8),add(12)];
  const result = await adsRoute({request:request('/api/ads?action=admin-reschedule-group','PUT',{id,version:1,dates:next},`__Host-pbe_session=${token}`),env:{DB}});
  assert.equal(result.status,200,await result.text());
  const saved = JSON.parse(DB.sqlite.prepare('SELECT data FROM ad_orders WHERE id=?').get(id).data);
  assert.deepEqual(saved.periods.map(period => period.date),next);
  assert.equal(saved.version,2);
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

test('D1 ads API enforces five TOP places per language', async () => {
  const DB = localDb();
  const config = domain.defaults();
  config.markets.pl.enabled = true;
  config.markets.pl.prices.TOP = 500;
  config.markets.pl.prices.STANDARD = 200;
  DB.sqlite.prepare('INSERT INTO ads_settings(id,data,version) VALUES(1,?,1)').run(JSON.stringify(config));
  const env = { DB };
  const day = new Date(Date.parse(domain.today()) + 86400000).toISOString().slice(0, 10);
  for (let i = 0; i < 6; i++) {
    const body = { kind: 'text', type: 'TOP', language: 'pl', startDate: day, endDate: day, description: `Ogłoszenie testowe ${i}`, contact: 'kontakt', email: 'test@example.com', consent: true, requestId: randomUUID(), expectedDailyPrice: 500, expectedTotalPrice: 500 };
    const response = await adsRoute({ request: request('/api/ads?action=order', 'POST', body), env });
    assert.equal(response.status, i < 5 ? 201 : 409, JSON.stringify(await response.json()));
  }
  const publicResponse = await adsRoute({ request: request('/api/ads?action=public&language=pl'), env });
  assert.equal(publicResponse.status, 200);
  assert.equal((await publicResponse.json()).ads.length, 0); // pending orders are not public
});

test('paid ad windows are exact 24-hour multiples across Belgian DST', () => {
  const now = new Date('2026-11-11T12:00:00Z');
  for (const days of [1, 2, 3, 7]) {
    const todayWindow = domain.windowFor('2026-11-11', days, now);
    assert.equal(Date.parse(todayWindow.endAt) - Date.parse(todayWindow.startAt), days * 86400000);
  }
  for (const date of ['2027-03-28', '2027-10-31']) {
    const future = domain.windowFor(date, 2, now);
    assert.equal(Date.parse(future.endAt) - Date.parse(future.startAt), 48 * 3600000);
    assert.equal(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(future.startAt)), '00:00');
  }
  assert.equal(domain.belgianMidnight('2027-03-28'), '2027-03-27T23:00:00.000Z');
  assert.equal(domain.belgianMidnight('2027-10-31'), '2027-10-30T22:00:00.000Z');
  const settings = domain.defaults();
  const booked = [
    { id: 'a', language: 'pl', type: 'PREMIUM', status: 'approved', source: 'public', paymentStatus: 'paid', actualStartAt: '2027-01-01T00:00:00.000Z', actualEndAt: '2027-01-01T01:00:00.000Z' },
    { id: 'b', language: 'pl', type: 'PREMIUM', status: 'approved', source: 'public', paymentStatus: 'paid', actualStartAt: '2027-01-01T01:00:00.000Z', actualEndAt: '2027-01-01T02:00:00.000Z' }
  ];
  assert.equal(domain.availabilityWindow(booked, settings, 'pl', 'PREMIUM', '2027-01-01T00:00:00.000Z', '2027-01-01T02:00:00.000Z').remaining, 1);
  booked[1].actualStartAt = '2027-01-01T00:30:00.000Z';
  assert.equal(domain.availabilityWindow(booked, settings, 'pl', 'PREMIUM', '2027-01-01T00:00:00.000Z', '2027-01-01T02:00:00.000Z').remaining, 0);
});

test('multilingual reservation charges half of the primary price and holds all language slots', async () => {
  const DB = localDb();
  const settings = domain.defaults();
  for (const language of ['fr', 'pl']) { settings.markets[language].enabled = true; settings.markets[language].prices.STANDARD = language === 'fr' ? 400 : 800; }
  DB.sqlite.prepare('INSERT INTO ads_settings(id,data,version) VALUES(1,?,1)').run(JSON.stringify(settings));
  const env = { DB };
  const day = new Date(Date.parse(domain.today()) + 86400000).toISOString().slice(0, 10);
  const next = new Date(Date.parse(day) + 86400000).toISOString().slice(0, 10);
  const body = { requestId: randomUUID(), type: 'STANDARD', kind: 'text', primaryLanguage: 'fr', dates: [day, next], variants: [{ language: 'fr', text: 'Annonce française' }, { language: 'pl', text: 'Ogłoszenie polskie' }], contact: 'Test', email: 'test@example.org', consent: true, termsAccepted: true, termsVersion: 'draft-2026-11-11', earlyServiceRequest: false, expectedTotalPrice: 1200 };
  const response = await adsRoute({ request: request('/api/ads?action=order-batch', 'POST', body), env });
  assert.equal(response.status, 201, await response.text());
  const rows = DB.sqlite.prepare('SELECT data FROM ad_orders').all().map(row => JSON.parse(row.data));
  assert.equal(rows.length, 2);
  assert.equal(new Set(rows.map(row => row.groupId)).size, 1);
  assert.deepEqual(rows.map(row => row.totalPrice).sort((a, b) => a - b), [400, 800]);
  assert.ok(rows.every(row => row.groupTotalPrice === 1200 && row.plannedStartAt && row.plannedEndAt));
  assert.equal((await adsRoute({ request: request('/api/ads?action=order-batch', 'POST', body), env })).status, 201);
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM ad_orders').get().n, 2);
  const adminId = randomUUID(), token = 'M'.repeat(43);
  DB.sqlite.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(adminId, 'ads-admin@example.org', 'Admin', 'unused', 'admin');
  DB.sqlite.prepare('INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await sha256(token), adminId, '2099-01-01');
  const moderation = await adsRoute({ request: request('/api/ads?action=admin-moderate-group', 'PUT', { id: rows[0].id, version: 1, status: 'approved' }, `__Host-pbe_session=${token}`), env });
  assert.equal(moderation.status, 409); // A paid group is required before any language can run.
  DB.sqlite.prepare("UPDATE cms_users SET role='editor' WHERE id=?").run(adminId);
  assert.equal((await adsRoute({ request: request('/api/ads?action=admin-moderate-group', 'PUT', { id: rows[0].id, version: 1, status: 'rejected' }, `__Host-pbe_session=${token}`), env })).status, 403);
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) AS n FROM ad_orders WHERE json_extract(data,'$.status')='approved'").get().n, 0);
});

test('only an administrator can create a complimentary PREMIUM banner without Stripe', async () => {
  const DB = localDb(), settings = domain.defaults();
  DB.sqlite.exec(readFileSync(new URL('../deploy/cloudflare-d1-0003-stripe.sql', import.meta.url), 'utf8'));
  settings.markets.pl.enabled = true;
  settings.markets.pl.prices.PREMIUM = 1000;
  DB.sqlite.prepare('INSERT INTO ads_settings(id,data,version) VALUES(1,?,1)').run(JSON.stringify(settings));
  const adminId = randomUUID(), editorId = randomUUID(), adminToken = 'A'.repeat(43), editorToken = 'E'.repeat(43);
  for (const [id, role, token] of [[adminId, 'admin', adminToken], [editorId, 'editor', editorToken]]) {
    DB.sqlite.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(id, `${role}-free@example.invalid`, role, 'unused', role);
    DB.sqlite.prepare('INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await sha256(token), id, '2099-01-01');
  }
  const png = (width, height) => { const bytes = Buffer.alloc(24); Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes); bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20); return `data:image/png;base64,${bytes.toString('base64')}`; };
  const day = domain.today();
  const body = { requestId: randomUUID(), type: 'PREMIUM', kind: 'image', primaryLanguage: 'pl', dates: [day], variants: [{ language: 'pl', title: 'Banner administratora', description: 'Bezpłatne ogłoszenie testowe' }], image: png(1200, 200), imageMobile: png(660, 300), email: 'admin@example.invalid', customerName: 'Administrator', consent: true, termsAccepted: true, termsVersion: 'draft-2026-11-11', earlyServiceRequest: false, expectedTotalPrice: 1000, adminComplimentary: true, adminStatus: 'approved' };
  const path = '/api/ads?action=admin-order-batch';
  assert.equal((await adsRoute({ request: request(path, 'POST', body), env: { DB } })).status, 401);
  assert.equal((await adsRoute({ request: request(path, 'POST', body, `__Host-pbe_session=${editorToken}`), env: { DB } })).status, 403);
  assert.equal((await adsRoute({ request: request('/api/ads?action=order-batch', 'POST', body), env: { DB } })).status, 403);
  const created = await adsRoute({ request: request(path, 'POST', body, `__Host-pbe_session=${adminToken}`), env: { DB } });
  assert.equal(created.status, 201, await created.text());
  const item = JSON.parse(DB.sqlite.prepare('SELECT data FROM ad_orders').get().data);
  assert.equal(item.source, 'manual'); assert.equal(item.paymentStatus, 'not_required'); assert.equal(item.totalPrice, 0);
  assert.equal(item.complimentary, true); assert.equal(item.adminAddedBy, adminId); assert.equal(item.status, 'approved');
  assert.equal(item.stripeSessionId, undefined);
  assert.equal((await (await adsRoute({ request: request('/api/ads?action=public&language=pl'), env: { DB } })).json()).ads.length, 1);
  const nextDay = new Date(Date.parse(day) + 86400000).toISOString().slice(0, 10);
  const revision = { ...body, id: item.id, version: item.version, type: 'TOP', region: 'all', image: png(1200, 720), imageMobile: '', dates: [nextDay], variants: [{ language: 'pl', title: 'Nowy baner', description: 'Zmieniony opis' }], adminStatus: 'approved' };
  assert.equal((await adsRoute({ request: request('/api/ads?action=admin-revise-group', 'PUT', revision, `__Host-pbe_session=${editorToken}`), env: { DB } })).status, 403);
  const changed = await adsRoute({ request: request('/api/ads?action=admin-revise-group', 'PUT', revision, `__Host-pbe_session=${adminToken}`), env: { DB } });
  assert.equal(changed.status, 200, await changed.text());
  const revised = JSON.parse(DB.sqlite.prepare('SELECT data FROM ad_orders').get().data);
  assert.equal(revised.type, 'TOP'); assert.equal(revised.startDate, nextDay); assert.equal(revised.title, 'Nowy baner');
  assert.equal(revised.paymentStatus, 'not_required'); assert.equal(revised.totalPrice, 0);
  assert.equal((await (await adsRoute({ request: request('/api/ads?action=public&language=pl'), env: { DB } })).json()).ads.length, 0);
  settings.markets.pl.enabled = false;
  DB.sqlite.prepare('UPDATE ads_settings SET data=? WHERE id=1').run(JSON.stringify(settings));
  const available = await adsRoute({ request: request(`/api/ads?action=admin-availability&language=pl&type=PREMIUM&startDate=${nextDay}&endDate=${nextDay}`, 'GET', undefined, `__Host-pbe_session=${adminToken}`), env: { DB } });
  assert.equal((await available.json()).enabled, true);
  const paused = await adsRoute({ request: request('/api/ads?action=admin-revise-group', 'PUT', { ...revision, version: revised.version, adminStatus: 'paused' }, `__Host-pbe_session=${adminToken}`), env: { DB } });
  assert.equal(paused.status, 200, await paused.text());
  assert.equal(JSON.parse(DB.sqlite.prepare('SELECT data FROM ad_orders').get().data).status, 'paused');
  const draftBody = { ...body, requestId: randomUUID(), dates: [nextDay], adminStatus: 'pending' };
  const draftResponse = await adsRoute({ request: request(path, 'POST', draftBody, `__Host-pbe_session=${adminToken}`), env: { DB } });
  assert.equal(draftResponse.status, 201, await draftResponse.clone().text());
  const draftGroup = (await draftResponse.json()).id;
  const draft = JSON.parse(DB.sqlite.prepare("SELECT data FROM ad_orders WHERE json_extract(data,'$.groupId')=?").get(draftGroup).data);
  assert.equal(draft.status, 'pending'); assert.equal(draft.paymentStatus, 'not_required');
  const approved = await adsRoute({ request: request('/api/ads?action=admin-moderate-group', 'PUT', { id: draft.id, version: draft.version, status: 'approved' }, `__Host-pbe_session=${adminToken}`), env: { DB } });
  assert.equal(approved.status, 200, await approved.text());
  assert.equal(JSON.parse(DB.sqlite.prepare('SELECT data FROM ad_orders WHERE id=?').get(draft.id).data).status, 'approved');
});

test('administrator can revise a paid multilingual order without changing Stripe payment records', async () => {
  const DB = localDb(), settings = domain.defaults();
  DB.sqlite.exec(readFileSync(new URL('../deploy/cloudflare-d1-0003-stripe.sql', import.meta.url), 'utf8'));
  for (const language of ['pl', 'nl']) { settings.markets[language].enabled = true; settings.markets[language].prices.STANDARD = 200; settings.markets[language].prices.TOP = 500; }
  DB.sqlite.prepare('INSERT INTO ads_settings(id,data,version) VALUES(1,?,1)').run(JSON.stringify(settings));
  const adminId = randomUUID(), token = 'R'.repeat(43), groupId = randomUUID();
  DB.sqlite.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(adminId, 'revise-admin@example.invalid', 'Admin', 'unused', 'admin');
  DB.sqlite.prepare('INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await sha256(token), adminId, '2099-01-01');
  const day = new Date(Date.parse(domain.today()) + 86400000).toISOString().slice(0, 10);
  const next = new Date(Date.parse(day) + 86400000).toISOString().slice(0, 10);
  const ids = [randomUUID(), randomUUID()];
  for (const [index, language] of ['pl', 'nl'].entries()) {
    const item = { id: ids[index], groupId, source: 'public', paymentStatus: 'paid', paymentId: 'pi_live_existing', stripeSessionId: 'cs_live_existing', status: 'approved', kind: 'text', type: 'STANDARD', language, primaryLanguage: 'pl', languages: ['pl', 'nl'], title: 'Old title', description: 'Old description', email: 'buyer@example.invalid', startDate: day, endDate: day, days: 1, periods: [domain.periodForDate(day)], totalPrice: index ? 100 : 200, groupTotalPrice: 300, dailyPrice: 200, currency: 'EUR', version: 1, createdAt: new Date().toISOString() };
    DB.sqlite.prepare('INSERT INTO ad_orders(id,data,created_at) VALUES(?,?,?)').run(item.id, JSON.stringify(item), item.createdAt);
  }
  const body = { id: ids[0], version: 1, type: 'TOP', kind: 'text', region: 'all', dates: [next], variants: [{ language: 'pl', title: 'Nowy tytuł PL', description: 'Nowy opis PL' }, { language: 'nl', title: 'Nieuwe titel NL', description: 'Nieuwe omschrijving NL' }], email: 'buyer@example.invalid', adminStatus: 'approved' };
  const changed = await adsRoute({ request: request('/api/ads?action=admin-revise-group', 'PUT', body, `__Host-pbe_session=${token}`), env: { DB } });
  assert.equal(changed.status, 200, await changed.text());
  const rows = DB.sqlite.prepare('SELECT data FROM ad_orders').all().map(row => JSON.parse(row.data));
  assert.deepEqual(rows.map(row => row.totalPrice).sort((a, b) => a - b), [100, 200]);
  assert.ok(rows.every(row => row.type === 'TOP' && row.startDate === next && row.paymentStatus === 'paid' && row.paymentId === 'pi_live_existing' && row.stripeSessionId === 'cs_live_existing'));
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM ad_payment_events').get().n, 0);
});

test('editing an active ad preserves elapsed days and the original payment', async () => {
  const DB = localDb(), settings = domain.defaults();
  DB.sqlite.exec(readFileSync(new URL('../deploy/cloudflare-d1-0003-stripe.sql', import.meta.url), 'utf8'));
  settings.markets.pl.enabled = true; settings.markets.pl.prices.STANDARD = 200;
  DB.sqlite.prepare('INSERT INTO ads_settings(id,data,version) VALUES(1,?,1)').run(JSON.stringify(settings));
  const id = randomUUID(), adminId = randomUUID(), token = 'H'.repeat(43);
  const yesterday = new Date(Date.parse(domain.today()) - 86400000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.parse(domain.today()) + 86400000).toISOString().slice(0, 10);
  const elapsed = { date: yesterday, plannedStartAt: domain.belgianMidnight(yesterday), plannedEndAt: domain.belgianMidnight(domain.today()), actualStartAt: domain.belgianMidnight(yesterday), actualEndAt: domain.belgianMidnight(domain.today()) };
  const upcoming = domain.periodForDate(tomorrow);
  const item = { id, groupId: id, source: 'public', paymentStatus: 'paid', paymentId: 'pi_existing', status: 'approved', kind: 'text', type: 'STANDARD', language: 'pl', title: 'Original', description: 'Original copy', company: 'Example', email: 'buyer@example.invalid', startDate: yesterday, endDate: tomorrow, days: 2, periods: [elapsed, upcoming], totalPrice: 400, version: 1 };
  DB.sqlite.prepare('INSERT INTO ad_orders(id,data) VALUES(?,?)').run(id, JSON.stringify(item));
  DB.sqlite.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(adminId, 'historical-admin@example.invalid', 'Admin', 'unused', 'admin');
  DB.sqlite.prepare('INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await sha256(token), adminId, '2099-01-01');
  const revise = dates => adsRoute({ request: request('/api/ads?action=admin-revise-group', 'PUT', { id, version: 1, type: 'STANDARD', kind: 'text', region: 'all', dates, variants: [{ language: 'pl', title: 'Edited', description: 'Edited copy' }], email: item.email, company: item.company, adminStatus: 'approved' }, `__Host-pbe_session=${token}`), env: { DB } });
  assert.equal((await revise([yesterday, tomorrow])).status, 200);
  const saved = JSON.parse(DB.sqlite.prepare('SELECT data FROM ad_orders WHERE id=?').get(id).data);
  assert.deepEqual(saved.periods[0], elapsed);
  assert.equal(saved.paymentId, 'pi_existing');
  assert.equal(saved.totalPrice, 400);
});

test('simultaneous last-place requests and multilingual failure never oversell', async () => {
  const DB = localDb();
  const settings = domain.defaults();
  for (const language of ['pl', 'fr']) { settings.markets[language].enabled = true; settings.markets[language].prices.STANDARD = 200; }
  DB.sqlite.prepare('INSERT INTO ads_settings(id,data,version) VALUES(1,?,1)').run(JSON.stringify(settings));
  const env = { DB };
  const day = new Date(Date.parse(domain.today()) + 86400000).toISOString().slice(0, 10);
  const make = (language, requestId = randomUUID()) => ({ requestId, type: 'STANDARD', kind: 'text', primaryLanguage: language, dates: [day], variants: [{ language, text: 'Testowa treść' }], contact: 'Test', email: 'test@example.org', consent: true, termsAccepted: true, termsVersion: 'draft-2026-11-11', earlyServiceRequest: false, expectedTotalPrice: 200 });
  const reserve = (language, ip, body = make(language)) => { const req = request('/api/ads?action=order-batch', 'POST', body); req.headers.set('cf-connecting-ip', `192.0.2.${ip}`); return adsRoute({ request: req, env }); };
  for (let i = 1; i <= 29; i++) assert.equal((await reserve('fr', i)).status, 201);
  const concurrent = await Promise.all([reserve('fr', 30), reserve('fr', 31)]);
  assert.deepEqual(concurrent.map(response => response.status).sort(), [201, 409]);
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) AS n FROM ad_orders WHERE json_extract(data,'$.language')='fr'").get().n, 30);
  const combined = { ...make('pl'), variants: [{ language: 'pl', text: 'Polska wersja' }, { language: 'fr', text: 'Version française' }], expectedTotalPrice: 300 };
  assert.equal((await reserve('pl', 32, combined)).status, 409);
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) AS n FROM ad_orders WHERE json_extract(data,'$.language')='pl'").get().n, 0);
});

test('late future moderation requires explicit group reschedule before approval', async () => {
  const DB = localDb();
  DB.sqlite.exec(readFileSync(new URL('../deploy/cloudflare-d1-0003-stripe.sql', import.meta.url), 'utf8'));
  const settings = domain.defaults(); settings.markets.pl.enabled = true; settings.markets.pl.prices.STANDARD = 200;
  DB.sqlite.prepare('INSERT INTO ads_settings(id,data,version) VALUES(1,?,1)').run(JSON.stringify(settings));
  const id = randomUUID(), groupId = randomUUID(), adminId = randomUUID(), token = 'R'.repeat(43);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const oldStart = new Date(Date.now() - 3600000).toISOString();
  const item = { id, groupId, source: 'public', kind: 'text', language: 'pl', type: 'STANDARD', startDate: yesterday, endDate: yesterday, days: 2, status: 'pending', paymentStatus: 'paid', plannedStartAt: oldStart, plannedEndAt: new Date(Date.parse(oldStart) + 48 * 3600000).toISOString(), version: 1 };
  DB.sqlite.prepare('INSERT INTO ad_orders(id,data) VALUES(?,?)').run(id, JSON.stringify(item));
  DB.sqlite.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(adminId, 'late-admin@example.org', 'Admin', 'unused', 'admin');
  DB.sqlite.prepare('INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await sha256(token), adminId, '2099-01-01');
  const admin = (action, body) => adsRoute({ request: request(`/api/ads?action=${action}`, 'PUT', body, `__Host-pbe_session=${token}`), env: { DB } });
  assert.equal(domain.status(item), 'needs_reschedule');
  assert.equal((await admin('admin-moderate-group', { id, version: 1, status: 'approved' })).status, 409);
  const tomorrow = new Date(Date.parse(domain.today()) + 86400000).toISOString().slice(0, 10);
  assert.equal((await admin('admin-reschedule-group', { id, version: 1, startDate: tomorrow })).status, 200);
  assert.equal((await admin('admin-moderate-group', { id, version: 2, status: 'approved' })).status, 200);
  const updated = JSON.parse(DB.sqlite.prepare('SELECT data FROM ad_orders WHERE id=?').get(id).data);
  assert.equal(Date.parse(updated.actualEndAt) - Date.parse(updated.actualStartAt), 48 * 3600000);
  assert.equal(domain.status(updated), 'scheduled');
});

test('only paid public ads or explicit administrator complimentary ads are visible', async () => {
  const DB = localDb();
  const now = Date.now();
  const start = new Date(now - 3600000).toISOString(), end = new Date(now + 3600000).toISOString();
  for (const [source, paymentStatus] of [['public', 'unpaid'], ['manual', 'not_required'], ['public', 'paid']]) {
    const id = randomUUID();
    const item = { id, source, paymentStatus, status: 'approved', kind: 'text', type: 'STANDARD', language: 'pl', title: `${source}-${paymentStatus}`, description: 'Test', contact: 'Test', startDate: domain.today(), endDate: domain.today(), actualStartAt: start, actualEndAt: end };
    DB.sqlite.prepare('INSERT INTO ad_orders(id,data) VALUES(?,?)').run(id, JSON.stringify(item));
  }
  const response = await adsRoute({ request: request('/api/ads?action=public&language=pl'), env: { DB } });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const ads = (await response.json()).ads;
  assert.deepEqual(ads.map(ad => ad.title).sort(), ['manual-not_required', 'public-paid']);
  assert.ok(ads.every(ad => ad.actualEndAt === end));
});

test('AI editor requires session and admin role for status changes', async () => {
  const DB = localDb();
  DB.sqlite.exec(readFileSync(new URL('../agent/migrations/001_agent.sql', import.meta.url), 'utf8'));
  const candidateId = 'a'.repeat(20);
  DB.sqlite.prepare('INSERT INTO ai_candidates(id,kind,status,title,description,body,sources_json,verification_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(candidateId, 'article', 'draft', 'Test', 'Test', 'Test', '[]', '{}', '2026-11-09', '2026-11-09');
  DB.sqlite.exec(readFileSync(new URL('../agent/migrations/002_editorial.sql', import.meta.url), 'utf8'));
  const env = { DB };
  const unauthenticated = await aiEditorRoute({ request: request('/api/ai-editor', 'POST', { action: 'status', id: candidateId, status: 'pending_review' }), env });
  assert.equal(unauthenticated.status, 401);
  for (const role of ['editor', 'admin']) {
    const userId = randomUUID();
    const token = 'A'.repeat(43 - role.length) + role;
    DB.sqlite.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(userId, `${role}@example.com`, role, 'unused', role);
    DB.sqlite.prepare('INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await sha256(token), userId, '2099-01-01');
    const cookie = `__Host-pbe_session=${token}`;
    const response = await aiEditorRoute({ request: request('/api/ai-editor', 'POST', { action: 'status', id: candidateId, status: 'pending_review' }, cookie), env });
    assert.equal(response.status, role === 'admin' ? 200 : 403);
  }
  assert.equal(DB.sqlite.prepare('SELECT status FROM ai_editorial WHERE candidate_id=?').get(candidateId).status, 'pending_review');
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM ai_candidate_history').get().n, 1);
});

test('agent service identity cannot approve, schedule or publish; admin can moderate and reschedule', async () => {
  const DB = localDb();
  DB.sqlite.exec(readFileSync(new URL('../agent/migrations/001_agent.sql', import.meta.url), 'utf8'));
  DB.sqlite.exec(readFileSync(new URL('../agent/migrations/002_editorial.sql', import.meta.url), 'utf8'));
  const env = { DB, AGENT_SERVICE_TOKEN: 'abcdefghijklmnopqrstuvwxyz0123456789TOKEN' };
  const service = (body, token = env.AGENT_SERVICE_TOKEN) => new Request('https://polacywbelgii.pages.dev/api/ai-editor', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const id = 'b'.repeat(20);
  const content = { id, kind: 'article', title: 'Testowy artykuł lokalny', description: 'Opis testowy', body: 'A'.repeat(150), category: 'Życie w Belgii', region: 'all', sources: [{ url: 'https://example.org/source' }] };
  assert.equal((await aiEditorRoute({ request: service({ action: 'create', ...content }, 'wrong-token-abcdefghijklmnopqrstuvwxyz'), env })).status,401);
  assert.equal((await aiEditorRoute({ request: service({ action: 'create', ...content }), env })).status,201);
  assert.equal((await aiEditorRoute({ request: service({ action: 'status', id, status: 'approved' }), env })).status,409);
  assert.equal((await aiEditorRoute({ request: service({ action: 'status', id, status: 'pending_review' }), env })).status,200);
  assert.equal((await aiEditorRoute({ request: service({ action: 'status', id, status: 'scheduled', localTime: '2099-01-01T08:00' }), env })).status,409);
  const agentView = await (await aiEditorRoute({ request: new Request('https://polacywbelgii.pages.dev/api/ai-editor', { headers: { Authorization: `Bearer ${env.AGENT_SERVICE_TOKEN}` } }), env })).json();
  assert.equal(agentView.canManage,false);
  assert.deepEqual(agentView.sources,[]);
  const adminId = randomUUID(); const token = 'C'.repeat(43);
  DB.sqlite.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(adminId,'editorial-admin@example.org','Admin','unused','admin');
  DB.sqlite.prepare('INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await sha256(token),adminId,'2099-01-01');
  const admin = body => request('/api/ai-editor','POST',body,`__Host-pbe_session=${token}`);
  assert.equal((await aiEditorRoute({ request: admin({ action: 'status', id, status: 'changes_requested' }), env })).status,200);
  assert.equal((await aiEditorRoute({ request: service({ action: 'status', id, status: 'pending_review' }), env })).status,200);
  assert.equal((await aiEditorRoute({ request: admin({ action: 'status', id, status: 'approved' }), env })).status,200);
  assert.equal((await aiEditorRoute({ request: admin({ action: 'status', id, status: 'scheduled', localTime: '2098-06-01T08:00' }), env })).status,200);
  assert.equal((await aiEditorRoute({ request: service({ action: 'edit', id, ...content, title: 'Zmiana po akceptacji' }), env })).status,403);
  const anotherId = 'd'.repeat(20);
  DB.sqlite.prepare('INSERT INTO ai_candidates(id,kind,status,title,description,body,sources_json,verification_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(anotherId,'article','draft','Drugi test','opis','tekst','[]','{}','2026-01-01','2026-01-01');
  DB.sqlite.prepare('INSERT INTO ai_editorial(candidate_id,status,approved_by,approved_at,updated_at) VALUES(?,?,?,?,?)').run(anotherId,'approved',adminId,'2026-01-01','2026-01-01');
  assert.equal((await aiEditorRoute({ request: admin({ action: 'status', id: anotherId, status: 'scheduled', localTime: '2098-06-01T08:00' }), env })).status,409);
  assert.equal(DB.sqlite.prepare('SELECT approved_by,scheduled_at FROM ai_editorial WHERE candidate_id=?').get(id).approved_by,adminId);
  assert.equal((await aiEditorRoute({ request: admin({ action: 'status', id, status: 'scheduled', localTime: '2098-06-01T17:00' }), env })).status,200);
  assert.equal((await aiEditorRoute({ request: admin({ action: 'status', id, status: 'pending_review' }), env })).status,200);
  assert.equal(DB.sqlite.prepare('SELECT approved_by,scheduled_at FROM ai_editorial WHERE candidate_id=?').get(id).approved_by,null);
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM ai_candidate_history WHERE candidate_id=?').get(id).n,8);
});

test('Stripe test Checkout, signed webhook, moderation, refund and duplicate delivery', async () => {
  const DB = localDb();
  DB.sqlite.exec(readFileSync(new URL('../deploy/cloudflare-d1-0003-stripe.sql', import.meta.url), 'utf8'));
  const settings = domain.defaults();
  settings.markets.pl.enabled = true;
  settings.markets.pl.prices = { STANDARD: 400, TOP: 1000, PREMIUM: 2500 };
  DB.sqlite.prepare('INSERT INTO ads_settings(id,data,version) VALUES(1,?,1)').run(JSON.stringify(settings));
  const env = { DB, STRIPE_TEST_MODE: '1', STRIPE_SECRET_KEY: 'sk_test_local', STRIPE_WEBHOOK_SECRET: 'whsec_local' };
  const day = domain.today();
  const requestId = randomUUID();
  const body = { requestId, type: 'STANDARD', kind: 'text', primaryLanguage: 'pl', dates: [day], variants: [{ language: 'pl', text: 'Testowe ogłoszenie' }], contact: 'test', email: 'test@example.com', consent: true, termsAccepted:true,termsVersion:'draft-2026-11-11',earlyServiceRequest:false, expectedTotalPrice: 400 };
  const missingTerms = await adsRoute({ request:request('/api/ads?action=order-batch','POST',{...body,termsAccepted:false}),env });
  assert.equal(missingTerms.status,400);
  const reservation = await adsRoute({ request: request('/api/ads?action=order-batch', 'POST', body), env });
  const savedTerms = DB.sqlite.prepare('SELECT data FROM ad_orders LIMIT 1').get();
  assert.equal(JSON.parse(savedTerms.data).termsVersion,'draft-2026-11-11');
  assert.ok(JSON.parse(savedTerms.data).termsAcceptedAt);
  assert.equal(reservation.status, 201);
  const { id: groupId } = await reservation.json();
  const before = await adsRoute({ request: request('/api/ads?action=public&language=pl'), env });
  assert.equal((await before.json()).ads.length, 0);
  const expires = Math.floor(Date.now() / 1000) + 1800;
  const checkout = await handleAdsPayment({ request: request('/api/ads-payment?action=start', 'POST', { groupId, requestId }), env }, { fetcher: async (_url, options) => {
    assert.equal(options.body.get('line_items[0][price_data][unit_amount]'), '400');
    return { ok: true, json: async () => ({ id: 'cs_test_session', url: 'https://checkout.stripe.com/c/pay/test', livemode: false, amount_total: 400, currency: 'eur', client_reference_id: groupId, expires_at: expires }) };
  } });
  assert.equal(checkout.status, 201, await checkout.text());
  const privateStatus = await handleAdsPayment({ request: request(`/api/ads-payment?action=status&id=${groupId}&token=${randomUUID()}`), env });
  assert.equal(privateStatus.status, 404);
  const customerStatus = await handleAdsPayment({ request: request(`/api/ads-payment?action=status&id=${groupId}&token=${requestId}`), env });
  assert.equal((await customerStatus.json()).paymentStatus, 'pending');
  const signed = async (event, signatureValid = true) => {
    const raw = JSON.stringify(event); const timestamp = Math.floor(Date.now() / 1000);
    const key = await webcrypto.subtle.importKey('raw', new TextEncoder().encode('whsec_local'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const digest = await webcrypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${raw}`));
    const hex = Buffer.from(digest).toString('hex');
    return new Request('https://polacywbelgii.pages.dev/api/ads-payment?action=webhook', { method: 'POST', headers: { 'stripe-signature': `t=${timestamp},v1=${signatureValid ? hex : '0'.repeat(64)}` }, body: raw });
  };
  const paid = { id: 'evt_paid1', type: 'checkout.session.completed', livemode: false, created: Math.floor(Date.now() / 1000), data: { object: { id: 'cs_test_session', livemode: false, client_reference_id: groupId, amount_total: 400, currency: 'eur', payment_status: 'paid', payment_intent: 'pi_test_1' } } };
  assert.equal((await handleAdsPayment({ request: await signed(paid, false), env })).status, 400);
  assert.equal((await handleAdsPayment({ request: await signed(paid), env })).status, 200);
  assert.equal((await handleAdsPayment({ request: await signed(paid), env })).status, 200);
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM ad_payment_events').get().n, 1);
  const row = DB.sqlite.prepare('SELECT id,data FROM ad_orders').get();
  assert.equal(JSON.parse(row.data).paymentStatus, 'paid');
  assert.equal((await (await adsRoute({ request: request('/api/ads?action=public&language=pl'), env })).json()).ads.length, 0);
  const adminId = randomUUID(), adminToken = 'B'.repeat(43);
  DB.sqlite.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(adminId, 'payments-admin@example.com', 'Admin', 'unused', 'admin');
  DB.sqlite.prepare('INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await sha256(adminToken), adminId, '2099-01-01');
  const moderation = await adsRoute({ request: request('/api/ads?action=admin-moderate-group', 'PUT', { id: row.id, version: JSON.parse(row.data).version, status: 'approved' }, `__Host-pbe_session=${adminToken}`), env });
  assert.equal(moderation.status, 200, await moderation.text());
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM ad_order_history').get().n, 1);
  assert.equal((await (await adsRoute({ request: request('/api/ads?action=public&language=pl'), env })).json()).ads.length, 1);
  const refund = { id: 'evt_refund1', type: 'charge.refunded', livemode: false, created: Math.floor(Date.now() / 1000), data: { object: { id: 'ch_test_1', payment_intent: 'pi_test_1', amount:400, amount_refunded:400, refunded:true, refunds: { data: [{ id: 're_test_1' }] } } } };
  assert.equal((await handleAdsPayment({ request: await signed(refund), env })).status, 200);
  assert.equal((await (await adsRoute({ request: request('/api/ads?action=public&language=pl'), env })).json()).ads.length, 0);
});

test('STANDARD, TOP and PREMIUM reservations enforce formats, prices and capacity', async () => {
  const DB = localDb();
  const settings = domain.defaults();
  settings.markets.pl.enabled = true;
  settings.markets.pl.prices = { STANDARD: 400, TOP: 1000, PREMIUM: 2500 };
  DB.sqlite.prepare('INSERT INTO ads_settings(id,data,version) VALUES(1,?,1)').run(JSON.stringify(settings));
  const env = { DB };
  const day = new Date(Date.parse(domain.today()) + 86400000).toISOString().slice(0, 10);
  const png = (width, height) => { const bytes = Buffer.alloc(24); Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes); bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20); return `data:image/png;base64,${bytes.toString('base64')}`; };
  const make = (type, requestId = randomUUID()) => ({ requestId, type, kind: type === 'PREMIUM' ? 'image' : 'text', primaryLanguage: 'pl', dates: [day], variants: [type === 'PREMIUM' ? { language: 'pl', title: 'Test premium', description: 'Opis' } : { language: 'pl', text: 'Testowe ogłoszenie' }], contact: 'Test', email: 'test@example.com', company: 'Test', customerName: 'Test', url: 'https://example.com', image: png(1200, 200), imageMobile: png(660, 300), consent: true, termsAccepted:true,termsVersion:'draft-2026-11-11',earlyServiceRequest:false, expectedTotalPrice: settings.markets.pl.prices[type] });
  for (const type of ['STANDARD', 'TOP', 'PREMIUM']) {
    const result = await adsRoute({ request: request('/api/ads?action=order-batch', 'POST', make(type)), env });
    assert.equal(result.status, 201, type);
    assert.equal((await result.json()).totalPrice, settings.markets.pl.prices[type]);
  }
  const badImage = await adsRoute({ request: request('/api/ads?action=order-batch', 'POST', { ...make('PREMIUM'), image: png(100, 100) }), env });
  assert.equal(badImage.status, 400);
  const secondPremium = await adsRoute({ request: request('/api/ads?action=order-batch', 'POST', make('PREMIUM')), env });
  assert.equal(secondPremium.status, 201);
  const fullPremium = await adsRoute({ request: request('/api/ads?action=order-batch', 'POST', make('PREMIUM')), env });
  assert.equal(fullPremium.status, 409);
  const secondTop = await adsRoute({ request: request('/api/ads?action=order-batch', 'POST', make('TOP')), env });
  assert.equal(secondTop.status, 201);
  for (let i = 0; i < 3; i++) assert.equal((await adsRoute({ request: request('/api/ads?action=order-batch', 'POST', make('TOP')), env })).status, 201);
  const fullTop = await adsRoute({ request: request('/api/ads?action=order-batch', 'POST', make('TOP')), env });
  assert.equal(fullTop.status, 409);
  const alteredPrice = await adsRoute({ request: request('/api/ads?action=order-batch', 'POST', { ...make('STANDARD'), expectedTotalPrice: 1 }), env });
  assert.equal(alteredPrice.status, 409);
});

test('expired reservations reject late payments and failed payments release capacity', async () => {
  const DB = localDb();
  DB.sqlite.exec(readFileSync(new URL('../deploy/cloudflare-d1-0003-stripe.sql', import.meta.url), 'utf8'));
  const settings = domain.defaults(); settings.markets.pl.enabled = true; settings.markets.pl.prices.STANDARD = 400;
  DB.sqlite.prepare('INSERT INTO ads_settings(id,data,version) VALUES(1,?,1)').run(JSON.stringify(settings));
  const day = new Date(Date.parse(domain.today()) + 86400000).toISOString().slice(0, 10);
  const lateGroup = randomUUID(), failedGroup = randomUUID();
  for (const [groupId, sessionId, expires] of [[lateGroup, 'cs_test_late', -60000], [failedGroup, 'cs_test_failed', 600000]]) {
    const id = randomUUID();
    const data = { id, groupId, batchRequestId: randomUUID(), source: 'public', kind: 'text', type: 'STANDARD', language: 'pl', startDate: day, endDate: day, days: 1, totalPrice: 400, status: 'pending', paymentStatus: 'pending', stripeSessionId: sessionId, reservationExpiresAt: new Date(Date.now() + expires).toISOString() };
    DB.sqlite.prepare('INSERT INTO ad_orders(id,data) VALUES(?,?)').run(id, JSON.stringify(data));
  }
  const env = { DB, STRIPE_TEST_MODE: '1', STRIPE_SECRET_KEY: 'sk_test_local', STRIPE_WEBHOOK_SECRET: 'whsec_local' };
  const send = async (id, type, groupId, sessionId, paymentStatus) => {
    const event = { id, type, livemode: false, created: Math.floor(Date.now() / 1000), data: { object: { id: sessionId, livemode: false, client_reference_id: groupId, currency: 'eur', amount_total: 400, payment_status: paymentStatus, payment_intent: 'pi_test_late' } } };
    const raw = JSON.stringify(event), timestamp = Math.floor(Date.now() / 1000);
    const key = await webcrypto.subtle.importKey('raw', new TextEncoder().encode('whsec_local'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const digest = await webcrypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${raw}`));
    return handleAdsPayment({ request: new Request('https://polacywbelgii.pages.dev/api/ads-payment?action=webhook', { method: 'POST', headers: { 'stripe-signature': `t=${timestamp},v1=${Buffer.from(digest).toString('hex')}` }, body: raw }), env });
  };
  assert.equal((await send('evt_late1', 'checkout.session.completed', lateGroup, 'cs_test_late', 'paid')).status, 200);
  const late = JSON.parse(DB.sqlite.prepare("SELECT data FROM ad_orders WHERE json_extract(data,'$.groupId')=?").get(lateGroup).data);
  assert.equal(late.paymentStatus, 'paid_late'); assert.equal(late.refundRequired, true);
  assert.equal((await send('evt_failed1', 'checkout.session.async_payment_failed', failedGroup, 'cs_test_failed', 'unpaid')).status, 200);
  assert.equal((await send('evt_expired1', 'checkout.session.expired', failedGroup, 'cs_test_failed', 'unpaid')).status, 200);
  const failed = JSON.parse(DB.sqlite.prepare("SELECT data FROM ad_orders WHERE json_extract(data,'$.groupId')=?").get(failedGroup).data);
  assert.equal(failed.paymentStatus, 'failed');
  const availability = await adsRoute({ request: request(`/api/ads?action=availability&language=pl&type=STANDARD&startDate=${day}&endDate=${day}`), env });
  assert.equal((await availability.json()).daysAvailable[0].remaining, 30);
});

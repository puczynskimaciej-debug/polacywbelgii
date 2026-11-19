import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID, webcrypto } from 'node:crypto';
import { chromium } from 'playwright-core';
import domain from '../server/ads-domain.js';
import { handleAds } from '../cloudflare/ads.mjs';
import { sha256 } from '../cloudflare/common.mjs';
globalThis.crypto ??= webcrypto;

function localDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../deploy/cloudflare-d1.sql',import.meta.url),'utf8'));
  sqlite.exec(readFileSync(new URL('../deploy/cloudflare-d1-0002.sql',import.meta.url),'utf8'));
  const prepare = (sql,values=[]) => ({
    bind(...params) { return prepare(sql,params); },
    async first() { return sqlite.prepare(sql).get(...values) || null; },
    async all() { return {results:sqlite.prepare(sql).all(...values)}; },
    async run() { const result=sqlite.prepare(sql).run(...values); return {meta:{changes:result.changes}}; }
  });
  return {sqlite,prepare,async batch(statements) {
    sqlite.exec('BEGIN');
    try { const result=[]; for (const statement of statements) result.push(await statement.run()); sqlite.exec('COMMIT'); return result; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  }};
}

test('display settings keep prices, capacity and legacy fallback', () => {
  const old = domain.defaults();
  const legacy = { markets:old.markets, capacityOverrides:old.capacityOverrides };
  const fallback = domain.normalizeSettings(legacy);
  assert.equal(fallback.display.STANDARD.seconds,5);
  assert.equal(fallback.display.TOP.visible,2);
  assert.equal(fallback.display.PREMIUM.maxItems,2);
  const input = structuredClone(old);
  input.markets.pl.prices.TOP = 500;
  input.display.STANDARD = { visible:3, seconds:2 };
  input.display.TOP = { visible:1, seconds:7 };
  input.display.PREMIUM.maxItems = 1;
  input.display.PREMIUM.seconds = 9;
  input.display.PREMIUM.placeholder.locales.nl.title = 'Eigen advertentie';
  const result = domain.validateSettings(input);
  assert.equal(result.markets.pl.prices.TOP,500);
  assert.equal(result.types.STANDARD.capacity,30);
  assert.deepEqual(result.display.STANDARD,{visible:3,seconds:2});
  assert.equal(result.display.PREMIUM.placeholder.locales.nl.title,'Eigen advertentie');
  for (const bad of [
    value => value.display.STANDARD.visible = 0,
    value => value.display.TOP.seconds = 0,
    value => value.display.PREMIUM.maxItems = 3,
    value => value.display.PREMIUM.placeholder.locales.fr.image = 'javascript:alert(1)'
  ]) {
    const invalid = structuredClone(input); bad(invalid);
    assert.throws(() => domain.validateSettings(invalid), error => error.code === 'settings');
  }
});

test('administrator saves display settings in D1 and public API reads them without exposing unapproved ads', async () => {
  const DB = localDb();
  const token = randomBytes(32).toString('base64url');
  const userId = randomUUID();
  DB.sqlite.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(userId,'admin@example.invalid','Admin','unused','admin');
  DB.sqlite.prepare('INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await sha256(token),userId,'2099-01-01');
  const input = domain.defaults();
  input.markets.pl.enabled = true;
  input.markets.pl.prices = {STANDARD:200,TOP:500,PREMIUM:1000};
  input.display.STANDARD.visible = 3;
  input.display.TOP.seconds = 8;
  input.display.PREMIUM.placeholder.locales.pl.title = 'Własny baner portalu';
  const request = new Request('https://example.invalid/api/ads?action=admin-settings',{
    method:'PUT', headers:{'content-type':'application/json',origin:'https://example.invalid',cookie:`__Host-pbe_session=${token}`},
    body:JSON.stringify({data:input,version:0})
  });
  const saved = await handleAds({request,env:{DB}});
  assert.equal(saved.status,200,await saved.clone().text());
  assert.equal(JSON.parse(DB.sqlite.prepare('SELECT data FROM ads_settings WHERE id=1').get().data).display.STANDARD.visible,3);
  const now = new Date().toISOString();
  const end = new Date(Date.now()+86400000).toISOString();
  for (const [status,paymentStatus] of [['approved','paid'],['pending','paid'],['approved','unpaid']]) {
    const id = randomUUID();
    const ad = {id,type:'PREMIUM',language:'pl',kind:'image',title:id,status,paymentStatus,source:'public',actualStartAt:now,actualEndAt:end};
    DB.sqlite.prepare('INSERT INTO ad_orders(id,data,created_at) VALUES(?,?,?)').run(id,JSON.stringify(ad),now);
  }
  const publicResponse = await handleAds({request:new Request('https://example.invalid/api/ads?action=public&language=pl'),env:{DB}});
  assert.equal(publicResponse.status,200);
  const payload = await publicResponse.json();
  assert.equal(payload.ads.length,1);
  assert.equal(payload.display.STANDARD.visible,3);
  assert.equal(payload.display.TOP.seconds,8);
  assert.equal(payload.display.PREMIUM.placeholder.locales.pl.title,'Własny baner portalu');
});

test('three public sections use independent display settings and Premium placeholder', async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:true });
  try {
    const page = await browser.newPage({ viewport:{ width:1366, height:768 } });
    const display = domain.defaults().display;
    display.STANDARD.visible = 3;
    display.STANDARD.seconds = 2;
    display.TOP.visible = 1;
    display.TOP.seconds = 3;
    display.PREMIUM.maxItems = 1;
    display.PREMIUM.seconds = 1;
    display.PREMIUM.placeholder.locales.pl.image = '/images/uploads/promo.png';
    const ads = [
      ...['one','two'].map(id => ({ id, type:'PREMIUM', kind:'image', image:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>', title:id, company:id, url:'https://example.invalid/' })),
      ...['one','two','three'].map(id => ({ id, type:'TOP', kind:'text', title:id, description:'Opis', url:'https://example.invalid/' })),
      ...['one','two','three','four'].map(id => ({ id, type:'STANDARD', kind:'text', title:id, description:'Opis' }))
    ];
    await page.route('https://ads.test/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/ads') return route.fulfill({ json:{ads,display} });
      return route.fulfill({ contentType:'text/html', body:`<html lang="pl"><body data-page="ads"><script>window.adTranslations={pl:{'ads.sponsored':'Reklama'}};</script><section id="listing-premium"><div><div data-ad-list="PREMIUM"></div></div></section><section id="listing-top"><div><div data-ad-list="TOP"></div></div></section><section id="ogloszenia"><div><div data-ad-list="STANDARD"></div></div></section></body></html>` });
    });
    await page.goto('https://ads.test/');
    await page.addStyleTag({ path:'src/ads.css' });
    await page.addScriptTag({ path:'src/ad-creative.js' });
    await page.addScriptTag({ path:'src/ads.js' });
    await page.waitForSelector('[data-ad-list="PREMIUM"] .ad-placeholder--premium');
    assert.equal(await page.locator('[data-ad-list="PREMIUM"] > *').count(),2);
    assert.equal(await page.locator('[data-ad-list="TOP"] > *').count(),3);
    assert.equal(await page.locator('[data-ad-list="STANDARD"] > *').count(),4);
    assert.equal(await page.locator('[data-ad-list="PREMIUM"] .ad-placeholder__action').getAttribute('href'),'/zamow-ogloszenie/');
    assert.equal(await page.locator('[data-ad-list="PREMIUM"] .ad-placeholder__image').getAttribute('src'),'/images/uploads/promo.png');
    assert.equal(await page.locator('[data-ad-list="TOP"]').evaluate(node => node.style.getPropertyValue('--ad-visible')),'1');
    assert.equal(await page.locator('[data-ad-list="STANDARD"]').evaluate(node => node.style.getPropertyValue('--ad-visible')),'3');
    const first = await page.locator('[data-ad-list="PREMIUM"] > .is-current').textContent();
    await page.waitForTimeout(1150);
    const second = await page.locator('[data-ad-list="PREMIUM"] > .is-current').textContent();
    assert.notEqual(first,second);
    const image = page.locator('.ad-image-creative > picture:not(.ad-image-creative__backdrop) img').first();
    assert.equal(await image.evaluate(node => getComputedStyle(node).objectFit),'contain');
    assert.equal(await page.locator('.ad-image-creative__backdrop').count(),1);
    const separateMeta = await page.locator('.ad-image-creative').first().evaluate(frame => {
      const picture = frame.querySelector('picture:not(.ad-image-creative__backdrop)');
      const meta = frame.querySelector('.ad-creative__meta');
      return meta.getBoundingClientRect().top >= picture.getBoundingClientRect().bottom - 1;
    });
    assert.equal(separateMeta,true);
    await page.locator('.ad-dots button').first().click();
    assert.equal(await page.locator('[data-ad-list="PREMIUM"]').evaluate(node => node._rotation),null);
    await page.setViewportSize({ width:390, height:844 });
    assert.equal(await image.evaluate(node => getComputedStyle(node).objectFit),'contain');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
    ads.length = 0;
    await page.evaluate(() => document.dispatchEvent(new Event('languagechange')));
    await page.waitForFunction(() => document.querySelector('[data-ad-list="PREMIUM"]')?.children.length === 1);
    assert.equal(await page.locator('[data-ad-list="PREMIUM"] .ad-placeholder--premium').count(),1);
    display.PREMIUM.placeholder.enabled = false;
    await page.evaluate(() => document.dispatchEvent(new Event('languagechange')));
    await page.waitForFunction(() => document.querySelector('[data-ad-list="PREMIUM"] .ad-empty'));
    assert.equal(await page.locator('[data-ad-list="PREMIUM"] .ad-placeholder--premium').count(),0);
  } finally { await browser.close(); }
});

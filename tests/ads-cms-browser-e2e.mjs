import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
import { localD1Path } from '../agent/local-db.mjs';
import { hashPassword } from '../cloudflare/auth.mjs';
import domain from '../server/ads-domain.js';

const origin = process.env.LOCAL_CMS_ORIGIN || 'http://localhost:8080';
const db = new DatabaseSync(localD1Path());
db.exec('PRAGMA busy_timeout=5000');
const userId = randomUUID(), id = randomUUID(), groupId = randomUUID();
const email = `ads-cms-${userId.slice(0, 12)}@example.invalid`;
const password = randomBytes(32).toString('base64url');
const now = new Date();
const title = `CMS ad ${id.slice(0, 8)}`;
let browser;
try {
  for (const stale of db.prepare("SELECT id FROM ad_orders WHERE json_extract(data,'$.email') LIKE 'ads-cms-%@example.invalid'").all()) {
    db.prepare('DELETE FROM ad_order_history WHERE order_id=?').run(stale.id);
    db.prepare('DELETE FROM ad_orders WHERE id=?').run(stale.id);
  }
  for (const stale of db.prepare("SELECT id FROM cms_users WHERE email LIKE 'ads-cms-%@example.invalid'").all()) {
    db.prepare('DELETE FROM cms_sessions WHERE user_id=?').run(stale.id);
    db.prepare('DELETE FROM cms_audit WHERE actor_id=?').run(stale.id);
    db.prepare('DELETE FROM cms_users WHERE id=?').run(stale.id);
  }
  db.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(userId, email, 'Ads E2E', await hashPassword(password), 'admin');
  const item = { id, groupId, source: 'public', kind: 'text', type: 'STANDARD', language: 'pl', primaryLanguage: 'pl', languages: ['pl'], region: 'all', title, description: title, contact: 'Test', email, company: '', startDate: domain.today(now), endDate: domain.today(now), days: 1, dailyPrice: 200, totalPrice: 200, groupTotalPrice: 200, currency: 'EUR', status: 'pending', paymentStatus: 'paid', paidAt: now.toISOString(), periods: [domain.periodForDate(domain.today(now), now)], reservationStartAt: now.toISOString(), reservationEndAt: new Date(now.getTime() + 86400000).toISOString(), version: 1, createdAt: now.toISOString(), updatedAt: now.toISOString() };
  db.prepare('INSERT INTO ad_orders(id,data,created_at) VALUES(?,?,?)').run(id, JSON.stringify(item), item.createdAt);
  browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  const page = await browser.newPage();
  await page.goto(`${origin}/admin/`);
  await page.locator('#login-form [name="email"]').fill(email);
  await page.locator('#login-form [name="password"]').fill(password);
  await page.locator('#login-form [type="submit"]').click();
  await page.locator('#app-view').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('[data-view="ads"]').click();
  await page.locator('[data-panel="ads"]').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#ads-new').click();
  const sharedForm = page.frameLocator('#ads-order-frame');
  await sharedForm.locator('[name="adminComplimentary"]').waitFor({ state: 'visible', timeout: 15000 });
  assert.equal(await sharedForm.locator('[name="adminComplimentary"]').isChecked(), true);
  await page.locator('#ads-order-close').click();
  await page.locator(`#ads-orders [data-ad-edit="${id}"]`).waitFor({ state: 'visible', timeout: 15000 });
  await page.locator(`#ads-orders [data-ad-moderate="approved"][data-ad-id="${id}"]`).waitFor({ state: 'visible' });
  await page.locator(`#ads-orders [data-ad-moderate="rejected"][data-ad-id="${id}"]`).waitFor({ state: 'visible' });
  await page.locator(`#ads-orders [data-ad-edit="${id}"]`).click();
  await page.locator('#ads-moderation-actions [data-ad-moderate="approved"]').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#ads-save').isVisible(), false);
  await page.locator('#ads-close').click();
  let saved = JSON.parse(db.prepare('SELECT data FROM ad_orders WHERE id=?').get(id).data);
  assert.equal(saved.status, 'pending');
  await page.locator(`#ads-orders [data-ad-moderate="approved"][data-ad-id="${id}"]`).click();
  await page.locator('#cms-confirm-accept').click();
  await page.locator(`#ads-orders [data-ad-moderate="approved"][data-ad-id="${id}"]`).waitFor({ state: 'detached' });
  saved = JSON.parse(db.prepare('SELECT data FROM ad_orders WHERE id=?').get(id).data);
  assert.equal(saved.status, 'approved');
  assert.equal(saved.paymentStatus, 'paid');
  assert.equal(Date.parse(saved.actualEndAt) - Date.parse(saved.actualStartAt), 86400000);
  assert.ok((await (await fetch(`${origin}/api/ads?action=public&language=pl`)).json()).ads.some(ad => ad.id === id));
  await page.locator(`#ads-orders [data-ad-edit="${id}"]`).click();
  await page.locator('#ads-delete').click();
  await page.locator('#cms-confirm-accept').click();
  await page.waitForFunction(() => !document.querySelector('#ads-dialog').open);
  await page.locator('#ads-notice').getByText('Ogłoszenie wycofane.').waitFor();
  saved = JSON.parse(db.prepare('SELECT data FROM ad_orders WHERE id=?').get(id).data);
  assert.equal(saved.status, 'cancelled');
  assert.ok(!(await (await fetch(`${origin}/api/ads?action=public&language=pl`)).json()).ads.some(ad => ad.id === id));
  assert.ok(db.prepare('SELECT COUNT(*) AS n FROM ad_order_history WHERE order_id=?').get(id).n >= 2);
  console.log('Ads CMS browser E2E: paid order visible, group approved, 24h window, withdrawn, history retained OK');
} finally {
  await browser?.close();
  db.prepare('DELETE FROM ad_order_history WHERE order_id=?').run(id);
  db.prepare('DELETE FROM ad_orders WHERE id=?').run(id);
  db.prepare('DELETE FROM cms_sessions WHERE user_id=?').run(userId);
  db.prepare('DELETE FROM cms_audit WHERE actor_id=?').run(userId);
  db.prepare('DELETE FROM cms_users WHERE id=?').run(userId);
  db.close();
}

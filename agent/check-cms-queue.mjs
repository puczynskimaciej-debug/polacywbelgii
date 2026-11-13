import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
import { hashPassword } from '../cloudflare/auth.mjs';
import { openLocalDb } from './local-db.mjs';

const id = process.argv[2];
if (!/^[a-f0-9]{20}$/.test(id || '')) throw new Error('Usage: node agent/check-cms-queue.mjs <candidate-id>');
const db = openLocalDb();
const adminId = randomUUID();
const email = `local-queue-check-${adminId}@example.invalid`;
const password = randomBytes(24).toString('base64url');
const candidate = db.prepare('SELECT c.title,e.status,e.public_state,e.approved_by FROM ai_candidates c JOIN ai_editorial e ON e.candidate_id=c.id WHERE c.id=?').get(id);
assert.ok(candidate, 'Candidate missing from local D1');
assert.equal(candidate.status, 'pending_review');
assert.equal(candidate.approved_by, null);
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless:true });
try {
  db.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(adminId,email,'Lokalny test kolejki CMS',await hashPassword(password),'admin');
  const page = await browser.newPage();
  const base = process.env.PBE_LOCAL_PAGES_URL || 'http://127.0.0.1:8791';
  await page.goto(`${base}/admin/`);
  await page.locator('#login-form input[name=email]').fill(email);
  await page.locator('#login-form input[name=password]').fill(password);
  await page.locator('#login-form button').click();
  await page.locator('#app-view').waitFor({ state:'visible',timeout:15000 });
  await page.locator('[data-view=ai-editor]').click();
  const card = page.locator('#ai-queue article.repeat-item').filter({ has:page.locator('h3',{ hasText:candidate.title }) });
  await card.waitFor({ timeout:15000 });
  assert.match(await card.innerText(),/Do zatwierdzenia/);
  const publicResponse = await fetch(`${base}/artykuly/ai-${id}/`);
  assert.equal(publicResponse.status,404);
  console.log(JSON.stringify({ id,title:candidate.title,queueVisible:true,status:candidate.status,publicHttpStatus:publicResponse.status }));
} finally {
  await browser.close();
  db.prepare('DELETE FROM cms_sessions WHERE user_id=?').run(adminId);
  db.prepare('DELETE FROM cms_audit WHERE actor_id=?').run(adminId);
  db.prepare('DELETE FROM cms_users WHERE id=?').run(adminId);
  db.close();
}

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright-core';
import { openLocalDb } from '../agent/local-db.mjs';

const address = 'kontakt@polacywbelgii.eu';
const secretPath = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(),'AppData','Local'),'PolacywBelgii','local-cms-admin-password.txt');
let password = (await fs.readFile(secretPath,'utf8')).trim();
const base = process.env.PBE_LOCAL_PAGES_URL || 'http://localhost:8080';
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless:true });
try {
  const page = await browser.newPage();
  await page.goto(`${base}/admin/`);
  await page.locator('#login-form input[name=email]').fill(address);
  await page.locator('#login-form input[name=password]').fill(password);
  await page.locator('#login-form button').click();
  const passwordView = page.locator('#password-view');
  await Promise.race([
    passwordView.waitFor({ state:'visible',timeout:15000 }),
    page.locator('#app-view').waitFor({ state:'visible',timeout:15000 })
  ]);
  if (await passwordView.isVisible()) {
    const newPassword = randomBytes(36).toString('base64url');
    await passwordView.locator('input[name=currentPassword]').fill(password);
    await passwordView.locator('input[name=password]').fill(newPassword);
    await passwordView.locator('input[name=confirmPassword]').fill(newPassword);
    await passwordView.locator('button[type=submit]').click();
    await page.locator('#app-view').waitFor({ state:'visible',timeout:20000 });
    await fs.writeFile(secretPath,`${newPassword}\n`,{ mode:0o600 });
    password = newPassword;
  }
  assert.equal(await page.locator('#repository-name').innerText(),'Administrator');
  for (const view of ['articles','ai-editor','ai-calendar','ads','users']) assert.equal(await page.locator(`.nav-item[data-view=${view}]`).isVisible(),true);
  await page.locator('.nav-item[data-view=ai-editor]').click();
  await page.locator('#ai-queue h3').filter({ hasText:'Nieodebrany belgijski ekwiwalent wakacyjny' }).waitFor({ timeout:15000 });
  await page.locator('.nav-item[data-view=ads]').click();
  await page.locator('#ads-orders').waitFor({ state:'visible',timeout:15000 });
  const adsNotice = await page.locator('#ads-notice').innerText();
  assert.equal(adsNotice,'');
  const db = openLocalDb();
  const account = db.prepare('SELECT role,active,must_change_password FROM cms_users WHERE email=?').get(address);
  db.close();
  assert.equal(account.role,'admin');
  assert.equal(account.active,1);
  assert.equal(account.must_change_password,0);
  console.log(JSON.stringify({ address,login:true,role:account.role,aiQueue:true,adsAndOrders:true,articlesNavigation:true,passwordFile:secretPath }));
} finally { await browser.close(); }

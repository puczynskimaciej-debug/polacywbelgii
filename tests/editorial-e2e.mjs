import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
import { hashPassword } from '../cloudflare/auth.mjs';
import { openLocalDb } from '../agent/local-db.mjs';
import { publishLocal } from '../agent/publish-local.mjs';

const root = path.resolve(import.meta.dirname,'..');
const base = process.env.PBE_LOCAL_PAGES_URL || 'http://127.0.0.1:8080';
const token = /^AGENT_SERVICE_TOKEN=(.+)$/m.exec(fs.readFileSync(path.join(root,'.dev.vars'),'utf8'))?.[1];
if (!token) throw new Error('Run npm run local:agent-secret first');

test('local Pages, CMS, agent and publisher share one D1 and complete moderation lifecycle', async () => {
  const db = openLocalDb();
  const adminId = randomUUID();
  const email = `local-e2e-${adminId}@example.invalid`;
  const password = randomBytes(24).toString('base64url');
  const ids = [randomBytes(10),randomBytes(10),randomBytes(10)].map(value => value.toString('hex'));
  const titles = ['Lokalny test poprawek AI','Lokalny test odrzucenia AI','Lokalny test publikacji AI'];
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless:true });
  const page = await browser.newPage();
  const articleUrl = `${base}/artykuly/ai-${ids[2]}/`;
  const articleFile = path.join(root,'src','content','articles',`ai-${ids[2]}.md`);
  const htmlFile = path.join(root,'_site','artykuly',`ai-${ids[2]}`,'index.html');
  const api = async (action, payload) => {
    const response = await fetch(`${base}/api/ai-editor`,{ method:'POST', headers:{ Authorization:`Bearer ${token}`,'Content-Type':'application/json' }, body:JSON.stringify({ action,...payload }) });
    const data = await response.json();
    assert.ok(response.ok,`Agent API ${action}: ${response.status} ${data.error || ''}`);
    return data;
  };
  const status = id => db.prepare('SELECT status,scheduled_at,public_state FROM ai_editorial WHERE candidate_id=?').get(id);
  const waitStatus = async (id, expected) => {
    for (let attempt=0;attempt<100;attempt++) {
      if (status(id)?.status === expected) return;
      await new Promise(resolve => setTimeout(resolve,100));
    }
    assert.equal(status(id)?.status,expected);
  };
  const row = title => page.locator('#articles-list .table-row').filter({ hasText:title });
  const open = async title => { await row(title).locator('[data-open-ai]').click(); await page.locator('#ai-detail-dialog').waitFor({state:'visible'}); };
  const close = () => page.locator('#ai-detail-dialog [data-close]').click();
  const extra = async action => { await page.locator('#ai-detail-actions .action-menu summary').click(); await page.locator(`#ai-detail-actions [data-ai-action="${action}"]`).click(); };
  const schedule = async local => { await page.locator('#ai-detail-actions [data-ai-action=schedule]').click(); await page.locator('#ai-schedule-form input[name=date]').fill(local.slice(0,10)); await page.locator('#ai-schedule-form input[name=time]').fill(local.slice(11,16)); await page.locator('#ai-schedule-form button[type=submit]').click(); await page.locator('#ai-schedule-dialog').waitFor({state:'hidden'}); };
  try {
    db.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(adminId,email,'Lokalny test CMS',await hashPassword(password),'admin');
    await page.goto(`${base}/admin/`);
    await page.locator('#login-form input[name=email]').fill(email);
    await page.locator('#login-form input[name=password]').fill(password);
    await page.locator('#login-form button').click();
    await page.locator('#app-view').waitFor({ state:'visible',timeout:15000 });
    await page.locator('.nav-item[data-view=articles]').click();
    for (let i=0;i<ids.length;i++) {
      await api('create',{ id:ids[i],kind:'article',title:titles[i],description:'Wyłącznie lokalny test techniczny',body:'Lokalny test techniczny. '.repeat(12),category:'Życie w Belgii',region:'all',sources:[{url:'https://example.org/test-only'}] });
      await api('status',{ id:ids[i],status:'pending_review' });
    }
    assert.equal(status(ids[2]).status,'pending_review');
    assert.equal((await fetch(articleUrl)).status,404);
    await page.locator('.nav-item[data-view=articles]').click();
    for (const title of titles) await row(title).waitFor();
    await open(titles[0]);
    await page.locator('#ai-detail-actions [data-ai-action=changes_requested]').click();
    await waitStatus(ids[0],'changes_requested');
    await close();
    await api('edit',{ id:ids[0],title:titles[0],description:'Poprawiony lokalny test',body:'Poprawiona treść lokalnego testu. '.repeat(12),category:'Życie w Belgii',region:'all',sources:[{url:'https://example.org/test-only'}] });
    assert.equal(status(ids[0]).status,'pending_review');
    await page.locator('.nav-item[data-view=articles]').click();
    await open(titles[1]);
    await extra('rejected');
    await page.locator('#cms-confirm-accept').click();
    await waitStatus(ids[1],'rejected');
    await close();
    await open(titles[2]);
    await page.locator('#ai-detail-actions [data-ai-action=approved]').click();
    await waitStatus(ids[2],'approved');
    const brussels = offset => new Date(Date.now()+offset*86400000).toLocaleString('sv-SE',{timeZone:'Europe/Brussels'}).replace(' ','T').slice(0,16);
    await schedule(brussels(5));
    await waitStatus(ids[2],'scheduled');
    const firstTime = status(ids[2]).scheduled_at;
    await schedule(brussels(6));
    for (let attempt=0;attempt<100 && status(ids[2]).scheduled_at === firstTime;attempt++) await new Promise(resolve => setTimeout(resolve,100));
    assert.notEqual(status(ids[2]).scheduled_at,firstTime);
    await close();
    await page.locator('.nav-item[data-view=ai-calendar]').click();
    await page.locator('#ai-calendar-start').fill(brussels(6).slice(0,10));
    await page.locator('#ai-calendar-list').getByText(titles[2],{exact:false}).waitFor();
    await page.locator('.nav-item[data-view=articles]').click();
    await open(titles[2]);
    await page.locator('#ai-detail-actions [data-ai-action="publish-now"]').click();
    assert.equal(status(ids[2]).status,'scheduled');
    await extra('verify-article');
    await page.locator('#ai-verify-form [name="note"]').fill('Sprawdzono lokalny tekst testowy i wskazany link testowy.');
    await page.locator('#ai-verify-form [name="confirmed"]').check();
    await page.locator('#ai-verify-form [type="submit"]').click();
    await page.locator('#ai-verify-dialog').waitFor({state:'hidden'});
    await page.locator('#ai-detail-meta').getByText('Zweryfikowano').waitFor();
    await page.locator('#ai-detail-actions [data-ai-action="publish-now"]').click();
    await waitStatus(ids[2],'published');
    const publishTestCandidate = () => publishLocal(db,new Date(),undefined,undefined,new Set([ids[2]]));
    const result = publishTestCandidate();
    assert.deepEqual(result.published,[]);
    assert.deepEqual(result.materialized,[ids[2]]);
    assert.deepEqual(publishTestCandidate().published,[]);
    assert.equal(status(ids[2]).status,'published');
    assert.equal((await fetch(articleUrl)).status,200);
    assert.ok((await (await fetch(`${base}/artykuly/`)).text()).includes(titles[2]));
    await close();
    await page.locator('.nav-item[data-view=articles]').click();
    await open(titles[2]);
    await extra('archived');
    await page.locator('#cms-confirm-accept').click();
    await waitStatus(ids[2],'archived');
    assert.deepEqual(publishTestCandidate().withdrawn,[ids[2]]);
    assert.equal((await fetch(articleUrl)).status,404);
    assert.ok(!(await (await fetch(`${base}/artykuly/`)).text()).includes(titles[2]));
    assert.equal(db.prepare('SELECT count(*) AS n FROM ai_candidate_history WHERE candidate_id=?').get(ids[2]).n >= 6,true);
  } finally {
    await browser.close();
    for (const file of [articleFile,htmlFile]) if (fs.existsSync(file)) fs.unlinkSync(file);
    for (const id of ids) {
      db.prepare('DELETE FROM ai_candidate_history WHERE candidate_id=?').run(id);
      db.prepare('DELETE FROM ai_editorial WHERE candidate_id=?').run(id);
      db.prepare('DELETE FROM ai_candidates WHERE id=?').run(id);
    }
    db.prepare('DELETE FROM cms_sessions WHERE user_id=?').run(adminId);
    db.prepare('DELETE FROM cms_audit WHERE actor_id=?').run(adminId);
    db.prepare('DELETE FROM cms_users WHERE id=?').run(adminId);
    db.close();
  }
});

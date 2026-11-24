import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { localD1Path } from '../agent/local-db.mjs';
import { hashPassword } from '../cloudflare/auth.mjs';
import { chromium } from 'playwright-core';

const origin = 'http://127.0.0.1:8080';
const db = new DatabaseSync(localD1Path());
db.exec('PRAGMA busy_timeout=5000');
const adminId = randomUUID(), token = randomBytes(32).toString('base64url');
const password = randomBytes(24).toString('base64url');
const ids = [];
let browser;
const request = async body => {
  const response = await fetch(`${origin}/api/ai-editor`, { method:'POST', headers:{ Cookie:`__Host-pbe_session=${token}`,Origin:origin,'Content-Type':'application/json' }, body:JSON.stringify(body) });
  const data = await response.json();
  assert.equal(response.status < 300, true, `${response.status} ${JSON.stringify(data)}`);
  return data;
};
const record = id => db.prepare('SELECT c.title,c.body,c.event_json,c.article_fields_json,e.status,e.public_state,e.published_at,e.approved_at FROM ai_candidates c JOIN ai_editorial e ON e.candidate_id=c.id WHERE c.id=?').get(id);
const make = async (date,endDate=null) => {
  const id = randomBytes(10).toString('hex'); ids.push(id);
  const event = {date,start:null,endDate,end:null,timezone:'Europe/Brussels',city:'Bruksela',venue:'Test',address:'',organizer:'Test',category:'Kultura',region:'brussels',sourceUrl:'https://example.org/event',status:'scheduled',familyFriendly:false};
  const fields = {title_nl:'Testevenement',description_nl:'Korte beschrijving',body_nl:'**Informatie**',title_fr:'Événement test',description_fr:'Brève description',body_fr:'**Informations**'};
  const content = {title:'Wydarzenie testowe',description:'Krótki opis',body:'**Informacje**',articleFields:fields,category:'Kultura',region:'brussels',sources:[{url:event.sourceUrl}],event};
  await request({action:'manual-event',id,...content});
  return {id,content};
};

try {
  const email = `event-targeted-${adminId}@example.invalid`;
  db.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(adminId,email,'Event Targeted Test',await hashPassword(password),'admin');
  db.prepare('INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'),adminId,'2099-01-01T00:00:00Z');
  const past = await make('2026-11-20');
  assert.equal(record(past.id).status,'pending_review');
  browser = await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
  const page = await browser.newPage();
  await page.goto(`${origin}/admin/`);
  await page.locator('#login-form [name="email"]').fill(email);
  await page.locator('#login-form [name="password"]').fill(password);
  await page.locator('#login-form [type="submit"]').click();
  await page.locator('#app-view').waitFor({state:'visible'});
  await page.locator('.nav-item[data-view="events-editor"]').click();
  await page.locator(`#events-editor-list [data-event-edit="${past.id}"]`).click();
  assert.equal(await page.locator(`#event-editor-actions [data-event-action="approved"]`).count(),0);
  assert.equal(await page.locator(`#event-editor-actions [data-event-action="approve-publish-event"]`).count(),1);
  await page.locator(`#event-editor-actions [data-event-action="approve-publish-event"]`).click();
  await page.locator('#cms-confirm-accept').click();
  await page.locator('#event-editor-dialog').waitFor({state:'hidden'});
  const published = record(past.id);
  assert.equal(published.status,'published'); assert.equal(published.public_state,'visible');
  assert.equal(JSON.parse(published.event_json).date,'2026-11-20');
  assert.equal((await fetch(`${origin}/wydarzenia/ai-${past.id}/`)).status,200);
  await page.locator(`#events-editor-list [data-event-edit="${past.id}"]`).click();
  assert.equal((await page.locator('#event-editor-form [type="submit"]').textContent()).trim(),'Zapisz zmiany');
  await page.locator('#event-editor-form [name="description"]').fill('Opis poprawiony w CMS.');
  await page.locator('#event-editor-form [type="submit"]').click();
  await page.locator('#cms-confirm-accept').click();
  await page.locator('#event-editor-dialog').waitFor({state:'hidden'});
  assert.equal(record(past.id).status,'published');
  assert.match((await (await fetch(`${origin}/wydarzenia/ai-${past.id}/`)).text()),/Opis poprawiony w CMS/);
  const changed = {...past.content,title:'Zmienione wydarzenie testowe',body:'**Nowa treść**'};
  await request({action:'edit',id:past.id,...changed,confirmed:true});
  const revised = record(past.id);
  assert.equal(revised.status,'published'); assert.equal(revised.published_at,published.published_at);
  assert.equal(revised.approved_at,published.approved_at); assert.equal(revised.body,'**Nowa treść**');
  assert.equal(JSON.parse(revised.article_fields_json).title_nl,'Testevenement');
  const future = await make('2026-12-10');
  await request({action:'edit',id:future.id,...future.content,description:'Zmieniony opis przyszłego wydarzenia'});
  assert.equal(record(future.id).status,'pending_review');
  const multi = await make('2026-11-20','2026-11-27');
  await request({action:'approve-publish-event',id:multi.id});
  assert.equal(JSON.parse(record(multi.id).event_json).endDate,'2026-11-27');
  assert.equal(JSON.parse(record(multi.id).event_json).end,null);
  const publicEvents = await (await fetch(`${origin}/api/public-events`)).json();
  assert.equal(publicEvents.events.some(event => event.url.endsWith(`${multi.id}/`) && event.endDate === '2026-11-27' && event.title_nl === 'Testevenement'),true);
  console.log('Past publication, one-step approval, published edit, future edit, multi-day date and public translations: OK');
} finally {
  if (browser) await browser.close();
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

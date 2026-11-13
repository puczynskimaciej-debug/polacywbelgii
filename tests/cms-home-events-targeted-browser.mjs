import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
import { hashPassword } from '../cloudflare/auth.mjs';
import { localD1Path } from '../agent/local-db.mjs';

const origin = process.env.LOCAL_CMS_ORIGIN || 'http://127.0.0.1:8080';
const db = new DatabaseSync(localD1Path()); db.exec('PRAGMA busy_timeout=5000');
const userId = randomUUID(), email = `cms-home-${userId}@example.invalid`, password = randomBytes(30).toString('base64url');
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless:true });
const futureDate = days => new Date(Date.now()+days*86400000).toISOString().slice(0,10);
const events = [
  {url:'/wydarzenia/test-a/',title:'Wydarzenie A',description:'Opis A',date:futureDate(3),start:null,end:null,region:'flanders',city:'Antwerpia',organizer:'Organizator A'},
  {url:'/wydarzenia/test-b/',title:'Wydarzenie B',description:'Opis B',date:futureDate(6),start:`${futureDate(6)}T12:00:00.000Z`,end:null,region:'wallonia',city:'Namur',organizer:'Organizator B'},
  {url:'/wydarzenia/test-c/',title:'Wydarzenie C',description:'Opis C',date:futureDate(10),start:null,end:null,region:'brussels',city:'Bruksela',organizer:'Organizator C'},
  {url:'/wydarzenia/test-old/',title:'Wydarzenie zakończone',description:'Stare',date:futureDate(-4),start:null,end:null,region:'brussels',city:'Bruksela'}
];
try {
  db.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(userId,email,'Targeted CMS test',await hashPassword(password),'admin');
  const cms = await browser.newPage();
  await cms.goto(`${origin}/admin/`);
  await cms.locator('#login-form [name=email]').fill(email);
  await cms.locator('#login-form [name=password]').fill(password);
  await cms.locator('#login-form [type=submit]').click();
  await cms.locator('#app-view').waitFor({state:'visible'});
  await cms.locator('.nav-item[data-view=articles]').click();
  await cms.locator('#articles-list').getByText('Ilu Polaków mieszka w Belgii?',{exact:false}).waitFor();
  assert.equal(await cms.locator('#articles-list').getByText('Koncert duetu Coals',{exact:false}).count(),0);
  assert.equal(await cms.locator('#articles-list').getByText('Konferencja: Uprowadzenie dzieci',{exact:false}).count(),0);
  await cms.locator('.nav-item[data-view=ai-editor]').click();
  assert.equal(await cms.locator('#ai-queue').count(),0);
  await cms.locator('.nav-item[data-view=articles]').click();
  await cms.locator('#articles-status').selectOption('pending_review');
  assert.equal(await cms.locator('#articles-list').getByText('Ilu Polaków mieszka w Belgii?',{exact:false}).count(),0);
  await cms.locator('.nav-item[data-view=events-editor]').click();
  await cms.locator('#events-editor-list').getByText('Koncert duetu Coals',{exact:false}).waitFor();
  await cms.locator('#events-editor-list').getByText('Konferencja: Uprowadzenie dzieci',{exact:false}).waitFor();
  assert.ok(await cms.locator('#events-editor-list').getByText('AI Redaktor',{exact:true}).count() >= 2);
  assert.ok(await cms.locator('#events-editor-list').getByText('Redakcja',{exact:true}).count() >= 1);
  const coalsId = db.prepare("SELECT id FROM ai_candidates WHERE kind='event' AND title LIKE 'Koncert duetu Coals%' LIMIT 1").get()?.id;
  assert.ok(coalsId);
  await cms.locator(`#events-editor-list [data-event-edit="${coalsId}"]`).click();
  await cms.locator('#event-editor-dialog').waitFor({state:'visible'});
  assert.equal(await cms.locator('#event-editor-form [name=title]').inputValue(),'Koncert duetu Coals w brukselskim Botanique');
  assert.equal(await cms.locator('#event-editor-form [name=title]').isEnabled(),true);
  await cms.locator('#event-editor-close').click();
  await cms.locator('[data-panel=events-editor] [data-event-view=event-calendar]').click();
  await cms.locator('#event-calendar-month').waitFor({state:'visible'});
  assert.ok(await cms.locator('#event-calendar-grid .calendar-day').count() >= 28);
  for(const [language,menu,list] of [['en','Events','Event list'],['nl','Evenementen','Evenementenlijst'],['fr','Événements','Liste des événements']]) {
    await cms.locator('#cms-language').selectOption(language);
    assert.equal(await cms.locator('.nav-item[data-view=events-editor] span').textContent(),menu);
    assert.equal(await cms.locator('[data-panel=event-calendar] [data-event-view=events-editor]').textContent(),list);
  }
  await cms.close();

  for (const width of [1280,390]) {
    const page = await browser.newPage({viewport:{width,height:900}});
    let publicEvents = [events[0],events[0],...events.slice(1)];
    await page.route('**/api/public-events',route => route.fulfill({contentType:'application/json',body:JSON.stringify({events:publicEvents})}));
    await page.goto(origin);
    await page.locator('#home-events .event-card').first().waitFor();
    assert.equal(await page.locator('#home-events .event-card').count(),2);
    assert.equal(await page.locator('#home-events .event-card').first().getByText('Wydarzenie A').count(),1);
    assert.equal(await page.locator('#home-events').getByText('Wydarzenie C').count(),0);
    assert.equal(await page.locator('#home-events').getByText('Wydarzenie zakończone').count(),0);
    assert.equal(await page.locator('#home-events .event-card__date').first().getByText('Godzina nieustalona').count(),0);
    assert.equal(await page.locator('#home-events .event-card__time').first().textContent(),'Godzina nieustalona');
    const gap = await page.evaluate(() => { const carousel=document.querySelector('#listing-top .top-carousel'); return carousel ? document.querySelector('#home-events-heading').getBoundingClientRect().top - carousel.getBoundingClientRect().bottom : null; });
    if(gap !== null) assert.ok(gap < 100,`Excessive gap: ${gap}px at ${width}px`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1),true);
    if(width===1280) {
      for(const [language,buttonText,timeText] of [['en','See in calendar','Time to be confirmed'],['nl','Bekijk in kalender','Tijd nog te bepalen'],['fr','Voir dans le calendrier','Heure à confirmer']]) {
        await page.locator('.language-picker__button').click();
        await page.locator(`[data-lang="${language}"]`).click();
        assert.equal(await page.locator('#home-events .event-card__button').first().textContent(),buttonText);
        assert.equal(await page.locator('#home-events .event-card__time').first().textContent(),timeText);
      }
      await page.locator('.language-picker__button').click();
      await page.locator('[data-lang="pl"]').click();
    }
    await page.locator('#home-events .event-card__button').first().click();
    await page.locator('#event-calendar-dialog').waitFor({state:'visible'});
    assert.equal(await page.locator('[data-event-region=flanders]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator(`[data-date="${events[0].date}"]`).getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.event-day-event-detail:visible').count(),1);
    assert.match(await page.locator('.event-day-event-detail:visible').textContent(),/Wydarzenie A/);
    if(width===1280) {
      publicEvents=[events[1]]; await page.reload();
      await page.locator('#home-events .event-card').waitFor();
      assert.equal(await page.locator('#home-events .event-card').count(),1);
      publicEvents=[]; await page.reload();
      await page.locator('.home-events-empty').waitFor();
      assert.equal(await page.locator('#home-events .event-card').count(),0);
      await page.locator('#home-events > .event-card__button').click();
      assert.equal(await page.locator('#event-calendar-dialog').isVisible(),true);
    }
    await page.close();
  }
  console.log('Targeted CMS/home events browser checks passed');
} finally {
  await browser.close();
  db.prepare('DELETE FROM cms_sessions WHERE user_id=?').run(userId);
  db.prepare('DELETE FROM cms_audit WHERE actor_id=?').run(userId);
  db.prepare('DELETE FROM cms_users WHERE id=?').run(userId);
  db.close();
}

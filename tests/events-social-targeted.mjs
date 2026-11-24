import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const origin='http://127.0.0.1:8080';
const event=(id,date,endDate=null,start=null)=>({url:`/wydarzenia/ai-${id}/`,title:id,title_nl:`NL ${id}`,title_fr:`FR ${id}`,description:'Opis',description_nl:'Beschrijving',description_fr:'Description',date,endDate,start,region:'all',city:'Bruksela',category:'Kultura',isHoliday:false});
const ongoing=['Charleroi','Brugia','Liège','Winter Wonders','Lodowe Królestwo'].map((name,index)=>event(name,'2026-11-20',index===4?'2027-01-01':'2027-01-03'));
const events=[...ongoing,event('Dzisiaj','2026-11-24',null,'2026-11-24T10:00:00Z'),event('Jutro','2026-11-25'),event('Spacer Hasselt','2026-12-12',null,'2026-12-12T09:00:00Z'),event('Spotkanie opłatkowe','2026-12-12',null,'2026-12-12T13:00:00Z')];
const browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
try {
  const request=await browser.newContext().then(context=>context.request);
  for(const [path,locale] of [['/','pl_PL'],['/?lang=nl','nl_BE'],['/?lang=fr','fr_BE']]) {
    const response=await request.get(`${origin}${path}`);
    assert.equal(response.status(),200);
    const html=await response.text();
    assert.match(html,new RegExp(`<meta property="og:locale" content="${locale}">`));
    assert.match(html,/<meta property="og:image" content="https:\/\/www\.polacywbelgii\.eu\/images\/social-home\.png">/);
    assert.match(html,/<meta property="og:title" content="[^"]+">/);
    assert.match(html,/<meta property="og:description" content="[^"]+">/);
    assert.match(html,/<meta property="og:url" content="https:\/\/www\.polacywbelgii\.eu\//);
  }
  assert.equal((await request.get(`${origin}/images/social-home.png`)).status(),200);
  for(const language of ['pl','nl','fr']) {
    const context=await browser.newContext({viewport:{width:375,height:812}});
    await context.route('**/api/public-events',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({events})}));
    const page=await context.newPage();
    await page.clock.install({time:new Date('2026-11-24T12:00:00Z')});
    await page.addInitScript(lang=>sessionStorage.setItem('siteLanguage',lang),language);
    await page.goto(origin);
    await page.locator('#home-events .event-card').first().waitFor();
    assert.deepEqual(await page.locator('#home-events .event-card h3').allTextContents(),language==='pl'?['Dzisiaj','Jutro']:[`${language.toUpperCase()} Dzisiaj`,`${language.toUpperCase()} Jutro`]);
    assert.equal(await page.locator('#home-events > .event-card__button').count(),1);
    await page.locator('[data-event-open]').first().click();
    await page.locator('[data-event-month="next"]').click();
    await page.locator('#event-calendar-grid [data-date="2026-12-12"]').click();
    const groups=page.locator('#event-day-details .event-day-group');
    assert.equal(await groups.count(),2);
    assert.deepEqual(await groups.nth(0).locator('.event-day-event').evaluateAll(nodes=>nodes.map(node=>node.firstChild.textContent)),['Spacer Hasselt','Spotkanie opłatkowe'].map(title=>language==='pl'?title:`${language.toUpperCase()} ${title}`));
    assert.equal(await groups.nth(1).locator('.event-day-item').count(),5);
    assert.match(await groups.nth(1).textContent(),/20\.11\.2026/);
    assert.match(await groups.nth(1).textContent(),/03\.01\.2027/);
    assert.equal(await page.locator('#event-calendar-grid [data-date="2026-12-12"] .event-day-dot').count(),2);
    if(language==='pl')await page.locator('#event-calendar-dialog').screenshot({path:'.local/event-calendar-mobile.png'});
    await page.locator('#event-calendar-grid [data-date="2026-12-13"]').click();
    assert.equal(await page.locator('#event-day-details .event-day-group').count(),1);
    assert.equal(await page.locator('#event-day-details .event-day-dot--ongoing').count(),1);
    await page.locator('[data-event-month="prev"]').click();
    await page.locator('#event-calendar-grid [data-date="2026-11-20"]').click();
    assert.equal(await page.locator('#event-day-details .event-day-group').count(),1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await context.close();
  }
  const context=await browser.newContext();
  let current=[ongoing[0],event('Jedno przyszłe','2026-12-01')];
  await context.route('**/api/public-events',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({events:current})}));
  const page=await context.newPage();
  await page.clock.install({time:new Date('2026-11-24T12:00:00Z')});
  await page.goto(origin);
  await page.locator('#home-events .event-card').waitFor();
  assert.equal(await page.locator('#home-events .event-card').count(),1);
  current=[ongoing[0]];
  await page.reload();
  await page.locator('#home-events .home-events-empty').waitFor();
  assert.equal(await page.locator('#home-events .event-card').count(),0);
  assert.equal(await page.locator('#home-events > .event-card__button').count(),1);
  await context.close();
  console.log('OG PL/NL/FR, grupy kalendarza, historia, mobile i limit kart: OK');
} finally {await browser.close();}

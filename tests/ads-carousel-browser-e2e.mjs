import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const origin='http://localhost:8080';
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const premium=Array.from({length:2},(_,index)=>({id:`premium-${index}`,type:'PREMIUM',kind:'image',language:'pl',region:'all',image,imageMobile:image,company:'Test',title:`Premium ${index}`,description:'Test',url:'https://example.com'}));
const top=Array.from({length:5},(_,index)=>({id:`top-${index}`,type:'TOP',kind:'text',language:'pl',region:'all',title:`Top ${index}`,description:'Test',contact:'test@example.com'}));
const standard=Array.from({length:30},(_,index)=>({id:`standard-${index}`,type:'STANDARD',kind:'text',language:'pl',region:index<10?'flanders':index<20?'wallonia':'all',title:`Standard ${index}`,description:'Test',contact:'test@example.com'}));
const ads=[...premium,...top,...standard];
const page=await browser.newPage({viewport:{width:1280,height:900}});
await page.route('**/api/ads?action=public*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({ads})}));
try {
  await page.goto(origin);
  await page.locator('#listing-top .listing-card').first().waitFor();
  assert.equal(await page.locator('[data-ad-prev],[data-ad-next],[data-ad-pause],.ad-rotation-controls').count(),0);
  await page.locator('#listing-premium .ad-dots button').last().click();
  await page.locator('#listing-top .ad-dots button').last().click();
  const topBefore=await page.locator('#listing-top .top-carousel').evaluate(node=>node.scrollLeft);
  assert.ok(topBefore>0);
  const premiumBefore=await page.locator('#listing-premium .premium-banner__link.is-current').evaluate(node=>[...node.parentElement.children].indexOf(node));
  await page.waitForTimeout(5500);
  assert.notEqual(await page.locator('#listing-premium .premium-banner__link.is-current').evaluate(node=>[...node.parentElement.children].indexOf(node)),premiumBefore);
  assert.ok(await page.locator('#listing-top .top-carousel').evaluate(node=>node.scrollLeft)<topBefore);
  const track=page.locator('#ogloszenia [data-ad-list="STANDARD"]');
  await track.focus();
  for(let attempt=0;attempt<30;attempt++) {
    if(await page.locator('#ogloszenia .ad-dots button[aria-current="true"]').getAttribute('aria-label')==='STANDARD: 26/26') break;
    await page.keyboard.press('ArrowRight');
  }
  await page.waitForTimeout(500);
  assert.ok(await page.locator('#ogloszenia .ad-dots button').count()<=5);
  assert.equal(await page.locator('#ogloszenia .ad-dots button[aria-current="true"]').getAttribute('aria-label'),'STANDARD: 26/26');
  const last=await track.evaluate(node=>{const card=node.lastElementChild.getBoundingClientRect(),box=node.getBoundingClientRect();return {left:card.left,right:card.right,boxLeft:box.left,boxRight:box.right,scrollbar:getComputedStyle(node).scrollbarWidth};});
  assert.ok(last.left>=last.boxLeft-2 && last.right<=last.boxRight+2,JSON.stringify(last));
  assert.equal(last.scrollbar,'none');
  await page.setViewportSize({width:390,height:844});
  await page.locator('#ogloszenia .ad-dots button').last().click();
  await page.waitForFunction(() => { const node=document.querySelector('#ogloszenia [data-ad-list="STANDARD"]'); return Math.abs(node.scrollLeft-(node.scrollWidth-node.clientWidth))<2; },{timeout:3000});
  const mobileLast=await track.evaluate(node=>{const card=node.lastElementChild.getBoundingClientRect(),box=node.getBoundingClientRect();return card.left>=box.left-2 && card.right<=box.right+2;});
  assert.equal(mobileLast,true);
  await page.goto(`${origin}/ogloszenia/?region=flanders`);
  await page.locator('#listing-top .listing-card').first().waitFor();
  assert.equal(await page.locator('main > :first-child').getAttribute('id'),'listing-premium');
  assert.equal(await page.locator('#listing-top .top-carousel .listing-card').count(),5);
  assert.equal(await page.locator('#listing-premium .premium-banner__link').count(),2);
  assert.equal(await page.locator('#ogloszenia .listing-card').count(),20);
  await page.locator('[data-ad-region="wallonia"]').click();
  assert.equal(await page.locator('#listing-top .listing-card').count(),5);
  assert.equal(await page.locator('#listing-premium .premium-banner__link').count(),2);
  assert.equal(await page.locator('#ogloszenia .listing-card').count(),20);
  await page.locator('#listing-top .ad-dots button').last().click();
  await page.waitForFunction(() => { const node=document.querySelector('#listing-top .top-carousel'); return Math.abs(node.scrollLeft-(node.scrollWidth-node.clientWidth))<2; });
  const topLast=await page.locator('#listing-top .top-carousel').evaluate(node=>{const card=node.lastElementChild.getBoundingClientRect(),box=node.getBoundingClientRect();return card.left>=box.left-2&&card.right<=box.right+2;});
  assert.equal(topLast,true);
  await page.waitForTimeout(5500);
  await page.waitForFunction(() => document.querySelector('#listing-top .top-carousel').scrollLeft<2);
  console.log('Ads carousel browser E2E: manual dots, autoplay resumes, last cards, resize, layout and STANDARD-only filtering OK');
} finally { await browser.close(); }

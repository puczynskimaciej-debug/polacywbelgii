import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({executablePath:process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  for (const slug of ['regulamin','regulamin-ogloszen','polityka-prywatnosci','polityka-cookies','zrodla-i-licencje']) {
    const response = await page.goto(`http://localhost:8080/${slug}/`);
    assert.equal(response.status(),200,slug);
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex, nofollow');
    assert.ok(await page.locator('.legal-content').innerText());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1),true,slug);
  }
  await page.locator('.nav-toggle').click();
  await page.locator('.language-picker__button').click();
  await page.locator('[data-lang="en"]').click();
  await page.waitForURL('**/en/zrodla-i-licencje/');
  assert.equal(await page.locator('.legal-language-fallback').isVisible(),false);
  assert.equal((await page.locator('[data-i18n="legal.heading"]').first().textContent()).trim(),'Legal information');
  for (const lang of ['en','nl','fr']) {
    await page.evaluate(language => localStorage.setItem('siteLanguage',language),lang);
    for (const slug of ['regulamin','regulamin-ogloszen','polityka-prywatnosci','polityka-cookies']) {
      const response=await page.goto(`http://localhost:8080/${lang}/${slug}/`);
      assert.equal(response.status(),200,`${lang}/${slug}`);
      assert.equal(await page.locator('.legal-content').getAttribute('lang'),lang);
      assert.equal(await page.locator('.legal-language-fallback').isVisible(),false);
      assert.ok((await page.locator('.legal-content').innerText()).length>500);
      const width=await page.evaluate(() => ({page:document.documentElement.scrollWidth,body:document.body.scrollWidth,viewport:innerWidth,wide:[...document.querySelectorAll('body *')].filter(node => node.getBoundingClientRect().right>innerWidth+1 || node.scrollWidth>node.clientWidth+1).slice(0,10).map(node => ({tag:node.tagName,cls:node.className,scroll:node.scrollWidth,client:node.clientWidth,text:node.textContent?.slice(0,60)}))}));
      assert.equal(width.page<=width.viewport+1,true,`${lang}/${slug}: ${JSON.stringify(width)}`);
    }
  }
  await page.goto('http://localhost:8080/');
  assert.equal(await page.locator('.site-footer__map-credit').count(),0);
  assert.equal(await page.locator('.site-footer a[href$="/zrodla-i-licencje/"]').count(),1);
  console.log('Legal pages browser E2E: four languages, draft marker, mobile width and map credit link OK');
} finally { await browser.close(); }

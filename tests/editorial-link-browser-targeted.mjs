import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

test('article editor creates and edits HTTPS Markdown links without losing text',async()=>{
  const files={
    '/visual-editor.js':readFileSync(new URL('../admin-app/visual-editor.js',import.meta.url)),
    '/ui.js':readFileSync(new URL('../admin-app/ui.js',import.meta.url))
  };
  const server=createServer((request,response)=>{
    if(files[request.url]){response.setHeader('content-type','text/javascript; charset=utf-8');response.end(files[request.url]);return;}
    response.setHeader('content-type','text/html; charset=utf-8');
    response.end('<form id="article-form"><textarea name="body_pl">Otwórz urząd i sprawdź formularz.</textarea></form><script type="module" src="/visual-editor.js"></script>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
    const page=await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(()=>document.dispatchEvent(new Event('cms:article-editor-open')));
    await page.evaluate(()=>{const text=document.querySelector('.visual-surface').firstChild.firstChild,range=document.createRange();range.setStart(text,7);range.setEnd(text,12);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);});
    page.once('dialog',dialog=>dialog.accept('https://example.gov.be/formularz'));
    await page.locator('[data-visual-action="link"]').click();
    assert.match(await page.locator('textarea[name="body_pl"]').inputValue(),/\[urząd\]\(https:\/\/example\.gov\.be\/formularz\)/);
    await page.evaluate(()=>{const text=document.querySelector('.visual-surface a').firstChild,range=document.createRange();range.setStart(text,2);range.collapse(true);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);});
    page.once('dialog',dialog=>{assert.equal(dialog.defaultValue(),'https://example.gov.be/formularz');return dialog.accept('https://example.gov.be/nowy');});
    await page.locator('[data-visual-action="link"]').click();
    assert.match(await page.locator('textarea[name="body_pl"]').inputValue(),/\[urząd\]\(https:\/\/example\.gov\.be\/nowy\)/);
    assert.match(await page.locator('textarea[name="body_pl"]').inputValue(),/sprawdź formularz/);
  }catch(error){process.stderr.write(`${error.stack}\n`);throw error;}
  finally{await Promise.race([browser?.close()||Promise.resolve(),new Promise(resolve=>setTimeout(resolve,2000))]);server.closeAllConnections();server.close();server.unref();}
});

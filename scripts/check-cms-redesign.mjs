import path from 'node:path';
import { randomBytes,randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
import { hashPassword } from '../cloudflare/auth.mjs';
import { openLocalDb } from '../agent/local-db.mjs';

const root=path.resolve(import.meta.dirname,'..');
const password=randomBytes(30).toString('base64url');
const adminId=randomUUID();
const email=`cms-redesign-${adminId}@example.invalid`;
const db=openLocalDb();
db.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(adminId,email,'Test interfejsu',await hashPassword(password),'admin');
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
const results=[];
try{
  for(const width of [1440,1024,768,390]){
    const page=await browser.newPage({viewport:{width,height:900}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://localhost:8080/admin/');
    await page.locator('#login-form input[name=email]').fill(email);
    await page.locator('#login-form input[name=password]').fill(password);
    await page.locator('#login-form button').click();
    try{await page.locator('#app-view').waitFor({state:'visible',timeout:15000});}
    catch(error){console.log(JSON.stringify({width,errors,auth:await page.locator('#auth-error').innerText(),passwordView:await page.locator('#password-view').isVisible(),loading:await page.locator('#loading-view').isVisible()}));throw error;}
    const overflow=async()=>page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    const view=async name=>{if(width<=800)await page.locator('#menu-toggle').click();await page.locator(`.nav-item[data-view="${name}"]`).click();await page.waitForTimeout(250);};
    await view('ai-editor');
    await page.locator('#ai-queue .data-table tbody tr').first().waitFor({timeout:15000});
    await page.locator('#ai-queue [data-ai-open]').first().click();
    await page.locator('[data-ai-panel=preview] h1').waitFor();
    await page.screenshot({path:path.join(root,'.local',`cms-redesign-detail-${width}.png`),fullPage:true});
    const markdownRendered=await page.locator('[data-ai-panel=preview] h2').count()>0;
    await page.locator('[data-ai-tab=preview]').focus();
    await page.keyboard.press('ArrowRight');
    const keyboardTab=await page.locator('[data-ai-panel=edit]').isVisible();
    await page.locator('[data-ai-tab=sources]').click();
    const sources=await page.locator('#ai-detail-sources a').count();
    await page.locator('[data-ai-tab=edit]').click();
    const editVisible=await page.locator('#ai-edit-form textarea[name=body]').isVisible();
    await page.locator('#ai-detail-dialog [data-close]').click();
    const queueOverflow=await overflow();
    await page.screenshot({path:path.join(root,'.local',`cms-redesign-queue-${width}.png`),fullPage:true});
    await view('ai-calendar');const calendarEntries=await page.locator('#ai-calendar-list .calendar-day').count();
    await view('ads');await page.locator('#ads-orders').waitFor();
    const adsNotice=await page.locator('#ads-notice').innerText();
    const adsOverflow=await overflow();
    await page.screenshot({path:path.join(root,'.local',`cms-redesign-${width}.png`),fullPage:true});
    const sections={};
    for(const name of ['dashboard','home','articles','media','contact','users','history']){await view(name);sections[name]={visible:await page.locator(`[data-panel="${name}"]`).isVisible(),overflow:await overflow()};if(name==='articles'){await page.locator('[data-panel=articles] [data-open-ai]').first().click();sections.articles.aiDetail=await page.locator('#ai-detail-dialog').isVisible();await page.locator('#ai-detail-dialog [data-close]').click();}}
    await view('dashboard');
    await page.screenshot({path:path.join(root,'.local',`cms-redesign-dashboard-${width}.png`),fullPage:true});
    results.push({width,queueOverflow,adsOverflow,markdownRendered,keyboardTab,sources,editVisible,calendarEntries,adsNotice,sections,errors});
    await page.close();
  }
  console.log(JSON.stringify(results));
}finally{await browser.close();db.prepare('DELETE FROM cms_sessions WHERE user_id=?').run(adminId);db.prepare('DELETE FROM cms_audit WHERE actor_id=?').run(adminId);db.prepare('DELETE FROM cms_users WHERE id=?').run(adminId);db.close();}

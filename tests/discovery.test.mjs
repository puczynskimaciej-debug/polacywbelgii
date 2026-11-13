import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { runDiscovery, discoverLinks } from '../cloudflare/discovery.mjs';

function db() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of ['001_agent.sql','002_editorial.sql','004_discovery.sql']) sqlite.exec(readFileSync(new URL(`../agent/migrations/${file}`,import.meta.url),'utf8'));
  const prepare = (sql,values=[]) => ({ bind(...params) { return prepare(sql,params); }, async first() { return sqlite.prepare(sql).get(...values) || null; }, async all() { return { results:sqlite.prepare(sql).all(...values) }; }, async run() { const result=sqlite.prepare(sql).run(...values); return { meta:{ changes:result.changes } }; } });
  return { sqlite,prepare,async batch(statements) { sqlite.exec('BEGIN'); try { const output=[]; for(const statement of statements) output.push(await statement.run()); sqlite.exec('COMMIT'); return output; } catch(error) { sqlite.exec('ROLLBACK'); throw error; } } };
}
const newsUrl = 'https://www.gov.pl/web/belgia/nowe-zasady-podrozy-dla-polakow-w-belgii';
const eventUrl = 'https://instytutpolski.pl/brussels/en/2026/11/11/polish-concert-in-brussels/';
const phrases = ['Official information confirms the date and location of the programme in Brussels.', 'The organiser published the complete details and participation conditions.'];
const detail = `<html><body><main>${phrases.join(' ')} ${'Additional verified context about the event or article. '.repeat(20)}</main></body></html>`;
const page = html => ({ok:true,headers:new Headers({'content-type':'text/html'}),text:async()=>html});
const gemini = output => ({ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(output)}]}}],usageMetadata:{promptTokenCount:500,candidatesTokenCount:600}})});
const body = url => `${'Oryginalny polski artykuł oparty na źródle i sprawdzanych faktach. '.repeat(8)}\n\nŹródło: ${url}`;
const newsOutput = {title:'Nowe zasady podróży dla Polaków mieszkających w Belgii',description:'Aktualne informacje opublikowane na oficjalnej stronie polskiej placówki w Belgii.',body:body(newsUrl),evidenceQuotes:phrases,urgent:false};
const eventOutput = {title:'Polski koncert w Brukseli dla społeczności polonijnej',description:'Zapowiedź koncertu opublikowana przez Instytut Polski w Brukseli.',body:body(eventUrl),evidenceQuotes:phrases,event:{start:'2026-11-20T18:00:00.000Z',end:'2026-11-20T20:00:00.000Z',timezone:'Europe/Brussels',city:'Bruksela',venue:'Sala koncertowa',organizer:'Instytut Polski w Brukseli',category:'Koncert',region:'brussels',sourceUrl:eventUrl,status:'scheduled'}};
const env = DB => ({DB,GEMINI_API_KEY:'local_test_only',GEMINI_FREE_TIER_CONFIRMED:'1',AI_AUTOMATION_ENABLED:'1'});

test('official news discovery creates one pending article and deduplicates retries',async()=>{
  const DB=db(); let calls=0;
  const fetcher=async url=>{ if(url.includes('generativelanguage')) { calls++; return gemini(newsOutput); } if(url===newsUrl) return page(detail); return page(`<p>11.11.2026</p><a href="${newsUrl}">Nowe zasady podróży dla Polaków w Belgii</a>`); };
  const first=await runDiscovery('article',env(DB),{fetcher,now:new Date('2026-11-11T12:00:00Z')});
  assert.equal(first.created,1,JSON.stringify(first));
  assert.equal(DB.sqlite.prepare('SELECT status FROM ai_editorial').get().status,'pending_review');
  assert.equal(DB.sqlite.prepare('SELECT json_extract(verification_json,\'$.status\') AS status FROM ai_candidates').get().status,'needs_review');
  assert.equal(DB.sqlite.prepare('SELECT calls FROM ai_daily_budget').get().calls,1);
  const second=await runDiscovery('article',env(DB),{fetcher,now:new Date('2026-11-11T13:00:00Z')});
  assert.equal(second.created,0); assert.equal(calls,1);
  DB.sqlite.close();
});

test('event discovery records complete unapproved event; no event and source failure create none',async()=>{
  const DB=db();
  const fetcher=async url=>url.includes('generativelanguage')?gemini(eventOutput):url===eventUrl?page(detail):page(`<a href="${eventUrl}">Polski koncert w Brukseli dla Polonii</a>`);
  const result=await runDiscovery('event',env(DB),{fetcher,now:new Date('2026-11-11T12:00:00Z')});
  assert.equal(result.created,1,JSON.stringify(result));
  assert.equal(DB.sqlite.prepare("SELECT json_extract(event_json,'$.city') AS city FROM ai_candidates").get().city,'Bruksela');
  assert.equal(DB.sqlite.prepare('SELECT approved_by FROM ai_editorial').get().approved_by,null);
  const empty=await runDiscovery('event',env(DB),{fetcher:async()=>page('<html>No events</html>'),now:new Date('2026-11-12T12:00:00Z')});
  assert.equal(empty.created,0);
  const failure=await runDiscovery('event',env(DB),{fetcher:async()=>{throw new Error('offline');},now:new Date('2026-11-13T12:00:00Z')});
  assert.equal(failure.status,'failed'); assert.equal(failure.created,0);
  DB.sqlite.close();
});

test('stale news and Gemini failure do not create articles or exceed call budget',async()=>{
  const DB=db();
  const stale=await runDiscovery('article',env(DB),{fetcher:async()=>page(`<p>01.01.2026</p><a href="${newsUrl}">Nowe zasady podróży dla Polaków w Belgii</a>`),now:new Date('2026-11-11T12:00:00Z')});
  assert.equal(stale.created,0);
  const fetcher=async url=>url.includes('generativelanguage')?{ok:false,status:503}:url===newsUrl?page(detail):page(`<p>11.11.2026</p><a href="${newsUrl}">Nowe zasady podróży dla Polaków w Belgii</a>`);
  const error=await runDiscovery('article',env(DB),{fetcher,now:new Date('2026-11-11T13:00:00Z')});
  assert.equal(error.created,0); assert.equal(error.status,'failed');
  assert.equal(DB.sqlite.prepare('SELECT count(*) n FROM ai_candidates').get().n,0);
  assert.equal(DB.sqlite.prepare('SELECT calls FROM ai_daily_budget').get().calls,1);
  DB.sqlite.close();
});

test('link discovery excludes external and malformed URLs',()=>{
  assert.deepEqual(discoverLinks(`<a href="https://evil.example/x">Polski koncert w Brukseli</a><a href="${eventUrl}">Polski koncert w Brukseli</a>`, 'https://instytutpolski.pl/brussels/en/category/programme-en/','event').map(item=>item.url),[eventUrl]);
});

test('event discovery rejects a model time that conflicts with the official page',async()=>{
  const DB=db();
  const detailWithTime=detail.replace('</main>',' Time: 19:30-21:00</main>');
  const fetcher=async url=>url.includes('generativelanguage')?gemini(eventOutput):url===eventUrl?page(detailWithTime):page(`<a href="${eventUrl}">Polski koncert w Brukseli dla Polonii</a>`);
  const result=await runDiscovery('event',env(DB),{fetcher,now:new Date('2026-11-11T12:00:00Z')});
  assert.equal(result.created,0);
  assert.equal(result.errors[0].code,'invalid_event');
  assert.equal(DB.sqlite.prepare('SELECT count(*) n FROM ai_candidates').get().n,0);
  DB.sqlite.close();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { canonicalUrl, duplicateOf, parseFeed, parseHtmlLinks, processItems, verifyItem } from '../agent/core.mjs';
import { BudgetExceeded, estimateCost, generateWithProvider } from '../agent/provider.mjs';
import { openLocalDb, syncLocalState, loadLocalState } from '../agent/local-db.mjs';
import { brusselsToUtc, utcToBrussels, canTransition, proposeSlot, dueCandidates } from '../agent/editorial.mjs';
import { publishLocal } from '../agent/publish-local.mjs';

const fixtures = JSON.parse(await fs.readFile(path.resolve('agent/fixtures.json'), 'utf8'));
const now = new Date('2026-11-09T12:00:00Z');

test('Brussels scheduling handles DST gaps, folds and reserved slots', () => {
  assert.equal(brusselsToUtc('2027-03-28T08:00'), '2027-03-28T06:00:00.000Z');
  assert.throws(() => brusselsToUtc('2027-03-28T02:30'), /Nonexistent/);
  assert.throws(() => brusselsToUtc('2027-10-31T02:30'), /Ambiguous/);
  assert.equal(brusselsToUtc('2027-10-31T02:30','earlier'), '2027-10-31T00:30:00.000Z');
  assert.equal(brusselsToUtc('2027-10-31T02:30','later'), '2027-10-31T01:30:00.000Z');
  assert.equal(utcToBrussels('2027-03-28T06:00:00Z'), '2027-03-28T08:00');
  const existing = [{ status: 'scheduled', scheduledAt: '2026-11-10T07:00:00.000Z' }];
  assert.equal(proposeSlot(existing, undefined, now), '2026-11-09T16:00:00.000Z');
  assert.equal(dueCandidates([{ status: 'scheduled', approvedBy: 'admin', approvedAt: now.toISOString(), scheduledAt: now.toISOString(), publicState: 'hidden' }], now).length,1);
  assert.equal(dueCandidates([{ status: 'scheduled', approvedBy: null, approvedAt: null, scheduledAt: now.toISOString(), publicState: 'hidden' }], now).length,0);
  assert.equal(canTransition('pending_review','published','agent'),false);
  assert.equal(canTransition('published','archived','admin'),true);
});

test('local publisher writes approved due content once and removes withdrawn HTML', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(),'pbe-editorial-'));
  const db = openLocalDb(':memory:');
  const id = 'c'.repeat(20); const due = '2026-01-01T08:00:00.000Z';
  try {
    await fs.mkdir(path.join(base,'src','content','articles'),{ recursive:true });
    db.prepare('INSERT INTO ai_candidates(id,kind,status,title,description,body,category,region,sources_json,verification_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'article','draft','Fixture article','Fixture description','Fixture body '.repeat(20),'Życie w Belgii','all','[]','{"status":"verified"}',due,due);
    db.prepare('INSERT INTO ai_editorial(candidate_id,status,approved_by,approved_at,scheduled_at,updated_at) VALUES(?,?,?,?,?,?)').run(id,'scheduled','admin',due,due,due);
    const build = () => {
      const article = path.join(base,'src','content','articles',`ai-${id}.md`);
      const html = path.join(base,'_site','artykuly',`ai-${id}`,'index.html');
      if (fsSync.existsSync(article)) { fsSync.mkdirSync(path.dirname(html),{ recursive:true }); fsSync.writeFileSync(html,'<html>Fixture</html>'); }
    };
    assert.deepEqual(publishLocal(db,new Date('2026-01-02T00:00:00Z'),build,base).published,[id]);
    assert.deepEqual(publishLocal(db,new Date('2026-01-02T00:00:00Z'),build,base).published,[]);
    assert.equal(db.prepare('SELECT status,public_state FROM ai_editorial WHERE candidate_id=?').get(id).public_state,'visible');
    db.prepare("UPDATE ai_editorial SET status='archived' WHERE candidate_id=?").run(id);
    assert.deepEqual(publishLocal(db,new Date('2026-01-03T00:00:00Z'),build,base).withdrawn,[id]);
    assert.equal(fsSync.existsSync(path.join(base,'_site','artykuly',`ai-${id}`,'index.html')),false);
  } finally { db.close(); await fs.rm(base,{ recursive:true, force:true }); }
});

test('local publisher activates verified D1 events without creating article files', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(),'pbe-events-'));
  const db = openLocalDb(':memory:');
  const id = 'd'.repeat(20),due='2026-01-01T08:00:00.000Z';
  try {
    db.prepare('INSERT INTO ai_candidates(id,kind,status,title,description,body,region,sources_json,event_json,verification_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'event','draft','Fixture event','Fixture','Fixture body','brussels','[]',JSON.stringify({start:'2026-01-05T10:00:00.000Z',end:'2026-01-06T10:00:00.000Z',status:'scheduled'}),'{"status":"needs_review"}',due,due);
    db.prepare('INSERT INTO ai_editorial(candidate_id,status,approved_by,approved_at,scheduled_at,updated_at) VALUES(?,?,?,?,?,?)').run(id,'scheduled','admin',due,due,due);
    const now=new Date('2026-01-02T00:00:00Z');
    assert.deepEqual(publishLocal(db,now,() => { throw new Error('Unexpected build'); },base).published,[]);
    db.prepare('UPDATE ai_candidates SET verification_json=? WHERE id=?').run(JSON.stringify({status:'verified'}),id);
    assert.deepEqual(publishLocal(db,now,() => { throw new Error('Unexpected build'); },base).published,[id]);
    assert.equal(db.prepare('SELECT public_state FROM ai_editorial WHERE candidate_id=?').get(id).public_state,'visible');
    assert.equal(fsSync.existsSync(path.join(base,'src','content','articles',`ai-${id}.md`)),false);
    assert.deepEqual(publishLocal(db,now,() => { throw new Error('Unexpected build'); },base).published,[]);
  } finally { db.close(); await fs.rm(base,{recursive:true,force:true}); }
});

test('local publisher materializes a D1 article published by manual retry without duplicate history', async () => {
  const base=await fs.mkdtemp(path.join(os.tmpdir(),'pbe-retry-'));
  const db=openLocalDb(':memory:');
  const id='e'.repeat(20),due='2026-01-01T08:00:00.000Z';
  try {
    await fs.mkdir(path.join(base,'src','content','articles'),{recursive:true});
    db.prepare('INSERT INTO ai_candidates(id,kind,status,title,description,body,category,region,sources_json,verification_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'article','draft','Retried article','Description','Body '.repeat(30),'Życie w Belgii','all','[]','{"status":"verified"}',due,due);
    db.prepare("INSERT INTO ai_editorial(candidate_id,status,public_state,approved_by,approved_at,scheduled_at,published_at,updated_at) VALUES(?,'published','visible','admin',?,?,?,?)").run(id,due,due,due,due);
    const build=() => { const html=path.join(base,'_site','artykuly',`ai-${id}`,'index.html'); fsSync.mkdirSync(path.dirname(html),{recursive:true}); fsSync.writeFileSync(html,'<html>Retry</html>'); };
    const result=publishLocal(db,new Date('2026-01-02T00:00:00Z'),build,base);
    assert.deepEqual(result.published,[]);
    assert.deepEqual(result.materialized,[id]);
    assert.equal(db.prepare('SELECT count(*) AS n FROM ai_candidate_history WHERE candidate_id=?').get(id).n,0);
    assert.deepEqual(publishLocal(db,new Date('2026-01-02T00:00:00Z'),build,base).materialized,[]);
  } finally { db.close(); await fs.rm(base,{recursive:true,force:true}); }
});

test('RSS and Atom are parsed without treating embedded markup as instructions', () => {
  const source = { id: 's', url: 'https://example.org/rss', region: 'all', official: true };
  assert.equal(parseFeed('<rss><channel><item><title>A &amp; B</title><link>https://example.org/a</link><description><![CDATA[<b>Text</b>]]></description></item></channel></rss>', source)[0].summary, 'Text');
  assert.equal(parseFeed('<feed><entry><title>Atom</title><link href="https://example.org/b"/><summary>Summary</summary></entry></feed>', source)[0].url, 'https://example.org/b');
  assert.throws(() => parseFeed('bad', source));
});

test('URLs normalize tracking parameters and reject unsafe schemes', () => {
  assert.equal(canonicalUrl('https://EXAMPLE.org/a/?utm_source=x&b=2#part'), 'https://example.org/a?b=2');
  assert.throws(() => canonicalUrl('javascript:alert(1)'));
});

test('HTML discovery keeps same-host links as unverified candidates', () => {
  const links = parseHtmlLinks('<a href="/news/one">Important update for residents</a><a href="https://other.org/x">Outside link</a>', { id: 'office', url: 'https://example.org', region: 'all', official: true });
  assert.equal(links.length, 1);
  assert.equal(links[0].claims.length, 0);
});

test('fixture pipeline validates events, excludes weak evidence and is idempotent', () => {
  const first = processItems(fixtures, { items: [], drafts: [], runs: [] }, { now });
  assert.equal(first.report.created, 3);
  assert.equal(first.report.duplicates, 1);
  assert.equal(first.report.rejected, 3);
  const second = processItems(fixtures, first.state, { now });
  assert.equal(second.report.created, 0);
  assert.equal(second.state.drafts.length, 3);
  assert.equal(duplicateOf(fixtures[4], first.state.items)?.id, 'news-1');
  assert.equal(duplicateOf({ ...fixtures[0], id: 'another', url: 'https://example.org/another', title: 'Zmiana godzin punktu informacyjnego TEST', summary: fixtures[0].summary }, first.state.items)?.id, 'news-1');
  assert.ok(verifyItem(fixtures[3], now).issues.includes('missing_venue'));
  assert.ok(verifyItem(fixtures[5], now).issues.includes('past_or_invalid_event'));
});

test('dry run has no state mutations', () => {
  const state = { items: [], drafts: [], runs: [] };
  const result = processItems(fixtures, state, { now, dryRun: true });
  assert.deepEqual(result.state, state);
  assert.equal(result.report.created, 3);
});

test('AI provider enforces budgets and handles API errors without secrets in messages', async () => {
  assert.equal(estimateCost({ inputTokens: 1000, outputTokens: 500 }, { inputPerMillion: 1, outputPerMillion: 2 }), 0.002);
  await assert.rejects(generateWithProvider({ prompt: 'x', apiKey: 'secret', endpoint: 'https://example.org/api', model: 'test' }), /explicit opt-in/);
  await assert.rejects(generateWithProvider({ prompt: 'x', allowPaid: true, apiKey: 'secret', endpoint: 'https://example.org/api', model: 'test', budget: { dayUsd: 0, monthUsd: 1 }, fetcher: async () => { throw new Error('should not call'); } }), BudgetExceeded);
  await assert.rejects(generateWithProvider({ prompt: 'x', allowPaid: true, apiKey: 'secret', endpoint: 'https://example.org/api', model: 'test', retries: 0, fetcher: async () => ({ ok: false, status: 429 }) }), /AI HTTP 429/);
  const output = await generateWithProvider({ prompt: 'x', allowPaid: true, apiKey: 'secret', endpoint: 'https://example.org/api', model: 'test', fetcher: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'draft' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }) }) });
  assert.equal(output.text, 'draft');
});

test('D1-compatible migration and local sync are idempotent', () => {
  const state = processItems(fixtures, { items: [], drafts: [], runs: [], sources: [] }, { now }).state;
  const db = openLocalDb(':memory:');
  syncLocalState(db, state);
  syncLocalState(db, state);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ai_candidates').get().n, 3);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ai_items').get().n, 6);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ai_runs').get().n, 1);
  const restored = loadLocalState(db);
  assert.equal(restored.items.length, 6);
  assert.equal(restored.drafts.length, 3);
  assert.equal(restored.runs.length, 1);
  db.close();
});

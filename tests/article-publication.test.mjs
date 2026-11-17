import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { writeContent, readContent, changeArticlePublication } from '../cloudflare/content-store.mjs';
import { publishDue } from '../cloudflare/publication.mjs';
import { publicEntries } from '../cloudflare/public-pages.mjs';

globalThis.crypto ??= webcrypto;
function db(){
  const sqlite=new DatabaseSync(':memory:');
  for(const file of ['agent/migrations/001_agent.sql','agent/migrations/002_editorial.sql','agent/migrations/003_content.sql','agent/migrations/006_article_fields.sql','agent/migrations/007_article_publication.sql'])sqlite.exec(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'));
  const prepare=(sql,values=[])=>({
    bind(...params){return prepare(sql,params);},
    async first(){return sqlite.prepare(sql).get(...values)||null;},
    async all(){return {results:sqlite.prepare(sql).all(...values)};},
    async run(){return {meta:{changes:sqlite.prepare(sql).run(...values).changes}};}
  });
  return {sqlite,prepare,async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
}
const user={id:'admin',name:'Administrator',role:'admin'};
const path='src/content/articles/test-publikacji.md';
const text='---\ntitle: Test publikacji\ndate: 2026-01-01T00:00:00.000Z\ncategory: Inne\ndescription: Opis\n---\nTreść oryginalna.\n';
const encode=value=>Buffer.from(value).toString('base64');

test('manual article publishes now, withdraws and preserves content bytes',async()=>{
  const DB=db();
  const initial=await writeContent(DB,path,encode(text),null,user,'draft');
  assert.equal((await publicEntries(DB,'article')).length,0);
  await changeArticlePublication(DB,path,initial.content.sha,'publish-now',null,user);
  assert.equal((await publicEntries(DB,'article')).length,1);
  assert.equal((await readContent(DB,path)).content,encode(text));
  await changeArticlePublication(DB,path,initial.content.sha,'withdraw',null,user);
  assert.equal((await publicEntries(DB,'article')).length,0);
  assert.equal((await readContent(DB,path)).content,encode(text));
});

test('scheduled manual article is published only when due, once, and can be rescheduled',async()=>{
  const DB=db();
  const initial=await writeContent(DB,path,encode(text),null,user,'draft');
  const first=new Date(Date.now()+120000).toISOString();
  const later=new Date(Date.now()+240000).toISOString();
  await changeArticlePublication(DB,path,initial.content.sha,'schedule',first,user);
  assert.equal((await readContent(DB,path)).status,'scheduled');
  await changeArticlePublication(DB,path,initial.content.sha,'schedule',later,user);
  assert.deepEqual((await publishDue(DB,new Date(Date.now()+180000))).manualPublished,[]);
  assert.deepEqual((await publishDue(DB,new Date(Date.now()+300000))).manualPublished,[path]);
  assert.deepEqual((await publishDue(DB,new Date(Date.now()+300000))).manualPublished,[]);
  assert.equal((await publicEntries(DB,'article')).length,1);
  assert.equal((await readContent(DB,path)).content,encode(text));
});

test('cancelling schedule restores draft and editors cannot publish',async()=>{
  const DB=db();
  const initial=await writeContent(DB,path,encode(text),null,user,'draft');
  await changeArticlePublication(DB,path,initial.content.sha,'schedule',new Date(Date.now()+120000).toISOString(),user);
  await changeArticlePublication(DB,path,initial.content.sha,'unschedule',null,user);
  assert.equal((await readContent(DB,path)).status,'draft');
  assert.deepEqual((await publishDue(DB,new Date(Date.now()+300000))).manualPublished,[]);
  await assert.rejects(changeArticlePublication(DB,path,initial.content.sha,'publish-now',null,{...user,role:'editor'}));
});

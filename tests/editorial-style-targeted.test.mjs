import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto } from 'node:crypto';
import { writeContent } from '../cloudflare/content-store.mjs';
import { editorialStyleContext, updateEditorialStyle, editorialStyleStatus, EDITORIAL_RULES, copiesStyleExample } from '../cloudflare/editorial-style.mjs';
import { sha256 } from '../cloudflare/common.mjs';

globalThis.crypto ??= webcrypto;
function database() {
  const sqlite=new DatabaseSync(':memory:');
  for(const file of ['agent/migrations/001_agent.sql','agent/migrations/002_editorial.sql','agent/migrations/003_content.sql','agent/migrations/006_article_fields.sql','agent/migrations/007_article_publication.sql'])sqlite.exec(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'));
  const prepare=(sql,values=[])=>({bind(...params){return prepare(sql,params);},async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){const result=sqlite.prepare(sql).run(...values);return {meta:{changes:result.changes}};}});
  return {sqlite,prepare,async batch(statements){sqlite.exec('BEGIN');try{for(const statement of statements)await statement.run();sqlite.exec('COMMIT');}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
}
const body=n=>`Wstęp do artykułu ${n} pokazuje czytelnikowi konkretną sytuację i wyjaśnia, co warto zrobić przed przyjazdem do Belgii.\n\n## Co sprawdzić najpierw\n\nPraktyczny przykład ${n} opisuje kolejne kroki prostym językiem, bez urzędowego żargonu.`;
const markdown=n=>Buffer.from(`---\ntitle: "Artykuł redakcyjny ${n}"\ndate: "2026-11-20T10:00:00.000Z"\ncategory: "Życie w Belgii"\ndescription: "Praktyczny poradnik"\ncontentType: "article"\n---\n${body(n)}\n`).toString('base64');

test('style profile uses only four public articles and refreshes on publication changes',async()=>{
  const DB=database(),user={id:'admin',name:'Admin',role:'admin'};
  for(let n=1;n<=3;n++)await writeContent(DB,`src/content/articles/redakcyjny-${n}.md`,markdown(n),null,user,'published');
  const published='a'.repeat(20),pending='b'.repeat(20),at='2026-11-20T11:00:00.000Z';
  for(const [id,title] of [[published,'Artykuł AI opublikowany'],[pending,'Sekretny szkic AI']]){
    DB.sqlite.prepare("INSERT INTO ai_candidates(id,kind,status,title,description,body,category,region,sources_json,verification_json,created_at,updated_at,article_fields_json) VALUES(?,'article','draft',?,?,?,'Praca','all','[]','{}',?,?,'{}')").run(id,title,'Opis',body(title),at,at);
    DB.sqlite.prepare("INSERT INTO ai_editorial(candidate_id,status,owner_kind,owner_id,approved_by,approved_at,published_at,public_state,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run(id,id===published?'published':'pending_review','agent','agent',id===published?'admin':null,id===published?at:null,id===published?at:null,id===published?'visible':'hidden',at);
  }
  let calls=0,prompt='';
  const fetcher=async(_url,options)=>{calls++;prompt=JSON.parse(options.body).contents[0].parts[0].text;return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({profile:'Pisz po polsku, ciepło i konkretnie. Zacznij od sytuacji czytelnika, stosuj krótkie akapity, rzeczowe śródtytuły i jeden praktyczny przykład. Unikaj urzędowego tonu.'})}]}}]});};
  const env={DB,GEMINI_API_KEY:'test-only',GEMINI_FREE_TIER_CONFIRMED:'1'};
  const first=await editorialStyleContext(env,{topic:'praca w Belgii',fetcher});
  assert.equal(first.count,4);assert.equal(calls,1);
  assert.match(prompt,/Artykuł AI opublikowany/);assert.doesNotMatch(prompt,/Sekretny szkic AI/);
  assert.match(first.guidance,/Profil wyuczony/);
  assert.match(first.guidance,/Zasady redakcyjne/);
  assert.match(EDITORIAL_RULES,/Linki CMS/);
  await editorialStyleContext(env,{topic:'mieszkanie w Belgii',fetcher});assert.equal(calls,1);
  const path='src/content/articles/redakcyjny-1.md',current=DB.sqlite.prepare('SELECT sha FROM cms_content WHERE path=?').get(path);
  await writeContent(DB,path,markdown('1 po aktualizacji'),current.sha,user,'published');
  await editorialStyleContext(env,{topic:'życie w Belgii',fetcher});assert.equal(calls,2);
  DB.sqlite.prepare("UPDATE ai_editorial SET status='published',public_state='visible',approved_by='admin',approved_at=?,published_at=? WHERE candidate_id=?").run(at,at,pending);
  const after=await editorialStyleContext(env,{topic:'praca w Belgii',fetcher});assert.equal(calls,3);assert.equal(after.count,5);
  assert.match(prompt,/Sekretny szkic AI/);
  const unchanged=await updateEditorialStyle(env,{fetcher});assert.equal(unchanged.changed,false);assert.equal(calls,3);
  const before=await editorialStyleStatus(DB);assert.equal(before.history.length,3);
  DB.sqlite.prepare("UPDATE ai_editorial SET status='archived',public_state='hidden' WHERE candidate_id=?").run(pending);
  const withdrawn=await updateEditorialStyle(env,{fetcher});assert.equal(withdrawn.count,4);assert.equal(withdrawn.removed,1);assert.equal(calls,4);
  assert.equal(withdrawn.history.length,4);
  assert.equal(JSON.parse(DB.sqlite.prepare("SELECT value_json FROM ai_config WHERE key LIKE 'editorial_style_revision:%' ORDER BY updated_at DESC LIMIT 1").get().value_json).previousProfile.length>0,true);
  assert.equal(copiesStyleExample(first.examples[0]?.lead || '',first.examples),true);
  assert.equal(copiesStyleExample('Całkowicie nowa, krótka wypowiedź.',first.examples),false);
});

test('existing profile is retained without another Gemini call when publications are unchanged',async()=>{
  const DB=database(),path='src/content/articles/wzorzec.md';
  await writeContent(DB,path,markdown('wzorzec'),null,{id:'admin',name:'Admin',role:'admin'},'published');
  const sha=DB.sqlite.prepare('SELECT sha FROM cms_content WHERE path=?').get(path).sha;
  const fingerprint=await sha256(JSON.stringify([['cms',path,sha]]));
  const profile='Redakcja pisze jasno i praktycznie, zaczyna od potrzeb czytelnika, wyjaśnia najważniejsze pojęcia i prowadzi przez kolejne kroki bez zbędnego żargonu.';
  DB.sqlite.prepare("INSERT INTO ai_config(key,value_json,updated_at) VALUES('editorial_style_v1',?,?)").run(JSON.stringify({fingerprint,profile,samples:[],count:1}),'2026-11-21T12:00:00.000Z');
  const result=await updateEditorialStyle({DB,GEMINI_API_KEY:'test-only',GEMINI_FREE_TIER_CONFIRMED:'1'},{fetcher:()=>{throw Error('Gemini should not be called');}});
  assert.equal(result.count,1);assert.equal(result.analysed,1);
  assert.equal(JSON.parse(DB.sqlite.prepare("SELECT value_json FROM ai_config WHERE key='editorial_style_v2'").get().value_json).profile,profile);
});

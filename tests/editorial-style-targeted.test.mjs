import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto } from 'node:crypto';
import { writeContent } from '../cloudflare/content-store.mjs';
import { editorialStyleContext, copiesStyleExample } from '../cloudflare/editorial-style.mjs';

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
  assert.match(first.guidance,/Profil stylu redakcji/);
  await editorialStyleContext(env,{topic:'mieszkanie w Belgii',fetcher});assert.equal(calls,1);
  const path='src/content/articles/redakcyjny-1.md',current=DB.sqlite.prepare('SELECT sha FROM cms_content WHERE path=?').get(path);
  await writeContent(DB,path,markdown('1 po aktualizacji'),current.sha,user,'published');
  await editorialStyleContext(env,{topic:'życie w Belgii',fetcher});assert.equal(calls,2);
  DB.sqlite.prepare("UPDATE ai_editorial SET status='published',public_state='visible',approved_by='admin',approved_at=?,published_at=? WHERE candidate_id=?").run(at,at,pending);
  const after=await editorialStyleContext(env,{topic:'praca w Belgii',fetcher});assert.equal(calls,3);assert.equal(after.count,5);
  assert.match(prompt,/Sekretny szkic AI/);
  assert.equal(copiesStyleExample(first.examples[0]?.lead || '',first.examples),true);
  assert.equal(copiesStyleExample('Całkowicie nowa, krótka wypowiedź.',first.examples),false);
});

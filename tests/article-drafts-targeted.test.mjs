import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomBytes, webcrypto } from 'node:crypto';
import { sha256 } from '../cloudflare/common.mjs';
import { writeContent, readContent, savePublishedArticleDraft, publishArticleDraft } from '../cloudflare/content-store.mjs';
import { publicEntry } from '../cloudflare/public-pages.mjs';
import { onRequest as aiEditor } from '../cloudflare/ai-editor.mjs';

globalThis.crypto ??= webcrypto;
function database() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of ['deploy/cloudflare-d1.sql','deploy/cloudflare-d1-0002.sql','agent/migrations/001_agent.sql','agent/migrations/002_editorial.sql','agent/migrations/003_content.sql','agent/migrations/006_article_fields.sql','agent/migrations/007_article_publication.sql']) sqlite.exec(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'));
  const prepare=(sql,values=[])=>({ bind(...params){return prepare(sql,params);},async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){const result=sqlite.prepare(sql).run(...values);return {meta:{changes:result.changes}};} });
  return {sqlite,prepare,async batch(statements){sqlite.exec('BEGIN');try{for(const statement of statements)await statement.run();sqlite.exec('COMMIT');}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
}
const markdown=(title,body)=>Buffer.from(`---\ntitle: "${title}"\ndate: "2026-11-01T10:00:00.000Z"\ncategory: "Praca"\ndescription: "Opis"\nimage_pl: "/images/uploads/pl.png"\nimage_nl: "/images/uploads/nl.png"\ntags_pl: "praca"\ntags_nl: "werk"\n---\n${body}\n`).toString('base64');

test('manual published article stays public until revised draft is published',async()=>{
  const db=database(),user={id:'admin',name:'Administrator',role:'admin'},path='src/content/articles/draft-check.md';
  const original=await writeContent(db,path,markdown('Stara wersja','Stara treść'),null,user,'published');
  const before=await readContent(db,path);
  const publishedAt=before.published_at;
  await savePublishedArticleDraft(db,path,markdown('Nowa wersja','Nowa treść'),original.content.sha,user);
  assert.equal((await publicEntry(db,'draft-check')).title,'Stara wersja');
  assert.equal((await readContent(db,path,true)).draft?.content,markdown('Nowa wersja','Nowa treść'));
  await publishArticleDraft(db,path,original.content.sha,user);
  assert.equal((await publicEntry(db,'draft-check')).title,'Nowa wersja');
  assert.equal((await publicEntry(db,'draft-check')).image_nl,'/images/uploads/nl.png');
  assert.equal((await readContent(db,path)).published_at,publishedAt);
  assert.equal((await readContent(db,path,true)).draft,null);
  assert.deepEqual(db.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('AI published article keeps its public version while editing',async()=>{
  const DB=database(),id='a'.repeat(20),at='2026-11-01T10:00:00.000Z',token=randomBytes(32).toString('base64url');
  DB.sqlite.prepare("INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES('admin','admin@example.invalid','Admin','unused','admin',1,0)").run();
  DB.sqlite.prepare('INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await sha256(token),'admin','2099-01-01T00:00:00.000Z');
  DB.sqlite.prepare("INSERT INTO ai_candidates(id,kind,status,title,description,body,category,region,sources_json,verification_json,created_at,updated_at,article_fields_json) VALUES(?,'article','published',?,?,?,?,?,'[]','{}',?,?,?)").run(id,'Stara wersja AI','Opis','Stara treść '.repeat(15),'Praca','all',at,at,JSON.stringify({title_nl:'Oude versie',tags_pl:'praca'}));
  DB.sqlite.prepare("INSERT INTO ai_editorial(candidate_id,status,owner_kind,owner_id,approved_by,approved_at,published_at,public_state,updated_at) VALUES(?,'published','agent','agent','admin',?,?,'visible',?)").run(id,at,at,at);
  const call=async body=>aiEditor({env:{DB},request:new Request('http://localhost/api/ai-editor',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost',Cookie:`__Host-pbe_session=${token}`},body:JSON.stringify(body)})});
  const edited=await call({action:'edit',id,title:'Nowa wersja AI',description:'Opis',body:'Nowa treść '.repeat(15),category:'Praca',region:'all',sources:[],articleFields:{title_nl:'Nieuwe versie',tags_pl:'nowe'}});
  assert.equal(edited.status,200,JSON.stringify(await edited.json()));
  assert.equal((await publicEntry(DB,`ai-${id}`)).title,'Stara wersja AI');
  const queued=await aiEditor({env:{DB},request:new Request('http://localhost/api/ai-editor',{headers:{Cookie:`__Host-pbe_session=${token}`}})});
  assert.equal(queued.status,200);
  assert.equal(JSON.parse((await queued.json()).candidates.find(row=>row.id===id).editorial_draft.content).title,'Nowa wersja AI');
  assert.equal(DB.sqlite.prepare('SELECT status,public_state,published_at FROM ai_editorial WHERE candidate_id=?').get(id).published_at,at);
  const published=await call({action:'publish-draft',id});
  assert.equal(published.status,200,JSON.stringify(await published.json()));
  assert.equal((await publicEntry(DB,`ai-${id}`)).title,'Nowa wersja AI');
  assert.equal((await publicEntry(DB,`ai-${id}`)).title_nl,'Nieuwe versie');
  assert.equal(DB.sqlite.prepare('SELECT published_at FROM ai_editorial WHERE candidate_id=?').get(id).published_at,at);
  assert.deepEqual(DB.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
});

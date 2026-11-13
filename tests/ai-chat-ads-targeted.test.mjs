import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { webcrypto, randomUUID, randomBytes } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import domain from '../server/ads-domain.js';
import { handleAds } from '../cloudflare/ads.mjs';
import { translateAd } from '../cloudflare/ad-translation.mjs';
import { processChatJobs } from '../cloudflare/ai-chat-worker.mjs';
import { onRequest as aiChatRoute } from '../cloudflare/ai-chat.mjs';
import { sha256 } from '../cloudflare/common.mjs';
import { publicEntry } from '../cloudflare/public-pages.mjs';

globalThis.crypto ??= webcrypto;
function database() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of ['deploy/cloudflare-d1.sql','deploy/cloudflare-d1-0002.sql','agent/migrations/001_agent.sql','agent/migrations/002_editorial.sql','agent/migrations/003_content.sql','agent/migrations/004_discovery.sql','agent/migrations/005_chat.sql']) sqlite.exec(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'));
  const prepare = (sql,params=[])=>({bind(...next){return prepare(sql,next);},async first(){return sqlite.prepare(sql).get(...params) || null;},async all(){return {results:sqlite.prepare(sql).all(...params)};},async run(){const result=sqlite.prepare(sql).run(...params);return {meta:{changes:result.changes}};}});
  return {sqlite,prepare,async batch(statements){sqlite.exec('BEGIN');try{const values=[];for(const statement of statements)values.push(await statement.run());sqlite.exec('COMMIT');return values;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
}
const day = offset => new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
function pngData(width,height,color){
  const crc=bytes=>{let value=0xffffffff;for(const byte of bytes){value^=byte;for(let bit=0;bit<8;bit++)value=value&1?0xedb88320^(value>>>1):value>>>1;}return (value^0xffffffff)>>>0;};
  const chunk=(name,data)=>{const title=Buffer.from(name),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([title,data])));return Buffer.concat([size,title,data,sum]);};
  const head=Buffer.alloc(13);head.writeUInt32BE(width);head.writeUInt32BE(height,4);head[8]=8;head[9]=6;
  const row=Buffer.alloc(1+width*4);for(let x=0;x<width;x++){row[1+x*4]=color;row[2+x*4]=20;row[3+x*4]=50;row[4+x*4]=255;}
  const bytes=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',head),chunk('IDAT',deflateSync(Buffer.concat(Array.from({length:height},()=>row)))),chunk('IEND',Buffer.alloc(0))]);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

test('server enforces package Unicode limits and accepts graphic-free PREMIUM',async()=>{
  for (const [type,title,description] of [['PREMIUM',70,200],['TOP',60,160],['STANDARD',70,500]]) {
    const creative=domain.creative({kind:type==='STANDARD'?'text':'image',type,title:'ą'.repeat(title),description:'é'.repeat(description),contact:'kontakt@example.com',email:'buyer@example.com',customerName:'Buyer'});
    assert.equal(creative.title.length,title);
    if(type!=='STANDARD')assert.equal(creative.image,'');
    assert.throws(()=>domain.creative({kind:'image',type,title:'ą'.repeat(title+1),description:'ok',email:'buyer@example.com',customerName:'Buyer'}),{code:'validation'});
  }
  const DB=database(),settings=domain.defaults();settings.markets.pl.enabled=true;settings.markets.pl.prices.PREMIUM=2500;
  DB.sqlite.prepare('INSERT INTO ads_settings(id,data,version) VALUES(1,?,1)').run(JSON.stringify(settings));
  const body={requestId:randomUUID(),type:'PREMIUM',kind:'image',primaryLanguage:'pl',dates:[day(2)],variants:[{language:'pl',title:'Przewozy',description:'Wyjazdy w weekend'}],email:'buyer@example.com',customerName:'Buyer',image:'',imageMobile:'',consent:true,termsAccepted:true,termsVersion:'draft-2026-11-11',earlyServiceRequest:false,expectedTotalPrice:2500};
  const request=new Request('http://localhost/api/ads?action=order-batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await handleAds({request,env:{DB}});assert.equal(result.status,201);
  const saved=JSON.parse(DB.sqlite.prepare('SELECT data FROM ad_orders').get().data);
  assert.equal(saved.image,'');assert.equal(saved.status,'pending');assert.equal(saved.paymentStatus,'unpaid');
});

test('translation accepts all source directions and rejects oversized output',async()=>{
  const DB=database(),env={DB,GEMINI_API_KEY:'test-key',GEMINI_FREE_TIER_CONFIRMED:'1'};
  for(const sourceLanguage of ['pl','nl','fr','en']) {
    const targets=['pl','nl','fr','en'].filter(language=>language!==sourceLanguage);
    const body={sourceLanguage,targets,type:'TOP',title:'Tytuł',description:'Krótki opis'};
    const fetcher=async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify({variants:targets.map(language=>({language,title:'Title',description:'Description'}))})}]}}]});
    const response=await translateAd(new Request('http://localhost/api/ads?action=translate'),env,body,fetcher);
    assert.equal(response.status,200);assert.deepEqual((await response.json()).variants.map(variant=>variant.language),targets);
  }
  const bad=await translateAd(new Request('http://localhost/api/ads?action=translate'),{...env,DB:database()},{sourceLanguage:'en',targets:['fr'],type:'TOP',title:'Title',description:'Description'},async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify({variants:[{language:'fr',title:'X'.repeat(61),description:'Ok'}]})}]}}]})).catch(error=>error);
  assert.equal(bad.code,'translationInvalid');
  let calls=0;
  const shortened=await translateAd(new Request('http://localhost/api/ads?action=translate'),{...env,DB:database()},{sourceLanguage:'en',targets:['fr'],type:'TOP',title:'Title',description:'Description'},async()=>{calls++;return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({variants:[{language:'fr',title:calls===1?'X'.repeat(61):'Titre court',description:'Description'}]})}]}}]});});
  assert.equal(calls,2);assert.equal(shortened.status,200);
});

test('one multilingual purchase stores distinct artwork for each language in the same group',async()=>{
  const DB=database(),settings=domain.defaults();for(const language of ['pl','nl']){settings.markets[language].enabled=true;settings.markets[language].prices.PREMIUM=2500;}
  DB.sqlite.prepare('INSERT INTO ads_settings(id,data,version) VALUES(1,?,1)').run(JSON.stringify(settings));
  const base=pngData(1200,200,10),mobile=pngData(660,300,10),dutch=pngData(1200,200,90),dutchMobile=pngData(660,300,90);
  const body={requestId:randomUUID(),type:'PREMIUM',kind:'image',primaryLanguage:'pl',dates:[day(4)],variants:[{language:'pl',title:'Polski tytuł',description:'Polski opis'},{language:'nl',title:'Nederlandse titel',description:'Nederlandse beschrijving',image:dutch,imageMobile:dutchMobile}],email:'buyer@example.com',customerName:'Buyer',image:base,imageMobile:mobile,consent:true,termsAccepted:true,termsVersion:'draft-2026-11-11',earlyServiceRequest:false,expectedTotalPrice:3750};
  const response=await handleAds({request:new Request('http://localhost/api/ads?action=order-batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),env:{DB}});
  assert.equal(response.status,201);
  const rows=DB.sqlite.prepare('SELECT data FROM ad_orders').all().map(row=>JSON.parse(row.data));
  assert.equal(rows.length,2);assert.equal(new Set(rows.map(row=>row.groupId)).size,1);
  assert.equal(rows.find(row=>row.language==='pl').image,base);
  assert.equal(rows.find(row=>row.language==='nl').image,dutch);
  assert.equal(rows.find(row=>row.language==='nl').imageMobile,dutchMobile);
  assert.equal(rows.reduce((sum,row)=>sum+row.totalPrice,0),3750);
});

test('durable article job reaches pending_review once and stays nonpublic',async()=>{
  const DB=database(),jobId=randomUUID(),conversationId=randomUUID(),url='https://www.gov.pl/web/belgia/test',at=new Date().toISOString();
  DB.sqlite.prepare("INSERT INTO ai_chat_jobs(id,conversation_id,actor_id,prompt,status,created_at,updated_at) VALUES(?,?,?,?,'queued',?,?)").run(jobId,conversationId,'editor',`Napisz artykuł na podstawie ${url}`,at,at);
  const quote='Oficjalna informacja o procedurze dla obywateli polskich.';
  const output={title:'Procedura dla Polaków w Belgii',description:'Praktyczny opis procedury dla obywateli polskich w Belgii.',body:`${'Opis procedury potwierdzony oficjalnym źródłem. '.repeat(22)}\n\nŹródło: ${url}`,evidenceQuotes:[{url,quote}]};
  const fetcher=async endpoint=>endpoint===url?new Response(`<html><body>${quote.repeat(10)}</body></html>`,{headers:{'content-type':'text/html'}}):Response.json({candidates:[{content:{parts:[{text:JSON.stringify(output)}]}}]});
  const env={DB,GEMINI_API_KEY:'test-key',GEMINI_FREE_TIER_CONFIRMED:'1'};
  const first=await processChatJobs(env,{fetcher});assert.equal(first.status,'done');
  assert.equal((await processChatJobs(env,{fetcher})).status,'empty');
  const row=DB.sqlite.prepare('SELECT status,candidate_id FROM ai_chat_jobs WHERE id=?').get(jobId);
  assert.equal(row.status,'done');assert.equal(DB.sqlite.prepare('SELECT status FROM ai_editorial WHERE candidate_id=?').get(row.candidate_id).status,'pending_review');
  assert.equal(await publicEntry(DB,`ai-${row.candidate_id}`),null);
});

test('article job can discover and verify an official source without a supplied URL',async()=>{
  const DB=database(),jobId=randomUUID(),conversationId=randomUUID(),url='https://www.gov.pl/web/belgium/passport-for-an-adult',at=new Date().toISOString();
  DB.sqlite.prepare("INSERT INTO ai_chat_jobs(id,conversation_id,actor_id,prompt,status,created_at,updated_at) VALUES(?,?,?,?,'queued',?,?)").run(jobId,conversationId,'editor','Napisz artykuł o paszporcie dla dorosłych w Belgii',at,at);
  const quote='Wniosek o wydanie paszportu możesz złożyć w urzędzie konsularnym.';
  const output={title:'Paszport dla dorosłych w Belgii',description:'Informacje urzędowe dla osób składających wniosek o paszport.',body:`${'Wniosek składa się w urzędzie konsularnym. '.repeat(25)}\n\nŹródło: ${url}`,evidenceQuotes:[{url,quote}]};
  let calls=0;
  const fetcher=async(endpoint,options)=>{
    if(endpoint===url)return new Response(`<main>${quote.repeat(10)}</main>`,{headers:{'content-type':'text/html'}});
    calls++;
    const discovery=JSON.parse(options.body).generationConfig.maxOutputTokens===500;
    return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(discovery?{urls:[url]}:output)}]}}]});
  };
  const result=await processChatJobs({DB,GEMINI_API_KEY:'test-key',GEMINI_FREE_TIER_CONFIRMED:'1'},{fetcher});
  assert.equal(result.status,'done');assert.equal(calls,2);
  assert.equal(DB.sqlite.prepare('SELECT status FROM ai_editorial WHERE candidate_id=?').get(result.candidateId).status,'pending_review');
  assert.equal(await publicEntry(DB,`ai-${result.candidateId}`),null);
});

test('authenticated CMS chat stores both messages and rejects unauthenticated access',async()=>{
  const DB=database(),token=randomBytes(32).toString('base64url'),userId=randomUUID();
  DB.sqlite.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(userId,'editor@example.com','Editor','unused','admin');
  DB.sqlite.prepare('INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await sha256(token),userId,'2099-01-01');
  const env={DB,GEMINI_API_KEY:'test-key',GEMINI_FREE_TIER_CONFIRMED:'1'};
  const anonymous=await aiChatRoute({request:new Request('https://polacywbelgii.pages.dev/api/ai-chat'),env});
  assert.equal(anonymous.status,401);
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({candidates:[{content:{parts:[{text:'Trzy propozycje tematów do opracowania.'}]}}]});
  try{
    const request=new Request('https://polacywbelgii.pages.dev/api/ai-chat',{method:'POST',headers:{Origin:'https://polacywbelgii.pages.dev','Content-Type':'application/json',Cookie:`__Host-pbe_session=${token}`},body:JSON.stringify({action:'send',mode:'chat',text:'Jakie tematy warto omówić?'})});
    const response=await aiChatRoute({request,env});assert.equal(response.status,200);
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM ai_chat_entries').get().n,2);
    for(let n=0;n<2;n++)DB.sqlite.prepare("INSERT INTO ai_chat_jobs(id,conversation_id,actor_id,prompt,status,created_at,updated_at) VALUES(?,?,?,?,'queued',?,?)").run(randomUUID(),randomUUID(),userId,'article','2026-11-12','2026-11-12');
    const blocked=await aiChatRoute({request:new Request('https://polacywbelgii.pages.dev/api/ai-chat',{method:'POST',headers:{Origin:'https://polacywbelgii.pages.dev','Content-Type':'application/json',Cookie:`__Host-pbe_session=${token}`},body:JSON.stringify({action:'send',mode:'article',text:'Prepare an article with an official source.'})}),env});
    assert.equal(blocked.status,409);assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM ai_chat_jobs').get().n,2);
  }finally{globalThis.fetch=originalFetch;}
});

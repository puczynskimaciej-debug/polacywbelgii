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
import { queueMorning } from '../cloudflare/ai-morning.mjs';
import { onRequest as aiChatRoute } from '../cloudflare/ai-chat.mjs';
import { onRequest as aiEditorRoute } from '../cloudflare/ai-editor.mjs';
import { sha256 } from '../cloudflare/common.mjs';
import { publicEntry, publicEntries } from '../cloudflare/public-pages.mjs';

globalThis.crypto ??= webcrypto;
function database() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of ['deploy/cloudflare-d1.sql','deploy/cloudflare-d1-0002.sql','agent/migrations/001_agent.sql','agent/migrations/002_editorial.sql','agent/migrations/003_content.sql','agent/migrations/004_discovery.sql','agent/migrations/005_chat.sql','agent/migrations/006_article_fields.sql','agent/migrations/007_article_publication.sql','agent/migrations/008_ai_conversations.sql','deploy/cloudflare-d1-0004-retention.sql']) sqlite.exec(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'));
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
  const output={title:'Procedura dla Polaków w Belgii',description:'Praktyczny opis procedury dla obywateli polskich w Belgii.',body:`${'Opis procedury potwierdzony oficjalnym źródłem. '.repeat(22)} [0:0]\n\nŹródło: [${url}]`,evidenceQuoteIds:['0:0']};
  const modelUrls=[];
  const fetcher=async endpoint=>{
    if(endpoint===url)return new Response(`<html><body>${quote.repeat(10)}</body></html>`,{headers:{'content-type':'text/html'}});
    modelUrls.push(endpoint);
    if(modelUrls.length===1)return new Response(null,{status:503});
    return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(output)}]}}]});
  };
  const env={DB,GEMINI_API_KEY:'test-key',GEMINI_FREE_TIER_CONFIRMED:'1'};
  const first=await processChatJobs(env,{fetcher});assert.equal(first.status,'done');
  assert.match(modelUrls[1],/gemini-3\.1-flash-lite/);
  assert.equal((await processChatJobs(env,{fetcher})).status,'empty');
  const row=DB.sqlite.prepare('SELECT status,candidate_id FROM ai_chat_jobs WHERE id=?').get(jobId);
  assert.equal(row.status,'done');assert.equal(DB.sqlite.prepare('SELECT status FROM ai_editorial WHERE candidate_id=?').get(row.candidate_id).status,'pending_review');
  assert.equal(JSON.parse(DB.sqlite.prepare('SELECT verification_json FROM ai_candidates WHERE id=?').get(row.candidate_id).verification_json).evidenceQuotes[0].quote,quote);
  const body=DB.sqlite.prepare('SELECT body FROM ai_candidates WHERE id=?').get(row.candidate_id).body;
  assert.ok(!body.includes(`[źródło](${url})`));assert.ok(!body.includes('[0:0]'));
  assert.equal(await publicEntry(DB,`ai-${row.candidate_id}`),null);
});

test('article job searches news and verifies a non-official source without a supplied URL',async()=>{
  const DB=database(),jobId=randomUUID(),conversationId=randomUUID(),url='https://example.be/praca-w-belgii',at=new Date().toISOString();
  DB.sqlite.prepare("INSERT INTO ai_chat_jobs(id,conversation_id,actor_id,prompt,status,created_at,updated_at) VALUES(?,?,?,?,'queued',?,?)").run(jobId,conversationId,'editor','Napisz artykuł o paszporcie dla dorosłych w Belgii',at,at);
  const quote='Wniosek o wydanie paszportu możesz złożyć w urzędzie konsularnym.';
  const output={title:'Paszport dla dorosłych w Belgii',description:'Praktyczne informacje dla osób składających wniosek o paszport.',body:`${'Wniosek składa się w urzędzie konsularnym. '.repeat(15)}`,evidenceQuotes:[{url,quote}]};
  let calls=0;
  const fetcher=async(endpoint,options)=>{
    if(endpoint===url)return new Response(`<article>${quote.repeat(10)}</article>`,{headers:{'content-type':'text/html'}});
    if(String(endpoint).startsWith('https://api.gdeltproject.org/'))return Response.json({articles:[{url,title:'Paszport dla dorosłych w Belgii',seendate:'20261119T070000Z'}]});
    calls++;
    const discovery=JSON.parse(options.body).generationConfig.maxOutputTokens===180;
    return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(discovery?{queries:['Belgium passport application']}:output)}]}}]});
  };
  const result=await processChatJobs({DB,GEMINI_API_KEY:'test-key',GEMINI_FREE_TIER_CONFIRMED:'1'},{fetcher});
  assert.equal(result.status,'done');assert.equal(calls,2);
  assert.equal(DB.sqlite.prepare('SELECT status FROM ai_editorial WHERE candidate_id=?').get(result.candidateId).status,'pending_review');
  assert.equal(await publicEntry(DB,`ai-${result.candidateId}`),null);
});

test('Polish population request without links uses official statistics and distinguishes tourist arrivals',async()=>{
  const DB=database(),jobId=randomUUID(),conversationId=randomUUID(),at=new Date().toISOString();
  const populationUrl='https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/migr_pop1ctz?geo=BE&citizen=PL&age=TOTAL&sex=T&unit=NR&freq=A&lang=EN';
  const arrivalsUrl='https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tour_occ_arnraw?geo=BE&c_resid=PL&nace_r2=I551-I553&unit=NR&freq=A&lang=EN';
  const definitionsUrl='https://statbel.fgov.be/en/themes/enterprises/tourist-accommodations';
  DB.sqlite.prepare("INSERT INTO ai_chat_jobs(id,conversation_id,actor_id,prompt,status,created_at,updated_at) VALUES(?,?,?,?,'queued',?,?)").run(jobId,conversationId,'editor','Ilu Polaków mieszka w Belgii i ilu rocznie jeździ tam turystycznie?',at,at);
  const dimensions=entries=>Object.fromEntries(Object.entries(entries).map(([key,value])=>[key,{category:{index:{[value]:0}}}]));
  const population={label:'Population on 1 January by age group, sex and citizenship',id:['freq','citizen','age','unit','sex','geo','time'],size:[1,1,1,1,1,1,1],dimension:{...dimensions({freq:'A',citizen:'PL',age:'TOTAL',unit:'NR',sex:'T',geo:'BE'}),time:{category:{index:{2025:0}}}},value:{0:65705},updated:'2026-11-15'};
  const arrivals={label:'Arrivals at tourist accommodation establishments by country of origin of the tourist',id:['freq','unit','c_resid','nace_r2','geo','time'],size:[1,1,1,1,1,1],dimension:{...dimensions({freq:'A',unit:'NR',c_resid:'PL',nace_r2:'I551-I553',geo:'BE'}),time:{category:{index:{2025:0}}}},value:{0:121946},updated:'2026-10-12'};
  const body=`${'Te dwie miary opisują różne populacje i wymagają kontroli redakcyjnej. '.repeat(20)}\n\n${[populationUrl,arrivalsUrl,definitionsUrl].map(url=>`[Źródło](${url})`).join('\n')}`;
  const output={title:'Polscy obywatele i przyjazdy mieszkańców Polski do Belgii',description:'Zestawienie dwóch różnych miar z Eurostatu i definicji pobytu w obiekcie noclegowym.',body,evidenceQuoteIds:['0:0','1:0']};
  let geminiCalls=0,requestPrompt='';
  const fetcher=async(url,options)=>{
    if(process.env.LIVE_OFFICIAL_SOURCES==='1' && [populationUrl,arrivalsUrl,definitionsUrl].includes(url))return fetch(url,options);
    if(url===populationUrl)return Response.json(population);
    if(url===arrivalsUrl)return Response.json(arrivals);
    if(url===definitionsUrl)return new Response(`<main>${'An arrival means a guest who stays at least one night in collective accommodation. '.repeat(8)}</main>`,{headers:{'content-type':'text/html'}});
    geminiCalls++;requestPrompt=JSON.parse(options.body).contents[0].parts[0].text;
    return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(output)}]}}]});
  };
  const result=await processChatJobs({DB,GEMINI_API_KEY:'test-key',GEMINI_FREE_TIER_CONFIRMED:'1'},{fetcher});
  assert.equal(result.status,'done');assert.equal(geminiCalls,1);
  assert.ok(requestPrompt.includes('65705'));assert.ok(requestPrompt.includes('121946'));
  const candidate=DB.sqlite.prepare('SELECT status,sources_json,verification_json FROM ai_candidates WHERE id=?').get(result.candidateId);
  assert.equal(candidate.status,'pending_review');assert.equal(JSON.parse(candidate.sources_json).length,2);
  assert.equal(JSON.parse(candidate.verification_json).evidenceQuotes.length,2);
  assert.equal(await publicEntry(DB,`ai-${result.candidateId}`),null);
});

test('follow-up edits the same unpublished article and records both full versions',async()=>{
  const DB=database(),conversationId=randomUUID(),url='https://example.be/zycie',at=new Date().toISOString();
  const source='W Belgii dostępność mieszkań zależy od lokalizacji, ceny i rodzaju umowy najmu.';
  const fetcher=async endpoint=>endpoint===url
    ? new Response(`<article>${source.repeat(12)}</article>`,{headers:{'content-type':'text/html'}})
    : Response.json({candidates:[{content:{parts:[{text:JSON.stringify({title:'Mieszkanie po przeprowadzce do Belgii',description:'Praktyczne porady o wynajmie mieszkania po przyjeździe do Belgii.',body:'Najem mieszkania wymaga sprawdzenia umowy i lokalizacji. '.repeat(12),evidenceQuoteIds:['0:0']})}]}}]});
  const env={DB,GEMINI_API_KEY:'test-key',GEMINI_FREE_TIER_CONFIRMED:'1'};
  for(const prompt of [`Napisz o wynajmie mieszkań ${url}`,`Dodaj więcej przykładów o umowach ${url}`]){
    DB.sqlite.prepare("INSERT INTO ai_chat_jobs(id,conversation_id,actor_id,prompt,status,created_at,updated_at) VALUES(?,?,?,?,'queued',?,?)").run(randomUUID(),conversationId,'editor',prompt,at,at);
    assert.equal((await processChatJobs(env,{fetcher})).status,'done');
  }
  assert.equal(DB.sqlite.prepare('SELECT count(DISTINCT candidate_id) AS n FROM ai_chat_jobs WHERE conversation_id=?').get(conversationId).n,1);
  assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM ai_chat_versions WHERE conversation_id=?').get(conversationId).n,2);
  assert.equal(DB.sqlite.prepare("SELECT status FROM ai_editorial WHERE candidate_id=(SELECT candidate_id FROM ai_chat_jobs WHERE conversation_id=? LIMIT 1)").get(conversationId).status,'pending_review');
});

test('Gemini quota keeps article queued without consuming its retry allowance',async()=>{
  const DB=database(),jobId=randomUUID(),at=new Date().toISOString();
  DB.sqlite.prepare("INSERT INTO ai_chat_jobs(id,conversation_id,actor_id,prompt,status,created_at,updated_at) VALUES(?,?,?,?,'queued',?,?)").run(jobId,randomUUID(),'editor','Napisz o belgijskich kosztach życia',at,at);
  const result=await processChatJobs({DB,GEMINI_API_KEY:'test-key',GEMINI_FREE_TIER_CONFIRMED:'1'},{fetcher:async()=>new Response('{}',{status:429})});
  assert.equal(result.status,'waiting_quota');
  const job=DB.sqlite.prepare('SELECT status,attempts,not_before FROM ai_chat_jobs WHERE id=?').get(jobId);
  assert.equal(job.status,'queued');assert.equal(job.attempts,0);assert.ok(Date.parse(job.not_before)>Date.now());
});

test('morning scheduler creates three distinct unpublished topics once',async()=>{
  const DB=database(),at=new Date('2026-11-19T06:00:00Z');
  DB.sqlite.prepare("INSERT INTO ai_config(key,value_json,updated_at) VALUES('auto_editorial',?,?)").run(JSON.stringify({enabled:true}),at.toISOString());
  const fetcher=async url=>{const term=new URL(url).searchParams.get('query');return Response.json({articles:[{url:`https://example.be/${encodeURIComponent(term)}`,title:`Belgium: ${term} — praktyczny temat`,seendate:'20261119T050000Z'}]});};
  const env={DB,AI_AUTOMATION_ENABLED:'1'};
  assert.deepEqual(await queueMorning(env,{fetcher,at}),{status:'queued',count:3});
  assert.equal((await queueMorning(env,{fetcher,at})).status,'already_queued');
  assert.equal(DB.sqlite.prepare("SELECT count(*) AS n FROM ai_chat_jobs WHERE status='queued'").get().n,3);
  assert.equal(DB.sqlite.prepare('SELECT count(DISTINCT conversation_id) AS n FROM ai_chat_jobs').get().n,3);
  assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM ai_candidates').get().n,0);
});

test('authenticated CMS chat stores both messages and rejects unauthenticated access',async()=>{
  const DB=database(),token=randomBytes(32).toString('base64url'),userId=randomUUID();
  DB.sqlite.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(userId,'editor@example.com','Editor','unused','admin');
  DB.sqlite.prepare('INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await sha256(token),userId,'2099-01-01');
  const env={DB,GEMINI_API_KEY:'test-key',GEMINI_FREE_TIER_CONFIRMED:'1'};
  const anonymous=await aiChatRoute({request:new Request('https://polacywbelgii.pages.dev/api/ai-chat'),env});
  assert.equal(anonymous.status,401);
  const styleRequest=cookie=>new Request('https://polacywbelgii.pages.dev/api/ai-chat',{method:'POST',headers:{Origin:'https://polacywbelgii.pages.dev','Content-Type':'application/json',...(cookie?{Cookie:`__Host-pbe_session=${token}`}:{})},body:JSON.stringify({action:'update-style'})});
  assert.equal((await aiChatRoute({request:styleRequest(false),env})).status,401);
  const styleResponse=await aiChatRoute({request:styleRequest(true),env});
  assert.equal(styleResponse.status,200);assert.equal((await styleResponse.json()).editorialStyle.count,0);
  const originalFetch=globalThis.fetch;
  let modelPrompt='';
  globalThis.fetch=async(_url,options)=>{modelPrompt=JSON.parse(options.body).contents[0].parts[0].text;return Response.json({candidates:[{content:{parts:[{text:'Trzy propozycje tematów do opracowania.'}]}}]});};
  try{
    const request=new Request('https://polacywbelgii.pages.dev/api/ai-chat',{method:'POST',headers:{Origin:'https://polacywbelgii.pages.dev','Content-Type':'application/json',Cookie:`__Host-pbe_session=${token}`},body:JSON.stringify({action:'send',mode:'chat',text:'Jakie tematy warto omówić?'})});
    const response=await aiChatRoute({request,env});assert.equal(response.status,200);
    const conversationId=(await response.json()).conversationId;
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM ai_chat_entries').get().n,2);
    const candidateId='a'.repeat(20),draftJob=randomUUID(),at=new Date().toISOString();
    DB.sqlite.prepare("INSERT INTO ai_candidates(id,kind,status,title,description,body,region,sources_json,verification_json,created_at,updated_at) VALUES(?,'article','pending_review',?,?,?,'all','[]','{}',?,?)").run(candidateId,'Transport w Brukseli','Praktyczny przewodnik','Metro i tramwaje w Brukseli.',at,at);
    DB.sqlite.prepare("INSERT INTO ai_editorial(candidate_id,status,owner_kind,owner_id,updated_at) VALUES(?,'pending_review','agent',?,?)").run(candidateId,userId,at);
    DB.sqlite.prepare("INSERT INTO ai_chat_jobs(id,conversation_id,actor_id,prompt,status,candidate_id,created_at,updated_at) VALUES(?,?,?,'Napisz artykuł','done',?,?,?)").run(draftJob,conversationId,userId,candidateId,at,at);
    const followup=new Request('https://polacywbelgii.pages.dev/api/ai-chat',{method:'POST',headers:{Origin:'https://polacywbelgii.pages.dev','Content-Type':'application/json',Cookie:`__Host-pbe_session=${token}`},body:JSON.stringify({action:'send',mode:'chat',conversationId,text:'Czy w artykule jest informacja o tramwajach?'})});
    assert.equal((await aiChatRoute({request:followup,env})).status,200);
    assert.match(modelPrompt,/Metro i tramwaje w Brukseli/);
    const clearRequest=()=>new Request('https://polacywbelgii.pages.dev/api/ai-chat',{method:'POST',headers:{Origin:'https://polacywbelgii.pages.dev','Content-Type':'application/json',Cookie:`__Host-pbe_session=${token}`},body:JSON.stringify({action:'clear',conversationId})});
    DB.sqlite.prepare("INSERT INTO retention_holds(entity_type,entity_id,reason_code) VALUES('ai_conversation',?,'legal_other')").run(conversationId);
    assert.equal((await aiChatRoute({request:clearRequest(),env})).status,403);
    DB.sqlite.prepare("UPDATE retention_holds SET released_at=? WHERE entity_type='ai_conversation' AND entity_id=?").run(new Date().toISOString(),conversationId);
    assert.equal((await aiChatRoute({request:clearRequest(),env})).status,200);
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM ai_chat_entries WHERE conversation_id=?').get(conversationId).n,0);
    for(let n=0;n<2;n++)DB.sqlite.prepare("INSERT INTO ai_chat_jobs(id,conversation_id,actor_id,prompt,status,created_at,updated_at) VALUES(?,?,?,?,'queued',?,?)").run(randomUUID(),randomUUID(),userId,'article','2026-11-12','2026-11-12');
    const blocked=await aiChatRoute({request:new Request('https://polacywbelgii.pages.dev/api/ai-chat',{method:'POST',headers:{Origin:'https://polacywbelgii.pages.dev','Content-Type':'application/json',Cookie:`__Host-pbe_session=${token}`},body:JSON.stringify({action:'send',mode:'article',text:'Prepare an article with an official source.'})}),env});
    assert.equal(blocked.status,409);assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM ai_chat_jobs').get().n,2);
  }finally{globalThis.fetch=originalFetch;}
});

test('administrator permanently deletes one manual or AI event without touching another event',async()=>{
  const DB=database(),token=randomBytes(32).toString('base64url'),userId=randomUUID();
  DB.sqlite.prepare('INSERT INTO cms_users(id,email,name,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,0)').run(userId,'event-admin@example.com','Event Admin','unused','admin');
  DB.sqlite.prepare('INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await sha256(token),userId,'2099-01-01');
  const ids=['1'.repeat(20),'2'.repeat(20),'3'.repeat(20)];
  for(const [index,id] of ids.entries()){
    const category=index===2?'History':'Kultura';
    const event={start:'2090-01-01T10:00:00.000Z',timezone:'Europe/Brussels',city:'Bruksela',venue:'Sala',organizer:'Organizator',category,region:'brussels',sourceUrl:'https://www.belgium.be/en',status:'scheduled'};
    DB.sqlite.prepare('INSERT INTO ai_candidates(id,kind,status,title,description,body,category,region,sources_json,verification_json,event_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'event','published',`Event ${index}`,'Description','Body',category,'brussels','[]',JSON.stringify({status:'verified'}),JSON.stringify(event),'2026-01-01','2026-01-01');
    DB.sqlite.prepare("INSERT INTO ai_editorial(candidate_id,status,owner_kind,owner_id,approved_by,approved_at,published_at,public_state,updated_at) VALUES(?,'published',?,?,'admin','2026-01-01','2026-01-01','visible','2026-01-01')").run(id,index===1?'agent':'admin',index===1?'agent':userId);
    DB.sqlite.prepare('INSERT INTO ai_candidate_history(candidate_id,new_status,at) VALUES(?,?,?)').run(id,'published','2026-01-01');
  }
  const env={DB};
  const send=id=>aiEditorRoute({request:new Request('https://polacywbelgii.pages.dev/api/ai-editor',{method:'POST',headers:{Origin:'https://polacywbelgii.pages.dev','Content-Type':'application/json',Cookie:`__Host-pbe_session=${token}`},body:JSON.stringify({action:'delete-event',id})}),env});
  assert.equal((await send(ids[0])).status,200);
  assert.equal((await send(ids[1])).status,200);
  for(const id of ids.slice(0,2)){
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM ai_candidates WHERE id=?').get(id).n,0);
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM ai_candidate_history WHERE candidate_id=?').get(id).n,0);
    assert.equal(await publicEntry(DB,`ai-${id}`),null);
  }
  assert.equal((await publicEntry(DB,`ai-${ids[2]}`)).title,'Event 2');
  assert.equal((await publicEntries(DB,'event'))[0].category,'Inne');
  assert.equal((await aiEditorRoute({request:new Request('https://polacywbelgii.pages.dev/api/ai-editor',{method:'POST',headers:{Origin:'https://polacywbelgii.pages.dev','Content-Type':'application/json'},body:JSON.stringify({action:'delete-event',id:ids[2]})}),env})).status,401);
});

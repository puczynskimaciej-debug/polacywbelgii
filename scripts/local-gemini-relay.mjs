import http from 'node:http';
import fs from 'node:fs';
import { timingSafeEqual } from 'node:crypto';

const config=fs.readFileSync(new URL('../.dev.vars',import.meta.url),'utf8');
const token=/^GEMINI_LOCAL_RELAY_TOKEN=(\S+)$/m.exec(config)?.[1];
const apiKey=/^GEMINI_API_KEY=(\S+)$/m.exec(config)?.[1];
if(!token || !apiKey || !/^GEMINI_FREE_TIER_CONFIRMED=1$/m.test(config))throw new Error('Local Gemini relay Free Tier configuration is missing');
const modelUrl='https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';
let requests=0,windowStart=Date.now();
const reply=(response,status,body)=>{response.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});response.end(JSON.stringify(body));};
http.createServer(async(request,response)=>{
  if(request.method!=='POST' || request.url!=='/generate')return reply(response,404,{error:'notFound'});
  const supplied=request.headers['x-pbe-relay-token'];
  const a=Buffer.from(String(supplied || '')),b=Buffer.from(token);
  if(a.length!==b.length || !timingSafeEqual(a,b))return reply(response,401,{error:'unauthorized'});
  if(Date.now()-windowStart>86400000){requests=0;windowStart=Date.now();}
  if(++requests>30)return reply(response,429,{error:'rateLimit'});
  let raw='';
  for await (const part of request){raw+=part;if(raw.length>50000)return reply(response,413,{error:'tooLarge'});}
  let body;try{body=JSON.parse(raw);}catch{return reply(response,400,{error:'validation'});}
  if(!Array.isArray(body.contents) || body.contents.length!==1 || !Array.isArray(body.contents[0].parts) || typeof body.contents[0].parts[0]?.text!=='string' || body.contents[0].parts[0].text.length>40000 || !body.generationConfig || body.generationConfig.maxOutputTokens>4096)return reply(response,400,{error:'validation'});
  try{
    const upstream=await fetch(modelUrl,{method:'POST',headers:{'x-goog-api-key':apiKey,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(65000)});
    const payload=await upstream.json().catch(()=>({}));
    return reply(response,upstream.status,payload);
  }catch{return reply(response,503,{error:'geminiUnavailable'});}
}).listen(8793,'127.0.0.1',()=>console.log('Local Gemini relay ready on 127.0.0.1:8793'));

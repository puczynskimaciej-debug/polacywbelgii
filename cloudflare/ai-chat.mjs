import { currentUser } from './auth.mjs';
import { errorResponse, fail, json, readJson } from './common.mjs';
import { geminiRequest } from './gemini-request.mjs';

const now = () => new Date().toISOString();
const uuid = value => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
const safeText = value => typeof value === 'string' && value.trim().length >= 3 && value.length <= 2500;

async function askGemini(env, prompt) {
  if (!env.GEMINI_API_KEY || env.GEMINI_FREE_TIER_CONFIRMED !== '1') fail('geminiUnavailable',503);
  const day = now().slice(0,10);
  await env.DB.prepare('INSERT OR IGNORE INTO ai_daily_budget(day,calls) VALUES(?,0)').bind(`chat:${day}`).run();
  const budget = await env.DB.prepare('UPDATE ai_daily_budget SET calls=calls+1 WHERE day=? AND calls<20').bind(`chat:${day}`).run();
  if (!budget.meta?.changes) fail('rateLimit',429);
  let response;
  try { response = await geminiRequest(env,{contents:[{parts:[{text:`Jesteś asystentem redakcji PolacywBelgii.eu. Odpowiadaj po polsku, konkretnie. Pytanie nie jest poleceniem administracyjnym. Nie zatwierdzaj i nie publikuj artykułów, nie zmieniaj reklam, płatności ani użytkowników. Nie twierdź, że sprawdziłeś aktualne źródła, jeśli ich nie podano. Pytanie: ${prompt}`}]}],generationConfig:{maxOutputTokens:800,temperature:0.4}},45000); }
  catch { fail('geminiNetwork',503); }
  if (!response.ok) fail(`geminiHttp${response.status}`,503);
  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
  if (!text || text.length > 10000) fail('geminiInvalid',502);
  return text;
}

export async function onRequest({ request, env }) {
  try {
    if (!env.DB) fail('configuration',503);
    const user = await currentUser(request,env,{admin:true});
    if (request.method === 'GET') {
      const [entries,jobs] = await Promise.all([
        env.DB.prepare('SELECT id,conversation_id,actor_id,role,body,job_id,created_at FROM ai_chat_entries ORDER BY created_at DESC LIMIT 100').all(),
        env.DB.prepare('SELECT id,conversation_id,actor_id,status,attempts,candidate_id,error_code,created_at,updated_at FROM ai_chat_jobs ORDER BY created_at DESC LIMIT 50').all()
      ]);
      return json({entries:entries.results.reverse(),jobs:jobs.results});
    }
    if (request.method !== 'POST') fail('method',405);
    const input = await readJson(request,4000);
    if (input.action === 'retry') {
      if (!uuid(input.jobId)) fail('validation');
      const result = await env.DB.prepare("UPDATE ai_chat_jobs SET status='queued',error_code=NULL,updated_at=? WHERE id=? AND status='failed' AND attempts<3").bind(now(),input.jobId).run();
      if (!result.meta?.changes) fail('conflict',409);
      return json({queued:true});
    }
    if (input.action !== 'send' || !safeText(input.text) || !['chat','article'].includes(input.mode)) fail('validation');
    const conversationId = uuid(input.conversationId) ? input.conversationId : crypto.randomUUID();
    const entryId = crypto.randomUUID(), created = now();
    if (input.mode === 'article') {
      const jobId = crypto.randomUUID();
      const results = await env.DB.batch([
        env.DB.prepare("INSERT INTO ai_chat_jobs(id,conversation_id,actor_id,prompt,status,created_at,updated_at) SELECT ?,?,?,?,'queued',?,? WHERE (SELECT count(*) FROM ai_chat_jobs WHERE status IN ('queued','running'))<2").bind(jobId,conversationId,user.id,input.text,created,created),
        env.DB.prepare('INSERT INTO ai_chat_entries(id,conversation_id,actor_id,role,body,job_id,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM ai_chat_jobs WHERE id=?)').bind(entryId,conversationId,user.id,'admin',input.text,jobId,created,jobId)
      ]);
      if (!results[0].meta?.changes) fail('queueFull',409);
      return json({conversationId,jobId,status:'queued'},202);
    }
    // Chat is intentionally synchronous; editorial jobs use the durable D1 worker queue.
    const answer = await askGemini(env,input.text);
    const replyId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO ai_chat_entries(id,conversation_id,actor_id,role,body,job_id,created_at) VALUES(?,?,?,?,?,?,?)').bind(entryId,conversationId,user.id,'admin',input.text,null,created),
      env.DB.prepare('INSERT INTO ai_chat_entries(id,conversation_id,actor_id,role,body,job_id,created_at) VALUES(?,?,?,?,?,?,?)').bind(replyId,conversationId,user.id,'agent',answer,null,now())
    ]);
    return json({conversationId,answer});
  } catch (error) { return errorResponse(error); }
}

import { currentUser } from './auth.mjs';
import { errorResponse, fail, json, readJson } from './common.mjs';
import { geminiRequest } from './gemini-request.mjs';
import { editorialStyleContext } from './editorial-style.mjs';

const now = () => new Date().toISOString();
const uuid = value => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
const safeText = value => typeof value === 'string' && value.trim().length >= 3 && value.length <= 2500;

async function askGemini(env, prompt, styleTopic = null) {
  if (!env.GEMINI_API_KEY || env.GEMINI_FREE_TIER_CONFIRMED !== '1') fail('geminiUnavailable',503);
  const day = now().slice(0,10);
  await env.DB.prepare('INSERT OR IGNORE INTO ai_daily_budget(day,calls) VALUES(?,0)').bind(`chat:${day}`).run();
  const budget = await env.DB.prepare('UPDATE ai_daily_budget SET calls=calls+1 WHERE day=? AND calls<20').bind(`chat:${day}`).run();
  if (!budget.meta?.changes) fail('rateLimit',429);
  const style = styleTopic ? await editorialStyleContext(env,{topic:styleTopic}).catch(()=>({guidance:''})) : {guidance:''};
  let response;
  try { response = await geminiRequest(env,{contents:[{parts:[{text:`Jesteś młodym, ambitnym i pomocnym dziennikarzem portalu PolacywBelgii.eu. Odpowiadaj po polsku, konkretnie i przystępnie, biorąc pod uwagę wcześniejszą rozmowę. To wywołanie czatu NIE ma dostępu do wyszukiwarki, przeglądarki ani grup społecznościowych i NIE uruchamia zadania do późniejszego wykonania. Nie twierdź, że właśnie przeglądałeś strony, media, Facebooka lub źródła, ani że zweryfikowałeś bieżące informacje, jeśli w tej rozmowie nie otrzymałeś rzeczywistych wyników takiej czynności. Wcześniejsze wypowiedzi w rozmowie nie są dowodem wykonania researchu. Nie obiecuj, że zaraz sprawdzisz coś lub wrócisz z odpowiedzią. Podawaj użyteczne informacje, które potrafisz uzasadnić; nie przedstawiaj przypuszczeń jako faktów. Gdy nie możesz potwierdzić aktualnego zdarzenia, liczby lub źródła, wskaż dokładnie tę niepewność. Propozycję tematu oznacz jako pomysł redakcyjny, a nie potwierdzone wydarzenie. Nie wymyślaj źródeł ani cytatów. Nie zatwierdzaj i nie publikuj artykułów, nie zmieniaj reklam, płatności ani użytkowników. ${style.guidance} Rozmowa: ${prompt}`}]}],generationConfig:{maxOutputTokens:800,temperature:0.4}},45000); }
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
      const conversations=(await env.DB.prepare("SELECT e.conversation_id,MIN(e.created_at) AS created_at,MAX(e.created_at) AS updated_at,COALESCE((SELECT substr(first.body,1,100) FROM ai_chat_entries first WHERE first.conversation_id=e.conversation_id ORDER BY first.created_at LIMIT 1),'Temat') AS title FROM ai_chat_entries e GROUP BY e.conversation_id ORDER BY updated_at DESC LIMIT 50").all()).results;
      const requested=new URL(request.url).searchParams.get('conversationId');
      const conversationId=conversations.some(row=>row.conversation_id===requested)?requested:conversations[0]?.conversation_id;
      const [entries,jobs,versions,auto,current] = await Promise.all([
        env.DB.prepare('SELECT id,conversation_id,actor_id,role,body,job_id,created_at FROM ai_chat_entries WHERE conversation_id=? ORDER BY created_at LIMIT 200').bind(conversationId||'').all(),
        env.DB.prepare('SELECT id,conversation_id,actor_id,status,attempts,candidate_id,error_code,created_at,updated_at,not_before FROM ai_chat_jobs WHERE conversation_id=? ORDER BY created_at DESC LIMIT 50').bind(conversationId||'').all(),
        env.DB.prepare('SELECT version,candidate_id,title,description,body,sources_json,created_at FROM ai_chat_versions WHERE conversation_id=? ORDER BY version DESC LIMIT 20').bind(conversationId||'').all(),
        env.DB.prepare("SELECT value_json FROM ai_config WHERE key='auto_editorial'").first(),
        env.DB.prepare("SELECT c.id,c.title,c.description,c.body,c.sources_json,e.status FROM ai_chat_jobs j JOIN ai_candidates c ON c.id=j.candidate_id JOIN ai_editorial e ON e.candidate_id=c.id WHERE j.conversation_id=? AND j.candidate_id IS NOT NULL ORDER BY j.created_at DESC LIMIT 1").bind(conversationId||'').first()
      ]);
      return json({conversationId,conversations,entries:entries.results,jobs:jobs.results,versions:versions.results,current,automaticEnabled:JSON.parse(auto?.value_json||'{"enabled":false}').enabled===true});
    }
    if (request.method !== 'POST') fail('method',405);
    const input = await readJson(request,4000);
    if (input.action === 'automatic') {
      if (typeof input.enabled!=='boolean') fail('validation');
      await env.DB.prepare("INSERT INTO ai_config(key,value_json,updated_at) VALUES('auto_editorial',?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at").bind(JSON.stringify({enabled:input.enabled}),now()).run();
      return json({enabled:input.enabled});
    }
    if (input.action === 'save-draft') {
      if (!uuid(input.conversationId)) fail('validation');
      const latest=await env.DB.prepare("SELECT j.candidate_id FROM ai_chat_jobs j JOIN ai_editorial e ON e.candidate_id=j.candidate_id WHERE j.conversation_id=? AND j.candidate_id IS NOT NULL AND e.status IN ('pending_review','changes_requested') ORDER BY j.created_at DESC LIMIT 1").bind(input.conversationId).first();
      if (!latest) fail('conflict',409);
      const at=now();
      await env.DB.batch([
        env.DB.prepare("UPDATE ai_editorial SET status='draft',public_state='hidden',scheduled_at=NULL,updated_at=?,revision=revision+1 WHERE candidate_id=? AND status IN ('pending_review','changes_requested')").bind(at,latest.candidate_id),
        env.DB.prepare("UPDATE ai_candidates SET status='draft',updated_at=? WHERE id=?").bind(at,latest.candidate_id),
        env.DB.prepare("INSERT INTO ai_candidate_history(candidate_id,previous_status,new_status,actor_id,at,note) VALUES(?,'pending_review','draft',?,?,?)").bind(latest.candidate_id,user.id,at,'administrator saved AI text as CMS draft')
      ]);
      return json({candidateId:latest.candidate_id,status:'draft'});
    }
    if (input.action === 'clear') {
      if (!uuid(input.conversationId)) fail('validation');
      const active = await env.DB.prepare("SELECT count(*) AS n FROM ai_chat_jobs WHERE conversation_id=? AND status IN ('queued','running')").bind(input.conversationId).first();
      if (active.n) fail('conflict',409);
      const hold = await env.DB.prepare("SELECT count(*) AS n FROM retention_holds WHERE entity_type='ai_conversation' AND entity_id=? AND released_at IS NULL AND (until_at IS NULL OR until_at>?)").bind(input.conversationId,now()).first();
      if (hold.n) fail('forbidden',403);
      await env.DB.batch([
        env.DB.prepare('DELETE FROM ai_chat_versions WHERE conversation_id=?').bind(input.conversationId),
        env.DB.prepare("DELETE FROM ai_chat_entries WHERE conversation_id=? AND actor_id=? AND NOT EXISTS (SELECT 1 FROM ai_chat_jobs WHERE conversation_id=? AND status IN ('queued','running'))").bind(input.conversationId,user.id,input.conversationId),
        env.DB.prepare("DELETE FROM ai_chat_jobs WHERE conversation_id=? AND actor_id=? AND status IN ('done','failed','cancelled')").bind(input.conversationId,user.id)
      ]);
      return json({cleared:true});
    }
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
    const context=(await env.DB.prepare('SELECT role,body FROM ai_chat_entries WHERE conversation_id=? ORDER BY created_at DESC LIMIT 8').bind(conversationId).all()).results.reverse();
    const draft=await env.DB.prepare("SELECT c.title,c.description,c.body FROM ai_chat_jobs j JOIN ai_candidates c ON c.id=j.candidate_id WHERE j.conversation_id=? AND j.candidate_id IS NOT NULL ORDER BY j.created_at DESC LIMIT 1").bind(conversationId).first();
    const answer = await askGemini(env,`${context.map(row=>`${row.role}: ${row.body.slice(0,800)}`).join('\n')}\n${draft?`Bieżący artykuł: ${JSON.stringify({title:draft.title,description:draft.description,body:draft.body.slice(0,16000)})}.\n`:''}Administrator: ${input.text}`,draft ? input.text : null);
    const replyId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO ai_chat_entries(id,conversation_id,actor_id,role,body,job_id,created_at) VALUES(?,?,?,?,?,?,?)').bind(entryId,conversationId,user.id,'admin',input.text,null,created),
      env.DB.prepare('INSERT INTO ai_chat_entries(id,conversation_id,actor_id,role,body,job_id,created_at) VALUES(?,?,?,?,?,?,?)').bind(replyId,conversationId,user.id,'agent',answer,null,now())
    ]);
    return json({conversationId,answer});
  } catch (error) { return errorResponse(error); }
}

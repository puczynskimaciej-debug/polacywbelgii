import { searchNews, searchWikimedia } from './ai-research.mjs';

const themes = [
  ['praca i wynagrodzenia','Belgium jobs wages'],
  ['mieszkanie i koszty życia','Belgium rent cost living'],
  ['zdrowie i opieka medyczna','Belgium healthcare patients'],
  ['dzieci i edukacja','Belgium schools families'],
  ['prawo i administracja','Belgium legal residence work'],
  ['transport i codzienność','Belgium public transport'],
  ['inicjatywy polonijne','Polish community Belgium']
];

export async function queueMorning(env,{fetcher=fetch,at=new Date()}={}) {
  if (env.AI_AUTOMATION_ENABLED!=='1') return {status:'disabled'};
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).format(at);
  const [day,hour]=parts.split(', ');
  if (hour!=='07') return {status:'outside_morning'};
  const setting=await env.DB.prepare("SELECT value_json FROM ai_config WHERE key='auto_editorial'").first();
  if (JSON.parse(setting?.value_json||'{"enabled":false}').enabled!==true) return {status:'disabled'};
  if (await env.DB.prepare('SELECT local_day FROM ai_morning_runs WHERE local_day=?').bind(day).first()) return {status:'already_queued'};
  const pending=await env.DB.prepare("SELECT count(*) AS n FROM ai_editorial WHERE status='pending_review'").first();
  const editorial=await env.DB.prepare("SELECT value_json FROM ai_config WHERE key='editorial'").first();
  const maxPending=JSON.parse(editorial?.value_json||'{}').maxPending||21;
  if (pending.n+3>maxPending) return {status:'queue_full'};
  const dayIndex=Math.floor(Date.parse(`${day}T00:00:00Z`)/86400000);
  const chosen=[0,1,2].map(index=>themes[(dayIndex*3+index)%themes.length]);
  const recent=(await env.DB.prepare("SELECT prompt FROM ai_chat_jobs WHERE created_at>=? ORDER BY created_at DESC LIMIT 100").bind(new Date(at.getTime()-30*86400000).toISOString()).all()).results.map(row=>row.prompt.toLowerCase());
  const proposals=[];
  for (const [theme,query] of chosen) {
    if (proposals.length) await new Promise(resolve=>setTimeout(resolve,5500));
    let results=await searchNews(query,{fetcher,terms:[query]}).catch(()=>[]);
    if (!results.length) results=await searchWikimedia(query,fetcher).catch(()=>[]);
    const item=results.find(row=>!recent.some(prompt=>prompt.includes(row.url.toLowerCase()) || prompt.includes(row.title.toLowerCase())) && !proposals.some(previous=>previous.item.url===row.url));
    proposals.push(item?{theme,item}:{theme,item:{url:'',title:`Praktyczne pytania Polaków w Belgii: ${theme}`}});
  }
  const stamp=at.toISOString();
  const statements=[env.DB.prepare('INSERT OR IGNORE INTO ai_morning_runs(local_day,queued_at,topic_count) VALUES(?,?,0)').bind(day,stamp)];
  for (const [index,proposal] of proposals.entries()) {
    const jobId=crypto.randomUUID(), conversationId=crypto.randomUUID();
    const prompt=`Przygotuj praktyczny artykuł dla Polaków w Belgii o temacie „${proposal.item.title}” (${proposal.theme}). Sprawdź aktualne informacje, ich znaczenie i ograniczenia.${proposal.item.url?` Punkt wyjścia: ${proposal.item.url}`:''}`;
    statements.push(env.DB.prepare("INSERT INTO ai_chat_jobs(id,conversation_id,actor_id,prompt,status,created_at,updated_at) SELECT ?,?,'agent',?,'queued',?,? WHERE (SELECT topic_count FROM ai_morning_runs WHERE local_day=?)=0").bind(jobId,conversationId,prompt,stamp,stamp,day));
    statements.push(env.DB.prepare("INSERT INTO ai_chat_entries(id,conversation_id,actor_id,role,body,job_id,created_at) SELECT ?,?,'agent','agent','Propozycja poranna: '||?, ?, ? WHERE EXISTS (SELECT 1 FROM ai_chat_jobs WHERE id=?)").bind(crypto.randomUUID(),conversationId,proposal.item.title,jobId,stamp,jobId));
    if (index===2) statements.push(env.DB.prepare('UPDATE ai_morning_runs SET topic_count=3 WHERE local_day=? AND topic_count=0').bind(day));
  }
  await env.DB.batch(statements);
  return {status:'queued',count:3};
}

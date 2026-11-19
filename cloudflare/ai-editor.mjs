import { currentUser } from './auth.mjs';
import { errorResponse, fail, json, readJson, sha256 } from './common.mjs';
import { brusselsToUtc, canTransition, validateEditorialConfig, proposeSlot } from '../agent/editorial.mjs';
import { validateEvent } from './event-data.mjs';
import { publishDue } from './publication.mjs';

async function actorFor(request, env) {
  const bearer = request.headers.get('authorization');
  if (!bearer) {
    const user = await currentUser(request, env, { admin: true });
    return { kind: 'admin', id: user.id };
  }
  if (env.CMS_ORIGIN && new URL(request.url).origin !== env.CMS_ORIGIN) fail('configuration',503);
  const match = /^Bearer ([A-Za-z0-9_-]{32,})$/.exec(bearer);
  if (!match || !env.AGENT_SERVICE_TOKEN) fail('unauthorized', 401);
  const actual = await sha256(match[1]);
  const expected = await sha256(env.AGENT_SERVICE_TOKEN);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  if (difference) fail('unauthorized', 401);
  return { kind: 'agent', id: 'agent' };
}
const validId = id => { if (!/^[a-f0-9]{20}$/.test(id || '')) fail('validation'); };
const validSources = value => Array.isArray(value) && value.length <= 20 && value.every(source => typeof source.url === 'string' && /^https:\/\/[^\s]+$/.test(source.url));
const validContent = (input, manual = false) => typeof input.title === 'string' && input.title.trim().length >= (manual ? 0 : 10) && input.title.length <= 180 && typeof input.description === 'string' && input.description.trim().length >= 0 && input.description.length <= 500 && typeof input.body === 'string' && input.body.trim().length >= (manual ? 0 : 100) && input.body.length <= 50000 && validSources(input.sources);
const validArticleFields = value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => ['title_nl','description_nl','body_nl','title_fr','description_fr','body_fr','image','tags'].includes(key)) && Object.entries(value).every(([key,field]) => typeof field === 'string' && field.length <= (key.startsWith('body_') ? 50000 : key === 'description_nl' || key === 'description_fr' ? 500 : key === 'image' ? 2048 : key === 'tags' ? 500 : 180)) && (!value.image || /^\/(?!\/)[^\s"'<>]*$/.test(value.image) || /^https:\/\/[^\s"'<>]+$/.test(value.image));
const normalizeManual = input => { for (const key of ['title','description','body']) if (input[key] === undefined) input[key] = ''; if (input.sources === undefined) input.sources = []; input.event = { status:'scheduled',...(input.event || {}) }; };

export async function onRequest({ request, env }) {
  try {
    if (!env.DB) fail('configuration', 503);
    const actor = await actorFor(request, env);
    if (request.method === 'GET') {
      const [candidates, sources, runs, usage, config, history] = await Promise.all([
        env.DB.prepare('SELECT c.*,e.status AS editorial_status,e.owner_kind,e.owner_id,e.proposed_publish_at,e.scheduled_at,e.approved_by,e.approved_at,e.published_at,e.public_state,e.revision FROM ai_candidates c JOIN ai_editorial e ON e.candidate_id=c.id ORDER BY c.updated_at DESC LIMIT 100').all(),
        env.DB.prepare('SELECT id,url,type,language,region,priority,active,last_checked_at,last_error FROM ai_sources ORDER BY priority DESC,id LIMIT 100').all(),
        env.DB.prepare('SELECT * FROM ai_runs ORDER BY started_at DESC LIMIT 10').all(),
        env.DB.prepare('SELECT COALESCE(SUM(estimated_cost_usd),0) AS cost FROM ai_usage').first(),
        env.DB.prepare("SELECT value_json FROM ai_config WHERE key='editorial'").first(),
        env.DB.prepare('SELECT * FROM ai_candidate_history ORDER BY id DESC LIMIT 100').all()
      ]);
      const visible = candidates.results.filter(row => actor.kind === 'admin' || row.owner_kind === 'agent' && row.owner_id === actor.id).map(row => ({ ...row, status: row.editorial_status }));
      const now = Date.now();
      const diagnosed = visible.map(row => ({ ...row, overdue: row.status === 'scheduled' && row.public_state === 'hidden' && Boolean(row.scheduled_at) && Date.parse(row.scheduled_at) <= now, publicationBlock: row.status !== 'scheduled' ? null : !row.approved_by || !row.approved_at ? 'approval_missing' : row.kind === 'event' && JSON.parse(row.verification_json || '{}').status !== 'verified' ? 'verification_required' : null }));
      return json({ candidates: diagnosed, sources: actor.kind === 'admin' ? sources.results : [], runs: actor.kind === 'admin' ? runs.results : [], history: actor.kind === 'admin' ? history.results : history.results.filter(row => visible.some(candidate => candidate.id === row.candidate_id)), costUsd: actor.kind === 'admin' ? usage.cost : null, config: JSON.parse(config?.value_json || '{}'), canManage: actor.kind === 'admin', publicationMode: ['localhost','127.0.0.1'].includes(new URL(request.url).hostname) ? 'manual_local' : 'external_cron' });
    }
    if (request.method !== 'POST') fail('method', 405);
    const input = await readJson(request, 100000);
    if (input.action === 'config') {
      if (actor.kind !== 'admin') fail('forbidden', 403);
      const config = validateEditorialConfig(input.config);
      await env.DB.prepare("INSERT INTO ai_config(key,value_json,updated_at) VALUES('editorial',?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at").bind(JSON.stringify(config),new Date().toISOString()).run();
      return json({ config });
    }
    if (input.action === 'source') {
      if (actor.kind !== 'admin') fail('forbidden', 403);
      if (!/^[a-z0-9-]{1,60}$/.test(input.id || '') || typeof input.active !== 'boolean') fail('validation');
      const result = await env.DB.prepare('UPDATE ai_sources SET active=? WHERE id=?').bind(Number(input.active),input.id).run();
      if (!result.meta?.changes) fail('notFound', 404);
      return json({ id: input.id, active: input.active });
    }
    if (input.action === 'create' || input.action === 'manual-event') {
      if (input.action === 'create' && actor.kind !== 'agent' || input.action === 'manual-event' && actor.kind !== 'admin') fail('forbidden', 403);
      validId(input.id);
      const kind = input.action === 'manual-event' ? 'event' : input.kind;
      const manual = input.action === 'manual-event';
      if (manual) normalizeManual(input);
      if (!['article','event'].includes(kind) || !validContent(input,manual) || kind === 'event' && (!validateEvent(input.event,{ manual }) || !manual && !input.sources.some(source => source.url === input.event.sourceUrl))) fail('validation');
      const configRow = await env.DB.prepare("SELECT value_json FROM ai_config WHERE key='editorial'").first();
      const config = validateEditorialConfig(JSON.parse(configRow.value_json));
      const pending = await env.DB.prepare("SELECT count(*) AS n FROM ai_editorial WHERE status='pending_review'").first();
      if (pending.n >= config.maxPending) fail('queueFull',409);
      const slots = await env.DB.prepare("SELECT status,scheduled_at,proposed_publish_at FROM ai_editorial WHERE status IN ('scheduled','published','pending_review','draft')").all();
      const proposed = proposeSlot(slots.results.map(row => ({ status: row.status, scheduledAt: row.scheduled_at, proposedPublishAt: row.proposed_publish_at })),config,new Date(),kind === 'event' ? input.event.end || input.event.start : null);
      const now = new Date().toISOString();
      const status = input.action === 'manual-event' ? 'pending_review' : 'draft';
      await env.DB.batch([
        env.DB.prepare('INSERT INTO ai_candidates(id,kind,status,title,description,body,category,region,sources_json,verification_json,event_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(input.id,kind,status,input.title,input.description,input.body,input.category || null,kind === 'event' ? input.event.region || null : input.region || 'all',JSON.stringify(input.sources),JSON.stringify(input.verification || { status: 'needs_review', checkedAt: now }),kind === 'event' ? JSON.stringify(input.event) : null,now,now),
        env.DB.prepare('INSERT INTO ai_editorial(candidate_id,status,owner_kind,owner_id,proposed_publish_at,updated_at) VALUES(?,?,?,?,?,?)').bind(input.id,status,actor.kind,actor.id,proposed,now),
        env.DB.prepare('INSERT INTO ai_candidate_history(candidate_id,previous_status,new_status,actor_id,at,note) VALUES(?,?,?,?,?,?)').bind(input.id,null,status,actor.id,now,'created')
      ]);
      return json({ id: input.id, status, proposedPublishAt: proposed }, 201);
    }
    validId(input.id);
    const current = await env.DB.prepare('SELECT c.*,e.status AS editorial_status,e.owner_kind,e.owner_id,e.revision,e.approved_by,e.approved_at,e.scheduled_at FROM ai_candidates c JOIN ai_editorial e ON e.candidate_id=c.id WHERE c.id=?').bind(input.id).first();
    if (!current) fail('notFound', 404);
    if (actor.kind === 'agent' && (current.owner_kind !== 'agent' || current.owner_id !== actor.id)) fail('forbidden', 403);
    const now = new Date().toISOString();
    if (input.action === 'verify-article') {
      if (actor.kind !== 'admin' || current.kind !== 'article' || !['pending_review','approved','scheduled'].includes(current.editorial_status)) fail('forbidden',403);
      const sources = JSON.parse(current.sources_json || '[]');
      if (input.confirmed !== true || typeof input.note !== 'string' || input.note.trim().length < 20 || !sources.length || !validSources(sources)) fail('validation');
      const previous = JSON.parse(current.verification_json || '{}');
      const verification = { ...previous, status:'verified',checkedAt:now,actorId:actor.id,reviewNote:input.note.trim().slice(0,1000),issues:[] };
      await env.DB.batch([
        env.DB.prepare('UPDATE ai_candidates SET verification_json=?,updated_at=? WHERE id=?').bind(JSON.stringify(verification),now,input.id),
        env.DB.prepare('UPDATE ai_editorial SET revision=revision+1,updated_at=? WHERE candidate_id=?').bind(now,input.id),
        env.DB.prepare('INSERT INTO ai_candidate_history(candidate_id,previous_status,new_status,actor_id,at,note) VALUES(?,?,?,?,?,?)').bind(input.id,current.editorial_status,current.editorial_status,actor.id,now,'article sources and claims verified: '+verification.reviewNote)
      ]);
      return json({ id:input.id,verification });
    }
    if (input.action === 'retry-publication') {
      if (actor.kind !== 'admin') fail('forbidden',403);
      if (current.editorial_status !== 'scheduled' || !current.scheduled_at || Date.parse(current.scheduled_at) > Date.now() || !current.approved_by || !current.approved_at) fail('publicationNotDue',409);
      if (current.kind === 'event' && JSON.parse(current.verification_json || '{}').status !== 'verified') fail('verificationRequired',409);
      const result = await publishDue(env.DB,new Date(),new Set([input.id]));
      if (!result.published.includes(input.id)) fail('publicationBlocked',409);
      await env.DB.prepare('INSERT INTO ai_candidate_history(candidate_id,previous_status,new_status,actor_id,at,note) VALUES(?,?,?,?,?,?)').bind(input.id,current.editorial_status,'published',actor.id,now,'administrator retried due publication').run();
      return json({ id:input.id,status:'published' });
    }
    if (input.action === 'publish-now') {
      if (actor.kind !== 'admin' || current.kind !== 'article' || !['approved','scheduled'].includes(current.editorial_status)) fail('forbidden',403);
      if (!current.title?.trim() || !current.body?.trim()) fail('validation');
      await env.DB.prepare("UPDATE ai_editorial SET status='scheduled',scheduled_at=?,revision=revision+1,updated_at=? WHERE candidate_id=? AND status=? AND approved_by IS NOT NULL AND approved_at IS NOT NULL").bind(now,now,input.id,current.editorial_status).run();
      const result = await publishDue(env.DB,new Date(),new Set([input.id]));
      if (!result.published.includes(input.id)) fail('publicationBlocked',409);
      await env.DB.prepare('INSERT INTO ai_candidate_history(candidate_id,previous_status,new_status,actor_id,at,note) VALUES(?,?,?,?,?,?)').bind(input.id,current.editorial_status,'published',actor.id,now,'administrator published article now').run();
      return json({ id:input.id,status:'published' });
    }
    if (input.action === 'publish-event') {
      if (actor.kind !== 'admin' || current.kind !== 'event' || !['approved','scheduled'].includes(current.editorial_status)) fail('forbidden',403);
      const event = JSON.parse(current.event_json || '{}');
      if (current.owner_kind !== 'admin' && JSON.parse(current.verification_json || '{}').status !== 'verified' || !validateEvent(event,{ manual: current.owner_kind === 'admin',allowPast:true }) || event.status !== 'scheduled') fail('eventVerification',409);
      if (current.owner_kind === 'admin') await env.DB.prepare('UPDATE ai_candidates SET verification_json=?,updated_at=? WHERE id=?').bind(JSON.stringify({status:'verified',checkedAt:now,actorId:actor.id,method:'admin_publication'}),now,input.id).run();
      await env.DB.prepare("UPDATE ai_editorial SET status='scheduled',scheduled_at=?,approved_by=COALESCE(approved_by,?),approved_at=COALESCE(approved_at,?),revision=revision+1,updated_at=? WHERE candidate_id=? AND status=?").bind(now,actor.id,now,now,input.id,current.editorial_status).run();
      const published = await publishDue(env.DB,new Date(),new Set([input.id]));
      if (!published.published.includes(input.id)) fail('publicationBlocked',409);
      await env.DB.prepare('INSERT INTO ai_candidate_history(candidate_id,previous_status,new_status,actor_id,at,note) VALUES(?,?,?,?,?,?)').bind(input.id,current.editorial_status,'published',actor.id,now,'administrator published event now').run();
      return json({ id:input.id,status:'published' });
    }
    if (input.action === 'archive-event') {
      if (actor.kind !== 'admin' || current.kind !== 'event' || current.editorial_status === 'archived') fail('forbidden',403);
      await env.DB.batch([
        env.DB.prepare("UPDATE ai_editorial SET status='archived',public_state='hidden',scheduled_at=NULL,revision=revision+1,updated_at=? WHERE candidate_id=?").bind(now,input.id),
        env.DB.prepare('INSERT INTO ai_candidate_history(candidate_id,previous_status,new_status,actor_id,at,note) VALUES(?,?,?,?,?,?)').bind(input.id,current.editorial_status,'archived',actor.id,now,'event removed from calendar')
      ]);
      return json({ id:input.id,status:'archived' });
    }
    if (input.action === 'delete-event') {
      if (actor.kind !== 'admin' || current.kind !== 'event') fail('forbidden',403);
      await env.DB.batch([
        env.DB.prepare('UPDATE ai_chat_jobs SET candidate_id=NULL WHERE candidate_id=?').bind(input.id),
        env.DB.prepare('UPDATE ai_discovery_jobs SET candidate_id=NULL WHERE candidate_id=?').bind(input.id),
        env.DB.prepare('DELETE FROM ai_candidate_history WHERE candidate_id=?').bind(input.id),
        env.DB.prepare("DELETE FROM ai_candidates WHERE id=? AND kind='event'").bind(input.id)
      ]);
      return json({ id:input.id,deleted:true });
    }
    if (input.action === 'verify-event') {
      if (actor.kind !== 'admin' || current.kind !== 'event' || !['draft','pending_review','changes_requested','approved','scheduled'].includes(current.editorial_status)) fail('forbidden',403);
      const manual = current.owner_kind === 'admin';
      if (manual) input.event = { status:'scheduled',...(input.event || {}) };
      if (input.confirmed !== true || !validateEvent(input.event,{ manual }) || !manual && !JSON.parse(current.sources_json).some(source => source.url === input.event.sourceUrl)) fail('validation');
      const verification = { status: 'verified', checkedAt: now, sourceUrl: input.event.sourceUrl || null, actorId: actor.id, method: manual ? 'admin_confirmation' : 'official_source' };
      await env.DB.batch([
        env.DB.prepare('UPDATE ai_candidates SET event_json=?,region=?,verification_json=?,updated_at=? WHERE id=?').bind(JSON.stringify(input.event),input.event.region || null,JSON.stringify(verification),now,input.id),
        env.DB.prepare('UPDATE ai_editorial SET revision=revision+1,updated_at=? WHERE candidate_id=?').bind(now,input.id),
        env.DB.prepare('INSERT INTO ai_candidate_history(candidate_id,previous_status,new_status,actor_id,at,note) VALUES(?,?,?,?,?,?)').bind(input.id,current.editorial_status,current.editorial_status,actor.id,now,'event verified against source')
      ]);
      return json({ id: input.id, verification });
    }
    if (input.action === 'edit') {
      if (actor.kind === 'agent' && !['draft','changes_requested'].includes(current.editorial_status) || actor.kind === 'admin' && current.editorial_status === 'archived') fail('forbidden', 403);
      const manual = current.kind === 'event' && current.owner_kind === 'admin';
      if (manual) normalizeManual(input);
      if (!validContent(input,manual)) fail('validation');
      if (current.kind === 'event' && (!validateEvent(input.event,{ manual }) || !manual && !input.sources.some(source => source.url === input.event.sourceUrl))) fail('validation');
      if (current.kind === 'article' && input.articleFields !== undefined && !validArticleFields(input.articleFields)) fail('validation');
      const update = await env.DB.prepare('UPDATE ai_candidates SET title=?,description=?,body=?,category=?,region=?,sources_json=?,event_json=?,article_fields_json=?,verification_json=?,updated_at=? WHERE id=? AND updated_at=?').bind(input.title,input.description,input.body,input.category || null,current.kind === 'event' ? input.event.region || null : input.region || 'all',JSON.stringify(input.sources),current.kind === 'event' ? JSON.stringify(input.event) : null,current.kind === 'article' ? JSON.stringify(input.articleFields ?? JSON.parse(current.article_fields_json || '{}')) : '{}',JSON.stringify({ status:'needs_review',checkedAt:now,issues:[current.kind === 'event' ? 'Event changed; verify source again' : 'Article changed; verify claims and sources again'] }),now,input.id,current.updated_at).run();
      if (!update.meta?.changes) fail('conflict', 409);
      await env.DB.prepare("UPDATE ai_editorial SET status='pending_review',public_state='hidden',scheduled_at=NULL,approved_by=NULL,approved_at=NULL,revision=revision+1,updated_at=? WHERE candidate_id=?").bind(now,input.id).run();
      await env.DB.prepare('INSERT INTO ai_candidate_history(candidate_id,previous_status,new_status,actor_id,at,note) VALUES(?,?,?,?,?,?)').bind(input.id,current.editorial_status,'pending_review',actor.id,now,'edited').run();
      return json({ id: input.id, revision: current.revision + 1 });
    }
    if (input.action !== 'status' || !canTransition(current.editorial_status,input.status,actor.kind)) fail('conflict', 409);
    if (current.kind === 'event' && ['approved','scheduled'].includes(input.status) && (current.owner_kind !== 'admin' && JSON.parse(current.verification_json || '{}').status !== 'verified' || !validateEvent(JSON.parse(current.event_json || '{}'),{ manual: current.owner_kind === 'admin',allowPast:true }) || (JSON.parse(current.event_json).status || 'scheduled') !== 'scheduled')) fail('eventVerification',409);
    if (current.kind === 'event' && current.owner_kind === 'admin' && input.status === 'scheduled') await env.DB.prepare('UPDATE ai_candidates SET verification_json=?,updated_at=? WHERE id=?').bind(JSON.stringify({status:'verified',checkedAt:now,actorId:actor.id,method:'admin_schedule'}),now,input.id).run();
    let scheduledAt = null;
    if (input.status === 'scheduled') {
      if (input.publishNow === true) scheduledAt = now;
      else {
        try { scheduledAt = brusselsToUtc(input.localTime,input.fold); } catch { fail('invalidSchedule'); }
        if (Date.parse(scheduledAt) <= Date.now()) fail('pastSchedule');
      }
      const occupied = await env.DB.prepare("SELECT count(*) AS n FROM ai_editorial WHERE status='scheduled' AND scheduled_at=? AND candidate_id<>?").bind(scheduledAt,input.id).first();
      if (occupied.n) fail('scheduleConflict', 409);
    }
    const firstApproval = ['approved','scheduled'].includes(input.status) && !current.approved_by;
    const clearApproval = ['draft','pending_review','rejected'].includes(input.status);
    const approvedBy = firstApproval ? actor.id : clearApproval ? null : current.approved_by;
    const approvedAt = firstApproval ? now : clearApproval ? null : current.approved_at;
    const publicState = input.status === 'archived' ? 'hidden' : null;
    const update = await env.DB.prepare('UPDATE ai_editorial SET status=?,scheduled_at=?,approved_by=?,approved_at=?,public_state=COALESCE(?,public_state),updated_at=?,revision=revision+1 WHERE candidate_id=? AND status=? AND revision=?').bind(input.status,scheduledAt,approvedBy,approvedAt,publicState,now,input.id,current.editorial_status,current.revision).run();
    if (!update.meta?.changes) fail('conflict', 409);
    await env.DB.prepare('INSERT INTO ai_candidate_history(candidate_id,previous_status,new_status,actor_id,at,note) VALUES(?,?,?,?,?,?)').bind(input.id,current.editorial_status,input.status,actor.id,now,String(input.note || '').slice(0,1000)).run();
    return json({ id: input.id, status: input.status, scheduledAt });
  } catch (error) { return errorResponse(error); }
}

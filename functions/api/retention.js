import { currentUser } from '../../cloudflare/auth.mjs';
import { errorResponse, fail, json, readJson } from '../../cloudflare/common.mjs';
import { previewRetention } from '../../cloudflare/retention.mjs';

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
const type = value => ['contact','ai_conversation','ad_group'].includes(value);
const reason = value => ['open_case','complaint','dispute','tax','legal_other'].includes(value);
const iso = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
const q = (db, sql, ...values) => db.prepare(sql).bind(...values);
async function adGuardedWrite(db, statement) {
  const version = Number((await db.prepare('SELECT max(version) version FROM ad_write_versions').first()).version || 0);
  const results = await db.batch([q(db,'INSERT INTO ad_write_versions(version) VALUES(?)',version+1),statement]);
  return results[1];
}

export async function onRequest({ request, env }) {
  try {
    if (!env.DB) fail('configuration',503);
    await currentUser(request,env,{admin:true});
    const db = env.DB;
    if (request.method === 'GET') {
      const preview = await previewRetention(db);
      const runs = (await db.prepare('SELECT started_at,finished_at,status,counts_json,error_code FROM retention_runs ORDER BY started_at DESC LIMIT 10').all()).results;
      return json({dryRun:true,...preview,runs});
    }
    if (request.method !== 'POST') fail('method',405);
    const input = await readJson(request,1000);
    const at = new Date().toISOString();
    if (input.action === 'close-contact') {
      if (!uuid(input.id)) fail('validation');
      const done = await q(db,'UPDATE contact_messages SET closed_at=COALESCE(closed_at,?) WHERE id=?',at,input.id).run();
      if (!done.meta?.changes) fail('notFound',404);
      return json({closed:true});
    }
    if (input.action === 'reopen-contact') {
      if (!uuid(input.id)) fail('validation');
      const done = await q(db,'UPDATE contact_messages SET closed_at=NULL WHERE id=?',input.id).run();
      if (!done.meta?.changes) fail('notFound',404);
      return json({reopened:true});
    }
    if (input.action === 'hold') {
      if (!type(input.entityType) || !uuid(input.entityId) || !reason(input.reasonCode) || input.untilAt != null && !iso(input.untilAt)) fail('validation');
      const statement=q(db,"INSERT INTO retention_holds(entity_type,entity_id,reason_code,until_at,released_at) VALUES(?,?,?,?,NULL) ON CONFLICT(entity_type,entity_id) DO UPDATE SET reason_code=excluded.reason_code,until_at=excluded.until_at,released_at=NULL",input.entityType,input.entityId,input.reasonCode,input.untilAt || null);
      if (input.entityType === 'ad_group') await adGuardedWrite(db,statement); else await statement.run();
      return json({held:true});
    }
    if (input.action === 'release-hold') {
      if (!type(input.entityType) || !uuid(input.entityId)) fail('validation');
      const statement=q(db,'UPDATE retention_holds SET released_at=? WHERE entity_type=? AND entity_id=? AND released_at IS NULL',at,input.entityType,input.entityId);
      const done = input.entityType === 'ad_group' ? await adGuardedWrite(db,statement) : await statement.run();
      if (!done.meta?.changes) fail('notFound',404);
      return json({released:true});
    }
    if (input.action === 'close-order') {
      if (!uuid(input.groupId) || input.retainUntil != null && !iso(input.retainUntil)) fail('validation');
      const rows = (await q(db,"SELECT id,data FROM ad_orders WHERE COALESCE(json_extract(data,'$.groupId'),id)=?",input.groupId).all()).results;
      if (!rows.length) fail('notFound',404);
      const orders = rows.map(row=>({id:row.id,data:JSON.parse(row.data)}));
      if (orders.some(item => item.data.status === 'pending' || item.data.status === 'approved' && (!item.data.actualEndAt || item.data.actualEndAt >= at))) fail('openOrder',409);
      if (orders.some(item => item.data.paymentStatus === 'paid') && !input.retainUntil) fail('retentionUntilRequired');
      const version = Number((await db.prepare('SELECT max(version) version FROM ad_write_versions').first()).version || 0);
      await db.batch([q(db,'INSERT INTO ad_write_versions(version) VALUES(?)',version+1),...orders.map(item=>q(db,'UPDATE ad_orders SET data=? WHERE id=?',JSON.stringify({...item.data,retentionClosedAt:at,...(input.retainUntil ? {retentionUntil:input.retainUntil} : {})}),item.id))]);
      return json({closed:true,count:orders.length});
    }
    fail('validation');
  } catch (error) { return errorResponse(error); }
}

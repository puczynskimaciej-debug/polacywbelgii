// D1-only retention engine. This module has no HTTP entry point and never logs row data.
const DAY = 86400000;
const CATEGORIES = ['contact','ai_history','sessions','security_logs','unpaid_orders','paid_orders'];
const terminalJobs = "('done','failed','cancelled')";
const q = (db, sql, ...params) => db.prepare(sql).bind(...params);
const cutoff = (at, days) => new Date(Date.parse(at) - days * DAY).toISOString();
const activeHold = "released_at IS NULL AND (until_at IS NULL OR until_at>?)";
const securityLogWhere = column => `${column}<? AND NOT EXISTS (SELECT 1 FROM security_log_holds h WHERE h.released_at IS NULL AND ${column}>=h.start_at AND (h.end_at IS NULL OR ${column}<=h.end_at))`;
const count = async (db, sql, ...params) => Number((await q(db, sql, ...params).first())?.n || 0);
const ids = async (db, sql, ...params) => (await q(db, sql, ...params).all()).results.map(row => row.id);

export function retentionAllowed(env) {
  return env.RETENTION_ENABLED === '1' && (env.RETENTION_SCOPE === 'test' || env.RETENTION_SCOPE === 'production' && env.RETENTION_PRODUCTION_APPROVED === '1');
}

async function policy(db) {
  const rows = (await db.prepare('SELECT category,period_days,enabled FROM retention_policy').all()).results;
  if (rows.length !== CATEGORIES.length || rows.some(row => !CATEGORIES.includes(row.category) || ![0,1].includes(row.enabled) || row.enabled && (!Number.isInteger(row.period_days) || row.period_days < 0))) throw new Error('invalid_retention_policy');
  return Object.fromEntries(rows.map(row => [row.category, row.enabled ? row.period_days : null]));
}

function contactWhere() {
  return `closed_at IS NOT NULL AND closed_at<? AND NOT EXISTS (SELECT 1 FROM retention_holds h WHERE h.entity_type='contact' AND h.entity_id=contact_messages.id AND ${activeHold})`;
}
function aiEntryWhere() {
  return `created_at<? AND NOT EXISTS (SELECT 1 FROM ai_chat_jobs j WHERE j.conversation_id=ai_chat_entries.conversation_id AND j.status IN ('queued','running')) AND NOT EXISTS (SELECT 1 FROM retention_holds h WHERE h.entity_type='ai_conversation' AND h.entity_id=ai_chat_entries.conversation_id AND ${activeHold})`;
}
function aiJobWhere() {
  return `created_at<? AND status IN ${terminalJobs} AND NOT EXISTS (SELECT 1 FROM retention_holds h WHERE h.entity_type='ai_conversation' AND h.entity_id=ai_chat_jobs.conversation_id AND ${activeHold})`;
}
function aiVersionWhere() {
  return `created_at<? AND NOT EXISTS (SELECT 1 FROM ai_chat_jobs j WHERE j.conversation_id=ai_chat_versions.conversation_id AND j.status IN ('queued','running')) AND NOT EXISTS (SELECT 1 FROM retention_holds h WHERE h.entity_type='ai_conversation' AND h.entity_id=ai_chat_versions.conversation_id AND ${activeHold})`;
}

async function eligibleOrderGroups(db, rules, at) {
  if (rules.unpaid_orders === null && rules.paid_orders === null) return [];
  const keys = (await db.prepare("SELECT DISTINCT COALESCE(json_extract(data,'$.groupId'),id) AS group_id FROM ad_orders WHERE json_extract(data,'$.retentionClosedAt') IS NOT NULL").all()).results.map(row => row.group_id);
  const eligible = [];
  for (const groupId of keys) {
    const rows = (await q(db, "SELECT id, json_extract(data,'$.status') AS status, json_extract(data,'$.paymentStatus') AS payment_status, json_extract(data,'$.retentionClosedAt') AS closed_at, json_extract(data,'$.retentionUntil') AS retain_until, json_extract(data,'$.actualEndAt') AS actual_end FROM ad_orders WHERE COALESCE(json_extract(data,'$.groupId'),id)=?", groupId).all()).results;
    if (!rows.length) continue;
    const paid = rows.every(row => row.payment_status === 'paid');
    const unpaid = rows.every(row => row.payment_status === 'unpaid');
    if (!paid && !unpaid) continue;
    const days = rules[paid ? 'paid_orders' : 'unpaid_orders'];
    if (days === null) continue;
    const limit = cutoff(at, days);
    if (rows.some(row => !row.closed_at || row.closed_at >= limit || row.actual_end && row.actual_end >= at)) continue;
    if (paid && rows.some(row => !row.retain_until || row.retain_until >= at || !['approved','rejected','cancelled'].includes(row.status))) continue;
    if (unpaid && rows.some(row => !['rejected','cancelled'].includes(row.status))) continue;
    if (await count(db, `SELECT count(*) n FROM retention_holds WHERE entity_type='ad_group' AND entity_id=? AND ${activeHold}`, groupId, at)) continue;
    const events = await count(db, 'SELECT count(*) n FROM ad_payment_events WHERE group_id=?', groupId);
    if (unpaid && events) continue;
    eligible.push({ groupId, ids:rows.map(row => row.id), paid });
  }
  return eligible;
}

export async function previewRetention(db, at = new Date().toISOString()) {
  const rules = await policy(db);
  const result = Object.fromEntries(CATEGORIES.map(category => [category,0]));
  if (rules.contact !== null) result.contact = await count(db, `SELECT count(*) n FROM contact_messages WHERE ${contactWhere()}`, cutoff(at,rules.contact),at);
  if (rules.ai_history !== null) {
    const limit = cutoff(at,rules.ai_history);
    result.ai_history = await count(db,`SELECT count(*) n FROM ai_chat_entries WHERE ${aiEntryWhere()}`,limit,at)
      + await count(db,`SELECT count(*) n FROM ai_chat_jobs WHERE ${aiJobWhere()}`,limit,at)
      + await count(db,`SELECT count(*) n FROM ai_chat_versions WHERE ${aiVersionWhere()}`,limit,at);
  }
  if (rules.sessions !== null) result.sessions = await count(db,'SELECT count(*) n FROM cms_sessions WHERE expires_at<?',cutoff(at,rules.sessions));
  if (rules.security_logs !== null) {
    const limit = cutoff(at,rules.security_logs);
    for (const [table,column] of [['cms_login_limits','started_at'],['ad_rate_limits','started_at'],['cms_audit','created_at'],['retention_runs','started_at']]) result.security_logs += await count(db,`SELECT count(*) n FROM ${table} WHERE ${securityLogWhere(`${table}.${column}`)}`,limit);
  }
  for (const group of await eligibleOrderGroups(db,rules,at)) result[group.paid ? 'paid_orders' : 'unpaid_orders'] += group.ids.length;
  return {at,counts:result,policy:rules};
}

async function removeSelected(db, table, selected, guard = '', guardValues = []) {
  if (!selected.length) return 0;
  const placeholders = selected.map(()=>'?').join(',');
  const result = await q(db,`DELETE FROM ${table} WHERE id IN (${placeholders})${guard ? ` AND ${guard}` : ''}`,...selected,...guardValues).run();
  return Number(result.meta?.changes || 0);
}

export async function runRetention(env, { dryRun = false, at = new Date().toISOString() } = {}) {
  if (!env.DB || !retentionAllowed(env)) throw new Error('retention_disabled');
  const db = env.DB;
  if (dryRun) return {dryRun:true,...await previewRetention(db,at)};
  const owner = crypto.randomUUID();
  const lease = new Date(Date.parse(at)+15*60000).toISOString();
  const claim = await q(db,'UPDATE retention_lock SET owner=?,expires_at=? WHERE id=1 AND expires_at<?',owner,lease,at).run();
  if (!claim.meta?.changes) return {status:'already_running'};
  const runId = crypto.randomUUID();
  const totals = Object.fromEntries(CATEGORIES.map(category=>[category,0]));
  try {
    await q(db,"INSERT INTO retention_runs(id,started_at,status,counts_json) VALUES(?,?,'running','{}')",runId,at).run();
    const rules = await policy(db);
    if (rules.contact !== null) {
      const limit = cutoff(at,rules.contact);
      const selected = await ids(db,`SELECT id FROM contact_messages WHERE ${contactWhere()} LIMIT 100`,limit,at);
      totals.contact = await removeSelected(db,'contact_messages',selected,contactWhere(),[limit,at]);
      if (selected.length) await q(db,"DELETE FROM retention_holds WHERE entity_type='contact' AND (released_at IS NOT NULL OR until_at<=?) AND NOT EXISTS (SELECT 1 FROM contact_messages c WHERE c.id=retention_holds.entity_id)",at).run();
    }
    if (rules.ai_history !== null) {
      const limit = cutoff(at,rules.ai_history);
      const entries = await ids(db,`SELECT id FROM ai_chat_entries WHERE ${aiEntryWhere()} LIMIT 100`,limit,at);
      totals.ai_history += await removeSelected(db,'ai_chat_entries',entries,aiEntryWhere(),[limit,at]);
      const versions = await ids(db,`SELECT id FROM ai_chat_versions WHERE ${aiVersionWhere()} LIMIT 100`,limit,at);
      totals.ai_history += await removeSelected(db,'ai_chat_versions',versions,aiVersionWhere(),[limit,at]);
      const jobs = await ids(db,`SELECT id FROM ai_chat_jobs WHERE ${aiJobWhere()} LIMIT 100`,limit,at);
      totals.ai_history += await removeSelected(db,'ai_chat_jobs',jobs,aiJobWhere(),[limit,at]);
      if (entries.length || versions.length || jobs.length) await q(db,"DELETE FROM retention_holds WHERE entity_type='ai_conversation' AND (released_at IS NOT NULL OR until_at<=?) AND NOT EXISTS (SELECT 1 FROM ai_chat_entries e WHERE e.conversation_id=retention_holds.entity_id) AND NOT EXISTS (SELECT 1 FROM ai_chat_jobs j WHERE j.conversation_id=retention_holds.entity_id) AND NOT EXISTS (SELECT 1 FROM ai_chat_versions v WHERE v.conversation_id=retention_holds.entity_id)",at).run();
    }
    if (rules.sessions !== null) {
      const selected = await ids(db,'SELECT token_hash AS id FROM cms_sessions WHERE expires_at<? LIMIT 100',cutoff(at,rules.sessions));
      if (selected.length) totals.sessions = Number((await q(db,`DELETE FROM cms_sessions WHERE token_hash IN (${selected.map(()=>'?').join(',')})`,...selected).run()).meta?.changes || 0);
    }
    if (rules.security_logs !== null) {
      const limit = cutoff(at,rules.security_logs);
      for (const [table,key,column] of [['cms_login_limits','key','started_at'],['ad_rate_limits','key','started_at'],['cms_audit','id','created_at'],['retention_runs','id','started_at']]) {
        const selected = await ids(db,`SELECT ${key} AS id FROM ${table} WHERE ${securityLogWhere(`${table}.${column}`)} LIMIT 100`,limit);
        if (selected.length) totals.security_logs += Number((await q(db,`DELETE FROM ${table} WHERE ${key} IN (${selected.map(()=>'?').join(',')}) AND ${securityLogWhere(`${table}.${column}`)}`,...selected,limit).run()).meta?.changes || 0);
      }
    }
    for (const group of (await eligibleOrderGroups(db,rules,at)).slice(0,20)) {
      const version = Number((await db.prepare('SELECT max(version) version FROM ad_write_versions').first()).version || 0);
      const selected = group.ids, placeholders = selected.map(()=>'?').join(',');
      const output = await db.batch([
        q(db,'INSERT INTO ad_write_versions(version) VALUES(?)',version+1),
        q(db,`DELETE FROM ad_order_history WHERE order_id IN (${placeholders})`,...selected),
        ...(group.paid ? [q(db,'DELETE FROM ad_payment_events WHERE group_id=?',group.groupId)] : []),
        q(db,`DELETE FROM ad_orders WHERE id IN (${placeholders})`,...selected),
        q(db,"DELETE FROM retention_holds WHERE entity_type='ad_group' AND entity_id=? AND (released_at IS NOT NULL OR until_at<=?)",group.groupId,at)
      ]);
      totals[group.paid ? 'paid_orders' : 'unpaid_orders'] += Number(output[group.paid ? 3 : 2]?.meta?.changes || 0);
    }
    await q(db,"UPDATE retention_runs SET finished_at=?,status='completed',counts_json=? WHERE id=?",new Date().toISOString(),JSON.stringify(totals),runId).run();
    return {status:'completed',runId,counts:totals};
  } catch (error) {
    const code = String(error?.message || '').includes('UNIQUE constraint failed: ad_write_versions.version') ? 'concurrent_ad_write' : 'retention_error';
    await q(db,"UPDATE retention_runs SET finished_at=?,status='failed',counts_json=?,error_code=? WHERE id=?",new Date().toISOString(),JSON.stringify(totals),code,runId).run().catch(()=>{});
    throw new Error(code,{cause:error});
  } finally {
    await q(db,"UPDATE retention_lock SET owner='',expires_at='1970-01-01T00:00:00.000Z' WHERE id=1 AND owner=?",owner).run().catch(()=>{});
  }
}

export async function publishDue(db, now = new Date(), onlyIds = null) {
  const timestamp = now.toISOString();
  const due = await db.prepare("SELECT e.candidate_id FROM ai_editorial e JOIN ai_candidates c ON c.id=e.candidate_id WHERE e.status='scheduled' AND e.public_state='hidden' AND e.approved_by IS NOT NULL AND e.approved_at IS NOT NULL AND e.scheduled_at<=? AND json_extract(c.verification_json,'$.status')='verified' AND (c.kind!='event' OR (json_extract(c.event_json,'$.status')='scheduled' AND (e.owner_kind='admin' AND json_extract(c.event_json,'$.date') IS NULL OR COALESCE(json_extract(c.event_json,'$.end'),json_extract(c.event_json,'$.start'),json_extract(c.event_json,'$.date')||'T23:59:59Z')>?)))").bind(timestamp,timestamp).all();
  const published = [];
  for (const item of due.results || []) {
    if (onlyIds && !onlyIds.has(item.candidate_id)) continue;
    const update = await db.prepare("UPDATE ai_editorial SET status='published',public_state='visible',published_at=?,updated_at=?,revision=revision+1 WHERE candidate_id=? AND status='scheduled' AND public_state='hidden' AND approved_by IS NOT NULL AND approved_at IS NOT NULL AND scheduled_at<=? AND EXISTS (SELECT 1 FROM ai_candidates c WHERE c.id=ai_editorial.candidate_id AND json_extract(c.verification_json,'$.status')='verified' AND (c.kind!='event' OR (json_extract(c.event_json,'$.status')='scheduled' AND (ai_editorial.owner_kind='admin' AND json_extract(c.event_json,'$.date') IS NULL OR COALESCE(json_extract(c.event_json,'$.end'),json_extract(c.event_json,'$.start'),json_extract(c.event_json,'$.date')||'T23:59:59Z')>?))))").bind(timestamp,timestamp,item.candidate_id,timestamp,timestamp).run();
    if (update.meta?.changes) {
      await db.prepare('INSERT INTO ai_candidate_history(candidate_id,previous_status,new_status,actor_id,at,note) VALUES(?,?,?,?,?,?)').bind(item.candidate_id,'scheduled','published','publication-worker',timestamp,'D1 public visibility').run();
      published.push(item.candidate_id);
    }
  }
  return { published };
}

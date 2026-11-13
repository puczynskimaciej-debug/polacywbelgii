import { openLocalDb } from '../agent/local-db.mjs';

const db = openLocalDb();
try {
  const now = new Date();
  const rows = db.prepare("SELECT c.id,c.title,c.kind,c.verification_json,e.status,e.public_state,e.scheduled_at,e.approved_at FROM ai_candidates c JOIN ai_editorial e ON e.candidate_id=c.id WHERE e.status='scheduled' AND e.scheduled_at<=? ORDER BY e.scheduled_at").all(now.toISOString());
  for (const row of rows) {
    const verification = JSON.parse(row.verification_json || '{}');
    const reasons = [!row.approved_at && 'brak akceptacji',verification.status !== 'verified' && 'dane wymagają weryfikacji',row.public_state !== 'hidden' && 'niespójny stan publiczny'].filter(Boolean);
    console.log(JSON.stringify({id:row.id,title:row.title,kind:row.kind,status:row.status,scheduledAt:row.scheduled_at,overdue:true,publisher:'local-manual',blockers:reasons}));
  }
  if (!rows.length) console.log('Brak zaległych zaplanowanych materiałów.');
} finally { db.close(); }

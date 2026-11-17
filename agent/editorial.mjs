export const editorialStatuses = new Set(['draft', 'pending_review', 'changes_requested', 'approved', 'scheduled', 'published', 'rejected', 'archived']);
export const defaultEditorialConfig = { dailyTarget: 2, dailyMax: 3, slots: ['08:00', '17:00', '12:00'], bufferDays: 7, maxPending: 21 };
const transitions = {
  draft: { agent: ['pending_review'], admin: ['pending_review', 'rejected'] },
  pending_review: { agent: [], admin: ['changes_requested', 'approved', 'scheduled', 'rejected'] },
  changes_requested: { agent: ['pending_review'], admin: ['rejected', 'draft'] },
  approved: { agent: [], admin: ['scheduled', 'pending_review', 'rejected'] },
  scheduled: { agent: [], admin: ['draft', 'approved', 'scheduled', 'pending_review', 'rejected'] },
  published: { agent: [], admin: ['archived'] },
  rejected: { agent: [], admin: ['draft'] },
  archived: { agent: [], admin: [] }
};
export function canTransition(from, to, actor) { return Boolean(transitions[from]?.[actor]?.includes(to)); }

function brusselsParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
export function brusselsToUtc(local, fold) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local || '')) throw new Error('Invalid local datetime');
  const value = Date.parse(`${local}:00Z`);
  if (!Number.isFinite(value)) throw new Error('Invalid local datetime');
  const matches = [1, 2].map(hours => new Date(value - hours * 3600000)).filter(date => brusselsParts(date) === local);
  if (!matches.length) throw new Error('Nonexistent Brussels local time');
  if (matches.length === 2 && !['earlier', 'later'].includes(fold)) throw new Error('Ambiguous Brussels local time');
  return matches.length === 2 ? (fold === 'earlier' ? matches[1] : matches[0]).toISOString() : matches[0].toISOString();
}
export const utcToBrussels = iso => brusselsParts(new Date(iso));

export function validateEditorialConfig(input) {
  if (!input || !Number.isInteger(input.dailyTarget) || !Number.isInteger(input.dailyMax) || input.dailyTarget < 1 || input.dailyTarget > input.dailyMax || input.dailyMax > 3 || !Number.isInteger(input.bufferDays) || input.bufferDays < 1 || input.bufferDays > 30 || !Number.isInteger(input.maxPending) || input.maxPending < 1 || input.maxPending > 100 || !Array.isArray(input.slots) || input.slots.length < input.dailyMax || input.slots.length > 6 || new Set(input.slots).size !== input.slots.length || input.slots.some(slot => !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot))) throw new Error('Invalid editorial configuration');
  return { dailyTarget: input.dailyTarget, dailyMax: input.dailyMax, bufferDays: input.bufferDays, maxPending: input.maxPending, slots: input.slots };
}

export function proposeSlot(existing, config = defaultEditorialConfig, now = new Date(), eventEnd = null) {
  validateEditorialConfig(config);
  const start = utcToBrussels(now.toISOString()).slice(0, 10);
  const midnight = Date.parse(`${start}T00:00:00Z`);
  for (let day = 0; day < config.bufferDays; day++) {
    const date = new Date(midnight + day * 86400000).toISOString().slice(0, 10);
    const used = existing.filter(item => ['scheduled', 'published', 'pending_review', 'draft'].includes(item.status) && (item.scheduledAt || item.proposedPublishAt) && utcToBrussels(item.scheduledAt || item.proposedPublishAt).startsWith(date));
    if (used.length >= config.dailyTarget) continue;
    for (const slot of config.slots.slice(0, config.dailyTarget)) {
      const utc = brusselsToUtc(`${date}T${slot}`);
      if (new Date(utc) <= now || eventEnd && new Date(utc) >= new Date(eventEnd) || used.some(item => (item.scheduledAt || item.proposedPublishAt) === utc)) continue;
      return utc;
    }
  }
  return null;
}

export function dueCandidates(rows, now = new Date()) {
  return rows.filter(row => row.status === 'scheduled' && row.approvedBy && row.approvedAt && row.scheduledAt && new Date(row.scheduledAt) <= now && row.publicState === 'hidden');
}

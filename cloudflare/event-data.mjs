const validUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; } };
const validIso = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
const validDate = value => typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0,10) === value;
export function validateEvent(value, { allowPast = false, manual = false } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (manual ? value.start && !validIso(value.start) || value.end && !validIso(value.end) || value.date && !validDate(value.date) || value.endDate && !validDate(value.endDate) : !validIso(value.start) || value.end && !validIso(value.end)) return false;
  if (manual && (value.endDate && !value.date && !value.start || value.endDate && value.date && value.endDate < value.date)) return false;
  if (value.end && Date.parse(value.end) < Date.parse(value.start)) return false;
  if (!allowPast && !manual && (value.end || value.start) && Date.parse(value.end || value.start) <= Date.now()) return false;
  if (manual ? value.timezone !== undefined && value.timezone !== 'Europe/Brussels' : value.timezone !== 'Europe/Brussels') return false;
  if (!(manual ? [undefined,null,'','brussels','flanders','wallonia'].includes(value.region) : ['brussels','flanders','wallonia'].includes(value.region))) return false;
  if (!['scheduled','cancelled','postponed'].includes(value.status || 'scheduled')) return false;
  for (const key of ['organizer','category']) if (manual && value[key] === undefined) continue; else if (typeof value[key] !== 'string' || !manual && !value[key].trim() || value[key].length > 200) return false;
  for (const key of ['city','venue']) if (manual ? value[key] !== undefined && (typeof value[key] !== 'string' || value[key].length > 200) : typeof value[key] !== 'string' || !value[key].trim() || value[key].length > 200) return false;
  if (manual ? value.sourceUrl && !validUrl(value.sourceUrl) : !validUrl(value.sourceUrl)) return false;
  if (value.price !== undefined && value.price !== null && (typeof value.price !== 'number' || !Number.isFinite(value.price) || value.price < 0)) return false;
  if (value.priceCurrency !== undefined && value.priceCurrency !== 'EUR') return false;
  if (value.familyFriendly !== undefined && typeof value.familyFriendly !== 'boolean') return false;
  if (value.address !== undefined && (typeof value.address !== 'string' || value.address.length > 240)) return false;
  if (value.image !== undefined && (typeof value.image !== 'string' || !/^\/images\/uploads\/[A-Za-z0-9._-]+$/.test(value.image) || value.imageRightsConfirmed !== true)) return false;
  return true;
}
export function eventPublic(value, manual = false) {
  return validateEvent(value, { allowPast: true, manual }) && (value.status || 'scheduled') === 'scheduled';
}

const languages = require('../src/_data/languages.json');
const DAY = 86400000;
class AdError extends Error {
  constructor(code, status = 400, details) { super(code); this.code = code; this.status = status; this.details = details; }
}
const fail = (code, status, details) => { throw new AdError(code, status, details); };
function today(now = new Date()) { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(now); }
function dates(start, end) {
  const valid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!valid(start) || !valid(end)) fail('dates');
  const count = (Date.parse(end) - Date.parse(start)) / DAY + 1;
  if (count < 1 || count > 366) fail('dates');
  return Array.from({ length: count }, (_, i) => new Date(Date.parse(start) + i * DAY).toISOString().slice(0, 10));
}
function defaults() { return { types: { TOP: { capacity: 5 }, STANDARD: { capacity: 30 }, PREMIUM: { capacity: 2 } }, markets: Object.fromEntries(Object.keys(languages).map(language => [language, { enabled: false, currency: 'EUR', prices: { TOP: 0, STANDARD: 0, PREMIUM: 0 } }])) , capacityOverrides: {} }; }
function normalizeSettings(value) {
  const base = defaults();
  return { types: base.types, markets: Object.fromEntries(Object.keys(languages).map(language => [language, { ...base.markets[language], ...value?.markets?.[language], prices: { ...base.markets[language].prices, ...value?.markets?.[language]?.prices } }])), capacityOverrides: value?.capacityOverrides && typeof value.capacityOverrides === 'object' ? value.capacityOverrides : {} };
}
const capacityKey = (language, type, date) => `${language}:${type}:${date}`;
function capacityForDate(settings, language, type, date) {
  const base = settings.types[type].capacity;
  const extra = settings.capacityOverrides?.[capacityKey(language, type, date)];
  return { base, reserve: extra?.reserve || 0, released: extra?.released || 0, capacity: base + (extra?.released || 0) };
}
function belgianMidnight(date) {
  dates(date, date);
  const utc = Date.parse(`${date}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', timeZoneName: 'shortOffset' }).formatToParts(new Date(utc));
  const offset = parts.find(part => part.type === 'timeZoneName')?.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!offset) fail('dates');
  const minutes = (Number(offset[2]) * 60 + Number(offset[3] || 0)) * (offset[1] === '+' ? 1 : -1);
  return new Date(utc - minutes * 60000).toISOString();
}
function windowFor(startDate, days, now = new Date()) {
  if (!Number.isSafeInteger(days) || days < 1 || days > 90 || startDate < today(now)) fail('dates');
  const startAt = startDate === today(now) ? now.toISOString() : belgianMidnight(startDate);
  return { startAt, endAt: new Date(Date.parse(startAt) + days * DAY).toISOString(), startsToday: startDate === today(now) };
}
function selectedDates(values, now = new Date()) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 90) fail('dates');
  const max = new Date(Date.parse(today(now)) + 730 * DAY).toISOString().slice(0, 10);
  for (let i = 0; i < values.length; i++) {
    dates(values[i], values[i]);
    if (values[i] < today(now) || values[i] > max || i && values[i] <= values[i - 1]) fail('dates');
  }
  return values;
}
function periodForDate(date, now = new Date()) {
  selectedDates([date], now);
  const window = windowFor(date, 1, now);
  return { date, plannedStartAt: window.startsToday ? null : window.startAt, plannedEndAt: window.startsToday ? null : window.endAt, reservationStartAt: window.startAt, reservationEndAt: window.endAt, actualStartAt: null, actualEndAt: null };
}
function periodWindow(period) {
  if (period.actualStartAt && period.actualEndAt) return { startAt: period.actualStartAt, endAt: period.actualEndAt };
  if (period.plannedStartAt && period.plannedEndAt) return { startAt: period.plannedStartAt, endAt: period.plannedEndAt };
  return { startAt: period.reservationStartAt, endAt: period.reservationEndAt };
}
function orderWindow(order) {
  if (isShowcase(order)) return { startAt: belgianMidnight(order.startDate), endAt: '9999-12-31T00:00:00.000Z' };
  if (order.actualStartAt && order.actualEndAt) return { startAt: order.actualStartAt, endAt: order.actualEndAt };
  if (order.plannedStartAt && order.plannedEndAt) return { startAt: order.plannedStartAt, endAt: order.plannedEndAt };
  if (order.reservationStartAt && order.reservationEndAt) return { startAt: order.reservationStartAt, endAt: order.reservationEndAt };
  return { startAt: belgianMidnight(order.startDate), endAt: belgianMidnight(new Date(Date.parse(order.endDate) + DAY).toISOString().slice(0, 10)) };
}
function orderWindows(order) { return Array.isArray(order.periods) && order.periods.length ? order.periods.map(periodWindow) : [orderWindow(order)]; }
function mergedWindows(windows) {
  const sorted = windows.filter(w => w.startAt && w.endAt).sort((a, b) => a.startAt.localeCompare(b.startAt));
  const merged = [];
  for (const window of sorted) {
    const last = merged.at(-1);
    if (last && window.startAt <= last.endAt) { if (window.endAt > last.endAt) last.endAt = window.endAt; }
    else merged.push({ ...window });
  }
  return merged;
}
function availabilityWindow(orders, settings, language, type, startAt, endAt, excludeIds = [], now = new Date()) {
  marketFor(settings, language, type);
  const localDate = value => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(new Date(value));
  const datesTouched = dates(localDate(startAt), localDate(new Date(Date.parse(endAt) - 1)));
  const capacity = Math.min(...datesTouched.map(date => capacityForDate(settings, language, type, date).capacity));
  const excluded = new Set(Array.isArray(excludeIds) ? excludeIds : [excludeIds]);
  const events = [];
  for (const o of orders) {
    if (excluded.has(o.id) || o.language !== language || o.type !== type || !['pending', 'approved', 'changes_requested', 'refund_pending'].includes(o.status) || o.source === 'public' && !['paid', 'refund_pending'].includes(o.paymentStatus) && o.reservationExpiresAt && o.reservationExpiresAt <= now.toISOString()) continue;
    for (const w of mergedWindows(orderWindows(o))) {
      if (w.startAt >= endAt || startAt >= w.endAt) continue;
      events.push([w.startAt < startAt ? startAt : w.startAt, 1], [w.endAt > endAt ? endAt : w.endAt, -1]);
    }
  }
  events.sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]);
  let concurrent = 0, used = 0;
  for (const [, delta] of events) { concurrent += delta; used = Math.max(used, concurrent); }
  return { used, capacity, remaining: Math.max(0, capacity - used) };
}
function validateSettings(value) {
  const result = defaults();
  for (const language of Object.keys(languages)) {
    const market = value?.markets?.[language];
    if (!market || typeof market.enabled !== 'boolean') fail('settings');
    for (const type of ['TOP', 'STANDARD', 'PREMIUM']) if (!Number.isSafeInteger(market.prices?.[type]) || market.prices[type] < 0 || market.prices[type] > 1000000) fail('settings');
    if (market.enabled && ['TOP', 'STANDARD'].some(type => market.prices[type] <= 0)) fail('settings');
    result.markets[language] = { enabled: market.enabled, currency: 'EUR', prices: { TOP: market.prices.TOP, STANDARD: market.prices.STANDARD, PREMIUM: market.prices.PREMIUM } };
  }
  if (value?.capacityOverrides && (typeof value.capacityOverrides !== 'object' || Array.isArray(value.capacityOverrides) || Object.keys(value.capacityOverrides).length > 10000)) fail('settings');
  for (const [key, entry] of Object.entries(value?.capacityOverrides || {})) {
    const [language, type, date] = key.split(':');
    if (!Object.hasOwn(languages, language) || !Object.hasOwn(result.types, type) || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || typeof entry !== 'object' || !Number.isSafeInteger(entry.reserve) || entry.reserve < 0 || entry.reserve > 100 || !Number.isSafeInteger(entry.released) || entry.released < 0 || entry.released > entry.reserve) fail('settings');
    dates(date, date);
    result.capacityOverrides[key] = { reserve: entry.reserve, released: entry.released };
  }
  return result;
}
function marketFor(settings, language, type) {
  if (!Object.hasOwn(languages, language) || !Object.hasOwn(settings.markets, language) || !Object.hasOwn(settings.types, type)) fail('market');
  return settings.markets[language];
}
function isShowcase(order) { return order.demoSet === 'showcase-2026-09-29' && order.source === 'manual' && order.paymentStatus === 'not_required'; }
function status(order, day = today(), now = new Date()) {
  if (order.source === 'public') {
    if (order.status === 'paused') return 'paused';
    if (order.status === 'changes_requested') return 'changes_requested';
    if (order.paymentStatus === 'refund_pending') return 'refund_pending';
    if (order.paymentStatus === 'refunded') return 'refunded';
    if (order.paymentStatus === 'partial_refund') return 'refund_review';
    if (['cancelled', 'rejected'].includes(order.status)) return order.status;
    if (['failed', 'paid_late'].includes(order.paymentStatus)) return 'payment_failed';
    if (order.paymentStatus !== 'paid') return 'pending_payment';
    if (order.status !== 'approved') return (order.periods || [order]).some(period => period.plannedStartAt && period.plannedStartAt <= now.toISOString()) ? 'needs_reschedule' : 'pending_approval';
  }
  if (order.status !== 'approved') return order.status;
  if (isShowcase(order)) return day < order.startDate ? 'scheduled' : 'active';
  if (Array.isArray(order.periods) && order.periods.length) {
    const windows = orderWindows(order);
    if (windows.some(window => window.startAt <= now.toISOString() && now.toISOString() < window.endAt)) return 'active';
    if (windows.some(window => window.startAt > now.toISOString())) return 'scheduled';
    return order.source === 'public' ? 'completed' : 'ended';
  }
  if (order.actualStartAt && order.actualEndAt) return now.toISOString() < order.actualStartAt ? 'scheduled' : now.toISOString() >= order.actualEndAt ? (order.source === 'public' ? 'completed' : 'ended') : 'active';
  return day < order.startDate ? 'scheduled' : day > order.endDate ? (order.source === 'public' ? 'completed' : 'ended') : 'active';
}
function availability(orders, settings, language, type, start, end, excludeId) {
  marketFor(settings, language, type);
  return dates(start, end).map(date => {
    const capacity = capacityForDate(settings, language, type, date).capacity;
    const used = orders.filter(o => o.id !== excludeId && o.language === language && o.type === type && ['pending', 'approved', 'changes_requested', 'refund_pending'].includes(o.status) && !(o.source === 'public' && !['paid', 'refund_pending'].includes(o.paymentStatus) && o.reservationExpiresAt && o.reservationExpiresAt <= new Date().toISOString()) && o.startDate <= date && (isShowcase(o) || o.endDate >= date)).length;
    return { date, used, capacity, remaining: Math.max(0, capacity - used) };
  });
}
function quote(settings, input, day = today(), manual = false) {
  const market = marketFor(settings, input.language, input.type);
  if (!manual && (!market.enabled || !market.prices[input.type])) fail('disabled', 409);
  const range = dates(input.startDate, input.endDate);
  if (input.startDate < day || input.endDate > new Date(Date.parse(day) + DAY * 730).toISOString().slice(0, 10)) fail('dates');
  const dailyPrice = input.type === 'PREMIUM' && manual ? 0 : market.prices[input.type];
  return { days: range.length, dailyPrice, totalPrice: dailyPrice * range.length, currency: market.currency };
}
function quoteSelected(settings, input, now = new Date(), manual = false) {
  const market = marketFor(settings, input.language, input.type);
  const chosen = selectedDates(input.dates, now);
  if (!manual && (!market.enabled || !market.prices[input.type])) fail('disabled', 409);
  const dailyPrice = input.type === 'PREMIUM' && manual ? 0 : market.prices[input.type];
  return { days: chosen.length, dailyPrice, totalPrice: dailyPrice * chosen.length, currency: market.currency };
}
function text(value, max, required = true) {
  if (typeof value !== 'string' || Array.from(value.trim()).length > max || (required && !value.trim())) fail('validation');
  return value.trim();
}
const creativeLimits = Object.freeze({ PREMIUM: { title: 70, description: 200 }, TOP: { title: 60, description: 160 }, STANDARD: { title: 70, description: 500 } });
function publicContacts(input) {
  const company = text(input.company || '', 120, false);
  const contact = text(input.contact || '', 160, false);
  const publicPhone = text(input.publicPhone || '', 40, false);
  const publicEmail = text(input.publicEmail || '', 254, false);
  const url = text(input.url || '', 2048, false);
  if (publicPhone && (!/^\+?[0-9][0-9 ().-]*$/.test(publicPhone) || (publicPhone.match(/\d/g) || []).length < 6)) fail('validation');
  if (publicEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publicEmail)) fail('validation');
  if (url) { try { const parsed = new URL(url); if (!['https:', 'http:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) fail('validation'); } catch { fail('validation'); } }
  return { company, contact, publicPhone, publicEmail, url };
}
function creative(input) {
  const publicData = publicContacts(input);
  if (input.kind === 'text') {
    const limits = creativeLimits[input.type || 'STANDARD'] || creativeLimits.STANDARD;
    const description = text(input.description, limits.description);
    const title = text(input.title || Array.from(description).slice(0,limits.title).join(''), limits.title);
    const email = text(input.email, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('validation');
    return { kind: 'text', description, ...publicData, email, title, image: '', phone: '', customerName: text(input.customerName || '', 120, false) };
  }
  const limits = creativeLimits[input.type] || creativeLimits.TOP;
  const result = { kind: 'image', ...publicData, title: text(input.title, limits.title), description: text(input.description, limits.description), email: text(input.email, 254), phone: text(input.phone || '', 40, false), customerName: text(input.customerName || '', 120, false) };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) fail('validation');
  const image = input.image;
  const match = typeof image === 'string' && image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!image) { result.image = ''; result.imageMobile = ''; return result; }
  if (!match || image.length > 700000) fail('image');
  const bytes = Buffer.from(match[2], 'base64');
  const signature = match[1] === 'png' ? bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' : match[1] === 'jpeg' ? bytes.subarray(0, 3).toString('hex') === 'ffd8ff' : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!signature || bytes.length > 512000) fail('image');
  result.image = image;
  if (input.imageMobile) {
    const mobile = input.imageMobile;
    const mobileMatch = typeof mobile === 'string' && mobile.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!mobileMatch || mobile.length > 700000) fail('image');
    const mobileBytes = Buffer.from(mobileMatch[2], 'base64');
    const mobileSignature = mobileMatch[1] === 'png' ? mobileBytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' : mobileMatch[1] === 'jpeg' ? mobileBytes.subarray(0, 3).toString('hex') === 'ffd8ff' : mobileBytes.toString('ascii', 0, 4) === 'RIFF' && mobileBytes.toString('ascii', 8, 12) === 'WEBP';
    if (!mobileSignature || mobileBytes.length > 512000) fail('image');
    result.imageMobile = mobile;
  }
  return result;
}
function validateImageDimensions(data, width, height) {
  if (typeof data !== 'string') fail('image');
  const match = data.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) fail('image');
  const bytes = Buffer.from(match[2], 'base64');
  let dimensions;
  if (match[1] === 'png' && bytes.length >= 24) dimensions = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  if (match[1] === 'jpeg') {
    for (let offset = 2; offset + 9 < bytes.length;) {
      if (bytes[offset] !== 0xff || offset + 4 > bytes.length) break;
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) { offset += 2; continue; }
      const size = bytes.readUInt16BE(offset + 2);
      if (size < 2 || offset + 2 + size > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) { dimensions = [bytes.readUInt16BE(offset + 7), bytes.readUInt16BE(offset + 5)]; break; }
      offset += size + 2;
    }
  }
  if (match[1] === 'webp' && bytes.length >= 30) {
    const format = bytes.toString('ascii', 12, 16);
    if (format === 'VP8X') dimensions = [1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3)];
    if (format === 'VP8L' && bytes[20] === 0x2f) dimensions = [1 + (((bytes[22] & 0x3f) << 8) | bytes[21]), 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | (bytes[22] >> 6))];
    if (format === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) dimensions = [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  }
  if (!dimensions || dimensions[0] !== width || dimensions[1] !== height) fail('image');
}
function publicAd(order) { return { ...Object.fromEntries(['id', 'kind', 'contact', 'company', 'publicPhone', 'publicEmail', 'title', 'description', 'image', 'url', 'type', 'language', 'region', 'actualStartAt', 'actualEndAt'].map(key => [key, order[key]])), ...(Array.isArray(order.periods) ? { periods: order.periods.filter(period => period.actualStartAt && period.actualEndAt).map(period => ({ date: period.date, startAt: period.actualStartAt, endAt: period.actualEndAt })) } : {}) }; }
module.exports = { AdError, fail, today, dates, selectedDates, periodForDate, periodWindow, orderWindows, mergedWindows, capacityForDate, capacityKey, defaults, normalizeSettings, validateSettings, marketFor, isShowcase, status, availability, availabilityWindow, belgianMidnight, windowFor, orderWindow, quote, quoteSelected, creative, creativeLimits, validateImageDimensions, publicAd, languages };

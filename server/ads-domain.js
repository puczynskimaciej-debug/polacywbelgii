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
function defaults() { return { types: { TOP: { capacity: 2 }, STANDARD: { capacity: 10 }, PREMIUM: { capacity: 1 } }, markets: Object.fromEntries(Object.keys(languages).map(language => [language, { enabled: false, currency: 'EUR', prices: { TOP: 0, STANDARD: 0, PREMIUM: 0 } }])) }; }
function normalizeSettings(value) {
  const base = defaults();
  return { types: { ...base.types, ...value?.types }, markets: Object.fromEntries(Object.keys(languages).map(language => [language, { ...base.markets[language], ...value?.markets?.[language], prices: { ...base.markets[language].prices, ...value?.markets?.[language]?.prices } }])) };
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
  return result;
}
function marketFor(settings, language, type) {
  if (!Object.hasOwn(languages, language) || !Object.hasOwn(settings.markets, language) || !Object.hasOwn(settings.types, type)) fail('market');
  return settings.markets[language];
}
function isShowcase(order) { return order.demoSet === 'showcase-2026-09-29' && order.source === 'manual' && order.paymentStatus === 'not_required'; }
function status(order, day = today()) {
  if (order.status !== 'approved') return order.status;
  if (isShowcase(order)) return day < order.startDate ? 'scheduled' : 'active';
  return day < order.startDate ? 'scheduled' : day > order.endDate ? 'ended' : 'active';
}
function availability(orders, settings, language, type, start, end, excludeId) {
  marketFor(settings, language, type);
  const capacity = settings.types[type].capacity;
  return dates(start, end).map(date => {
    const used = orders.filter(o => o.id !== excludeId && o.language === language && o.type === type && ['pending', 'approved'].includes(o.status) && o.startDate <= date && (isShowcase(o) || o.endDate >= date)).length;
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
function text(value, max, required = true) {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) fail('validation');
  return value.trim();
}
function creative(input) {
  if (input.kind === 'text') {
    const description = text(input.description, 1000);
    const email = text(input.email, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('validation');
    return { kind: 'text', description, contact: text(input.contact, 160), email, company: '', title: description.slice(0, 70), image: '', url: '', phone: '', customerName: '' };
  }
  const result = { kind: 'image', company: text(input.company, 120), title: text(input.title, 100), description: text(input.description, 1000), url: text(input.url, 2048), email: text(input.email, 254), phone: text(input.phone || '', 40, false), customerName: text(input.customerName, 120) };
  try { const url = new URL(result.url); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) fail('validation'); } catch { fail('validation'); }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) fail('validation');
  const image = input.image;
  const match = typeof image === 'string' && image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
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
function publicAd(order) { return Object.fromEntries(['id', 'kind', 'contact', 'company', 'title', 'description', 'image', 'url', 'type', 'language', 'region'].map(key => [key, order[key]])); }
module.exports = { AdError, fail, today, dates, defaults, normalizeSettings, validateSettings, marketFor, isShowcase, status, availability, quote, creative, validateImageDimensions, publicAd };

const { createHash, randomUUID } = require('node:crypto');
const domain = require('./ads-domain');
const store = require('./ads-store');
const languages = require('../src/_data/languages.json');
async function reserve(body, ip) {
  if (body.website || body.consent !== true || !/^[0-9a-f-]{36}$/i.test(body.requestId || '')) domain.fail('validation');
  if (!Array.isArray(body.dates) || !body.dates.length || body.dates.length > 90 || new Set(body.dates).size !== body.dates.length) domain.fail('dates');
  const range = domain.dates(body.dates[0], body.dates.at(-1));
  if (range.length !== body.dates.length || range.some((date, index) => date !== body.dates[index])) domain.fail('dates');
  if (!['text', 'image'].includes(body.kind)) domain.fail('validation');
  if ((body.type === 'STANDARD' && body.kind !== 'text') || (body.type === 'PREMIUM' && body.kind !== 'image')) domain.fail('validation');
  if (!Array.isArray(body.variants) || !body.variants.length || body.variants.length > Object.keys(languages).length || body.variants.some(v => !v || typeof v !== 'object') || new Set(body.variants.map(v => v.language)).size !== body.variants.length) domain.fail('market');
  const fingerprint = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  return store.transaction(async (client, settings) => {
    settings.data = domain.normalizeSettings(settings.data);
    const all = await store.orders(client, false);
    const existing = all.filter(o => o.batchRequestId === body.requestId);
    if (existing.length) {
      if (existing[0].fingerprint !== fingerprint) domain.fail('conflict', 409);
      return { id: existing[0].groupId, totalPrice: existing.reduce((sum, o) => sum + o.totalPrice, 0), currency: 'EUR', status: 'pending' };
    }
    const key = createHash('sha256').update(ip || 'unknown').digest('hex');
    const { rows: [limit] } = await client.query(`INSERT INTO ad_rate_limits(key,attempts) VALUES($1,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN ad_rate_limits.started_at<now()-interval '1 hour' THEN 1 ELSE ad_rate_limits.attempts+1 END,started_at=CASE WHEN ad_rate_limits.started_at<now()-interval '1 hour' THEN now() ELSE ad_rate_limits.started_at END RETURNING attempts`, [key]);
    if (limit.attempts > 10) domain.fail('rateLimit', 429);
    const groupId = randomUUID(), planned = [];
    for (const variant of body.variants) {
      if (!Object.hasOwn(languages, variant.language)) domain.fail('market');
      const content = body.kind === 'text'
        ? domain.creative({ kind: 'text', description: variant.text, contact: body.contact, email: body.email })
        : domain.creative({ kind: 'image', company: body.company, title: variant.title, description: variant.description, url: body.url, email: body.email, customerName: body.customerName, image: body.image, imageMobile: body.type === 'PREMIUM' ? body.imageMobile : '', phone: body.phone || '' });
      if (body.kind === 'image') {
        domain.validateImageDimensions(content.image, 1200, body.type === 'PREMIUM' ? 200 : 720);
        if (body.type === 'PREMIUM') domain.validateImageDimensions(content.imageMobile, 660, 300);
      }
      const input = { language: variant.language, type: body.type, startDate: range[0], endDate: range.at(-1) };
      const price = domain.quote(settings.data, input);
      const blocked = domain.availability(all, settings.data, input.language, input.type, input.startDate, input.endDate).filter(day => !day.remaining);
      if (blocked.length) domain.fail('full', 409, blocked);
      planned.push({ ...content, kind: body.kind, ...input, ...price, id: randomUUID(), groupId, batchRequestId: body.requestId, fingerprint, region: 'all', status: 'pending', version: 1, source: 'public', paymentStatus: 'unpaid', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    const totalPrice = planned.reduce((sum, order) => sum + order.totalPrice, 0);
    if (body.expectedTotalPrice !== totalPrice) domain.fail('priceChanged', 409);
    for (const order of planned) await client.query('INSERT INTO ad_orders(id,data) VALUES($1,$2)', [order.id, order]);
    return { id: groupId, totalPrice, currency: 'EUR', status: 'pending' };
  });
}
module.exports = { reserve };

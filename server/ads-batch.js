const { createHash, randomUUID } = require('node:crypto');
const domain = require('./ads-domain');
const store = require('./ads-store');
const languages = require('../src/_data/languages.json');
async function reserve(body, ip) {
  if (body.website || body.consent !== true || !/^[0-9a-f-]{36}$/i.test(body.requestId || '')) domain.fail('validation');
  if (!Array.isArray(body.dates) || !body.dates.length || body.dates.length > 90 || new Set(body.dates).size !== body.dates.length) domain.fail('dates');
  if (!Array.isArray(body.variants) || !body.variants.length || body.variants.length > 3 || body.variants.some(v => !v || typeof v !== 'object') || new Set(body.variants.map(v => v.language)).size !== body.variants.length) domain.fail('market');
  const fingerprint = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  return store.transaction(async (client, settings) => {
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
      const content = domain.creative({ kind: 'text', description: variant.text, contact: body.contact, email: body.email });
      for (const date of body.dates) {
        const input = { language: variant.language, type: body.type, startDate: date, endDate: date };
        const price = domain.quote(settings.data, input);
        const blocked = domain.availability(all, settings.data, input.language, input.type, date, date).filter(day => !day.remaining);
        if (blocked.length) domain.fail('full', 409, blocked);
        planned.push({ ...content, ...input, ...price, id: randomUUID(), groupId, batchRequestId: body.requestId, fingerprint, status: 'pending', version: 1, source: 'public', paymentStatus: 'unpaid', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      }
    }
    const totalPrice = planned.reduce((sum, order) => sum + order.totalPrice, 0);
    if (body.expectedTotalPrice !== totalPrice) domain.fail('priceChanged', 409);
    for (const order of planned) await client.query('INSERT INTO ad_orders(id,data) VALUES($1,$2)', [order.id, order]);
    return { id: groupId, totalPrice, currency: 'EUR', status: 'pending' };
  });
}
module.exports = { reserve };

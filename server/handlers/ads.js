const { randomUUID, createHash } = require('node:crypto');
const domain = require('../ads-domain');
const store = require('../ads-store');
const languages = require('../../src/_data/languages.json');
const { currentUser } = require('../cms-auth');
const { HttpError } = require('../http');

async function authorize(event) {
  await currentUser(event);
}
function reply(statusCode, payload) { return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, body: JSON.stringify(payload) }; }
exports.handler = async event => {
  try {
    const method = event.httpMethod;
    const query = event.queryStringParameters || {};
    const action = query.action || 'public';
    const admin = action.startsWith('admin');
    if (admin) await authorize(event);
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) return reply(405, { error: 'method' });
    let body = {};
    if (method !== 'GET') {
      if (!(event.headers['content-type'] || '').startsWith('application/json')) domain.fail('validation', 415);
      if (Buffer.byteLength(event.body || '') > 720000) domain.fail('image', 413);
      try { body = JSON.parse(event.body || '{}'); } catch { domain.fail('validation'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) domain.fail('validation');
    }
    if (method === 'GET') {
      if (action === 'image' || action === 'admin-detail') {
        const order = await store.order(query.id);
        if (!order || (action === 'image' && (domain.status(order) !== 'active' || order.kind === 'text'))) domain.fail('notFound', 404);
        if (action === 'admin-detail') return reply(200, { ...order, effectiveStatus: domain.status(order) });
        const [prefix, bytes] = order.image.split(',');
        return { statusCode: 200, isBase64Encoded: true, headers: { 'Content-Type': prefix.slice(5).split(';')[0], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, body: bytes };
      }
      const settings = await store.settings();
      // Newly registered site languages are disabled until the editor sets prices.
      settings.data.markets = { ...domain.defaults().markets, ...settings.data.markets };
      if (action === 'config' || action === 'admin-settings') return reply(200, { ...settings, languages, today: domain.today() });
      if (action === 'public') {
        if (!Object.hasOwn(languages, query.language)) domain.fail('market');
        return reply(200, { ads: (await store.orders(undefined, false)).filter(order => order.language === query.language && domain.status(order) === 'active').map(order => ({ ...domain.publicAd(order), image: order.kind === 'text' ? '' : `/.netlify/functions/ads?action=image&id=${order.id}` })) });
      }
      if (action === 'availability') {
        const price = domain.quote(settings.data, query, domain.today(), true);
        const days = domain.availability(await store.orders(undefined, false), settings.data, query.language, query.type, query.startDate, query.endDate);
        return reply(200, { ...price, enabled: settings.data.markets[query.language].enabled, daysAvailable: days });
      }
      if (action === 'admin-orders') return reply(200, { orders: (await store.orders(undefined, false)).map(order => ({ ...order, effectiveStatus: domain.status(order) })) });
      domain.fail('notFound', 404);
    }
    if (action === 'admin-order' && method === 'DELETE') {
      return reply(200, await store.transaction(async client => {
        const order = (await store.orders(client)).find(order => order.id === body.id);
        if (!order) domain.fail('notFound', 404);
        if (body.version !== order.version) domain.fail('conflict', 409);
        await client.query('DELETE FROM ad_orders WHERE id=$1', [order.id]);
        return { deleted: order.id };
      }));
    }
    if (action === 'order-batch' && method === 'POST') return reply(201, await require('../ads-batch').reserve(body, event.headers['x-nf-client-connection-ip']));
    if (action === 'admin-settings' && method === 'PUT') {
      const next = domain.validateSettings(body.data);
      return reply(200, await store.transaction(async (client, settings) => {
        if (body.version !== settings.version && !(body.version === 0 && settings.version === 1)) domain.fail('conflict', 409);
        await client.query('UPDATE ads_settings SET data=$1,version=version+1 WHERE id=1', [next]);
        return { data: next, version: settings.version + 1 };
      }));
    }
    if (!((action === 'order' && method === 'POST') || (action === 'admin-order' && ['POST', 'PUT'].includes(method)))) domain.fail('notFound', 404);
    const result = await store.transaction(async (client, settings) => {
      settings.data.markets = { ...domain.defaults().markets, ...settings.data.markets };
      const all = await store.orders(client);
      const old = method === 'PUT' ? all.find(order => order.id === body.id) : null;
      if (method === 'PUT' && !old) domain.fail('notFound', 404);
      if (old && body.version !== old.version) domain.fail('conflict', 409);
      if (!admin) {
        if (body.website || body.consent !== true) domain.fail('validation');
        if (!/^[0-9a-f-]{36}$/i.test(body.requestId || '')) domain.fail('validation');
        const fingerprint = createHash('sha256').update(JSON.stringify({ ...body, requestId: undefined })).digest('hex');
        const existing = all.find(order => order.requestId === body.requestId);
        if (existing) { if (existing.fingerprint !== fingerprint) domain.fail('conflict', 409); return { id: existing.id, status: existing.status, totalPrice: existing.totalPrice, currency: existing.currency }; }
        // Persistent throttle across function instances; only hashed IPs are retained.
        const key = createHash('sha256').update(event.headers['x-nf-client-connection-ip'] || 'unknown').digest('hex');
        const { rows: [limit] } = await client.query(`INSERT INTO ad_rate_limits(key,attempts) VALUES($1,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN ad_rate_limits.started_at < now()-interval '1 hour' THEN 1 ELSE ad_rate_limits.attempts+1 END, started_at=CASE WHEN ad_rate_limits.started_at < now()-interval '1 hour' THEN now() ELSE ad_rate_limits.started_at END RETURNING attempts`, [key]);
        if (limit.attempts > 10) domain.fail('rateLimit', 429);
        await client.query("DELETE FROM ad_rate_limits WHERE started_at < now()-interval '1 day'");
        body.fingerprint = fingerprint;
      }
      const input = old ? { ...old, ...body } : body;
      const nextStatus = admin ? input.status || 'approved' : 'pending';
      if (!['pending', 'approved', 'rejected', 'cancelled'].includes(nextStatus)) domain.fail('validation');
      const unchangedSchedule = old && ['language', 'type', 'startDate', 'endDate'].every(key => old[key] === input[key]);
      let price;
      if (old) {
        if (old.language !== input.language || old.type !== input.type) domain.fail('immutableMarket');
        const days = domain.dates(input.startDate, input.endDate).length;
        if (!unchangedSchedule) domain.quote(settings.data, input, domain.today(), true);
        price = { days, dailyPrice: old.dailyPrice, totalPrice: days * old.dailyPrice, currency: old.currency };
      } else {
        price = domain.quote(settings.data, input, domain.today(), admin);
        if (admin && input.complimentary === true) price = { ...price, dailyPrice: 0, totalPrice: 0 };
      }
      if (['pending', 'approved'].includes(nextStatus)) {
        const blocked = domain.availability(all, settings.data, input.language, input.type, input.startDate, input.endDate, old?.id).filter(day => day.remaining === 0);
        if (blocked.length) domain.fail('full', 409, blocked);
      }
      const content = domain.creative(input);
      // Require confirmation again if prices changed after the visible summary.
      if (!admin && (body.expectedDailyPrice !== price.dailyPrice || body.expectedTotalPrice !== price.totalPrice)) domain.fail('priceChanged', 409);
      const order = { ...content, ...price, id: old?.id || randomUUID(), language: input.language, type: input.type, startDate: input.startDate, endDate: input.endDate, status: nextStatus, version: (old?.version || 0) + 1, createdAt: old?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), source: old?.source || (admin ? 'manual' : 'public'), paymentStatus: old?.paymentStatus || (admin && input.complimentary ? 'not_required' : 'unpaid'), paymentId: old?.paymentId || null, paymentProvider: old?.paymentProvider || null, paidAt: old?.paidAt || null, requestId: old?.requestId || (!admin ? body.requestId : null), fingerprint: old?.fingerprint || (!admin ? body.fingerprint : null) };
      if (old?.groupId) { order.groupId=old.groupId; order.batchRequestId=old.batchRequestId; }
      if (old?.demoSet) order.demoSet = old.demoSet;
      await client.query('INSERT INTO ad_orders(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data', [order.id, order]);
      return admin ? { ...order, effectiveStatus: domain.status(order) } : { id: order.id, status: order.status, totalPrice: order.totalPrice, currency: order.currency };
    });
    return reply(method === 'POST' ? 201 : 200, result);
  } catch (error) {
    if (error instanceof domain.AdError || error instanceof HttpError) return reply(error.status, { error: error.code, details: error.details });
    console.error('Advertising API failure:', error.code || error.name);
    return reply(503, { error: 'unavailable' });
  }
};

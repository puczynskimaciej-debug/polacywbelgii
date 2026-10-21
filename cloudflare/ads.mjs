import domain from '../server/ads-domain.js';
import languages from '../src/_data/languages.json' with { type: 'json' };
import { currentUser } from './auth.mjs';
import { errorResponse, fail, json, readJson, sha256 } from './common.mjs';

const q = (db, sql, ...params) => db.prepare(sql).bind(...params);
const parseOrder = row => ({ ...JSON.parse(row.data), ...(row.has_mobile === undefined ? {} : { hasMobileImage: Boolean(row.has_mobile) }) });
async function settings(db) {
  const row = await db.prepare('SELECT data,version FROM ads_settings WHERE id=1').first();
  return row ? { data: domain.normalizeSettings(JSON.parse(row.data)), version: row.version } : { data: domain.defaults(), version: 0 };
}
async function orders(db, includeImages = false) {
  const sql = includeImages ? 'SELECT data FROM ad_orders ORDER BY created_at DESC' : "SELECT json_remove(data,'$.image','$.imageMobile') AS data,CASE WHEN length(json_extract(data,'$.imageMobile'))>0 THEN 1 ELSE 0 END AS has_mobile FROM ad_orders ORDER BY created_at DESC";
  return (await db.prepare(sql).all()).results.map(parseOrder);
}
async function order(db, id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '')) return null;
  const row = await q(db, 'SELECT data FROM ad_orders WHERE id=?', id).first();
  return row ? parseOrder(row) : null;
}
function imageResponse(item, variant) {
  if (!item || domain.status(item) !== 'active' || item.kind === 'text') domain.fail('notFound', 404);
  const data = variant === 'mobile' && item.imageMobile ? item.imageMobile : item.image;
  if (typeof data !== 'string') domain.fail('notFound', 404);
  const [prefix, base64] = data.split(',');
  if (!/^data:image\/(png|jpeg|webp);base64$/.test(prefix) || !base64) domain.fail('image', 503);
  return new Response(Uint8Array.from(atob(base64), char => char.charCodeAt(0)), { headers: { 'Content-Type': prefix.slice(5).split(';')[0], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
function publicAds(all, language) {
  if (!Object.hasOwn(languages, language)) domain.fail('market');
  return all.filter(item => item.language === language && domain.status(item) === 'active').map(item => ({
    ...domain.publicAd(item),
    image: item.kind === 'text' ? '' : `/api/ads?action=image&id=${item.id}`,
    imageMobile: item.hasMobileImage ? `/api/ads?action=image&id=${item.id}&variant=mobile` : ''
  }));
}
async function withWrite(db, plan) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const version = (await db.prepare('SELECT max(version) AS version FROM ad_write_versions').first()).version || 0;
    const current = await settings(db);
    const all = await orders(db, true);
    const { statements, output } = await plan({ current, all });
    try {
      await db.batch([q(db, 'INSERT INTO ad_write_versions(version) VALUES(?)', version + 1), ...statements]);
      return output;
    } catch (error) {
      if (String(error).includes('UNIQUE constraint failed: ad_write_versions.version')) continue;
      throw error;
    }
  }
  domain.fail('conflict', 409);
}
async function limitStatements(db, all, ip) {
  const key = await sha256(ip || 'unknown');
  const row = await q(db, 'SELECT started_at,attempts FROM ad_rate_limits WHERE key=?', key).first();
  const now = new Date().toISOString();
  const recent = row && row.started_at >= new Date(Date.now() - 3600000).toISOString();
  if (recent && row.attempts >= 10) domain.fail('rateLimit', 429);
  return [q(db, 'INSERT INTO ad_rate_limits(key,started_at,attempts) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET started_at=excluded.started_at,attempts=?', key, now, recent ? row.attempts + 1 : 1)];
}
async function reserveBatch(db, body, ip) {
  if (body.website || body.consent !== true || !/^[0-9a-f-]{36}$/i.test(body.requestId || '')) domain.fail('validation');
  if (!Array.isArray(body.dates) || !body.dates.length || body.dates.length > 90 || new Set(body.dates).size !== body.dates.length) domain.fail('dates');
  const range = domain.dates(body.dates[0], body.dates.at(-1));
  if (range.length !== body.dates.length || range.some((date, index) => date !== body.dates[index])) domain.fail('dates');
  if (!['text', 'image'].includes(body.kind) || (body.type === 'STANDARD' && body.kind !== 'text') || (body.type === 'PREMIUM' && body.kind !== 'image')) domain.fail('validation');
  if (!Array.isArray(body.variants) || !body.variants.length || body.variants.length > Object.keys(languages).length || body.variants.some(v => !v || typeof v !== 'object') || new Set(body.variants.map(v => v.language)).size !== body.variants.length) domain.fail('market');
  const fingerprint = await sha256(JSON.stringify(body));
  return withWrite(db, async ({ current, all }) => {
    const existing = all.filter(item => item.batchRequestId === body.requestId);
    if (existing.length) {
      if (existing[0].fingerprint !== fingerprint) domain.fail('conflict', 409);
      return { statements: [], output: { id: existing[0].groupId, totalPrice: existing.reduce((sum, item) => sum + item.totalPrice, 0), currency: 'EUR', status: 'pending' } };
    }
    const statements = await limitStatements(db, all, ip);
    const groupId = crypto.randomUUID();
    const planned = [];
    for (const variant of body.variants) {
      if (!Object.hasOwn(languages, variant.language)) domain.fail('market');
      const creative = body.kind === 'text'
        ? domain.creative({ kind: 'text', description: variant.text, contact: body.contact, email: body.email })
        : domain.creative({ kind: 'image', company: body.company, title: variant.title, description: variant.description, url: body.url, email: body.email, customerName: body.customerName, image: body.image, imageMobile: body.type === 'PREMIUM' ? body.imageMobile : '', phone: body.phone || '' });
      if (body.kind === 'image') {
        domain.validateImageDimensions(creative.image, 1200, body.type === 'PREMIUM' ? 200 : 720);
        if (body.type === 'PREMIUM') domain.validateImageDimensions(creative.imageMobile, 660, 300);
      }
      const input = { language: variant.language, type: body.type, startDate: range[0], endDate: range.at(-1) };
      const price = domain.quote(current.data, input);
      const blocked = domain.availability(all, current.data, input.language, input.type, input.startDate, input.endDate).filter(day => !day.remaining);
      if (blocked.length) domain.fail('full', 409, blocked);
      planned.push({ ...creative, kind: body.kind, ...input, ...price, id: crypto.randomUUID(), groupId, batchRequestId: body.requestId, fingerprint, region: 'all', status: 'pending', version: 1, source: 'public', paymentStatus: 'unpaid', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    const totalPrice = planned.reduce((sum, item) => sum + item.totalPrice, 0);
    if (body.expectedTotalPrice !== totalPrice) domain.fail('priceChanged', 409);
    for (const item of planned) statements.push(q(db, 'INSERT INTO ad_orders(id,data,created_at) VALUES(?,?,?)', item.id, JSON.stringify(item), item.createdAt));
    return { statements, output: { id: groupId, totalPrice, currency: 'EUR', status: 'pending' } };
  });
}
async function writeOrder(db, body, method, admin, ip) {
  return withWrite(db, async ({ current, all }) => {
    const old = method === 'PUT' ? all.find(item => item.id === body.id) : null;
    if (method === 'PUT' && !old) domain.fail('notFound', 404);
    if (old && body.version !== old.version) domain.fail('conflict', 409);
    const statements = [];
    if (!admin) {
      if (body.website || body.consent !== true || !/^[0-9a-f-]{36}$/i.test(body.requestId || '')) domain.fail('validation');
      const fingerprint = await sha256(JSON.stringify({ ...body, requestId: undefined }));
      const existing = all.find(item => item.requestId === body.requestId);
      if (existing) {
        if (existing.fingerprint !== fingerprint) domain.fail('conflict', 409);
        return { statements, output: { id: existing.id, status: existing.status, totalPrice: existing.totalPrice, currency: existing.currency } };
      }
      statements.push(...await limitStatements(db, all, ip));
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
      if (!unchangedSchedule) domain.quote(current.data, input, domain.today(), true);
      price = { days, dailyPrice: old.dailyPrice, totalPrice: days * old.dailyPrice, currency: old.currency };
    } else {
      price = domain.quote(current.data, input, domain.today(), admin);
      if (admin && input.complimentary === true) price = { ...price, dailyPrice: 0, totalPrice: 0 };
    }
    if (['pending', 'approved'].includes(nextStatus)) {
      const blocked = domain.availability(all, current.data, input.language, input.type, input.startDate, input.endDate, old?.id).filter(day => !day.remaining);
      if (blocked.length) domain.fail('full', 409, blocked);
    }
    if (!admin && input.type === 'STANDARD' && input.kind !== 'text') domain.fail('validation');
    if (input.type === 'PREMIUM' && input.kind === 'text') domain.fail('validation');
    if (input.region && !['all', 'flanders', 'wallonia', 'brussels'].includes(input.region)) domain.fail('validation');
    const creative = domain.creative(input);
    if (!admin && (body.expectedDailyPrice !== price.dailyPrice || body.expectedTotalPrice !== price.totalPrice)) domain.fail('priceChanged', 409);
    const item = { ...creative, ...price, id: old?.id || crypto.randomUUID(), region: input.region || 'all', language: input.language, type: input.type, startDate: input.startDate, endDate: input.endDate, status: nextStatus, version: (old?.version || 0) + 1, createdAt: old?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), source: old?.source || (admin ? 'manual' : 'public'), paymentStatus: old?.paymentStatus || (admin && input.complimentary ? 'not_required' : 'unpaid'), paymentId: old?.paymentId || null, paymentProvider: old?.paymentProvider || null, paidAt: old?.paidAt || null, requestId: old?.requestId || (!admin ? body.requestId : null), fingerprint: old?.fingerprint || (!admin ? body.fingerprint : null) };
    if (old?.groupId) { item.groupId = old.groupId; item.batchRequestId = old.batchRequestId; }
    if (old?.demoSet) item.demoSet = old.demoSet;
    statements.push(q(db, 'INSERT INTO ad_orders(id,data,created_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data', item.id, JSON.stringify(item), item.createdAt));
    return { statements, output: admin ? { ...item, effectiveStatus: domain.status(item) } : { id: item.id, status: item.status, totalPrice: item.totalPrice, currency: item.currency } };
  });
}
export async function handleAds({ request, env }) {
  try {
    if (!env.DB) fail('configuration', 503);
    const query = new URL(request.url).searchParams;
    const action = query.get('action') || 'public';
    const admin = action.startsWith('admin');
    if (admin) await currentUser(request, env);
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(request.method)) fail('method', 405);
    if (request.method === 'GET') {
      if (action === 'image' || action === 'admin-detail') {
        const item = await order(env.DB, query.get('id'));
        if (!item) domain.fail('notFound', 404);
        return action === 'image' ? imageResponse(item, query.get('variant')) : json({ ...item, effectiveStatus: domain.status(item) });
      }
      const current = await settings(env.DB);
      if (action === 'config' || action === 'admin-settings') return json({ ...current, languages, today: domain.today() });
      if (action === 'public') return json({ ads: publicAds(await orders(env.DB), query.get('language')) });
      if (action === 'availability') {
        const input = Object.fromEntries(query);
        const price = domain.quote(current.data, input, domain.today(), true);
        const daysAvailable = domain.availability(await orders(env.DB), current.data, input.language, input.type, input.startDate, input.endDate);
        return json({ ...price, enabled: current.data.markets[input.language].enabled && (input.type !== 'PREMIUM' || current.data.markets[input.language].prices.PREMIUM > 0), daysAvailable });
      }
      if (action === 'admin-orders') return json({ orders: (await orders(env.DB)).map(item => ({ ...item, effectiveStatus: domain.status(item) })) });
      domain.fail('notFound', 404);
    }
    const body = await readJson(request, 1450000);
    if (action === 'admin-order' && request.method === 'DELETE') {
      const output = await withWrite(env.DB, async ({ all }) => {
        const item = all.find(entry => entry.id === body.id);
        if (!item) domain.fail('notFound', 404);
        if (body.version !== item.version) domain.fail('conflict', 409);
        return { statements: [q(env.DB, 'DELETE FROM ad_orders WHERE id=?', item.id)], output: { deleted: item.id } };
      });
      return json(output);
    }
    if (action === 'order-batch' && request.method === 'POST') return json(await reserveBatch(env.DB, body, request.headers.get('cf-connecting-ip')), 201);
    if (action === 'admin-settings' && request.method === 'PUT') {
      const next = domain.validateSettings(body.data);
      const output = await withWrite(env.DB, async ({ current }) => {
        if (body.version !== current.version && !(body.version === 0 && current.version === 1)) domain.fail('conflict', 409);
        const version = current.version + 1;
        return { statements: [q(env.DB, 'INSERT INTO ads_settings(id,data,version) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=excluded.version', JSON.stringify(next), version)], output: { data: next, version } };
      });
      return json(output);
    }
    if (!((action === 'order' && request.method === 'POST') || (action === 'admin-order' && ['POST', 'PUT'].includes(request.method)))) domain.fail('notFound', 404);
    const output = await writeOrder(env.DB, body, request.method, admin, request.headers.get('cf-connecting-ip'));
    return json(output, request.method === 'POST' ? 201 : 200);
  } catch (error) { return errorResponse(error); }
}

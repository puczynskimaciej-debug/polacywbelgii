import domain from '../server/ads-domain.js';
import { currentUser } from './auth.mjs';
import { errorResponse, fail, json, readJson, sha256 } from './common.mjs';
import { translateAd } from './ad-translation.mjs';
import { createFullRefund, stripeReady } from './stripe.mjs';
import { adMailReady, adMessage, sendAdEmail } from './ad-mail.mjs';

const languages = domain.languages;
const q = (db, sql, ...params) => db.prepare(sql).bind(...params);
const parseOrder = row => ({ ...JSON.parse(row.data), ...(row.has_mobile === undefined ? {} : { hasImage: Boolean(row.has_image), hasMobileImage: Boolean(row.has_mobile) }) });
async function settings(db) {
  const row = await db.prepare('SELECT data,version FROM ads_settings WHERE id=1').first();
  return row ? { data: domain.normalizeSettings(JSON.parse(row.data)), version: row.version } : { data: domain.defaults(), version: 0 };
}
async function orders(db, includeImages = false) {
  const sql = includeImages ? 'SELECT data FROM ad_orders ORDER BY created_at DESC' : "SELECT json_remove(data,'$.image','$.imageMobile') AS data,CASE WHEN length(json_extract(data,'$.image'))>0 THEN 1 ELSE 0 END AS has_image,CASE WHEN length(json_extract(data,'$.imageMobile'))>0 THEN 1 ELSE 0 END AS has_mobile FROM ad_orders ORDER BY created_at DESC";
  return (await db.prepare(sql).all()).results.map(parseOrder);
}
async function order(db, id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '')) return null;
  const row = await q(db, 'SELECT data FROM ad_orders WHERE id=?', id).first();
  return row ? parseOrder(row) : null;
}
function imageResponse(item, variant) {
  if (!item || !publicEligible(item) || item.kind === 'text') domain.fail('notFound', 404);
  const data = variant === 'mobile' && item.imageMobile ? item.imageMobile : item.image;
  if (typeof data !== 'string') domain.fail('notFound', 404);
  const [prefix, base64] = data.split(',');
  if (!/^data:image\/(png|jpeg|webp);base64$/.test(prefix) || !base64) domain.fail('image', 503);
  return new Response(Uint8Array.from(atob(base64), char => char.charCodeAt(0)), { headers: { 'Content-Type': prefix.slice(5).split(';')[0], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
function publicEligible(item) { return (item.paymentStatus === 'paid' || item.source === 'manual' && item.paymentStatus === 'not_required') && item.status === 'approved' && domain.status(item) === 'active'; }
function publicAds(all, language) {
  if (!Object.hasOwn(languages, language)) domain.fail('market');
  return all.filter(item => item.language === language && publicEligible(item)).map(item => ({
    ...domain.publicAd(item),
    image: item.kind === 'text' || !item.image && !item.hasImage ? '' : `/api/ads?action=image&id=${item.id}`,
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
async function reserveBatch(db, body, ip, adminUser = null) {
  const complimentary = Boolean(adminUser && body.adminComplimentary === true);
  if (body.adminComplimentary && !adminUser) domain.fail('unauthorized', 403);
  if (complimentary && !['approved', 'pending'].includes(body.adminStatus)) domain.fail('validation');
  if (body.website || body.consent !== true || !/^[0-9a-f-]{36}$/i.test(body.requestId || '')) domain.fail('validation');
  if (body.termsAccepted !== true || body.termsVersion !== 'draft-2026-11-11' || body.earlyServiceRequest !== true && body.earlyServiceRequest !== false) domain.fail('validation');
  const chosen = domain.selectedDates(body.dates);
  if (body.region && !['all', 'flanders', 'wallonia', 'brussels'].includes(body.region)) domain.fail('validation');
  if (!['text', 'image'].includes(body.kind) || (body.type === 'STANDARD' && body.kind !== 'text') || (body.type === 'PREMIUM' && body.kind !== 'image')) domain.fail('validation');
  if (!Array.isArray(body.variants) || !body.variants.length || body.variants.length > Object.keys(languages).length || body.variants.some(v => !v || typeof v !== 'object') || new Set(body.variants.map(v => v.language)).size !== body.variants.length) domain.fail('market');
  if (!body.primaryLanguage || body.variants[0].language !== body.primaryLanguage) domain.fail('market');
  const fingerprint = await sha256(JSON.stringify(body));
  return withWrite(db, async ({ current, all }) => {
    const existing = all.filter(item => item.batchRequestId === body.requestId);
    if (existing.length) {
      if (existing[0].fingerprint !== fingerprint) domain.fail('conflict', 409);
      return { statements: [], output: { id: existing[0].groupId, totalPrice: existing.reduce((sum, item) => sum + item.totalPrice, 0), currency: 'EUR', status: 'pending' } };
    }
    const statements = adminUser ? [] : await limitStatements(db, all, ip);
    const groupId = crypto.randomUUID();
    const planned = [];
    const periods = chosen.map(date => domain.periodForDate(date));
    const baseQuote = complimentary ? { totalPrice: current.data.markets[body.primaryLanguage]?.prices[body.type] * chosen.length } : domain.quoteSelected(current.data, { language: body.primaryLanguage, type: body.type, dates: chosen });
    if (!Number.isSafeInteger(baseQuote.totalPrice)) domain.fail('market');
    for (const variant of body.variants) {
      if (!Object.hasOwn(languages, variant.language)) domain.fail('market');
      const creative = body.kind === 'text'
        ? domain.creative({ kind: 'text', type: body.type, title: variant.title, description: variant.description || variant.text, contact: body.contact, company:body.company, publicPhone:body.publicPhone, publicEmail:body.publicEmail, url:body.url, email: body.email, customerName:body.customerName })
        : domain.creative({ kind: 'image', type: body.type, company: body.company, contact:body.contact, publicPhone:body.publicPhone, publicEmail:body.publicEmail, title: variant.title, description: variant.description, url: body.url, email: body.email, customerName: body.customerName, image: variant.image || body.image, imageMobile: body.type === 'PREMIUM' ? variant.imageMobile || body.imageMobile : '', phone: body.phone || '' });
      if (body.kind === 'image' && creative.image) {
        domain.validateImageDimensions(creative.image, 1200, body.type === 'PREMIUM' ? 200 : 720);
        if (body.type === 'PREMIUM' && creative.imageMobile) domain.validateImageDimensions(creative.imageMobile, 660, 300);
      }
      const input = { language: variant.language, type: body.type, startDate: chosen[0], endDate: chosen.at(-1) };
      const price = domain.quoteSelected(current.data, { language: variant.language, type: body.type, dates: chosen }, new Date(), complimentary);
      for (const period of periods) {
        const window = domain.periodWindow(period);
        const availability = domain.availabilityWindow(all, current.data, input.language, input.type, window.startAt, window.endAt);
        if (!availability.remaining) domain.fail('full', 409, [{ date: period.date, ...availability }]);
      }
      const languagePrice = variant.language === body.primaryLanguage ? baseQuote.totalPrice : Math.round(baseQuote.totalPrice / 2);
      const actualPeriods = complimentary && body.adminStatus === 'approved' ? periods.map(period => ({ ...period, actualStartAt: period.plannedStartAt || new Date().toISOString(), actualEndAt: period.plannedEndAt || new Date(Date.now() + 86400000).toISOString() })) : periods.map(period => ({ ...period }));
      planned.push({ ...creative, kind: body.kind, ...input, ...price, dailyPrice: complimentary ? 0 : price.dailyPrice, totalPrice: complimentary ? 0 : languagePrice, basePrice: complimentary ? 0 : baseQuote.totalPrice, rateCardPrice: complimentary ? languagePrice : undefined, primaryLanguage: body.primaryLanguage, languages: body.variants.map(v => v.language), groupTotalPrice: null, periods: actualPeriods, plannedStartAt: periods[0].plannedStartAt, plannedEndAt: periods.at(-1).plannedEndAt, actualStartAt: complimentary && body.adminStatus === 'approved' ? actualPeriods[0].actualStartAt : null, actualEndAt: complimentary && body.adminStatus === 'approved' ? actualPeriods.at(-1).actualEndAt : null, reservationStartAt: periods[0].reservationStartAt, reservationEndAt: periods.at(-1).reservationEndAt, id: crypto.randomUUID(), groupId, batchRequestId: body.requestId, fingerprint, termsVersion:body.termsVersion,termsAcceptedAt:new Date().toISOString(),earlyServiceRequest:body.earlyServiceRequest, region: body.region || 'all', status: complimentary ? body.adminStatus : 'pending', version: 1, source: complimentary ? 'manual' : 'public', paymentStatus: complimentary ? 'not_required' : 'unpaid', complimentary, adminAddedBy: complimentary ? adminUser.id : null, reservationExpiresAt: complimentary ? null : new Date(Date.now() + 31 * 60000).toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    const totalPrice = planned.reduce((sum, item) => sum + item.totalPrice, 0);
    if (body.expectedTotalPrice !== (complimentary ? planned.reduce((sum, item) => sum + item.rateCardPrice, 0) : totalPrice)) domain.fail('priceChanged', 409);
    planned.forEach(item => { item.groupTotalPrice = totalPrice; });
    for (const item of planned) {
      statements.push(q(db, 'INSERT INTO ad_orders(id,data,created_at) VALUES(?,?,?)', item.id, JSON.stringify(item), item.createdAt));
      if (complimentary) statements.push(q(db, 'INSERT INTO ad_order_history(order_id,actor_id,action,previous_status,new_status,created_at) VALUES(?,?,?,?,?,?)', item.id, adminUser.id, 'admin-complimentary-create', null, item.status, item.createdAt));
    }
    return { statements, output: { id: groupId, totalPrice, currency: 'EUR', status: 'pending' } };
  });
}
async function moderateGroup(db, body, adminUser) {
  if (!['approved', 'rejected', 'cancelled'].includes(body.status)) domain.fail('validation');
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (body.status === 'rejected' && (reason.length < 10 || reason.length > 1000)) domain.fail('validation');
  return withWrite(db, async ({ current, all }) => {
    const target = all.find(item => item.id === body.id);
    if (!target || !['public', 'manual'].includes(target.source)) domain.fail('notFound', 404);
    if (target.version !== body.version) domain.fail('conflict', 409);
    const group = target.groupId ? all.filter(item => item.groupId === target.groupId) : [target];
    if (body.status === 'rejected' && group.some(item => item.source === 'public' && item.paymentStatus === 'paid')) domain.fail('useRefundAction', 409);
    if (group.some(item => item.status !== target.status)) domain.fail('conflict', 409);
    const now = new Date();
    if (body.status === 'approved') {
      if (group.some(item => item.paymentStatus !== 'paid' && !(item.source === 'manual' && item.paymentStatus === 'not_required'))) domain.fail('paymentRequired', 409);
      if (group.some(item => (item.periods || [item]).some(period => period.plannedStartAt && period.plannedStartAt <= now.toISOString() && !period.actualStartAt))) domain.fail('needsReschedule', 409);
      for (const item of group) {
        for (const period of item.periods || [item]) {
          const startAt = period.plannedStartAt || now.toISOString();
          const endAt = period.plannedEndAt || new Date(Date.parse(startAt) + (item.periods ? 1 : item.days) * 86400000).toISOString();
          const free = domain.availabilityWindow(all, current.data, item.language, item.type, startAt, endAt, group.map(entry => entry.id));
          if (!free.remaining) domain.fail('full', 409, [{ date: period.date || item.startDate, ...free }]);
        }
      }
    }
    const statements = [];
    for (const item of group) {
      const nextPeriods = item.periods?.map(period => {
        if (body.status !== 'approved') return period;
        const actualStartAt = period.plannedStartAt || now.toISOString();
        return { ...period, actualStartAt, actualEndAt: period.plannedEndAt || new Date(Date.parse(actualStartAt) + 86400000).toISOString() };
      });
      const startAt = body.status === 'approved' ? nextPeriods?.[0].actualStartAt || item.plannedStartAt || now.toISOString() : item.actualStartAt;
      const endAt = body.status === 'approved' ? nextPeriods?.at(-1).actualEndAt || item.plannedEndAt || new Date(Date.parse(startAt) + item.days * 86400000).toISOString() : item.actualEndAt;
      const updated = { ...item, status: body.status, moderationReason: body.status === 'rejected' ? reason : item.moderationReason, periods: nextPeriods || item.periods, actualStartAt: startAt, actualEndAt: endAt, version: item.version + 1, updatedAt: now.toISOString() };
      statements.push(q(db, 'UPDATE ad_orders SET data=? WHERE id=?', JSON.stringify(updated), item.id));
      statements.push(q(db, 'INSERT INTO ad_order_history(order_id,actor_id,action,previous_status,new_status,created_at) VALUES(?,?,?,?,?,?)', item.id, adminUser?.id || null, 'moderate-group', item.status, updated.status, updated.updatedAt));
    }
    return { statements, output: { groupId: target.groupId || target.id, status: body.status } };
  });
}

async function rejectAndRefund(db, body, adminUser, env, fetcher) {
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 10 || reason.length > 1000 || !/^[0-9a-f-]{36}$/i.test(body.id || '')) domain.fail('validation');
  const locked = await withWrite(db, async ({ all }) => {
    const target = all.find(item => item.id === body.id);
    if (!target || target.source !== 'public') domain.fail('notFound', 404);
    if (target.version !== body.version && target.status !== 'refund_pending') domain.fail('conflict', 409);
    const group = target.groupId ? all.filter(item => item.groupId === target.groupId) : [target];
    if (group.some(item => item.paymentStatus !== 'paid' || !item.paymentId || !['pending', 'changes_requested', 'refund_pending'].includes(item.status))) domain.fail('paymentRequired', 409);
    if (new Set(group.map(item => item.paymentId)).size !== 1) domain.fail('paymentMismatch', 409);
    const amount = target.groupTotalPrice || group.reduce((sum, item) => sum + item.totalPrice, 0);
    if (group.every(item => item.status === 'refund_pending')) return { statements: [], output: { groupId: target.groupId || target.id, paymentId: target.paymentId, amount } };
    if (group.some(item => item.version !== target.version || item.status !== target.status)) domain.fail('conflict', 409);
    const now = new Date().toISOString();
    return { statements: group.flatMap(item => {
      const updated = { ...item, status: 'refund_pending', moderationDecision: 'rejected', moderationReason: reason, refundRequired: true, version: item.version + 1, updatedAt: now };
      return [q(db, 'UPDATE ad_orders SET data=? WHERE id=?', JSON.stringify(updated), item.id), q(db, 'INSERT INTO ad_order_history(order_id,actor_id,action,previous_status,new_status,created_at) VALUES(?,?,?,?,?,?)', item.id, adminUser.id, 'reject-refund-requested', item.status, updated.status, now)];
    }), output: { groupId: target.groupId || target.id, paymentId: target.paymentId, amount } };
  });
  const refund = await createFullRefund(env, locked, fetcher);
  await withWrite(db, async ({ all }) => {
    const group = all.filter(item => (item.groupId || item.id) === locked.groupId && item.status === 'refund_pending');
    return { statements: group.map(item => q(db, 'UPDATE ad_orders SET data=? WHERE id=?', JSON.stringify({ ...item, refundId: refund.id, refundRequestStatus: refund.status, refundRequestedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }), item.id)), output: null };
  });
  return { ...locked, refundId: refund.id, refundStatus: refund.status };
}

const correctionToken = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
async function correctionGroup(db, groupId, token) {
  if (!/^[0-9a-f-]{36}$/i.test(groupId || '') || !/^[A-Za-z0-9_-]{40,50}$/.test(token || '')) domain.fail('notFound', 404);
  const hash = await sha256(token);
  const group = (await orders(db, true)).filter(item => item.groupId === groupId && item.status === 'changes_requested' && item.editTokenHash === hash && item.editTokenExpiresAt > new Date().toISOString());
  if (!group.length || group.some(item => item.languages?.length && item.languages.length !== group.length)) domain.fail('notFound', 404);
  return group;
}
async function requestChanges(db, body, adminUser, env, origin, mailer) {
  if (mailer === sendAdEmail && !adMailReady(env)) domain.fail('mailConfiguration', 503);
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 10 || reason.length > 1000) domain.fail('validation');
  const token = correctionToken(), hash = await sha256(token);
  const result = await withWrite(db, async ({ all }) => {
    const target = all.find(item => item.id === body.id);
    if (!target) domain.fail('notFound', 404);
    if (target.version !== body.version) domain.fail('conflict', 409);
    const group = target.groupId ? all.filter(item => item.groupId === target.groupId) : [target];
    if (group.some(item => !['pending', 'approved', 'changes_requested'].includes(item.status) || item.source === 'public' && item.paymentStatus !== 'paid')) domain.fail('validation', 409);
    const now = new Date().toISOString(), expires = new Date(Date.now() + 7 * 86400000).toISOString();
    return { statements: group.flatMap(item => {
      const updated = { ...item, status: 'changes_requested', moderationReason: reason, editTokenHash: hash, editTokenExpiresAt: expires, version: item.version + 1, updatedAt: now };
      return [q(db, 'UPDATE ad_orders SET data=? WHERE id=?', JSON.stringify(updated), item.id), q(db, 'INSERT INTO ad_order_history(order_id,actor_id,action,previous_status,new_status,created_at) VALUES(?,?,?,?,?,?)', item.id, adminUser.id, 'request-changes', item.status, updated.status, now)];
    }), output: { groupId: target.groupId || target.id, contactOrder: group.find(item => item.language === item.primaryLanguage) || target } };
  });
  const editUrl = `${origin}/popraw-ogloszenie/?order=${result.groupId}#token=${token}`;
  try { await mailer(env, adMessage('changes_requested', result.contactOrder, { reason, editUrl })); }
  catch { return { groupId: result.groupId, status: 'changes_requested', emailSent: false }; }
  return { groupId: result.groupId, status: 'changes_requested', emailSent: true };
}
async function customerCorrect(db, body, env, mailer) {
  const group = await correctionGroup(db, body.groupId, body.token);
  const oldLanguages = group.map(item => item.language).sort();
  if (!Array.isArray(body.variants) || body.variants.length !== group.length || body.variants.map(item => item?.language).sort().join(',') !== oldLanguages.join(',')) domain.fail('immutableMarket', 409);
  const hash = await sha256(body.token);
  const result = await withWrite(db, async ({ all }) => {
    const current = all.filter(item => item.groupId === body.groupId);
    if (current.length !== group.length || current.some(item => item.status !== 'changes_requested' || item.editTokenHash !== hash || item.editTokenExpiresAt <= new Date().toISOString())) domain.fail('conflict', 409);
    const now = new Date().toISOString();
    return { statements: current.flatMap(item => {
      const variant = body.variants.find(entry => entry.language === item.language);
      const creative = domain.creative({ ...item, ...body, ...variant, kind: item.kind, type: item.type, email: item.email, image: variant.image || item.image, imageMobile: variant.imageMobile || item.imageMobile });
      if (creative.image) domain.validateImageDimensions(creative.image, 1200, item.type === 'PREMIUM' ? 200 : 720);
      if (creative.imageMobile) domain.validateImageDimensions(creative.imageMobile, 660, 300);
      const updated = { ...item, ...creative, status: 'pending', editTokenHash: null, editTokenExpiresAt: null, moderationReason: null, version: item.version + 1, updatedAt: now };
      return [q(db, 'UPDATE ad_orders SET data=? WHERE id=?', JSON.stringify(updated), item.id), q(db, 'INSERT INTO ad_order_history(order_id,actor_id,action,previous_status,new_status,created_at) VALUES(?,?,?,?,?,?)', item.id, null, 'customer-corrected', item.status, updated.status, now)];
    }), output: { groupId: body.groupId, contactOrder: current.find(item => item.language === item.primaryLanguage) || current[0] } };
  });
  if (adMailReady(env)) await mailer(env, adMessage('corrected', result.contactOrder)).catch(() => {});
  return { groupId: result.groupId, status: 'pending' };
}
async function rescheduleGroup(db, body, adminUser) {
  return withWrite(db, async ({ current, all }) => {
    const target = all.find(item => item.id === body.id);
    if (!target || target.source !== 'public' || !target.groupId || target.version !== body.version) domain.fail('conflict', 409);
    const group = all.filter(item => item.groupId === target.groupId);
    if (group.some(item => item.paymentStatus !== 'paid' || item.status !== 'pending' || item.actualStartAt)) domain.fail('validation', 409);
    const days = target.days;
    const chosen = target.periods ? domain.selectedDates(body.dates) : (() => { domain.dates(body.startDate, body.startDate); return domain.dates(body.startDate, new Date(Date.parse(body.startDate) + (days - 1) * 86400000).toISOString().slice(0, 10)); })();
    if (chosen.length !== days) domain.fail('dates');
    const periods = target.periods ? chosen.map(date => domain.periodForDate(date)) : null;
    const windows = periods ? periods.map(domain.periodWindow) : [domain.windowFor(chosen[0], days)];
    for (const item of group) {
      for (const window of windows) if (!domain.availabilityWindow(all, current.data, item.language, item.type, window.startAt, window.endAt, group.map(entry => entry.id)).remaining) domain.fail('full', 409);
    }
    const now = new Date().toISOString();
    const statements = [];
    for (const item of group) {
      const updated = { ...item, startDate: chosen[0], endDate: chosen.at(-1), periods: periods?.map(period => ({ ...period })) || item.periods, plannedStartAt: periods ? periods[0].plannedStartAt : windows[0].startsToday ? null : windows[0].startAt, plannedEndAt: periods ? periods.at(-1).plannedEndAt : windows[0].startsToday ? null : windows[0].endAt, reservationStartAt: windows[0].startAt, reservationEndAt: windows.at(-1).endAt, version: item.version + 1, updatedAt: now };
      statements.push(q(db, 'UPDATE ad_orders SET data=? WHERE id=?', JSON.stringify(updated), item.id));
      statements.push(q(db, 'INSERT INTO ad_order_history(order_id,actor_id,action,previous_status,new_status,created_at) VALUES(?,?,?,?,?,?)', item.id, adminUser?.id || null, 'reschedule-group', item.status, item.status, now));
    }
    return { statements, output: { groupId: target.groupId, dates: chosen, startDate: chosen[0], endDate: chosen.at(-1) } };
  });
}
async function reviseGroup(db, body, adminUser) {
  if (!/^[0-9a-f-]{36}$/i.test(body.id || '') || !Number.isSafeInteger(body.version) || !['STANDARD', 'TOP', 'PREMIUM'].includes(body.type) || !['text', 'image'].includes(body.kind)) domain.fail('validation');
  if (body.type === 'STANDARD' && body.kind !== 'text' || body.type === 'PREMIUM' && body.kind !== 'image') domain.fail('validation');
  if (!['pending', 'approved', 'paused', 'rejected', 'cancelled'].includes(body.adminStatus)) domain.fail('validation');
  return withWrite(db, async ({ current, all }) => {
    const target = all.find(item => item.id === body.id);
    if (!target) domain.fail('notFound', 404);
    if (target.version !== body.version) domain.fail('conflict', 409);
    if (target.source === 'public' && target.paymentStatus !== 'paid') domain.fail('paymentRequired', 409);
    const group = target.groupId ? all.filter(item => item.groupId === target.groupId) : [target];
    const oldLanguages = group.map(item => item.language).sort();
    const variants = body.variants;
    if (!Array.isArray(variants) || variants.length !== group.length || variants.some(item => !item || typeof item.language !== 'string') || variants.map(item => item.language).sort().join(',') !== oldLanguages.join(',')) domain.fail('immutableMarket', 409);
    const oldDates = target.periods?.length ? target.periods.map(period => period.date) : domain.dates(target.startDate, target.endDate);
    const sameDates = Array.isArray(body.dates) && body.dates.length === oldDates.length && body.dates.every((date, index) => date === oldDates[index]);
    const futureDates = sameDates ? oldDates.filter(date => date >= domain.today()) : domain.selectedDates(body.dates);
    const historicalDates = oldDates.filter(date => date < domain.today());
    const chosen = sameDates ? oldDates : [...historicalDates, ...futureDates];
    if (chosen.length > 90) domain.fail('dates');
    if (!['all', 'flanders', 'wallonia', 'brussels'].includes(body.region)) domain.fail('validation');
    const groupIds = group.map(item => item.id);
    const prepared = [];
    for (const item of group) {
      const variant = variants.find(entry => entry.language === item.language);
      const creative = domain.creative({ ...item, ...body, ...variant, image: body.kind === 'image' ? variant.image || body.image || item.image : '', imageMobile: body.kind === 'image' && body.type === 'PREMIUM' ? variant.imageMobile || body.imageMobile || item.imageMobile : '' });
      if (creative.image) domain.validateImageDimensions(creative.image, 1200, body.type === 'PREMIUM' ? 200 : 720);
      if (creative.imageMobile) domain.validateImageDimensions(creative.imageMobile, 660, 300);
      const previousPeriods = new Map(item.periods?.map(period => [period.date, period]) || []);
      const periods = chosen.map(date => {
        if (date >= domain.today() && (!sameDates || !previousPeriods.has(date))) return domain.periodForDate(date);
        if (previousPeriods.has(date)) return { ...previousPeriods.get(date) };
        const startAt = domain.belgianMidnight(date);
        const endAt = new Date(Date.parse(startAt) + 86400000).toISOString();
        return { date, plannedStartAt: startAt, plannedEndAt: endAt, reservationStartAt: startAt, reservationEndAt: endAt, actualStartAt: item.actualStartAt || null, actualEndAt: item.actualEndAt || null };
      });
      for (const period of periods) {
        if (period.date < domain.today()) continue;
        const window = domain.periodWindow(period);
        if (['pending', 'approved'].includes(body.adminStatus) && !domain.availabilityWindow(all, current.data, item.language, body.type, window.startAt, window.endAt, groupIds).remaining) domain.fail('full', 409, [{ date: period.date }]);
      }
      if (body.adminStatus === 'approved') for (const period of periods) {
        if (!period.actualStartAt) {
          const start = period.plannedStartAt || new Date().toISOString();
          period.actualStartAt = start;
          period.actualEndAt = period.plannedEndAt || new Date(Date.parse(start) + 86400000).toISOString();
        }
      }
      const now = new Date().toISOString();
      prepared.push({ ...item, ...creative, type: body.type, kind: body.kind, region: body.region, startDate: chosen[0], endDate: chosen.at(-1), days: chosen.length, periods, plannedStartAt: periods[0].plannedStartAt, plannedEndAt: periods.at(-1).plannedEndAt, actualStartAt: body.adminStatus === 'approved' ? periods[0].actualStartAt : item.actualStartAt || null, actualEndAt: body.adminStatus === 'approved' ? periods.at(-1).actualEndAt : item.actualEndAt || null, status: body.adminStatus, version: item.version + 1, updatedAt: now, adminAdjustedBy: adminUser.id, adminAdjustedAt: now });
    }
    const statements = [];
    for (const item of prepared) {
      statements.push(q(db, 'UPDATE ad_orders SET data=? WHERE id=?', JSON.stringify(item), item.id));
      statements.push(q(db, 'INSERT INTO ad_order_history(order_id,actor_id,action,previous_status,new_status,created_at) VALUES(?,?,?,?,?,?)', item.id, adminUser.id, 'admin-revise-group', group.find(old => old.id === item.id).status, item.status, item.updatedAt));
    }
    return { statements, output: { groupId: target.groupId || target.id, status: body.adminStatus, versions: prepared.length } };
  });
}
async function writeOrder(db, body, method, admin, ip, adminUser) {
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
    if (old?.source === 'public' && (!unchangedSchedule || nextStatus !== old.status)) domain.fail('useGroupModeration', 409);
    let price;
    if (old) {
      if (old.language !== input.language || old.type !== input.type) domain.fail('immutableMarket');
      const days = old.periods?.length || domain.dates(input.startDate, input.endDate).length;
      if (!unchangedSchedule) domain.quote(current.data, input, domain.today(), true);
      price = { days, dailyPrice: old.dailyPrice, totalPrice: unchangedSchedule ? old.totalPrice : days * old.dailyPrice, currency: old.currency };
    } else {
      price = domain.quote(current.data, input, domain.today(), admin);
      if (admin && input.complimentary === true) price = { ...price, dailyPrice: 0, totalPrice: 0 };
    }
    if (['pending', 'approved'].includes(nextStatus)) {
      const windows = old?.source === 'public' ? domain.orderWindows(old) : [domain.windowFor(input.startDate, domain.dates(input.startDate, input.endDate).length)];
      for (const window of windows) {
        const free = domain.availabilityWindow(all, current.data, input.language, input.type, window.startAt, window.endAt, old?.id);
        if (!free.remaining) domain.fail('full', 409, [free]);
      }
    }
    if (!admin && input.type === 'STANDARD' && input.kind !== 'text') domain.fail('validation');
    if (input.type === 'PREMIUM' && input.kind === 'text') domain.fail('validation');
    if (input.region && !['all', 'flanders', 'wallonia', 'brussels'].includes(input.region)) domain.fail('validation');
    const creative = domain.creative(input);
    if (!admin && (body.expectedDailyPrice !== price.dailyPrice || body.expectedTotalPrice !== price.totalPrice)) domain.fail('priceChanged', 409);
    const item = { ...old, ...creative, ...price, id: old?.id || crypto.randomUUID(), region: input.region || 'all', language: input.language, type: input.type, startDate: input.startDate, endDate: input.endDate, status: nextStatus, version: (old?.version || 0) + 1, createdAt: old?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), source: old?.source || (admin ? 'manual' : 'public'), paymentStatus: old?.paymentStatus || (admin && input.complimentary ? 'not_required' : 'unpaid'), reservationExpiresAt: old?.reservationExpiresAt || (!admin ? new Date(Date.now() + 31 * 60000).toISOString() : null), paymentId: old?.paymentId || null, paymentProvider: old?.paymentProvider || null, paidAt: old?.paidAt || null, requestId: old?.requestId || (!admin ? body.requestId : null), fingerprint: old?.fingerprint || (!admin ? body.fingerprint : null) };
    if (admin && item.source === 'manual' && !isNaN(Date.parse(item.startDate)) && !domain.isShowcase(item) && (!old || !unchangedSchedule)) {
      const window = domain.windowFor(item.startDate, item.days);
      item.actualStartAt = window.startAt; item.actualEndAt = window.endAt;
    }
    if (old?.groupId) { item.groupId = old.groupId; item.batchRequestId = old.batchRequestId; }
    if (old?.demoSet) item.demoSet = old.demoSet;
    statements.push(q(db, 'INSERT INTO ad_orders(id,data,created_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data', item.id, JSON.stringify(item), item.createdAt));
    if (admin) statements.push(q(db, 'INSERT INTO ad_order_history(order_id,actor_id,action,previous_status,new_status,created_at) VALUES(?,?,?,?,?,?)', item.id, adminUser?.id || null, old ? 'edit' : 'create', old?.status || null, item.status, item.updatedAt));
    return { statements, output: admin ? { ...item, effectiveStatus: domain.status(item) } : { id: item.id, status: item.status, totalPrice: item.totalPrice, currency: item.currency } };
  });
}
export async function handleAds({ request, env }, { fetcher = fetch, mailer = sendAdEmail } = {}) {
  try {
    if (!env.DB) fail('configuration', 503);
    const query = new URL(request.url).searchParams;
    const action = query.get('action') || 'public';
    const admin = action?.startsWith('admin');
    const adminUser = admin ? await currentUser(request, env, { admin: true }) : null;
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(request.method)) fail('method', 405);
    if (request.method === 'GET') {
      if (action === 'image' || action === 'admin-detail') {
        const item = await order(env.DB, query.get('id'));
        if (!item) domain.fail('notFound', 404);
        return action === 'image' ? imageResponse(item, query.get('variant')) : json({ ...item, effectiveStatus: domain.status(item) });
      }
      const current = await settings(env.DB);
      if (action === 'config' || action === 'admin-settings') return json({ ...current, data: action === 'config' ? { ...current.data, capacityOverrides: undefined } : current.data, languages, today: domain.today(), paymentsEnabled: stripeReady(env), turnstileSiteKey:env.TURNSTILE_SITE_KEY || '' });
      if (action === 'admin-capacity') {
        const language = query.get('language'), type = query.get('type');
        domain.marketFor(current.data, language, type);
        const selected = domain.dates(query.get('startDate'), query.get('endDate'));
        if (selected.length > 90) domain.fail('dates');
        const all = await orders(env.DB);
        return json({ version: current.version, days: selected.map(date => {
          const counts = domain.capacityForDate(current.data, language, type, date);
          if (date < domain.today()) return { date, ...counts, used: 0, remaining: 0 };
          const window = domain.windowFor(date, 1);
          const availability = domain.availabilityWindow(all, current.data, language, type, window.startAt, window.endAt);
          return { date, ...counts, capacity: availability.capacity, used: availability.used, remaining: availability.remaining };
        }) });
      }
      if (action === 'public') return new Response(JSON.stringify({ ads: publicAds(await orders(env.DB), query.get('language')) }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
      if (action === 'availability' || action === 'admin-availability') {
        const input = Object.fromEntries(query);
        const price = domain.quote(current.data, input, domain.today(), true);
        const all = await orders(env.DB);
        const editing = action === 'admin-availability' && input.id ? all.find(item => item.id === input.id) : null;
        const excludedIds = editing ? all.filter(item => item.groupId && item.groupId === editing.groupId || item.id === editing.id).map(item => item.id) : [];
        const durationDays = Number(input.durationDays) || 1;
        if (!Number.isSafeInteger(durationDays) || durationDays < 1 || durationDays > 90) domain.fail('dates');
        const lastAllowed = new Date(Date.parse(domain.today()) + 730 * 86400000).toISOString().slice(0, 10);
        const daysAvailable = domain.dates(input.startDate, input.endDate).map(date => {
          const candidateLast = new Date(Date.parse(date) + (durationDays - 1) * 86400000).toISOString().slice(0, 10);
          if (date < domain.today() || candidateLast > lastAllowed) return { date, used: 0, capacity: current.data.types[input.type].capacity, remaining: 0 };
          const window = domain.windowFor(date, durationDays);
          return { date, ...domain.availabilityWindow(all, current.data, input.language, input.type, window.startAt, window.endAt, excludedIds) };
        });
        return json({ ...price, enabled: action === 'admin-availability' || current.data.markets[input.language].enabled && (input.type !== 'PREMIUM' || current.data.markets[input.language].prices.PREMIUM > 0), daysAvailable });
      }
      if (action === 'admin-orders') return json({ orders: (await orders(env.DB)).map(item => ({ ...item, effectiveStatus: domain.status(item) })) });
      if (action === 'admin-payment-events') {
        const groupId = query.get('groupId');
        if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(groupId || '')) domain.fail('validation');
        return json({ events: (await q(env.DB, 'SELECT id,event_type,received_at FROM ad_payment_events WHERE group_id=? ORDER BY received_at DESC LIMIT 50', groupId).all()).results });
      }
      if (action === 'admin-order-history') {
        const id = query.get('id');
        if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id || '')) domain.fail('validation');
        return json({ changes: (await q(env.DB, 'SELECT action,previous_status,new_status,created_at,actor_id FROM ad_order_history WHERE order_id=? ORDER BY created_at DESC LIMIT 50', id).all()).results });
      }
      domain.fail('notFound', 404);
    }
    const body = await readJson(request, action === 'translate' ? 4000 : ['order-batch', 'admin-order-batch', 'admin-revise-group', 'customer-correct'].includes(action) ? 4000000 : 1450000);
    if (action === 'customer-preview' && request.method === 'POST') {
      const group = await correctionGroup(env.DB, body.groupId, body.token);
      return json({ groupId: body.groupId, type: group[0].type, kind: group[0].kind, dates: group[0].periods?.map(period => period.date) || [group[0].startDate], variants: group.map(item => ({ language: item.language, title: item.title, description: item.description, image: item.image || '', imageMobile: item.imageMobile || '' })), company: group[0].company, publicPhone: group[0].publicPhone, publicEmail: group[0].publicEmail, contact: group[0].contact, url: group[0].url, reason: group[0].moderationReason });
    }
    if (action === 'customer-correct' && request.method === 'POST') {
      if (request.headers.get('origin') !== new URL(request.url).origin) fail('origin', 403);
      return json(await customerCorrect(env.DB, body, env, mailer));
    }
    if (action === 'translate' && request.method === 'POST') return translateAd(request,env,body);
    if (action === 'admin-order' && request.method === 'DELETE') {
      const existing = await order(env.DB, body.id);
      if (existing?.source === 'public') return json(await moderateGroup(env.DB, { ...body, status: 'cancelled' }, adminUser));
      const output = await withWrite(env.DB, async ({ all }) => {
        const item = all.find(entry => entry.id === body.id);
        if (!item) domain.fail('notFound', 404);
        if (body.version !== item.version) domain.fail('conflict', 409);
        const selected = item.source === 'manual' && item.groupId ? all.filter(entry => entry.source === 'manual' && entry.groupId === item.groupId) : [item];
        return { statements: selected.flatMap(entry => [q(env.DB, 'DELETE FROM ad_order_history WHERE order_id=?', entry.id), q(env.DB, 'DELETE FROM ad_orders WHERE id=?', entry.id)]), output: { deleted: selected.map(entry => entry.id) } };
      });
      return json(output);
    }
    if (action === 'order-batch' && request.method === 'POST') return json(await reserveBatch(env.DB, body, request.headers.get('cf-connecting-ip')), 201);
    if (action === 'admin-order-batch' && request.method === 'POST') {
      if (request.headers.get('origin') !== new URL(request.url).origin) fail('origin', 403);
      return json(await reserveBatch(env.DB, body, request.headers.get('cf-connecting-ip'), adminUser), 201);
    }
    if (action === 'admin-moderate-group' && request.method === 'PUT') {
      const result = await moderateGroup(env.DB, body, adminUser);
      const group = (await orders(env.DB)).filter(item => (item.groupId || item.id) === result.groupId);
      const contactOrder = group.find(item => item.language === item.primaryLanguage) || group[0];
      let emailSent = false;
      if (contactOrder && adMailReady(env) && ['approved', 'rejected'].includes(body.status)) {
        try { await mailer(env, adMessage(body.status, contactOrder, { reason: body.reason })); emailSent = true; } catch { /* Decision remains recorded; CMS reports missing email. */ }
      }
      return json({ ...result, emailSent });
    }
    if (action === 'admin-request-changes' && request.method === 'PUT') {
      if (request.headers.get('origin') !== new URL(request.url).origin) fail('origin', 403);
      return json(await requestChanges(env.DB, body, adminUser, env, new URL(request.url).origin, mailer));
    }
    if (action === 'admin-reject-refund' && request.method === 'PUT') {
      if (request.headers.get('origin') !== new URL(request.url).origin) fail('origin', 403);
      const result = await rejectAndRefund(env.DB, body, adminUser, env, fetcher);
      const group = (await orders(env.DB)).filter(item => (item.groupId || item.id) === result.groupId);
      const contactOrder = group.find(item => item.language === item.primaryLanguage) || group[0];
      let emailSent = false;
      if (contactOrder && adMailReady(env)) {
        try {
          await mailer(env, adMessage('rejected', contactOrder, { reason: body.reason }));
          await mailer(env, adMessage('refund_requested', contactOrder));
          emailSent = true;
        } catch { /* The refund state is retained; CMS reports missing email. */ }
      }
      return json({ ...result, emailSent });
    }
    if (action === 'admin-reschedule-group' && request.method === 'PUT') return json(await rescheduleGroup(env.DB, body, adminUser));
    if (action === 'admin-revise-group' && request.method === 'PUT') {
      if (request.headers.get('origin') !== new URL(request.url).origin) fail('origin', 403);
      return json(await reviseGroup(env.DB, body, adminUser));
    }
    if (action === 'admin-capacity' && request.method === 'PUT') {
      if (request.headers.get('origin') !== new URL(request.url).origin) fail('origin', 403);
      const selected = domain.selectedDates(body.dates);
      if (!Number.isSafeInteger(body.reserve) || body.reserve < 0 || body.reserve > 100 || !Number.isSafeInteger(body.released) || body.released < 0 || body.released > body.reserve) domain.fail('validation');
      return json(await withWrite(env.DB, async ({ current, all }) => {
        if (body.version !== current.version) domain.fail('conflict', 409);
        domain.marketFor(current.data, body.language, body.type);
        const data = structuredClone(current.data);
        for (const date of selected) {
          const key = domain.capacityKey(body.language, body.type, date);
          if (body.reserve) data.capacityOverrides[key] = { reserve: body.reserve, released: body.released };
          else delete data.capacityOverrides[key];
        }
        const next = domain.validateSettings(data);
        for (const date of selected) {
          const window = domain.windowFor(date, 1);
          const availability = domain.availabilityWindow(all, next, body.language, body.type, window.startAt, window.endAt);
          if (availability.used > availability.capacity) domain.fail('capacityBelowBooked', 409, [{ date, ...availability }]);
        }
        const nextVersion = current.version + 1;
        return { statements: [q(env.DB, 'INSERT INTO ads_settings(id,data,version) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=excluded.version', JSON.stringify(next), nextVersion)], output: { version: nextVersion, dates: selected.length } };
      }));
    }
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
    const output = await writeOrder(env.DB, body, request.method, admin, request.headers.get('cf-connecting-ip'), adminUser);
    return json(output, request.method === 'POST' ? 201 : 200);
  } catch (error) { return errorResponse(error); }
}
export { orders, order, withWrite, reserveBatch };

import domain from '../server/ads-domain.js';
import { errorResponse, fail, json, readJson } from './common.mjs';
import { orders, withWrite } from './ads.mjs';
import { createCheckoutSession, requireStripeTest, verifyStripeWebhook } from './stripe.mjs';

const q = (db, sql, ...params) => db.prepare(sql).bind(...params);
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
const eventId = value => /^evt_[A-Za-z0-9]+$/.test(value || '');

async function start(request, env, fetcher) {
  requireStripeTest(env);
  const origin = new URL(request.url).origin;
  if (request.headers.get('origin') !== origin || env.CMS_ORIGIN && env.CMS_ORIGIN !== origin) fail('origin', 403);
  const body = await readJson(request, 1000);
  if (!uuid(body.groupId) || !uuid(body.requestId)) fail('validation');
  const group = (await orders(env.DB, true)).filter(item => item.groupId === body.groupId && item.batchRequestId === body.requestId && item.source === 'public');
  if (!group.length || group.some(item => ['cancelled', 'rejected'].includes(item.status) || item.paymentStatus !== 'unpaid' && item.paymentStatus !== 'pending')) fail('notFound', 404);
  if (group.some(item => item.reservationExpiresAt && item.reservationExpiresAt < new Date().toISOString())) fail('reservationExpired', 409);
  if (group[0].checkoutUrl && group[0].stripeSessionId) return { url: group[0].checkoutUrl, id: body.groupId };
  const amount = group.reduce((total, item) => total + item.totalPrice, 0);
  const session = await createCheckoutSession(env, { groupId: body.groupId, amount, email: group[0].email, type: group[0].type, days: group[0].days, origin }, fetcher);
  await withWrite(env.DB, async ({ all }) => {
    const current = all.filter(item => item.groupId === body.groupId && item.batchRequestId === body.requestId);
    if (current.length !== group.length || current.some(item => item.paymentStatus !== 'unpaid' && item.paymentStatus !== 'pending')) fail('conflict', 409);
    return { statements: current.map(item => {
      const updated = { ...item, paymentStatus: 'pending', paymentProvider: 'stripe', stripeSessionId: session.id, checkoutUrl: session.url, reservationExpiresAt: new Date(session.expires_at * 1000).toISOString(), updatedAt: new Date().toISOString() };
      return q(env.DB, 'UPDATE ad_orders SET data=? WHERE id=?', JSON.stringify(updated), item.id);
    }), output: null };
  });
  return { url: session.url, id: body.groupId };
}

async function status(request, env) {
  const query = new URL(request.url).searchParams;
  if (!uuid(query.get('id')) || !uuid(query.get('token'))) fail('validation');
  const group = (await orders(env.DB)).filter(item => item.groupId === query.get('id') && item.batchRequestId === query.get('token'));
  if (!group.length) fail('notFound', 404);
  return { id: query.get('id'), type: group[0].type, startDate: group[0].startDate, endDate: group[0].endDate, totalPrice: group.reduce((sum, item) => sum + item.totalPrice, 0), currency: 'EUR', paymentStatus: group[0].paymentStatus, moderationStatus: group[0].status, effectiveStatus: domain.status(group[0]) };
}

async function webhook(request, env) {
  requireStripeTest(env);
  const raw = await request.text();
  if (!await verifyStripeWebhook(raw, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET)) fail('signature', 400);
  let event;
  try { event = JSON.parse(raw); } catch { fail('validation'); }
  if (!eventId(event.id) || !/^checkout\.session\.|^charge\.refunded$/.test(event.type || '') || event.livemode !== false) fail('validation');
  if (await q(env.DB, 'SELECT id FROM ad_payment_events WHERE id=?', event.id).first()) return { received: true, duplicate: true };
  const object = event.data?.object || {};
  const groupId = object.client_reference_id || object.metadata?.group_id || null;
  const all = await orders(env.DB, true);
  const group = groupId ? all.filter(item => item.groupId === groupId && item.stripeSessionId === object.id) : all.filter(item => item.paymentId && item.paymentId === object.payment_intent);
  const relevant = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired', 'charge.refunded'].includes(event.type);
  if (relevant && !group.length) fail('paymentOrderMissing', 503);
  if (group.length && event.type.startsWith('checkout.session.') && (object.livemode !== false || object.currency !== 'eur' && !['checkout.session.expired', 'checkout.session.async_payment_failed'].includes(event.type) || object.amount_total !== group.reduce((sum, item) => sum + item.totalPrice, 0) && !['checkout.session.expired', 'checkout.session.async_payment_failed'].includes(event.type))) fail('paymentMismatch', 400);
  try {
    await withWrite(env.DB, async ({ all: current, current: settings }) => {
      const entries = current.filter(item => group.some(original => original.id === item.id));
      const statements = [q(env.DB, 'INSERT INTO ad_payment_events(id,event_type,group_id,received_at,payload_json) VALUES(?,?,?,?,?)', event.id, event.type, groupId, new Date().toISOString(), JSON.stringify({ id: event.id, type: event.type, created: event.created, objectId: object.id }))];
      const completed = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type) && object.payment_status === 'paid';
      const others = current.filter(other => !entries.some(entry => entry.id === other.id));
      const groupLate = completed && entries.some(item => {
        const windows = item.periods?.length ? item.periods.map(domain.periodWindow) : [domain.orderWindow(item)];
        return !Number.isFinite(event.created) || event.created * 1000 > Date.parse(item.reservationExpiresAt || 0) ||
          item.periods?.some(period => period.plannedStartAt <= new Date().toISOString()) ||
          windows.some(window => !domain.availabilityWindow(others, settings.data, item.language, item.type, window.startAt, window.endAt).remaining);
      });
      for (const item of entries) {
        let updated = item;
        if (completed && !['paid', 'refunded'].includes(item.paymentStatus)) {
          updated = { ...item, paymentStatus: groupLate ? 'paid_late' : 'paid', paymentId: object.payment_intent || item.paymentId, paidAt: Number.isFinite(event.created) ? new Date(event.created * 1000).toISOString() : null, status: groupLate ? 'rejected' : item.status, refundRequired: groupLate, updatedAt: new Date().toISOString() };
        } else if (['checkout.session.async_payment_failed', 'checkout.session.expired'].includes(event.type) && !['paid', 'refunded'].includes(item.paymentStatus)) {
          updated = { ...item, paymentStatus: 'failed', reservationExpiresAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        } else if (event.type === 'charge.refunded') {
          updated = { ...item, paymentStatus: 'refunded', status: 'cancelled', refundedAt: new Date().toISOString(), refundId: object.refunds?.data?.[0]?.id || null, updatedAt: new Date().toISOString() };
        }
        if (updated !== item) statements.push(q(env.DB, 'UPDATE ad_orders SET data=? WHERE id=?', JSON.stringify(updated), item.id));
      }
      return { statements, output: null };
    });
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed: ad_payment_events.id')) return { received: true, duplicate: true };
    throw error;
  }
  return { received: true };
}

export async function handleAdsPayment({ request, env }, { fetcher = fetch } = {}) {
  try {
    if (!env.DB) fail('configuration', 503);
    const action = new URL(request.url).searchParams.get('action');
    if (action === 'start' && request.method === 'POST') return json(await start(request, env, fetcher), 201);
    if (action === 'status' && request.method === 'GET') return json(await status(request, env));
    if (action === 'webhook' && request.method === 'POST') return json(await webhook(request, env));
    fail('notFound', 404);
  } catch (error) { return errorResponse(error); }
}

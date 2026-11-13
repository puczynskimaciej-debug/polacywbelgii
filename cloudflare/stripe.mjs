import { fail } from './common.mjs';

export function requireStripeTest(env) {
  if (env.STRIPE_TEST_MODE !== '1' || !env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || !env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) fail('paymentConfiguration', 503);
}

export async function createCheckoutSession(env, { groupId, amount, email, type, days, origin }, fetcher = fetch) {
  requireStripeTest(env);
  if (!Number.isSafeInteger(amount) || amount <= 0) fail('paymentAmount');
  const form = new URLSearchParams({ mode: 'payment', payment_method_types: 'card', client_reference_id: groupId, customer_email: email,
    success_url: `${origin}/zamow-ogloszenie/?payment=return&order=${groupId}`,
    cancel_url: `${origin}/zamow-ogloszenie/?payment=cancel&order=${groupId}`,
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(amount),
    'line_items[0][price_data][product_data][name]': `Ogłoszenie ${type} · ${days} dni`,
    'line_items[0][quantity]': '1',
    'metadata[group_id]': groupId,
    expires_at: String(Math.floor(Date.now() / 1000) + 1860)
  });
  let response;
  try { response = await fetcher('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `pbe-${groupId}` }, body: form, signal: AbortSignal.timeout(15000), redirect: 'error' }); }
  catch { fail('paymentUnavailable', 503); }
  if (!response.ok) fail('paymentUnavailable', 503);
  const session = await response.json();
  if (session.livemode !== false || !/^cs_test_/.test(session.id || '') || !/^https:\/\/checkout\.stripe\.com\//.test(session.url || '') || session.amount_total !== amount || session.currency !== 'eur' || session.client_reference_id !== groupId || !Number.isSafeInteger(session.expires_at)) fail('paymentResponse', 502);
  return session;
}

export async function verifyStripeWebhook(raw, signature, secret, now = Date.now()) {
  if (typeof raw !== 'string' || raw.length > 1000000 || typeof signature !== 'string' || !secret?.startsWith('whsec_')) return false;
  const parts = Object.fromEntries(signature.split(',').map(part => part.trim().split('=')));
  const timestamp = Number(parts.t);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp * 1000) > 300000 || !/^[0-9a-f]{64}$/i.test(parts.v1 || '')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const actual = Uint8Array.from(parts.v1.match(/../g), part => parseInt(part, 16));
  return crypto.subtle.verify('HMAC', key, actual, new TextEncoder().encode(`${timestamp}.${raw}`));
}

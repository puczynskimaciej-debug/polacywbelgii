import { fail } from './common.mjs';

export function stripeReady(env) {
  const test = env.STRIPE_TEST_MODE === '1';
  const live = env.STRIPE_TEST_MODE === '0' && env.STRIPE_LIVE_ENABLED === '1';
  return (test || live) && Boolean(env.STRIPE_SECRET_KEY?.startsWith(test ? 'sk_test_' : 'sk_live_')) && Boolean(env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_'));
}
export function stripeMode(env) {
  const test = env.STRIPE_TEST_MODE === '1';
  const live = env.STRIPE_TEST_MODE === '0' && env.STRIPE_LIVE_ENABLED === '1';
  if (!stripeReady(env)) fail('paymentConfiguration', 503);
  return { test, live };
}

export async function createCheckoutSession(env, { groupId, amount, email, type, days, origin }, fetcher = fetch) {
  const { test } = stripeMode(env);
  if (!Number.isSafeInteger(amount) || amount <= 0) fail('paymentAmount');
  const form = new URLSearchParams({ mode: 'payment', client_reference_id: groupId, customer_email: email,
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
  try { response = await fetcher('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `pbe-${groupId}` }, body: form, signal: AbortSignal.timeout(15000), redirect: 'manual' }); }
  catch (error) { console.error(JSON.stringify({component:'stripe-checkout',phase:'transport',error:error?.name || 'unknown',reason:String(error?.message || '').slice(0,120),cause:error?.cause?.code || null})); fail('paymentUnavailable', 503); }
  if (!response.ok) { const details=await response.clone().json().catch(()=>({})); console.error(JSON.stringify({component:'stripe-checkout',phase:'response',status:response.status,requestId:response.headers?.get('request-id') || null,errorCode:details.error?.code || null,param:details.error?.param || null})); fail('paymentUnavailable', 503); }
  const session = await response.json();
  if (session.livemode !== !test || !(test ? /^cs_test_/ : /^cs_live_/).test(session.id || '') || !/^https:\/\/checkout\.stripe\.com\//.test(session.url || '') || session.amount_total !== amount || session.currency !== 'eur' || session.client_reference_id !== groupId || !Number.isSafeInteger(session.expires_at)) fail('paymentResponse', 502);
  return session;
}

export async function verifyStripeWebhook(raw, signature, secret, now = Date.now()) {
  if (typeof raw !== 'string' || raw.length > 1000000 || typeof signature !== 'string' || !secret?.startsWith('whsec_')) return false;
  const parts = signature.split(',').map(part => part.trim().split('='));
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1]);
  const signatures = parts.filter(([key,value]) => key === 'v1' && /^[0-9a-f]{64}$/i.test(value || '')).map(([,value]) => value);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp * 1000) > 300000 || !signatures.length) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const message = new TextEncoder().encode(`${timestamp}.${raw}`);
  for (const signature of signatures) {
    const actual = Uint8Array.from(signature.match(/../g), part => parseInt(part, 16));
    if (await crypto.subtle.verify('HMAC', key, actual, message)) return true;
  }
  return false;
}

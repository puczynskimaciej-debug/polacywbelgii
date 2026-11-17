import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripeMode, stripeReady, createCheckoutSession } from '../cloudflare/stripe.mjs';

const groupId='00000000-0000-4000-8000-000000000001';
const order={groupId,amount:500,email:'sandbox@example.invalid',type:'TOP',days:1,origin:'https://polacywbelgii-test.pages.dev'};

test('production payments stay disabled without explicit live switch',async()=>{
  const env={STRIPE_TEST_MODE:'0',STRIPE_LIVE_ENABLED:'0',STRIPE_SECRET_KEY:'sk_live_placeholder',STRIPE_WEBHOOK_SECRET:'whsec_placeholder'};
  assert.equal(stripeReady(env),false);
  await assert.rejects(createCheckoutSession(env,order,()=>{throw new Error('Must not call Stripe');}));
});

test('Sandbox Checkout validates test session and idempotency key',async()=>{
  const env={STRIPE_TEST_MODE:'1',STRIPE_LIVE_ENABLED:'0',STRIPE_SECRET_KEY:'sk_test_placeholder',STRIPE_WEBHOOK_SECRET:'whsec_placeholder'};
  assert.deepEqual(stripeMode(env),{test:true,live:false});
  const session=await createCheckoutSession(env,order,async(url,request)=>{
    assert.equal(url,'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(request.headers['Idempotency-Key'],`pbe-${groupId}`);
    assert.equal(request.redirect,'manual');
    return {ok:true,async json(){return {id:'cs_test_example',url:'https://checkout.stripe.com/test',livemode:false,amount_total:500,currency:'eur',client_reference_id:groupId,expires_at:Math.floor(Date.now()/1000)+1800};}};
  });
  assert.equal(session.livemode,false);
});

test('Live code path requires explicit switch and live key',async()=>{
  const env={STRIPE_TEST_MODE:'0',STRIPE_LIVE_ENABLED:'1',STRIPE_SECRET_KEY:'sk_live_placeholder',STRIPE_WEBHOOK_SECRET:'whsec_placeholder'};
  assert.deepEqual(stripeMode(env),{test:false,live:true});
  const session=await createCheckoutSession(env,order,async()=>({ok:true,async json(){return {id:'cs_live_example',url:'https://checkout.stripe.com/live',livemode:true,amount_total:500,currency:'eur',client_reference_id:groupId,expires_at:Math.floor(Date.now()/1000)+1800};}}));
  assert.equal(session.livemode,true);
  assert.equal(stripeReady({...env,STRIPE_LIVE_ENABLED:'0'}),false);
});

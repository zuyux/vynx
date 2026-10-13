import test from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST } from '../app/api/monthly-offers/route.ts';
import { MONTHLY_POLICY, renewalAvailable } from '../lib/monthly-offer.ts';

test('monthly checkout authenticates, binds the payer and policy, and protects foreign invoices', async () => {
  const keys = ['SUPABASE_URL','SUPABASE_SECRET_KEY','NEXT_PUBLIC_APP_URL','VYNX_ALIAS_REGISTRY_ENABLED'];
  const saved = keys.map(key => process.env[key]), original = globalThis.fetch;
  const origin = 'https://monthly.example', id = '12345678-1234-1234-1234-123456789abc';
  Object.assign(process.env, { SUPABASE_URL:'https://monthly.supabase.co', SUPABASE_SECRET_KEY:'test', NEXT_PUBLIC_APP_URL:origin, VYNX_ALIAS_REGISTRY_ENABLED:'false' });
  const subscription = { id,creator_wallet:'creator',payer_wallet:'verified-fan',creator_alias:'coach',offer_key:'coaching',terms:{title:'Coaching'},price_units:40000000,paid_until:null,stopped_at:null };
  const invoice = { id,subscription_id:id,period_start:'2026-10-12T00:00:00Z',period_end:'2026-11-12T00:00:00Z',price_units:40000000,state:'awaiting_payment',transaction:null };
  let calls = 0, foreign = false;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input,init), url = new URL(request.url), name = url.pathname.split('/').at(-1);
    if (name==='consume_public_endpoint_limit') return Response.json({allowed:true,retry_after:60});
    if (name==='wallet_sessions') return Response.json([{wallet:'verified-fan'}]);
    if (name==='cards_users') return Response.json({wallet_address:'creator',username:'coach'});
    if (name==='monthly_subscriptions') {
      if (url.searchParams.has('payer_wallet')) { assert.equal(url.searchParams.get('payer_wallet'),'eq.verified-fan'); return Response.json(foreign ? null : subscription); }
      assert.match(url.searchParams.get('or'),/payer_wallet.eq.verified-fan/); return Response.json([subscription]);
    }
    if (name==='monthly_invoices') return Response.json(url.searchParams.has('id') ? invoice : [invoice]);
    if (name==='call_bookings') return Response.json([]);
    if (name==='reserve_monthly_offer') {
      assert.deepEqual(await request.json(),{payer:'verified-fan',alias:'coach',offer_key:'coaching'}); calls++;
      return Response.json({subscription,invoice});
    }
    if (name==='stop_monthly_subscription') { assert.deepEqual(await request.json(),{subscription:id,payer:'verified-fan'}); return Response.json(null); }
    throw Error(name);
  };
  const request = (body, headers={}) => new Request(`${origin}/api/monthly-offers`,{method:'POST',headers:{origin,cookie:`vynx-session=${'a'.repeat(64)}`,...headers},body:JSON.stringify(body)});
  try {
    const body = {action:'reserve',alias:'coach',offer:'coaching',accepted_policy:MONTHLY_POLICY,payer:'forged',price:'1'};
    assert.equal((await POST(request(body,{origin:'https://attacker.example'}))).status,403);
    assert.equal((await POST(request(body,{cookie:''}))).status,401);
    assert.equal((await POST(request({...body,accepted_policy:''}))).status,400);
    assert.equal((await POST(request({...body,alias:'../coach'}))).status,400);
    assert.equal((await POST(request({padding:'a'.repeat(3000)}))).status,413);
    const first=await(await POST(request(body))).json(),again=await(await POST(request(body))).json();
    assert.deepEqual(first,again); assert.equal(calls,2); assert.equal(first.subscription.payer_wallet,undefined); assert.equal(first.invoice.transaction,undefined);
    foreign=true;
    assert.equal((await POST(request({action:'checkout',invoice:id}))).status,404);
    assert.equal((await GET(new Request(`${origin}/api/monthly-offers?invoice=${id}`,{headers:{cookie:`vynx-session=${'a'.repeat(64)}`}}))).status,404);
    foreign=false;
    assert.equal((await POST(request({action:'stop',subscription:id}))).status,200);
    const snapshot=await(await GET(new Request(`${origin}/api/monthly-offers`,{headers:{cookie:`vynx-session=${'a'.repeat(64)}`}}))).json();
    assert.equal(snapshot.subscriptions[0].role,'fan'); assert.equal(snapshot.invoices[0].prepared,false);
    assert.equal((await GET(new Request(`${origin}/api/monthly-offers`))).status,401);
  } finally { globalThis.fetch=original; keys.forEach((key,index)=>saved[index]===undefined ? delete process.env[key] : process.env[key]=saved[index]); }
});
test('renewal prompts open seven days before the due date and stop after cancellation', () => {
  const now=Date.parse('2026-10-12T12:00:00Z'),plan={paid_until:'2026-10-20T12:00:00Z',stopped_at:null};
  assert.equal(renewalAvailable(plan,now),false);
  assert.equal(renewalAvailable({...plan,paid_until:'2026-10-19T12:00:00Z'},now),true);
  assert.equal(renewalAvailable({...plan,paid_until:null},now),true);
  assert.equal(renewalAvailable({...plan,paid_until:null,stopped_at:'2026-10-11T12:00:00Z'},now),false);
});

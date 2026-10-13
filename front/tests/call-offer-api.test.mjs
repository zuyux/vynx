import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair } from '@solana/web3.js';
import { GET, PUT } from '../app/api/call-offer/route.ts';

const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
test('creators enable and pause services in the database without a separate on-chain registration', async () => {
  const keys = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'NEXT_PUBLIC_APP_URL', 'VYNX_ALIAS_REGISTRY_ENABLED'];
  const saved = keys.map(key => process.env[key]), originalFetch = globalThis.fetch;
  const origin = 'https://vynx.example', wallet = Keypair.generate().publicKey.toBase58();
  Object.assign(process.env, { SUPABASE_URL: 'https://offers.supabase.co', SUPABASE_SECRET_KEY: 'test', NEXT_PUBLIC_APP_URL: origin, VYNX_ALIAS_REGISTRY_ENABLED: 'false' });
  let offer = null, writes = 0;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init), url = new URL(request.url);
    assert.equal(url.hostname, 'offers.supabase.co', 'service setup must not call the booking program');
    const name = url.pathname.split('/').at(-1);
    if (name === 'consume_public_endpoint_limit') return json({ allowed: true, retry_after: 60 });
    if (name === 'wallet_sessions') return json([{ wallet, expires_at: new Date(Date.now() + 100000).toISOString() }]);
    if (name === 'cards_users') return json([{ username: 'alice' }]);
    if (name === 'call_offers') {
      if (request.method === 'POST') {
        writes++; const fields = await request.json();
        assert.equal(fields.creator_wallet, wallet);
        offer = { ...fields, id: 'service', updated_at: new Date().toISOString() };
        return json(offer);
      }
      return json(offer ? [offer] : []);
    }
    throw Error(`Unexpected database request ${name}`);
  };
  const request = (method, body, headers = {}) => new Request(`${origin}/api/call-offer`, { method, headers: { origin, 'Content-Type': 'application/json', cookie: `vynx-session=${'a'.repeat(64)}`, ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const draft = { title: 'Portfolio call', description: 'Review your portfolio and next steps.', duration_minutes: 30, price: '10', timezone: 'UTC', availability: [{ weekday: 1, start: '09:00', end: '12:00' }], accepting: true };
  try {
    assert.equal((await (await GET(request('GET'))).json()).offer, null);
    const enabled = await PUT(request('PUT', { ...draft, creator_wallet: 'forged' }));
    assert.equal(enabled.status, 200);
    assert.equal((await enabled.json()).offer.accepting, true);
    const loaded = await (await GET(request('GET'))).json();
    assert.equal(loaded.offer.accepting, true); assert.deepEqual(loaded.offer.availability, draft.availability);
    assert.equal((await PUT(request('PUT', { ...draft, accepting: false }))).status, 200);
    assert.equal((await (await GET(request('GET'))).json()).offer.accepting, false);
    assert.equal((await PUT(request('PUT', draft, { cookie: '' }))).status, 401);
    assert.equal((await PUT(request('PUT', draft, { origin: 'https://evil.example' }))).status, 403);
    assert.equal(writes, 2);
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, index) => { if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index]; });
  }
});

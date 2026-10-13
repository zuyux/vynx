import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateKey, sign } from 'node:crypto';
import { Keypair } from '@solana/web3.js';
import { PATCH } from '../app/api/profile/route.ts';
import { EMPTY_DRAFT } from '../lib/creator-draft.ts';
import { saveCreatorProfile } from '../lib/creator-save-client.ts';
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const signText = (key, message) => sign(null, Buffer.from(message), createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(key.secretKey.slice(0, 32))]), format: 'der', type: 'pkcs8' })).toString('hex');

test('offer publication requires a fresh owner signature bound to content and consumes it once, including offer removal', async () => {
  const keys = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'NEXT_PUBLIC_APP_URL', 'VYNX_ALIAS_REGISTRY_ENABLED'];
  const saved = keys.map(key => process.env[key]), originalFetch = globalThis.fetch;
  const signer = Keypair.generate(), wallet = signer.publicKey.toBase58(), origin = 'https://vynx.example';
  Object.assign(process.env, { SUPABASE_URL: 'https://offer-auth.supabase.co', SUPABASE_SECRET_KEY: 'test', NEXT_PUBLIC_APP_URL: origin, VYNX_ALIAS_REGISTRY_ENABLED: 'false' });
  let writes = 0;
  const challenges = new Map();
  let owner = { id: 'creator', username: 'alice', updated_at: '2026-10-12T00:00:00.000Z', avatar_url: '', banner_url: '', design: { ...EMPTY_DRAFT, offers: [] } };
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init), url = new URL(request.url), name = url.pathname.split('/').at(-1);
    if (name === 'consume_public_endpoint_limit') return json({ allowed: true, retry_after: 60 });
    if (name === 'wallet_sessions') return json([{ wallet }]);
    if (name === 'creator_image_cleanup') return json([]);
    if (name === 'cards_users') {
      if (request.method === 'PATCH') { writes++; owner = { ...owner, ...await request.json(), updated_at: `2026-10-12T00:00:0${writes}.000Z` }; return json(owner); }
      return json([owner]);
    }
    if (name === 'sponsor_challenges') {
      if (request.method === 'HEAD') return new Response(null, { headers: { 'Content-Range': '0-0/0' } });
      if (request.method === 'POST') { const row = await request.json(); challenges.set(row.id, row); return json(null); }
      const id = url.searchParams.get('id')?.slice(3), row = challenges.get(id);
      if (request.method === 'DELETE') { if (!row) return json([]); challenges.delete(id); return json([{ id }]); }
      return json(row ?? null);
    }
    throw Error(`Unexpected request ${name}`);
  };
  const body = { design: { ...EMPTY_DRAFT, alias: 'alice', name: 'Alice', offers: [{ id: 'one', type: 'digital', title: 'Guide', description: 'A useful guide', price: '10', url: '' }] }, published: true, tips_enabled: true };
  const request = payload => new Request(`${origin}/api/profile`, { method: 'PATCH', headers: { origin, cookie: `vynx-session=${'a'.repeat(64)}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  try {
    assert.equal((await PATCH(request(body))).status, 401); assert.equal(writes, 0);
    const challenge = await (await PATCH(request({ ...body, phase: 'challenge' }))).json();
    assert.equal(challenge.required, true); assert.equal(writes, 0); assert.match(challenge.message, /Guide/);
    const approval = { challenge: challenge.id, signature: signText(signer, challenge.message) };
    const changed = { ...body, design: { ...body.design, offers: [{ ...body.design.offers[0], price: '20' }] }, ...approval };
    assert.equal((await PATCH(request(changed))).status, 400); assert.equal(writes, 0);
    assert.equal((await PATCH(request({ ...body, ...approval, signature: signText(Keypair.generate(), challenge.message) }))).status, 400);
    assert.equal((await PATCH(request({ ...body, ...approval }))).status, 200); assert.equal(writes, 1);
    assert.notEqual((await PATCH(request({ ...body, ...approval }))).status, 200); assert.equal(writes, 1);
    const removal = { ...body, design: { ...body.design, offers: [] } };
    assert.equal((await PATCH(request(removal))).status, 401);
    const removeChallenge = await (await PATCH(request({ ...removal, phase: 'challenge' }))).json();
    assert.equal(removeChallenge.required, true);
    assert.equal((await PATCH(request({ ...removal, challenge: removeChallenge.id, signature: signText(signer, removeChallenge.message) }))).status, 200);
    assert.equal(owner.design.offers.length, 0); assert.equal(writes, 2);
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, index) => { if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index]; });
  }
});

test('cancelled wallet approval never submits profile changes', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (_url, init) => { calls.push(JSON.parse(init.body)); return json({ required: true, id: 'challenge', message: 'Approve offers' }); };
  try {
    await assert.rejects(saveCreatorProfile({ ensureSession: async () => 'wallet', signMessage: async () => { throw Error('Wallet rejected'); } }, 'wallet', { design: EMPTY_DRAFT, published: true, tips_enabled: true }), /Wallet rejected/);
    assert.equal(calls.length, 1); assert.equal(calls[0].phase, 'challenge');
  } finally { globalThis.fetch = originalFetch; }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../app/api/dashboard/route.ts';
import { PATCH } from '../app/api/profile/route.ts';
import { EMPTY_DRAFT } from '../lib/creator-draft.ts';

const wallet = '11111111111111111111111111111111';
const origin = 'https://vynx.example';
const headers = { cookie: `vynx-session=${'a'.repeat(64)}`, origin, 'Content-Type': 'application/json' };
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

test('creator activity privacy is private by default, persisted and scoped to the owner', async () => {
  const originalFetch = globalThis.fetch;
  const keys = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'NEXT_PUBLIC_APP_URL'];
  const previous = keys.map(key => process.env[key]);
  process.env.SUPABASE_URL = 'https://privacy.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-key';
  process.env.NEXT_PUBLIC_APP_URL = origin;
  let preference = false;
  let update;
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    if (url.pathname.endsWith('/rpc/consume_public_endpoint_limit')) return json({ allowed: true, retry_after: 60 });
    if (url.pathname.endsWith('/wallet_sessions')) return json([{ wallet }]);
    if (url.pathname.endsWith('/cards_users')) {
      if (req.method === 'PATCH') {
        assert.equal(url.searchParams.get('wallet_address'), `eq.${wallet}`);
        update = await req.json();
        if ('show_payer_addresses' in update) preference = update.show_payer_addresses;
        return json({ ...update });
      }
      assert.equal(url.searchParams.get('wallet_address'), `eq.${wallet}`);
      return json([{ id: 'creator-id', username: 'alice', updated_at: '2026-01-01', avatar_url: '', banner_url: '', show_payer_addresses: preference }]);
    }
    if (url.pathname.endsWith('/creator_tip_summary')) return json({ count: 1, lamports: '10000', usdc_units: '0' });
    if (url.pathname.endsWith('/creator_image_cleanup')) return json([]);
    if (url.pathname.endsWith('/tips')) {
      assert.equal(url.searchParams.get('creator_id'), 'eq.creator-id');
      const includesPayer = url.searchParams.get('select').split(',').includes('payer');
      assert.equal(includesPayer, preference === true);
      return json([{ id: 'tip-id', lamports: 10000, ...(includesPayer ? { payer: 'fan-wallet' } : {}) }]);
    }
    throw Error(`Unexpected request: ${url.pathname}`);
  };
  const dashboard = () => GET(new Request(`${origin}/api/dashboard`, { headers }));
  const save = privacy => PATCH(new Request(`${origin}/api/profile`, { method: 'PATCH', headers, body: JSON.stringify({ design: { ...EMPTY_DRAFT, alias: 'alice', name: 'Alice' }, published: false, tips_enabled: true, ...privacy }) }));
  try {
    assert.equal((await GET(new Request(`${origin}/api/dashboard`))).status, 401);
    assert.equal('payer' in (await (await dashboard()).json()).tips.recent[0], false);
    assert.equal((await save({ show_payer_addresses: 'true' })).status, 400);
    for (const enabled of [true, false]) {
      assert.equal((await save({ show_payer_addresses: enabled })).status, 200);
      assert.equal(update.show_payer_addresses, enabled);
      const response = await dashboard();
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.equal('payer' in (await response.json()).tips.recent[0], enabled);
    }
    preference = true;
    assert.equal((await save({})).status, 200);
    assert.equal('show_payer_addresses' in update, false);
    assert.equal(preference, true);
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; });
  }
});

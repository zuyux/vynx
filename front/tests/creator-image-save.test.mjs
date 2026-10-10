import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { PATCH } from '../app/api/profile/route.ts';
import { EMPTY_DRAFT } from '../lib/creator-draft.ts';
const wallet = '11111111111111111111111111111111';
const origin = 'https://vynx.example';
const design = { ...EMPTY_DRAFT, alias: 'alice', name: 'Alice' };
const owner = { id: 'creator-id', username: 'alice', updated_at: '2026-01-01T00:00:00Z', avatar_url: '', banner_url: '' };
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
function request(value, authenticated = true, requestOrigin = origin) {
  return new Request(`${origin}/api/profile`, { method: 'PATCH', headers: { origin: requestOrigin, 'Content-Type': 'application/json', ...(authenticated ? { cookie: `vynx-session=${'a'.repeat(64)}` } : {}) }, body: JSON.stringify({ design: value, published: false, tips_enabled: true }) });
}
test('profile image saves enforce authorization, validate bytes, persist URLs and recover failed writes', async t => {
  const before = { fetch: globalThis.fetch, url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY, app: process.env.NEXT_PUBLIC_APP_URL };
  process.env.SUPABASE_URL = 'https://image-save.supabase.co'; process.env.SUPABASE_SECRET_KEY = 'test-key'; process.env.NEXT_PUBLIC_APP_URL = origin;
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#aabbcc' } }).png().toBuffer();
  const input = { ...design, avatar: `data:image/png;base64,${png.toString('base64')}` };
  let calls; let stored; let mode;
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init); const url = new URL(req.url); calls.push({ path: url.pathname, method: req.method, params: url.searchParams });
    if (url.pathname.endsWith('/creator_image_cleanup')) return json(req.method === 'GET' ? [] : null);
    if (url.pathname.endsWith('/wallet_sessions')) return json([{ wallet }]);
    if (url.pathname.endsWith('/cards_users') && req.method === 'GET') return json([mode === 'committed' && stored ? { ...owner, avatar_url: stored.avatar } : owner]);
    if (url.pathname.startsWith('/storage/v1/object/')) {
      if (req.method === 'DELETE') return json([]);
      return json({ Key: url.pathname.slice('/storage/v1/object/'.length) });
    }
    if (url.pathname.endsWith('/cards_users') && req.method === 'PATCH') {
      stored = (await req.json()).design;
      if (mode === 'conflict') return json(null);
      if (mode === 'committed' || mode === 'failed') return new Response('{}', { status: 500, headers: { 'Content-Type': 'application/json' } });
      return json({ ...owner, design: stored });
    }
    throw Error('Unexpected test request');
  };
  try {
    for (const [label, value, auth, reqOrigin, expected] of [
      ['unauthenticated', input, false, origin, 401], ['foreign origin', input, true, 'https://evil.example', 403],
      ['different alias', { ...input, alias: 'bob' }, true, origin, 403],
      ['forged raster', { ...input, avatar: 'data:image/png;base64,AAAA' }, true, origin, 400],
      ['foreign image', { ...input, avatar: 'https://image-save.supabase.co/storage/v1/object/public/creator-images/22222222222222222222222222222222/12345678-1234-4123-8123-123456789abc.png' }, true, origin, 403],
    ]) await t.test(label, async () => { calls = []; mode = 'ok'; stored = null; assert.equal((await PATCH(request(value, auth, reqOrigin))).status, expected); assert.equal(calls.some(call => call.path.startsWith('/storage/v1/')), false); });
    await t.test('successful upload stores a URL and scopes update to owner and version', async () => {
      calls = []; mode = 'ok'; stored = null;
      assert.equal((await PATCH(request(input))).status, 200);
      assert.match(stored.avatar, /\/storage\/v1\/object\/public\/creator-images\//);
      const update = calls.find(call => call.method === 'PATCH');
      assert.equal(update.params.get('wallet_address'), `eq.${wallet}`);
      assert.equal(update.params.get('updated_at'), `eq.${owner.updated_at}`);
    });
    for (const status of ['failed', 'conflict', 'committed']) await t.test(status, async () => {
      calls = []; mode = status; stored = null;
      assert.equal((await PATCH(request(input))).status, status === 'conflict' ? 409 : 503);
      assert.equal(calls.some(call => call.method === 'DELETE'), false);
      assert.equal(calls.some(call => call.path.endsWith('/creator_image_cleanup') && call.method === 'PATCH'), status !== 'committed');
    });
  } finally {
    globalThis.fetch = before.fetch;
    for (const [key, value] of [['SUPABASE_URL', before.url], ['SUPABASE_SECRET_KEY', before.key], ['NEXT_PUBLIC_APP_URL', before.app]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

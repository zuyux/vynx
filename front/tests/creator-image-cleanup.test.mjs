import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { processCreatorImageCleanup, trackCreatorImageUpload } from '../lib/creator-image-cleanup.ts';
const base = 'https://cleanup.supabase.co';
const wallet = '11111111111111111111111111111111';
const path = `${wallet}/12345678-1234-4123-8123-123456789abc.png`;
const objectUrl = `${base}/storage/v1/object/public/creator-images/${path}`;
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
test('cleanup validates jobs, uses exclusive database claims, records failures and keeps tombstones', async t => {
  const previous = { fetch: globalThis.fetch, url: process.env.SUPABASE_URL };
  process.env.SUPABASE_URL = base;
  let mode; let calls;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init); const url = new URL(request.url);
    const body = request.method === 'GET' ? null : await request.json();
    calls.push({ method: request.method, path: url.pathname, params: url.searchParams, body });
    if (url.pathname.endsWith('/creator_image_cleanup') && request.method === 'GET') return mode === 'query-failure' ? json({ message: 'unavailable' }, 503) : json([{ object_url: mode === 'foreign' ? objectUrl.replace(base, 'https://evil.example') : objectUrl, wallet }]);
    if (url.pathname.endsWith('/claim_creator_image_cleanup')) return mode === 'claim-failure' ? json({}, 500) : json(mode === 'referenced' || mode === 'claimed-by-other-worker' ? null : { object_url: objectUrl, wallet, attempts: 2, lease_id: 'lease-one' });
    if (url.pathname.startsWith('/storage/v1/object/')) return mode === 'storage-failure' ? json({ message: 'internal secret', error: 'Unavailable', statusCode: '503' }, 503) : json([{ name: path }]);
    return json(null);
  };
  const db = createClient(base, 'test-key');
  try {
    for (const state of ['ok', 'foreign', 'referenced', 'claimed-by-other-worker', 'claim-failure', 'storage-failure', 'query-failure']) await t.test(state, async () => {
      mode = state; calls = [];
      if (mode === 'query-failure') { await assert.rejects(processCreatorImageCleanup(db)); return; }
      const result = await processCreatorImageCleanup(db, { wallet, limit: 4 });
      assert.equal(calls[0].params.get('wallet'), `eq.${wallet}`);
      assert.equal(calls[0].params.get('limit'), '4');
      const deletion = calls.find(call => call.method === 'DELETE');
      const finalization = calls.find(call => call.method === 'PATCH');
      if (mode === 'ok') {
        assert.deepEqual(deletion.body.prefixes, [path]); assert.equal(result.deleted, 1);
        assert.equal(finalization.body.state, 'deleted'); assert.equal(finalization.params.get('lease_id'), 'eq.lease-one');
      } else if (mode === 'foreign') {
        assert.equal(deletion, undefined); assert.equal(result.blocked, 1); assert.equal(finalization.body.state, 'blocked');
      } else if (mode === 'storage-failure') {
        assert.equal(result.failed, 1); assert.equal(finalization.body.state, undefined);
        assert.equal(finalization.params.get('state'), 'eq.deleting');
        assert.equal(finalization.body.last_error_code, 'STORAGE_DELETE_FAILED');
        assert(new Date(finalization.body.next_attempt_at).getTime() > Date.now());
        assert(!JSON.stringify(finalization.body).includes('internal secret'));
      } else { assert.equal(deletion, undefined); assert.equal(result[mode === 'claim-failure' ? 'failed' : 'deferred'], 1); }
    });
    await t.test('upload manifests exist before Storage upload and give pending saves a grace period', async () => {
      calls = []; mode = 'ok'; await trackCreatorImageUpload(db, wallet, path);
      assert.equal(calls[0].body.object_url, objectUrl); assert.equal(calls[0].body.wallet, wallet);
      assert(new Date(calls[0].body.next_attempt_at).getTime() >= Date.now() + 59 * 60_000);
    });
  } finally {
    globalThis.fetch = previous.fetch;
    if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
  }
});

test('older-object discovery queues only canonical images, skipping fresh files and unknown paths', async () => {
  const { discoverCreatorImageOrphans } = await import('../lib/creator-image-cleanup.ts');
  const oldUrl = process.env.SUPABASE_URL; process.env.SUPABASE_URL = base;
  const queued = [];
  const db = { from: () => ({ upsert: value => ({ select: async () => { queued.push(value); return { data: [value], error: null }; } }) }), storage: { from: () => ({
    getPublicUrl: path => ({ data: { publicUrl: `${base}/storage/v1/object/public/creator-images/${path}` } }),
    list: async prefix => ({ data: prefix ? [
      { name: path.split('/')[1], created_at: new Date(0).toISOString() },
      { name: '12345678-1234-4123-8123-123456789abd.png', created_at: new Date().toISOString() },
      { name: '../wrong.png', created_at: new Date(0).toISOString() },
      { name: 'old.svg', created_at: new Date(0).toISOString() },
    ] : [{ name: wallet }, { name: 'unexpected' }], error: null }),
  }) } };
  try {
    assert.deepEqual(await discoverCreatorImageOrphans(db), { queued: 1 });
    assert.deepEqual(queued, [{ object_url: objectUrl, wallet }]);
  } finally { if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl; }
});

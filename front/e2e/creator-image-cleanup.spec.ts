import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { Keypair } from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';
import { processCreatorImageCleanup } from '../lib/creator-image-cleanup';
import { EMPTY_DRAFT } from '../lib/creator-draft';
const db = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
const anon = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const bucket = 'creator-images';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
async function fixture() {
  const client = db(); const wallet = Keypair.generate().publicKey.toBase58(); const alias = `cleanup_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const path = `${wallet}/${randomUUID()}.png`;
  expect((await client.storage.from(bucket).upload(path, png, { contentType: 'image/png' })).error).toBeNull();
  const url = client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  expect((await client.from('cards_users').insert({ username: alias, wallet_address: wallet, avatar_url: url, design: { ...EMPTY_DRAFT, alias, name: 'Cleanup test', avatar: url } })).error).toBeNull();
  return { client, wallet, alias, path, url };
}
async function due(client: ReturnType<typeof db>, url: string) {
  expect((await client.from('creator_image_cleanup').update({ next_attempt_at: new Date(0).toISOString() }).eq('object_url', url)).error).toBeNull();
}

test('cleanup is queued atomically, preserves shared references, removes images and protects tombstones', async ({ request }) => {
  const f = await fixture();
  expect((await f.client.from('sponsor_profiles').insert({ wallet: f.wallet, alias: f.alias, display_name: 'Cleanup test', price_cents: 100, duration_days: 7, design: { avatar: f.url } })).error).toBeNull();
  expect((await f.client.from('cards_users').update({ avatar_url: '', design: { ...EMPTY_DRAFT, alias: f.alias, name: 'Cleanup test' } }).eq('wallet_address', f.wallet)).error).toBeNull();
  const pending = await f.client.from('creator_image_cleanup').select('state').eq('object_url', f.url).single();
  expect(pending.data!.state).toBe('pending');
  expect((await processCreatorImageCleanup(f.client, { wallet: f.wallet })).deferred).toBe(1);
  expect((await request.get(f.url)).status()).toBe(200);
  expect((await f.client.from('sponsor_profiles').update({ design: null }).eq('wallet', f.wallet)).error).toBeNull();
  // Simulate a process stopping after claiming, before Storage deletion.
  const claims = await Promise.all([f.client.rpc('claim_creator_image_cleanup', { candidate_url: f.url }), f.client.rpc('claim_creator_image_cleanup', { candidate_url: f.url })]);
  expect(claims.filter(result => result.data)).toHaveLength(1);
  expect((await f.client.from('cards_users').update({ avatar_url: f.url }).eq('wallet_address', f.wallet)).error?.code).toBe('23514');
  await due(f.client, f.url);
  expect((await processCreatorImageCleanup(f.client, { wallet: f.wallet })).deleted).toBe(1);
  expect((await request.get(f.url)).status()).toBe(404);
  expect((await f.client.from('cards_users').update({ design: { avatar: f.url } }).eq('wallet_address', f.wallet)).error?.code).toBe('23514');
  expect((await f.client.from('sponsor_profiles').update({ design: { cover: f.url } }).eq('wallet', f.wallet)).error?.code).toBe('23514');
  expect((await processCreatorImageCleanup(f.client, { wallet: f.wallet })).deleted).toBe(0);
  expect((await anon().from('creator_image_cleanup').select('*')).error).not.toBeNull();
  expect((await anon().rpc('claim_creator_image_cleanup', { candidate_url: f.url })).error).not.toBeNull();
});

test('failed Storage deletion remains retryable and an expired upload is reclaimed', async ({ request }) => {
  const f = await fixture();
  expect((await f.client.from('cards_users').delete().eq('wallet_address', f.wallet)).error).toBeNull();
  await request.post(`${process.env.E2E_FIXTURE_URL}/test/storage`, { data: { failDeletes: 1 } });
  expect((await processCreatorImageCleanup(f.client, { wallet: f.wallet })).failed).toBe(1);
  const failed = await f.client.from('creator_image_cleanup').select('*').eq('object_url', f.url).single();
  expect(failed.data!.state).toBe('deleting'); expect(failed.data!.last_error_code).toBe('STORAGE_DELETE_FAILED');
  expect((await request.get(f.url)).status()).toBe(200);
  await due(f.client, f.url);
  expect((await processCreatorImageCleanup(f.client, { wallet: f.wallet })).deleted).toBe(1);
  expect((await request.get(f.url)).status()).toBe(404);
  const path = `${f.wallet}/${randomUUID()}.png`;
  const url = f.client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  expect((await f.client.from('creator_image_cleanup').insert({ object_url: url, wallet: f.wallet })).error).toBeNull();
  expect((await f.client.storage.from(bucket).upload(path, png, { contentType: 'image/png' })).error).toBeNull();
  expect((await processCreatorImageCleanup(f.client, { wallet: f.wallet })).deleted).toBe(1);
  expect((await request.get(url)).status()).toBe(404);
});

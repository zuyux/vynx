import { test, expect } from './test';
import { createClient } from '@supabase/supabase-js';
import { Keypair } from '@solana/web3.js';
import { aliasAvailabilityClientHash } from '../lib/alias-availability';

test('public alias checks enforce a shared atomic quota and reset after expiry', async ({ request }) => {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
  const clientHash = aliasAvailabilityClientHash(new Request('http://localhost/api/aliases'), process.env.SUPABASE_SECRET_KEY!, false);
  const alias = `availability_${Date.now()}`;
  const wallet = Keypair.generate().publicKey.toBase58();
  const reset = async () => expect((await db.from('alias_availability_limits').delete().eq('client_hash', clientHash)).error).toBeNull();
  await reset();
  try {
    expect((await db.from('cards_users').insert({ wallet_address: wallet, username: alias })).error).toBeNull();
    const taken = await request.get(`/api/aliases?alias=${alias.toUpperCase()}`);
    expect(taken.status()).toBe(200);
    expect(await taken.json()).toEqual({ alias, available: false });
    expect(taken.headers()['cache-control']).toBe('no-store');
    const free = await request.get(`/api/aliases?alias=free_${Date.now()}`);
    expect(free.status()).toBe(200);
    expect((await free.json()).available).toBe(true);
    expect((await request.get('/api/aliases?alias=admin')).status()).toBe(400);
    expect((await request.get('/api/aliases')).status()).toBe(400);

    await reset();
    const responses = await Promise.all(Array.from({ length: 45 }, (_, index) => request.get('/api/aliases?alias=available_name', {
      headers: { 'x-forwarded-for': `192.0.2.${index + 1}`, 'x-vercel-forwarded-for': `192.0.2.${index + 1}` },
    })));
    expect(responses.filter(response => response.status() === 200)).toHaveLength(30);
    expect(responses.filter(response => response.status() === 429)).toHaveLength(15);
    for (const response of responses.filter(response => response.status() === 429)) {
      expect(Number(response.headers()['retry-after'])).toBeGreaterThan(0);
      expect(Number(response.headers()['retry-after'])).toBeLessThanOrEqual(60);
      expect(response.headers()['cache-control']).toBe('no-store');
    }
    expect((await db.from('alias_availability_limits').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('client_hash', clientHash)).error).toBeNull();
    expect((await request.get('/api/aliases?alias=available_name')).status()).toBe(200);

    const anonymous = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
    expect((await anonymous.from('alias_availability_limits').select('*')).error).not.toBeNull();
    expect((await anonymous.rpc('consume_alias_availability_limit', { client_hash: clientHash })).error).not.toBeNull();
  } finally {
    await reset();
    expect((await db.from('cards_users').delete().eq('wallet_address', wallet)).error).toBeNull();
  }
});

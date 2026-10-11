import { test, expect } from './test';
import { createClient } from '@supabase/supabase-js';
import { Keypair } from '@solana/web3.js';
import { createPrivateKey, sign } from 'node:crypto';
import { EMPTY_DRAFT } from '../lib/creator-draft';

test('public projections, cookie sessions, origin checks and RLS enforce the intended trust boundaries', async ({ page }) => {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
  const anonymous = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
  const origin = process.env.E2E_BASE_URL!;
  const request = page.context().request;
  const owner = Keypair.generate();
  const wallet = owner.publicKey.toBase58();
  const alias = `audit_${Date.now()}`;
  const privateName = 'PRIVATE_UNPUBLISHED_CARD';
  const signature = 'PRIVATE_SPONSOR_PAYMENT';
  const futureEnd = new Date(Date.now() + 86400000).toISOString();
  const expectOk = (result: { error: unknown }) => expect(result.error).toBeNull();
  expectOk(await db.from('public_endpoint_limits').delete().neq('client_hash', ''));
  expectOk(await db.from('cards_users').insert({ wallet_address: wallet, username: alias, published: false,
    design: { ...EMPTY_DRAFT, alias, name: privateName } }));
  expectOk(await db.from('sponsor_profiles').insert({ wallet, alias, display_name: 'Published offer', price_cents: 100, duration_days: 7,
    design: { ...EMPTY_DRAFT, alias, name: 'Published offer', private_notes: 'PRIVATE_JSON_PROPERTY' } }));
  expectOk(await db.from('sponsor_requests').insert({ creator_wallet: wallet, brand_wallet: Keypair.generate().publicKey.toBase58(),
    brand_name: 'Public brand', headline: 'Public ad', description: 'Public description', destination_url: 'https://example.org',
    price_cents: 100, duration_days: 7, status: 'active', payment_signature: signature,
    starts_at: new Date(Date.now() - 1000).toISOString(), ends_at: futureEnd }));
  try {
    for (const table of ['cards_users', 'sponsor_profiles', 'sponsor_requests', 'sponsor_challenges', 'wallet_nonces', 'wallet_sessions',
      'tips', 'alias_registration_intents', 'creator_image_cleanup', 'alias_availability_limits', 'public_endpoint_limits', 'error_alerts', 'error_alert_receipts']) {
      expect((await anonymous.from(table).select('*')).error).not.toBeNull();
    }
    expect((await anonymous.rpc('creator_tip_summary', { owner_wallet: wallet })).error).not.toBeNull();
    expect((await request.get('/api/profile')).status()).toBe(401);
    const lookup = await request.get(`/api/profile?wallet=${wallet}`);
    expect(await lookup.json()).toEqual({ profile: { username: alias, wallet_address: wallet } });
    const privatePage = await request.get(`/${alias}`);
    expect(await privatePage.text()).not.toContain(privateName);
    expect((await request.get(`/api/actions/tip/${alias}`)).status()).toBe(404);

    const sponsorship = await request.get(`/api/sponsorships?alias=${alias}`);
    expect(sponsorship.status()).toBe(200);
    const publicBody = await sponsorship.text();
    for (const value of [signature, privateName, 'PRIVATE_JSON_PROPERTY', 'payment_signature', 'brand_wallet', 'created_at']) expect(publicBody).not.toContain(value);
    expect(JSON.parse(publicBody).ad.headline).toBe('Public ad');

    const issue = await request.post('/api/auth/nonce', { headers: { origin }, data: { wallet } });
    expect(issue.status()).toBe(200);
    const nonce = await issue.json();
    const secret = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(owner.secretKey.slice(0, 32))]), format: 'der', type: 'pkcs8' });
    const signed = sign(null, Buffer.from(nonce.message), secret).toString('hex');
    const login = await request.post('/api/auth/session', { headers: { origin }, data: { wallet, id: nonce.id, signature: signed } });
    expect(login.status()).toBe(200);
    const setCookie = login.headersArray().find(header => header.name.toLowerCase() === 'set-cookie' && header.value.startsWith('vynx-session='))!.value;
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
    expect(setCookie).toContain('Path=/');
    expect(setCookie.toLowerCase()).not.toContain('domain=');
    const session = (await page.context().cookies()).find(cookie => cookie.name === 'vynx-session')!;
    expect(session.httpOnly).toBe(true);
    expect(session.sameSite).toBe('Lax');
    await page.goto('/');
    expect(await page.evaluate(() => document.cookie)).not.toContain('vynx-session');
    expect((await (await request.get('/api/profile')).json()).profile.design.name).toBe(privateName);

    const crossOrigin = { origin: 'https://attacker.example' };
    expect((await request.patch('/api/profile', { headers: crossOrigin, data: { published: true } })).status()).toBe(403);
    expect((await request.delete('/api/auth/session', { headers: crossOrigin })).status()).toBe(403);
    expect((await request.get('/api/profile')).status()).toBe(200);
    const replay = await request.post('/api/auth/session', { headers: { origin, cookie: `vynx-nonce=${nonce.id}` }, data: { wallet, id: nonce.id, signature: signed } });
    expect(replay.status()).toBe(401);
    const action = await request.fetch(`/api/actions/tip/${alias}`, { method: 'OPTIONS' });
    expect(action.headers()['access-control-allow-origin']).toBe('*');
    expect(action.headers()['access-control-allow-credentials']).toBeUndefined();
    const privateResponse = await request.get('/api/auth/session', { headers: crossOrigin });
    expect(privateResponse.headers()['access-control-allow-origin']).toBeUndefined();
    expect(privateResponse.headers()['cache-control']).toBe('no-store');
    expect((await request.delete('/api/auth/session', { headers: { origin } })).status()).toBe(200);
    expect((await request.get('/api/profile', { headers: { cookie: `vynx-session=${session.value}` } })).status()).toBe(401);
  } finally {
    expectOk(await db.from('sponsor_requests').delete().eq('creator_wallet', wallet));
    expectOk(await db.from('sponsor_profiles').delete().eq('wallet', wallet));
    expectOk(await db.from('wallet_sessions').delete().eq('wallet', wallet));
    expectOk(await db.from('wallet_nonces').delete().eq('wallet', wallet));
    expectOk(await db.from('cards_users').delete().eq('wallet_address', wallet));
  }
});

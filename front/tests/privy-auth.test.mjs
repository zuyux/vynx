import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { Keypair } from '@solana/web3.js';
import { SignJWT, exportJWK, importPKCS8 } from 'jose';
import { verifyPrivyWallet } from '../lib/privy-server.ts';
import { POST, DELETE } from '../app/api/auth/session/route.ts';

test('Privy validates signatures, audience, expiry and verified wallet ownership before issuing bounded sessions', async () => {
  const keys = ['PRIVY_APP_ID', 'PRIVY_APP_SECRET', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'NEXT_PUBLIC_APP_URL'];
  const saved = keys.map(key => process.env[key]); const originalFetch = globalThis.fetch;
  const appId = 'test-privy-app', userId = 'did:privy:test-user', origin = 'https://vynx.test';
  const wallet = Keypair.generate().publicKey.toBase58();
  Object.assign(process.env, { PRIVY_APP_ID: appId, PRIVY_APP_SECRET: 'server-secret', SUPABASE_URL: 'https://auth.supabase.co', SUPABASE_SECRET_KEY: 'db-secret', NEXT_PUBLIC_APP_URL: origin });
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const key = await importPKCS8(privateKey.export({ format: 'pem', type: 'pkcs8' }), 'ES256');
  const jwk = { ...await exportJWK(publicKey), kid: 'test-key', alg: 'ES256', use: 'sig' };
  let linked = [{ type: 'wallet', chain_type: 'solana', address: wallet, verified_at: 1 }];
  let userFailure = false, writes = [], revoked = 0;
  const mint = (audience = appId, expires = Math.floor(Date.now() / 1000) + 600, issuer = 'privy.io') => new SignJWT({ sid: 'test-session' }).setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'test-key' }).setSubject(userId).setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime(expires).sign(key);
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init), url = new URL(req.url), name = url.pathname.split('/').at(-1);
    if (url.hostname === 'api.privy.io' || url.hostname === 'auth.privy.io') {
      if (name === 'jwks.json') return Response.json({ keys: [jwk] });
      if (url.pathname.includes('/users/')) {
        if (userFailure) return Response.json({ error: 'unavailable' }, { status: 503 });
        return Response.json({ id: userId, linked_accounts: linked });
      }
    }
    assert.equal(url.hostname, 'auth.supabase.co', `Unexpected request ${url.origin}${url.pathname}`);
    if (name === 'consume_public_endpoint_limit') return Response.json({ allowed: true, retry_after: 60 });
    if (name === 'wallet_sessions') {
      if (req.method === 'POST') { writes.push(await req.json()); return new Response(null, { status: 201 }); }
      if (req.method === 'DELETE') { revoked++; return new Response(null, { status: 204 }); }
    }
    throw Error(`Unexpected request ${url.pathname}`);
  };
  const request = (body, requestOrigin = origin, cookie = '') => new Request(`${origin}/api/auth/session`, { method: 'POST', headers: { origin: requestOrigin, 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
  try {
    const valid = await mint();
    assert.equal((await verifyPrivyWallet(valid, wallet)).wallet, wallet);
    await assert.rejects(verifyPrivyWallet('forged', wallet), e => e.status === 401);
    await assert.rejects(verifyPrivyWallet(await mint('other-app'), wallet), e => e.status === 401);
    await assert.rejects(verifyPrivyWallet(await mint(appId, 1), wallet), e => e.status === 401);
    await assert.rejects(verifyPrivyWallet(await mint(appId, undefined, 'evil.test'), wallet), e => e.status === 401);
    await assert.rejects(verifyPrivyWallet(valid, Keypair.generate().publicKey.toBase58()), e => e.status === 403);
    linked[0].verified_at = null;
    await assert.rejects(verifyPrivyWallet(valid, wallet), e => e.status === 403); linked[0].verified_at = 1;
    linked[0].chain_type = 'ethereum';
    await assert.rejects(verifyPrivyWallet(valid, wallet), e => e.status === 403); linked[0].chain_type = 'solana';
    assert.equal((await POST(request({ provider: 'privy', accessToken: valid, wallet }, 'https://evil.test'))).status, 403);
    assert.equal((await POST(request({ provider: 'privy', accessToken: 'forged', wallet }))).status, 401);
    assert.equal(writes.length, 0);
    const response = await POST(request({ provider: 'privy', accessToken: valid, wallet }, origin, `vynx-session=${'a'.repeat(64)}`));
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { wallet });
    assert.equal(writes.length, 1); assert.equal(revoked, 1);
    assert.equal(writes[0].wallet, wallet); assert.match(writes[0].token_hash, /^[a-f0-9]{64}$/);
    assert.ok(Date.parse(writes[0].expires_at) <= Date.now() + 600_000);
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/i); assert.match(cookie, /Secure/i); assert.match(cookie, /SameSite=lax/i);
    assert.ok(Number(cookie.match(/Max-Age=(\d+)/i)[1]) <= 600);
    assert.doesNotMatch(JSON.stringify(writes), /server-secret|accessToken|did:privy/);
    userFailure = true;
    await assert.rejects(verifyPrivyWallet(valid, wallet), e => e.status === 503); userFailure = false;
    assert.equal((await DELETE(new Request(`${origin}/api/auth/session`, { method: 'DELETE', headers: { origin, cookie: `vynx-session=${'a'.repeat(64)}` } }))).status, 200);
    assert.equal(revoked, 2);
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, i) => saved[i] === undefined ? delete process.env[key] : process.env[key] = saved[i]);
  }
});

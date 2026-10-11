import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
import { appDb } from '../lib/app-db.ts';
import { cookieOptions, assertOrigin, readSession } from '../lib/wallet-session.ts';
import { GET } from '../app/api/sponsorships/route.ts';
import { PUBLIC_AD_COLUMNS, PUBLIC_SPONSOR_COLUMNS } from '../lib/public-sponsorship.ts';
import { EMPTY_DRAFT } from '../lib/creator-draft.ts';
import { authorize, challengeMessage } from '../lib/sponsorship-server.ts';
import { Keypair } from '@solana/web3.js';
import { createPrivateKey, sign } from 'node:crypto';
import { validateEnvironment } from '../scripts/env-validation.mjs';

test('public sponsorship responses exclude payment proofs, private columns and unsupported design fields', async () => {
  const keys = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'VYNX_ALIAS_REGISTRY_ENABLED'];
  const saved = keys.map(key => process.env[key]);
  const previous = globalThis.fetch;
  Object.assign(process.env, { SUPABASE_URL: 'https://privacy.supabase.co', SUPABASE_SECRET_KEY: 'test-key', VYNX_ALIAS_REGISTRY_ENABLED: 'false' });
  const queries = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(new Request(input, init).url);
    queries.push(url);
    if (url.pathname.endsWith('/sponsor_profiles')) return Response.json([{
      wallet: '11111111111111111111111111111111', alias: 'alice', display_name: 'Alice', bio: '', website: '', price_cents: 100, duration_days: 7, accepting: true,
      private_future_column: 'PRIVATE', created_at: 'PRIVATE', design: { ...EMPTY_DRAFT, alias: 'alice', name: 'Alice', private_notes: 'PRIVATE' },
    }]);
    return Response.json([{ id: 'ad-id', brand_name: 'Brand', headline: 'Ad', description: 'Description', destination_url: 'https://example.org', ends_at: '2026-12-01', payment_signature: 'PRIVATE', brand_wallet: 'PRIVATE' }]);
  };
  try {
    const response = await GET(new Request('https://vynx.test/api/sponsorships?alias=alice'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('access-control-allow-credentials'), null);
    const body = await response.text();
    assert.doesNotMatch(body, /PRIVATE|payment_signature|private_notes|private_future_column|created_at|brand_wallet/);
    assert.equal(queries[0].searchParams.get('select'), PUBLIC_SPONSOR_COLUMNS);
    assert.equal(queries[1].searchParams.get('select'), PUBLIC_AD_COLUMNS);
    assert.equal(queries[1].searchParams.get('status'), 'eq.active');
    assert.ok(queries[1].searchParams.get('ends_at').startsWith('gt.'));
  } finally {
    globalThis.fetch = previous;
    keys.forEach((key, i) => { if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i]; });
  }
});

test('session and nonce cookies are host-only, HttpOnly, Lax and Secure on HTTPS', () => {
  const saved = process.env.NEXT_PUBLIC_APP_URL;
  const savedMode = process.env.NODE_ENV;
  try {
    process.env.NEXT_PUBLIC_APP_URL = 'https://vynx.test';
    for (const maxAge of [86400, 300, 0]) {
      assert.deepEqual(cookieOptions(maxAge), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge });
      assert.equal(cookieOptions(maxAge).domain, undefined);
    }
    assert.doesNotThrow(() => assertOrigin(new Request('https://vynx.test', { headers: { origin: 'https://vynx.test' } })));
    for (const origin of ['', 'null', 'https://evil.vynx.test', 'https://vynx.test.evil.example', 'http://vynx.test']) assert.throws(() => assertOrigin(new Request('https://vynx.test', { headers: { origin } })));
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    assert.equal(cookieOptions().secure, false);
    process.env.NODE_ENV = 'production';
    assert.equal(cookieOptions().secure, false);
    process.env.NEXT_PUBLIC_APP_URL = 'http://vynx.test';
    assert.throws(() => cookieOptions(), /HTTPS/);
    assert.ok(validateEnvironment({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'http://vynx.test' }).some(error => /HTTPS/.test(error)));
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = saved;
    if (savedMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = savedMode;
  }
});

test('sponsorship authorization rejects a challenge that expires before atomic consumption', async () => {
  const previous = globalThis.fetch;
  const keys = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY'];
  const saved = keys.map(key => process.env[key]);
  Object.assign(process.env, { SUPABASE_URL: 'https://audit.supabase.co', SUPABASE_SECRET_KEY: 'test-key' });
  const owner = Keypair.generate();
  const wallet = owner.publicKey.toBase58();
  const challenge = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const expiry = new Date(Date.now() + 60000).toISOString();
  const message = challengeMessage('https://vynx.test', wallet, 'list', {}, challenge, expiry);
  const secret = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(owner.secretKey.slice(0, 32))]), format: 'der', type: 'pkcs8' });
  let consumed = false;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    if (request.method === 'GET') return Response.json({ id: challenge, wallet, message, expires_at: expiry });
    const params = new URL(request.url).searchParams;
    assert.equal(params.get('id'), `eq.${challenge}`);
    assert.equal(params.get('wallet'), `eq.${wallet}`);
    assert.ok(params.get('expires_at').startsWith('gt.'));
    consumed = true;
    // The database clock has advanced beyond expiry by the time DELETE executes.
    return Response.json([]);
  };
  try {
    await assert.rejects(() => authorize('https://vynx.test', { wallet, challenge, action: 'list', payload: {}, signature: sign(null, Buffer.from(message), secret).toString('hex') }), /has already been used/);
    assert.equal(consumed, true);
  } finally {
    globalThis.fetch = previous;
    keys.forEach((key, i) => { if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i]; });
  }
});

test('malformed session tokens never reach the privileged database client', async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async () => { throw Error('Database must not be reached'); };
  try { for (const token of ['', 'a', 'a'.repeat(65), 'g'.repeat(64), 'token,password']) assert.equal(await readSession(token), null); }
  finally { globalThis.fetch = saved; }
});

test('privileged database access refuses browser execution', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  try { assert.throws(() => appDb(), /server-only/); }
  finally { if (descriptor) Object.defineProperty(globalThis, 'window', descriptor); else delete globalThis.window; }
});

test('client import graphs cannot reach privileged modules or server secret environment variables', () => {
  const root = resolve(new URL('..', import.meta.url).pathname);
  const files = [];
  const collect = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) collect(path);
      else if (/\.[cm]?tsx?$/.test(path)) files.push(path);
    }
  };
  for (const directory of ['app', 'components', 'lib']) collect(resolve(root, directory));
  const visited = new Set();
  function inspect(path) {
    if (visited.has(path)) return;
    visited.add(path);
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /process\.env\.(SUPABASE_SECRET_KEY|KORA_API_KEY|VYNX_ALIAS_SPONSOR_SECRET_KEY|ERROR_MONITORING_TOKEN|ERROR_ALERT_WEBHOOK_TOKEN)/, path);
    assert.ok(!['app-db.ts', 'wallet-session.ts', 'sponsorship-server.ts', 'error-monitoring.ts'].includes(path.split('/').at(-1)), path);
    const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    for (const node of parsed.statements) {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
      if (node.isTypeOnly || node.importClause?.isTypeOnly || !node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
      const specifier = node.moduleSpecifier.text;
      const base = specifier.startsWith('@/') ? resolve(root, specifier.slice(2)) : specifier.startsWith('.') ? resolve(dirname(path), specifier) : null;
      if (!base) continue;
      const target = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find(candidate => existsSync(candidate) && /\.[cm]?tsx?$/.test(candidate));
      if (target) inspect(target);
    }
  }
  for (const path of files) if (/^\s*['"]use client['"]/.test(readFileSync(path, 'utf8'))) inspect(path);
  assert.ok(visited.size > 0);
});

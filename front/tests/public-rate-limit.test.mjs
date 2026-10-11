import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { limitPublicEndpoint } from '../lib/public-rate-limit.ts';

const request = new Request('https://vynx.test/api/tips', { method: 'POST', body: 'invalid json' });
const dependencies = result => ({ secret: 'test-secret', trustedVercel: false, db: { async rpc(name, args) {
  assert.equal(name, 'consume_public_endpoint_limit');
  assert.match(args.client_hash, /^[a-f0-9]{64}$/);
  assert.equal(args.policy, 'payment');
  return result;
} } });

test('allows requests without consuming the body', async () => {
  assert.equal(await limitPublicEndpoint(request, 'payment', {}, dependencies({ data: { allowed: true, retry_after: 60 } })), null);
  assert.equal(request.bodyUsed, false);
});

test('rejects exhausted quota with retry and Action CORS headers', async () => {
  const response = await limitPublicEndpoint(request, 'payment', { 'Access-Control-Allow-Origin': '*' }, dependencies({ data: { allowed: false, retry_after: 17 } }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '17');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
});

test('fails closed on storage errors and malformed responses', async () => {
  for (const result of [{ error: { message: 'private detail' } }, { data: null }, { data: { allowed: true, retry_after: 0 } }, { data: { allowed: false, retry_after: 61 } }]) {
    const response = await limitPublicEndpoint(request, 'payment', {}, dependencies(result));
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /private detail/);
  }
  const dep = dependencies(null);
  dep.db.rpc = async () => { throw Error('private detail'); };
  assert.equal((await limitPublicEndpoint(request, 'payment', {}, dep)).status, 503);
});

test('payment quotas follow the client across aliases and Action routes', async () => {
  const hashes = [];
  const dep = dependencies(null);
  dep.db.rpc = async (_name, args) => {
    hashes.push(args.client_hash);
    return { data: { allowed: true, retry_after: 60 } };
  };
  for (const path of ['/api/tips', '/api/actions/tip/alice', '/api/actions/tip/bob/confirm']) {
    await limitPublicEndpoint(new Request(`https://vynx.test${path}`), 'payment', {}, dep);
  }
  assert.equal(new Set(hashes).size, 1);
});

test('Action rejection happens before parameter resolution, parsing, and payment RPC', async () => {
  const { POST } = await import('../app/api/actions/tip/[alias]/route.ts');
  const originalFetch = globalThis.fetch;
  const saved = [process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY];
  process.env.SUPABASE_URL = 'https://limit.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-secret';
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    assert.ok(req.url.endsWith('/rpc/consume_public_endpoint_limit'));
    calls++;
    return Response.json({ allowed: false, retry_after: 12 });
  };
  try {
    const req = new Request('https://vynx.test/api/actions/tip/alice', { method: 'POST', body: 'invalid' });
    const response = await POST(req, { get params() { throw Error('must not resolve params'); } });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    assert.equal(req.bodyUsed, false);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [i, key] of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY'].entries()) {
      if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i];
    }
  }
});

test('every API mutation checks quota before reading bodies or running business logic', () => {
  function inspect(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) inspect(path);
      else if (entry.name === 'route.ts') {
        const source = readFileSync(path, 'utf8');
        for (const match of source.matchAll(/export async function (POST|PATCH|PUT|DELETE)\([^]*?\) \{([^]*?)  try \{/g)) {
          assert.match(match[2], /await limitPublicEndpoint\(request,/, `${path} ${match[1]}`);
          assert.match(match[2], /if \(limited\) return limited;/);
        }
      }
    }
  }
  inspect(new URL('../app/api', import.meta.url).pathname);
});

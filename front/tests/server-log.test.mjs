import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { logServerRequest, serverLog } from '../lib/server-log.ts';

async function capture(work) {
  const entries = [];
  const saved = { info: console.info, warn: console.warn, error: console.error };
  for (const level of Object.keys(saved)) console[level] = line => entries.push({ sink: level, record: JSON.parse(line) });
  try { await work(entries); }
  finally { Object.assign(console, saved); }
}

test('logs request outcomes and correlation without reading sensitive inputs or response bodies', async () => {
  await capture(async entries => {
    const secret = 'PRIVATE_SECRET_DO_NOT_LOG';
    const request = new Request(`https://vynx.test/api/actions/tip/private-alias?signature=${secret}`, {
      method: 'POST', headers: { authorization: `Bearer ${secret}`, cookie: `vynx-session=${secret}`, 'x-request-id': secret }, body: secret,
    });
    for (const [status, sink] of [[200, 'info'], [400, 'warn'], [429, 'warn'], [503, 'error']]) {
      const response = await logServerRequest(request, '/api/actions/tip/[alias]', async () => Response.json({ wallet: secret, signature: secret }, { status, headers: { 'Access-Control-Allow-Origin': '*' } }));
      const entry = entries.at(-1);
      assert.equal(entry.sink, sink);
      assert.equal(entry.record.status, status);
      assert.equal(entry.record.route, '/api/actions/tip/[alias]');
      assert.equal(entry.record.method, 'POST');
      assert.match(entry.record.request_id, /^[a-f0-9-]{36}$/);
      assert.equal(entry.record.request_id, response.headers.get('x-request-id'));
      assert.ok(response.headers.get('access-control-expose-headers').includes('X-Request-Id'));
      assert.ok(entry.record.duration_ms >= 0);
      assert.ok(Number.isFinite(Date.parse(entry.record.timestamp)));
      assert.equal(response.bodyUsed, false);
    }
    assert.equal(request.bodyUsed, false);
    assert.doesNotMatch(JSON.stringify(entries), new RegExp(`${secret}|private-alias|signature|cookie|authorization|wallet`));
  });
});

test('unexpected exceptions are logged without messages, stacks or custom properties', async () => {
  await capture(async entries => {
    const response = await logServerRequest(new Request('https://vynx.test'), '/api/tips', async () => {
      throw Object.assign(new Error('postgres://admin:PRIVATE_PASSWORD@host'), { payload: { signature: 'PRIVATE_SIGNATURE' } });
    }, { 'Access-Control-Allow-Origin': '*' });
    assert.equal(response.status, 500);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    assert.equal(entries[0].record.unexpected, true);
    assert.doesNotMatch(JSON.stringify(entries) + await response.text(), /PRIVATE|postgres|payload|stack/);
  });
});

test('field allowlist rejects arbitrary payloads and invalid numeric fields', async () => {
  await capture(async entries => {
    serverLog('creator_image_cleanup_pending', { deleted: 1, failed: 2, count: NaN, deferred: -1, blocked: Infinity, secret: 'PRIVATE', payload: { password: 'PRIVATE' } });
    assert.equal(entries[0].record.deleted, 1);
    assert.equal(entries[0].record.failed, 2);
    for (const field of ['count', 'deferred', 'blocked', 'secret', 'payload']) assert.equal(entries[0].record[field], undefined);
    serverLog('PRIVATE_EVENT', { count: 1 });
    assert.equal(entries.length, 1);
    await logServerRequest(new Request('https://vynx.test'), '/api/PRIVATE', async () => Response.json({}));
    assert.equal(entries.at(-1).record.route, '/api/unknown');
  });
});

test('concurrent requests keep cleanup logs in their own request context', async () => {
  await capture(async entries => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const first = logServerRequest(new Request('https://vynx.test'), '/api/profile', async () => {
      await gate;
      serverLog('creator_image_rollback_deferred', { count: 1 });
      return Response.json({});
    });
    const second = await logServerRequest(new Request('https://vynx.test'), '/api/tips', async () => {
      serverLog('creator_image_cleanup_pending', { failed: 2 });
      return Response.json({});
    });
    release();
    const firstResponse = await first;
    assert.notEqual(firstResponse.headers.get('x-request-id'), second.headers.get('x-request-id'));
    for (const entry of entries) assert.equal(entry.record.request_id, (entry.record.route === '/api/profile' ? firstResponse : second).headers.get('x-request-id'));
    serverLog('creator_image_cleanup_pending');
    assert.equal(entries.at(-1).record.request_id, undefined);
  });
});

test('a failed log sink does not break the request', async () => {
  const saved = console.info;
  console.info = () => { throw Error('sink unavailable'); };
  try {
    assert.equal((await logServerRequest(new Request('https://vynx.test'), '/api/tips', async () => Response.json({}))).status, 200);
  } finally { console.info = saved; }
});

test('all API business handlers use structured request logging', () => {
  function inspect(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) inspect(path);
      else if (entry.name === 'route.ts') {
        const source = readFileSync(path, 'utf8');
        for (const match of source.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)\([^]*?\) \{\s*([^\n]+)/g)) {
          assert.match(match[2], /^return logServerRequest\(request, '\/api\//, `${path} ${match[1]}`);
        }
      }
    }
  }
  inspect(new URL('../app/api', import.meta.url).pathname);
});

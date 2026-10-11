import test from 'node:test';
import assert from 'node:assert/strict';
import { monitoringAuthorized, monitoringEvent, dispatchMonitoringAlerts } from '../lib/error-monitoring.ts';
import { logServerRequest, monitorPaymentVerification } from '../lib/server-log.ts';
import { ApiError, apiFailure } from '../lib/wallet-session.ts';
import { UserFacingError } from '../lib/user-facing-error.ts';
import { POST as webhook } from '../app/api/monitoring/webhook/route.ts';
import { GET as inbox } from '../app/api/monitoring/alerts/route.ts';
import { POST as dispatch } from '../app/api/monitoring/dispatch/route.ts';
import { validateEnvironment } from '../scripts/env-validation.mjs';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const event = { kind: 'api_5xx', route: '/api/tips/confirm', method: 'POST', status: 503, request_id: id };
const token = 'a'.repeat(64);
const json = data => Response.json(data);
const request = (path, body, auth = true) => new Request(`https://vynx.test/api/monitoring/${path}`, {
  method: body === undefined ? 'GET' : 'POST', headers: auth ? { Authorization: `Bearer ${token}` } : {},
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
async function configured(work) {
  const keys = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'ERROR_MONITORING_ENABLED', 'ERROR_MONITORING_TOKEN', 'ERROR_ALERT_WEBHOOK_URL', 'ERROR_ALERT_WEBHOOK_TOKEN'];
  const saved = keys.map(key => process.env[key]);
  const original = globalThis.fetch;
  Object.assign(process.env, { SUPABASE_URL: 'https://monitor.supabase.co', SUPABASE_SECRET_KEY: 'PRIVATE_DB_KEY', ERROR_MONITORING_ENABLED: 'true', ERROR_MONITORING_TOKEN: token });
  delete process.env.ERROR_ALERT_WEBHOOK_URL;
  delete process.env.ERROR_ALERT_WEBHOOK_TOKEN;
  try { await work(); }
  finally {
    globalThis.fetch = original;
    keys.forEach((key, i) => { if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i]; });
  }
}

test('event schema rejects sensitive fields, dynamic routes, arbitrary categories and identifiers', () => {
  assert.deepEqual(monitoringEvent(event), event);
  for (const modified of [{ ...event, payload: 'PRIVATE' }, { ...event, route: '/api/actions/tip/private-alias' }, { ...event, request_id: 'PRIVATE' }, { ...event, status: 429 }, { ...event, kind: 'PRIVATE' }, { ...event, method: 'PRIVATE' }]) assert.equal(monitoringEvent(modified), null);
});

test('operator authorization fails closed including unicode and absent tokens', () => {
  assert.equal(monitoringAuthorized(request('alerts'), token), true);
  for (const supplied of ['', 'x'.repeat(64), 'é'.repeat(64)]) assert.equal(monitoringAuthorized(new Request('https://vynx.test', { headers: { Authorization: `Bearer ${supplied}` } }), token), false);
  assert.equal(monitoringAuthorized(request('alerts'), ''), false);
});

test('API 5xx and actual verification failures persist after the response without sensitive data', async () => configured(async () => {
  const captured = [], tasks = [];
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    assert.ok(req.url.endsWith('/rpc/record_error_alert'));
    captured.push((await req.json()).alert);
    return json(null);
  };
  const req = new Request('https://vynx.test/api/tips/confirm?signature=PRIVATE', { method: 'POST', body: 'PRIVATE', headers: { Cookie: 'PRIVATE' } });
  for (const reason of [new ApiError('PRIVATE', 400, 'PAYMENT_FAILED'), new ApiError('PRIVATE', 400, 'PAYMENT_MISMATCH'), new ApiError('PRIVATE', 503, 'RPC_UNAVAILABLE'), new Error('PRIVATE')]) {
    const response = await logServerRequest(req, '/api/tips/confirm', async () => {
      try { return await monitorPaymentVerification('tip', async () => { throw reason; }); }
      catch (error) { return apiFailure(error); }
    }, {}, task => tasks.push(task));
    assert.equal(captured.length, 0);
    assert.ok(response.status >= 400);
  }
  for (const task of tasks) await task();
  assert.equal(captured.filter(item => item.kind === 'payment_verification_failed').length, 4);
  assert.equal(captured.filter(item => item.kind === 'api_5xx').length, 2);
  assert.doesNotMatch(JSON.stringify(captured), /PRIVATE|signature|cookie|payload/);
  assert.ok(captured.every(item => monitoringEvent(item)));
}));

test('pending payments, expired quotes, successful confirmation and auth failures do not alert', async () => configured(async () => {
  const tasks = [];
  for (const code of ['PAYMENT_PENDING', 'QUOTE_EXPIRED']) {
    await logServerRequest(new Request('https://vynx.test'), '/api/sponsorships', async () => {
      try { await monitorPaymentVerification('sponsorship', async () => { throw new UserFacingError('PRIVATE', code); }); }
      catch (reason) { return apiFailure(reason); }
    }, {}, task => tasks.push(task));
  }
  await logServerRequest(new Request('https://vynx.test'), '/api/tips/confirm', async () => Response.json({}, { status: 401 }), {}, task => tasks.push(task));
  await logServerRequest(new Request('https://vynx.test'), '/api/tips/confirm', async () => { await monitorPaymentVerification('tip', async () => true); return json({}); }, {}, task => tasks.push(task));
  assert.equal(tasks.length, 0);
}));

test('monitoring failures cannot replace payment responses, and monitoring routes cannot recurse', async () => configured(async () => {
  const tasks = [];
  globalThis.fetch = async () => { throw Error('PRIVATE'); };
  const response = await logServerRequest(new Request('https://vynx.test'), '/api/tips', async () => Response.json({ error: 'original' }, { status: 503 }), {}, task => tasks.push(task));
  assert.equal(response.status, 503);
  for (const task of tasks) await task();
  await logServerRequest(new Request('https://vynx.test'), '/api/monitoring/webhook', async () => new Response(null, { status: 503 }), {}, task => tasks.push(task));
  assert.equal(tasks.length, 1);
}));

test('webhook and inbox authenticate, bound bodies, validate events and persist sanitized alerts', async () => configured(async () => {
  const recorded = [];
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    if (req.url.endsWith('/rpc/consume_public_endpoint_limit')) return json({ allowed: true, retry_after: 60 });
    if (req.url.endsWith('/rpc/record_error_alert')) { recorded.push((await req.json()).alert); return json(null); }
    if (new URL(req.url).pathname.endsWith('/error_alerts')) return json([{ event, occurrences: 1 }]);
    throw Error('Unexpected request');
  };
  assert.equal((await webhook(request('webhook', event, false))).status, 401);
  assert.equal((await inbox(request('alerts', undefined, false))).status, 401);
  assert.equal((await dispatch(request('dispatch', {}, false))).status, 401);
  assert.equal((await webhook(request('webhook', { ...event, password: 'PRIVATE' }))).status, 400);
  assert.equal((await webhook(request('webhook', 'x'.repeat(5000)))).status, 413);
  const accepted = await webhook(request('webhook', event));
  assert.equal(accepted.status, 202);
  assert.equal(accepted.headers.get('cache-control'), 'no-store');
  assert.deepEqual(recorded, [event]);
  assert.equal((await (await inbox(request('alerts'))).json()).alerts.length, 1);
}));

test('outbound delivery sends only the safe event and acknowledges success or retry without error details', async () => configured(async () => {
  process.env.ERROR_ALERT_WEBHOOK_URL = 'https://alerts.example/PRIVATE_WEBHOOK';
  process.env.ERROR_ALERT_WEBHOOK_TOKEN = 'PRIVATE_TOKEN';
  for (const outcome of ['success', 'http-error', 'network-error']) {
    const acknowledgments = [];
    const db = { rpc(name, args) { return { abortSignal: async () => name === 'claim_error_alerts'
      ? { data: [{ id, lease_id: id, event: { ...event }, occurrences: 3, private_column: 'PRIVATE' }] }
      : (acknowledgments.push(args), { error: null }) }; } };
    const result = await dispatchMonitoringAlerts(db, async (_url, options) => {
      assert.deepEqual(JSON.parse(options.body), event);
      assert.equal(options.headers.Authorization, 'Bearer PRIVATE_TOKEN');
      assert.equal(options.headers['Idempotency-Key'], id);
      assert.equal(options.redirect, 'error');
      if (outcome === 'network-error') throw Error('PRIVATE');
      return new Response('PRIVATE_RESPONSE', { status: outcome === 'success' ? 200 : 503 });
    });
    assert.equal(result.sent, outcome === 'success' ? 1 : 0);
    assert.equal(result.failed, outcome === 'success' ? 0 : 1);
    assert.deepEqual(acknowledgments, [{ alert_id: id, delivery_lease: id, delivered: outcome === 'success' }]);
  }
}));

test('database outages still attempt independent webhook delivery', async () => configured(async () => {
  process.env.ERROR_ALERT_WEBHOOK_URL = 'https://alerts.example/PRIVATE_URL';
  const delivered = [], tasks = [];
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    if (new URL(req.url).hostname === 'monitor.supabase.co') return Response.json({ message: 'PRIVATE_DATABASE_ERROR' }, { status: 400 });
    delivered.push(await req.json());
    return new Response(null, { status: 204 });
  };
  const response = await logServerRequest(new Request('https://vynx.test'), '/api/tips', async () => new Response(null, { status: 503 }), {}, task => tasks.push(task));
  for (const task of tasks) await task();
  assert.equal(response.status, 503);
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].kind, 'api_5xx');
  assert.doesNotMatch(JSON.stringify(delivered), /PRIVATE|payload|signature/);
}));

test('configuration validation rejects insecure or public monitoring settings', () => {
  for (const env of [{ ERROR_MONITORING_ENABLED: 'true' }, { ERROR_ALERT_WEBHOOK_URL: 'http://alerts.test' }, { ERROR_ALERT_WEBHOOK_URL: 'https://user:password@alerts.test' }, { NEXT_PUBLIC_ERROR_MONITORING_TOKEN: 'PRIVATE' }]) {
    assert.ok(validateEnvironment(env).some(error => /ERROR_|secret/.test(error)));
  }
});

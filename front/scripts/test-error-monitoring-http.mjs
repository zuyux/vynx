import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const events = [];
const fixture = createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  res.setHeader('Content-Type', 'application/json');
  if (req.url.endsWith('/consume_public_endpoint_limit')) return res.end(JSON.stringify({ allowed: true, retry_after: 60 }));
  if (req.url.endsWith('/consume_alias_availability_limit')) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ message: 'PRIVATE_DATABASE_DETAIL' }));
  }
  if (req.url.endsWith('/record_error_alert')) {
    events.push(JSON.parse(raw).alert);
    return res.end('null');
  }
  if (req.url.startsWith('/rest/v1/error_alerts')) return res.end('[]');
  res.statusCode = 404;
  res.end('{}');
});
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
const portProbe = createServer();
await new Promise(resolve => portProbe.listen(0, '127.0.0.1', resolve));
const appPort = portProbe.address().port;
await new Promise(resolve => portProbe.close(resolve));
const origin = `http://127.0.0.1:${appPort}`;
const token = 'test-monitoring-operator-'.repeat(3);
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(appPort), '-H', '127.0.0.1'], {
  env: { ...process.env, SUPABASE_URL: `http://127.0.0.1:${fixture.address().port}`, SUPABASE_SECRET_KEY: 'test-service-key',
    ERROR_MONITORING_ENABLED: 'true', ERROR_MONITORING_TOKEN: token, ERROR_ALERT_WEBHOOK_URL: '', ERROR_ALERT_WEBHOOK_TOKEN: '', VYNX_ALIAS_REGISTRY_ENABLED: 'false' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stdout.on('data', chunk => { logs += chunk; });
child.stderr.on('data', chunk => { logs += chunk; });
const waitFor = async predicate => {
  for (let i = 0; i < 80; i++) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('Monitoring HTTP check timed out');
};
try {
  await waitFor(async () => {
    try { return (await fetch(`${origin}/api/monitoring/alerts`, { headers: { Authorization: `Bearer ${token}` } })).ok; }
    catch { return false; }
  });
  const unavailable = await fetch(`${origin}/api/aliases?alias=alice`);
  assert.equal(unavailable.status, 503);
  await waitFor(() => events.some(event => event.kind === 'api_5xx'));
  const apiEvent = events.find(event => event.kind === 'api_5xx');
  assert.equal(apiEvent.request_id, unavailable.headers.get('x-request-id'));
  assert.equal(apiEvent.route, '/api/aliases');
  const rejected = await fetch(`${origin}/api/actions/tip/alice/confirm?amount=0.01`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: '11111111111111111111111111111111', signature: 'PRIVATE_SIGNATURE' }),
  });
  assert.equal(rejected.status, 400);
  await waitFor(() => events.some(event => event.kind === 'payment_verification_failed'));
  const paymentEvent = events.find(event => event.kind === 'payment_verification_failed');
  assert.equal(paymentEvent.request_id, rejected.headers.get('x-request-id'));
  assert.equal(paymentEvent.route, '/api/actions/tip/[alias]/confirm');
  assert.equal(paymentEvent.payment_flow, 'tip');
  assert.doesNotMatch(JSON.stringify(events) + logs, /PRIVATE_SIGNATURE|PRIVATE_DATABASE_DETAIL|test-service-key/);
  console.info('Production HTTP checks passed: API 5xx and payment verification alerts persisted after responses with matching request IDs.');
} finally {
  child.kill('SIGTERM');
  await new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit', resolve));
  await new Promise(resolve => fixture.close(resolve));
}

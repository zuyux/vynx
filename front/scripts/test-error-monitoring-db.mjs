import { spawnSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const name = `vynx-monitor-check-${randomUUID().slice(0, 8)}`;
const docker = (args, input) => {
  const result = spawnSync('docker', args, { input, encoding: 'utf8' });
  if (result.status !== 0) throw Error(result.stderr || 'Docker command failed');
  return result.stdout;
};
const sqlArgs = ['exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'];
let started = false;
try {
  docker(['run', '-d', '--rm', '--name', name, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine']);
  started = true;
  let ready = false;
  for (let i = 0; i < 40; i++) {
    if (spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres'], { stdio: 'ignore' }).status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'PostgreSQL ready');
  docker(sqlArgs, 'create role anon; create role authenticated; create role service_role bypassrls;');
  docker(sqlArgs, readFileSync('supabase/migrations/011_error_monitoring.sql', 'utf8'));
  docker(sqlArgs, readFileSync('tests/error-monitoring-db.sql', 'utf8'));
  docker(sqlArgs, 'truncate public.error_alerts, public.error_alert_receipts;');
  const input = `select public.record_error_alert(jsonb_build_object('kind','api_5xx','route','/api/tips','method','POST','status',503,'request_id',gen_random_uuid()::text));`;
  await Promise.all(Array.from({ length: 16 }, () => new Promise((resolve, reject) => {
    const child = spawn('docker', sqlArgs, { stdio: ['pipe', 'ignore', 'pipe'] });
    let error = '';
    child.stderr.on('data', chunk => { error += chunk; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(Error(error)));
    child.stdin.end(input);
  })));
  assert.equal(Number(docker(sqlArgs, 'select sum(occurrences) from public.error_alerts;').trim()), 16);
  console.info('Monitoring migration, deduplication, leases, retries, access control, and concurrent aggregation passed.');
} finally {
  if (started) docker(['stop', name]);
}

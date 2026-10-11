import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const name = `vynx-security-check-${randomUUID().slice(0, 8)}`;
const docker = (args, input) => {
  const result = spawnSync('docker', args, { input, encoding: 'utf8' });
  if (result.status !== 0) throw Error(result.stderr || 'Docker command failed');
  return result.stdout;
};
const sqlArgs = ['exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'];
let started = false;
try {
  docker(['run', '-d', '--rm', '--name', name, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine']);
  started = true;
  let ready = false;
  for (let i = 0; i < 40; i++) {
    if (spawnSync('docker', ['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], { stdio: 'ignore' }).status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'PostgreSQL ready');
  docker(sqlArgs, `create role anon; create role authenticated; create role service_role bypassrls; create role untrusted_audit_role;
    grant usage on schema public to anon,authenticated,service_role,untrusted_audit_role;
    grant create on schema public to public;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;`);
  for (const file of readdirSync('supabase/migrations').filter(file => file.endsWith('.sql')).sort()) {
    if (file.startsWith('012_')) {
      // Simulate inherited grants, stale permissive policy and managed Storage.
      docker(sqlArgs, `grant select on public.cards_users to public;
        create policy stale_public_policy on public.cards_users for select using(true);
        create schema storage; grant usage on schema storage to anon,authenticated,service_role;
        create table storage.buckets(id text primary key);
        create table storage.objects(bucket_id text,name text);
        insert into storage.buckets values ('creator-images'),('other-bucket');
        insert into storage.objects values ('creator-images','private-metadata'),('other-bucket','public-object');
        alter table storage.objects enable row level security;
        alter table storage.buckets enable row level security;
        grant all on storage.objects,storage.buckets to anon,authenticated,service_role;
        create policy legacy_permissive_objects on storage.objects for all using(true) with check(true);
        create policy legacy_permissive_buckets on storage.buckets for all using(true) with check(true);`);
    }
    docker(sqlArgs, readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }
  docker(sqlArgs, readFileSync('tests/security-db.sql', 'utf8'));
  console.info('All migrations passed: private tables/RPCs, inherited grants, service-role access, future defaults, and creator Storage policies verified.');
} finally {
  if (started) docker(['stop', name]);
}

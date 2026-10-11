import { spawn, spawnSync } from 'node:child_process';
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
  docker(sqlArgs, readFileSync('tests/call-bookings-db.sql', 'utf8'));
  docker(sqlArgs, readFileSync('tests/call-video-db.sql', 'utf8'));
  docker(sqlArgs, readFileSync('tests/booking-lifecycle-db.sql', 'utf8'));
  docker(sqlArgs, readFileSync('tests/call-reviews-db.sql', 'utf8'));
  const concurrentSql = input => new Promise((resolve, reject) => {
    const child = spawn('docker', [...sqlArgs, '-tA'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', error = '';
    child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { error += data; });
    child.on('error', reject); child.on('close', code => resolve({ code, output, error })); child.stdin.end(input);
  });
  const reserve = (payer, time) => `set role service_role; select public.reserve_call((select id from public.call_offers where creator_wallet='audit-wallet'),'${payer}',date_trunc('day',now()) + interval '2 days ${time}') ->> 'id';`;
  const conflict = await Promise.all([concurrentSql(reserve('race-one','10 hours')), concurrentSql(reserve('race-two','10 hours 15 minutes'))]);
  assert.equal(conflict.filter(result => result.code === 0).length, 1, 'concurrent overlapping reservations have one winner');
  assert.match(conflict.find(result => result.code !== 0).error, /exclusion constraint/);
  const retries = await Promise.all([concurrentSql(reserve('retry-fan','11 hours')), concurrentSql(reserve('retry-fan','11 hours'))]);
  assert.ok(retries.every(result => result.code === 0), 'concurrent retries both succeed');
  assert.equal(retries[0].output, retries[1].output, 'concurrent retries return the same booking');
  const retryBooking = `(select id from public.call_bookings where payer_wallet='retry-fan')`;
  const checkout = (transaction, height) => `set role service_role; select public.prepare_call_payment(${retryBooking},'retry-fan','${transaction}',${height});`;
  const checkouts = await Promise.all([concurrentSql(checkout('checkout-one',101)), concurrentSql(checkout('checkout-two',202))]);
  assert.ok(checkouts.every(result => result.code === 0), 'concurrent checkout requests succeed');
  assert.equal(checkouts[0].output, checkouts[1].output, 'checkout retries preserve the winning transaction and block height');
  const confirm = signature => `set role service_role; select public.confirm_call_payment(${retryBooking},'retry-fan','${signature}');`;
  const payments = await Promise.all([concurrentSql(confirm('race-payment-one')), concurrentSql(confirm('race-payment-two'))]);
  assert.equal(payments.filter(result => result.code === 0).length, 1, 'one conflicting payment confirmation wins');
  assert.match(payments.find(result => result.code !== 0).error, /Different payment already confirmed/);
  const paymentWinner = payments[0].code === 0 ? 'race-payment-one' : 'race-payment-two';
  const paymentRetries = await Promise.all([concurrentSql(confirm(paymentWinner)), concurrentSql(confirm(paymentWinner))]);
  assert.ok(paymentRetries.every(result => result.code === 0), 'concurrent identical payment confirmations succeed');
  assert.equal(paymentRetries[0].output, paymentRetries[1].output, 'payment retries preserve the booking');
  const event = timestamp => `set role service_role; select public.record_call_video_event((select booking_id from public.call_video_rooms where booking_id=(select id from public.call_bookings where payer_wallet='fan-one')),'race-attendance','meeting.started',${timestamp},jsonb_build_object('room',(select room_name from public.call_video_rooms where booking_id=(select id from public.call_bookings where payer_wallet='fan-one'))));`;
  const eventRace = await Promise.all([concurrentSql(event(100)), concurrentSql(event(200))]);
  assert.equal(eventRace.filter(result => result.code === 0).length, 1, 'one conflicting attendance event wins');
  assert.match(eventRace.find(result => result.code !== 0).error, /Conflicting event ID/);
  const eventWinner = eventRace[0].code === 0 ? 100 : 200;
  const eventRetries = await Promise.all([concurrentSql(event(eventWinner)), concurrentSql(event(eventWinner))]);
  assert.ok(eventRetries.every(result => result.code === 0), 'concurrent identical attendance deliveries succeed');
  assert.equal(docker([...sqlArgs, '-tA'], "select count(*) from public.call_video_events where event_id='race-attendance';").trim(), '1', 'attendance retries store one event');
  const submitReview = rating => `set role service_role; select public.submit_call_review((select id from public.call_bookings where payer_wallet='race-review-fan'),'race-review-fan',${rating},4,4,4,'Concurrent feedback');`;
  const reviewRace = await Promise.all([concurrentSql(submitReview(1)), concurrentSql(submitReview(5))]);
  assert.equal(reviewRace.filter(result => result.code === 0).length, 1, 'one concurrent review wins');
  assert.match(reviewRace.find(result => result.code !== 0).error, /A review already exists/);
  const winner = reviewRace[0].code === 0 ? 1 : 5;
  const reviewRetries = await Promise.all([concurrentSql(submitReview(winner)), concurrentSql(submitReview(winner))]);
  assert.ok(reviewRetries.every(result => result.code === 0), 'concurrent identical review retries succeed');
  console.info('All migrations passed: permissions, booking lifecycle, concurrent slots/payment/attendance retries, review eligibility/aggregation, and creator Storage policies verified.');
} finally {
  if (started) docker(['stop', name]);
}

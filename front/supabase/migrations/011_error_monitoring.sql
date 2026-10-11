begin;

create table public.error_alerts (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null,
  window_start timestamptz not null,
  event jsonb not null,
  occurrences integer not null default 1 check (occurrences > 0),
  first_seen timestamptz not null default clock_timestamp(),
  last_seen timestamptz not null default clock_timestamp(),
  delivered_at timestamptz,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default clock_timestamp(),
  lease_id uuid,
  lease_until timestamptz,
  unique (fingerprint, window_start)
);
create index error_alerts_delivery on public.error_alerts(next_attempt_at) where delivered_at is null;
create table public.error_alert_receipts (
  request_id uuid not null,
  kind text not null,
  received_at timestamptz not null default clock_timestamp(),
  primary key (request_id, kind)
);
alter table public.error_alerts enable row level security;
alter table public.error_alert_receipts enable row level security;
revoke all on public.error_alerts, public.error_alert_receipts from anon, authenticated;
grant all on public.error_alerts, public.error_alert_receipts to service_role;

create function public.record_error_alert(alert jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare
  safe_event jsonb;
  inserted_id uuid;
  seen_at timestamptz := clock_timestamp();
begin
  if jsonb_typeof(alert) <> 'object' or alert - array['kind','route','method','status','request_id','payment_flow','outcome'] <> '{}'::jsonb
    or coalesce(alert->>'kind','') not in ('api_5xx', 'payment_verification_failed')
    or coalesce(alert->>'route','') not in ('/api/aliases','/api/dashboard','/api/profile','/api/sponsorships','/api/auth/nonce','/api/auth/session','/api/tips','/api/tips/confirm','/api/actions/claim-alias','/api/actions/claim-alias/confirm','/api/actions/claim-alias/pending','/api/actions/tip/[alias]','/api/actions/tip/[alias]/confirm')
    or coalesce(alert->>'method','') not in ('GET','POST','PATCH','PUT','DELETE','HEAD','OPTIONS')
    or coalesce(alert->>'request_id','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    or jsonb_typeof(alert->'status') is distinct from 'number' or coalesce(alert->>'status','') !~ '^[45][0-9]{2}$'
    or (alert->>'kind' = 'api_5xx' and ((alert->>'status')::integer < 500 or alert ? 'payment_flow' or alert ? 'outcome'))
    or (alert->>'kind' = 'payment_verification_failed' and (coalesce(alert->>'payment_flow','') not in ('tip','alias_claim','sponsorship')
      or coalesce(alert->>'outcome','') not in ('transaction_failed','payment_mismatch','verification_rejected','service_error'))) then
    raise exception 'Invalid monitoring event';
  end if;
  safe_event := jsonb_strip_nulls(jsonb_build_object('kind',alert->>'kind','route',alert->>'route','method',alert->>'method',
    'status',(alert->>'status')::integer,'request_id',alert->>'request_id','payment_flow',alert->>'payment_flow','outcome',alert->>'outcome'));
  -- Retain only 30 days. Bounded cleanup runs during normal intake.
  delete from public.error_alerts where id in (select id from public.error_alerts where last_seen < seen_at - interval '30 days' limit 100 for update skip locked);
  delete from public.error_alert_receipts where (request_id, kind) in
    (select request_id, kind from public.error_alert_receipts where received_at < seen_at - interval '30 days' limit 100 for update skip locked);
  insert into public.error_alert_receipts(request_id,kind) values ((alert->>'request_id')::uuid,alert->>'kind')
    on conflict do nothing returning request_id into inserted_id;
  if inserted_id is null then return; end if;
  -- Same failure category/route/status alerts at most once per five-minute window.
  insert into public.error_alerts as a(fingerprint,window_start,event)
    values ((safe_event - 'request_id')::text,date_bin(interval '5 minutes',seen_at,timestamptz '2020-01-01'),safe_event)
    on conflict (fingerprint,window_start) do update
      set occurrences = least(a.occurrences::bigint + 1, 2147483647), last_seen = seen_at;
end;
$$;

create function public.claim_error_alerts()
returns setof public.error_alerts language sql security invoker set search_path = public as $$
  update public.error_alerts a set lease_id = gen_random_uuid(), lease_until = clock_timestamp() + interval '2 minutes', attempts = a.attempts + 1
  where a.id in (select id from public.error_alerts where delivered_at is null and attempts < 10
    and next_attempt_at <= clock_timestamp() and (lease_until is null or lease_until < clock_timestamp())
    order by next_attempt_at limit 5 for update skip locked)
  returning a.*;
$$;

create function public.finish_error_alert(alert_id uuid, delivery_lease uuid, delivered boolean)
returns void language sql security invoker set search_path = public as $$
  update public.error_alerts set
    delivered_at = case when delivered then clock_timestamp() else null end,
    next_attempt_at = clock_timestamp() + make_interval(secs => least(3600, (power(2, least(attempts, 12)) * 30)::integer)),
    lease_id = null, lease_until = null
  where id = alert_id and lease_id = delivery_lease;
$$;
revoke all on function public.record_error_alert(jsonb), public.claim_error_alerts(), public.finish_error_alert(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.record_error_alert(jsonb), public.claim_error_alerts(), public.finish_error_alert(uuid,uuid,boolean) to service_role;
notify pgrst, 'reload schema';
commit;

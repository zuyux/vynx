begin;

-- Weekly local wall-clock windows, interpreted in the offer's IANA timezone.
-- Scheduling/UTC conversion, slot locks and payments are separate features.
create function public.valid_call_availability(windows jsonb, duration integer)
returns boolean language plpgsql immutable security invoker set search_path = public, pg_temp as $$
declare item jsonb; day_number integer; start_min integer; end_min integer; previous_day integer := -1; previous_end integer := -1;
begin
  if jsonb_typeof(windows) is distinct from 'array' then return false; end if;
  if jsonb_array_length(windows) > 28 then return false; end if;
  for item in select value from jsonb_array_elements(windows) order by value->>'weekday', value->>'start' loop
    if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'weekday') is distinct from 'number'
      or (item->>'weekday') !~ '^[0-6]$' or jsonb_typeof(item->'start') is distinct from 'string' or jsonb_typeof(item->'end') is distinct from 'string'
      or (item->>'start') !~ '^([01][0-9]|2[0-3]):(00|15|30|45)$' or (item->>'end') !~ '^([01][0-9]|2[0-3]):(00|15|30|45)$'
      or (select count(*) from jsonb_object_keys(item)) <> 3 then return false; end if;
    day_number := (item->>'weekday')::integer;
    start_min := split_part(item->>'start', ':', 1)::integer * 60 + split_part(item->>'start', ':', 2)::integer;
    end_min := split_part(item->>'end', ':', 1)::integer * 60 + split_part(item->>'end', ':', 2)::integer;
    if end_min - start_min < duration or (day_number = previous_day and start_min < previous_end) then return false; end if;
    previous_day := day_number; previous_end := end_min;
  end loop;
  return true;
end $$;
create function public.valid_call_timezone(zone text)
returns boolean language sql stable security invoker set search_path = public, pg_temp as $$
  select exists (select 1 from pg_timezone_names where name = zone and zone !~ '^(posix|right)/');
$$;
revoke all on function public.valid_call_availability(jsonb, integer), public.valid_call_timezone(text) from public, anon, authenticated;
grant execute on function public.valid_call_availability(jsonb, integer), public.valid_call_timezone(text) to service_role;

create table public.call_offers (
  id uuid primary key default gen_random_uuid(),
  creator_wallet text not null unique references public.cards_users(wallet_address) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 100),
  description text not null check (char_length(btrim(description)) between 10 and 2000),
  duration_minutes integer not null check (duration_minutes between 15 and 240 and duration_minutes % 15 = 0),
  price_units bigint not null check (price_units between 10000 and 1000000000),
  currency text not null default 'USDC' check (currency = 'USDC'),
  cluster text not null default 'devnet' check (cluster = 'devnet'),
  timezone text not null check (char_length(timezone) <= 100 and public.valid_call_timezone(timezone)),
  availability jsonb not null default '[]'::jsonb check (public.valid_call_availability(availability, duration_minutes)),
  accepting boolean not null default false check (not accepting or jsonb_array_length(availability) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger call_offers_updated_at before update on public.call_offers for each row execute function public.set_updated_at();
alter table public.call_offers enable row level security;
revoke all on public.call_offers from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.call_offers to service_role;
-- Include the new endpoint in the existing durable alert allowlist.
create or replace function public.record_error_alert(alert jsonb)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  safe_event jsonb;
  inserted_id uuid;
  seen_at timestamptz := clock_timestamp();
begin
  if jsonb_typeof(alert) <> 'object' or alert - array['kind','route','method','status','request_id','payment_flow','outcome'] <> '{}'::jsonb
    or coalesce(alert->>'kind','') not in ('api_5xx', 'payment_verification_failed')
    or coalesce(alert->>'route','') not in ('/api/call-offer','/api/aliases','/api/dashboard','/api/profile','/api/sponsorships','/api/auth/nonce','/api/auth/session','/api/tips','/api/tips/confirm','/api/actions/claim-alias','/api/actions/claim-alias/confirm','/api/actions/claim-alias/pending','/api/actions/tip/[alias]','/api/actions/tip/[alias]/confirm')
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

notify pgrst, 'reload schema';
commit;

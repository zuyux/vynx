begin;
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
set local search_path = public, extensions;
create table public.call_bookings (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.call_offers(id),
  creator_wallet text not null,
  payer_wallet text not null check (payer_wallet <> creator_wallet),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  expires_at timestamptz not null,
  terms jsonb not null,
  price_units bigint not null check (price_units between 10000 and 1000000000),
  state text not null default 'awaiting_payment' check (state in ('awaiting_payment','confirmed','expired')),
  transaction text,
  last_valid_block_height bigint,
  payment_signature text unique,
  created_at timestamptz not null default now(),
  check ((transaction is null) = (last_valid_block_height is null)),
  check ((state = 'confirmed') = (payment_signature is not null)),
  exclude using gist (creator_wallet with =, tstzrange(starts_at, ends_at, '[)') with &&) where (state <> 'expired')
);
alter table public.call_bookings enable row level security;
revoke all on public.call_bookings from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.call_bookings to service_role;

-- Lock the offer before checking existing reservations. The exclusion constraint
-- protects overlapping bookings even if durations or availability change.
create function public.reserve_call(offer uuid, payer text, slot timestamptz)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare o public.call_offers; b public.call_bookings; local_start timestamp; local_end timestamp;
begin
  select * into o from public.call_offers where id = offer for update;
  if not found or not o.accepting or payer = o.creator_wallet then raise exception 'Offer unavailable'; end if;
  select * into b from public.call_bookings where offer_id = offer and payer_wallet = payer and starts_at = slot and state <> 'expired';
  if found then return to_jsonb(b); end if;
  if slot < now() + interval '15 minutes' or slot > now() + interval '60 days' or extract(second from slot) <> 0 then raise exception 'Invalid slot'; end if;
  local_start := slot at time zone o.timezone;
  local_end := (slot + make_interval(mins => o.duration_minutes)) at time zone o.timezone;
  if extract(minute from local_start)::integer % 15 <> 0 or local_end - local_start <> make_interval(mins => o.duration_minutes)
    or local_start::date <> local_end::date or not exists (
      select 1 from jsonb_array_elements(o.availability) w
      where (w->>'weekday')::integer = extract(dow from local_start)::integer
        and local_start::time >= (w->>'start')::time and local_end::time <= (w->>'end')::time
  ) then raise exception 'Slot outside availability'; end if;
  insert into public.call_bookings(offer_id, creator_wallet, payer_wallet, starts_at, ends_at, expires_at, terms, price_units)
    values(offer, o.creator_wallet, payer, slot, slot + make_interval(mins => o.duration_minutes), date_trunc('second',now() + interval '10 minutes'),
      jsonb_build_object('policy','vynx-escrow-devnet-v1','title',o.title,'description',o.description,'duration_minutes',o.duration_minutes,
        'timezone',o.timezone,'price_units',o.price_units,'currency',o.currency,'cluster',o.cluster,
        'cancellation_hours',24,'dispute_hours',24,'recovery_days',30),o.price_units) returning * into b;
  return to_jsonb(b);
end;
$$;
create function public.prepare_call_payment(booking_id uuid, payer text, encoded_transaction text, valid_height bigint)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare b public.call_bookings;
begin
  select * into b from public.call_bookings where id = booking_id and payer_wallet = payer for update;
  if not found then raise exception 'Booking not found'; end if;
  if b.transaction is not null or b.state = 'confirmed' then return to_jsonb(b); end if;
  if b.state <> 'awaiting_payment' or b.expires_at <= now() then raise exception 'Reservation expired'; end if;
  update public.call_bookings set transaction = encoded_transaction, last_valid_block_height = valid_height where id = booking_id returning * into b;
  return to_jsonb(b);
end;
$$;
-- Only the server invokes this after independently verifying finalized escrow state.
create function public.confirm_call_payment(booking_id uuid, payer text, signature text)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare b public.call_bookings;
begin
  select * into b from public.call_bookings where id = booking_id and payer_wallet = payer for update;
  if not found or b.state = 'expired' then raise exception 'Booking unavailable'; end if;
  if b.state = 'confirmed' then
    if b.payment_signature <> signature then raise exception 'Different payment already confirmed'; end if;
    return to_jsonb(b);
  end if;
  update public.call_bookings set state = 'confirmed', payment_signature = signature where id = booking_id returning * into b;
  return to_jsonb(b);
end;
$$;
-- Call only after the quote expired AND finalized block height exceeded its
-- validity AND the finalized escrow PDA is absent. With no prepared transaction,
-- no server-signed funding operation exists and clock expiry suffices.
create function public.expire_call_reservation(booking_id uuid, observed_height bigint)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  update public.call_bookings set state = 'expired' where id = booking_id and state = 'awaiting_payment' and expires_at < now()
    and (transaction is null or last_valid_block_height < observed_height);
end;
$$;
revoke all on function public.reserve_call(uuid,text,timestamptz), public.prepare_call_payment(uuid,text,text,bigint),
  public.confirm_call_payment(uuid,text,text), public.expire_call_reservation(uuid,bigint) from public, anon, authenticated;
grant execute on function public.reserve_call(uuid,text,timestamptz), public.prepare_call_payment(uuid,text,text,bigint),
  public.confirm_call_payment(uuid,text,text), public.expire_call_reservation(uuid,bigint) to service_role;
create or replace function public.record_error_alert(alert jsonb)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  safe_event jsonb;
  inserted_id uuid;
  seen_at timestamptz := clock_timestamp();
begin
  if jsonb_typeof(alert) <> 'object' or alert - array['kind','route','method','status','request_id','payment_flow','outcome'] <> '{}'::jsonb
    or coalesce(alert->>'kind','') not in ('api_5xx', 'payment_verification_failed')
    or coalesce(alert->>'route','') not in ('/api/bookings','/api/call-offer','/api/aliases','/api/dashboard','/api/profile','/api/sponsorships','/api/auth/nonce','/api/auth/session','/api/tips','/api/tips/confirm','/api/actions/claim-alias','/api/actions/claim-alias/confirm','/api/actions/claim-alias/pending','/api/actions/tip/[alias]','/api/actions/tip/[alias]/confirm')
    or coalesce(alert->>'method','') not in ('GET','POST','PATCH','PUT','DELETE','HEAD','OPTIONS')
    or coalesce(alert->>'request_id','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    or jsonb_typeof(alert->'status') is distinct from 'number' or coalesce(alert->>'status','') !~ '^[45][0-9]{2}$'
    or (alert->>'kind' = 'api_5xx' and ((alert->>'status')::integer < 500 or alert ? 'payment_flow' or alert ? 'outcome'))
    or (alert->>'kind' = 'payment_verification_failed' and (coalesce(alert->>'payment_flow','') not in ('tip','alias_claim','sponsorship','booking')
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

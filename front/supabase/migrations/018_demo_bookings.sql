begin;
-- Isolated from paid bookings and escrow. A reservation lasts until its demo call ends.
create table public.demo_call_bookings (
  id uuid primary key default gen_random_uuid(),
  offer_id text not null check (offer_id = 'luna-creative-session'),
  creator_id text not null check (creator_id = 'demo-luna'),
  payer_wallet text not null,
  request_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at = starts_at + interval '30 minutes'),
  terms jsonb not null,
  accepted_at timestamptz not null default now(),
  unique (payer_wallet, request_id),
  unique (payer_wallet, offer_id, starts_at),
  exclude using gist (creator_id with =, tstzrange(starts_at,ends_at,'[)') with &&)
);
alter table public.demo_call_bookings enable row level security;
revoke all on public.demo_call_bookings from public,anon,authenticated,service_role;
grant select,insert on public.demo_call_bookings to service_role;

create function public.reserve_demo_call(payer text, request_id uuid, slot timestamptz, accepted_policy text, viewer_timezone text)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare b public.demo_call_bookings; local_start timestamp;
begin
  if payer is null or payer = '' or request_id is null or slot is null
    or accepted_policy is distinct from 'vynx-demo-booking-v1'
    or viewer_timezone is null or not public.valid_call_timezone(viewer_timezone) then
    raise exception 'Invalid reservation';
  end if;
  -- Serializes retries and conflicts across every app instance for this creator.
  perform pg_advisory_xact_lock(18018, 1);
  select * into b from public.demo_call_bookings d where d.payer_wallet = payer and d.request_id = reserve_demo_call.request_id;
  if found then
    if b.starts_at <> slot or b.terms->>'viewer_timezone' <> viewer_timezone then
      raise exception 'Idempotency key reused' using errcode = '22023';
    end if;
    return to_jsonb(b);
  end if;
  local_start := slot at time zone 'America/Argentina/Buenos_Aires';
  if slot < now() + interval '15 minutes' or slot > now() + interval '14 days'
    or extract(second from slot) <> 0 or extract(minute from local_start)::int % 15 <> 0
    or local_start::time < time '15:00' or local_start::time > time '17:30' then
    raise exception 'Invalid slot' using errcode = '22023';
  end if;
  insert into public.demo_call_bookings(offer_id,creator_id,payer_wallet,request_id,starts_at,ends_at,terms)
    values('luna-creative-session','demo-luna',payer,request_id,slot,slot + interval '30 minutes',
      jsonb_build_object('policy',accepted_policy,'demo',true,'title','Creative session','duration_minutes',30,
        'price_units',35000000,'currency','USDC','timezone','America/Argentina/Buenos_Aires',
        'viewer_timezone',viewer_timezone,'payment','simulation-only')) returning * into b;
  return to_jsonb(b);
end $$;
revoke all on function public.reserve_demo_call(text,uuid,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.reserve_demo_call(text,uuid,timestamptz,text,text) to service_role;
notify pgrst, 'reload schema';
commit;

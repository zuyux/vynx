begin;

create table public.monthly_subscriptions (
  id uuid primary key default gen_random_uuid(),
  creator_wallet text not null,
  payer_wallet text not null check (payer_wallet <> creator_wallet),
  creator_alias text not null,
  offer_key text not null,
  terms jsonb not null,
  price_units bigint not null check (price_units between 10000 and 1000000000),
  anchor_at timestamptz not null default date_trunc('second',now()),
  paid_until timestamptz,
  stopped_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index monthly_active_plan on public.monthly_subscriptions(creator_wallet,payer_wallet,offer_key) where stopped_at is null;
create table public.monthly_invoices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.monthly_subscriptions(id),
  period_start timestamptz not null,
  period_end timestamptz not null check (period_end > period_start),
  price_units bigint not null check (price_units between 10000 and 1000000000),
  state text not null default 'awaiting_payment' check (state in ('awaiting_payment','paid','void')),
  expires_at timestamptz not null default now() + interval '10 minutes',
  transaction text,
  last_valid_block_height bigint,
  quoted_slot bigint,
  payment_signature text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check ((transaction is null) = (last_valid_block_height is null)),
  check ((transaction is null) = (quoted_slot is null)),
  check ((state = 'paid') = (payment_signature is not null)),
  check ((state = 'paid') = (paid_at is not null))
);
create unique index monthly_one_pending_invoice on public.monthly_invoices(subscription_id) where state='awaiting_payment';
create unique index monthly_one_paid_period on public.monthly_invoices(subscription_id,period_start) where state='paid';
alter table public.monthly_subscriptions enable row level security;
alter table public.monthly_invoices enable row level security;
revoke all on public.monthly_subscriptions,public.monthly_invoices from public,anon,authenticated,service_role;
grant select,insert,update,delete on public.monthly_subscriptions,public.monthly_invoices to service_role;

alter table public.call_bookings alter column offer_id drop not null;
alter table public.call_bookings add column monthly_invoice_id uuid references public.monthly_invoices(id);
alter table public.call_bookings add constraint booking_source_check check
  ((offer_id is not null and monthly_invoice_id is null) or (offer_id is null and monthly_invoice_id is not null));
alter table public.call_bookings drop constraint booking_payment_check;
alter table public.call_bookings add constraint booking_payment_check check
  ((monthly_invoice_id is not null and payment_signature is null and transaction is null)
   or (monthly_invoice_id is null and ((state in ('confirmed','completed','no_show','disputed') and payment_signature is not null)
   or (state in ('awaiting_payment','expired') and payment_signature is null) or state = 'cancelled')));

-- Calendar-month billing retains the original anniversary (Jan 31 -> Feb 28 -> Mar 31).
create function public.monthly_period_end(anchor timestamptz, period_start timestamptz)
returns timestamptz language sql immutable security invoker set search_path = public, pg_temp as $$
  select (date_trunc('month',period_start at time zone 'UTC') + interval '1 month'
    + (least(extract(day from anchor at time zone 'UTC')::int,
        extract(day from date_trunc('month',period_start at time zone 'UTC') + interval '2 months - 1 day')::int)-1) * interval '1 day'
    + ((anchor at time zone 'UTC')::time - time '00:00')) at time zone 'UTC'
$$;

-- Only quotes that were never prepared can expire by wall clock. Prepared quotes
-- retain their slots until finalized-chain recovery proves that no payment landed.
create function public.expire_unprepared_monthly_invoices()
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare i public.monthly_invoices;
begin
  for i in select * from public.monthly_invoices where state='awaiting_payment' and transaction is null and expires_at<now() for update skip locked loop
    update public.call_bookings set state='expired' where monthly_invoice_id=i.id and state='awaiting_payment';
    update public.monthly_invoices set state='void' where id=i.id;
  end loop;
end $$;

create function public.reserve_monthly_offer(payer text, alias text default null, offer_key text default null, subscription uuid default null)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare s public.monthly_subscriptions; i public.monthly_invoices; c public.cards_users;
  offer jsonb; price numeric; start_at timestamptz; finish_at timestamptz; local_day date;
  entry jsonb; session_start timestamptz; session_end timestamptz; duration int; zone text;
begin
  if payer is null or payer='' then raise exception 'Invalid payer' using errcode='22023'; end if;
  perform public.expire_unprepared_monthly_invoices();
  -- Serializes enrollment retries without trusting any browser terms or amount.
  perform pg_advisory_xact_lock(hashtextextended('monthly:'||payer,0));
  if subscription is not null then
    select * into s from public.monthly_subscriptions where id=subscription and payer_wallet=payer for update;
    if not found then raise exception 'Subscription not found' using errcode='P0002'; end if;
  else
    select * into c from public.cards_users where username=alias and published for update;
    if not found or c.wallet_address=payer then raise exception 'Offer unavailable' using errcode='P0002'; end if;
    select * into s from public.monthly_subscriptions m where m.creator_wallet=c.wallet_address and m.payer_wallet=payer
      and m.offer_key=reserve_monthly_offer.offer_key and m.stopped_at is null for update;
    if not found then
      if exists(select 1 from public.monthly_subscriptions m where m.creator_wallet=c.wallet_address and m.payer_wallet=payer
        and m.offer_key=reserve_monthly_offer.offer_key and m.paid_until>now()) then
        raise exception 'This offer is already paid for the current month' using errcode='22023'; end if;
      select value into offer from jsonb_array_elements(coalesce(c.design->'offers','[]'::jsonb)) where value->>'id'=offer_key;
      if offer is null or offer->>'billingPeriod' is distinct from 'month' or offer->>'price' !~ '^\d{1,4}(\.\d{1,6})?$' then
        raise exception 'Monthly offer unavailable' using errcode='22023'; end if;
      price := (offer->>'price')::numeric*1000000;
      if price not between 10000 and 1000000000 then raise exception 'Invalid price' using errcode='22023'; end if;
      insert into public.monthly_subscriptions(creator_wallet,payer_wallet,creator_alias,offer_key,terms,price_units)
        values(c.wallet_address,payer,alias,offer_key,offer||jsonb_build_object('policy','vynx-monthly-devnet-v1','currency','USDC','cluster','devnet'),price) returning * into s;
    end if;
  end if;
  if s.stopped_at is not null then raise exception 'Renewals stopped' using errcode='22023'; end if;
  select * into i from public.monthly_invoices where subscription_id=s.id and state='awaiting_payment' for update;
  if found then return jsonb_build_object('subscription',to_jsonb(s),'invoice',to_jsonb(i)); end if;
  if s.paid_until is not null and s.paid_until > now()+interval '7 days' then raise exception 'Renewal opens 7 days before the due date' using errcode='22023'; end if;
  start_at := greatest(coalesce(s.paid_until,s.anchor_at),date_trunc('second',now()));
  -- Restart an overdue plan from today, keeping its new anniversary for later months.
  if s.paid_until is null or s.paid_until < now() then
    update public.monthly_subscriptions set anchor_at=start_at where id=s.id returning * into s;
  end if;
  finish_at := public.monthly_period_end(s.anchor_at,start_at);
  insert into public.monthly_invoices(subscription_id,period_start,period_end,price_units)
    values(s.id,start_at,finish_at,s.price_units) returning * into i;
  if s.terms->>'type'='bookings' then
    duration := (s.terms->>'durationMinutes')::int; zone := s.terms->>'timezone';
    if duration is null or duration not in (30,60,90,120,180) or zone is null or not public.valid_call_timezone(zone)
      or jsonb_typeof(s.terms->'schedule') is distinct from 'array' or jsonb_array_length(s.terms->'schedule') not between 1 and 28 then
      raise exception 'Invalid weekly schedule' using errcode='22023'; end if;
    for local_day in select d::date from generate_series((start_at at time zone zone)::date::timestamp,(finish_at at time zone zone)::date::timestamp,interval '1 day') d loop
      for entry in select value from jsonb_array_elements(s.terms->'schedule') where (value->>'weekday')::int=extract(dow from local_day)::int loop
        if entry->>'time' !~ '^(?:[01]\d|2[0-3]):[0-5]\d$' then raise exception 'Invalid session time' using errcode='22023'; end if;
        session_start := (local_day+(entry->>'time')::time) at time zone zone;
        session_end := session_start+make_interval(mins=>duration);
        if session_start>=greatest(start_at,now()+interval '15 minutes') and session_start<finish_at then
          if (session_start at time zone zone)::time<>(entry->>'time')::time
            or (session_end at time zone zone)-(session_start at time zone zone)<>make_interval(mins=>duration)
            or (session_end at time zone zone)::date<>local_day then
            raise exception 'Session crosses a clock change or midnight' using errcode='22023'; end if;
          insert into public.call_bookings(creator_wallet,payer_wallet,starts_at,ends_at,expires_at,terms,price_units,monthly_invoice_id)
            values(s.creator_wallet,payer,session_start,session_end,i.expires_at,
              s.terms||jsonb_build_object('title',s.terms->>'title','timezone',zone,'duration_minutes',duration,'billing_period','month','monthly_price_units',s.price_units),s.price_units,i.id);
        end if;
      end loop;
    end loop;
    if not exists(select 1 from public.call_bookings where monthly_invoice_id=i.id) then raise exception 'No sessions in this billing month' using errcode='22023'; end if;
  end if;
  return jsonb_build_object('subscription',to_jsonb(s),'invoice',to_jsonb(i));
end $$;

create function public.prepare_monthly_payment(invoice uuid,payer text,encoded_transaction text,valid_height bigint,quote_slot bigint)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare i public.monthly_invoices;
begin
  select m.* into i from public.monthly_invoices m join public.monthly_subscriptions s on s.id=m.subscription_id
    where m.id=invoice and s.payer_wallet=payer for update of m;
  if not found then raise exception 'Invoice not found' using errcode='P0002'; end if;
  if i.state='paid' or i.transaction is not null then return to_jsonb(i); end if;
  if i.state<>'awaiting_payment' or i.expires_at<=now() then raise exception 'Invoice expired' using errcode='22023'; end if;
  update public.monthly_invoices set transaction=encoded_transaction,last_valid_block_height=valid_height,quoted_slot=quote_slot where id=i.id returning * into i;
  return to_jsonb(i);
end $$;

create function public.confirm_monthly_payment(invoice uuid,payer text,signature text)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare i public.monthly_invoices; s public.monthly_subscriptions;
begin
  select * into i from public.monthly_invoices where id=invoice;
  if not found then raise exception 'Invoice not found' using errcode='P0002'; end if;
  select * into s from public.monthly_subscriptions where id=i.subscription_id and payer_wallet=payer for update;
  if not found then raise exception 'Invoice not found' using errcode='P0002'; end if;
  select * into i from public.monthly_invoices where id=invoice for update;
  if i.state='paid' then
    if i.payment_signature<>signature then raise exception 'Different payment already confirmed' using errcode='23505'; end if;
    return to_jsonb(i);
  end if;
  if i.state<>'awaiting_payment' or i.transaction is null or signature is null or signature='' then raise exception 'Invoice unavailable' using errcode='22023'; end if;
  update public.monthly_invoices set state='paid',payment_signature=signature,paid_at=now() where id=i.id returning * into i;
  update public.monthly_subscriptions set paid_until=i.period_end where id=s.id;
  update public.call_bookings set state='confirmed' where monthly_invoice_id=i.id and state='awaiting_payment';
  return to_jsonb(i);
end $$;

-- Invoked only after finalized block height and complete payer history were checked
-- against the exact prepared message. A verified payment always confirms instead.
create function public.void_monthly_invoice(invoice uuid,payer text,observed_height bigint)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare i public.monthly_invoices;
begin
  select m.* into i from public.monthly_invoices m join public.monthly_subscriptions s on s.id=m.subscription_id
    where m.id=invoice and s.payer_wallet=payer for update of m;
  if not found or i.state<>'awaiting_payment' or (i.transaction is not null and i.last_valid_block_height>=observed_height) then raise exception 'Invoice cannot be reset' using errcode='22023'; end if;
  update public.call_bookings set state='expired' where monthly_invoice_id=i.id and state='awaiting_payment';
  update public.monthly_invoices set state='void' where id=i.id;
end $$;
create function public.stop_monthly_subscription(subscription uuid,payer text)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  perform 1 from public.monthly_subscriptions where id=subscription and payer_wallet=payer for update;
  if not found then raise exception 'Subscription not found' using errcode='P0002'; end if;
  -- Already approved transfers remain recoverable; stopping never revokes paid access.
  update public.monthly_subscriptions set stopped_at=coalesce(stopped_at,now()) where id=subscription;
  update public.call_bookings set state='expired' where monthly_invoice_id in
    (select id from public.monthly_invoices where subscription_id=subscription and state='awaiting_payment' and transaction is null);
  update public.monthly_invoices set state='void' where subscription_id=subscription and state='awaiting_payment' and transaction is null;
  perform public.expire_unprepared_monthly_invoices();
end $$;

create function public.transition_monthly_session(booking uuid,actor text,target text)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare b public.call_bookings;
begin
  select * into b from public.call_bookings where id=booking and monthly_invoice_id is not null for update;
  if not found or actor not in(b.payer_wallet,b.creator_wallet) then raise exception 'Session not found' using errcode='P0002'; end if;
  if target not in('completed','no_show','cancelled') or target is null then raise exception 'Invalid state' using errcode='22023'; end if;
  if b.state=target then return to_jsonb(b); end if;
  if b.state<>'confirmed' then raise exception 'Session unavailable' using errcode='22023'; end if;
  if target in('completed','no_show') and now()<b.ends_at then raise exception 'Session has not ended' using errcode='22023'; end if;
  if target='completed' and actor<>b.payer_wallet then raise exception 'Only the payer can acknowledge completion' using errcode='22023'; end if;
  if target='cancelled' and actor<>b.creator_wallet then raise exception 'Only the creator can cancel a monthly session' using errcode='22023'; end if;
  insert into public.call_booking_transitions(booking_id,actor_wallet,previous_state,next_state) values(b.id,actor,b.state,target);
  update public.call_bookings set state=target where id=b.id returning * into b;
  return to_jsonb(b);
end $$;

-- Prevent monthly sessions from entering the per-session escrow payment state machine.
create function public.guard_monthly_session_payment()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if new.monthly_invoice_id is not null and new.state in('confirmed','completed','no_show','disputed','cancelled') and
    not exists(select 1 from public.monthly_invoices where id=new.monthly_invoice_id and state='paid') then
    raise exception 'Monthly payment required'; end if;
  return new;
end $$;
create trigger monthly_session_payment before insert or update on public.call_bookings for each row execute function public.guard_monthly_session_payment();

-- Extend the existing review and attendance queries while preserving their full validation.
do $$ declare definition text; begin
  select pg_get_functiondef('public.submit_call_review(uuid,text,integer,integer,integer,integer,text)'::regprocedure) into definition;
  execute replace(definition,'b.payment_signature is null','(b.payment_signature is null and b.monthly_invoice_id is null)');
  select pg_get_functiondef('public.creator_call_evidence(text,uuid)'::regprocedure) into definition;
  execute replace(definition,'b.payment_signature is not null','(b.payment_signature is not null or b.monthly_invoice_id is not null)');
end $$;

revoke all on function public.monthly_period_end(timestamptz,timestamptz),public.expire_unprepared_monthly_invoices(),
 public.reserve_monthly_offer(text,text,text,uuid),public.prepare_monthly_payment(uuid,text,text,bigint,bigint),
 public.confirm_monthly_payment(uuid,text,text),public.void_monthly_invoice(uuid,text,bigint),public.stop_monthly_subscription(uuid,text),
 public.transition_monthly_session(uuid,text,text),public.guard_monthly_session_payment() from public,anon,authenticated;
grant execute on function public.monthly_period_end(timestamptz,timestamptz),public.expire_unprepared_monthly_invoices(),
 public.reserve_monthly_offer(text,text,text,uuid),public.prepare_monthly_payment(uuid,text,text,bigint,bigint),
 public.confirm_monthly_payment(uuid,text,text),public.void_monthly_invoice(uuid,text,bigint),public.stop_monthly_subscription(uuid,text),
 public.transition_monthly_session(uuid,text,text),public.guard_monthly_session_payment() to service_role;
notify pgrst,'reload schema';
commit;

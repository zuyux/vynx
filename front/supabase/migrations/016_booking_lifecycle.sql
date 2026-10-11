begin;
-- Replace the original state/payment checks; retain all other booking constraints.
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid = 'public.call_bookings'::regclass
    and contype = 'c' and pg_get_constraintdef(oid) like '%state%'
  loop execute format('alter table public.call_bookings drop constraint %I', c.conname); end loop;
end $$;
alter table public.call_bookings add constraint booking_state_check check
  (state in ('awaiting_payment','confirmed','completed','cancelled','no_show','disputed','expired'));
alter table public.call_bookings add constraint booking_payment_check check
  ((state in ('confirmed','completed','no_show','disputed') and payment_signature is not null)
   or (state in ('awaiting_payment','expired') and payment_signature is null) or state = 'cancelled');
-- Cancelled funded bookings retain their slot until escrow cancellation is implemented.
-- This avoids selling the same service twice while funds remain locked.
create table public.call_booking_transitions (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.call_bookings(id),
  actor_wallet text not null,
  previous_state text not null,
  next_state text not null,
  created_at timestamptz not null default now()
);
alter table public.call_booking_transitions enable row level security;
revoke all on public.call_booking_transitions from public,anon,authenticated;
grant select,insert on public.call_booking_transitions to service_role;
grant usage on sequence public.call_booking_transitions_id_seq to service_role;

create function public.transition_call_booking(booking_id uuid, actor text, target text)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare b public.call_bookings;
begin
  select * into b from public.call_bookings where id = booking_id for update;
  if not found or actor not in (b.creator_wallet,b.payer_wallet) then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  if target not in ('completed','cancelled','no_show','disputed') or target is null then raise exception 'Invalid state'; end if;
  -- Repeated requests never create another transition or roll back a later state.
  if b.state = target then return to_jsonb(b); end if;
  if target = 'cancelled' then
    if b.state <> 'confirmed' or b.starts_at < now() + make_interval(hours => (b.terms->>'cancellation_hours')::int)
      or b.terms->>'cancellation_hours' is null then raise exception 'Cancellation unavailable'; end if;
  elsif target in ('completed','no_show') then
    if b.state <> 'confirmed' or now() < b.ends_at then raise exception 'Call has not ended or state is final'; end if;
    if target = 'completed' and actor <> b.payer_wallet then raise exception 'Only the payer can acknowledge completion'; end if;
  else
    if b.state not in ('confirmed','completed','no_show') or b.terms->>'dispute_hours' is null
      or now() > b.ends_at + make_interval(hours => (b.terms->>'dispute_hours')::int) then raise exception 'Dispute unavailable'; end if;
  end if;
  insert into public.call_booking_transitions(booking_id,actor_wallet,previous_state,next_state)
    values(b.id,actor,b.state,target);
  update public.call_bookings set state = target where id = b.id returning * into b;
  return to_jsonb(b);
end $$;

-- Payment retries must preserve lifecycle states after the first confirmation.
create or replace function public.confirm_call_payment(booking_id uuid, payer text, signature text)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare b public.call_bookings;
begin
  select * into b from public.call_bookings where id = booking_id and payer_wallet = payer for update;
  if not found or b.state = 'expired' then raise exception 'Booking unavailable'; end if;
  if b.payment_signature is not null then
    if b.payment_signature <> signature then raise exception 'Different payment already confirmed'; end if;
    return to_jsonb(b);
  end if;
  if b.state <> 'awaiting_payment' or signature is null or signature = '' then raise exception 'Booking unavailable'; end if;
  update public.call_bookings set state = 'confirmed', payment_signature = signature where id = booking_id returning * into b;
  return to_jsonb(b);
end $$;

-- The route verifies the provider HMAC before invoking this service-only function.
-- Insertion and duplicate-content verification occur in one transaction.
create function public.record_call_video_event(booking_id uuid, event_id text, event_type text, event_ts double precision, payload jsonb)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare original public.call_video_events;
begin
  perform 1 from public.call_video_rooms r where r.booking_id = record_call_video_event.booking_id
    and r.room_name = payload->>'room';
  if not found or event_id is null or event_id = '' or length(event_id) > 256
    or event_type not in ('participant.joined','participant.left','meeting.started','meeting.ended')
    or event_ts is null or event_type is null or payload is null then raise exception 'Invalid event'; end if;
  insert into public.call_video_events as e(event_id,booking_id,event_type,event_ts,payload)
    values(event_id,booking_id,event_type,event_ts,payload) on conflict on constraint call_video_events_pkey do nothing;
  select * into original from public.call_video_events e where e.event_id = record_call_video_event.event_id;
  if original.booking_id is distinct from booking_id or original.event_type is distinct from event_type
    or original.event_ts is distinct from event_ts or original.payload is distinct from payload then
    raise exception 'Conflicting event ID' using errcode = '23505';
  end if;
end $$;
revoke all on function public.transition_call_booking(uuid,text,text),public.record_call_video_event(uuid,text,text,double precision,jsonb) from public,anon,authenticated;
grant execute on function public.transition_call_booking(uuid,text,text),public.record_call_video_event(uuid,text,text,double precision,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;

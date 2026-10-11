-- Daily credentials and join tokens never belong in browser-readable storage.
create table public.call_video_rooms (
  booking_id uuid primary key references public.call_bookings(id),
  room_name text not null unique default ('vynx-' || replace(gen_random_uuid()::text,'-','')),
  creator_user_id uuid not null default gen_random_uuid(),
  fan_user_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  check (creator_user_id <> fan_user_id)
);
create table public.call_video_events (
  event_id text primary key,
  booking_id uuid not null references public.call_video_rooms(booking_id),
  event_type text not null,
  event_ts double precision not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
create index call_video_events_booking on public.call_video_events(booking_id,event_ts);
alter table public.call_video_rooms enable row level security;
alter table public.call_video_events enable row level security;
revoke all on public.call_video_rooms,public.call_video_events from public,anon,authenticated;
grant select,insert,update,delete on public.call_video_rooms,public.call_video_events to service_role;

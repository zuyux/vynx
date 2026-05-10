-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- 1. Cards users table (wallet-first, no auth.users dependency)
create table if not exists public.cards_users (
  id             uuid primary key default gen_random_uuid(),
  wallet_address text unique not null,
  username       text unique not null,
  display_name   text,
  bio            text,
  avatar_url     text,
  banner_url     text,
  tx_signature   text unique,           -- Solana tx proof of alias payment
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 2. Enforce lowercase, alphanumeric + underscore usernames (3–30 chars)
alter table public.cards_users
  add constraint username_format
  check (username ~ '^[a-z0-9_]{3,30}$');

-- 3. Auto-update updated_at on row changes
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cards_users_set_updated_at
  before update on public.cards_users
  for each row execute procedure public.set_updated_at();

-- 4. Row Level Security
--    All mutations go through the server-side API (service role key bypasses RLS).
--    Client-side (anon key) gets read-only access.
alter table public.cards_users enable row level security;

-- Anyone can read cards
create policy "Cards are publicly readable"
  on public.cards_users for select
  using (true);

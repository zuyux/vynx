begin;
create table public.offer_purchases (
  id uuid primary key,
  creator_id uuid not null references public.cards_users(id),
  creator_wallet text not null,
  creator_alias text not null,
  payer_wallet text not null check (payer_wallet <> creator_wallet),
  offer_key text not null,
  terms jsonb not null,
  price_units bigint not null check (price_units between 10000 and 9999999999),
  state text not null default 'awaiting_payment' check (state in ('awaiting_payment','paid')),
  transaction text,
  last_valid_block_height bigint,
  quoted_slot bigint,
  payment_signature text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  check ((transaction is null) = (last_valid_block_height is null)),
  check ((transaction is null) = (quoted_slot is null)),
  check ((state='paid') = (payment_signature is not null)),
  check ((state='paid') = (paid_at is not null))
);
alter table public.offer_purchases enable row level security;
revoke all on public.offer_purchases from public,anon,authenticated,service_role;
grant select,insert,update,delete on public.offer_purchases to service_role;
create index offer_purchases_payer on public.offer_purchases(payer_wallet,created_at desc);
notify pgrst,'reload schema';
commit;

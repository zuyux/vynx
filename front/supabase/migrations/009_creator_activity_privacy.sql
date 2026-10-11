begin;

alter table public.cards_users
  add column show_payer_addresses boolean not null default false;

comment on column public.cards_users.show_payer_addresses is
  'Owner preference for payer addresses in authenticated creator activity; on-chain transactions remain public.';

commit;

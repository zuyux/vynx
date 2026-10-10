begin;

alter table public.tips
  alter column lamports drop not null,
  add column currency text not null default 'SOL' check (currency in ('SOL', 'USDC')),
  add column token_amount bigint,
  add column token_mint text;

alter table public.tips add constraint tips_currency_amount check (
  (currency = 'SOL' and lamports is not null and token_amount is null and token_mint is null)
  or
  (currency = 'USDC' and lamports is null and token_amount between 10000 and 1000000000 and token_amount is not null and token_mint = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' and token_mint is not null)
);

create or replace function public.creator_tip_summary(owner_wallet text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'lamports', coalesce(sum(t.lamports) filter (where t.currency = 'SOL'), 0)::text,
    'usdc_units', coalesce(sum(t.token_amount) filter (where t.currency = 'USDC'), 0)::text,
    'count', count(t.id)
  )
  from public.cards_users c left join public.tips t on t.creator_id = c.id
  where c.wallet_address = owner_wallet;
$$;

commit;

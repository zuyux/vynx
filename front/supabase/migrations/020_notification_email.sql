begin;

-- Private account preferences are separate from published creator-card design.
-- Wallet sign-in can precede alias creation, so this table does not require a card.
create table public.account_notification_settings (
  wallet text primary key check (char_length(btrim(wallet)) > 0),
  privy_user_id text check (privy_user_id is null or privy_user_id like 'did:privy:%'),
  privy_email text,
  notification_email text,
  updated_at timestamptz not null default now(),
  check (privy_email is null or (char_length(privy_email) between 3 and 254 and privy_email ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$')),
  check (notification_email is null or (char_length(notification_email) between 3 and 254 and notification_email ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$')),
  check (privy_email is null or privy_user_id is not null)
);
alter table public.account_notification_settings enable row level security;
revoke all on public.account_notification_settings from public,anon,authenticated,service_role;
grant select,insert,update,delete on public.account_notification_settings to service_role;

-- The route supplies the signed session wallet. Locking prevents a manual save
-- from racing with a newly verified Privy email and overwriting that preference.
create function public.save_notification_email(owner_wallet text, email text)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare settings public.account_notification_settings;
begin
  if owner_wallet is null or btrim(owner_wallet)='' then raise exception 'Invalid wallet' using errcode='22023'; end if;
  insert into public.account_notification_settings(wallet) values(owner_wallet) on conflict do nothing;
  select * into settings from public.account_notification_settings where wallet=owner_wallet for update;
  if settings.privy_email is not null then raise exception 'Privy email already set' using errcode='22023'; end if;
  update public.account_notification_settings set notification_email=email,updated_at=clock_timestamp()
    where wallet=owner_wallet returning * into settings;
  return jsonb_build_object('privy_email',settings.privy_email,'notification_email',settings.notification_email);
end $$;

-- Called only after server-side Privy token and linked-wallet verification.
-- Keep the fallback address, so unlinking Privy email restores the user's choice.
create function public.sync_privy_notification_email(owner_wallet text, user_id text, verified_email text)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if owner_wallet is null or btrim(owner_wallet)='' or user_id is null or user_id not like 'did:privy:%' then
    raise exception 'Invalid account' using errcode='22023'; end if;
  insert into public.account_notification_settings(wallet,privy_user_id,privy_email)
    values(owner_wallet,user_id,verified_email)
    on conflict(wallet) do update set privy_user_id=excluded.privy_user_id,privy_email=excluded.privy_email,updated_at=clock_timestamp();
end $$;
revoke all on function public.save_notification_email(text,text),public.sync_privy_notification_email(text,text,text) from public,anon,authenticated;
grant execute on function public.save_notification_email(text,text),public.sync_privy_notification_email(text,text,text) to service_role;
notify pgrst,'reload schema';
commit;

begin;

create table public.creator_image_cleanup (
  object_url text primary key check (char_length(object_url) <= 2048),
  wallet text not null check (wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  state text not null default 'pending' check (state in ('pending', 'deleting', 'deleted', 'blocked')),
  attempts integer not null default 0,
  lease_id uuid,
  next_attempt_at timestamptz not null default now(),
  last_error_code text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index creator_image_cleanup_due on public.creator_image_cleanup(next_attempt_at) where state in ('pending', 'deleting');
alter table public.creator_image_cleanup enable row level security;
revoke all on public.creator_image_cleanup from anon, authenticated;
grant all on public.creator_image_cleanup to service_role;

-- Lock reference creation against the worker's reference check. Retain deleted
-- tombstones permanently: UUID objects cannot be resurrected by stale drafts.
create function public.guard_creator_image_references()
returns trigger language plpgsql security invoker set search_path = public as $$
declare value text; urls text[];
begin
  if tg_table_name = 'cards_users' then
    urls := array[new.avatar_url, new.banner_url, new.design->>'avatar', new.design->>'cover'];
  else
    urls := array[new.design->>'avatar', new.design->>'cover'];
  end if;
  for value in select distinct item from unnest(urls) item
    where item like '%/storage/v1/object/public/creator-images/%' order by item
  loop
    perform pg_advisory_xact_lock(hashtextextended(value, 74291007));
    if exists (select 1 from public.creator_image_cleanup where object_url = value and state in ('deleting','deleted')) then
      raise exception 'This image was removed. Choose a new image.' using errcode = '23514';
    end if;
  end loop;
  return new;
end $$;
create trigger cards_users_image_reference_guard before insert or update on public.cards_users
  for each row execute function public.guard_creator_image_references();
create trigger sponsor_profiles_image_reference_guard before insert or update on public.sponsor_profiles
  for each row execute function public.guard_creator_image_references();

-- Queue old references atomically with a committed update or deletion. There
-- is no dependency on the API staying alive after the profile save succeeds.
create function public.queue_replaced_creator_images()
returns trigger language plpgsql security invoker set search_path = public as $$
declare value text; owner_wallet text; old_urls text[]; new_urls text[] := array[]::text[];
begin
  if tg_table_name = 'cards_users' then
    owner_wallet := old.wallet_address;
    old_urls := array[old.avatar_url, old.banner_url, old.design->>'avatar', old.design->>'cover'];
    if tg_op <> 'DELETE' then new_urls := array[new.avatar_url, new.banner_url, new.design->>'avatar', new.design->>'cover']; end if;
  else
    owner_wallet := old.wallet;
    old_urls := array[old.design->>'avatar', old.design->>'cover'];
    if tg_op <> 'DELETE' then new_urls := array[new.design->>'avatar', new.design->>'cover']; end if;
  end if;
  for value in select distinct item from unnest(old_urls) item
    where item like '%/storage/v1/object/public/creator-images/' || owner_wallet || '/%'
      and not exists (select 1 from unnest(new_urls) retained where retained = item)
  loop
    insert into public.creator_image_cleanup(object_url, wallet) values(value, owner_wallet)
      on conflict(object_url) do update set next_attempt_at = now()
      where creator_image_cleanup.state = 'pending';
  end loop;
  return null;
end $$;
create trigger cards_users_image_cleanup after update or delete on public.cards_users
  for each row execute function public.queue_replaced_creator_images();
create trigger sponsor_profiles_image_cleanup after update or delete on public.sponsor_profiles
  for each row execute function public.queue_replaced_creator_images();

-- Claim one job under the same advisory lock used for reference writes. Once
-- deleting, triggers reject new references while Storage deletion is in flight.
create function public.claim_creator_image_cleanup(candidate_url text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare job public.creator_image_cleanup;
begin
  perform pg_advisory_xact_lock(hashtextextended(candidate_url, 74291007));
  select * into job from public.creator_image_cleanup where object_url = candidate_url for update;
  if not found or job.state not in ('pending','deleting') or job.next_attempt_at > now() then return null; end if;
  if exists (select 1 from public.cards_users where avatar_url = candidate_url or banner_url = candidate_url
      or design->>'avatar' = candidate_url or design->>'cover' = candidate_url)
    or exists (select 1 from public.sponsor_profiles where design->>'avatar' = candidate_url or design->>'cover' = candidate_url) then
    update public.creator_image_cleanup set state = 'pending', lease_id = null, next_attempt_at = now() + interval '15 minutes'
      where object_url = candidate_url;
    return null;
  end if;
  update public.creator_image_cleanup set state = 'deleting', attempts = attempts + 1,
    lease_id = gen_random_uuid(), next_attempt_at = now() + interval '5 minutes', last_error_code = null
    where object_url = candidate_url returning * into job;
  return to_jsonb(job);
end $$;
revoke all on function public.claim_creator_image_cleanup(text) from public, anon, authenticated;
grant execute on function public.claim_creator_image_cleanup(text) to service_role;
revoke all on function public.guard_creator_image_references() from public, anon, authenticated;
revoke all on function public.queue_replaced_creator_images() from public, anon, authenticated;
grant execute on function public.guard_creator_image_references() to service_role;
grant execute on function public.queue_replaced_creator_images() to service_role;

notify pgrst, 'reload schema';
commit;

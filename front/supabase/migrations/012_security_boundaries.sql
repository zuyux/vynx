begin;

-- Wallet auth is enforced by the app; Supabase browser roles must not read or
-- mutate any application table, including through inherited PUBLIC privileges.
do $$
declare table_name text; function_id regprocedure;
begin
  foreach table_name in array array[
    'cards_users','sponsor_profiles','sponsor_requests','sponsor_challenges',
    'wallet_nonces','wallet_sessions','tips','alias_availability_limits',
    'alias_registration_intents','creator_image_cleanup','public_endpoint_limits',
    'error_alerts','error_alert_receipts'
  ] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role',table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role',table_name);
  end loop;
  -- Only these application routines are affected; extension routines are left alone.
  for function_id in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'set_updated_at','activate_sponsorship','review_sponsorship','creator_tip_summary',
      'consume_alias_availability_limit','reserve_alias_registration','guard_creator_image_references',
      'queue_replaced_creator_images','claim_creator_image_cleanup','consume_public_endpoint_limit',
      'record_error_alert','claim_error_alerts','finish_error_alert'
    ) loop
    execute format('revoke all on function %s from public, anon, authenticated',function_id);
    execute format('grant execute on function %s to service_role',function_id);
    -- These routines are called only by the role that already owns data access.
    execute format('alter function %s security invoker',function_id);
    execute format('alter function %s set search_path = public, pg_temp',function_id);
  end loop;
end $$;

-- Fail closed for objects created by the migration owner. Schema-specific
-- revokes cannot override global defaults, including PUBLIC function EXECUTE.
-- Other object owners must apply equivalent defaults as part of their deployment.
revoke create on schema public from public, anon, authenticated;
alter default privileges revoke all on tables from public, anon, authenticated, service_role;
alter default privileges revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant execute on functions to service_role;

-- Public image delivery remains supported by the public bucket. Restrictive
-- policies prevent direct listing/mutations even if a permissive policy drifts.
-- Local Postgres fixtures without Supabase Storage can still apply the migration.
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists vynx_creator_images_server_only on storage.objects';
    execute $policy$create policy vynx_creator_images_server_only on storage.objects
      as restrictive for all to anon, authenticated
      using (bucket_id <> 'creator-images') with check (bucket_id <> 'creator-images')$policy$;
  end if;
  if to_regclass('storage.buckets') is not null then
    execute 'drop policy if exists vynx_creator_bucket_server_only on storage.buckets';
    execute $policy$create policy vynx_creator_bucket_server_only on storage.buckets
      as restrictive for all to anon, authenticated
      using (id <> 'creator-images') with check (id <> 'creator-images')$policy$;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;

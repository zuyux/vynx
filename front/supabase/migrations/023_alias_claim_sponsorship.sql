begin;
-- Reserve the full registration cost plus network fees across app instances.
-- Counting older fee-only claims at full price is conservative during cutover.
create or replace function public.reserve_alias_registration(candidate jsonb, daily_budget bigint)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare existing public.alias_registration_intents; spent bigint; attempts integer;
begin
  perform pg_advisory_xact_lock(74291006);
  select * into existing from public.alias_registration_intents where wallet = candidate->>'wallet' and state = 'prepared';
  if found then return jsonb_build_object('accepted', false, 'existing', to_jsonb(existing)); end if;
  select coalesce(sum(reserved_fee + price_lamports),0) into spent from public.alias_registration_intents where created_at > now() - interval '24 hours';
  select count(*) into attempts from public.alias_registration_intents where wallet = candidate->>'wallet' and created_at > now() - interval '1 hour';
  if daily_budget < 1 or spent + (candidate->>'reserved_fee')::bigint + (candidate->>'price_lamports')::bigint > daily_budget or attempts >= 5 then return jsonb_build_object('accepted',false,'limited',true); end if;
  insert into public.alias_registration_intents select * from jsonb_populate_record(null::public.alias_registration_intents, candidate || jsonb_build_object('state','prepared','created_at',now()));
  return jsonb_build_object('accepted',true);
end $$;
notify pgrst, 'reload schema';
commit;

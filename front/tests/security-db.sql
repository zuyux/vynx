do $$
declare t record; f record; role_name text;
begin
  for t in select c.oid, c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' loop
    if not t.relrowsecurity then raise exception 'RLS disabled: %',t.relname; end if;
    foreach role_name in array array['anon','authenticated','untrusted_audit_role'] loop
      if has_table_privilege(role_name,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_any_column_privilege(role_name,t.oid,'SELECT,INSERT,UPDATE,REFERENCES') then
        raise exception 'Browser privilege: % %',role_name,t.relname;
      end if;
    end loop;
    if not has_table_privilege('service_role',t.oid,'SELECT,INSERT,UPDATE,DELETE')
      or has_table_privilege('service_role',t.oid,'TRUNCATE,TRIGGER,REFERENCES') then raise exception 'Service-role privilege mismatch'; end if;
  end loop;
  for f in select p.oid,p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' loop
    if f.prosecdef then raise exception 'Unnecessary security definer: %',f.proname; end if;
    if ('search_path=public, pg_temp' = any(f.proconfig)) is distinct from true then raise exception 'Unpinned search path: %',f.proname; end if;
    if has_function_privilege('anon',f.oid,'EXECUTE') or has_function_privilege('authenticated',f.oid,'EXECUTE')
      or has_function_privilege('untrusted_audit_role',f.oid,'EXECUTE') then raise exception 'Public RPC: %',f.proname; end if;
    if not has_function_privilege('service_role',f.oid,'EXECUTE') then raise exception 'Service RPC unavailable'; end if;
  end loop;
  if has_schema_privilege('anon','public','CREATE') or has_schema_privilege('authenticated','public','CREATE')
    or has_schema_privilege('untrusted_audit_role','public','CREATE') then raise exception 'Untrusted schema CREATE'; end if;
end $$;

set role service_role;
insert into public.cards_users(wallet_address,username) values ('audit-wallet','auditowner');
update public.cards_users set bio='updated' where username='auditowner';
select public.creator_tip_summary('audit-wallet');
select public.consume_public_endpoint_limit(repeat('a',64),'payment');
-- Call offers are durable, unique per creator and constrained in the DB too.
insert into public.call_offers(creator_wallet,title,description,duration_minutes,price_units,timezone,availability,accepting)
 values ('audit-wallet','Design mentoring','Review a creative portfolio',30,12000001,'America/Lima','[{"weekday":1,"start":"09:00","end":"12:00"}]',true);
do $$
begin
  begin
    update public.call_offers set availability='[{"weekday":1,"start":"09:00","end":"12:00"},{"weekday":1,"start":"10:00","end":"13:00"}]';
    raise exception 'Overlapping availability accepted';
  exception when check_violation then null; end;
  begin
    update public.call_offers set timezone='Mars/Olympus';
    raise exception 'Invalid timezone accepted';
  exception when check_violation then null; end;
  begin
    update public.call_offers set price_units=0;
    raise exception 'Zero call price accepted';
  exception when check_violation then null; end;
  begin
    insert into public.call_offers(creator_wallet,title,description,duration_minutes,price_units,timezone)
     values ('audit-wallet','Duplicate service','Another creative portfolio',30,1000000,'UTC');
    raise exception 'Multiple offers per creator accepted';
  exception when unique_violation then null; end;
end $$;
select public.record_error_alert(jsonb_build_object('kind','api_5xx','route','/api/call-offer','method','PUT','status',503,'request_id',gen_random_uuid()::text));
reset role;

-- Supabase public image delivery bypasses RLS. Metadata listing and writes do not.
set role anon;
do $$
declare n integer;
begin
  select count(*) into n from storage.objects where bucket_id='creator-images';
  if n <> 0 then raise exception 'Creator image listing exposed'; end if;
  select count(*) into n from storage.buckets where id='creator-images';
  if n <> 0 then raise exception 'Creator bucket metadata exposed'; end if;
  select count(*) into n from storage.objects where bucket_id='other-bucket';
  if n <> 1 then raise exception 'Unrelated storage policy changed'; end if;
  begin
    insert into storage.objects(bucket_id,name) values ('creator-images','unauthorized');
    raise exception 'Public upload accepted';
  exception when insufficient_privilege then null; end;
  update storage.objects set name='unauthorized' where bucket_id='creator-images';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Public update accepted'; end if;
  delete from storage.objects where bucket_id='creator-images';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Public delete accepted'; end if;
end $$;
reset role;

-- New objects remain inaccessible even before their author adds RLS/revokes.
create table public.future_audit_table(id integer);
create function public.future_audit_function() returns integer language sql as $$select 1$$;
do $$
begin
  if has_table_privilege('anon','public.future_audit_table','SELECT,INSERT,UPDATE,DELETE')
    or has_function_privilege('anon','public.future_audit_function()','EXECUTE')
    or has_function_privilege('authenticated','public.future_audit_function()','EXECUTE') then raise exception 'Unsafe future defaults'; end if;
  if has_table_privilege('service_role','public.future_audit_table','TRUNCATE,TRIGGER,REFERENCES') then raise exception 'Overbroad future service grant'; end if;
end $$;

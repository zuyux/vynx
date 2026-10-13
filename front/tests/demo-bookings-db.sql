do $$ begin
  if has_table_privilege('anon','public.demo_call_bookings','SELECT')
    or has_table_privilege('authenticated','public.demo_call_bookings','INSERT')
    or has_function_privilege('anon','public.reserve_demo_call(text,uuid,timestamptz,text,text)','EXECUTE') then
    raise exception 'Demo bookings exposed to untrusted roles';
  end if;
end $$;
set role service_role;
do $$
declare slot timestamptz := (date_trunc('day',now() at time zone 'America/Argentina/Buenos_Aires') + interval '1 day 15 hours') at time zone 'America/Argentina/Buenos_Aires'; b jsonb; again jsonb; key uuid := gen_random_uuid();
begin
  b := public.reserve_demo_call('demo-fan',key,slot,'vynx-demo-booking-v1','America/Lima');
  again := public.reserve_demo_call('demo-fan',key,slot,'vynx-demo-booking-v1','America/Lima');
  if b <> again then raise exception 'Retry changed snapshot'; end if;
  begin perform public.reserve_demo_call('demo-fan',gen_random_uuid(),slot,'vynx-demo-booking-v1','America/Lima'); raise exception 'Duplicate accepted'; exception when unique_violation or exclusion_violation then null; end;
  if b->'terms'->>'timezone' <> 'America/Argentina/Buenos_Aires' or b->'terms'->>'viewer_timezone' <> 'America/Lima'
    or b->'terms'->>'policy' <> 'vynx-demo-booking-v1' or (b->>'starts_at')::timestamptz <> slot then raise exception 'Snapshot missing'; end if;
  begin perform public.reserve_demo_call('demo-fan',key,slot + interval '1 hour','vynx-demo-booking-v1','America/Lima'); raise exception 'Key reused'; exception when invalid_parameter_value then null; end;
  begin perform public.reserve_demo_call('other-fan',gen_random_uuid(),slot + interval '15 minutes','vynx-demo-booking-v1','UTC'); raise exception 'Overlap accepted'; exception when exclusion_violation then null; end;
  perform public.reserve_demo_call('other-fan',gen_random_uuid(),slot + interval '30 minutes','vynx-demo-booking-v1','UTC');
  begin perform public.reserve_demo_call('other-fan',gen_random_uuid(),slot + interval '1 minute','vynx-demo-booking-v1','UTC'); raise exception 'Off-grid accepted'; exception when invalid_parameter_value then null; end;
end $$;
reset role;

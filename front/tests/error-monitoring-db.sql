do $$
declare
  e jsonb := '{"kind":"api_5xx","route":"/api/tips","method":"POST","status":503,"request_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}';
  job public.error_alerts;
  n integer;
begin
  perform public.record_error_alert(e);
  perform public.record_error_alert(e);
  if (select sum(occurrences) from public.error_alerts) <> 1 then raise exception 'Duplicate receipt counted'; end if;
  perform public.record_error_alert(jsonb_set(e,'{request_id}','"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"'));
  if (select sum(occurrences) from public.error_alerts) <> 2 then raise exception 'Occurrence aggregation failed'; end if;
  select * into job from public.claim_error_alerts();
  if job.lease_id is null or job.attempts <> 1 then raise exception 'Missing delivery lease'; end if;
  select count(*) into n from public.claim_error_alerts();
  if n <> 0 then raise exception 'Leased alert claimed twice'; end if;
  perform public.finish_error_alert(job.id,gen_random_uuid(),true);
  if (select delivered_at from public.error_alerts where id=job.id) is not null then raise exception 'Foreign lease acknowledged'; end if;
  perform public.finish_error_alert(job.id,job.lease_id,false);
  if (select next_attempt_at from public.error_alerts where id=job.id) <= clock_timestamp() then raise exception 'Retry not delayed'; end if;
  update public.error_alerts set next_attempt_at=clock_timestamp()-interval '1 second';
  select * into job from public.claim_error_alerts();
  perform public.finish_error_alert(job.id,job.lease_id,true);
  if (select delivered_at from public.error_alerts where id=job.id) is null then raise exception 'Delivery not acknowledged'; end if;
  if has_function_privilege('anon','public.record_error_alert(jsonb)','execute')
    or has_function_privilege('authenticated','public.claim_error_alerts()','execute')
    or has_table_privilege('authenticated','public.error_alerts','select') then raise exception 'Public monitoring access'; end if;
  begin
    perform public.record_error_alert(e || '{"secret":"PRIVATE"}');
    raise exception 'Secret field accepted';
  exception when others then if sqlerrm='Secret field accepted' then raise; end if; end;
  update public.error_alerts set delivered_at=null, attempts=10, lease_until=null, next_attempt_at=clock_timestamp()-interval '1 second';
  select count(*) into n from public.claim_error_alerts();
  if n <> 0 then raise exception 'Retry cap ignored'; end if;
end;
$$;

begin;

-- End hours are optional for legacy schedules. When supplied, the actual
-- duration-based weekly session must fit completely inside its available hours.
create function public.valid_offer_availability(terms jsonb)
returns boolean language plpgsql immutable security invoker set search_path=public,pg_temp as $$
declare entry jsonb; duration int; start_minute int; end_minute int;
begin
  if jsonb_typeof(terms->'schedule') is distinct from 'array' then return true; end if;
  for entry in select value from jsonb_array_elements(terms->'schedule') loop
    if entry ? 'endTime' then
      if jsonb_typeof(entry->'endTime') is distinct from 'string'
        or entry->>'endTime' !~ '^(?:[01]\d|2[0-3]):[0-5]\d$'
        or jsonb_typeof(entry->'time') is distinct from 'string'
        or entry->>'time' !~ '^(?:[01]\d|2[0-3]):[0-5]\d$'
        or coalesce(terms->>'durationMinutes','30') not in ('30','60','90','120','180') then return false; end if;
      duration:=coalesce(terms->>'durationMinutes','30')::int;
      start_minute:=substring(entry->>'time',1,2)::int*60+substring(entry->>'time',4,2)::int;
      end_minute:=substring(entry->>'endTime',1,2)::int*60+substring(entry->>'endTime',4,2)::int;
      if end_minute<start_minute+duration then return false; end if;
    end if;
  end loop;
  return true;
end $$;
revoke all on function public.valid_offer_availability(jsonb) from public,anon,authenticated;
grant execute on function public.valid_offer_availability(jsonb) to service_role;
alter table public.monthly_subscriptions add constraint monthly_availability_end_check check(public.valid_offer_availability(terms));
alter table public.offer_purchases add constraint purchase_availability_end_check check(public.valid_offer_availability(terms));
notify pgrst,'reload schema';
commit;

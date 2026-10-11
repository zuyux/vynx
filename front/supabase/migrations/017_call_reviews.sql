begin;

create table public.call_reviews (
  booking_id uuid primary key references public.call_bookings(id),
  overall_rating smallint not null check (overall_rating between 1 and 5),
  punctuality smallint not null check (punctuality between 1 and 5),
  communication smallint not null check (communication between 1 and 5),
  fulfillment smallint not null check (fulfillment between 1 and 5),
  comment text not null check (char_length(btrim(comment)) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.call_reviews enable row level security;
revoke all on public.call_reviews from public,anon,authenticated,service_role;
grant select,insert on public.call_reviews to service_role;

-- The authenticated wallet is supplied by the server, never by the browser.
-- Serialize with booking transitions and concurrent review submissions.
create function public.submit_call_review(booking uuid, actor text, overall integer, punctuality_score integer,
  communication_score integer, fulfillment_score integer, review_comment text)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare b public.call_bookings; existing public.call_reviews; submitted public.call_reviews;
begin
  select * into b from public.call_bookings where id=booking for update;
  if not found or actor is distinct from b.payer_wallet then
    raise exception 'Booking not found' using errcode='P0002';
  end if;
  if overall is null or overall not between 1 and 5 or punctuality_score is null or punctuality_score not between 1 and 5
    or communication_score is null or communication_score not between 1 and 5 or fulfillment_score is null or fulfillment_score not between 1 and 5
    or review_comment is null or char_length(btrim(review_comment)) not between 1 and 2000 then
    raise exception 'Invalid review' using errcode='22023';
  end if;
  select * into existing from public.call_reviews where booking_id=booking;
  if found then
    if existing.overall_rating=overall and existing.punctuality=punctuality_score and existing.communication=communication_score
      and existing.fulfillment=fulfillment_score and existing.comment=btrim(review_comment) then return to_jsonb(existing); end if;
    raise exception 'A review already exists' using errcode='23505';
  end if;
  if b.state <> 'completed' or b.payment_signature is null or now() < b.ends_at then
    raise exception 'Review requires a paid completed booking';
  end if;
  insert into public.call_reviews(booking_id,overall_rating,punctuality,communication,fulfillment,comment)
    values(booking,overall,punctuality_score,communication_score,fulfillment_score,btrim(review_comment)) returning * into submitted;
  return to_jsonb(submitted);
end $$;

-- Aggregation is performed in PostgreSQL so PostgREST row limits never truncate
-- the count/average. Only a bounded, identity-free comment page leaves the server.
create function public.creator_review_summary(creator text, page_offset integer default 0)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare total bigint; average numeric; comments jsonb;
begin
  if page_offset is null or page_offset < 0 then raise exception 'Invalid page'; end if;
  select count(*),round(avg(r.overall_rating),2) into total,average
    from public.call_reviews r join public.call_bookings b on b.id=r.booking_id where b.creator_wallet=creator;
  select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc,p.review_id),'[]'::jsonb) into comments from (
    select r.booking_id as review_id,r.overall_rating,r.punctuality,r.communication,r.fulfillment,r.comment,r.created_at
    from public.call_reviews r join public.call_bookings b on b.id=r.booking_id where b.creator_wallet=creator
    order by r.created_at desc,r.booking_id offset page_offset limit 20
  ) p;
  -- Strip the private booking identifier; use the position/date for display keys.
  select coalesce(jsonb_agg(value - 'review_id'),'[]'::jsonb) into comments from jsonb_array_elements(comments);
  return jsonb_build_object('review_count',total,'average_rating',average,'comments',comments,'has_more',page_offset+20<total);
end $$;

-- Internal, keyset-paged evidence for the shared TypeScript attendance verifier.
-- A full page of 1000 events is conservatively marked incomplete by the server.
create function public.creator_call_evidence(creator text, after_id uuid default null)
returns table(id uuid,starts_at timestamptz,ends_at timestamptz,room jsonb,events jsonb)
language sql security invoker set search_path = public, pg_temp as $$
  select b.id,b.starts_at,b.ends_at,
    case when r.booking_id is null then null else to_jsonb(r) end,
    coalesce((select jsonb_agg(to_jsonb(e) order by e.event_ts,e.event_id) from (
      select v.event_id,v.event_type,v.event_ts,v.payload from public.call_video_events v
      where v.booking_id=b.id order by v.event_ts,v.event_id limit 1000
    ) e),'[]'::jsonb)
  from public.call_bookings b left join public.call_video_rooms r on r.booking_id=b.id
  where b.creator_wallet=creator and b.payment_signature is not null and b.ends_at<=now()
    and b.state in ('confirmed','completed','no_show','disputed') and (after_id is null or b.id>after_id)
  order by b.id limit 50
$$;
create index call_bookings_creator_history on public.call_bookings(creator_wallet,id) where payment_signature is not null;

revoke all on function public.submit_call_review(uuid,text,integer,integer,integer,integer,text),
  public.creator_review_summary(text,integer),public.creator_call_evidence(text,uuid) from public,anon,authenticated;
grant execute on function public.submit_call_review(uuid,text,integer,integer,integer,integer,text),
  public.creator_review_summary(text,integer),public.creator_call_evidence(text,uuid) to service_role;
notify pgrst,'reload schema';
commit;

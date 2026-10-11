set role service_role;
do $$
declare b public.call_bookings; r jsonb; summary jsonb; n integer; score integer; state_name text; new_id uuid;
begin
  select * into b from public.call_bookings where payer_wallet='fan-one' limit 1;
  if (public.creator_review_summary(b.creator_wallet)->>'review_count')::int <> 0 then raise exception 'False review history'; end if;
  if public.creator_review_summary(b.creator_wallet)->'average_rating' <> 'null'::jsonb then raise exception 'Unrated creator has a rating'; end if;
  update public.call_bookings set state='completed',starts_at=now()-interval '26 hours',ends_at=now()-interval '25 hours' where id=b.id;
  begin perform public.submit_call_review(b.id,b.creator_wallet,5,5,5,5,'Creator review'); raise exception 'Creator accepted';
    exception when no_data_found then null; end;
  begin perform public.submit_call_review(b.id,'outsider',5,5,5,5,'Outsider review'); raise exception 'Outsider accepted';
    exception when no_data_found then null; end;
  foreach state_name in array array['confirmed','cancelled','no_show','disputed'] loop
    update public.call_bookings set state=state_name where id=b.id;
    begin perform public.submit_call_review(b.id,b.payer_wallet,5,5,5,5,'Premature review'); raise exception 'Uncompleted booking accepted';
      exception when raise_exception then if sqlerrm <> 'Review requires a paid completed booking' then raise; end if; end;
  end loop;
  update public.call_bookings set state='awaiting_payment',payment_signature=null where id=b.id;
  begin perform public.submit_call_review(b.id,b.payer_wallet,5,5,5,5,'Unpaid review'); raise exception 'Unpaid booking accepted';
    exception when raise_exception then if sqlerrm <> 'Review requires a paid completed booking' then raise; end if; end;
  update public.call_bookings set state='completed',payment_signature=b.payment_signature where id=b.id;
  update public.call_bookings set starts_at=now()-interval '1 hour',ends_at=now()+interval '1 hour' where id=b.id;
  begin perform public.submit_call_review(b.id,b.payer_wallet,5,5,5,5,'Future completion'); raise exception 'Early review accepted';
    exception when raise_exception then if sqlerrm <> 'Review requires a paid completed booking' then raise; end if; end;
  update public.call_bookings set starts_at=now()-interval '26 hours',ends_at=now()-interval '25 hours' where id=b.id;
  foreach score in array array[0,6,null] loop
    begin perform public.submit_call_review(b.id,b.payer_wallet,score,5,5,5,'Invalid rating'); raise exception 'Invalid score accepted';
      exception when invalid_parameter_value then null; end;
  end loop;
  begin perform public.submit_call_review(b.id,b.payer_wallet,5,5,5,5,'   '); raise exception 'Empty comment accepted';
    exception when invalid_parameter_value then null; end;
  begin perform public.submit_call_review(b.id,b.payer_wallet,5,5,5,5,repeat('x',2001)); raise exception 'Long comment accepted';
    exception when invalid_parameter_value then null; end;
  r:=public.submit_call_review(b.id,b.payer_wallet,1,2,3,1,'  Honest negative feedback  ');
  perform public.submit_call_review(b.id,b.payer_wallet,1,2,3,1,'Honest negative feedback');
  select count(*) into n from public.call_reviews where booking_id=b.id;
  if n<>1 or r->>'comment'<>'Honest negative feedback' then raise exception 'Review retry failed'; end if;
  begin perform public.submit_call_review(b.id,b.payer_wallet,5,5,5,5,'Replacement'); raise exception 'Review overwritten';
    exception when unique_violation then null; end;
  -- A later dispute does not erase submitted feedback.
  update public.call_bookings set state='disputed' where id=b.id;
  perform public.submit_call_review(b.id,b.payer_wallet,1,2,3,1,'Honest negative feedback');
  for n in 1..52 loop
    new_id:=gen_random_uuid();
    insert into public.call_bookings(id,offer_id,creator_wallet,payer_wallet,starts_at,ends_at,expires_at,terms,price_units,state,payment_signature)
      values(new_id,b.offer_id,b.creator_wallet,case when n=52 then 'race-review-fan' else 'review-fan-'||n end,
        now()-make_interval(days=>n+100),now()-make_interval(days=>n+100)+interval '30 minutes',now(),b.terms,b.price_units,'completed','review-payment-'||n);
    if n<=21 then perform public.submit_call_review(new_id,'review-fan-'||n,5,5,5,5,'Public comment '||n); end if;
  end loop;
  summary:=public.creator_review_summary(b.creator_wallet);
  if (summary->>'review_count')::int<>22 or (summary->>'average_rating')::numeric<>4.82
    or jsonb_array_length(summary->'comments')<>20 or (summary->>'has_more')::boolean is not true then raise exception 'Incorrect summary'; end if;
  if jsonb_array_length(public.creator_review_summary(b.creator_wallet,20)->'comments')<>2 then raise exception 'Incorrect comment page'; end if;
  if summary::text like '%payer_wallet%' or summary::text like '%booking_id%' or summary::text like '%review_id%' or summary::text like '%payment_signature%' then raise exception 'Private review data leaked'; end if;
  select count(*) into n from public.creator_call_evidence(b.creator_wallet);
  if n<>50 then raise exception 'Evidence page limit failed'; end if;
  select count(*) into n from public.creator_call_evidence(b.creator_wallet,(select id from public.creator_call_evidence(b.creator_wallet) order by id desc limit 1));
  if n<>3 then raise exception 'Evidence keyset paging failed'; end if;
end $$;
reset role;
do $$ begin
  if has_table_privilege('anon','public.call_reviews','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated','public.call_reviews','SELECT,INSERT,UPDATE,DELETE')
    or has_function_privilege('anon','public.submit_call_review(uuid,text,integer,integer,integer,integer,text)','EXECUTE')
    or has_function_privilege('authenticated','public.creator_review_summary(text,integer)','EXECUTE')
    or has_function_privilege('anon','public.creator_call_evidence(text,uuid)','EXECUTE') then raise exception 'Review browser access'; end if;
end $$;

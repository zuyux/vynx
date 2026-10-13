set role service_role;
insert into public.cards_users(wallet_address,username,published,design) values('monthly-creator','monthlycoach',true,
  jsonb_build_object('offers',jsonb_build_array(jsonb_build_object('id','weekly-coaching','type','bookings','title','Weekly coaching',
    'description','Coaching every weekday','price','40','url','','billingPeriod','month','durationMinutes',30,'timezone','America/Lima',
    'schedule',(select jsonb_agg(jsonb_build_object('id','day-'||day,'weekday',day,'time','09:00','endTime','09:45')) from generate_series(0,6) day)))));
do $$ declare first jsonb; again jsonb; invoice uuid; subscription uuid; session_count int; renewed jsonb;
begin
  if public.valid_offer_availability('{"durationMinutes":60,"schedule":[{"time":"09:00","endTime":"09:59"}]}')
    or public.valid_offer_availability('{"durationMinutes":30,"schedule":[{"time":"09:00","endTime":"08:00"}]}')
    or public.valid_offer_availability('{"durationMinutes":30,"schedule":[{"time":"09:00","endTime":null}]}')
    or not public.valid_offer_availability('{"durationMinutes":60,"schedule":[{"time":"09:00","endTime":"10:00"}]}')
    or not public.valid_offer_availability('{"durationMinutes":60,"schedule":[{"time":"09:00"}]}') then raise exception 'Invalid end-hour validation'; end if;
  if public.monthly_period_end('2027-01-31 12:00Z','2027-01-31 12:00Z')<>'2027-02-28 12:00Z'::timestamptz
    or public.monthly_period_end('2027-01-31 12:00Z','2027-02-28 12:00Z')<>'2027-03-31 12:00Z'::timestamptz
    or public.monthly_period_end('2028-01-31 12:00Z','2028-01-31 12:00Z')<>'2028-02-29 12:00Z'::timestamptz then raise exception 'Calendar month drift'; end if;
  first:=public.reserve_monthly_offer('monthly-fan','monthlycoach','weekly-coaching');
  again:=public.reserve_monthly_offer('monthly-fan','monthlycoach','weekly-coaching');
  if first<>again then raise exception 'Enrollment retry duplicated invoice'; end if;
  invoice:=(first->'invoice'->>'id')::uuid; subscription:=(first->'subscription'->>'id')::uuid;
  begin
    update public.monthly_subscriptions set terms=jsonb_set(terms,'{schedule,0,endTime}','"09:15"') where id=subscription;
    raise exception 'Session outside available hours accepted';
  exception when check_violation then null; end;
  select count(*) into session_count from public.call_bookings where monthly_invoice_id=invoice;
  if session_count not between 27 and 31 then raise exception 'Full month not scheduled: %',session_count; end if;
  if exists(select 1 from public.call_bookings where monthly_invoice_id=invoice and
    ((starts_at at time zone 'America/Lima')::time<>time '09:00' or ends_at-starts_at<>interval '30 minutes' or state<>'awaiting_payment')) then raise exception 'Weekly sessions wrong'; end if;
  begin
    perform public.reserve_monthly_offer('monthly-other-fan','monthlycoach','weekly-coaching');
    raise exception 'Double booking accepted';
  exception when exclusion_violation then null; end;
  if exists(select 1 from public.monthly_subscriptions where payer_wallet='monthly-other-fan') then raise exception 'Failed month left partial reservation'; end if;
  begin
    update public.call_bookings set state='confirmed' where monthly_invoice_id=invoice;
    raise exception 'Unpaid sessions activated';
  exception when raise_exception then if sqlerrm='Unpaid sessions activated' then raise; end if; end;
  begin
    perform public.prepare_monthly_payment(invoice,'attacker','forged',100,10);
    raise exception 'Foreign invoice prepared';
  exception when no_data_found then null; end;
  perform public.prepare_monthly_payment(invoice,'monthly-fan','original-monthly-transaction',100,10);
  again:=public.prepare_monthly_payment(invoice,'monthly-fan','replacement-transaction',200,20);
  if again->>'transaction'<>'original-monthly-transaction' then raise exception 'Prepared quote replaced'; end if;
  update public.monthly_invoices set expires_at=now()-interval '1 day' where id=invoice;
  perform public.expire_unprepared_monthly_invoices();
  if (select state from public.monthly_invoices where id=invoice)<>'awaiting_payment' then raise exception 'Prepared quote lost recovery'; end if;
  perform public.confirm_monthly_payment(invoice,'monthly-fan','monthly-signature-one');
  again:=public.confirm_monthly_payment(invoice,'monthly-fan','monthly-signature-one');
  if again->>'state'<>'paid' or (select count(*) from public.call_bookings where monthly_invoice_id=invoice and state='confirmed')<>session_count then raise exception 'Paid month not activated atomically'; end if;
  if (select paid_until from public.monthly_subscriptions where id=subscription)<>(first->'invoice'->>'period_end')::timestamptz then raise exception 'Renewal date wrong'; end if;
  begin
    perform public.confirm_monthly_payment(invoice,'monthly-fan','conflicting-signature');
    raise exception 'Payment replaced';
  exception when unique_violation then null; end;
  begin
    perform public.reserve_monthly_offer('monthly-fan',subscription=>subscription);
    raise exception 'Month charged early';
  exception when invalid_parameter_value then null; end;
  -- Simulate the completed month before exercising an overdue renewal.
  update public.call_bookings set starts_at=starts_at-interval '2 months',ends_at=ends_at-interval '2 months' where monthly_invoice_id=invoice;
  update public.monthly_invoices set period_start=period_start-interval '2 months',period_end=period_end-interval '2 months' where id=invoice;
  update public.monthly_subscriptions set paid_until=now()-interval '1 day' where id=subscription;
  renewed:=public.reserve_monthly_offer('monthly-fan',subscription=>subscription);
  if renewed->'invoice'->>'id'=invoice::text or (renewed->'invoice'->>'period_start')::timestamptz<now()-interval '1 minute' then raise exception 'Overdue renewal charges an elapsed period'; end if;
  perform public.prepare_monthly_payment((renewed->'invoice'->>'id')::uuid,'monthly-fan','next-monthly-transaction',200,20);
  begin
    perform public.confirm_monthly_payment((renewed->'invoice'->>'id')::uuid,'monthly-fan','monthly-signature-one');
    raise exception 'Signature reused across months';
  exception when unique_violation then null; end;
  perform public.confirm_monthly_payment((renewed->'invoice'->>'id')::uuid,'monthly-fan','monthly-signature-two');
  perform public.stop_monthly_subscription(subscription,'monthly-fan');
  if not exists(select 1 from public.call_bookings where monthly_invoice_id=(renewed->'invoice'->>'id')::uuid and state='confirmed') then raise exception 'Stopping removed paid sessions'; end if;
  begin
    perform public.reserve_monthly_offer('monthly-fan',subscription=>subscription);
    raise exception 'Stopped plan renewed';
  exception when invalid_parameter_value then null; end;
  -- Monthly sessions use the existing private-call and feedback records.
  perform public.transition_monthly_session((select id from public.call_bookings where monthly_invoice_id=invoice limit 1),'monthly-fan','completed');
  perform public.submit_call_review((select id from public.call_bookings where monthly_invoice_id=invoice and state='completed' limit 1),'monthly-fan',5,5,5,5,'Helpful monthly coaching');
end $$;
-- Unprepared reservations may expire; prepared operations require chain recovery.
update public.cards_users set design=jsonb_build_object('offers',jsonb_build_array(jsonb_build_object('id','membership','type','subscriptions','title','Community','price','10','billingPeriod','month'))) where username='monthlycoach';
do $$ declare first jsonb; next jsonb; invoice uuid;
begin
  first:=public.reserve_monthly_offer('membership-fan','monthlycoach','membership');
  invoice:=(first->'invoice'->>'id')::uuid;
  update public.monthly_invoices set expires_at=now()-interval '1 minute' where id=invoice;
  next:=public.reserve_monthly_offer('membership-fan','monthlycoach','membership');
  if next->'invoice'->>'id'=invoice::text or (select state from public.monthly_invoices where id=invoice)<>'void' then raise exception 'Unprepared expiry not released'; end if;
  invoice:=(next->'invoice'->>'id')::uuid;
  perform public.prepare_monthly_payment(invoice,'membership-fan','reset-test',100,10);
  begin
    perform public.void_monthly_invoice(invoice,'membership-fan',100);
    raise exception 'Live quote reset';
  exception when invalid_parameter_value then null; end;
  perform public.void_monthly_invoice(invoice,'membership-fan',101);
  if (select state from public.monthly_invoices where id=invoice)<>'void' then raise exception 'Finalized quote not reset'; end if;
end $$;
reset role;

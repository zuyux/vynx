set role service_role;
do $$
declare b uuid; r text; first_id uuid;
begin
  select id into b from public.call_bookings where state='confirmed' limit 1;
  insert into public.call_video_rooms(booking_id) values(b);
  select room_name,fan_user_id into r,first_id from public.call_video_rooms where booking_id=b;
  insert into public.call_video_rooms(booking_id) values(b) on conflict(booking_id) do nothing;
  if (select fan_user_id from public.call_video_rooms where booking_id=b) <> first_id then raise exception 'Identity changed on retry'; end if;
  insert into public.call_video_events(event_id,booking_id,event_type,event_ts,payload) values('delivery-one',b,'participant.joined',1,jsonb_build_object('room',r));
  begin insert into public.call_video_events(event_id,booking_id,event_type,event_ts,payload) values('delivery-one',b,'participant.joined',1,'{}');raise exception 'Duplicate accepted';exception when unique_violation then null;end;
end $$;
reset role;

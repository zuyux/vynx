set role service_role;
do $$ declare result jsonb;
begin
  result:=public.save_notification_email('email-wallet-one','fallback@example.com');
  if result->>'notification_email'<>'fallback@example.com' then raise exception 'Email not saved'; end if;
  perform public.save_notification_email('email-wallet-two','other@example.com');
  perform public.sync_privy_notification_email('email-wallet-one','did:privy:account-one','privy@example.com');
  if (select notification_email from public.account_notification_settings where wallet='email-wallet-one')<>'fallback@example.com' then raise exception 'Privy sync destroyed the manual fallback'; end if;
  if (select notification_email from public.account_notification_settings where wallet='email-wallet-two')<>'other@example.com' then raise exception 'Another account changed'; end if;
  begin
    perform public.save_notification_email('email-wallet-one','overwrite@example.com');
    raise exception 'Privy email was overridden';
  exception when invalid_parameter_value then null; end;
  perform public.sync_privy_notification_email('email-wallet-one','did:privy:account-one',null);
  result:=public.save_notification_email('email-wallet-one','updated@example.com');
  if result->>'privy_email' is not null or result->>'notification_email'<>'updated@example.com' then raise exception 'Manual email unavailable after unlinking'; end if;
  result:=public.save_notification_email('email-wallet-one',null);
  if result->>'notification_email' is not null then raise exception 'Email not removed'; end if;
  begin
    perform public.save_notification_email('email-wallet-one','invalid');
    raise exception 'Invalid address stored';
  exception when check_violation then null; end;
  begin
    perform public.sync_privy_notification_email('email-wallet-one','not-a-privy-id','privy@example.com');
    raise exception 'Invalid identity stored';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;

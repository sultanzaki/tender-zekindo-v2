-- Run once after setting the two Vault secrets described in README.
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$
begin
  if (select count(*) from vault.decrypted_secrets where name in ('tender_app_url','tender_cron_secret')) <> 2 then
    raise exception 'Configure tender_app_url and tender_cron_secret in Vault first';
  end if;
end $$;
select cron.schedule('tender-meeting-reminders','* * * * *',$job$
  select net.http_get(
    url := rtrim((select decrypted_secret from vault.decrypted_secrets where name='tender_app_url'),'/') || '/api/cron/meeting-reminders',
    headers := jsonb_build_object('Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='tender_cron_secret')),
    timeout_milliseconds := 60000
  );
$job$);

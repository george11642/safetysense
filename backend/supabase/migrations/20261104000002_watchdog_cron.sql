-- Every minute, pg_cron calls the api function's watchdog through pg_net.
-- The cron secret is read from Vault at run time, so it never appears in cron.job.
select cron.schedule(
  'safetysense-watchdog',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://uvunyysuyuonhoviszmc.supabase.co/functions/v1/api/cron/watchdog',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'safetysense_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- Privacy: location history is kept for 30 days, then deleted.
select cron.schedule(
  'safetysense-retention',
  '17 9 * * *',
  $$ delete from public.locations where created_at < now() - interval '30 days'; $$
);

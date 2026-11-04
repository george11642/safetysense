-- SafetySense privacy hardening (2026-11-04):
--   * account deletion (devices.delete_requested_at for deletions deferred until a live alert ends)
--   * SMS delivery receipts on notification events (provider_sid, delivery_status, error_code)
--   * register rate limit (register_hits holds only a salted hash of the caller's IP, kept 1 day)
--   * retention: the daily SQL-only location job is replaced by an hourly call to api/cron/retention,
--     which also deletes evidence objects in Storage (SQL cannot delete Storage objects).

alter table public.devices add column if not exists delete_requested_at timestamptz;

alter table public.events add column if not exists provider_sid    text;   -- Twilio MessageSid / CallSid
alter table public.events add column if not exists delivery_status text;   -- queued | sent | delivered | undelivered | failed
alter table public.events add column if not exists error_code      text;   -- e.g. 30034 (unregistered A2P 10DLC)
create index if not exists events_provider_sid_idx on public.events(provider_sid) where provider_sid is not null;
create index if not exists events_created_idx on public.events(created_at);
create index if not exists evidence_created_idx on public.evidence(created_at);
create index if not exists alerts_created_idx on public.alerts(created_at);

create table if not exists public.register_hits (
  id      bigint generated always as identity primary key,
  ip_hash text not null,
  at      timestamptz not null default now()
);
create index if not exists register_hits_ip_idx on public.register_hits(ip_hash, at);
create index if not exists register_hits_at_idx on public.register_hits(at);
alter table public.register_hits enable row level security;
revoke all on public.register_hits from anon, authenticated;

insert into public.app_flags(key, value) values
  ('register_per_ip_hour', '5'::jsonb),
  ('register_per_ip_day', '20'::jsonb),
  ('register_global_hour', '200'::jsonb)
on conflict (key) do nothing;

-- Storage object names in the private "evidence" bucket, for the edge function's deletes.
-- p_prefix: only names starting with it ('' = all). p_orphans_only: only objects no evidence row points at
-- (older than p_min_age_s, or at any age when the device folder no longer exists).
create or replace function public.ss_evidence_objects(p_prefix text, p_orphans_only boolean, p_min_age_s integer default 0)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'evidence'
    and (p_prefix = '' or left(o.name, length(p_prefix)) = p_prefix)
    and (not p_orphans_only or not exists (select 1 from public.evidence e where e.storage_path = o.name))
    and (
      o.created_at < now() - make_interval(secs => p_min_age_s)
      -- an object whose device no longer exists cannot be an upload in progress
      or (p_orphans_only and not exists (select 1 from public.devices d where d.id::text = split_part(o.name, '/', 1)))
    )
  limit 5000;
$$;
revoke all on function public.ss_evidence_objects(text, boolean, integer) from public, anon, authenticated;
grant execute on function public.ss_evidence_objects(text, boolean, integer) to service_role;

-- Replace the SQL-only retention job with an hourly call to the function (same pattern as the watchdog).
do $$ begin perform cron.unschedule('safetysense-retention'); exception when others then null; end $$;
select cron.schedule(
  'safetysense-retention',
  '17 * * * *',
  $$
  select net.http_post(
    url := 'https://uvunyysuyuonhoviszmc.supabase.co/functions/v1/api/cron/retention',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'safetysense_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

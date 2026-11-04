-- SafetySense backend schema.
-- Every table has RLS enabled and NO policies: only the service role (inside the
-- "api" edge function) reads or writes data. anon/authenticated get nothing.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------- tables
create table public.devices (
  id          uuid primary key default gen_random_uuid(),
  secret_hash text not null,               -- sha256 hex of the device secret
  name        text not null,
  phone       text,
  campus      text,
  created_at  timestamptz not null default now()
);

create table public.contacts (
  id         uuid primary key default gen_random_uuid(),
  device_id  uuid not null references public.devices(id) on delete cascade,
  name       text not null,
  phone      text not null,
  created_at timestamptz not null default now()
);
create index contacts_device_idx on public.contacts(device_id);

create table public.sessions (
  id                   uuid primary key default gen_random_uuid(),
  device_id            uuid not null references public.devices(id) on delete cascade,
  mode                 text not null check (mode in ('everyday','walk','night_out','date','ride')),
  status               text not null default 'active' check (status in ('active','ended','alerted')),
  started_at           timestamptz not null default now(),
  last_heartbeat_at    timestamptz not null default now(),
  check_in_interval_s  integer not null default 60,
  grace_s              integer not null default 180,
  dispatch_policy      text not null default 'contacts_first' check (dispatch_policy in ('contacts_first','dispatch_immediately')),
  dry_run              boolean not null default false,
  last_lat             double precision,
  last_lng             double precision,
  last_accuracy        double precision,
  last_battery         double precision,
  sealed_details       text,               -- AES-256-GCM ciphertext (server key in Vault), "v1:<iv_b64>:<ct_b64>"
  ended_at             timestamptz
);
create index sessions_watchdog_idx on public.sessions(status, last_heartbeat_at);
create index sessions_device_idx on public.sessions(device_id);

create table public.alerts (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid references public.sessions(id) on delete set null,
  device_id          uuid not null references public.devices(id) on delete cascade,
  level              smallint not null check (level in (2,3)),
  reason             text not null,
  trigger            text not null check (trigger in ('risk_engine','missed_check_in','safe_word','action_button','manual_sos','heartbeat_lost','contact')),
  status             text not null default 'active' check (status in ('active','cancelled','resolved','dispatched')),
  dispatch_policy    text not null default 'contacts_first' check (dispatch_policy in ('contacts_first','dispatch_immediately')),
  share_token        text not null unique check (length(share_token) >= 24),
  dispatch_provider  text,
  dispatch_alarm_id  text,
  dispatch_status    text,
  duress             boolean not null default false,
  dry_run            boolean not null default false,
  created_at         timestamptz not null default now(),
  escalated_at       timestamptz,
  cancelled_at       timestamptz
);
create index alerts_device_idx on public.alerts(device_id, created_at desc);
create index alerts_status_idx on public.alerts(status, level, created_at);

create table public.locations (
  id         bigint generated always as identity primary key,
  alert_id   uuid references public.alerts(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  lat        double precision not null,
  lng        double precision not null,
  accuracy   double precision,
  battery    double precision,
  created_at timestamptz not null default now()
);
create index locations_alert_idx on public.locations(alert_id, created_at desc);

create table public.events (
  id         bigint generated always as identity primary key,
  alert_id   uuid not null references public.alerts(id) on delete cascade,
  who        text not null,
  action     text not null,
  detail     text,
  internal   boolean not null default false,   -- hidden from the device (duress) / share page
  created_at timestamptz not null default now()
);
create index events_alert_idx on public.events(alert_id, created_at);

create table public.evidence (
  id           bigint generated always as identity primary key,
  alert_id     uuid not null references public.alerts(id) on delete cascade,
  seq          integer not null,
  sha256       text not null,
  storage_path text not null,               -- private Storage bucket "evidence"
  bytes        integer not null,
  created_at   timestamptz not null default now(),
  unique (alert_id, seq)
);

create table public.app_flags (
  key   text primary key,
  value jsonb not null
);
insert into public.app_flags(key, value) values
  ('setup_open', 'true'::jsonb),
  ('share_base', '"https://safetysense-live.vercel.app/a/"'::jsonb);

-- ---------------------------------------------------------------- lock down
do $$
declare t text;
begin
  foreach t in array array['devices','contacts','sessions','alerts','locations','events','evidence','app_flags'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- vault helpers
-- Read a SafetySense secret from Vault. service_role only.
create or replace function public.ss_get_secret(p_name text)
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'safetysense_' || p_name limit 1;
$$;

-- Create or replace a SafetySense secret in Vault. service_role only.
create or replace function public.ss_set_secret(p_name text, p_value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'safetysense_' || p_name;
  if v_id is null then
    perform vault.create_secret(p_value, 'safetysense_' || p_name, 'SafetySense ' || p_name);
  else
    perform vault.update_secret(v_id, p_value);
  end if;
end;
$$;

revoke all on function public.ss_get_secret(text) from public, anon, authenticated;
revoke all on function public.ss_set_secret(text, text) from public, anon, authenticated;
grant execute on function public.ss_get_secret(text) to service_role;
grant execute on function public.ss_set_secret(text, text) to service_role;

-- Server-generated secrets (never leave the database except into the edge function).
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'safetysense_cron_secret', 'SafetySense watchdog cron secret');
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'base64'), 'safetysense_sealed_key', 'SafetySense AES-256 key for sealed date details');

-- ---------------------------------------------------------------- evidence bucket (private)
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false)
on conflict (id) do nothing;

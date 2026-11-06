-- Phone lookups for the relay line, as RPCs. PostgREST filters put the number in a GET URL, and
-- edge_logs keep URLs; RPC arguments go in a POST body. Additive: two functions, no table changes.
-- Apply this BEFORE deploying the matching index.ts. Until then the relay fails safe, not open.

create or replace function public.ss_relay_caller_kind(p_phone text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.devices d where d.phone = p_phone) then 'device'
    when exists (select 1 from public.contacts c where c.phone = p_phone) then 'contact'
    else 'other'
  end;
$$;

create or replace function public.ss_same_phone_devices(p_device uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select other.id
  from public.devices d
  join public.devices other on other.phone = d.phone
  where d.id = p_device;
$$;

revoke all on function public.ss_relay_caller_kind(text) from public, anon, authenticated;
revoke all on function public.ss_same_phone_devices(uuid) from public, anon, authenticated;
grant execute on function public.ss_relay_caller_kind(text) to service_role;
grant execute on function public.ss_same_phone_devices(uuid) to service_role;

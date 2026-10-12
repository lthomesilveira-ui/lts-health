-- Superseded, NOT APPLIED. Use the bounded, non-destructive implementation in
-- migrations/20261012213757_polar_schedule_singleton_ticket.sql instead.
-- Extension-managed pg_net tables can retain PUBLIC grants owned by the
-- platform. Do not depend on a best-effort REVOKE or transmit a reusable key.
-- Every queued invocation gets a five-minute, atomically consumed ticket.
create table health_internal.polar_schedule_tickets (
  key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null
);
alter table health_internal.polar_schedule_tickets enable row level security;
revoke all on health_internal.polar_schedule_tickets from public, anon, authenticated;
grant select, delete on health_internal.polar_schedule_tickets to service_role;

create or replace function public.health_polar_scheduler_authorized(p_key_hash text)
returns boolean language plpgsql volatile security invoker set search_path=''
as $function$
declare consumed boolean;
begin
  if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$'
    or not coalesce((select enabled from health_internal.polar_schedule_config where singleton),false) then return false; end if;
  with used as (
    delete from health_internal.polar_schedule_tickets
    where key_hash=p_key_hash and expires_at>clock_timestamp()
    returning key_hash
  ) select exists(select 1 from used) into consumed;
  return consumed;
end;
$function$;
revoke all on function public.health_polar_scheduler_authorized(text) from public, anon, authenticated;
grant execute on function public.health_polar_scheduler_authorized(text) to service_role;

create or replace function health_internal.enqueue_polar_sync()
returns bigint language plpgsql security invoker set search_path=''
as $function$
declare ticket text;
begin
  if not coalesce((select enabled from health_internal.polar_schedule_config where singleton),false) then return null; end if;
  delete from health_internal.polar_schedule_tickets where expires_at<clock_timestamp();
  ticket:=encode(extensions.gen_random_bytes(32),'hex');
  insert into health_internal.polar_schedule_tickets(key_hash,expires_at)
  values(encode(extensions.digest(ticket,'sha256'),'hex'),clock_timestamp()+interval '5 minutes');
  return net.http_post(
    url:='https://plztdqyuqcjohiimudnr.supabase.co/functions/v1/health-polar-scheduled',
    headers:=jsonb_build_object('Content-Type','application/json','x-lts-polar-scheduler',ticket),
    body:='{"action":"tick"}'::jsonb,timeout_milliseconds:=180000);
end;
$function$;
revoke all on function health_internal.enqueue_polar_sync() from public, anon, authenticated, service_role;

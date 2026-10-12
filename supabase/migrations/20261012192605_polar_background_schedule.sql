-- A scoped server-to-server credential is generated inside the database. No
-- service key, owner JWT, provider token or password is copied into the job.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create schema if not exists health_internal;
revoke all on schema health_internal from public, anon, authenticated;

alter table public.health_polar_connections
  add column if not exists last_sync_trigger text check (last_sync_trigger in ('manual','app_open','scheduled')),
  add column if not exists last_scheduled_sync_at timestamptz,
  add column if not exists last_scheduled_attempt_at timestamptz;

create table if not exists health_internal.polar_schedule_config (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  key_hash text check (key_hash ~ '^[a-f0-9]{64}$')
);
alter table health_internal.polar_schedule_config enable row level security;
revoke all on health_internal.polar_schedule_config from public, anon, authenticated;
grant usage on schema health_internal to service_role;
grant select on health_internal.polar_schedule_config to service_role;
insert into health_internal.polar_schedule_config(singleton,enabled)
values(true,false) on conflict(singleton) do nothing;

do $bootstrap$
begin
  if (select count(*) from vault.secrets where name='lts_health_polar_scheduler')>1 then
    raise exception 'Duplicate scheduler credentials';
  end if;
  if not exists(select 1 from vault.secrets where name='lts_health_polar_scheduler') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'lts_health_polar_scheduler','Private LTS Polar scheduler credential');
  end if;
  update health_internal.polar_schedule_config set key_hash=(
    select encode(extensions.digest(decrypted_secret,'sha256'),'hex')
    from vault.decrypted_secrets where name='lts_health_polar_scheduler'
  ) where singleton;
end;
$bootstrap$;
alter table health_internal.polar_schedule_config alter column key_hash set not null;

create or replace function public.health_polar_scheduler_authorized(p_key_hash text)
returns boolean language sql stable security invoker set search_path=''
as $function$
  select coalesce((select cfg.enabled and p_key_hash ~ '^[a-f0-9]{64}$'
      and p_key_hash=cfg.key_hash
    from health_internal.polar_schedule_config cfg
    where cfg.singleton),false);
$function$;
revoke all on function public.health_polar_scheduler_authorized(text) from public, anon, authenticated;
grant execute on function public.health_polar_scheduler_authorized(text) to service_role;

create or replace function public.health_polar_scheduler_status()
returns jsonb language sql stable security invoker set search_path=''
as $function$
  select jsonb_build_object('enabled',coalesce((select cfg.enabled and j.active
      and j.schedule='17 * * * *'
      and j.command='select health_internal.enqueue_polar_sync();'
    from health_internal.polar_schedule_config cfg
    join cron.job j on j.jobname='lts-health-polar-hourly'
    where cfg.singleton),false),'interval_minutes',60);
$function$;
revoke all on function public.health_polar_scheduler_status() from public, anon, authenticated;
grant execute on function public.health_polar_scheduler_status() to service_role;

create or replace function health_internal.enqueue_polar_sync()
returns bigint language plpgsql security invoker set search_path=''
as $function$
declare scheduler_key text;
begin
  if not coalesce((select enabled from health_internal.polar_schedule_config where singleton),false) then return null; end if;
  select decrypted_secret into strict scheduler_key from vault.decrypted_secrets where name='lts_health_polar_scheduler';
  return net.http_post(
    url:='https://plztdqyuqcjohiimudnr.supabase.co/functions/v1/health-polar-scheduled',
    headers:=jsonb_build_object('Content-Type','application/json','x-lts-polar-scheduler',scheduler_key),
    body:='{"action":"tick"}'::jsonb,timeout_milliseconds:=180000);
end;
$function$;
revoke all on function health_internal.enqueue_polar_sync() from public, anon, authenticated, service_role;

-- Provision inactive; enable only after deployment and a real scheduled run.
select cron.schedule('lts-health-polar-hourly','17 * * * *','select health_internal.enqueue_polar_sync();');
select cron.alter_job(jobid,active:=false) from cron.job where jobname='lts-health-polar-hourly';

-- Backend metadata and request headers are not readable by app roles.
revoke all on all tables in schema net from public, anon, authenticated;
revoke all on all tables in schema cron from public, anon, authenticated;
grant usage on schema cron to service_role;
grant select on cron.job to service_role;

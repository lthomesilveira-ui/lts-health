-- Uses the existing pg_cron/pg_net installation. No permanent invocation key,
-- provider grant, user credential or canonical health record is created.
create schema if not exists health_internal;
revoke all on schema health_internal from public,anon,authenticated;
grant usage on schema health_internal to service_role;

alter table public.health_google_connections
  add column if not exists last_scheduled_attempt_at timestamptz,
  add column if not exists last_scheduled_read_at timestamptz;

create or replace function health_internal.google_schedule_generation_boundary()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='INSERT' or new.generation is distinct from old.generation then
    new.last_scheduled_attempt_at:=null;new.last_scheduled_read_at:=null;
  end if;
  return new;
end $$;
revoke all on function health_internal.google_schedule_generation_boundary() from public,anon,authenticated,service_role;
drop trigger if exists google_schedule_generation_boundary on public.health_google_connections;
create trigger google_schedule_generation_boundary before insert or update of generation on public.health_google_connections
  for each row execute function health_internal.google_schedule_generation_boundary();

create table if not exists health_internal.google_hydration_schedule_config (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  endpoint_url text check(endpoint_url ~ '^https://[a-z0-9]{20}\.supabase\.co/functions/v1/health-google-scheduled$'),
  key_hash text check(key_hash ~ '^[a-f0-9]{64}$'),
  ticket_issued_at timestamptz,
  ticket_expires_at timestamptz,
  ticket_consumed_at timestamptz,
  last_request_id bigint,
  check(not enabled or endpoint_url is not null),
  check(ticket_expires_at is null or (ticket_issued_at is not null and ticket_expires_at>ticket_issued_at and ticket_expires_at<=ticket_issued_at+interval '5 minutes')),
  check(ticket_consumed_at is null or (ticket_issued_at is not null and ticket_consumed_at>=ticket_issued_at))
);
alter table health_internal.google_hydration_schedule_config enable row level security;
revoke all on health_internal.google_hydration_schedule_config from public,anon,authenticated,service_role;
grant select on health_internal.google_hydration_schedule_config to service_role;
grant update(ticket_consumed_at) on health_internal.google_hydration_schedule_config to service_role;
insert into health_internal.google_hydration_schedule_config(singleton) values(true) on conflict(singleton) do nothing;

create or replace function public.health_google_scheduler_authorized(p_key_hash text)
returns boolean language plpgsql volatile security invoker set search_path='' as $$
declare consumed integer;
begin
  if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$' then return false;end if;
  update health_internal.google_hydration_schedule_config set ticket_consumed_at=clock_timestamp()
    where singleton and enabled and key_hash=p_key_hash and ticket_issued_at<=clock_timestamp()
      and ticket_expires_at>clock_timestamp() and ticket_consumed_at is null;
  get diagnostics consumed=row_count;return consumed=1;
end $$;

create or replace function public.health_google_scheduled_candidates()
returns table(user_id uuid) language sql stable security invoker set search_path='' as $$
  select c.user_id from public.health_google_connections c where c.status='connected'
    and (c.last_read_at is null or c.last_read_at<=statement_timestamp()-interval '50 minutes')
    and (c.last_scheduled_attempt_at is null or c.last_scheduled_attempt_at<=statement_timestamp()-interval '50 minutes')
    and c.lease_until<=statement_timestamp()
  order by c.last_scheduled_attempt_at asc nulls first,c.connected_at asc,c.user_id limit 2;
$$;

create or replace function public.health_google_claim_scheduled_read(p_user_id uuid,p_generation uuid,p_lease_token uuid)
returns boolean language plpgsql volatile security invoker set search_path='' as $$
declare claimed integer;stamp timestamptz:=clock_timestamp();
begin
  if p_lease_token is null then return false;end if;
  update public.health_google_connections set lease_token=p_lease_token,lease_until=stamp+interval '2 minutes',
      last_attempt_at=stamp,last_scheduled_attempt_at=stamp
    where user_id=p_user_id and status='connected' and generation=p_generation and lease_until<=stamp
      and (last_read_at is null or last_read_at<=stamp-interval '50 minutes')
      and (last_scheduled_attempt_at is null or last_scheduled_attempt_at<=stamp-interval '50 minutes');
  get diagnostics claimed=row_count;return claimed=1;
end $$;

create or replace function public.health_google_finish_scheduled_read(p_user_id uuid,p_generation uuid,p_lease_token uuid,p_result jsonb)
returns text language plpgsql volatile security invoker set search_path='' as $$
declare outcome text;
begin
  outcome:=public.health_google_finish_read(p_user_id,p_generation,p_lease_token,p_result||jsonb_build_object('read_trigger','scheduled'));
  if outcome in ('stored','unchanged') then
    update public.health_google_connections set last_scheduled_read_at=clock_timestamp()
      where user_id=p_user_id and generation=p_generation and status='connected';
  end if;
  return outcome;
end $$;

revoke all on function public.health_google_scheduler_authorized(text) from public,anon,authenticated;
revoke all on function public.health_google_scheduled_candidates() from public,anon,authenticated;
revoke all on function public.health_google_claim_scheduled_read(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.health_google_finish_scheduled_read(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.health_google_scheduler_authorized(text) to service_role;
grant execute on function public.health_google_scheduled_candidates() to service_role;
grant execute on function public.health_google_claim_scheduled_read(uuid,uuid,uuid) to service_role;
grant execute on function public.health_google_finish_scheduled_read(uuid,uuid,uuid,jsonb) to service_role;

create or replace function health_internal.enqueue_google_hydration()
returns bigint language plpgsql volatile security invoker set search_path='' as $$
declare cfg health_internal.google_hydration_schedule_config%rowtype;ticket text;stamp timestamptz;request_id bigint;
begin
  select * into cfg from health_internal.google_hydration_schedule_config where singleton for update;
  stamp:=clock_timestamp();
  if not found or not cfg.enabled or cfg.endpoint_url is null then return null;end if;
  if cfg.ticket_consumed_at is null and cfg.ticket_expires_at>stamp then return null;end if;
  ticket:=encode(extensions.gen_random_bytes(32),'hex');
  update health_internal.google_hydration_schedule_config set key_hash=encode(extensions.digest(ticket,'sha256'),'hex'),
    ticket_issued_at=stamp,ticket_expires_at=stamp+interval '5 minutes',ticket_consumed_at=null where singleton;
  request_id:=net.http_post(url:=cfg.endpoint_url,headers:=jsonb_build_object('Content-Type','application/json','x-lts-google-scheduler',ticket),
    body:='{"action":"tick"}'::jsonb,timeout_milliseconds:=120000);
  update health_internal.google_hydration_schedule_config set last_request_id=request_id where singleton;
  return request_id;
end $$;
revoke all on function health_internal.enqueue_google_hydration() from public,anon,authenticated,service_role;

-- The transport queue temporarily holds a ticket. Extension PUBLIC defaults must
-- not let browser roles read it, replace it or alter the worker response.
revoke all on net.http_request_queue,net._http_response from public,anon,authenticated;
revoke all on cron.job from public,anon,authenticated;
grant usage on schema cron to service_role;
grant select on cron.job to service_role;

do $$
declare job_id bigint;
begin
  if not exists(select 1 from cron.job where jobname='lts-health-google-hourly') then
    job_id:=cron.schedule('lts-health-google-hourly','36 * * * *','select health_internal.enqueue_google_hydration();');
    perform cron.alter_job(job_id,active:=false);
  elsif exists(select 1 from cron.job where jobname='lts-health-google-hourly' and
      (schedule<>'36 * * * *' or command<>'select health_internal.enqueue_google_hydration();')) then
    raise exception 'google_schedule_name_conflict';
  end if;
end $$;

create or replace function public.health_google_scheduler_status()
returns table(enabled boolean,interval_minutes integer,last_enqueued_at timestamptz,last_consumed_at timestamptz)
language sql stable security invoker set search_path='' as $$
  select c.enabled and exists(select 1 from cron.job j where j.jobname='lts-health-google-hourly' and j.active
      and j.schedule='36 * * * *' and j.command='select health_internal.enqueue_google_hydration();'),
    60,c.ticket_issued_at,c.ticket_consumed_at
  from health_internal.google_hydration_schedule_config c where c.singleton;
$$;
revoke all on function public.health_google_scheduler_status() from public,anon,authenticated;
grant execute on function public.health_google_scheduler_status() to service_role;

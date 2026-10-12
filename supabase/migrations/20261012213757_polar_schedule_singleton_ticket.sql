-- Applied through the native migration tool; generated version 20261012213757.
-- A bounded operational slot replaces the unapplied ticket-row proposal.
-- Only a fresh five-minute invocation ticket enters the extension-owned queue.
-- Atomic consumption changes one marker; no health or credential row is removed.
alter table health_internal.polar_schedule_config
  add column ticket_issued_at timestamptz,
  add column ticket_expires_at timestamptz,
  add column ticket_consumed_at timestamptz;

alter table health_internal.polar_schedule_config
  add constraint polar_ticket_window check (
    ticket_expires_at is null or (
      ticket_issued_at is not null
      and ticket_expires_at > ticket_issued_at
      and ticket_expires_at <= ticket_issued_at + interval '5 minutes'
    )
  ),
  add constraint polar_ticket_consumption check (
    ticket_consumed_at is null or (
      ticket_issued_at is not null and ticket_consumed_at >= ticket_issued_at
    )
  );

-- The backend may consume a ticket, but cannot enable the agenda, issue another
-- ticket, or extend its expiry through this grant. Browser roles remain denied.
revoke update on health_internal.polar_schedule_config from service_role;
grant update(ticket_consumed_at) on health_internal.polar_schedule_config to service_role;

create or replace function public.health_polar_scheduler_authorized(p_key_hash text)
returns boolean language plpgsql volatile security invoker set search_path=''
as $function$
declare consumed_rows integer;
begin
  if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$' then return false; end if;
  update health_internal.polar_schedule_config
    set ticket_consumed_at=clock_timestamp()
    where singleton and enabled and key_hash=p_key_hash
      and ticket_issued_at<=clock_timestamp()
      and ticket_expires_at>clock_timestamp()
      and ticket_consumed_at is null;
  get diagnostics consumed_rows=row_count;
  return consumed_rows=1;
end;
$function$;
revoke all on function public.health_polar_scheduler_authorized(text) from public, anon, authenticated;
grant execute on function public.health_polar_scheduler_authorized(text) to service_role;

create or replace function health_internal.enqueue_polar_sync()
returns bigint language plpgsql security invoker set search_path=''
as $function$
declare ticket text; issued_at timestamptz;
begin
  if not coalesce((select enabled from health_internal.polar_schedule_config where singleton),false) then return null; end if;
  ticket:=encode(extensions.gen_random_bytes(32),'hex');
  issued_at:=clock_timestamp();
  update health_internal.polar_schedule_config
    set key_hash=encode(extensions.digest(ticket,'sha256'),'hex'),
      ticket_issued_at=issued_at,
      ticket_expires_at=issued_at+interval '5 minutes',
      ticket_consumed_at=null
    where singleton and enabled;
  if not found then return null; end if;
  return net.http_post(
    url:='https://plztdqyuqcjohiimudnr.supabase.co/functions/v1/health-polar-scheduled',
    headers:=jsonb_build_object('Content-Type','application/json','x-lts-polar-scheduler',ticket),
    body:='{"action":"tick"}'::jsonb,timeout_milliseconds:=180000);
end;
$function$;
revoke all on function health_internal.enqueue_polar_sync() from public, anon, authenticated, service_role;

-- Installation is fail-closed. Genuine execution is validated separately.
update health_internal.polar_schedule_config set enabled=false where singleton;
select cron.alter_job(jobid,active:=false) from cron.job where jobname='lts-health-polar-hourly';

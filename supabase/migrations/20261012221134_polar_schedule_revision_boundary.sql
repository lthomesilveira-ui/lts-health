-- Native migration generated version 20261012221134.
-- Enforce fresh schedule evidence for every new authorization revision,
-- including callbacks bundled before the schedule columns existed.
create function health_internal.polar_schedule_revision_boundary()
returns trigger language plpgsql security invoker set search_path=''
as $function$
begin
  if tg_op='UPDATE' then
    if new.revision is not distinct from old.revision then return new; end if;
  end if;
  new.last_scheduled_sync_at:=null;
  new.last_scheduled_attempt_at:=null;
  new.last_sync_trigger:=null;
  return new;
end;
$function$;
revoke all on function health_internal.polar_schedule_revision_boundary() from public, anon, authenticated, service_role;
grant execute on function health_internal.polar_schedule_revision_boundary() to service_role;

create trigger polar_schedule_revision_boundary
before insert or update of revision on public.health_polar_connections
for each row execute function health_internal.polar_schedule_revision_boundary();

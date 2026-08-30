-- Sleep is source-specific context in LTS Health and must never be canonical automatically.
-- Preserve reviewed status semantics globally, while allowing the one legitimate repair:
-- historical canonical sleep rows may be demoted to candidate.
create or replace function public.health_source_daily_metrics_preserve_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.canonical_status in ('held','superseded')
     and new.canonical_status in ('candidate','canonical') then
    new.canonical_status := old.canonical_status;
  elsif old.canonical_status = 'canonical'
        and new.canonical_status = 'candidate'
        and old.metric_type not like 'sleep_%' then
    new.canonical_status := old.canonical_status;
  end if;
  return new;
end;
$$;

-- Preserve every historical row and provenance; only correct classification before enforcing the invariant.
update public.health_source_daily_metrics
set canonical_status = 'candidate',
    updated_at = now()
where canonical_status = 'canonical'
  and metric_type like 'sleep_%';

alter table public.health_source_daily_metrics
  drop constraint if exists health_source_daily_metrics_sleep_not_canonical;

alter table public.health_source_daily_metrics
  add constraint health_source_daily_metrics_sleep_not_canonical
  check (not (canonical_status = 'canonical' and metric_type like 'sleep_%'));

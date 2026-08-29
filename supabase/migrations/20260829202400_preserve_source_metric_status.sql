create or replace function public.health_source_daily_metrics_preserve_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.canonical_status in ('canonical','held','superseded')
     and new.canonical_status = 'candidate' then
    new.canonical_status := old.canonical_status;
  end if;
  return new;
end;
$$;

drop trigger if exists health_source_daily_metrics_preserve_status_trg
  on public.health_source_daily_metrics;

create trigger health_source_daily_metrics_preserve_status_trg
before update of canonical_status on public.health_source_daily_metrics
for each row
execute function public.health_source_daily_metrics_preserve_status();

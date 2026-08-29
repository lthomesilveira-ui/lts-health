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
        and new.canonical_status = 'candidate' then
    new.canonical_status := old.canonical_status;
  end if;
  return new;
end;
$$;

begin;

-- Reconcile legacy quality statements only when the same owner's current
-- structured data proves that the old condition no longer exists.
update public.health_data_quality_issues as issue
set
  status = 'resolved',
  resolution_notes = 'Resolvido: o histórico direto de nutrição e refeições está estruturado. Campos ausentes continuam ausentes e nenhum valor foi reconstruído.'
where issue.issue_code = 'DQ-NUTRITION-EMPTY-001'
  and issue.status is distinct from 'resolved'
  and exists (
    select 1 from public.health_daily_nutrition as nutrition
    where nutrition.user_id = issue.user_id
  )
  and exists (
    select 1 from public.health_nutrition_meals as meal
    where meal.user_id = issue.user_id
  );

update public.health_data_quality_issues as issue
set
  status = 'resolved',
  resolution_notes = 'Resolvido: exercícios e séries estruturados existem com proveniência preservada. Lacunas específicas de fontes antigas continuam registradas separadamente.'
where issue.issue_code = 'DQ-WORKOUT-NORMALIZATION-002'
  and issue.status is distinct from 'resolved'
  and exists (
    select 1 from public.health_workout_exercises as exercise
    where exercise.user_id = issue.user_id
  )
  and exists (
    select 1 from public.health_workout_sets as workout_set
    where workout_set.user_id = issue.user_id
  );

update public.health_data_quality_issues as issue
set
  status = 'resolved',
  resolution_notes = 'Resolvido: múltiplas coletas laboratoriais estão estruturadas. Séries sem identificação comprovada permanecem separadas até existir fonte original.'
where issue.issue_code = 'DQ-LABS-COVERAGE-001'
  and issue.status is distinct from 'resolved'
  and (
    select count(distinct lab.collection_date)
    from public.health_lab_results as lab
    where lab.user_id = issue.user_id
  ) > 1;

update public.health_data_requests as request
set
  status = 'partial',
  completed_at = null,
  notes = 'Múltiplas coletas e origens já estão estruturadas. Novos arquivos originais continuam sendo expansão de cobertura, sem invalidar o histórico atual.'
where request.domain = 'labs'
  and request.status = 'needed'
  and (
    select count(distinct lab.collection_date)
    from public.health_lab_results as lab
    where lab.user_id = request.user_id
  ) > 1;

-- Persist the only remaining user step for historical MFP water. This is
-- derived from existing owners and contains no credential or health value.
insert into public.health_data_requests (
  user_id,
  domain,
  source_name,
  status,
  priority,
  requested_at,
  notes
)
select
  owner.user_id,
  'hydration',
  'MyFitnessPal authenticated export',
  case when exists (
    select 1
    from public.health_source_daily_metrics as metric
    where metric.user_id = owner.user_id
      and metric.source_family = 'myfitnesspal'
      and metric.metric_type = 'dietary_water_ml'
      and metric.canonical_status = 'canonical'
      and metric.confidence = 'account_authenticated_export'
  ) then 'completed' else 'needed' end,
  100,
  now(),
  case when exists (
    select 1
    from public.health_source_daily_metrics as metric
    where metric.user_id = owner.user_id
      and metric.source_family = 'myfitnesspal'
      and metric.metric_type = 'dietary_water_ml'
      and metric.canonical_status = 'canonical'
      and metric.confidence = 'account_authenticated_export'
  ) then 'Importação histórica autenticada recebida.'
    else 'Extrator disponível; executar na sessão autenticada do MyFitnessPal em um notebook e importar o JSON no LTS Health.' end
from (
  select distinct nutrition.user_id
  from public.health_daily_nutrition as nutrition
) as owner
where not exists (
  select 1
  from public.health_data_requests as existing
  where existing.user_id = owner.user_id
    and existing.domain = 'hydration'
    and existing.source_name = 'MyFitnessPal authenticated export'
);

create or replace function public.health_complete_mfp_water_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source_family = 'myfitnesspal'
    and new.metric_type = 'dietary_water_ml'
    and new.canonical_status = 'canonical'
    and new.confidence = 'account_authenticated_export'
  then
    update public.health_data_requests
    set
      status = 'completed',
      completed_at = coalesce(completed_at, now()),
      notes = 'Importação histórica autenticada recebida.'
    where user_id = new.user_id
      and domain = 'hydration'
      and source_name = 'MyFitnessPal authenticated export'
      and status is distinct from 'completed';
  end if;
  return new;
end;
$$;

revoke all on function public.health_complete_mfp_water_request() from public, anon, authenticated, service_role;

drop trigger if exists health_complete_mfp_water_request_after_write
on public.health_source_daily_metrics;

create trigger health_complete_mfp_water_request_after_write
after insert or update of source_family, metric_type, canonical_status, confidence
on public.health_source_daily_metrics
for each row
execute function public.health_complete_mfp_water_request();

commit;

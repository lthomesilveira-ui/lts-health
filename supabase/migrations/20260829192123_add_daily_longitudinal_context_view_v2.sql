create or replace view public.health_daily_context as
with metric_daily as (
  select
    user_id,
    measured_at::date as context_date,
    max(value) filter (where metric_type='active_energy_kcal') as active_energy_kcal,
    max(value) filter (where metric_type='exercise_minutes') as exercise_minutes,
    max(value) filter (where metric_type='stand_hours') as stand_hours,
    max(value) filter (where metric_type='sleep_duration_h') as sleep_duration_h,
    max(value) filter (where metric_type='resting_heart_rate_bpm') as resting_heart_rate_bpm,
    max(value) filter (where metric_type='hrv_sdnn_ms') as hrv_sdnn_ms,
    max(value) filter (where metric_type='respiratory_rate_bpm') as respiratory_rate_bpm
  from public.health_metrics
  where metric_type in ('active_energy_kcal','exercise_minutes','stand_hours','sleep_duration_h','resting_heart_rate_bpm','hrv_sdnn_ms','respiratory_rate_bpm')
  group by user_id, measured_at::date
), nutrition_daily as (
  select user_id,nutrition_date as context_date,calories_kcal,protein_g,carbs_g,fat_g,source as nutrition_source
  from public.health_daily_nutrition
), workout_daily as (
  select user_id,workout_date as context_date,count(*)::integer as workout_count
  from public.health_workouts
  where is_canonical is true and coalesce(record_status,'canonical') <> 'quarantined'
  group by user_id,workout_date
), dates as (
  select user_id,context_date from metric_daily
  union
  select user_id,context_date from nutrition_daily
  union
  select user_id,context_date from workout_daily
)
select
  d.user_id,d.context_date,
  n.calories_kcal,n.protein_g,n.carbs_g,n.fat_g,n.nutrition_source,
  m.active_energy_kcal,m.exercise_minutes,m.stand_hours,m.sleep_duration_h,
  m.resting_heart_rate_bpm,m.hrv_sdnn_ms,m.respiratory_rate_bpm,
  w.workout_count
from dates d
left join metric_daily m using(user_id,context_date)
left join nutrition_daily n using(user_id,context_date)
left join workout_daily w using(user_id,context_date);

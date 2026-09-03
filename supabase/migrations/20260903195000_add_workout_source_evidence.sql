create table if not exists public.health_workout_source_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_record_id text not null,
  workout_source_record_id text not null,
  workout_date date not null,
  source_family text not null,
  source_name text not null,
  evidence_kind text not null default 'telemetry' check (evidence_kind in ('telemetry','session_reference')),
  evidence_status text not null default 'confirmed' check (evidence_status in ('confirmed','candidate','held')),
  field_names text[] not null default '{}'::text[],
  confidence text not null default 'high',
  source_file text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_record_id),
  constraint health_workout_source_evidence_workout_fk
    foreign key (user_id, workout_source_record_id)
    references public.health_workouts(user_id, source_record_id)
    on delete cascade
);

create index if not exists health_workout_source_evidence_user_workout_idx
  on public.health_workout_source_evidence (user_id, workout_source_record_id);
create index if not exists health_workout_source_evidence_user_source_date_idx
  on public.health_workout_source_evidence (user_id, source_family, workout_date desc);

alter table public.health_workout_source_evidence enable row level security;

revoke all on table public.health_workout_source_evidence from public, anon, authenticated;
grant select, insert, update, delete on table public.health_workout_source_evidence to authenticated;
grant all on table public.health_workout_source_evidence to service_role;

drop policy if exists health_workout_source_evidence_owner_all on public.health_workout_source_evidence;
create policy health_workout_source_evidence_owner_all
  on public.health_workout_source_evidence
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

insert into public.health_workout_source_evidence (
  user_id,
  source_record_id,
  workout_source_record_id,
  workout_date,
  source_family,
  source_name,
  evidence_kind,
  evidence_status,
  field_names,
  confidence,
  source_file,
  notes
)
select
  w.user_id,
  'workout-evidence:polar:' || w.source_record_id,
  w.source_record_id,
  w.workout_date,
  'polar_flow',
  'Polar Flow',
  'telemetry',
  'confirmed',
  array_remove(array[
    case when w.duration_minutes is not null then 'duration_minutes' end,
    case when w.calories_kcal is not null then 'calories_kcal' end,
    case when w.heart_rate_avg is not null then 'heart_rate_avg' end,
    case when w.heart_rate_min is not null then 'heart_rate_min' end,
    case when w.heart_rate_max is not null then 'heart_rate_max' end
  ]::text[], null),
  w.confidence,
  w.source_file,
  'Evidência complementar confirmada somente porque Polar Flow está explicitamente citado na proveniência registrada do treino.'
from public.health_workouts w
where w.is_canonical is true
  and w.record_status <> 'quarantined'
  and (
    lower(coalesce(w.source,'')) like '%polar%'
    or lower(coalesce(w.source_file,'')) like '%polar%'
    or lower(coalesce(w.notes,'')) like '%polar%'
  )
  and (
    w.duration_minutes is not null
    or w.calories_kcal is not null
    or w.heart_rate_avg is not null
    or w.heart_rate_min is not null
    or w.heart_rate_max is not null
  )
on conflict (user_id, source_record_id) do nothing;

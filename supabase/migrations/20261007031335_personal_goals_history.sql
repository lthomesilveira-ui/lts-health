-- Personal references are versioned by effective date, never inferred from intake.
create table public.health_personal_goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  effective_from date not null,
  calories_kcal numeric check (calories_kcal > 0 and calories_kcal <= 20000),
  protein_g numeric check (protein_g > 0 and protein_g <= 2000),
  carbs_g numeric check (carbs_g > 0 and carbs_g <= 3000),
  fat_g numeric check (fat_g > 0 and fat_g <= 2000),
  fiber_g numeric check (fiber_g > 0 and fiber_g <= 500),
  water_ml numeric check (water_ml > 0 and water_ml <= 30000),
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  primary key (user_id, effective_from),
  check (effective_from <= (now() at time zone 'America/Sao_Paulo')::date)
);
alter table public.health_personal_goals enable row level security;
revoke all on public.health_personal_goals from anon, authenticated;
grant select, insert, update on public.health_personal_goals to authenticated;
create policy personal_goals_select on public.health_personal_goals for select to authenticated
  using ((select auth.uid()) = user_id);
create policy personal_goals_insert on public.health_personal_goals for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy personal_goals_update on public.health_personal_goals for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

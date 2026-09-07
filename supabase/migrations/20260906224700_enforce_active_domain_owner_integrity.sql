begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.health_activity_records
  add constraint health_activity_records_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.health_daily_nutrition
  add constraint health_daily_nutrition_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.health_medication_events
  add constraint health_medication_events_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.health_medication_regimens
  add constraint health_medication_regimens_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.health_metrics
  add constraint health_metrics_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.health_nutrition_meals
  add constraint health_nutrition_meals_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.health_segmental_composition
  add constraint health_segmental_composition_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.health_uploads
  add constraint health_uploads_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

commit;

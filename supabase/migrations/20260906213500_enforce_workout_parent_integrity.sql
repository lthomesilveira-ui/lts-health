begin;

alter table public.health_workout_exercises
  alter column workout_source_record_id set not null;

alter table public.health_workout_sets
  alter column workout_source_record_id set not null,
  alter column exercise_source_record_id set not null;

alter table public.health_workout_exercises
  add constraint health_workout_exercises_workout_fk
  foreign key (user_id, workout_source_record_id)
  references public.health_workouts(user_id, source_record_id)
  on delete cascade;

alter table public.health_workout_sets
  add constraint health_workout_sets_workout_fk
  foreign key (user_id, workout_source_record_id)
  references public.health_workouts(user_id, source_record_id)
  on delete cascade,
  add constraint health_workout_sets_exercise_fk
  foreign key (user_id, exercise_source_record_id)
  references public.health_workout_exercises(user_id, source_record_id)
  on delete cascade;

commit;

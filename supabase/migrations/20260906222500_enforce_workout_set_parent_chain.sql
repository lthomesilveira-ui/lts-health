begin;

alter table public.health_workout_exercises
  add constraint health_workout_exercises_user_workout_source_record_key
  unique (user_id, workout_source_record_id, source_record_id);

alter table public.health_workout_sets
  drop constraint health_workout_sets_exercise_fk,
  add constraint health_workout_sets_exercise_fk
  foreign key (user_id, workout_source_record_id, exercise_source_record_id)
  references public.health_workout_exercises(user_id, workout_source_record_id, source_record_id)
  on delete cascade;

commit;

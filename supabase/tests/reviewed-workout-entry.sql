\set ON_ERROR_STOP on
begin;
create schema auth;
create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
create table public.health_workouts(
 user_id uuid,source_record_id text,workout_date date,workout_type text,location text,duration_minutes numeric,calories_kcal numeric,
 heart_rate_avg numeric,heart_rate_min numeric,heart_rate_max numeric,muscle_groups text[],sets_by_group jsonb,raw_exercises text,
 source text,confidence text,notes text,record_status text,is_canonical boolean,source_payload jsonb,primary key(user_id,source_record_id));
create table public.health_workout_exercises(
 user_id uuid,source_record_id text,workout_source_record_id text,workout_date date,order_index integer,exercise text,machine text,muscle_group text,sets integer,
 source_text text,source text,confidence text,notes text,source_payload jsonb,primary key(user_id,source_record_id),
 foreign key(user_id,workout_source_record_id) references public.health_workouts);
create table public.health_workout_sets(
 user_id uuid,source_record_id text,workout_source_record_id text,exercise_source_record_id text,workout_date date,exercise_name text,exercise_order integer,set_index integer,
 phase text,weight numeric,weight_unit text,reps_numeric numeric,reps_raw text,source_text text,failure boolean,source text,confidence text,notes text,source_payload jsonb,primary key(user_id,source_record_id),
 foreign key(user_id,workout_source_record_id) references public.health_workouts,foreign key(user_id,exercise_source_record_id) references public.health_workout_exercises);
\ir ../migrations/20261118202400_reviewed_workout_entry.sql
do $qa$
declare
 p jsonb:='{"entry_id":"00000000-0000-4000-8000-000000000031","workout_date":"2024-03-14","workout_type":"Synthetic","start_clock":"09:20","original_text":"Synthetic original","exercises":[{"name":"Exercise A","muscle_group":"A","sets":[{"phase":"working","reps":6,"weight":12.5,"weight_unit":"kg"},{"phase":"rest_pause","reps":1.5,"failure":true}]}]}';
 receipt jsonb; root text; n int;
begin
 begin perform public.health_log_structured_workout(p);raise exception 'accepted signed-out entry';exception when others then if sqlerrm<>'authentication_required' then raise;end if;end;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000041',true);
 receipt:=public.health_log_structured_workout(p);root:=receipt->>'source_record_id';
 if public.health_log_structured_workout(p) is distinct from receipt then raise exception 'retry changed receipt';end if;
 if (select count(*) from public.health_workouts)<>1 or (select count(*) from public.health_workout_sets)<>2 then raise exception 'duplicate';end if;
 if not exists(select from public.health_workouts where source_record_id=root and raw_exercises='Synthetic original' and source_payload->>'reported_start_clock'='09:20' and sets_by_group->>'A'='1') then raise exception 'original or grouping lost';end if;
 if not exists(select from public.health_workout_sets where phase='rest_pause' and reps_numeric=1.5 and failure) then raise exception 'extension or failure lost';end if;
 begin perform public.health_log_structured_workout(p||'{"workout_type":"Changed"}');raise exception 'accepted changed retry';exception when others then if sqlerrm<>'workout_entry_changed' then raise;end if;end;
 perform public.health_log_structured_workout(jsonb_build_object('workout_date','2024-03-14','workout_type','Synthetic text','original_text','An unstructured report','text_only',true,'exercises','[]'::jsonb));
 if not exists(select from public.health_workouts where raw_exercises='An unstructured report') or (select count(*) from public.health_workout_sets)<>2 then raise exception 'raw fallback fabricated sets';end if;
 perform public.health_log_structured_workout((p-'entry_id'-'original_text'-'start_clock'));
 if not exists(select from public.health_workouts where raw_exercises='Exercise A') then raise exception 'legacy input changed';end if;
 select count(*) into n from public.health_workouts;
 begin perform public.health_log_structured_workout((p-'entry_id')||'{"exercises":[{"name":"Bad exercise","sets":[{"reps":"invalid"}]}]}');raise exception 'accepted invalid set';exception when others then if sqlerrm not like 'invalid_reps_at_%' then raise;end if;end;
 if (select count(*) from public.health_workouts)<>n then raise exception 'partial write';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000042',true);
 perform public.health_log_structured_workout(p);
 if (select count(distinct user_id) from public.health_workouts where source_record_id=root)<>2 then raise exception 'owner isolation';end if;
end $qa$;
rollback;

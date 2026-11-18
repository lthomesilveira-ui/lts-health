CREATE OR REPLACE FUNCTION public.health_log_structured_workout(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
  v_root text;
  v_entry uuid;
  v_fingerprint text;
  v_existing jsonb;
  v_original text;
  v_clock text;
  v_primary int;
  v_receipt jsonb;
  v_date date;
  v_type text;
  v_exercises jsonb;
  v_ex jsonb;
  v_set jsonb;
  v_ex_idx int;
  v_set_idx int;
  v_ex_id text;
  v_name text;
  v_group text;
  v_machine text;
  v_sets jsonb;
  v_set_count int;
  v_total_sets int := 0;
  v_group_counts jsonb := '{}'::jsonb;
  v_groups text[] := array[]::text[];
  v_phase text;
  v_weight numeric;
  v_reps numeric;
  v_unit text;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'invalid_payload'; end if;
  begin
    v_date := nullif(trim(p_payload->>'workout_date'),'')::date;
  exception when others then
    raise exception 'invalid_workout_date';
  end;
  v_type := nullif(trim(p_payload->>'workout_type'),'');
  if v_date is null or v_type is null then raise exception 'workout_date_and_type_required'; end if;
  v_exercises := p_payload->'exercises';
  v_original := nullif(trim(p_payload->>'original_text'),'');
  v_clock := nullif(trim(p_payload->>'start_clock'),'');
  if length(v_original)>16000 then raise exception 'workout_text_too_long'; end if;
  if v_clock is not null and v_clock !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'invalid_workout_clock'; end if;
  if jsonb_typeof(v_exercises) is distinct from 'array' then raise exception 'at_least_one_exercise_required'; end if;
  if jsonb_array_length(v_exercises)=0 and not (v_original is not null and coalesce(p_payload->'text_only','false'::jsonb)='true'::jsonb) then
    raise exception 'at_least_one_exercise_required';
  end if;
  if jsonb_array_length(v_exercises)>99 then raise exception 'too_many_workout_items'; end if;
  if p_payload ? 'entry_id' then
    if nullif(p_payload->>'entry_id','') is null then raise exception 'invalid_workout_entry_id'; end if;
    v_entry := (p_payload->>'entry_id')::uuid;
    v_root := 'manual-structured:' || v_entry::text;
    v_fingerprint := encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
    perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || v_root,0));
    select w.source_payload into v_existing from public.health_workouts w where w.user_id=v_user and w.source_record_id=v_root;
    if found then
      if v_existing->>'entry_fingerprint' is distinct from v_fingerprint then raise exception 'workout_entry_changed'; end if;
      return v_existing->'entry_receipt';
    end if;
  else
    v_root := 'manual-structured:' || gen_random_uuid()::text;
  end if;

  insert into public.health_workouts(
    user_id,source_record_id,workout_date,workout_type,location,duration_minutes,calories_kcal,
    heart_rate_avg,heart_rate_min,heart_rate_max,muscle_groups,sets_by_group,raw_exercises,
    source,confidence,notes,record_status,is_canonical,source_payload
  ) values (
    v_user,v_root,v_date,v_type,nullif(trim(p_payload->>'location'),''),
    nullif(p_payload->>'duration_minutes','')::numeric,nullif(p_payload->>'calories_kcal','')::numeric,
    nullif(p_payload->>'heart_rate_avg','')::numeric,nullif(p_payload->>'heart_rate_min','')::numeric,nullif(p_payload->>'heart_rate_max','')::numeric,
    array[]::text[],'{}'::jsonb,null,
    'LTS Health structured manual entry','user_reported',nullif(trim(p_payload->>'notes'),''),'validated',true,
    jsonb_build_object('entry_method','structured_workout_form_v1')
  );

  for v_ex, v_ex_idx in select value, ordinality::int from jsonb_array_elements(v_exercises) with ordinality loop
    v_name := nullif(trim(v_ex->>'name'),'');
    if v_name is null then raise exception 'exercise_name_required_at_%', v_ex_idx; end if;
    v_group := nullif(trim(v_ex->>'muscle_group'),'');
    v_machine := nullif(trim(v_ex->>'machine'),'');
    v_sets := coalesce(v_ex->'sets','[]'::jsonb);
    if jsonb_typeof(v_sets) <> 'array' or jsonb_array_length(v_sets)=0 then raise exception 'at_least_one_set_required_for_exercise_%', v_ex_idx; end if;
    v_set_count := jsonb_array_length(v_sets);
    if v_set_count>99 then raise exception 'too_many_workout_items'; end if;
    select count(*) into v_primary from jsonb_array_elements(v_sets) s
      where coalesce(s->>'phase','working') not in ('drop','rest_pause');
    v_total_sets := v_total_sets + v_set_count;
    v_ex_id := v_root || ':ex:' || lpad(v_ex_idx::text,2,'0');
    if v_group is not null then
      if not (v_group = any(v_groups)) then v_groups := array_append(v_groups,v_group); end if;
      v_group_counts := jsonb_set(v_group_counts,array[v_group],to_jsonb(coalesce((v_group_counts->>v_group)::int,0)+v_primary),true);
    end if;

    insert into public.health_workout_exercises(
      user_id,source_record_id,workout_source_record_id,workout_date,order_index,exercise,machine,muscle_group,sets,
      source_text,source,confidence,notes,source_payload
    ) values (
      v_user,v_ex_id,v_root,v_date,v_ex_idx,v_name,v_machine,v_group,v_primary,
      null,'LTS Health structured manual entry','user_reported',nullif(trim(v_ex->>'notes'),''),jsonb_build_object('entry_method','structured_workout_form_v1')
    );

    for v_set, v_set_idx in select value, ordinality::int from jsonb_array_elements(v_sets) with ordinality loop
      v_phase := coalesce(nullif(trim(v_set->>'phase'),''),'working');
      if v_phase not in ('warmup','working','drop','rest_pause','other') then v_phase := 'other'; end if;
      begin v_weight := nullif(v_set->>'weight','')::numeric; exception when others then raise exception 'invalid_weight_at_%_%',v_ex_idx,v_set_idx; end;
      begin v_reps := nullif(v_set->>'reps','')::numeric; exception when others then raise exception 'invalid_reps_at_%_%',v_ex_idx,v_set_idx; end;
      v_unit := nullif(trim(v_set->>'weight_unit'),'');
      if v_unit is not null and v_unit not in ('kg','lb','plate_index','unitless') then raise exception 'invalid_weight_unit_at_%_%',v_ex_idx,v_set_idx; end if;
      insert into public.health_workout_sets(
        user_id,source_record_id,workout_source_record_id,exercise_source_record_id,workout_date,exercise_name,exercise_order,set_index,
        phase,weight,weight_unit,reps_numeric,reps_raw,source_text,failure,source,confidence,notes,source_payload
      ) values (
        v_user,v_root||':set:'||lpad(v_ex_idx::text,2,'0')||':'||lpad(v_set_idx::text,2,'0'),v_root,v_ex_id,v_date,v_name,v_ex_idx,v_set_idx,
        v_phase,v_weight,v_unit,v_reps,case when v_reps is null then null else v_reps::text end,null,case when v_set->'failure'='true'::jsonb then true else null end,
        'LTS Health structured manual entry','user_reported',nullif(trim(v_set->>'notes'),''),jsonb_build_object('entry_method','structured_workout_form_v1')
      );
    end loop;
  end loop;

  v_receipt := jsonb_build_object('ok',true,'source_record_id',v_root,'exercise_count',jsonb_array_length(v_exercises),'set_count',v_total_sets);
  update public.health_workouts
  set muscle_groups=v_groups, sets_by_group=v_group_counts,
      raw_exercises=coalesce(v_original,(select string_agg(nullif(trim(x->>'name'),''), E'\n' order by ordinality) from jsonb_array_elements(v_exercises) with ordinality t(x,ordinality))),
      source_payload=source_payload || jsonb_strip_nulls(jsonb_build_object(
        'entry_method',case when v_original is not null then 'workout_text_reviewed' else 'structured_workout_form_v1' end,
        'reported_start_clock',v_clock,'entry_fingerprint',v_fingerprint,'entry_receipt',case when v_entry is not null then v_receipt end))
  where user_id=v_user and source_record_id=v_root;
  return v_receipt;
end;
$function$;

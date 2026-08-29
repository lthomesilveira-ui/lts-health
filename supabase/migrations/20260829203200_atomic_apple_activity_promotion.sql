create or replace function public.health_promote_apple_activity_summary(
  p_source_record_ids text[],
  p_batch_id text default null,
  p_bridge_version text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_source_id text;
  v_row public.health_source_daily_metrics%rowtype;
  v_promoted integer := 0;
  v_blocked integer := 0;
  v_missing integer := 0;
  v_invalid integer := 0;
begin
  if v_user is null then
    raise exception using errcode = '28000', message = 'unauthenticated';
  end if;

  if coalesce(array_length(p_source_record_ids, 1), 0) > 1000 then
    raise exception using errcode = '22023', message = 'too_many_source_records';
  end if;

  foreach v_source_id in array coalesce(p_source_record_ids, array[]::text[]) loop
    select *
      into v_row
      from public.health_source_daily_metrics
     where user_id = v_user
       and source_record_id = v_source_id
     for update;

    if not found then
      v_missing := v_missing + 1;
      continue;
    end if;

    if v_row.source_family <> 'apple_activity_summary'
       or v_row.metric_type not in ('active_energy_kcal','exercise_minutes','stand_hours') then
      v_invalid := v_invalid + 1;
      continue;
    end if;

    if v_row.canonical_status in ('held','superseded') then
      v_blocked := v_blocked + 1;
      continue;
    end if;

    insert into public.health_metrics (
      user_id,
      source_record_id,
      measured_at,
      metric_type,
      value,
      unit,
      source,
      source_file,
      confidence,
      notes,
      source_payload
    ) values (
      v_user,
      'apple_health:' || v_row.metric_type || ':' || v_row.metric_date::text,
      (v_row.metric_date::text || ' 12:00:00+00')::timestamptz,
      v_row.metric_type,
      v_row.value,
      v_row.unit,
      'Apple Health ActivitySummary',
      v_row.source_file,
      v_row.confidence,
      'Métrica diária canônica proveniente do ActivitySummary do Apple Saúde.',
      jsonb_strip_nulls(jsonb_build_object(
        'batch_id', nullif(p_batch_id, ''),
        'bridge_version', nullif(p_bridge_version, ''),
        'method', 'ActivitySummary'
      ))
    )
    on conflict (user_id, source_record_id) do update set
      measured_at = excluded.measured_at,
      metric_type = excluded.metric_type,
      value = excluded.value,
      unit = excluded.unit,
      source = excluded.source,
      source_file = excluded.source_file,
      confidence = excluded.confidence,
      notes = excluded.notes,
      source_payload = excluded.source_payload;

    update public.health_source_daily_metrics
       set canonical_status = 'canonical',
           updated_at = now()
     where id = v_row.id;

    v_promoted := v_promoted + 1;
  end loop;

  return jsonb_build_object(
    'promoted', v_promoted,
    'blocked', v_blocked,
    'missing', v_missing,
    'invalid', v_invalid
  );
end;
$$;

revoke all on function public.health_promote_apple_activity_summary(text[], text, text) from public;
grant execute on function public.health_promote_apple_activity_summary(text[], text, text) to authenticated;

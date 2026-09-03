-- Defense-in-depth for Apple Health XML imports.
-- ActivitySummary is allowed to remain in health_metrics only for the three
-- stable daily metrics, even when the parser identifies the method in
-- source_payload instead of the human-readable source field.
-- All Apple sleep and other noncanonical metrics continue to be routed to
-- health_source_daily_metrics by health_private.route_review_metric_to_source_evidence().

drop trigger if exists health_metrics_route_review_evidence on public.health_metrics;

create trigger health_metrics_route_review_evidence
before insert on public.health_metrics
for each row
when (
  new.metric_type like 'sleep_%'
  or (
    lower(coalesce(new.source,'') || ' ' || coalesce(new.source_file,'')) ~ '(apple|healthkit|iphone)'
    and not (
      (
        lower(coalesce(new.source,'') || ' ' || coalesce(new.source_file,'')) ~ 'activity[ _-]?summary'
        or lower(coalesce(new.source_payload->>'method','')) = 'activitysummary'
      )
      and new.metric_type in ('active_energy_kcal','exercise_minutes','stand_hours')
    )
  )
)
execute function health_private.route_review_metric_to_source_evidence();

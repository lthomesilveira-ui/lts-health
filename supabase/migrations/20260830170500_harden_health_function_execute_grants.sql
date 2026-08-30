-- Least-privilege EXECUTE grants for LTS Health public functions.
-- Client-callable RPCs require an authenticated user session.
-- The trigger function must not be directly callable by client roles.

revoke execute on function public.health_log_structured_workout(jsonb) from public, anon;
revoke execute on function public.health_promote_apple_activity_summary(text[], text, text) from public, anon;
revoke execute on function public.health_source_daily_metrics_preserve_status() from public, anon, authenticated;

grant execute on function public.health_log_structured_workout(jsonb) to authenticated, service_role;
grant execute on function public.health_promote_apple_activity_summary(text[], text, text) to authenticated, service_role;
grant execute on function public.health_source_daily_metrics_preserve_status() to service_role;

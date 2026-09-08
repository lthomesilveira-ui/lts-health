begin;

-- Trigger functions are internal implementation details. Supabase can retain
-- explicit role grants even after the PUBLIC grant is removed, so revoke each
-- exposed API role as a separate hardening migration.
revoke all on function public.health_complete_mfp_water_request()
from public, anon, authenticated, service_role;

commit;

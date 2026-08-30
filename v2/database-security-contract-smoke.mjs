import {readFile} from 'node:fs/promises';

const migration=await readFile('supabase/migrations/20260830170500_harden_health_function_execute_grants.sql','utf8');
const appleSync=await readFile('supabase/functions/health-apple-sync-batch/index.ts','utf8');
const writes=await readFile('v2/src/writes.js','utf8');

const requiredMigrationTokens=[
  'revoke execute on function public.health_log_structured_workout(jsonb) from public, anon;',
  'revoke execute on function public.health_promote_apple_activity_summary(text[], text, text) from public, anon;',
  'revoke execute on function public.health_source_daily_metrics_preserve_status() from public, anon, authenticated;',
  'grant execute on function public.health_log_structured_workout(jsonb) to authenticated, service_role;',
  'grant execute on function public.health_promote_apple_activity_summary(text[], text, text) to authenticated, service_role;',
  'grant execute on function public.health_source_daily_metrics_preserve_status() to service_role;'
];
for(const token of requiredMigrationTokens)if(!migration.includes(token))throw new Error(`least-privilege migration contract missing: ${token}`);

if(/grant\s+execute[\s\S]*\bto\s+(?:public|anon)\b/i.test(migration))throw new Error('health function migration grants EXECUTE to public/anon');
if(/grant\s+execute\s+on\s+function\s+public\.health_source_daily_metrics_preserve_status\(\)\s+to\s+[^;]*authenticated/i.test(migration))throw new Error('trigger function is directly executable by authenticated clients');

for(const token of [
  "Deno.env.get('SUPABASE_ANON_KEY')!",
  '{global:{headers:{Authorization:auth}}',
  "sb.rpc('health_promote_apple_activity_summary'"
])if(!appleSync.includes(token))throw new Error(`Apple sync authenticated-RPC contract missing: ${token}`);
if(/SUPABASE_SERVICE_ROLE_KEY/.test(appleSync))throw new Error('Apple client sync silently switched to service-role credentials');

for(const token of [
  'requiredSession();',
  "sb.rpc('health_log_structured_workout'"
])if(!writes.includes(token))throw new Error(`structured workout authenticated-RPC contract missing: ${token}`);

console.log('LTS Health database function EXECUTE least-privilege contract passed');

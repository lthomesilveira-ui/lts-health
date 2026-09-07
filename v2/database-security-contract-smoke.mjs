import {readFile} from 'node:fs/promises';

const migration=await readFile('supabase/migrations/20260830170500_harden_health_function_execute_grants.sql','utf8');
const workoutIntegrity=await readFile('supabase/migrations/20260906213500_enforce_workout_parent_integrity.sql','utf8');
const workoutParentChain=await readFile('supabase/migrations/20260906222500_enforce_workout_set_parent_chain.sql','utf8');
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

const requiredParentIntegrityTokens=[
  'alter column workout_source_record_id set not null',
  'alter column exercise_source_record_id set not null',
  'constraint health_workout_exercises_workout_fk',
  'constraint health_workout_sets_workout_fk',
  'constraint health_workout_sets_exercise_fk',
  'references public.health_workouts(user_id, source_record_id)',
  'references public.health_workout_exercises(user_id, source_record_id)'
];
for(const token of requiredParentIntegrityTokens)if(!workoutIntegrity.includes(token))throw new Error(`workout parent-integrity contract missing: ${token}`);
if((workoutIntegrity.match(/foreign key \(user_id, workout_source_record_id\)/g)||[]).length!==2)throw new Error('workout parent-integrity contract must protect exercise and set workout parents');
if((workoutIntegrity.match(/on delete cascade/g)||[]).length!==3)throw new Error('workout parent-integrity contract must cascade all three parent relations');

for(const token of [
  'constraint health_workout_exercises_user_workout_source_record_key',
  'unique (user_id, workout_source_record_id, source_record_id)',
  'drop constraint health_workout_sets_exercise_fk',
  'foreign key (user_id, workout_source_record_id, exercise_source_record_id)',
  'references public.health_workout_exercises(user_id, workout_source_record_id, source_record_id)',
  'on delete cascade'
])if(!workoutParentChain.includes(token))throw new Error(`workout set parent-chain contract missing: ${token}`);
if((workoutParentChain.match(/health_workout_sets_exercise_fk/g)||[]).length!==2)throw new Error('workout set parent-chain migration must replace the exercise FK exactly once');

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

console.log('LTS Health database security and workout parent-chain integrity contract passed');

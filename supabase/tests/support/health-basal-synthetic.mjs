// Minimal synthetic dependencies only. This is NOT a production rebuild script.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const migrations=new URL('../../migrations/',import.meta.url);
const read=name=>readFileSync(new URL(name,migrations),'utf8');
const names=readdirSync(migrations).filter(name=>name.endsWith('_capture_unverified_basal_candidates.sql'));
assert.equal(names.length,1,'Exactly one CLI-generated basal capture migration required');
export const basalMigrationPath=new URL(names[0],migrations);
export const basalMigrationSql=read(names[0]);
export const syntheticOwner='11111111-1111-4111-8111-111111111111';
export const syntheticOtherOwner='22222222-2222-4222-8222-222222222222';
export const syntheticKeyHash='a'.repeat(64);
export const syntheticOtherKeyHash='b'.repeat(64);
export const syntheticBaseSql=readFileSync(new URL('../fixtures/health-basal-candidates-synthetic.sql',import.meta.url),'utf8')+
  read('20260829190410_add_source_daily_metrics_for_apple_bridge.sql')+`
  ALTER TABLE public.health_source_daily_metrics ADD CONSTRAINT health_source_daily_metrics_current_canonical_boundary CHECK(true);
  GRANT SELECT,INSERT,UPDATE,DELETE ON public.health_source_daily_metrics,public.health_daily_nutrition TO service_role;
  `+read('20261004194659_health_auto_export_bridge.sql')+read('20261004195418_allow_authenticated_auto_export_nutrition.sql');
export const syntheticConnectionSql=`INSERT INTO public.health_auto_export_connections(user_id,key_hash) VALUES ('${syntheticOwner}','${syntheticKeyHash}'),('${syntheticOtherOwner}','${syntheticOtherKeyHash}');`;
export const syntheticSetupSql=syntheticBaseSql+'\nBEGIN;\n'+basalMigrationSql+'\nCOMMIT;\n'+syntheticConnectionSql;

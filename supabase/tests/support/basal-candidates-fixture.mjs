import { syntheticBaseSql, basalMigrationSql } from './health-basal-synthetic.mjs';

// Caller MUST guard its connection and require an empty disposable PostgreSQL
// database before executing this destructive synthetic dependency fixture.
export function buildBasalSyntheticBootstrapSql() {
  return syntheticBaseSql+'\nBEGIN;\n'+basalMigrationSql+'\nCOMMIT;\n';
}

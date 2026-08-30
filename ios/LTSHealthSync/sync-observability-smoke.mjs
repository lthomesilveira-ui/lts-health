import { readFile } from 'node:fs/promises';

const [diagnostics,health,appModel,contentView] = await Promise.all([
  readFile('ios/LTSHealthSync/Sources/SyncDiagnostics.swift','utf8'),
  readFile('ios/LTSHealthSync/Sources/HealthKitSyncCoordinator.swift','utf8'),
  readFile('ios/LTSHealthSync/Sources/AppModel.swift','utf8'),
  readFile('ios/LTSHealthSync/Sources/ContentView.swift','utf8')
]);

for (const token of [
  'lastAttemptAt',
  'lastSuccessAt',
  'lastResult',
  'recordAttempt',
  'recordSuccess',
  'recordFailure',
  'LTSHealthSyncDiagnosticsChanged'
]) if (!diagnostics.includes(token)) throw new Error(`sync diagnostics contract missing: ${token}`);

for (const forbidden of ['source_payload','accessToken','refreshToken','metric_type','value:']) {
  if (diagnostics.includes(forbidden)) throw new Error(`sync diagnostics must not persist health/auth payload detail: ${forbidden}`);
}

for (const token of [
  'SyncDiagnostics.recordAttempt(.primary)',
  'SyncDiagnostics.recordSuccess(.primary)',
  'SyncDiagnostics.recordFailure(.primary)',
  'guard await backgroundSyncGate.begin() else { return }',
  'await backgroundSyncGate.end()'
]) if (!health.includes(token)) throw new Error(`background observability missing: ${token}`);

for (const token of [
  '@Published var lastSourceSyncCompleted = true',
  '@Published var backgroundPrimaryAttemptAt: Date?',
  '@Published var backgroundPrimarySuccessAt: Date?',
  '@Published var backgroundPrimarySucceeded: Bool?',
  'leitura por origem não concluída',
  'sourceCompleted: false',
  'lastSourceSyncCompleted',
  'SyncDiagnostics.snapshot(.primary)',
  'func refreshDiagnostics()'
]) if (!appModel.includes(token)) throw new Error(`AppModel observability contract missing: ${token}`);

for (const token of [
  'Section("Atualização automática")',
  'Última tentativa',
  'Último sucesso automático',
  'não armazena valores de saúde nem conteúdo dos registros',
  'SyncDiagnostics.changedNotification',
  'model.refreshDiagnostics()'
]) if (!contentView.includes(token)) throw new Error(`iOS observability UI missing: ${token}`);

if (/source_payload|accessToken|refreshToken/i.test(contentView)) throw new Error('technical/private payload detail leaked into iOS observability UI');

console.log('LTS Health iOS sync observability contract passed');

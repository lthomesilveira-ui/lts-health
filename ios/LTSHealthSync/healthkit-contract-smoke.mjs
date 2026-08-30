import { readFile } from 'node:fs/promises';

const [project,info,entitlements,api,health,candidates,appModel,contentView,appDelegate,readme,workflow] = await Promise.all([
  readFile('ios/LTSHealthSync/project.yml','utf8'),
  readFile('ios/LTSHealthSync/Resources/Info.plist','utf8'),
  readFile('ios/LTSHealthSync/Resources/LTSHealthSync.entitlements','utf8'),
  readFile('ios/LTSHealthSync/Sources/SupabaseAPI.swift','utf8'),
  readFile('ios/LTSHealthSync/Sources/HealthKitSyncCoordinator.swift','utf8'),
  readFile('ios/LTSHealthSync/Sources/CandidateHealthMetricsCoordinator.swift','utf8'),
  readFile('ios/LTSHealthSync/Sources/AppModel.swift','utf8'),
  readFile('ios/LTSHealthSync/Sources/ContentView.swift','utf8'),
  readFile('ios/LTSHealthSync/Sources/AppDelegate.swift','utf8'),
  readFile('ios/LTSHealthSync/README.md','utf8'),
  readFile('.github/workflows/ios-healthkit-build.yml','utf8')
]);

for (const token of [
  'com.apple.developer.healthkit',
  'com.apple.developer.healthkit.background-delivery'
]) if (!entitlements.includes(token)) throw new Error(`HealthKit entitlement missing: ${token}`);

if (!info.includes('NSHealthShareUsageDescription')) throw new Error('HealthKit read privacy usage description missing');
if (/service[_-]?role/i.test(api)) throw new Error('service-role material must never enter the iOS client');
if (!api.includes('sb_publishable_')) throw new Error('iOS client must use the public Supabase key family');
if (!api.includes('KeychainStore.shared')) throw new Error('Supabase session is not backed by Keychain');
if (!api.includes('functions/v1/health-apple-sync-batch')) throw new Error('Apple sync endpoint drifted');
if (!api.includes('Bearer \\(accessToken)')) throw new Error('Apple batch request must use the user JWT');

for (const token of [
  'HKActivitySummaryQuery',
  'HKObserverQuery',
  'HKAnchoredObjectQuery',
  'enableBackgroundDelivery',
  'frequency: .hourly',
  'activitySummaryType()',
  'active_energy_kcal',
  'exercise_minutes',
  'stand_hours',
  'source_family: family',
  'apple_activity_summary',
  'private let anchorBatchSize = 500',
  'private let anchorMaxBatches = 40',
  'private let anchorLookbackDays = 14',
  'healthkit.anchor.start',
  'HKQuery.predicateForSamples(',
  'limit: anchorBatchSize',
  'let changed = try await advanceAnchor(for: type)',
  'private let backgroundSyncGate = BackgroundSyncGate()',
  'private actor BackgroundSyncGate',
  'guard await backgroundSyncGate.begin() else { return }',
  'await backgroundSyncGate.end()',
  'private func primeAnchors() async throws -> Bool',
  'let changed = try await self.primeAnchors()',
  'if changed { await self.syncRecentIfAuthenticated() }'
]) if (!health.includes(token)) throw new Error(`HealthKit sync contract missing: ${token}`);

if (health.includes('HKObjectQueryNoLimit')) throw new Error('HealthKit anchor query must not materialize unbounded history');
for (const metric of ['steps','oxygen_saturation_pct','resting_heart_rate_bpm','sleep_duration_h','dietary_energy_kcal','dietary_protein_g','dietary_carbs_g','dietary_fat_g','dietary_fiber_g']) {
  const canonicalPayloadPattern = new RegExp(`metric_type:\\s*"${metric}"`);
  if (canonicalPayloadPattern.test(health)) throw new Error(`${metric} must not be emitted by the canonical ActivitySummary client`);
}

for (const token of [
  'HKStatisticsCollectionQuery',
  '.separateBySource',
  'metricType: "steps"',
  'metricType: "resting_heart_rate_bpm"',
  'metricType: "hrv_sdnn_ms"',
  'metricType: "respiratory_rate_bpm"',
  'metricType: "weight_kg"',
  'identifier: .dietaryEnergyConsumed',
  'metricType: "dietary_energy_kcal"',
  'identifier: .dietaryProtein',
  'metricType: "dietary_protein_g"',
  'identifier: .dietaryCarbohydrates',
  'metricType: "dietary_carbs_g"',
  'identifier: .dietaryFatTotal',
  'metricType: "dietary_fat_g"',
  'identifier: .dietaryFiber',
  'metricType: "dietary_fiber_g"',
  'unit: .kilocalorie()',
  'unit: .gram()',
  'options: [.cumulativeSum, .separateBySource]',
  'HKObjectType.categoryType(forIdentifier: .sleepAnalysis)',
  'HKSampleQuery(',
  'HKCategoryValueSleepAnalysis.asleepCore.rawValue',
  'HKCategoryValueSleepAnalysis.asleepDeep.rawValue',
  'HKCategoryValueSleepAnalysis.asleepREM.rawValue',
  'HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue',
  'metric_type: "sleep_duration_h"',
  'private func mergedDuration(',
  'interval.start <= current.end',
  'source_name: key.sourceName',
  'source_family: sourceFamily(for: key.sourceName)',
  'return "myfitnesspal"',
  'return "ringconn"',
  'return "polar_flow"',
  'return "apple_watch"',
  'return "iphone"',
  'return "healthkit_candidate"',
  'ios-healthkit-candidates-v3',
  'frequency: .hourly'
]) if (!candidates.includes(token)) throw new Error(`Candidate HealthKit contract missing: ${token}`);

if (candidates.includes('apple_activity_summary')) throw new Error('Candidate coordinator must never emit the canonical ActivitySummary family');
if (candidates.includes('oxygen_saturation_pct')) throw new Error('Oxygen saturation remains outside candidate v3 until dedicated validation');
if (!health.includes('HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)')) throw new Error('active energy observer trigger missing');
if (!health.includes('HKObjectType.quantityType(forIdentifier: .appleExerciseTime)')) throw new Error('exercise-time observer trigger missing');
if (!health.includes('HKObjectType.quantityType(forIdentifier: .appleStandTime)')) throw new Error('stand-time observer trigger missing');
if (!health.includes('requiringSecureCoding: true')) throw new Error('HealthKit anchors must use secure coding');
if (!appDelegate.includes('HealthKitSyncCoordinator.shared.startObserversIfConfigured()') || !appDelegate.includes('CandidateHealthMetricsCoordinator.shared.startObserversIfConfigured()')) throw new Error('core and candidate background observers are not bootstrapped on launch');

for (const token of [
  '@Published var healthConfigured = false',
  '@Published var sourceSyncConfigured = false',
  'lastSuccessfulSyncAt',
  'lastPrimarySyncCount',
  'lastSourceSyncCount',
  'lastReviewSyncCount',
  'recordSuccessfulSync(primary:',
  'kind: .warning',
  'candidateHealth.initialSync(days: 365)',
  'candidateHealth.recentSync(days: 7)'
]) if (!appModel.includes(token)) throw new Error(`iOS activation/status contract missing: ${token}`);

for (const token of [
  'Section("Preparação")',
  'Apple Saúde configurado',
  'Leitura por origem configurada',
  'Atualização em segundo plano preparada',
  'Último sucesso',
  'Sincronizar agora',
  'MyFitnessPal compartilha alimentação com o Apple Saúde',
  'Sono compatível também fica preservado por origem',
  'fontes diferentes não são somadas entre si automaticamente'
]) if (!contentView.includes(token)) throw new Error(`iOS activation UI missing: ${token}`);

if (/canônic|candidat/i.test(contentView)) throw new Error('technical canonical/candidate jargon must not be shown in the iOS activation UI');
if (!project.includes('platform: iOS') || !project.includes('iOS: "17.0"')) throw new Error('iOS project target contract drifted');
for (const token of [
  'A etapa final de conectividade precisa de um iPhone físico',
  'autorização HealthKit',
  'background delivery',
  'TestFlight exige uma conta Apple Developer/App Store Connect configurada'
]) if (!readme.includes(token)) throw new Error(`physical-device activation documentation missing: ${token}`);
for (const token of [
  '-sdk iphonesimulator',
  '-sdk iphoneos',
  'Archive unsigned iPhone app',
  '-archivePath "$RUNNER_TEMP/LTSHealthSync.xcarchive"',
  'CODE_SIGNING_ALLOWED=NO',
  'actions/upload-artifact@v4',
  'LTSHealthSync-unsigned-xcarchive'
]) if (!workflow.includes(token)) throw new Error(`iOS build/archive workflow missing: ${token}`);

console.log('LTS Health iOS HealthKit contract smoke passed');

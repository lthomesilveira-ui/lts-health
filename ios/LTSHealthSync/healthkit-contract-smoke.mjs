import { readFile } from 'node:fs/promises';

const [project,info,entitlements,api,health,candidates,appDelegate,readme,workflow] = await Promise.all([
  readFile('ios/LTSHealthSync/project.yml','utf8'),
  readFile('ios/LTSHealthSync/Resources/Info.plist','utf8'),
  readFile('ios/LTSHealthSync/Resources/LTSHealthSync.entitlements','utf8'),
  readFile('ios/LTSHealthSync/Sources/SupabaseAPI.swift','utf8'),
  readFile('ios/LTSHealthSync/Sources/HealthKitSyncCoordinator.swift','utf8'),
  readFile('ios/LTSHealthSync/Sources/CandidateHealthMetricsCoordinator.swift','utf8'),
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
for (const metric of ['steps','oxygen_saturation_pct','resting_heart_rate_bpm','sleep_duration_h']) {
  const canonicalPayloadPattern = new RegExp(`metric_type:\\s*"${metric}"`);
  if (canonicalPayloadPattern.test(health)) throw new Error(`${metric} must not be emitted by the v1 canonical ActivitySummary client`);
}

for (const token of [
  'HKStatisticsCollectionQuery',
  '.separateBySource',
  'metricType: "steps"',
  'metricType: "resting_heart_rate_bpm"',
  'metricType: "hrv_sdnn_ms"',
  'metricType: "respiratory_rate_bpm"',
  'metricType: "weight_kg"',
  'source_name: source.name',
  'source_family: self.sourceFamily(for: source.name)',
  'return "polar_flow"',
  'return "apple_watch"',
  'return "iphone"',
  'return "healthkit_candidate"',
  'ios-healthkit-candidates-v1',
  'frequency: .hourly'
]) if (!candidates.includes(token)) throw new Error(`Candidate HealthKit contract missing: ${token}`);

if (candidates.includes('apple_activity_summary')) throw new Error('Candidate coordinator must never emit the canonical ActivitySummary family');
if (candidates.includes('sleep_duration_h') || candidates.includes('oxygen_saturation_pct')) throw new Error('Sleep/oxygen remain outside candidate v1 until dedicated aggregation validation');
if (!health.includes('HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)')) throw new Error('active energy observer trigger missing');
if (!health.includes('HKObjectType.quantityType(forIdentifier: .appleExerciseTime)')) throw new Error('exercise-time observer trigger missing');
if (!health.includes('HKObjectType.quantityType(forIdentifier: .appleStandTime)')) throw new Error('stand-time observer trigger missing');
if (!health.includes('requiringSecureCoding: true')) throw new Error('HealthKit anchors must use secure coding');
if (!appDelegate.includes('HealthKitSyncCoordinator.shared.startObserversIfConfigured()') || !appDelegate.includes('CandidateHealthMetricsCoordinator.shared.startObserversIfConfigured()')) throw new Error('core and candidate background observers are not bootstrapped on launch');
if (!project.includes('platform: iOS') || !project.includes('iOS: "17.0"')) throw new Error('iOS project target contract drifted');
if (!readme.includes('teste precisa ser feito em iPhone físico')) throw new Error('device-only background-delivery limitation is not documented');
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

import { readFile } from 'node:fs/promises';

const [project,info,entitlements,api,health,appDelegate,readme] = await Promise.all([
  readFile('ios/LTSHealthSync/project.yml','utf8'),
  readFile('ios/LTSHealthSync/Resources/Info.plist','utf8'),
  readFile('ios/LTSHealthSync/Resources/LTSHealthSync.entitlements','utf8'),
  readFile('ios/LTSHealthSync/Sources/SupabaseAPI.swift','utf8'),
  readFile('ios/LTSHealthSync/Sources/HealthKitSyncCoordinator.swift','utf8'),
  readFile('ios/LTSHealthSync/Sources/AppDelegate.swift','utf8'),
  readFile('ios/LTSHealthSync/README.md','utf8')
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
  'guard changed, await api.hasSession else { return }',
  'try await primeAnchors()'
]) if (!health.includes(token)) throw new Error(`HealthKit sync contract missing: ${token}`);

if (health.includes('HKObjectQueryNoLimit')) throw new Error('HealthKit anchor query must not materialize unbounded history');
for (const metric of ['steps','oxygen_saturation_pct','resting_heart_rate_bpm','sleep_duration_h']) {
  const canonicalPayloadPattern = new RegExp(`metric_type:\\s*"${metric}"`);
  if (canonicalPayloadPattern.test(health)) throw new Error(`${metric} must not be emitted by the v1 canonical ActivitySummary client`);
}

if (!health.includes('HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)')) throw new Error('active energy observer trigger missing');
if (!health.includes('HKObjectType.quantityType(forIdentifier: .appleExerciseTime)')) throw new Error('exercise-time observer trigger missing');
if (!health.includes('HKObjectType.quantityType(forIdentifier: .appleStandTime)')) throw new Error('stand-time observer trigger missing');
if (!health.includes('requiringSecureCoding: true')) throw new Error('HealthKit anchors must use secure coding');
if (!appDelegate.includes('didFinishLaunchingWithOptions') || !appDelegate.includes('startObserversIfConfigured')) throw new Error('background observers are not bootstrapped on launch');
if (!project.includes('platform: iOS') || !project.includes('iOS: "17.0"')) throw new Error('iOS project target contract drifted');
if (!readme.includes('teste precisa ser feito em iPhone físico')) throw new Error('device-only background-delivery limitation is not documented');

console.log('LTS Health iOS HealthKit contract smoke passed');

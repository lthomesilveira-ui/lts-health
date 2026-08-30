import { readFile } from 'node:fs/promises';

const [workflow,buildWorkflow,info,entitlements,signingDoc] = await Promise.all([
  readFile('.github/workflows/ios-healthkit-sign.yml','utf8'),
  readFile('.github/workflows/ios-healthkit-build.yml','utf8'),
  readFile('ios/LTSHealthSync/Resources/Info.plist','utf8'),
  readFile('ios/LTSHealthSync/Resources/LTSHealthSync.entitlements','utf8'),
  readFile('ios/LTSHealthSync/SIGNING.md','utf8')
]);

for (const token of [
  'workflow_dispatch:',
  'APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}',
  'APPLE_CERTIFICATE_P12_BASE64: ${{ secrets.APPLE_CERTIFICATE_P12_BASE64 }}',
  'APPLE_PROVISIONING_PROFILE_BASE64: ${{ secrets.APPLE_PROVISIONING_PROFILE_BASE64 }}',
  'APP_STORE_CONNECT_PRIVATE_KEY_BASE64: ${{ secrets.APP_STORE_CONNECT_PRIVATE_KEY_BASE64 }}',
  'LTS_BUNDLE_ID: com.ltshealth.sync',
  'Verify required signing material',
  'security find-identity -v -p codesigning',
  'Install and validate provisioning profile',
  'Provisioning profile bundle id mismatch',
  'Provisioning profile team mismatch',
  'Provisioning profile is missing HealthKit',
  'Provisioning profile is missing HealthKit background delivery',
  'BUILD_NUMBER="${GITHUB_RUN_NUMBER}.${GITHUB_RUN_ATTEMPT}"',
  'CURRENT_PROJECT_VERSION="$BUILD_NUMBER"',
  'CODE_SIGN_STYLE=Manual',
  'CODE_SIGN_IDENTITY="Apple Distribution"',
  'PROVISIONING_PROFILE_SPECIFIER=',
  '<key>signingStyle</key><string>manual</string>',
  '<key>signingCertificate</key><string>Apple Distribution</string>',
  '<key>provisioningProfiles</key><dict>',
  '<key>${LTS_BUNDLE_ID}</key><string>${{ steps.profile.outputs.name }}</string>',
  'Verify signed IPA contract',
  'codesign --verify --deep --strict',
  'Signed IPA bundle id mismatch',
  'Signed IPA build number mismatch',
  'Signed IPA missing HealthKit entitlement',
  'Signed IPA missing HealthKit background delivery entitlement',
  'embedded.mobileprovision',
  'actions/upload-artifact@v4',
  'LTSHealthSync-signed-ipa',
  'Validate TestFlight package',
  'xcrun altool --validate-app',
  'Upload to TestFlight',
  'xcrun altool --upload-app'
]) {
  if (!workflow.includes(token)) throw new Error(`Signing contract missing: ${token}`);
}

if (/\bon:\s*\n\s*push:/m.test(workflow)) throw new Error('Signed distribution must never run automatically on push');
if (/BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/.test(workflow)) throw new Error('Private key material must never be committed');
if (/MII[A-Za-z0-9+/=]{80,}/.test(workflow)) throw new Error('Certificate material must never be committed');
if (/APPLE_CERTIFICATE_PASSWORD:\s*(?!\$\{\{\s*secrets\.)\S+/.test(workflow)) throw new Error('Certificate password must come from GitHub secrets');
if (workflow.indexOf('Validate TestFlight package') > workflow.indexOf('Upload to TestFlight')) throw new Error('TestFlight package must be validated before upload');

for (const token of [
  "- '.github/workflows/ios-healthkit-sign.yml'",
  'node ios/LTSHealthSync/signing-contract-smoke.mjs'
]) if (!buildWorkflow.includes(token)) throw new Error(`Unsigned CI does not gate signing readiness: ${token}`);

if (!info.includes('NSHealthShareUsageDescription')) throw new Error('HealthKit read purpose string missing');
if (!info.includes('dados de saúde e atividade que você autorizar')) throw new Error('HealthKit purpose string no longer matches the read scope');
for (const token of ['com.apple.developer.healthkit','com.apple.developer.healthkit.background-delivery']) if (!entitlements.includes(token)) throw new Error(`HealthKit entitlement missing: ${token}`);

for (const token of [
  'App ID explícito `com.ltshealth.sync`',
  'registro do app no App Store Connect',
  'build number único por execução/tentativa',
  'valida o IPA assinado antes de publicá-lo como artefato',
  'Nenhum segredo deve ser salvo no repositório'
]) if (!signingDoc.includes(token)) throw new Error(`Signing readiness documentation missing: ${token}`);

console.log('LTS Health iOS signed distribution readiness contract passed');

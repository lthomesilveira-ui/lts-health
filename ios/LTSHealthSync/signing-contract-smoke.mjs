import { readFile } from 'node:fs/promises';

const workflow = await readFile('.github/workflows/ios-healthkit-sign.yml','utf8');

for (const token of [
  'workflow_dispatch:',
  'APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}',
  'APPLE_CERTIFICATE_P12_BASE64: ${{ secrets.APPLE_CERTIFICATE_P12_BASE64 }}',
  'APPLE_PROVISIONING_PROFILE_BASE64: ${{ secrets.APPLE_PROVISIONING_PROFILE_BASE64 }}',
  'APP_STORE_CONNECT_PRIVATE_KEY_BASE64: ${{ secrets.APP_STORE_CONNECT_PRIVATE_KEY_BASE64 }}',
  'CODE_SIGN_STYLE=Manual',
  'PROVISIONING_PROFILE_SPECIFIER=',
  'actions/upload-artifact@v4',
  'LTSHealthSync-signed-ipa',
  'Upload to TestFlight'
]) {
  if (!workflow.includes(token)) throw new Error(`Signing contract missing: ${token}`);
}

if (/\bon:\s*\n\s*push:/m.test(workflow)) throw new Error('Signed distribution must never run automatically on push');
if (/BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/.test(workflow)) throw new Error('Private key material must never be committed');
if (/MII[A-Za-z0-9+/=]{80,}/.test(workflow)) throw new Error('Certificate material must never be committed');
if (/APPLE_CERTIFICATE_PASSWORD:\s*(?!\$\{\{\s*secrets\.)\S+/.test(workflow)) throw new Error('Certificate password must come from GitHub secrets');
if (!workflow.includes('Verify required signing material')) throw new Error('Signing workflow needs an explicit credentials gate');

console.log('LTS Health iOS signing contract smoke passed');

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {generateKeyPairSync,privateDecrypt,createDecipheriv,constants} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {validateChannelComparison,sealChannelEvidence} from './google-health-channel-auth.mjs';
const range={from:'2030-02-05',to:'2030-02-12'};
const probe=channel=>({channel,status:'ok',observations:1,positive_observations:1,zero_observations:0,undated_observations:0,source_identified_positive_observations:1,first_day:'2030-02-11',last_day:'2030-02-11',truncated:false});
const result=()=>({connected:true,inspected:true,mode:'read_only',bounded:true,experimental_channel_evaluation:true,data_type:'hydration-log',from:range.from,to_exclusive:range.to,max_points_per_channel:100,canonical_updated:false,water_received:false,probes:[probe('v4'),probe('v4beta')]});
test('the actual-data validator requires complete, internally consistent bounded summaries',()=>{
  assert.equal(validateChannelComparison(result(),range).probes.length,2);
  for(const change of [r=>{r.canonical_updated=true;},r=>{r.probes[1].positive_observations=0;},r=>{r.probes[1].amount=123;},r=>{r.probes[0].first_day='2030-01-01';},r=>{r.probes.reverse();},r=>{r.max_points_per_channel=101;},r=>{r.probes[0].truncated='false';}]){
    const r=result();change(r);assert.throws(()=>validateChannelComparison(r,range),/channel_diagnostic_incomplete/);
  }
  const r=result();r.probes[1]={channel:'v4beta',status:'unavailable',error_code:'permission_denied'};assert.equal(validateChannelComparison(r,range).probes[1].status,'unavailable');
});
test('private diagnostics round-trip only through the existing owner evidence public key envelope',()=>{
  const keys=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
  const payload={private_canary:'invented-private-evidence-only',comparison:result()},envelope=sealChannelEvidence(payload,keys.publicKey);
  assert.ok(!JSON.stringify(envelope).includes('invented-private-evidence-only'));
  const key=privateDecrypt({key:keys.privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(envelope.wrapped_key,'base64'));
  const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));decipher.setAAD(Buffer.from(envelope.file));decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
  assert.deepEqual(JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64')),decipher.final()])),payload);key.fill(0);
});
test('the one-time evaluation has no cron, frontend or normal-push activation and keeps existing auth tests',()=>{
  const source=readFileSync(new URL('../.github/workflows/real-auth-e2e.yml',import.meta.url),'utf8');
  const steps=source.split(/\n      - name: /).filter(x=>x.startsWith('Obtain one-time channel comparison token hash')||x.startsWith('Run the expressly requested one-time channel evaluation'));
  assert.equal(steps.length,2);
  for(const step of steps)assert.match(step,/github.event_name == 'push'.*github.ref == 'refs\/heads\/main'.*\[health-water-channel-read\]/);
  assert.match(source,/run: node v2\/real-auth-e2e.mjs/);assert.match(source,/run: node v2\/real-auth-labs-visual.mjs/);
  assert.match(source,/path: v2\/real-auth-encrypted\/\*\.sealed.json/);
});

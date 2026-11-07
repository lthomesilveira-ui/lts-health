import assert from 'node:assert/strict';
import {test} from 'node:test';
import {resolveGoogleHealthServerConfig as resolve} from '../supabase/functions/_shared/google-health-config.mjs';

const base={url:'https://abcdefghijklmnopqrst.supabase.co',publicKey:'synthetic-public',serviceKey:'synthetic-server',enabled:false,clientId:'123456-synthetic.apps.googleusercontent.com',clientSecret:'synthetic-only',encryptionKey:btoa('e'.repeat(32))};
const key=btoa('v'.repeat(32));
test('an explicitly enabled private Vault configuration overrides an unused environment key',async()=>{
  const result=await resolve(base,async()=>[{enabled:true,token_encryption_key:key}]);
  assert.equal(result.enabled,true);assert.equal(result.encryptionKey,key);
  assert.equal(result.clientId,base.clientId);assert.equal(result.clientSecret,base.clientSecret);
  assert.equal(base.enabled,false);assert.notEqual(base.encryptionKey,key);
});
test('an explicit environment off switch prevents any private lookup',async()=>{
  let reads=0;const result=await resolve({...base,enabled:true,disabledByEnv:true},async()=>{reads++;return [{enabled:true,token_encryption_key:key}];});
  assert.equal(reads,0);assert.equal(result.enabled,false);assert.equal(result.encryptionKey,null);
});
test('Vault disable, failed/aborted reads and malformed configuration fail closed instead of reverting to an environment key',async()=>{
  const active={...base,enabled:true};
  for(const rows of [null,{},[null],[{enabled:'true',token_encryption_key:key}],[{enabled:false,token_encryption_key:null}],[{enabled:true,token_encryption_key:'invalid'}],[{enabled:true,token_encryption_key:key,other:'unexpected'}],[{enabled:true,token_encryption_key:key},{enabled:true,token_encryption_key:key}]]){
    const result=await resolve(active,async()=>rows);assert.equal(result.enabled,false);assert.equal(result.encryptionKey,null);
  }
  for(const error of [Error('synthetic DB failure'),new DOMException('synthetic timeout','TimeoutError')]){
    const result=await resolve(active,async()=>{throw error;});assert.equal(result.enabled,false);assert.equal(result.encryptionKey,null);
  }
});
test('absence of a Vault activation preserves a separately configured legacy environment and cannot activate an unset one',async()=>{
  assert.equal((await resolve(base,async()=>[])).enabled,false);
  assert.deepEqual(await resolve({...base,enabled:true},async()=>[]),{...base,enabled:true});
});

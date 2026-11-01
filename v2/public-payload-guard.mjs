import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const repositoryRoot=fileURLToPath(new URL('../',import.meta.url));
const blockedExtensions=new Set(['.zip','.pdf','.csv','.json']);
// Exact reviewed dependency metadata, not a general JSON or package-file exemption.
// Any byte change (including duplicate JSON keys) requires deliberate review.
const dependencyMetadataHashes=new Map([
  ['supabase/tests/runtime/package.json','d4b36c755044a44eb203023e810b4f797f0489ea6a568c6cb2d36a6010336270'],
  ['supabase/tests/runtime/package-lock.json','4c5b15cd25bff4c0c73155fbe8a535c500c77ae3d464696c41026e193f863bc7']
]);
const allowedMetadataFiles=new Set(['v2/EXECUTION_STATE.json',...dependencyMetadataHashes.keys()]);
const ignoredDirectories=new Set(['.git','node_modules']);

async function listFiles(directory,relative=''){
  const entries=await fs.readdir(directory,{withFileTypes:true});
  const files=[];
  for(const entry of entries){
    if(entry.isDirectory()&&ignoredDirectories.has(entry.name))continue;
    const relativePath=path.posix.join(relative,entry.name);
    const absolutePath=path.join(directory,entry.name);
    if(entry.isDirectory())files.push(...await listFiles(absolutePath,relativePath));
    else if(entry.isFile())files.push(relativePath);
  }
  return files;
}

const files=await listFiles(repositoryRoot);
const blocked=files.filter(file=>blockedExtensions.has(path.extname(file).toLowerCase())&&!allowedMetadataFiles.has(file));
assert.deepEqual(blocked,[],`private payload-like files found: ${blocked.join(', ')}`);

for(const [file,expectedHash] of dependencyMetadataHashes){
  const raw=await fs.readFile(path.join(repositoryRoot,file),'utf8');
  assert.equal(createHash('sha256').update(raw).digest('hex'),expectedHash,`unreviewed dependency metadata: ${file}`);
  const metadata=JSON.parse(raw);
  if(file.endsWith('/package.json'))assert.deepEqual(metadata,{name:'health-basal-candidate-integration-runtime',private:true,type:'module',dependencies:{'@supabase/supabase-js':'2.117.2'}});
  else{
    assert.deepEqual(Object.keys(metadata).sort(),['lockfileVersion','name','packages','requires']);
    assert.equal(metadata.name,'health-basal-candidate-integration-runtime');
    assert.equal(metadata.lockfileVersion,3);assert.equal(metadata.requires,true);
    assert.deepEqual(metadata.packages[''],{name:'health-basal-candidate-integration-runtime',dependencies:{'@supabase/supabase-js':'2.117.2'}});
  }
}

const rawState=await fs.readFile(path.join(repositoryRoot,'v2/EXECUTION_STATE.json'),'utf8');
const state=JSON.parse(rawState);
assert.equal(state.scope,'public_project_metadata_only','execution state must remain public metadata only');
assert.equal(state.execution_policy?.public_health_data_allowed,false,'public health payloads must remain disabled');

for(const payloadKey of ['milliliters','weight_kg','body_fat_percentage','lab_value','result_value','date_of_birth']){
  assert.ok(!Object.hasOwn(state,payloadKey),`execution state contains payload key ${payloadKey}`);
}

console.log('LTS Health public payload guard passed');

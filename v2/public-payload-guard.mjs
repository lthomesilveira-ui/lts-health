import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot=fileURLToPath(new URL('../',import.meta.url));
const blockedExtensions=new Set(['.zip','.pdf','.csv','.json']);
const allowedMetadataFiles=new Set(['v2/EXECUTION_STATE.json']);
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

const rawState=await fs.readFile(path.join(repositoryRoot,'v2/EXECUTION_STATE.json'),'utf8');
const state=JSON.parse(rawState);
assert.equal(state.scope,'public_project_metadata_only','execution state must remain public metadata only');
assert.equal(state.execution_policy?.public_health_data_allowed,false,'public health payloads must remain disabled');

for(const payloadKey of ['milliliters','weight_kg','body_fat_percentage','lab_value','result_value','date_of_birth']){
  assert.ok(!Object.hasOwn(state,payloadKey),`execution state contains payload key ${payloadKey}`);
}

console.log('LTS Health public payload guard passed');

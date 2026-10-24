import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./',import.meta.url)),preview=path.resolve(root,'../preview/compact-evidence');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.match(html,/<title>LTS Health<\/title>/);
assert.match(html,/health-integrated-20261024\.76/);
assert.doesNotMatch(html,/preview-readonly|lts-preview|Prévia/);
assert.match(fs.readFileSync(path.resolve(root,'../index.html'),'utf8'),/\.\/v2\//);
for(const [,link] of html.matchAll(/(?:href|src)="(\.[^"]+)"/g)){
 const target=path.resolve(root,link.split('?')[0]);assert.ok(target.startsWith(root)&&fs.existsSync(target),'entry dependency is local and exists '+link);
}
for(const file of fs.readdirSync(preview).filter(n=>/\.(css|svg)$/.test(n)&&n!=='preview-readonly.css'))assert.equal(fs.readFileSync(path.join(root,file),'utf8'),fs.readFileSync(path.join(preview,file),'utf8'),'stylesheet/asset parity '+file);
const map=JSON.parse(html.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)[1]).imports;
assert.match(map['./src/home-reference.js'],/^\.\/src\/health-dashboard\.js/);
for(const [key,value] of Object.entries(map)){
 assert.ok(key.startsWith('./src/')&&value.startsWith('./src/'),'production graph remains local');
 assert.ok(fs.existsSync(path.join(root,value.split('?')[0])),'mapped dependency exists '+value);
}
for(const file of fs.readdirSync(path.join(preview,'src')).filter(n=>n.endsWith('.js')&&n!=='preview-readonly.js')){
 const body=fs.readFileSync(path.join(root,'src',file),'utf8');
 assert.equal(body,fs.readFileSync(path.join(preview,'src',file),'utf8'),'promoted source remains identical '+file);
 for(const [,relative]of body.matchAll(/\b(?:from|import)\s*(?:\(\s*)?['"](\.[^'"]+)['"]/g)){
  const target=path.resolve(root,'src',relative.split('?')[0]);
  assert.ok(target.startsWith(root)&&fs.existsSync(target),'closed dependency '+file+' '+relative);
 }
}
const core=fs.readFileSync(path.join(root,'src/core.js'),'utf8');
assert.doesNotMatch(core,/service_role|sb_secret_/);
const main=fs.readFileSync(path.join(root,'src/main.js'),'utf8');
assert.match(main,/if\(!session\)\{showLogin\(\);\}/);
assert.match(main,/subscribeAuth\(session=>\{state.session=session;if\(!session\)/);
for(const form of ['personalGoalsForm','uploadForm'])assert.ok(main.includes(form));
const entry=fs.readFileSync(path.join(root,'src/entry.js'),'utf8');
for(const form of ['bodyEntryForm','workoutEntryForm','waterEntryForm','mfpWaterImportForm'])assert.ok(entry.includes(form));
assert.ok(fs.readFileSync(path.join(preview,'index.html'),'utf8').includes('preview-readonly.js'),'preview remains isolated');
console.log('Integrated production graph, preserved auth, operational forms, source parity, isolated preview: passed.');

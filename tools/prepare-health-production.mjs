// Deterministic local promotion of reviewed generic runtime. No network or data writes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=path.join(root,'preview/compact-evidence'),target=path.join(root,'v2');
const build='health-integrated-20261026.86';
const preserved=['src/core.js','src/writes.js','src/entry.js'];
for(const name of preserved)assert.equal(fs.readFileSync(path.join(source,name),'utf8'),fs.readFileSync(path.join(target,name),'utf8'),`Operational boundary must be reviewed before changing ${name}`);
const files=fs.readdirSync(source).filter(name=>/\.(css|svg)$/.test(name)&&name!=='preview-readonly.css').concat(fs.readdirSync(path.join(source,'src')).filter(name=>name.endsWith('.js')&&name!=='preview-readonly.js').map(name=>'src/'+name));
for(const file of files){fs.mkdirSync(path.dirname(path.join(target,file)),{recursive:true});fs.copyFileSync(path.join(source,file),path.join(target,file));}
let html=fs.readFileSync(path.join(source,'index.html'),'utf8');
html=html.replace(/^.*<meta name="lts-preview"[^\n]*\n/m,'')
 .replace('<title>LTS Health · Prévia de validação</title>','<title>LTS Health</title>')
 .replace(/^.*(?:src="\.\/src\/preview-readonly\.js|href="\.\/preview-readonly\.css)[^\n]*\n/gm,'')
 .replace(/<small class="previewReadonlyBanner" data-preview-readonly-banner>Prévia · somente leitura<\/small>/g,'')
 .replaceAll('health-dashboard-20261019.74',build);
// Avoid loading one module twice through versioned and unversioned imports.
const match=html.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/);
const map=JSON.parse(match[1]);
for(const file of files.filter(name=>name.startsWith('src/'))){const name='./'+file;map.imports[name]??=name+'?v='+build;}
html=html.replace(match[1],JSON.stringify(map,null,2));
fs.writeFileSync(path.join(target,'index.html'),html);
console.log(`Prepared ${files.length} generic runtime assets at /v2; auth/write implementations preserved, read-only preview untouched. Build ${build}.`);

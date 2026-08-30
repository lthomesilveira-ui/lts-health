import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {strictLabNumeric,normalizeLabResult} from '../supabase/functions/_shared/lab-result-contract.mjs';

const inspector=await readFile('supabase/functions/health-inspect-upload/index.ts','utf8');

for(const source of ['lab','fleury','einstein']){
  if(!inspector.includes(`'${source}'`))throw new Error(`generic inspector no longer recognizes ${source}`);
}
for(const token of [
  'const isLabSource=',
  "isLabSource(upload.source_type)?'needs_specialized_parser':'ready_for_parser'",
  'Arquivo laboratorial preservado; importação automática retida até existir parser validado com amostra real.'
])if(!inspector.includes(token))throw new Error(`lab review barrier missing: ${token}`);

if(/async function import(?:Lab|Fleury|Einstein)\b/i.test(inspector))throw new Error('generic inspector must not auto-import laboratory results');
if(/upload\.source_type===['"](?:lab|fleury|einstein)['"][\s\S]{0,500}\bnum\s*\(/i.test(inspector))throw new Error('permissive numeric coercion entered a lab-specific path');

const commaCases=[
  ['12',12],['+12',12],['-3',-3],['1,25',1.25],['-0,2',-0.2],
  ['1.25',null],['<5',null],['> 10',null],['<=5',null],['1-3',null],['Presente',null],['1,2 mg/dL',null],['1.234,5',null],['',null]
];
for(const [raw,expected] of commaCases){const actual=strictLabNumeric(raw,',');if(!Object.is(actual,expected))throw new Error(`comma numeric contract failed for ${JSON.stringify(raw)}: ${actual}`);}
const dotCases=[['1.25',1.25],['0.003',0.003],['1,25',null],['1,234.5',null],['1e3',null],['~5',null]];
for(const [raw,expected] of dotCases){const actual=strictLabNumeric(raw,'.');if(!Object.is(actual,expected))throw new Error(`dot numeric contract failed for ${JSON.stringify(raw)}: ${actual}`);}

for(const raw of ['<5','Presente','1-3','1,2 mg/dL']){
  const normalized=normalizeLabResult(raw,',');
  if(normalized.result_raw!==raw||normalized.result_numeric!==null)throw new Error(`raw laboratory result was not preserved: ${raw}`);
}
if(normalizeLabResult(' 1,25 ',',').result_raw!==' 1,25 ')throw new Error('result_raw must preserve source text exactly');
let separatorGuard=false;try{strictLabNumeric('1.2','')}catch(error){separatorGuard=String(error?.message)==='decimal_separator_required'}
if(!separatorGuard)throw new Error('future parser can normalize without declaring a validated decimal separator');

const entries=await readdir('supabase/functions',{withFileTypes:true});
const specialized=entries.filter(entry=>entry.isDirectory()&&/^health-inspect-(lab|fleury|einstein)$/i.test(entry.name));
for(const entry of specialized){
  const source=await readFile(join('supabase/functions',entry.name,'index.ts'),'utf8');
  if(!source.includes('_shared/lab-result-contract.mjs')||!source.includes('strictLabNumeric'))throw new Error(`${entry.name} must use the shared strict laboratory normalization contract`);
  if(/replace\s*\(\s*\/\[\^0-9/i.test(source))throw new Error(`${entry.name} contains permissive numeric stripping`);
}

console.log(`LTS Health laboratory parser safety contract passed (${specialized.length} specialized parser(s) present)`);

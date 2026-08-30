import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';

const dataLayer=await readFile('v2/src/data-layer.js','utf8');
const core=await readFile('v2/src/core.js','utf8');
const treatment=await readFile('v2/src/treatment-screen.js','utf8');
const timeline=await readFile('v2/src/timeline-screen.js','utf8');
const dataScreen=await readFile('v2/src/data-screen.js','utf8');

const srcNames=await readdir('v2/src');
const presentationNames=srcNames.filter(name=>name.endsWith('-screen.js')||['main.js','entry.js','source-status.js'].includes(name));
const presentationFiles=await Promise.all(presentationNames.map(async name=>[name,await readFile(join('v2/src',name),'utf8')]));
for(const[name,content]of presentationFiles){
  if(content.includes('source_payload'))throw new Error(`raw source_payload entered presentation code: ${name}`);
  if(/storage_path/.test(content))throw new Error(`private storage path entered presentation code: ${name}`);
  if(/getPublicUrl\s*\(/.test(content))throw new Error(`public health-file URL generation entered presentation code: ${name}`);
}

if(!core.includes("bucket: 'health-inbox'"))throw new Error('private health-inbox bucket contract drifted');
if(!core.includes("sb.storage.from(CONFIG.bucket).upload"))throw new Error('health upload no longer uses configured private bucket');
if(!core.includes("sb.storage.from(CONFIG.bucket).remove"))throw new Error('failed upload cleanup no longer uses configured private bucket');
if(/getPublicUrl\s*\(/.test(core))throw new Error('health upload path can generate public URLs');
if(!core.includes("inspectFunction: 'health-inspect-upload'"))throw new Error('stable generic upload inspector contract drifted');
if(!core.includes('export const inspectFunctionForSource = () => CONFIG.inspectFunction'))throw new Error('source-specific parser routing was enabled without validated samples');
if(/health-inspect-(lab|fleury|einstein)/i.test(core))throw new Error('specialized laboratory parser enabled before sample validation');

const loader=dataLayer.match(/treatments:\(\)=>fetchAll\('health_medication_events','([^']+)'/)?.[1]||'';
const fields=loader.split(',').map(x=>x.trim()).filter(Boolean);
const allowed=['source_record_id','event_date','medication','event_type','source','confidence'];
if(JSON.stringify(fields)!==JSON.stringify(allowed))throw new Error(`treatment loader projection drifted: ${fields.join(',')}`);

const operational=/(dose|dosage|frequency|frequencia|route|via|injection|injecao|application|aplicacao|volume|amount|quantity|cycle|ciclo)/i;
if(fields.some(f=>operational.test(f)))throw new Error('operational treatment field entered the normal treatment loader');
if(new RegExp(`\\br\\.(?:dose|dosage|frequency|frequencia|route|via|injection|injecao|application|aplicacao|volume|amount|quantity|cycle|ciclo)\\b`,'i').test(treatment))throw new Error('treatment screen renders an operational treatment field');
if(new RegExp(`\\bt\\.(?:dose|dosage|frequency|frequencia|route|via|injection|injecao|application|aplicacao|volume|amount|quantity|cycle|ciclo)\\b`,'i').test(timeline))throw new Error('timeline renders an operational treatment field');

for(const token of [
  "title('Tratamentos','Contexto histórico por data e origem. Esta área não substitui orientação médica.')",
  "missing_event_dose:'Contexto histórico de tratamento'",
  "Registro histórico preservado sem detalhe operacional nesta tela."
])if(!(treatment+timeline+dataScreen).includes(token))throw new Error(`neutral treatment/privacy guardrail missing: ${token}`);

for(const forbidden of ["Confirmação registrada","sub:'Confirmação registrada'"]){
  if((treatment+timeline).includes(forbidden))throw new Error(`operational treatment confirmation re-entered presentation code: ${forbidden}`);
}
if(/\b(?:r|t)\.event_type\b/.test(treatment+timeline))throw new Error('treatment event_type re-entered the user-facing treatment context');

if(!dataScreen.includes('sensitiveQualityPattern'))throw new Error('sensitive quality sanitization guard missing');
if(!dataScreen.includes('sensitiveQuality(issue)'))throw new Error('sensitive quality sanitization is not applied');

const uploadProjection=dataLayer.match(/uploads:\(\)=>fetchAll\('health_uploads','([^']+)'/)?.[1]||'';
if(!uploadProjection)throw new Error('upload audit projection missing');
for(const forbidden of ['storage_path','user_id'])if(uploadProjection.split(',').includes(forbidden))throw new Error(`private upload field entered UI projection: ${forbidden}`);

const sourceMetricProjection=dataLayer.match(/sourceMetrics:\(\)=>fetchAll\('health_source_daily_metrics','([^']+)'/)?.[1]||'';
if(!sourceMetricProjection)throw new Error('source metrics projection missing');
if(sourceMetricProjection.includes('source_payload'))throw new Error('raw source_payload entered structured source metrics');
if(/health_source_daily_metrics','\*'/.test(dataLayer))throw new Error('source metrics use wildcard projection');
if(!dataLayer.includes("dados:['nutrition','meals','activity','metrics','sourceMetrics','labs','docs','uploads','previews','quality']"))throw new Error('source metrics provenance is not owned by the Data route');

const backupBlock=dataLayer.match(/export async function buildStructuredBackup[\s\S]*?export async function downloadStructuredBackup/)?.[0]||'';
if(!backupBlock)throw new Error('structured backup function contract missing');
for(const token of ['complete:true','structured_complete:true','includes_private_files:false','includes_credentials:false'])if(!backupBlock.includes(token))throw new Error(`structured backup privacy marker missing: ${token}`);
if(!backupBlock.includes('Backup não criado'))throw new Error('incomplete structured backup is no longer fail-closed');
if(sourceMetricProjection.includes('source_payload'))throw new Error('structured backup can include raw source metric payload');

const provenance=dataScreen.match(/function provenanceOverview\(rows\)\{[\s\S]*?\n\}/)?.[0]||'';
if(!provenance)throw new Error('safe provenance summary missing');
if(/row\.value\b|source_payload|source_record_id|storage_path/.test(provenance))throw new Error('provenance summary renders raw metric or technical payload fields');
for(const token of ['Proveniência das métricas','Só registros marcados explicitamente como candidatos entram na contagem de candidatos','separadas das métricas canônicas'])if(!dataScreen.includes(token))throw new Error(`provenance privacy guardrail missing: ${token}`);

const timelineSourceEvidence=timeline.match(/function sourceMetricEvents\(rows=\[\]\)\{[\s\S]*?\n\}\n\nfunction events/)?.[0]||'';
if(!timelineSourceEvidence)throw new Error('safe Timeline source-metric evidence block missing');
if(!timeline.includes("const preservedStatuses=new Set(['candidate','held']);"))throw new Error('Timeline source evidence no longer fails closed to explicit candidate/held states');
for(const token of ['preservedStatuses.has(norm(row.canonical_status))','Em validação · Não consolidado','source_name','source_family'])if(!timelineSourceEvidence.includes(token))throw new Error(`Timeline source evidence privacy guardrail missing: ${token}`);
if(/source_payload|source_record_id|storage_path|user_id/.test(timelineSourceEvidence))throw new Error('technical/private source metric fields entered Timeline evidence');
if(/health_source_daily_metrics/.test(timeline))throw new Error('source-metric storage table name entered Timeline presentation code');

console.log(`LTS Health cross-screen privacy contract passed (${presentationNames.length} presentation modules)`);
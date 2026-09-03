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
  if(/\b(?:row|record|upload|item)\.source_payload\b/.test(content))throw new Error(`raw source_payload entered presentation data access: ${name}`);
  if(/\b(?:row|record|upload|item)\.storage_path\b/.test(content))throw new Error(`private storage path entered presentation data access: ${name}`);
  if(/getPublicUrl\s*\(/.test(content))throw new Error(`public health-file URL generation entered presentation code: ${name}`);
}

if(!core.includes("bucket: 'health-inbox'"))throw new Error('private health-inbox bucket contract drifted');
if(!core.includes("sb.storage.from(CONFIG.bucket).upload"))throw new Error('health upload no longer uses configured private bucket');
if(/sb\.storage\.from\(CONFIG\.bucket\)\.remove\s*\(/.test(core))throw new Error('health upload can delete a preserved original during a failure path');
for(const token of ['preservedError.storagePath=path',"status:'review_required'",'arquivo preservado'])if(!core.toLowerCase().includes(token.toLowerCase()))throw new Error(`failed-processing preservation guard missing: ${token}`);
if(/getPublicUrl\s*\(/.test(core))throw new Error('health upload path can generate public URLs');
if(!core.includes("inspectFunction: 'health-inspect-upload'"))throw new Error('stable generic upload inspector contract drifted');
if(!core.includes('export const inspectFunctionForSource = () => CONFIG.inspectFunction'))throw new Error('source-specific parser routing was enabled without validated samples');
if(/health-inspect-(lab|fleury|einstein)/i.test(core))throw new Error('specialized laboratory parser enabled before sample validation');

const treatmentLoader=dataLayer.match(/treatments:\(\)=>fetchAll\('health_medication_events','([^']+)'/)?.[1]||'';
const treatmentFields=treatmentLoader.split(',').map(x=>x.trim()).filter(Boolean);
const allowedTreatment=['source_record_id','event_date','medication','event_type','source','source_file','confidence'];
if(JSON.stringify(treatmentFields)!==JSON.stringify(allowedTreatment))throw new Error(`treatment loader projection drifted: ${treatmentFields.join(',')}`);
const regimenLoader=dataLayer.match(/regimens:\(\)=>fetchAll\('health_medication_regimens','([^']+)'/)?.[1]||'';
const regimenFields=regimenLoader.split(',').map(x=>x.trim()).filter(Boolean);
const allowedRegimen=['source_record_id','medication','source','source_file','confidence'];
if(JSON.stringify(regimenFields)!==JSON.stringify(allowedRegimen))throw new Error(`regimen loader projection drifted: ${regimenFields.join(',')}`);
const operational=/(dose|dosage|frequency|frequencia|route|via|injection|injecao|application|aplicacao|volume|amount|quantity|cycle|ciclo)/i;
if(treatmentFields.some(f=>operational.test(f))||regimenFields.some(f=>operational.test(f)))throw new Error('operational treatment field entered a normal protocol loader');
if(new RegExp(`\\br\\.(?:dose|dosage|frequency|frequencia|route|via|injection|injecao|application|aplicacao|volume|amount|quantity|cycle|ciclo)\\b`,'i').test(treatment))throw new Error('protocol screen renders an operational field');
if(new RegExp(`\\bt\\.(?:dose|dosage|frequency|frequencia|route|via|injection|injecao|application|aplicacao|volume|amount|quantity|cycle|ciclo)\\b`,'i').test(timeline))throw new Error('timeline renders an operational treatment field');
for(const token of ['Cadastro de contexto não significa uso atual','missing_event_dose:\'Contexto histórico de tratamento\'','Registro histórico preservado sem detalhe operacional nesta tela.'])if(!(treatment+timeline+dataScreen).includes(token))throw new Error(`neutral treatment/privacy guardrail missing: ${token}`);
for(const forbidden of ['Confirmação registrada',"sub:'Confirmação registrada'"])if((treatment+timeline).includes(forbidden))throw new Error(`operational treatment confirmation re-entered presentation code: ${forbidden}`);
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
if(!dataLayer.includes("dados:['nutrition','meals','activity','metrics','sourceMetrics','labs','docs','uploads','previews','quality','treatments','regimens']"))throw new Error('Data route no longer owns all structured provenance/context domains');
if(!dataLayer.includes("analise:['nutrition','metrics','sourceMetrics','labs','treatments','regimens']"))throw new Error('Insights no longer loads preserved source and protocol context');
if(!dataLayer.includes("hoje:['nutrition','metrics','sourceMetrics','labs','uploads','treatments','regimens']"))throw new Error('Cockpit no longer loads protocol context on first open');
if(!dataLayer.includes("tratamentos:['treatments','regimens']"))throw new Error('Protocol route no longer loads event and context records together');

const backupBlock=dataLayer.match(/export async function buildStructuredBackup[\s\S]*?export async function downloadStructuredBackup/)?.[0]||'';
if(!backupBlock)throw new Error('structured backup function contract missing');
for(const token of ['complete:true','structured_complete:true','includes_private_files:false','includes_credentials:false'])if(!backupBlock.includes(token))throw new Error(`structured backup privacy marker missing: ${token}`);
if(!backupBlock.includes('Backup não criado'))throw new Error('incomplete structured backup is no longer fail-closed');
if(sourceMetricProjection.includes('source_payload')||regimenLoader.includes('source_payload'))throw new Error('structured backup can include a raw payload field');

const provenance=dataScreen.match(/function provenanceOverview\(metricRows,workoutEvidenceRows\)\{[\s\S]*?\n\}/)?.[0]||'';
if(!provenance)throw new Error('safe provenance summary missing');
if(/row\.value\b|source_payload|source_record_id|storage_path/.test(provenance))throw new Error('provenance summary renders raw metric or technical payload fields');
for(const token of ['Não foi possível carregar as origens agora.','As origens das métricas não carregaram agora; evidências complementares de treino continuam exibidas.','aguardando conferência','preservado(s) sem uso automático','Uma fonte não é somada a outra automaticamente.'])if(!dataScreen.includes(token))throw new Error(`plain provenance/privacy guardrail missing: ${token}`);
for(const legacy of ['Proveniência das métricas','contagem de candidatos','métricas canônicas','canônico(s)','candidato(s)'])if(dataScreen.includes(legacy))throw new Error(`legacy provenance terminology re-entered Data UI: ${legacy}`);

const timelineSourceEvidence=timeline.match(/function sourceMetricEvents\(rows=\[\]\)\{[\s\S]*?\n\}\s*(?=function )/)?.[0]||'';
if(!timelineSourceEvidence)throw new Error('safe Timeline source-metric evidence block missing');
if(!timeline.includes("const preservedStatuses=new Set(['candidate','held']);"))throw new Error('Timeline source evidence no longer fails closed to explicit candidate/held states internally');
for(const token of ['preservedStatuses.has(norm(row.canonical_status))','aguardando conferência; mantido separado dos dados confirmados','source_name','source_family'])if(!timelineSourceEvidence.includes(token))throw new Error(`Timeline source evidence privacy guardrail missing: ${token}`);
if(/source_payload|source_record_id|storage_path|user_id/.test(timelineSourceEvidence))throw new Error('technical/private source metric fields entered Timeline evidence');
if(/health_source_daily_metrics/.test(timeline))throw new Error('source-metric storage table name entered Timeline presentation code');
for(const legacy of ['Em validação · Não consolidado','FC de repouso','MME'])if(timeline.includes(legacy))throw new Error(`technical Timeline copy re-entered presentation: ${legacy}`);

console.log(`LTS Health cross-screen privacy contract passed (${presentationNames.length} presentation modules)`);

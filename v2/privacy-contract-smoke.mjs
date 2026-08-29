import {readFile} from 'node:fs/promises';

const dataLayer=await readFile('v2/src/data-layer.js','utf8');
const treatment=await readFile('v2/src/treatment-screen.js','utf8');
const timeline=await readFile('v2/src/timeline-screen.js','utf8');
const dataScreen=await readFile('v2/src/data-screen.js','utf8');

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
  "sub:'Confirmação registrada'",
  "missing_event_dose:'Contexto histórico de tratamento'",
  "Registro histórico preservado sem detalhe operacional nesta tela."
])if(!(treatment+timeline+dataScreen).includes(token))throw new Error(`neutral treatment/privacy guardrail missing: ${token}`);

if(!dataScreen.includes('sensitiveQualityPattern'))throw new Error('sensitive quality sanitization guard missing');
if(!dataScreen.includes('sensitiveQuality(issue)'))throw new Error('sensitive quality sanitization is not applied');

const sourceMetricProjection=dataLayer.match(/sourceMetrics:\(\)=>fetchAll\('health_source_daily_metrics','([^']+)'/)?.[1]||'';
if(!sourceMetricProjection)throw new Error('source metrics backup projection missing');
if(sourceMetricProjection.includes('source_payload'))throw new Error('raw source_payload entered structured backup');
if(/health_source_daily_metrics','\*'/.test(dataLayer))throw new Error('source metrics backup uses wildcard projection');

console.log('LTS Health privacy contract smoke passed');

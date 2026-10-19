import assert from 'node:assert/strict';
import fs from 'node:fs';
import {htmlText,technicalMatches} from './consumer-language-html.mjs';

globalThis.location={search:'?fixture=1'};
const {state}=await import('../src/core.js');
const {renderDataHub}=await import('../src/data-screen.js');
const {renderConnections}=await import('../src/polar-connection.js');
const {renderAutoExportConnection}=await import('../src/health-auto-export-connection.js');
const {sourceStatusFor,sourceCoverageFor}=await import('../src/source-status.js');

// Entirely invented fixtures. Render presentation without a network or login.
const diagnostic='SQLSTATE 42703: column source_record_id does not exist; RPC payload canonical_status <synthetic-only>';
const resolution='candidate held canonical_status: synthetic resolution 1,2345';
state.data={
  uploads:[{id:'synthetic-upload',source_type:'myfitnesspal',status:'failed',original_filename:'synthetic-food.csv',created_at:'2025-04-10'}],
  previews:[{upload_id:'synthetic-upload',status:'failed',detected_format:'csv',row_count:12,date_min:'2025-04-01',date_max:'2025-04-09'}],
  quality:[
    {category:'parsing',status:'open',description:diagnostic,resolution_notes:resolution},
    {category:'limited_longitudinal_coverage',status:'known',description:'Há registros em somente 3 dias deste período.'},
    {category:'parsing',status:'resolved',description:'Leitura do arquivo concluída.',resolution_notes:'As datas foram preservadas.'}
  ],
  sourceMetrics:[
    {source_record_id:'synthetic-candidate',source_family:'apple_watch',canonical_status:'candidate',metric_type:'sleep_duration_h',metric_date:'2025-04-12',unit:'h',value:7.25},
    {source_record_id:'synthetic-held',source_family:'polar_flow',canonical_status:'held',metric_type:'steps',metric_date:'2025-04-13',unit:'count',value:6789},
    {source_record_id:'health_auto_export:synthetic-confirmed',source_family:'health_auto_export',canonical_status:'canonical',confidence:'authenticated_auto_export',metric_type:'dietary_water_ml',metric_date:'2025-04-10',unit:'mL',value:1234.5}
  ],
  workoutEvidence:[{source_family:'polar_flow',evidence_status:'confirmed',workout_date:'2025-04-11'}],
  labs:[{collection_date:'2025-04-09',laboratory:'Fleury',biomarker:'Marcador sintético',result_raw:'<4',result_numeric:4,reference_range:'1,2345 a 5',unit:'u'}],
  docs:[{title:'Documento sintético',notes:'Original clínico: payload e canonical_status; <4 e 1,2345.'}],
  nutrition:[],meals:[],metrics:[],body:[],workouts:[],activity:[],treatments:[]
};
state.domainStatus=Object.fromEntries(Object.keys(state.data).map(key=>[key,'ready']));
state.errors={};state.ui={};
state.polarConnection={status:'ready',configured:true,connected:true,update_mode:'scheduled_hourly',last_sync_at:'2025-04-11',last_scheduled_sync_at:'2025-04-11T12:00:00Z'};
state.autoExportConnection={status:'ready',configured:true,received:true,last_received_at:'2025-04-10T12:00:00Z',last_metric_date:'2025-04-10',last_water_date:'2025-04-10'};
const original=structuredClone(state.data),coverage=sourceCoverageFor('apple_health');
assert.deepEqual(coverage,{confirmedDate:'2025-04-10',preservedDate:'2025-04-12',latestDate:'2025-04-12'});
assert.equal(sourceStatusFor('apple_health'),'ready');
assert.equal(sourceStatusFor('polar_flow'),'ready');
assert.equal(sourceStatusFor('myfitnesspal'),'attention');

const html=renderDataHub(),visible=htmlText(html),expanded=htmlText(html,{expanded:true});
assert.deepEqual(technicalMatches(visible),[],'consumer summary has no backend labels or raw errors');
assert.doesNotMatch(visible,/backlog|regra segura|servidor|\bAPI\b/i);
assert.match(visible,/1 arquivo precisa de atenção/);
assert.match(visible,/Histórico adicional/);
assert.doesNotMatch(visible,/pendente no notebook|Importar o histórico de água|Ver opção de importação/);
assert.match(expanded,/Não é necessário repetir a importação/);
assert.match(visible,/synthetic-food\.csv/);
assert.match(visible,/Registros disponíveis até: 10\/04\/2025/);
assert.match(visible,/Registros adicionais guardados até: 12\/04\/2025/);
assert.match(html,/<details class="sourceMore technicalDiagnostic"><summary>Diagnóstico técnico<\/summary>/);
assert.ok(!visible.includes(diagnostic),'raw error is absent from the default view');
assert.ok(expanded.includes(diagnostic),'exact safe diagnostic remains available on expansion');
assert.ok(expanded.includes(resolution),'exact safe resolution remains available on expansion');
assert.ok(!html.includes('<synthetic-only>'),'technical text is escaped, never treated as markup');
assert.match(expanded,/Há registros em somente 3 dias deste período/,'human limitations remain readable');
assert.match(expanded,/12 registros/,'upload counts are unchanged');
assert.match(expanded,/Apple Watch/);assert.match(expanded,/Polar Flow/);
const noDiagnostics=html.replace(/<details class="sourceMore technicalDiagnostic">[\s\S]*?<\/details>/g,'');
assert.deepEqual(technicalMatches(htmlText(noDiagnostics,{expanded:true})),[],'opening ordinary source details does not expose technical errors');
assert.deepEqual(state.data,original,'all clinical values, notes, source identities and record statuses remain untouched');

for(const connection of [null,{status:'loading'},{status:'error'},{status:'ready',configured:false,connected:false},{status:'ready',configured:true,connected:false},{status:'ready',configured:true,connected:true,update_mode:'unverified',sync_error:diagnostic}]){
  state.polarConnection=connection;
  const view=renderConnections(),text=htmlText(view);
  assert.deepEqual(technicalMatches(text),[]);
  assert.ok(!text.includes(diagnostic));
  if(connection?.status==='error'){
    assert.match(text,/Não foi possível verificar a conexão agora/);
    assert.doesNotMatch(text,/A conexão ainda precisa ser configurada/,'failed status does not pretend configuration is absent');
    assert.doesNotMatch(view,/data-polar-action="start"|data-polar-action="sync"/);
  }
  if(connection?.status==='ready'&&connection.configured)assert.match(view,/data-polar-action="start"/);
  if(connection?.connected)assert.match(view,/data-polar-action="sync"/);
}
for(const connection of [null,{status:'error'},{status:'ready',configured:false},{status:'ready',configured:true,received:false}]){
  state.autoExportConnection=connection;
  const view=renderAutoExportConnection(),text=htmlText(view);
  assert.deepEqual(technicalMatches(text),[]);
  if(connection?.status==='error'){
    assert.match(text,/Não foi possível verificar os envios agora/);
    assert.doesNotMatch(view,/data-hae-action="create"|data-hae-action="rotate"/);
  }
  if(connection?.configured)assert.match(text,/Aguardando primeiro envio/);
}
state.domainStatus={...state.domainStatus,uploads:'error',sourceMetrics:'error',quality:'error'};
state.errors={uploads:diagnostic,sourceMetrics:diagnostic,quality:diagnostic};
const failed=htmlText(renderDataHub());
assert.match(failed,/Não foi possível verificar seus arquivos agora/);
assert.deepEqual(technicalMatches(failed),[]);
assert.doesNotMatch(failed,/Nenhuma ação sua é necessária/,'failed file reads do not become a successful empty state');
assert.deepEqual(state.data,original);

// This pass changes presentation only: auth, IO, secrets and source decisions
// must remain byte-for-byte equal to the untouched production counterparts.
for(const file of ['polar-connection.js','health-auto-export-connection.js']){
  const marker=file==='polar-connection.js'?'export function renderConnections()':'export function renderAutoExportConnection()';
  const preview=fs.readFileSync(new URL('../src/'+file,import.meta.url),'utf8').split(marker)[0];
  const production=fs.readFileSync(new URL('../../../v2/src/'+file,import.meta.url),'utf8').split(marker)[0];
  assert.equal(preview,production,file+' keeps connection, authorization, key and IO behavior untouched');
}
assert.equal(fs.readFileSync(new URL('../src/source-status.js',import.meta.url),'utf8'),fs.readFileSync(new URL('../../../v2/src/source-status.js',import.meta.url),'utf8'),'source classification and coverage are unchanged');
console.log('Consumer diagnostics: human summaries, closed exact diagnostics, source dates/counts, failed reads, connection states, escaped content and unchanged clinical/auth/IO contracts passed.');

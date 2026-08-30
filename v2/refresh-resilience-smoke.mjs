const rowsByTable=new Map([
  ['health_body_composition',[{source_record_id:'body-1',measured_at:'2026-02-01',weight_kg:90,source:'Teste'}]],
  ['health_segmental_composition',[]],
  ['health_workouts',[]],
  ['health_workout_exercises',[]],
  ['health_workout_sets',[]],
  ['health_lab_results',[]],
  ['health_documents',[]],
  ['health_medication_events',[]],
  ['health_uploads',[]],
  ['health_ingestion_previews',[]],
  ['health_data_quality_issues',[]],
  ['health_daily_nutrition',[]],
  ['health_nutrition_meals',[]],
  ['health_activity_records',[]],
  ['health_metrics',[]],
  ['health_source_daily_metrics',[{
    source_record_id:'source-1',metric_date:'2026-02-01',metric_type:'steps',value:1000,unit:'count',
    source_name:'Teste',source_family:'test_device',canonical_status:'candidate',confidence:'high',source_file:'fixture',
    source_payload:{private:'must-not-export'}
  }]]
]);
const errorsByTable=new Map();

function project(row,selection){
  if(!selection||selection==='*')return {...row};
  return Object.fromEntries(selection.split(',').map(key=>key.trim()).filter(Boolean).filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]]));
}

const fakeClient={
  from(table){
    let selection='*',from=0,to=999;
    const builder={
      select(value){selection=value;return builder;},
      range(start,end){from=start;to=end;return builder;},
      order(){return builder;},
      then(resolve,reject){
        const error=errorsByTable.get(table)||null;
        const source=rowsByTable.get(table)||[];
        const data=error?null:source.slice(from,to+1).map(row=>project(row,selection));
        return Promise.resolve({data,error}).then(resolve,reject);
      }
    };
    return builder;
  }
};

globalThis.location={search:'',hash:''};
globalThis.window={supabase:{createClient:()=>fakeClient}};

const {state}=await import('./src/core.js');
const {loadInitialData,refreshData,ensureRouteData,buildStructuredBackup}=await import('./src/data-layer.js');

const progress=[];
await loadInitialData(message=>progress.push(message));
if(state.domainStatus.body!=='ready'||state.data.body?.[0]?.source_record_id!=='body-1')throw new Error('initial snapshot did not load');

errorsByTable.set('health_body_composition',new Error('body refresh unavailable'));
await refreshData('bio',message=>progress.push(message));
if(state.domainStatus.body!=='error')throw new Error('failed refresh did not mark body domain as error');
if(state.data.body?.[0]?.source_record_id!=='body-1')throw new Error('failed refresh discarded the previous body snapshot');
if(!String(state.errors.body||'').includes('Dados anteriores mantidos.'))throw new Error('failed refresh did not disclose that previous data was preserved');
if(!progress.includes('Atualização parcial; dados anteriores foram mantidos onde houve falha.'))throw new Error('partial refresh status was not surfaced');

errorsByTable.delete('health_body_composition');
delete state.data.metrics;
delete state.domainStatus.metrics;
errorsByTable.set('health_metrics',new Error('metrics unavailable'));
await ensureRouteData('hoje',message=>progress.push(message));
if(state.domainStatus.metrics!=='error')throw new Error('first-load metric failure was not marked as error');
if(!Array.isArray(state.data.metrics)||state.data.metrics.length!==0)throw new Error('first-load metric failure must remain an explicit empty error state');
if(String(state.errors.metrics||'').includes('Dados anteriores mantidos.'))throw new Error('first-load failure falsely claimed that a previous snapshot existed');

errorsByTable.delete('health_metrics');
const backupProgress=[];
const backup=await buildStructuredBackup(message=>backupProgress.push(message));
if(backup.complete!==true||backup.structured_complete!==true)throw new Error('successful structured backup was not marked complete');
if(backup.includes_private_files!==false||backup.includes_credentials!==false)throw new Error('backup privacy scope drifted');
const sourceMetric=backup.data.sourceMetrics?.[0];
if(!sourceMetric)throw new Error('source metrics missing from structured backup');
if(Object.hasOwn(sourceMetric,'source_payload'))throw new Error('raw source payload leaked into structured backup');
if(sourceMetric.source_family!=='test_device'||sourceMetric.canonical_status!=='candidate')throw new Error('structured source provenance was not preserved');

errorsByTable.set('health_metrics',new Error('metrics backup unavailable'));
let incompleteError=null;
try{await buildStructuredBackup(message=>backupProgress.push(message));}catch(error){incompleteError=error;}
if(!incompleteError)throw new Error('incomplete backup was incorrectly created');
if(!Array.isArray(incompleteError.domains)||!incompleteError.domains.includes('metrics'))throw new Error('incomplete backup did not identify the failed domain');
if(!backupProgress.includes('Backup não criado'))throw new Error('incomplete backup failure was not surfaced');

console.log('LTS Health refresh resilience and backup privacy smoke passed');
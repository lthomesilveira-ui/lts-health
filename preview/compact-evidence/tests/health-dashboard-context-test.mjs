import assert from 'node:assert/strict';
import {dashboardContext} from '../src/health-dashboard-context.js';

// Synthetic records only. No database, browser, clock, clinical targets or I/O.
const status={labs:'ready',workouts:'ready',exercises:'ready',sets:'ready'};
const options={today:'2025-04-30',mode:'30',bounds:{start:'2025-04-01',end:'2025-04-30'}};
const lab=(date,value,extra={})=>({source_record_id:`synthetic-lab-${date}`,collection_date:date,biomarker:'Marcador sintético A',result_numeric:value,
  result_raw:String(value),unit:'mg/L',laboratory:'Laboratório sintético',method:'Método sintético',reference_range:'2 a 8',...extra});
const workout=(id,date,extra={})=>({source_record_id:`synthetic-workout-${id}`,workout_date:date,is_canonical:true,record_status:'validated',
  workout_type:'Sessão sintética',source:'Diário sintético',location:'Local sintético',duration_minutes:30,...extra});
const exercise=(id,parent,group,extra={})=>({source_record_id:`synthetic-exercise-${id}`,workout_source_record_id:`synthetic-workout-${parent}`,
  exercise:'Exercício sintético',muscle_group:group,...extra});
const model=(data={},states=status,opts=options)=>dashboardContext(data,states,opts);
const pair=(first,last,extra={})=>model({labs:[lab('2025-03-01',first,extra),lab('2025-04-20',last,extra)]}).labs.items[0];
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;};
let checks=0;
function test(name,callback){callback();checks++;console.log(`ok ${checks} - ${name}`);}

test('pure defaults and invalid calendars produce no invented observations',()=>{
  const result=dashboardContext();assert.equal(result.valid,false);assert.equal(result.reason,'invalid_calendar');
  assert.deepEqual(result.labs.items,[]);assert.equal(result.training.sessions,null);
  for(const bounds of [{start:'2025-02-30',end:'2025-04-30'},{start:'2025-05-01',end:'2025-04-30'}])assert.equal(model({},status,{...options,bounds}).valid,false);
  assert.equal(model({},status,{bounds:options.bounds}).today,options.bounds.end);
});
test('empty successful reads are distinct from errors and unavailable stale arrays',()=>{
  const empty=model();assert.equal(empty.labs.status,'empty');assert.equal(empty.labs.count,0);assert.equal(empty.training.sessions,0);assert.equal(empty.training.recordedMinutes,null);
  const data={labs:[lab('2025-04-02',5)],workouts:[workout('a','2025-04-02')]};
  for(const state of ['error','loading','unavailable']){
    const result=model(data,{labs:state,workouts:state});assert.equal(result.labs.status,state);assert.equal(result.training.status,state);
    assert.equal(result.labs.count,null);assert.equal(result.training.sessions,null);assert.equal(result.training.recordedDays,null);assert.deepEqual(result.labs.items,[]);
  }
});
test('latest lab from before the window stays visible and explicitly outside',()=>{
  const result=model({labs:[lab('2025-01-01',3),lab('2025-03-01',4)]}).labs,item=result.items[0];
  assert.equal(result.count,0);assert.equal(result.knownCount,2);assert.equal(result.outsidePeriodCount,1);assert.equal(item.date,'2025-03-01');
  assert.equal(item.inPeriod,false);assert.match(item.periodLabel,/Fora do período/);assert.equal(item.previous.date,'2025-01-01');assert.equal(item.delta,1);
});
test('historical bounds and today prevent future observation leakage',()=>{
  const opts={...options,today:'2025-06-01'},data={labs:[lab('2025-04-10',4),lab('2025-05-01',7)],workouts:[workout('a','2025-04-10'),workout('b','2025-05-01')]};
  let result=model(data,status,opts);assert.equal(result.labs.items[0].date,'2025-04-10');assert.equal(result.training.latest.date,'2025-04-10');
  assert.equal(result.training.daysSinceLast,20);assert.match(result.training.gapLabel,/Em 30\/04\/2025/);
  result=model(data,status,{...options,today:'2025-04-12'});assert.equal(result.bounds.end,'2025-04-12');assert.equal(result.training.daysSinceLast,2);
});
test('marker, laboratory and case-sensitive units remain separate identities',()=>{
  const records=[lab('2025-04-01',3),lab('2025-04-02',4,{source_record_id:'synthetic-other-lab',laboratory:'Outro laboratório'}),
    lab('2025-04-03',5,{source_record_id:'synthetic-other-unit',unit:'mU/L'}),lab('2025-04-04',6,{source_record_id:'synthetic-case-unit',unit:'MU/L'}),
    lab('2025-04-05',7,{source_record_id:'synthetic-other-marker',biomarker:'Marcador sintético B'})];
  const result=model({labs:records}).labs;assert.equal(result.items.length,5);assert.ok(result.items.every(item=>item.previous===null&&item.delta===null&&!item.comparable));
});
test('arithmetic needs a known matching method and the same declared reference',()=>{
  for(const patch of [{method:null},{method:'unknown'},{method:'Outro método'},{reference_range:'1 a 9'},{reference_range:null}]){
    const item=model({labs:[lab('2025-03-01',3),lab('2025-04-20',4,patch)]}).labs.items[0];
    assert.equal(item.comparable,false);assert.equal(item.delta,null);assert.equal(item.label,'sem comparação');assert.equal(item.references.length,2);
    assert.equal(item.references[0].reference,'2 a 8');assert.equal(item.references[1].reference,patch.reference_range??(Object.hasOwn(patch,'reference_range')?null:'2 a 8'));
  }
  const equivalent=model({labs:[lab('2025-03-01',3,{reference_range:'2–8 mg/L'}),lab('2025-04-20',4)]}).labs.items[0];
  assert.equal(equivalent.comparable,true);assert.equal(equivalent.delta,1);assert.equal(equivalent.references[0].reference,'2–8 mg/L');
});
test('reference movement is numerical and has no improvement or diagnosis labels',()=>{
  assert.equal(pair(12,10).label,'aproximou da referência');assert.equal(pair(10,12).label,'afastou da referência');
  assert.equal(pair(10,5).label,'aproximou da referência');assert.equal(pair(5,10).label,'afastou da referência');
  assert.equal(pair(3,4).label,'dentro da referência');assert.equal(pair(10,10).label,'fora da referência');
  // Increasing and decreasing can both approach the same interval.
  assert.equal(pair(0,1).label,'aproximou da referência');assert.equal(pair(12,10).label,'aproximou da referência');
  assert.ok(pair(0,1).delta>0);assert.ok(pair(12,10).delta<0);
  for(const values of [[12,10],[10,12],[3,4]])assert.doesNotMatch(pair(...values).label,/melhor|pior|normal|risco|diagnóstico|meta/i);
});
test('single results retain current range position without inventing a trajectory',()=>{
  const item=model({labs:[lab('2025-04-20',10)]}).labs.items[0];assert.equal(item.label,'sem comparação');assert.equal(item.referenceLabel,'fora da referência');
  assert.equal(item.attention,true);assert.equal(item.attentionLabel,'atenção ao laudo');assert.equal(item.delta,null);
});
test('simple explicit inequalities honor strict and inclusive endpoints',()=>{
  for(const [reference,value,position]of [['< 8',8,'above'],['<= 8',8,'within'],['≤ 8 mg/L',8,'within'],['> 2',2,'below'],['>= 2',2,'within'],['≥ 2 mg/L',2,'within']]){
    const item=model({labs:[lab('2025-04-20',value,{reference_range:reference})]}).labs.items[0];assert.equal(item.referencePosition,position,reference);
  }
  assert.equal(pair(8,7,{reference_range:'< 8'}).label,'aproximou da referência');
  assert.equal(pair(7,8,{reference_range:'< 8'}).label,'afastou da referência');
});
test('clear numeric ranges parse decimal comma and negative bounds conservatively',()=>{
  for(const reference of ['2 - 8','2–8','2—8','2 até 8','2 a 8 mg/L'])assert.equal(pair(3,4,{reference_range:reference}).label,'dentro da referência');
  const comma=model({labs:[lab('2025-04-20',2.5,{result_raw:'2,5',reference_range:'2,2 a 8,2'})]}).labs.items[0];assert.equal(comma.referencePosition,'within');
  const negative=model({labs:[lab('2025-04-20',-2,{reference_range:'-5 a -1'})]}).labs.items[0];assert.equal(negative.referencePosition,'within');
});
test('sex, age, multiple ranges, thresholds with advice and ambiguous separators are not parsed',()=>{
  for(const reference of ['Homens: 2 a 8','Mulheres: 2 a 8','18 a 60 anos: 2 a 8','2 a 8; idosos: 3 a 9','Desejável: < 8','2 a 8 mg/dL','1.000 a 2.000','2 a 8 (em jejum)','2 a 8 / 3 a 9','2 a 8; resultado confirmado após diluição']){
    const item=pair(10,9,{reference_range:reference});assert.equal(item.referencePosition,'unknown',reference);assert.equal(item.rangeComparable,false);
    assert.equal(item.label,'sem comparação');assert.equal(item.attention,false);assert.equal(item.reference,reference);
  }
});
test('censored, contradictory and textual results never become exact numbers for arithmetic',()=>{
  for(const patch of [{result_raw:'< 4'},{result_raw:'≤4'},{result_raw:'menor que 4'},{result_raw:'positivo'},{result_raw:'5'},{result_numeric:null},{result_numeric:false},{result_numeric:[]},{result_numeric:'0x10'}]){
    const item=model({labs:[lab('2025-03-01',3),lab('2025-04-20',4,patch)]}).labs.items[0];
    assert.equal(item.comparable,false);assert.equal(item.delta,null);assert.equal(item.referencePosition,'unknown');assert.equal(item.attention,false);
  }
  assert.equal(pair(0,1).delta,1);assert.equal(pair(0,1).previous.value,0);
});
test('attention comes only from an actual reported signal or a clear out-of-range result',()=>{
  for(const flag of [null,'',false,'normal','N','false','0','sem alterações','unknown'])assert.equal(model({labs:[lab('2025-04-20',5,{flag})]}).labs.items[0].attention,false);
  for(const flag of ['H','L','alto','baixo','abnormal',true]){
    const item=model({labs:[lab('2025-04-20',5,{flag,reference_range:'Consultar laudo'})]}).labs.items[0];assert.equal(item.attention,true);assert.equal(item.attentionLabel,'atenção ao laudo');
  }
});
test('exact duplicate lab IDs collapse while conflicting newest observations stay visibly ambiguous',()=>{
  const old=lab('2025-03-01',3),last=lab('2025-04-20',4);
  let result=model({labs:[old,last,{...last}]}).labs;assert.equal(result.knownCount,2);assert.equal(result.items[0].delta,1);assert.equal(result.duplicates[0].conflicting,false);
  result=model({labs:[old,last,{...last,result_numeric:9,result_raw:'9'}]}).labs;
  assert.equal(result.items[0].date,'2025-04-20');assert.equal(result.items[0].value,null);assert.equal(result.items[0].ambiguous,true);assert.equal(result.items[0].delta,null);
  assert.equal(result.items[0].observations.length,2);assert.equal(result.items[0].attention,true);assert.equal(result.partial,true);
  result=model({labs:[old,last,{...last,source_record_id:'synthetic-another-record'}]}).labs;
  assert.equal(result.items[0].ambiguous,true);assert.equal(result.items[0].comparable,false);
  const noId={...last,source_record_id:null};result=model({labs:[old,noId,{...noId}]}).labs;
  assert.equal(result.items[0].ambiguous,true);assert.equal(result.items[0].delta,null);assert.equal(result.duplicates[0].reason,'unverified_identity');
});
test('an ambiguous prior date is not skipped to manufacture an older pair',()=>{
  const rows=[lab('2025-02-01',2),lab('2025-03-01',3),lab('2025-03-01',4,{source_record_id:'synthetic-other'}),lab('2025-04-20',5)];
  const item=model({labs:rows}).labs.items[0];assert.equal(item.previous,null);assert.equal(item.delta,null);assert.equal(item.label,'sem comparação');
});
test('missing markers stay readable but are not pooled into a synthetic named series',()=>{
  const items=model({labs:[lab('2025-03-01',3,{biomarker:null}),lab('2025-04-20',4,{biomarker:null})]}).labs.items;
  assert.equal(items.length,2);assert.ok(items.every(item=>!item.comparable));
});
test('marker ordering is alphabetic rather than clinical or magnitude ranking',()=>{
  const rows=[lab('2025-04-20',999,{source_record_id:'synthetic-z',biomarker:'Zeta'}),lab('2025-04-02',5,{source_record_id:'synthetic-a',biomarker:'Alfa'})];
  assert.deepEqual(model({labs:rows}).labs.items.map(item=>item.biomarker),['Alfa','Zeta']);
});
test('only canonical nonquarantined workouts count in the selected bounds',()=>{
  const workouts=[workout('a','2025-04-02'),workout('b','2025-04-02'),workout('c','2025-04-03'),workout('old','2025-03-30'),
    workout('future','2025-05-01'),workout('candidate','2025-04-03',{is_canonical:false}),workout('held','2025-04-03',{is_canonical:null}),
    workout('quarantined','2025-04-03',{record_status:'quarantined'}),workout('invalid','2025-02-30')];
  const result=model({workouts}).training;assert.equal(result.sessions,3);assert.equal(result.recordedDays,2);assert.equal(result.recordedMinutes,90);
  assert.equal(result.historicalSessions.length,1);assert.equal(result.historicalSessions[0].inPeriod,false);assert.equal(result.latest.date,'2025-04-03');
});
test('exact duplicate canonical IDs count once and conflicting identities cannot affect totals or groups',()=>{
  const one=workout('a','2025-04-02',{muscle_groups:['Grupo A']}),two=workout('b','2025-04-03');
  let result=model({workouts:[one,{...one,imported_at:'2030-01-01'},two]}).training;assert.equal(result.sessions,2);assert.equal(result.recordedMinutes,60);
  result=model({workouts:[one,{...one,duration_minutes:50},two],exercises:[exercise('a','a','Grupo A')]}).training;
  assert.equal(result.sessions,1);assert.equal(result.recordedMinutes,30);assert.deepEqual(result.groups,[]);assert.equal(result.duplicates[0].conflicting,true);
  const noId={...one,source_record_id:null};result=model({workouts:[noId,{...noId}]}).training;assert.equal(result.sessions,0);assert.equal(result.duplicates[0].reason,'unverified_identity');
});
test('a conflicting newest session cannot manufacture a longer workout gap or a missing-group claim',()=>{
  const recent=workout('recent','2025-04-20',{muscle_groups:['Grupo anterior']});
  const result=model({workouts:[workout('old','2025-03-01',{muscle_groups:['Grupo anterior']}),recent,{...recent,duration_minutes:50}]}).training;
  assert.equal(result.sessions,0);assert.equal(result.lastObservedDate,'2025-04-20');assert.equal(result.lastRecordAmbiguous,true);
  assert.equal(result.latest,null);assert.equal(result.daysSinceLast,null);assert.equal(result.gapLabel,null);assert.deepEqual(result.missingGroups,[]);assert.ok(result.notices.length);
});
test('duration counts preserve explicit zero, leave missing unknown and expose coverage',()=>{
  const workouts=[workout('a','2025-04-01',{duration_minutes:0}),workout('b','2025-04-02',{duration_minutes:null}),workout('c','2025-04-03',{duration_minutes:45}),
    workout('d','2025-04-04',{duration_minutes:-1}),workout('e','2025-04-05',{duration_minutes:false})];
  const result=model({workouts}).training;assert.equal(result.recordedMinutes,45);assert.equal(result.durationCoverage.sessions,2);assert.equal(result.durationCoverage.total,5);
  assert.equal(result.durationCoverage.fraction,.4);assert.match(result.durationCoverage.label,/2\/5 sessões/);
  assert.equal(model({workouts:[workout('z','2025-04-01',{duration_minutes:0})]}).training.recordedMinutes,0);
});
test('muscle frequencies count sessions and distinct days, never exercises',()=>{
  const workouts=[workout('a','2025-04-02',{muscle_groups:['Peito','Ombros']}),workout('b','2025-04-02'),workout('c','2025-04-03')];
  const exercises=[exercise('a1','a','Peito'),exercise('a2','a','Peito'),exercise('a3','a','Tríceps'),exercise('b1','b','Peito'),exercise('c1','c','Peito')];
  const result=model({workouts,exercises}).training,peito=result.groups.find(group=>group.label==='Peito');
  assert.equal(peito.sessions,3);assert.equal(peito.days,2);assert.equal(result.groups.find(group=>group.label==='Tríceps').sessions,1);
  assert.ok(result.groups.reduce((sum,group)=>sum+group.sessions,0)>result.sessions);assert.match(peito.note,/compartilhar/);
});
test('group names are never inferred from type, exercise name, sets or telemetry',()=>{
  const data={workouts:[workout('a','2025-04-02',{workout_type:'Peito + ombros',sets_by_group:{Peito:5},raw_exercises:'Supino'})],
    exercises:[exercise('a','a',null,{exercise:'Supino reto'})],sets:[{workout_source_record_id:'synthetic-workout-a',muscle_group:'Peito'}],
    polarSessions:[{workout_date:'2025-04-02',duration_minutes:40}],workoutEvidence:[{workout_source_record_id:'synthetic-workout-a',duration_minutes:40}]};
  const result=model(data).training;assert.deepEqual(result.groups,[]);assert.deepEqual(result.rows[0].groups,[]);assert.equal(result.sessions,1);assert.equal(result.recordedMinutes,30);
});
test('exercise parent/date mismatches and ambiguous exercise identity cannot fabricate group evidence',()=>{
  const a=exercise('a','a','Peito'),data={workouts:[workout('a','2025-04-02')],exercises:[a,{...a,muscle_group:'Costas'},exercise('missing','missing','Pernas'),exercise('date','a','Ombros',{workout_date:'2025-04-03'})]};
  const result=model(data).training;assert.deepEqual(result.groups,[]);assert.equal(result.sessions,1);assert.equal(result.partial,true);
});
test('latest three sessions contain date, explicit type/groups and duration without leaving the window',()=>{
  const workouts=Array.from({length:5},(_,i)=>workout(String(i),`2025-04-0${i+1}`,{muscle_groups:['Grupo sintético'],duration_minutes:20+i}));
  const result=model({workouts:[workout('outside','2025-03-31'),...workouts]}).training;
  assert.deepEqual(result.latestSessions.map(row=>row.date),['2025-04-05','2025-04-04','2025-04-03']);
  assert.equal(result.latestSessions[0].type,'Sessão sintética');assert.deepEqual(result.latestSessions[0].groups,['Grupo sintético']);assert.equal(result.latestSessions[0].duration,24);
});
test('historical last workout and gaps remain explicit without claiming the person did not train',()=>{
  const result=model({workouts:[workout('old','2025-03-31',{muscle_groups:['Grupo anterior']})]}).training;
  assert.equal(result.sessions,0);assert.equal(result.latest.inPeriod,false);assert.equal(result.latestSessions.length,0);assert.equal(result.daysSinceLast,30);
  assert.match(result.gapLabel,/30 dias desde o último treino registrado/);assert.match(result.gapLabel,/fora do período/);assert.equal(result.missingGroups[0].label,'Grupo anterior');
  assert.match(result.missingGroups[0].note,/não significa que não foi treinado/);
});
test('missing-group notices require previously recorded explicit groups and exclude future groups',()=>{
  const workouts=[workout('old','2025-03-01',{muscle_groups:['Grupo anterior','Grupo presente']}),workout('now','2025-04-02',{muscle_groups:['Grupo presente']}),workout('future','2025-05-01',{muscle_groups:['Grupo futuro']})];
  const result=model({workouts}).training;assert.deepEqual(result.missingGroups.map(group=>group.label),['Grupo anterior']);
  assert.equal(result.missingGroups[0].lastDate,'2025-03-01');assert.equal(result.missingGroups[0].sessions,0);assert.equal(result.missingGroups[0].days,0);
  assert.deepEqual(model({workouts:[workout('now','2025-04-02')]}).training.missingGroups,[]);
});
test('exercise outages preserve known session totals and explicit workout groups but expose partial detail',()=>{
  const data={workouts:[workout('old','2025-03-01',{muscle_groups:['Grupo anterior']}),workout('now','2025-04-02',{muscle_groups:['Grupo atual']})],exercises:[exercise('a','now','Grupo não carregado')]};
  const result=model(data,{...status,exercises:'error'}).training;
  assert.equal(result.sessions,1);assert.equal(result.recordedMinutes,30);assert.equal(result.status,'partial');assert.equal(result.groupsStatus,'error');assert.equal(result.detailsAvailable,false);
  assert.deepEqual(result.groups.map(group=>group.label),['Grupo atual']);assert.deepEqual(result.missingGroups,[]);
  assert.equal(model(data,{...status,sets:'error'}).training.status,'ready','sets are not an input to this session-only summary');
});
test('all source input arrays and rows stay unchanged and deterministic',()=>{
  const data=freeze({labs:[lab('2025-04-20',4),lab('2025-03-01',3)],workouts:[workout('b','2025-04-03'),workout('a','2025-04-02',{muscle_groups:['Peito','Ombros']})],exercises:[exercise('a','a','Peito')]});
  const before=JSON.stringify(data),first=model(data);assert.equal(JSON.stringify(data),before);assert.deepEqual(first,model(data));
  assert.deepEqual(Object.keys(first).sort(),['bounds','labs','mode','reason','today','training','valid']);
});

console.log(`Health dashboard context: ${checks} synthetic, read-only checks passed.`);

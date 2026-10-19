import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {dashboardLabs,labResultReading,compareLabResults,knownLabMetadata} from '../src/health-dashboard-labs.js';
import {makeReviewedBloodCountPair} from './reviewed-blood-count-fixture.mjs';

// Entirely synthetic rows and existing synthetic documentary fixtures only.
// This contract does not create reviews, change source values or select a
// population from a conditional reference. Raw loader rows are its input.
const bounds={start:'2025-04-01',end:'2025-04-30'};
const row=(id,date,value,extra={})=>({source_record_id:`shared-synthetic-${id}`,collection_date:date,biomarker:'Synthetic marker',
  laboratory:'Synthetic laboratory',unit:'mg/L',method:'Synthetic method',result_numeric:value,result_raw:String(value),reference_range:'2 a 8',...extra});
const prior=extra=>row('prior','2025-03-20',4,extra),latest=extra=>row('latest','2025-04-20',5,extra);
const model=rows=>dashboardLabs({labs:rows},{labs:'ready'},bounds);
const comparisonKeys=['comparable','rangeComparable','sameMethod','sameReference','comparisonReason','comparisonReasonLabel','label','status','delta','comparisonLabel'];
const comparisonOnly=item=>Object.fromEntries(comparisonKeys.map(key=>[key,item[key]]));
const readingOnly=({inPeriod,periodLabel,...reading})=>reading;
const blocked=(current,previous,reason,options)=>{
  const result=compareLabResults(current,previous,options);
  assert.equal(result.comparable,false);assert.equal(result.rangeComparable,false);assert.equal(result.delta,null);
  assert.equal(result.label,'sem comparação');assert.equal(result.status,'sem comparação');
  assert.equal(result.comparisonReason,reason);assert.ok(result.comparisonReasonLabel.length>0);
  return result;
};
let count=0;const test=(name,run)=>{run();count++;console.log(`ok ${count} - ${name}`);};

const baselineVariants=[{}, {result_raw:'< 5'},{result_raw:'5(1)'},{result_numeric:6},{numeric_kind:'censored'},
  {source_payload:{numeric_kind:'lower_bound'}},{unit:'Não informado'},{laboratory:'Não informado'},{method:'Não informado'},
  {reference_range:'Não informado'},{reference_range:'Homens: 2 a 8; Mulheres: 1 a 7'},
  {reference_range:'Homens: 2 a 8 mg/L'},{reference_range:'<= 8 mg/L'},{reference_range:'> 2 mg/L'},
  {result_raw:'12.345',result_numeric:12345,unit:'/mm3',numeric_kind:'exact',reference_range:'4000 a 10000'},
  {result_raw:'12.345',result_numeric:12345,unit:'/mm3',reference_range:'4000 a 10000'}];
const baselineDatasets=()=>{
  const datasets=baselineVariants.map((extra,index)=>[row(`prior-${index}`,'2025-03-20',4,extra),row(`latest-${index}`,'2025-04-20',5,extra)]);
  datasets.push([], [row('duplicate','2025-04-20',5),row('duplicate','2025-04-20',5)],
    [row('conflict','2025-04-20',5),row('conflict','2025-04-20',6)],
    [row('future','2025-05-01',6),row('invalid','2025-02-30',5)],
    [row('unknown-id','2025-03-20',4,{source_record_id:null}),row('unknown-id','2025-03-20',4,{source_record_id:null}),row('current','2025-04-20',5)]);
  for(const marker of ['Hemoglobina','Hematócrito']){const {previous,current}=makeReviewedBloodCountPair(marker);datasets.push([previous,current]);}
  return datasets;
};

test('115 complete dashboard outputs equal the pre-export synthetic baseline',()=>{
  const outputs=['ready','empty','loading','error','unavailable'].flatMap(state=>baselineDatasets().map(labs=>dashboardLabs({labs},{labs:state},bounds)));
  assert.equal(outputs.length,115);
  // Captured from the unchanged dashboard before adding shared exports.
  assert.equal(createHash('sha256').update(JSON.stringify(outputs)).digest('hex'),'61d4b8f2d0755e078a968487b907ebe9069c27ce5e41444bb5cc9dd3ab2b5e0a');
});

test('shared readings reuse every existing dashboard observation field',()=>{
  for(const patch of baselineVariants){
    const source=latest(patch),reading=labResultReading(source),dashboard=model([source]).history[0];
    assert.deepEqual(readingOnly(reading),readingOnly(dashboard));
    assert.equal(reading.inPeriod,false);assert.equal(reading.periodLabel,'Fora do período selecionado');
  }
});

test('ordinary comparable pair returns exactly the dashboard comparison contract',()=>{
  const current=latest(),previous=prior(),result=compareLabResults(current,previous);
  assert.deepEqual(result,comparisonOnly(model([previous,current]).items[0]));
  assert.equal(result.comparable,true);assert.equal(result.delta,1);assert.equal(result.rangeComparable,true);
});

test('every existing comparison gate and reference label remains identical',()=>{
  const variants=[{}, {method:null},{method:'Different synthetic method'},{reference_range:null},{reference_range:'1 a 9'},
    {result_raw:'< 5'},{result_raw:'5(1)'},{result_numeric:6},{numeric_kind:'censored'},{reference_range:'Não informado'}];
  for(const patch of variants)for(const which of ['current','previous']){
    const current=latest(which==='current'?patch:{}),previous=prior(which==='previous'?patch:{});
    assert.deepEqual(compareLabResults(current,previous),comparisonOnly(model([previous,current]).items[0]));
  }
});

test('metadata placeholders are never treated as known identities or parameters',()=>{
  for(const value of [undefined,null,'',' ','Não informado','NÃO INFORMADA','não disponível','unknown','unknown method','—','N/A','-']){
    assert.equal(knownLabMetadata(value),false);
  }
  for(const value of ['Synthetic marker','Synthetic laboratory','mg/L','Synthetic method','2 a 8'])assert.equal(knownLabMetadata(value),true);
  for(const [field,reason]of [['biomarker','unknown_biomarker'],['laboratory','unknown_laboratory'],['unit','unknown_unit'],['method','unknown_method'],['reference_range','different_or_missing_reference']]){
    for(const value of [null,'Não informado','unknown','—']){
      blocked(latest({[field]:value}),prior({[field]:value}),reason);
      blocked(latest({[field]:value}),prior(),reason);
      blocked(latest(),prior({[field]:value}),reason);
    }
  }
});

test('pair identity is checked without introducing aliases or unit conversions',()=>{
  for(const [field,value,reason]of [['biomarker','Another marker','different_biomarker'],['laboratory','Another laboratory','different_laboratory'],
    ['unit','g/L','different_unit'],['unit','MG/L','different_unit'],['unit','mg / L','different_unit']]){
    blocked(latest({[field]:value}),prior(),reason);
  }
  blocked(latest({biomarker:'Hb'}),prior({biomarker:'Hemoglobina'}),'different_biomarker');
  blocked(latest({unit:'mU/L'}),prior({unit:'MU/L'}),'different_unit');
  const current=latest({biomarker:'  Sýnthetic  marker ',laboratory:'SYNTHETIC LÁBORATORY',unit:' mg/L '}),previous=prior();
  assert.equal(compareLabResults(current,previous).comparable,true);
  assert.deepEqual(compareLabResults(current,previous),comparisonOnly(model([previous,current]).items[0]));
});

test('numeric and raw disagreement, censoring and unsupported suffixes never become exact',()=>{
  for(const patch of [{result_raw:'6'},{result_raw:'5 g/L'}, ...['< 5','>5','≤5','≥5','Inferior a 5','5(1)','5(2)','5*','5[1]','5e0','5,0 (1)','Não detectado'].map(result_raw=>({result_raw}))]){
    const source=latest(patch),reading=labResultReading(source);
    assert.equal(reading.value,source.result_numeric);assert.equal(reading.rawValue,source.result_raw);
    assert.equal(reading.exactValue,null);assert.equal(reading.referencePosition,'unknown');
    blocked(source,prior(),'non_exact_value');
  }
});

test('non-exact numeric-kind metadata vetoes plain or missing raw values',()=>{
  for(const kind of ['censored','lower_bound','upper_bound','text','unknown','not_exact']){
    for(const raw of ['5',null])for(const metadata of [{numeric_kind:kind},{source_payload:{numeric_kind:kind}}]){
      const source=latest({...metadata,result_raw:raw});assert.equal(labResultReading(source).exactValue,null);
      blocked(source,prior(),'non_exact_value');blocked(latest(),prior({...metadata,result_raw:null}),'non_exact_value');
    }
  }
});

test('the existing accepted numeric forms and null treatment are preserved',()=>{
  for(const [raw,value]of [['5',5],['5,5',5.5],['5.5 mg/L',5.5],['+5',5],['-5',-5],['0',0],[null,5]]){
    const reading=labResultReading(latest({result_raw:raw,result_numeric:value}));assert.equal(reading.exactValue,value);
  }
  for(const value of [null,undefined,'',true,false,NaN,Infinity,-Infinity]){
    assert.equal(labResultReading(latest({result_numeric:value,result_raw:null})).exactValue,null);
  }
  assert.equal(labResultReading(null).exactValue,null);assert.equal(labResultReading().referencePosition,'unknown');
});

test('grouped whole counts require the existing exact declaration and original count unit',()=>{
  const base={result_numeric:12345,result_raw:'12.345',unit:'/mm3',reference_range:'4000 a 10000'};
  assert.equal(labResultReading(latest(base)).exactValue,null);
  for(const metadata of [{numeric_kind:'exact'},{source_payload:{numeric_kind:'exact'}}]){
    assert.equal(labResultReading(latest({...base,...metadata})).exactValue,12345);
  }
  for(const patch of [{numeric_kind:'censored'},{numeric_kind:'exact',unit:'mg/L'},{numeric_kind:'exact',result_numeric:12.345},
    {numeric_kind:'exact',result_raw:'<12.345'},{numeric_kind:'exact',result_raw:'12.345(1)'},{numeric_kind:'exact',result_raw:'12,345'}]){
    assert.equal(labResultReading(latest({...base,...patch})).exactValue,null);
  }
});

test('single qualified references retain their printed scope and dashboard position',()=>{
  for(const scope of ['Homens','Mulheres','Adultos','Sexo feminino','Maiores de 21 anos','30 a 45 anos']){
    const reading=labResultReading(latest({reference_range:`${scope}: 2 a 8 mg/L`}));
    assert.equal(reading.referenceScope,scope);assert.equal(reading.interval.scope,scope);
    assert.equal(reading.referencePosition,'within');assert.ok(reading.currentReferenceLabel.endsWith(scope));
  }
  blocked(latest({reference_range:'Mulheres: 2 a 8'}),prior({reference_range:'Homens: 2 a 8'}),'different_or_missing_reference');
});

test('conditional multi-population references remain text while an identical reference can support a numeric delta',()=>{
  for(const reference of ['Homens: 2 a 8; Mulheres: 1 a 7','Adultos: 2 a 8; idosos: 3 a 9','Normal: > 3; limítrofe: 2 a 3']){
    const current=latest({reference_range:reference}),previous=prior({reference_range:reference}),reading=labResultReading(current);
    assert.equal(reading.reference,reference);assert.equal(reading.interval,null);assert.equal(reading.referenceScope,null);
    assert.equal(reading.referencePosition,'unknown');assert.equal(reading.currentReferenceLabel,null);
    const result=compareLabResults(current,previous);assert.equal(result.comparable,true);assert.equal(result.delta,1);
    assert.equal(result.sameReference,true);assert.equal(result.rangeComparable,false);assert.equal(result.label,'sem comparação');
    assert.deepEqual(result,comparisonOnly(model([previous,current]).items[0]));
  }
});

test('equivalent single intervals follow the existing parser without new reference normalization',()=>{
  const current=latest({reference_range:'2 a 8 mg/L'}),previous=prior({reference_range:'2 - 8 mg/L'});
  const result=compareLabResults(current,previous);assert.equal(result.comparable,true);assert.equal(result.rangeComparable,true);
  assert.deepEqual(result,comparisonOnly(model([previous,current]).items[0]));
  blocked(latest({reference_range:'2 a 8 mg/L; repetir após coleta'}),previous,'different_or_missing_reference');
});

test('current reference position remains independent from whether a pair is comparable',()=>{
  const current=latest({result_numeric:9,result_raw:'9'}),previous=prior({method:null});
  blocked(current,previous,'unknown_method');assert.equal(labResultReading(current).referencePosition,'above');
  assert.equal(labResultReading(current).currentReferenceLabel,'Acima da faixa transcrita no laudo');
});

test('collection dates must exist, be valid calendar dates and be ordered',()=>{
  for(const date of [null,undefined,'','Não informado','2025-02-30','2025-13-01','20/04/2025','2025-4-20','2025-04-20garbage']){
    blocked(latest({collection_date:date}),prior(),'invalid_collection_date');
    blocked(latest(),prior({collection_date:date}),'invalid_collection_date');
  }
  blocked(latest(),prior({collection_date:'2025-04-20'}),'non_chronological_collections');
  blocked(latest(),prior({collection_date:'2025-04-21'}),'non_chronological_collections');
  assert.equal(compareLabResults(latest({collection_date:'2025-04-20T12:00:00Z'}),prior({collection_date:'2025-03-20T08:00:00Z'})).comparable,true);
});

test('ambiguity and identity conflicts always withhold a delta',()=>{
  blocked(latest(),prior(),'ambiguous_collection',{ambiguous:true});
  for(const field of ['identityConflict','ambiguous']){
    blocked(latest({[field]:true}),prior(),'ambiguous_collection');blocked(latest(),prior({[field]:true}),'ambiguous_collection');
  }
  blocked(latest({source_record_id:prior().source_record_id}),prior(),'ambiguous_collection');
  blocked(latest({source_record_id:null,collection_date:prior().collection_date}),prior({source_record_id:null}),'non_chronological_collections');
});

test('an absent predecessor is an explicit noncomparison',()=>{
  for(const previous of [undefined,null]){
    const result=blocked(latest(),previous,'no_previous');assert.equal(result.sameMethod,false);assert.equal(result.sameReference,false);
  }
  assert.deepEqual(compareLabResults(latest(),null),comparisonOnly(model([latest()]).items[0]));
});

test('already valid documentary Hb/Ht reviews retain the exact existing interpretation',()=>{
  for(const marker of ['Hemoglobina','Hematócrito']){
    const {previous,current}=makeReviewedBloodCountPair(marker),before=structuredClone([previous,current]);
    const reading=labResultReading(previous),result=compareLabResults(current,previous);
    assert.equal(reading.rawValue,previous.result_raw);assert.equal(reading.exactValue,previous.result_numeric);
    assert.equal(reading.reference,previous.reference_range);assert.equal(reading.referencePosition,'above');
    assert.equal(result.comparable,true);assert.deepEqual(result,comparisonOnly(model([previous,current]).items[0]));
    assert.deepEqual([previous,current],before);
  }
});

test('a missing or conflicting documentary review cannot be synthesized by the shared API',()=>{
  for(const change of [r=>{delete r.reference_verification;},r=>{r.reference_verification.status='unverified';},
    r=>{r.reference_verification.evidence_text+=' altered synthetic text';},r=>{r.numeric_kind='censored';},
    r=>{r.source_payload={numeric_kind:'censored'};},r=>{r.result_numeric+=1;}]){
    const {previous,current}=makeReviewedBloodCountPair();change(previous);
    assert.equal(labResultReading(previous).exactValue,null);blocked(current,previous,'non_exact_value');
  }
});

test('readings, comparisons and repeated calls do not mutate even deeply frozen inputs',()=>{
  const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  const pairs=[[prior(),latest()],...['Hemoglobina','Hematócrito'].map(marker=>{const {previous,current}=makeReviewedBloodCountPair(marker);return [previous,current];})];
  for(const pair of pairs){
    const before=structuredClone(pair);freeze(pair);const [previous,current]=pair;
    assert.deepEqual(labResultReading(current),labResultReading(current));
    assert.deepEqual(compareLabResults(current,previous),compareLabResults(current,previous));
    labResultReading(current).interval.lower=-999;
    assert.notEqual(labResultReading(current).interval.lower,-999);assert.deepEqual(pair,before);
  }
});

console.log(`Shared laboratory reading: ${count} synthetic checks passed.`);

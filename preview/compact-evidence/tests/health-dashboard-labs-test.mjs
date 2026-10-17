import assert from 'node:assert/strict';
import {dashboardLabs} from '../src/health-dashboard-labs.js';

// Entirely synthetic. No patient values, database snapshots, dates, or documents.
const bounds={start:'2025-04-01',end:'2025-04-30'};
const row=(id,date,value,extra={})=>({source_record_id:`synthetic-${id}`,collection_date:date,biomarker:'Marcador A',
  laboratory:'Laboratório sintético',unit:'mg/L',method:'Método sintético',result_numeric:value,result_raw:String(value),reference_range:'2 a 8',...extra});
const model=(rows,status='ready')=>dashboardLabs({labs:rows},{labs:status},bounds);
const one=extra=>model([row('a','2025-04-20',9,extra)]).items[0];
let count=0;const test=(name,run)=>{run();count++;console.log(`ok ${count} - ${name}`);};

test('four old approaches cannot become a direction in the latest collection',()=>{
  const rows=[];
  for(let i=0;i<4;i++)rows.push(row(`old-a-${i}`,'2023-02-01',12,{biomarker:`Histórico ${i}`}),row(`old-b-${i}`,'2024-03-01',9,{biomarker:`Histórico ${i}`}));
  rows.push(row('latest','2025-04-20',5,{biomarker:'Atual'}));
  const m=model(rows);assert.equal(m.items.filter(r=>r.label==='aproximou da referência').length,4);
  assert.equal(m.latestCollectionDate,'2025-04-20');assert.equal(m.latestCollectionSummary.near,0);assert.equal(m.latestCollectionSummary.away,0);
  assert.equal(m.latestCollectionSummary.attention,0);assert.equal(m.latestCollectionSummary.within,1);assert.equal(m.latestCollectionCount,1);
  assert.equal(m.collectionCountAll,3);assert.equal(m.historicalCollectionCount,2);assert.equal(m.knownCount,9);
  assert.equal(m.latestCollectionItems.length,1);assert.equal(m.latestCollectionRows.length,1);assert.equal(m.allItems,m.items);
});

test('latest collection is explicit even outside the chosen recent window',()=>{
  const m=model([row('old','2025-02-20',4),row('later','2025-03-20',5),row('future','2025-05-01',6)]);
  assert.equal(m.count,0);assert.equal(m.latestCollectionDate,'2025-03-20');assert.equal(m.latestCollectionCount,1);
  assert.equal(m.latestCollectionItems[0].inPeriod,false);assert.equal(m.collectionCountAll,2);assert.equal(m.latestCollectionSummary.comparable,1);
});

test('current reference position stays independent from a blocked comparison',()=>{
  const m=model([row('prior','2025-03-20',4,{method:null}),row('latest','2025-04-20',9)]),item=m.items[0];
  assert.equal(item.comparable,false);assert.equal(item.label,'sem comparação');assert.equal(item.referencePosition,'above');
  assert.match(item.currentReferenceLabel,/Acima da faixa transcrita no laudo/);assert.match(item.comparisonReasonLabel,/Método não informado na coleta anterior/);
  assert.equal(m.latestCollectionSummary.attention,1);assert.equal(m.latestCollectionSummary.above,1);
});

test('one explicitly scoped range preserves qualification and never chooses among populations',()=>{
  for(const scope of ['Homens','Mulheres','Adultos','Masculino','Sexo feminino','Maiores de 21 anos','30 a 45 anos']){
    const item=one({reference_range:`${scope}: 2 a 8 mg/L`});assert.equal(item.referencePosition,'above');
    assert.equal(item.referenceScope,scope);assert.ok(item.currentReferenceLabel.endsWith(scope));
  }
  for(const reference of ['Homens: 2 a 8; Mulheres: 1 a 6','Adultos: 2 a 8; idosos: 3 a 9','30 a 45 anos: 2 a 8; 46 a 60 anos: 3 a 9']){
    const item=one({reference_range:reference});assert.equal(item.referencePosition,'unknown');assert.equal(item.currentReferenceLabel,null);
  }
});

test('scope is part of interval identity and cannot silently change between collections',()=>{
  const m=model([row('a','2025-03-20',3,{reference_range:'Homens: 2 a 8'}),row('b','2025-04-20',4,{reference_range:'Mulheres: 2 a 8'})]);
  assert.equal(m.items[0].comparable,false);assert.equal(m.items[0].comparisonReason,'different_or_missing_reference');
});

test('only the exact dilution footnote can follow a single interval',()=>{
  const safe=one({reference_range:'Homens: 2 a 8 mg/L; resultado confirmado após diluição'});assert.equal(safe.referencePosition,'above');
  for(const tail of ['; alvo abaixo de 5','; idosos: 4 a 10','; repetir se > 9','; referência alterada em 01/01/2025']){
    assert.equal(one({reference_range:`Homens: 2 a 8 mg/L; resultado confirmado após diluição${tail}`}).referencePosition,'unknown');
  }
});

test('a percent unit without a space is exact and unit mismatches stay rejected',()=>{
  assert.equal(one({unit:'%',reference_range:'2,0 a 8,0%'}).referencePosition,'above');
  assert.equal(one({unit:'mg/L',reference_range:'2,0 a 8,0%'}).referencePosition,'unknown');
  assert.equal(one({unit:'%',reference_range:'2,0 a 8,0%; desejável abaixo de 5%'}).referencePosition,'unknown');
});

test('explicit textual inequalities preserve inclusive and exclusive endpoints',()=>{
  for(const [reference,value,position]of [['Inferior a 8 mg/L',8,'above'],['Superior a 2 mg/L',2,'below'],['Até 8 mg/L',8,'within'],['Maior ou igual a 2 mg/L',2,'within'],['Menor ou igual a 8 mg/L',8,'within']]){
    assert.equal(one({result_numeric:value,result_raw:String(value),reference_range:reference}).referencePosition,position);
  }
  assert.equal(one({reference_range:'Normal: maior que 3; limítrofe 2 a 3'}).referencePosition,'unknown');
});

test('grouped whole counts require exact extraction, count units and numeric agreement',()=>{
  const base={result_numeric:12345,result_raw:'12.345',unit:'/mm3',reference_range:'4000 a 10000'};
  assert.equal(one(base).referencePosition,'unknown');
  assert.equal(one({...base,numeric_kind:'exact'}).referencePosition,'above');
  assert.equal(one({...base,source_payload:{numeric_kind:'exact'}}).referencePosition,'above');
  for(const extra of [{numeric_kind:'censored'},{numeric_kind:'exact',result_numeric:12.345},{numeric_kind:'exact',unit:'mg/L'},
    {numeric_kind:'exact',result_raw:'<12.345'},{numeric_kind:'exact',result_raw:'12.345(1)'},{numeric_kind:'exact',result_raw:'12,345'}]){
    assert.equal(one({...base,...extra}).exactValue,null);
  }
});

test('non-exact extraction metadata vetoes plain or absent raw numeric values',()=>{
  for(const kind of ['censored','lower_bound','upper_bound','text','unknown'])for(const raw of ['9',null])for(const metadata of [{numeric_kind:kind},{source_payload:{numeric_kind:kind}}]){
    const m=model([row('prior','2025-03-20',12),row('latest','2025-04-20',9,{result_raw:raw,...metadata})]),item=m.items[0];
    assert.equal(item.value,9);assert.equal(item.rawValue,raw);assert.equal(item.exactValue,null);assert.equal(item.referencePosition,'unknown');
    assert.equal(item.comparable,false);assert.equal(item.delta,null);assert.equal(item.comparisonReason,'non_exact_value');
    assert.equal(m.latestCollectionSummary.above,0);assert.equal(m.latestCollectionSummary.near,0);
  }
  assert.equal(one({numeric_kind:'exact'}).exactValue,9);
  assert.equal(one({numeric_kind:'exact',result_raw:'< 9'}).exactValue,null);
});

test('placeholder references never establish a matching report reference',()=>{
  for(const reference of ['Não informado','unknown','—','N/A']){
    const item=model([row('prior','2025-03-20',12,{reference_range:reference}),row('latest','2025-04-20',9,{reference_range:reference})]).items[0];
    assert.equal(item.reference,reference);assert.equal(item.previous.reference,reference);assert.equal(item.sameReference,false);
    assert.equal(item.comparable,false);assert.equal(item.delta,null);assert.equal(item.comparisonReason,'different_or_missing_reference');
    assert.equal(item.comparisonReasonLabel,'Referências não informadas nas duas coletas.');
  }
});

test('unverified duplicate identity in the prior collection is reported as ambiguity',()=>{
  const prior=row('prior','2025-03-20',12,{source_record_id:null});
  const item=model([prior,{...prior},row('latest','2025-04-20',9)]).items[0];
  assert.equal(item.previous,null);assert.equal(item.comparable,false);assert.equal(item.delta,null);
  assert.equal(item.comparisonReason,'ambiguous_collection');assert.match(item.comparisonReasonLabel,/múltiplos resultados/);
  assert.deepEqual(item.ambiguousDates,['2025-03-20']);assert.equal(item.ambiguous,false);
});

test('reference limits, missing historical methods and result footnotes are not guessed',()=>{
  const m=model([row('prior','2025-03-20',4,{reference_range:null}),row('latest','2025-04-20',9)]);
  assert.equal(m.items[0].comparable,false);assert.match(m.items[0].comparisonReasonLabel,/Referência não informada na coleta anterior/);
  assert.equal(one({result_raw:'9(1)'}).exactValue,null);
  assert.equal(one({result_raw:'Inferior a 9',numeric_kind:'exact'}).exactValue,null);
});

test('summary keeps positions, printed flags and ambiguity transparent',()=>{
  const m=model([row('a','2025-04-20',5),row('b','2025-04-20',null,{biomarker:'B',result_raw:'Ausente',reference_range:null,flag:'H'}),
    row('c','2025-04-20',10,{biomarker:'C'}),row('c','2025-04-20',12,{biomarker:'C'})]);
  assert.equal(m.latestCollectionCount,4);assert.equal(m.latestCollectionSummary.count,3);assert.equal(m.latestCollectionSummary.results,4);
  assert.equal(m.latestCollectionSummary.within,1);assert.equal(m.latestCollectionSummary.unclassified,2);assert.equal(m.latestCollectionSummary.reportedFlags,1);
  assert.equal(m.latestCollectionSummary.attention,2);assert.equal(m.latestCollectionSummary.ambiguous,1);
  const c=m.items.find(r=>r.biomarker==='C');assert.equal(c.currentReferenceLabel,null);assert.match(c.comparisonReasonLabel,/múltiplos resultados/);
});

test('empty and unavailable newest-collection totals remain different',()=>{
  const empty=model([]);assert.equal(empty.latestCollectionCount,0);assert.equal(empty.collectionCountAll,0);assert.equal(empty.historicalCollectionCount,0);
  for(const state of ['error','unavailable','loading']){
    const failed=model([row('stale','2025-04-20',4)],state);assert.equal(failed.latestCollectionCount,null);assert.equal(failed.latestCollectionSummary.count,null);
    assert.equal(failed.collectionCountAll,null);assert.equal(failed.historicalCollectionCount,null);assert.equal(failed.latestCollectionDate,null);
  }
});

test('laboratories, units, text results and all older observations stay separately readable',()=>{
  const rows=[row('a','2025-03-20',3),row('b','2025-04-20',4,{laboratory:'Laboratório B'}),row('c','2025-04-20',5,{unit:'g/L'}),
    row('d','2025-04-20',null,{biomarker:'Texto',result_raw:'Não detectado'})];
  const before=JSON.stringify(rows),m=model(rows);assert.equal(m.items.length,4);assert.equal(m.history.length,4);assert.equal(m.latestCollectionCount,3);
  assert.ok(m.items.every(i=>i.comparisonReason==='no_previous'));assert.equal(JSON.stringify(rows),before);assert.deepEqual(model(rows),m);
});

console.log(`Health dashboard labs: ${count} synthetic checks passed.`);

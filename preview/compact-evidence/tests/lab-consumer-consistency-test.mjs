import assert from 'node:assert/strict';
import {makeReviewedBloodCountPair} from './reviewed-blood-count-fixture.mjs';

globalThis.location={search:'?fixture=1'};
const {labResultReading,compareLabResults}=await import('../src/health-dashboard-labs.js');
const {labGroups,labCohorts,labCohortPoints,labReferenceStatus,labResultText}=await import('../src/labs-layout-v2.js');
const {laboratoryReport}=await import('../src/reports-model.js');
const {labTrend,contextChart}=await import('../src/health-context.js');
const {homeCockpitModel,renderHomeCockpit}=await import('../src/home-cockpit.js');
const {consultationLines}=await import('../src/integrated-review.js');

// Invented observations only. The Hb/Ht positive cases reuse the existing
// synthetic documentary fixture; consumers never manufacture review evidence.
const bounds={start:'2025-03-01',end:'2025-04-30'},today=bounds.end;
const status=Object.fromEntries(['body','segmental','nutrition','sourceMetrics','metrics','workouts','exercises','sets','labs','treatments','polarSessions','goals','meals','waterReferences'].map(key=>[key,'ready']));
const row=(id,date,value,extra={})=>({source_record_id:`synthetic-consumer-${id}`,collection_date:date,
  biomarker:'Marcador sintético',laboratory:'Laboratório sintético',unit:'mg/L',method:'Método sintético',
  result_numeric:value,result_raw:value==null?'Sem resultado numérico':String(value),reference_range:'0 a 8 mg/L',...extra});
const first=()=>row('first','2025-03-10',2),last=()=>row('last','2025-04-20',4);
const report=rows=>laboratoryReport({labs:rows},status,bounds);
const trend=rows=>labTrend(rows,null,bounds);
const sharedPoints=rows=>labCohorts(labGroups(rows)[0]).flatMap(labCohortPoints).sort((a,b)=>a.date.localeCompare(b.date));
const lines=points=>(contextChart(points,{selectable:false}).match(/class="ltsContextLine"/g)||[]).length;
const cockpit=rows=>homeCockpitModel({labs:rows},status,'all',{},today);
const labPanel=rows=>renderHomeCockpit(cockpit(rows)).split('<article class="ltsCockpitPanel labs">')[1]?.split('<article class="ltsCockpitPanel water">')[0]||'';
const panelLines=rows=>(labPanel(rows).match(/class="ltsContextLine"/g)||[]).length;
let count=0;
const test=(name,run)=>{run();count++;console.log(`ok ${count} - ${name}`);};
function samePoints(rows){
  const expected=sharedPoints(rows);
  assert.deepEqual(report(rows).points,expected,'report points use shared numeric and segment contract');
  assert.deepEqual(trend(rows).points,expected,'health-context points use shared numeric and segment contract');
  assert.equal(panelLines(rows),lines(expected),'Home renders the same permitted segments');
  return expected;
}

test('complete same-laboratory evidence permits one descriptive delta across every consumer',()=>{
  const rows=[first(),last()],before=structuredClone(rows),comparison=report(rows).selected,expected=compareLabResults(rows[1],rows[0]);
  assert.equal(expected.comparable,true);assert.equal(comparison.comparable,true);assert.equal(comparison.delta,2);
  assert.equal(comparison.comparisonReason,expected.comparisonReason);assert.equal(comparison.comparisonReasonLabel,expected.comparisonReasonLabel);
  assert.equal(comparison.current,rows[1]);assert.equal(comparison.previous,rows[0]);assert.deepEqual(comparison.history.rows,rows);
  const points=samePoints(rows);assert.equal(points.length,2);assert.equal(lines(points),1);
  assert.deepEqual(Object.keys(points[0]).sort(),['cohort','context','date','raw','row','value']);
  assert.equal(points[0].row,rows[0]);assert.equal(points[0].raw,labResultText(rows[0]));
  const c=cockpit(rows),finding=c.evo.findings.find(f=>f.kind==='labs'),summary=consultationLines(c.r,c.m,c.evo).join('\n');
  assert.match(finding.text,/laboratório, unidade, método e referência registrados/);
  assert.match(finding.detail,/Referência atual: 0 a 8 mg\/L; anterior: 0 a 8 mg\/L/);
  assert.match(finding.detail,/não confirma melhora, piora clínica ou diagnóstico/);
  assert.match(summary,/Referência anterior: 0 a 8 mg\/L/);assert.match(summary,/não confirma melhora ou piora clínica/);
  assert.deepEqual(rows,before,'consumers do not mutate source rows');
});

test('the preceding collection remains readable outside the chosen window',()=>{
  const rows=[{...first(),collection_date:'2024-12-10'},last()],m=report(rows);
  assert.equal(m.rows.length,1);assert.equal(m.selected.history.rows.length,2);
  assert.equal(m.selected.previous,rows[0]);assert.equal(m.selected.baselineOutsideWindow,true);assert.equal(m.selected.delta,2);
});

test('zero is an exact observation while missing numeric values never become zero',()=>{
  const zero=[row('zero-a','2025-03-10',0),row('zero-b','2025-04-20',0)];
  assert.equal(report(zero).selected.delta,0);assert.equal(samePoints(zero).length,2);
  for(const missing of [null,undefined,'']){
    const rows=[first(),last()];rows[1].result_numeric=missing;rows[1].result_raw='Sem resultado numérico';
    const m=report(rows);assert.equal(m.selected.delta,null);assert.equal(m.selected.current,rows[1]);
    assert.equal(samePoints(rows).length,1);assert.equal(m.selected.history.rows.length,2);
  }
});

test('contradictory raw, unreviewed notes, text and censored results agree with the shared rejection',()=>{
  const patches=[{result_raw:'5'},{result_raw:'4(1)'},{result_raw:'4*'},{result_raw:'4 (nota)'},{result_raw:'<4'},
    {result_raw:'≤ 4'},{result_raw:'Inferior a 4'},{result_raw:'Não detectado'},
    {numeric_kind:'censored'},{numeric_kind:'text',result_raw:null},{source_payload:{numeric_kind:'unknown'}}];
  for(const patch of patches){
    const rows=[first(),{...last(),...patch}],before=structuredClone(rows),m=report(rows),expected=compareLabResults(rows[1],rows[0]);
    assert.equal(expected.comparable,false,JSON.stringify(patch));assert.equal(m.selected.comparable,false);assert.equal(m.selected.delta,null);
    assert.equal(m.selected.comparisonReason,expected.comparisonReason);assert.equal(m.selected.current,rows[1]);assert.equal(m.selected.previous,rows[0]);
    assert.equal(labResultReading(rows[1]).exactValue,null);assert.equal(labReferenceStatus(rows[1]).status,'unclassified');
    assert.equal(samePoints(rows).length,1);assert.equal(panelLines(rows),0);assert.equal(m.selected.history.rows.length,2);
    assert.deepEqual(rows,before);
  }
});

test('unknown source, method or unit and differing documented identities never produce a delta',()=>{
  const patches=[{laboratory:null,source:'Relatório sintético',source_file:'inventado.pdf'},
    {laboratory:'Não informado'},{laboratory:'Outro laboratório sintético'},{method:null},{method:'unknown method'},
    {method:'Outro método sintético'},{unit:null},{unit:'unknown'},{unit:'MG/L'}];
  for(const patch of patches){
    const rows=[first(),{...last(),...patch}],m=report(rows),expected=compareLabResults(rows[1],rows[0]);
    assert.equal(expected.comparable,false,JSON.stringify(patch));assert.equal(m.selected.comparable,false);assert.equal(m.selected.delta,null);
    assert.equal(m.selected.comparisonReason,expected.comparisonReason);assert.equal(m.selected.previous,rows[0]);
    assert.equal(lines(m.points),0);assert.equal(lines(trend(rows).points),0);assert.equal(panelLines(rows),0);
    assert.equal(m.selected.history.rows.length,2);
  }
  const rows=[{...first(),method:'HPLC'},{...last(),method:'Cromatografia líquida de alta eficiência (HPLC)'}];
  assert.equal(report(rows).selected.comparisonReason,'different_method','consumers do not expand method aliases');
  assert.equal(panelLines(rows),0);
});

test('different, missing and placeholder references block deltas but preserve exact values and literal context',()=>{
  for(const reference_range of [null,'','Não informado','unknown','—','1 a 9 mg/L','Homens: 0 a 8 mg/L']){
    const rows=[first(),{...last(),reference_range}],m=report(rows),expected=compareLabResults(rows[1],rows[0]);
    assert.equal(m.selected.comparisonReason,'different_or_missing_reference');assert.equal(m.selected.comparable,false);assert.equal(m.selected.delta,null);
    assert.equal(m.selected.comparisonReasonLabel,expected.comparisonReasonLabel);
    assert.equal(m.selected.current.reference_range,reference_range);assert.equal(samePoints(rows).length,2);assert.equal(panelLines(rows),0);
  }
});

test('an intermediate non-exact or incompatible collection is never skipped for an older matching pair',()=>{
  const patches=[{result_raw:'3(1)'},{result_raw:'<3'},{result_numeric:null,result_raw:'Texto sintético'},
    {method:null},{method:'Outro método sintético'},{reference_range:'1 a 9 mg/L'},
    {laboratory:'Outro laboratório sintético'},{unit:'g/L'},
    {method:'Outro método sintético',result_raw:'Texto sintético'},
    {laboratory:'Outro laboratório sintético',result_raw:'Texto sintético'},
    {unit:'g/L',result_raw:'Texto sintético'}];
  for(const patch of patches){
    const intermediate=row('gap','2025-04-01',3,patch),rows=[first(),intermediate,last()],m=report(rows);
    assert.equal(m.selected.previous,intermediate,JSON.stringify(patch));assert.equal(m.selected.previousDate,'2025-04-01');
    assert.equal(m.selected.comparable,false);assert.equal(m.selected.delta,null);assert.equal(m.selected.history.rows.length,3);
    assert.equal(lines(m.points),0,`report cannot bridge ${JSON.stringify(patch)}`);
    assert.equal(lines(trend(rows).points),0,`context cannot bridge ${JSON.stringify(patch)}`);
    assert.equal(panelLines(rows),0,`Home cannot bridge ${JSON.stringify(patch)}`);
  }
});

test('ambiguous current or previous collections keep all candidates without choosing a value',()=>{
  const previous=first(),conflict={...previous,source_record_id:'synthetic-conflict',result_numeric:6,result_raw:'6'},current=last();
  let m=report([previous,conflict,current]);
  assert.equal(m.selected.current,current);assert.equal(m.selected.previous,null);assert.equal(m.selected.previousRows.length,2);
  assert.equal(m.selected.comparisonReason,'ambiguous_collection');assert.equal(m.selected.delta,null);assert.equal(m.selected.history.rows.length,3);
  assert.equal(panelLines([previous,conflict,current]),0);
  m=report([previous,current,{...current,source_record_id:'synthetic-current-conflict',result_numeric:6,result_raw:'6'}]);
  assert.equal(m.selected.current,null);assert.equal(m.selected.latestRows.length,2);assert.equal(m.selected.previous,previous);
  assert.equal(m.selected.history.rows.length,3);assert.equal(m.selected.comparable,false);assert.equal(m.selected.delta,null);
});

test('reviewed synthetic Hb/Ht footnotes remain exact without changing original data or evidence',()=>{
  for(const marker of ['Hemoglobina','Hematócrito']){
    const {previous,current}=makeReviewedBloodCountPair(marker),rows=[previous,current],before=structuredClone(rows),m=report(rows);
    assert.equal(m.selected.comparable,true);assert.equal(m.selected.delta,compareLabResults(current,previous).delta);
    assert.equal(samePoints(rows).length,2);assert.equal(panelLines(rows),1);assert.equal(m.selected.previous.result_raw,previous.result_raw);
    assert.equal(m.selected.previous.reference_verification,previous.reference_verification);assert.deepEqual(rows,before);
    const invalid=[{...previous,reference_verification:null},current];
    assert.equal(report(invalid).selected.comparable,false);assert.equal(samePoints(invalid).length,1);assert.equal(panelLines(invalid),0);
  }
});

test('single-scope and one-sided references stay literal while multiple populations are never chosen',()=>{
  for(const reference_range of ['Até 3 mg/L','Homens: 0 a 3 mg/L']){
    const rows=[{...first(),reference_range},{...last(),reference_range}],c=cockpit(rows),reading=c.evo.domainReadings.labs;
    assert.equal(labResultReading(rows[1]).referencePosition,'above');assert.ok(reading.evidence.includes(reference_range));
    assert.doesNotMatch(reading.evidence,/null|undefined/);assert.equal(samePoints(rows).length,2);
  }
  const reference_range='Homens: 0 a 3 mg/L; Mulheres: 0 a 8 mg/L',rows=[{...first(),reference_range},{...last(),reference_range}];
  assert.equal(labResultReading(rows[1]).referencePosition,'unknown');assert.equal(labReferenceStatus(rows[1]).status,'unclassified');
  const c=cockpit(rows),summary=consultationLines(c.r,c.m,c.evo).join('\n');
  assert.equal(c.evo.labReferenceRows.length,0);assert.ok(summary.includes(reference_range));
  assert.doesNotMatch(c.evo.domainReadings.labs?.meaning||'',/acima|abaixo|dentro da faixa/);
});

test('an unavailable source exposes neither stale values nor synthetic zeros',()=>{
  const m=laboratoryReport({labs:[first(),last()]},{labs:'error'},bounds);
  assert.equal(m.available,false);assert.deepEqual(m.points,[]);assert.deepEqual(m.comparisons,[]);
});
test('source units and laboratory context cannot inject HTML in a comparable detail',()=>{
  const unit='<img src=x onerror=alert(1)>',reference_range='0 a 8';
  const rows=[{...first(),unit,reference_range},{...last(),unit,reference_range}];
  assert.equal(report(rows).selected.comparable,true);
  const html=renderHomeCockpit(cockpit(rows));
  assert.doesNotMatch(html,/<img src=x onerror/);
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
});
console.log(`Laboratory consumer consistency: ${count} synthetic cases passed.`);

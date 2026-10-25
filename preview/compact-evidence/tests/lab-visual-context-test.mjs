import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeReviewedBloodCountPair} from './reviewed-blood-count-fixture.mjs';
globalThis.location={search:'?fixture=1'};
const {state}=await import('../src/core.js');
const {labGroups,labCohorts,labCohortComparison,labChartModel,labPointChart,renderProductLabs}=await import('../src/labs-layout-v2.js');

// Invented examples, not copied from any owner record or screenshot.
const method='Método sintético com uma descrição deliberadamente longa para verificar leitura integral no celular';
const row=(id,date,value,extra={})=>({source_record_id:`synthetic-visual-lab-${id}`,collection_date:date,
  biomarker:'Marcador visual sintético',laboratory:'Laboratório sintético',unit:'u/L',method,
  result_numeric:value,result_raw:String(value),reference_range:'42 a 60 u/L',...extra});
const pair=(extra={})=>[row('first','2025-01-10',61.1,extra),row('last','2025-05-20',61.7,extra)];
const cohort=(rows,evidence=rows)=>labCohorts(labGroups(rows,evidence)[0]).find(c=>c.all.includes(rows[0]));
const model=rows=>labChartModel(cohort(rows));
const lineCount=html=>(html.match(/class="ltsDepthLine"/g)||[]).length;
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
let count=0;const test=(name,run)=>{run();count++;console.log(`ok ${count} - ${name}`);};

test('production and preview use byte-identical scoped lab sources and styles',()=>{
  for(const path of ['src/labs-layout-v2.js','labs-model-v2.css'])assert.equal(readFileSync(new URL(`../${path}`,import.meta.url),'utf8'),readFileSync(new URL(`../../../v2/${path}`,import.meta.url),'utf8'));
});
test('complete eligible cohorts include the finite reference interval, not an exaggerated observed-only scale',()=>{
  const c=cohort(pair()),m=labChartModel(c);
  assert.equal(m.comparison.comparable,true);assert.deepEqual(m.comparison,labCohortComparison(c));
  assert.equal(m.band.lower,42);assert.equal(m.band.upper,60);assert.equal(m.band.unit,'u/L');
  assert.ok(m.axis.min<42&&m.axis.max>61.7);assert.ok(m.axis.min>0,'no forced zero baseline');
  assert.ok((61.7-61.1)/(m.axis.max-m.axis.min)<.04,'small numeric movement occupies a small part of the graph');
  const html=labPointChart(c);assert.equal(lineCount(html),1);assert.match(html,/class="ltsLabReferenceBand"/);
  assert.match(html,/61,1 u\/L/);assert.match(html,/61,7 u\/L/);assert.match(html,/10\/01\/2025/);assert.match(html,/20\/05\/2025/);
  assert.match(html,/Faixa do laudo · 42 a 60 u\/L/);assert.match(html,/Não é uma meta individual/);
});
test('a band accepts only shared-parser equivalence, preserving the printed first reference',()=>{
  const rows=pair();rows[1].reference_range='42 - 60 u/L';const m=model(rows);
  assert.equal(m.band.reference,'42 a 60 u/L');assert.equal(m.comparison.rangeComparable,true);
  rows[1].reference_range='Homens: 42 a 60 u/L';assert.equal(model(rows).band,null);assert.equal(model(rows).comparison.comparable,false);
});
test('conditional, malformed, wrong-unit and one-sided references never become finite bands',()=>{
  for(const reference_range of ['Homens: 42 a 60; Mulheres: 40 a 58','42 a 60; conferir após coleta','42 a 60 mg/L','Até 60 u/L','> 42 u/L','42 a 42 u/L','60 a 42 u/L']){
    const rows=pair({reference_range}),c=cohort(rows),m=labChartModel(c);
    assert.equal(m.band,null,reference_range);assert.equal(m.comparison.comparable,true,'identical textual reference still follows the original numeric comparison contract');
    assert.equal(lineCount(labPointChart(c)),1);assert.doesNotMatch(labPointChart(c),/class="ltsLabReferenceBand"/);
  }
});
test('incomplete metadata and reference equality fail closed without manufacturing a delta',()=>{
  for(const patch of [{method:null},{method:'unknown method'},{laboratory:null},{unit:null},{reference_range:null},{reference_range:'Não informado'}]){
    const rows=pair(patch),m=model(rows);assert.equal(m.band,null,JSON.stringify(patch));assert.equal(m.comparison.comparable,false);
  }
  const rows=pair();rows[1].reference_range='40 a 61 u/L';const m=model(rows);
  assert.equal(m.band,null);assert.equal(m.comparison.comparable,false);assert.equal(lineCount(labPointChart(cohort(rows))),0);
});
test('single points and rejected exact readings never borrow a band from a readable neighbor',()=>{
  const rows=pair();assert.equal(model([rows[0]]).band,null);assert.equal(lineCount(labPointChart(cohort([rows[0]]))),0);
  for(const patch of [{result_raw:'<61.7'},{result_raw:'61.7(1)'},{numeric_kind:'censored'},{result_raw:'62.7'},{collection_date:'2025-02-30'}]){
    const changed=[rows[0],{...rows[1],...patch}],m=model(changed);assert.equal(m.band,null);assert.equal(m.comparison.comparable,false);assert.equal(lineCount(labPointChart(cohort(changed))),0);
  }
});
test('ambiguous dates, reused identities and incompatible intermediate collections never create a band or line',()=>{
  const [first,last]=pair(),intermediate=row('middle','2025-03-20',61.4);
  for(const rows of [[first,{...first,source_record_id:'synthetic-duplicate-date'},last],
    [first,{...last,source_record_id:first.source_record_id}],
    [first,{...intermediate,method:'Outro método sintético'},last],
    [first,{...intermediate,result_raw:'Texto sintético'},last],
    [first,{...intermediate,laboratory:'Outro laboratório sintético'},last]]){
    const c=cohort(rows),m=labChartModel(c);assert.equal(m.band,null);assert.equal(m.comparison.comparable,false);assert.equal(lineCount(labPointChart(c)),0);
  }
});
test('full-history identity conflict outside the visible window still withholds the chart band',()=>{
  const rows=pair(),evidence=[row('first','2024-01-01',59),...rows],c=cohort(rows,evidence);
  assert.equal(labChartModel(c).band,null);assert.equal(labChartModel(c).comparison.comparable,false);
});
test('approved documentary readings retain their original raw values without new review evidence',()=>{
  for(const marker of ['Hemoglobina','Hematócrito']){
    const {previous,current}=makeReviewedBloodCountPair(marker),rows=[previous,current],before=structuredClone(rows),c=cohort(rows);
    assert.ok(labChartModel(c).band);assert.equal(labChartModel(c).comparison.comparable,true);
    assert.match(labPointChart(c,{selected:0}),/Resultado original:/);assert.ok(labPointChart(c,{selected:0}).includes(previous.result_raw));
    assert.deepEqual(rows,before);
    const invalid=[{...previous,reference_verification:null},current];assert.equal(model(invalid).band,null);assert.equal(model(invalid).comparison.comparable,false);
  }
});
test('zero, negative, flat and tiny values remain finite and unclipped without requiring zero for every series',()=>{
  for(const [a,b,reference_range] of [[0,0,'-1 a 1 u/L'],[-5,-4,'-8 a -2 u/L'],[61,61,'42 a 60 u/L'],[.000042,.000046,'0.000040 a 0.000080 u/L']]){
    const rows=[row('tiny-a','2025-01-10',a,{reference_range}),row('tiny-b','2025-05-20',b,{reference_range})],m=model(rows);
    assert.ok(Number.isFinite(m.axis.min)&&Number.isFinite(m.axis.max)&&m.axis.min<m.axis.max);
    assert.ok(m.axis.min<a&&m.axis.min<b&&m.axis.max>a&&m.axis.max>b);
    assert.equal(new Set(m.axis.ticks.map(value=>value.toFixed(m.axis.digits))).size,3,'all axis labels stay distinct');
    assert.doesNotMatch(labPointChart(cohort(rows)),/NaN|Infinity/);
  }
});
test('unvalidated-range fallback still provides visual context without asserting a clinical interval',()=>{
  const rows=pair({reference_range:null}),m=model(rows);
  assert.equal(m.band,null);assert.ok(m.axis.max-m.axis.min>=61.7*.1);assert.ok(m.axis.min>0);
  assert.match(labPointChart(cohort(rows)),/Sem faixa de referência comum validada/);
});
test('the point picker retains exact numeric precision, dates, raw strings and safe fallback selection',()=>{
  const rows=[row('p1','2025-01-10',61.1234),row('p2','2025-05-20',61.4321)],c=cohort(rows);
  const html=labPointChart(c,{selected:0});assert.match(html,/61,1234 u\/L/);assert.match(html,/Resultado original: 61.1234 u\/L/);
  for(const selected of [-1,999,'bogus'])assert.match(labPointChart(c,{selected}),/value="1" selected/);
});
test('long selected methods are visible as wrapping text and the selected marker is not repeated in shortcuts',()=>{
  state.data={labs:pair()};state.domainStatus={labs:'ready'};state.errors={};state.ui={productLabPeriod:'all'};
  const html=renderProductLabs();assert.match(html,/class="ltsLabSeriesContext"/);assert.ok(html.includes(`<dd>${method}</dd>`));
  assert.doesNotMatch(html,/data-lab-marker="marcador visual sintetico"/);assert.match(html,/id="productLabMarkerSelect"/);
  assert.match(html,/10\/01\/2025 → 20\/05\/2025: \+0,60 u\/L/);assert.match(html,/Diferença numérica, sem interpretação de melhora ou piora clínica/);
  const rows=pair({unit:'%',reference_range:'42 a 60 %'});state.data.labs=rows;assert.match(renderProductLabs(),/\+0,60 p\.p\./);
  state.data.labs=[row('tiny-a','2025-01-10',.000042,{reference_range:'0.000040 a 0.000080 u/L'}),row('tiny-b','2025-05-20',.000046,{reference_range:'0.000040 a 0.000080 u/L'})];
  assert.match(renderProductLabs(),/\+0,000004 u\/L/,'small permitted differences are not rounded to zero');
  state.ui.productLabQuery='nada correspondente';assert.match(renderProductLabs(),/Nenhum marcador corresponde/);
});
test('source strings are escaped and deeply frozen original records are never changed',()=>{
  const rows=pair({method:'<img src=x onerror=alert(1)>',reference_range:'<img src=x onerror=alert(2)>'}),before=structuredClone(rows);freeze(rows);
  state.data={labs:rows};state.ui={productLabPeriod:'all'};const html=renderProductLabs();
  assert.doesNotMatch(html,/<img src=x onerror/);assert.match(html,/&lt;img src=x onerror/);
  assert.equal(model(rows).band,null);assert.deepEqual(rows,before);
});
console.log(`Laboratory visual context: ${count} synthetic model/render checks passed.`);

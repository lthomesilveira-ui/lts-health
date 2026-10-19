import assert from 'node:assert/strict';

globalThis.location={search:'?fixture=1'};
const {labHistoryConflicts,dashboardLabs}=await import('../src/health-dashboard-labs.js');
const {labGroups,labCohorts,labCohortPoints,labCohortComparison,labsModel,renderProductLabs}=await import('../src/labs-layout-v2.js');
const {laboratoryReport}=await import('../src/reports-model.js');
const {labTrend,contextChart}=await import('../src/health-context.js');
const {homeCockpitModel,renderHomeCockpit}=await import('../src/home-cockpit.js');
const {state}=await import('../src/core.js');

// Invented observations only. This regression suite contains no health export,
// account details, documentary review or original personal result.
const bounds={start:'2025-01-01',end:'2025-05-31'};
const status=Object.fromEntries(['body','segmental','nutrition','sourceMetrics','metrics','workouts','exercises','sets','labs','treatments','polarSessions','goals','meals','waterReferences'].map(key=>[key,'ready']));
const row=(id,date,value,extra={})=>({source_record_id:`synthetic-conflict-${id}`,collection_date:date,
  biomarker:'Marcador sintético A',laboratory:'Laboratório sintético A',unit:'mg/L',method:'Método sintético A',
  reference_range:'0 a 8 mg/L',result_numeric:value,result_raw:String(value),...extra});
const report=(rows,window=bounds)=>laboratoryReport({labs:rows},status,window);
const groups=rows=>labGroups(rows);
const points=rows=>labCohorts(groups(rows)[0]).flatMap(labCohortPoints).sort((a,b)=>a.date.localeCompare(b.date));
const lines=items=>(contextChart(items,{selectable:false}).match(/class="ltsContextLine"/g)||[]).length;
const freeze=value=>{if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;};
let count=0;const test=(name,run)=>{run();count++;console.log(`ok ${count} - ${name}`);};

test('history-wide identity conflicts retain exact original row references',()=>{
  const first=row('reused','2025-01-10',2),middle=row('middle','2025-02-10',3),last=row('reused','2025-03-10',4);
  const rows=freeze([first,middle,last]),before=JSON.stringify(rows),conflicts=labHistoryConflicts(rows);
  assert.ok(conflicts instanceof Set);assert.equal(conflicts.size,2);
  assert.ok(conflicts.has(first));assert.ok(conflicts.has(last));assert.ok(!conflicts.has(middle));
  assert.equal(JSON.stringify(rows),before,'Conflict review never annotates or rewrites source observations');
  assert.equal(dashboardLabs({labs:rows},status,bounds).items[0].comparisonReason,'ambiguous_collection');
});

test('non-adjacent reused identities cannot produce a report delta or connected curve',()=>{
  const rows=[row('reused','2025-01-10',2),row('middle','2025-02-10',3),row('reused','2025-03-10',4)];
  const before=structuredClone(rows),m=report(rows);
  assert.equal(m.selected.comparable,false);assert.equal(m.selected.delta,null);
  assert.equal(m.selected.current,null,'A conflicted newest identity is not promoted to one current result');
  assert.equal(m.selected.latestRows[0],rows[2]);
  assert.equal(m.selected.comparisonReason,'ambiguous_collection');
  assert.deepEqual(m.selected.history.rows,rows,'All conflicting originals remain in the readable history');
  assert.equal(lines(m.points),0);assert.equal(lines(points(rows)),0);assert.equal(lines(labTrend(rows,null,bounds).points),0);
  for(const cohort of labCohorts(groups(rows)[0]))assert.equal(labCohortComparison(cohort).comparable,false);
  assert.deepEqual(rows,before);
});

test('a conflicted predecessor is a barrier while later adjacent valid pairs may resume',()=>{
  const rows=[row('reused','2025-01-10',2),row('middle','2025-02-10',3),row('reused','2025-03-10',4),row('after','2025-04-10',5)];
  let m=report(rows);assert.equal(m.selected.previousDate,'2025-03-10');
  assert.equal(m.selected.previous,null);assert.equal(m.selected.previousRows[0],rows[2]);
  assert.equal(m.selected.comparable,false);assert.equal(m.selected.delta,null);assert.equal(lines(m.points),0);
  rows.push(row('after-next','2025-05-10',6));m=report(rows);
  assert.equal(m.selected.previous,rows[3]);assert.equal(m.selected.current,rows[4]);assert.equal(m.selected.comparable,true);assert.equal(m.selected.delta,1);
  assert.equal(lines(m.points),1,'Only the last two valid adjacent collections are connected');
  assert.equal(lines(labTrend(rows,null,bounds).points),1);
});

test('identity conflicts before the selected window are not forgotten',()=>{
  const rows=[row('reused','2024-12-10',2),row('middle','2025-01-10',3),row('reused','2025-03-10',4)];
  const window={start:'2025-03-01',end:'2025-03-31'},m=report(rows,window);
  assert.equal(m.rows.length,1);assert.equal(m.selected.history.rows.length,3);
  assert.equal(m.selected.comparable,false);assert.equal(m.selected.delta,null);
  assert.equal(m.selected.comparisonReason,'ambiguous_collection');
  assert.equal(lines(m.points),0);
});

test('future identity reuse does not affect a report whose window ended earlier',()=>{
  const rows=[row('first','2025-01-10',2),row('reused','2025-02-10',3),row('reused','2025-06-10',4)];
  const m=report(rows,{start:'2025-01-01',end:'2025-03-31'});
  assert.equal(m.selected.history.rows.length,2);assert.equal(m.selected.comparable,true);assert.equal(m.selected.delta,1);
  assert.equal(lines(m.points),1);
});

test('identity conflicts cannot hide in another biomarker, laboratory or unit group',()=>{
  for(const patch of [{biomarker:'Marcador sintético B'},{laboratory:'Laboratório sintético B'},{unit:'g/L'}]){
    const rows=[row('first','2025-01-10',2),row('reused','2025-02-10',3),row('reused','2025-03-10',4,patch)];
    const conflicts=labHistoryConflicts(rows);assert.equal(conflicts.size,2,JSON.stringify(patch));
    const m=report(rows);assert.ok(m.comparisons.length>=1);
    assert.ok(m.comparisons.every(item=>!item.comparable&&item.delta===null),JSON.stringify(patch));
    for(const group of groups(rows))for(const cohort of labCohorts(group)){
      assert.equal(labCohortComparison(cohort).comparable,false);assert.equal(lines(labCohortPoints(cohort)),0);
    }
    assert.equal(m.comparisons.reduce((total,item)=>total+item.history.rows.length,0),rows.length);
  }
});

test('same-day method conflicts interrupt all associated cohorts rather than being bypassed',()=>{
  const rows=[row('first','2025-01-10',2),row('middle-a','2025-02-10',3),
    row('middle-b','2025-02-10',7,{method:'Método sintético B'}),row('last','2025-03-10',4)];
  const m=report(rows);assert.equal(m.selected.previousRows.length,2);assert.equal(m.selected.previous,null);
  assert.equal(m.selected.comparisonReason,'ambiguous_collection');assert.equal(m.selected.delta,null);
  assert.equal(m.selected.history.rows.length,4);
  for(const cohort of labCohorts(groups(rows)[0])){
    assert.equal(labCohortComparison(cohort).comparable,false);
    assert.equal(lines(labCohortPoints(cohort)),0,'A curve never crosses a conflicted collection');
  }
  assert.equal(lines(m.points),0);assert.equal(lines(labTrend(rows,null,bounds).points),0);
});

test('latest same-day method conflicts do not select a current value or automatic difference',()=>{
  const rows=[row('first','2025-01-10',2),row('last-a','2025-02-10',3),row('last-b','2025-02-10',7,{method:'Método sintético B'})];
  const m=report(rows);assert.equal(m.selected.current,null);assert.equal(m.selected.latestRows.length,2);
  assert.equal(m.selected.comparable,false);assert.equal(m.selected.delta,null);assert.equal(m.selected.comparisonReason,'ambiguous_collection');
  for(const cohort of labCohorts(groups(rows)[0]))assert.equal(labCohortComparison(cohort).comparable,false);
  assert.equal(lines(m.points),0);
});

test('latest same-day method conflicts cannot select a hero value in either cohort',()=>{
  const rows=[row('first','2025-01-10',2,{biomarker:'Glicose'}),row('last-a','2025-02-10',3,{biomarker:'Glicose'}),
    row('last-b','2025-02-10',7,{biomarker:'Glicose',method:'Método sintético B'})];
  const original={data:state.data,domainStatus:state.domainStatus,ui:state.ui,errors:state.errors};
  try{
    state.data={labs:rows};state.domainStatus=status;state.errors={};state.ui={productLabPeriod:'all',homePeriod:'all'};
    const cohorts=labsModel().item.cohorts;assert.equal(cohorts.length,2);
    for(const cohort of cohorts){
      state.ui.productLabCohort=cohort.key;
      const m=labsModel(),html=renderProductLabs(),hero=html.split('<section class="ltsLabsHero">')[1]?.split('</section>')[0];
      assert.equal(m.latestRows.length,1,'The selected method alone has one result on the latest date');
      assert.ok(m.cohort.ambiguousDates.includes(m.lastDate),'The other method creates collection ambiguity');
      assert.equal(m.latest,null,'A unique row in one method is not an unambiguous collection');
      assert.ok(hero.includes('<strong>Resultado com registros divergentes</strong>'));
      assert.ok(hero.includes('Nenhum resultado foi escolhido automaticamente.'));
      assert.equal(m.history.total,3);assert.ok(html.includes('3 mg/L'));assert.ok(html.includes('7 mg/L'));
      assert.equal(labCohortComparison(m.cohort).comparable,false);assert.equal(lines(labCohortPoints(m.cohort)),0);
    }
  }finally{Object.assign(state,original);}
});

test('unverified repeated identities stay conservative without marking a unique missing ID as conflicting',()=>{
  const one=row('a','2025-01-10',2,{source_record_id:null}),duplicate={...one},last=row('b','2025-02-10',3);
  assert.equal(labHistoryConflicts([one,last]).size,0);
  const conflicts=labHistoryConflicts([one,duplicate,last]);assert.equal(conflicts.size,2);
  assert.ok(conflicts.has(one));assert.ok(conflicts.has(duplicate));
  const m=report([one,duplicate,last]);assert.equal(m.selected.comparable,false);assert.equal(lines(m.points),0);
  assert.equal(m.selected.history.rows.length,3);
});

test('a uniquely dated but conflicted identity has no selected hero or computed reference position',()=>{
  const rows=[row('reused','2025-01-10',2,{biomarker:'Glicose'}),row('middle','2025-02-10',3,{biomarker:'Glicose'}),row('reused','2025-03-10',9,{biomarker:'Glicose'})];
  const original={data:state.data,domainStatus:state.domainStatus,ui:state.ui,errors:state.errors};
  try{
    state.data={labs:rows};state.domainStatus=status;state.errors={};state.ui={productLabPeriod:'all',homePeriod:'all'};
    const m=labsModel(),html=renderProductLabs();
    assert.equal(m.latest,null);assert.equal(m.latestRows[0],rows[2]);assert.equal(m.history.total,3);
    assert.ok(html.includes('Resultado com registros divergentes'));
    assert.ok(!html.includes('class="ltsLabReferencePosition"'),'A conflicted original never becomes a computed reference classification');
    assert.ok(html.includes('9 mg/L'),'The original result remains readable in the history');
    const cockpit=homeCockpitModel({labs:rows},status,'all',{},bounds.end);
    assert.equal(cockpit.evo.labReferenceRows.length,0);assert.equal(cockpit.evo.domainReadings.labs,undefined);
  }finally{Object.assign(state,original);}
});

test('laboratory unit text stays escaped in the comparable Home detail',()=>{
  const injection='<img src=x onerror=alert(1)>',rows=[row('first','2025-01-10',2,{unit:injection,reference_range:'0 a 8'}),row('last','2025-02-10',3,{unit:injection,reference_range:'0 a 8'})];
  const m=homeCockpitModel({labs:rows},status,'all',{},bounds.end),html=renderHomeCockpit(m);
  assert.equal(m.m.labs.selected.comparable,true,'This exercises the exact comparable-detail branch');
  assert.ok(!html.includes(injection),'Stored text must never become executable HTML');
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

console.log(`Laboratory history conflict regression: ${count} synthetic cases passed.`);

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {stepCountReview,stepValueText} from '../src/steps-evidence.js';
import {healthDashboardModel} from '../src/health-dashboard-model.js';


// Synthetic only. No user records, dates, accounts, credentials or network.
import {today,status,step,fixture} from './steps-evidence-fixture.mjs';
const steps=(data=fixture(),ui={},states=status)=>healthDashboardModel(data,states,ui,today).metricsByKey.steps;

test('only safe nonnegative integer counts are usable; fractional evidence is exact',()=>{
  for(const value of [0,1234,'1234'])assert.equal(stepCountReview(value).value,Number(value));
  for(const value of [null,undefined,'',true,false,NaN,Infinity,-1,Number.MAX_SAFE_INTEGER+1])assert.equal(stepCountReview(value).value,null);
  assert.equal(stepCountReview(1024.125006).reason,'fractional_count');
  assert.equal(stepCountReview(1024.125006).receivedValue,1024.125006);
  assert.match(stepValueText(1024.125006),/1\.024,125006.*fracionada/);
  assert.doesNotMatch(stepValueText(1024.125006),/1\.024 passos/);
  for(const raw of ['1234.0000000000000001','1.2340000000000000001e3','1e-10000'])assert.equal(stepCountReview(raw).reason,'fractional_count');
  assert.equal(stepCountReview('-1e-10000').reason,'invalid_value');
  assert.equal(stepCountReview('1234.0000').value,1234);
  assert.match(stepValueText('1234.0000000000000001'),/1\.234,0000000000000001/);
  assert.match(stepValueText('1234.000000000000000000000001'),/1\.234,000000000000000000000001/);
});
test('fractional day is preserved but excluded, zero is usable, today is partial',()=>{
  const m=steps();assert.equal(m.source.label,'Synthetic unnamed origin');
  assert.equal(m.count,3);assert.equal(m.value,(1234+0+1600)/3);
  const invalid=m.points.find(row=>row.date==='2024-03-07');
  assert.equal(invalid.value,null);assert.equal(invalid.eligible,false);assert.equal(invalid.stepReviewReason,'fractional_count');
  assert.equal(invalid.observations[0].receivedValue,1024.125006);
  assert.equal(m.todayValue,250);assert.equal(m.todayPoint.partial,true);assert.equal(m.todayPoint.eligible,false);
  assert.equal(m.stepEvidence.invalidCountDays,1);assert.equal(m.availability,'partial');
});
test('same-day different origins remain distinct, never summed or chosen as consolidated',()=>{
  const m=steps();assert.equal(m.stepEvidence.differingSourceDays,1);
  const evidence=m.stepEvidence.days.find(row=>row.date==='2024-03-04');
  assert.deepEqual(evidence.observations.map(row=>row.receivedValue).sort((a,b)=>a-b),[1234,4321]);
  assert.equal(evidence.sourceCount,2);assert.equal(m.value,(1234+0+1600)/3);
  const selected=steps(fixture(),{dashboardMode:'day',dashboardDate:'2024-03-04',dashboardSources:{steps:'Synthetic watch|Synthetic phone'}});
  assert.equal(selected.value,4321);assert.equal(selected.source.label,'Synthetic watch|Synthetic phone');
  assert.equal(selected.stepEvidence.differingSourceDays,1);assert.equal(selected.unresolvedOverlap,true);
});
test('automatic selection favors usable window coverage; explicit invalid latest remains selected',()=>{
  const data=fixture();const latest=steps(data,{dashboardPeriod:'30'});
  assert.equal(latest.source.label,'Synthetic unnamed origin');
  const explicit=steps(data,{dashboardPeriod:'7',dashboardSources:{steps:'Synthetic watch|Synthetic phone'}});
  assert.equal(explicit.source.label,'Synthetic watch|Synthetic phone');
  assert.equal(steps(data,{dashboardSources:{steps:'absent'}}).source,null);
  const onlyFraction={...data,sourceMetrics:[step('2024-03-03',50,'Synthetic older'),step('2024-03-07',1.25,'Synthetic latest')]};
  const automatic=steps(onlyFraction);assert.equal(automatic.source.label,'Synthetic older');assert.equal(automatic.value,50);assert.equal(automatic.stepEvidence.invalidCountDays,1,'Fractional evidence is preserved although not selected automatically');
  for(const period of ['7','30','90']){const selected=steps(onlyFraction,{dashboardPeriod:period,dashboardSources:{steps:'Synthetic latest'}});assert.equal(selected.source.label,'Synthetic latest');assert.equal(selected.value,null);assert.equal(selected.otherSourcesWithData,1);assert.equal(selected.stepEvidence.invalidCountDays,1);}
});
test('no data and failed source reads are distinct; stale evidence is not exposed',()=>{
  const empty={...fixture(),sourceMetrics:[]};assert.equal(steps(empty).value,null);assert.equal(steps(empty).stepEvidence.days.length,0);
  const failed=steps(fixture(),{}, {...status,sourceMetrics:'error'});assert.equal(failed.value,null);assert.equal(failed.stepEvidence.days.length,0);
  assert.equal(failed.availability,'partial');assert.equal(failed.count,0);
});
test('duplicates are not collapsed and values on other dates never create a same-day disagreement',()=>{
  const data={...fixture(),sourceMetrics:[step('2024-03-04',1234),step('2024-03-04',1234),step('2024-03-05',4321,'Synthetic other')]};
  const m=steps(data,{dashboardSources:{steps:'Synthetic unnamed origin'}});
  assert.equal(m.count,0);assert.equal(m.ambiguousDays,1);assert.equal(m.stepEvidence.differingSourceDays,0);
  assert.equal(m.stepEvidence.days[0].observations.length,2);
});
test('calendar report inherits validation, exact evidence and immutable inputs',()=>{
  const data=fixture(),before=structuredClone(data);
  const report=calendarReport(data,status,{calendarReportSelection:'current'},today);
  const metric=report.metrics.find(row=>row.key==='steps');
  assert.equal(metric.count,3);assert.equal(metric.stepEvidence.invalidCountDays,1);
  assert.equal(metric.stepEvidence.differingSourceDays,1);assert.deepEqual(data,before);
});

globalThis.location={search:'?fixture=1'};
const {calendarReport}=await import('../src/calendar-report-model.js');
const {renderHealthDashboard}=await import('../src/health-dashboard.js');
const {renderCalendarReport,renderCalendarReportPrint}=await import('../src/calendar-report-view.js');
const {renderStepsEvidence}=await import('../src/steps-evidence-view.js');
const {complementarySignalSeries}=await import('../src/analysis-screen.js');
const {recoveryReport}=await import('../src/reports-model.js');
test('dashboard and report/PDF show fractional evidence, source disagreement and timestamp without a fake total',()=>{
  const data=fixture(),ui={calendarReportSelection:'current'},model=calendarReport(data,status,ui,today);
  for(const html of [renderHealthDashboard(data,status,{dashboardPeriod:'7'},today),renderCalendarReport(data,status,ui,today),renderCalendarReportPrint(model)]){
    assert.match(html,/contagens diferentes por origem/);assert.match(html,/1\.024,125006/);assert.match(html,/contagem em revisão/);
    assert.match(html,/1\.234 passos/);assert.match(html,/4\.321 passos/);
    assert.match(html,/Atualizado no app em 08\/03\/2024, 12:34 \(Brasília\)/);
    assert.match(html,/cobertura integral não confirmada/);assert.doesNotMatch(html,/5\.555 passos/);
  }
  const day=renderHealthDashboard(data,status,{dashboardMode:'day',dashboardDate:'2024-03-07'},today);
  assert.match(day,/Contagem recebida em revisão/);assert.doesNotMatch(day,/1\.024 passos/);
});
test('unknown timestamp remains unknown and source labels are escaped',()=>{
  const data={...fixture(),sourceMetrics:[step('2024-03-07',1.25,'Synthetic <script>alert(1)</script>',{updated_at:null})]};
  const html=renderStepsEvidence(steps(data));assert.match(html,/Horário de atualização não informado/);
  assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
});
test('recovery charts also exclude fractional steps while preserving evidence',()=>{
  const data=fixture(),bounds={start:'2024-03-01',end:today};
  const series=complementarySignalSeries(data.sourceMetrics,bounds).filter(row=>row.metric==='steps');
  assert.ok(series.every(row=>row.points.every(point=>Number.isSafeInteger(point.value))));
  assert.equal(series.reduce((sum,row)=>sum+row.reviewRows.length,0),1);
  const recovery=recoveryReport(data,status,bounds);
  assert.ok(recovery.series.every(row=>row.points.every(point=>Number.isSafeInteger(point.value))));
  assert.equal(recovery.series.reduce((sum,row)=>sum+row.reviewRows.length,0),1);
  const duplicate=[step('2024-03-07',1000),step('2024-03-07',1000.5)];
  assert.equal(complementarySignalSeries(duplicate,bounds)[0].points.length,0,'invalid duplicate must not make its sibling unambiguous');
  assert.equal(recoveryReport({...data,sourceMetrics:duplicate},status,bounds).series[0].points.length,0);
});

test('partial status belongs to its own source, not every origin on the day',()=>{
  const data={...fixture(),sourceMetrics:[step('2024-03-07',1234,'Synthetic partial',{knownPartial:true}),step('2024-03-07',4321,'Synthetic unknown completeness')]};
  const html=renderStepsEvidence(steps(data));
  assert.match(html,/Synthetic partial[\s\S]*?dia parcial/);
  assert.match(html,/Synthetic unknown completeness[\s\S]*?cobertura integral não confirmada/);
});

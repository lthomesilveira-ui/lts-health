import assert from 'node:assert/strict';
globalThis.location={search:'?fixture=1'};
const {state}=await import('./src/core.js');
const {renderTimelineHub}=await import('./src/timeline-screen.js');
const {renderCalendarOverview}=await import('./src/calendar-report-overview.js');
const {calendarReport}=await import('./src/calendar-report-model.js');
const {makeCalendarReportFixture}=await import('../preview/compact-evidence/tests/calendar-report-fixture.mjs');

state.data=Object.fromEntries(Object.keys(state.data).map(key=>[key,[]]));
state.domainStatus={};
state.ui.timelinePeriod='all';state.ui.timelineYear='all';state.ui.timelineDomain='all';state.ui.timelineQuery='';
state.data.sourceMetrics=[
  {metric_date:'2026-01-06',metric_type:'heart_rate_avg_bpm',value:81.5,unit:'bpm',source_name:'Synthetic watch',canonical_status:'candidate'},
  {metric_date:'2026-01-06',metric_type:'oxygen_saturation_pct',value:96.5,unit:'%',source_name:'Synthetic watch',canonical_status:'held'}
];
const before=structuredClone(state.data);
const timeline=renderTimelineHub();
assert.match(timeline,/Frequência cardíaca média 81,5 bpm/);
assert.match(timeline,/Saturação de oxigênio 96,5 %/);
assert.doesNotMatch(timeline,/Métrica registrada 81,5|Métrica registrada 96,5/);
assert.match(timeline,/Permanecem separados/);
assert.deepEqual(state.data,before,'Labeling never changes observations, units, origin or candidate status');

const f=makeCalendarReportFixture(),model=calendarReport(f.data,f.status,{},f.today);
const metric=model.metricsByKey.energy;
metric.value=null;metric.count=0;metric.points=[];metric.otherSourcesWithData=1;
const preserved=structuredClone(model);
assert.match(renderCalendarOverview(model),/data-calendar-source-jump="energy"/);
assert.match(renderCalendarOverview(model),/Há registros em outra origem neste período/);
assert.doesNotMatch(renderCalendarOverview(model,{print:true}),/data-calendar-source-jump/,'Print contains no interactive recovery control');
assert.deepEqual(model,preserved,'Recovery does not select a replacement source or change calculations');
metric.otherSourcesWithData=0;
assert.doesNotMatch(renderCalendarOverview(model),/data-calendar-source-jump/);
metric.otherSourcesWithData=1;metric.coverageUnavailable=true;
assert.doesNotMatch(renderCalendarOverview(model),/data-calendar-source-jump/,'A failed read is never presented as a known alternate diary');
console.log('Audit regressions: typed labels, units, nonmutation and explicit source recovery passed.');

import assert from 'node:assert/strict';
import {healthDashboardModel} from '../src/health-dashboard-model.js';
import {dashboardBody} from '../src/health-dashboard-body.js';
const status={body:'ready'},today='2026-10-17',row=(date,id='one',source='Synthetic body',extra={})=>({source_record_id:id,measured_at:date,source,device_name:'Synthetic model',weight_kg:80,fat_mass_kg:16,skeletal_muscle_mass_kg:34,...extra});
function run(body,ui={},s=status){const data={body},d=healthDashboardModel(data,s,ui,today);return dashboardBody(data,s,d,ui);}
let result=run([row('2026-09-24')]);assert.equal(result.latest.date,'2026-09-24');assert.equal(result.outsidePeriod,true);assert.equal(result.pair,false);assert.match(result.periodLabel,/fora do período/);assert.equal(result.metrics.weight_kg.delta,null);
result=run([row('2026-10-14')]);assert.equal(result.latest.date,'2026-10-14');assert.ok(!result.outsidePeriod);
result=run([row('2026-09-24'),row('2026-10-18','future')]);assert.equal(result.latest.date,'2026-09-24');
result=run([row('2026-09-24'),row('2026-09-24','conflict')]);assert.equal(result.latest,null);assert.equal(result.latestKnownAmbiguous,true);
result=run([row('2026-09-20'),row('2026-10-14','a'),row('2026-10-14','b')]);assert.equal(result.latest,null);assert.ok(result.ambiguousDates.includes('2026-10-14'));
// An older unambiguous in-period value must not replace a conflicting newest date.
result=run([row('2026-10-11','older'),row('2026-10-14','a'),row('2026-10-14','b')]);
assert.equal(result.latest,null);assert.equal(result.pair,false);assert.equal(result.latestKnownDate,'2026-10-14');assert.equal(result.latestKnownAmbiguous,true);
assert.match(result.text,/14\/10\/2026.*2 avaliações/);assert.ok(Object.values(result.metrics).every(metric=>metric.latest===null&&metric.delta===null));
result=run([row('2026-10-10','first'),row('2026-10-11','older'),row('2026-10-14','a'),row('2026-10-14','b')]);
assert.equal(result.first,null);assert.equal(result.latest,null);assert.equal(result.pair,false);assert.equal(result.metrics.weight_kg.delta,null);
// A resolved later date remains usable; an earlier conflict is still disclosed.
result=run([row('2026-10-11','a'),row('2026-10-11','b'),row('2026-10-14','latest')]);
assert.equal(result.latest.date,'2026-10-14');assert.ok(result.ambiguousDates.includes('2026-10-11'));assert.ok(!result.latestKnownAmbiguous);
const source=JSON.stringify(['selected source','synthetic model']);result=run([row('2026-09-20','chosen','Selected source'),row('2026-09-24','other')],{homeBodySource:source});assert.equal(result.latest.date,'2026-09-20');assert.equal(result.latest.source,'Selected source');
result=run([row('2026-10-11','chosen','Selected source'),row('2026-10-14','other-a'),row('2026-10-14','other-b')],{homeBodySource:source});assert.equal(result.latest.date,'2026-10-11');assert.ok(!result.latestKnownAmbiguous);
result=run([row('2026-09-24')],{}, {body:'error'});assert.equal(result.latest,null);assert.equal(result.available,false);
result=run([row('2026-09-24')],{dashboardMode:'day',dashboardDate:'2026-09-20'});assert.equal(result.latest,null);
const data={body:[row('2026-09-24')]},before=structuredClone(data),d=healthDashboardModel(data,status,{},today);dashboardBody(data,status,d,{});assert.deepEqual(data,before);
console.log('Dashboard body: latest known outside period, source isolation, ambiguity, errors and historical cutoff passed.');

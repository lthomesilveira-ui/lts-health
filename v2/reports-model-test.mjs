import assert from 'node:assert/strict';
globalThis.location={search:'?fixture=1'};
const {state}=await import('./src/core.js');
const {reportBounds,compositionReport,segmentIdentity,segmentalReport,trainingSummary,nutritionSummary,laboratoryReport,usefulReports}=await import('./src/reports-model.js');
const {contextChart}=await import('./src/health-context.js');
const {renderUsefulReports}=await import('./src/reports-screen.js');
const status=Object.fromEntries(['body','segmental','workouts','exercises','sets','nutrition','labs','sourceMetrics'].map(k=>[k,'ready']));
const {current,previous}=reportBounds('30','2025-03-02');
assert.deepEqual(current,{start:'2025-02-01',end:'2025-03-02',days:30});
assert.deepEqual(previous,{start:'2025-01-02',end:'2025-01-31',days:30});
const body=(date,device='Device A')=>({measured_at:date,source:'BIA',device_name:device,source_file:`${date}.pdf`,weight_kg:80,skeletal_muscle_mass_kg:30,fat_mass_kg:15,body_fat_pct:20});
const segment=(date,lean)=>({measured_at:date,source:'Segmental BIA',source_file:`${date}.pdf`,lean_right_arm_kg:lean,fat_right_arm_kg:1});
const workout=(id,date)=>({source_record_id:id,workout_date:date,is_canonical:true,duration_minutes:30});
const lab=(date,value,method='Assay A')=>({collection_date:date,biomarker:'Synthetic marker',result_numeric:value,result_raw:String(value),unit:'u',laboratory:'Lab A',method});
const data={body:[body('2025-02-03'),body('2025-02-23')],segmental:[segment('2025-02-03',3.2),segment('2025-02-23',3)],workouts:[workout('prior','2025-01-20'),workout('current','2025-02-10'),{...workout('duplicate-origin','2025-02-10'),is_canonical:false}],exercises:[{source_record_id:'prior-ex',workout_source_record_id:'prior',muscle_group:'Bíceps'},{source_record_id:'current-ex',workout_source_record_id:'current',muscle_group:'Tríceps'},{source_record_id:'orphan-ex',workout_source_record_id:'duplicate-origin',muscle_group:'Bíceps'}],sets:[{exercise_source_record_id:'prior-ex',workout_source_record_id:'prior'},{exercise_source_record_id:'current-ex',workout_source_record_id:'current'},{exercise_source_record_id:'orphan-ex',workout_source_record_id:'duplicate-origin'},{exercise_source_record_id:'current-ex',workout_source_record_id:'unknown'}],nutrition:[{nutrition_date:'2025-02-10',protein_g:100,source:'Food A'},{nutrition_date:'2025-02-12',protein_g:null,source:'Food A'},{nutrition_date:'2025-01-20',protein_g:80,source:'Food A'}],labs:[lab('2025-02-05',10),lab('2025-02-25',12)],sourceMetrics:[]};
const snapshot=JSON.stringify(data);
let s=segmentalReport(data,status,current);
assert.equal(s.available,true);assert.ok(Math.abs(s.parts[0].delta+.2)<1e-9);
assert.equal(s.training.sessions,1);assert.equal(s.training.sets,1);assert.equal(s.previousTraining.sessions,1);
assert.equal(s.nutrition.means.protein_g,100);assert.equal(s.nutrition.counts.protein_g,1);assert.equal(s.nutrition.intervalDays,20);
assert.equal(s.points.length,2);assert.equal(segmentIdentity(data.segmental[1],data.body).device,'Device A');
const changed={...data,body:[data.body[0],body('2025-02-23','Device B')]};
assert.equal(segmentalReport(changed,status,current).reason,'source_changed');
assert.equal(compositionReport(changed,status,current).reason,'source_changed');
assert.equal(segmentIdentity(data.segmental[1],[data.body[1],{...data.body[1]}]).key,null,'ambiguous link cannot erase a device change');
assert.equal(segmentIdentity({...data.segmental[1],source_file:'unrelated.pdf'},data.body).device,'','same date alone is not device evidence');
assert.equal(segmentalReport(data,{...status,body:'error'},current).reason,'unavailable_context');
assert.equal(compositionReport({...data,body:[...data.body,data.body[1]]},status,current).reason,'ambiguous');
assert.equal(trainingSummary(data,status,current).sessions,1);assert.equal(trainingSummary(data,status,current).sets,1);
assert.equal(trainingSummary(data,{...status,exercises:'error'},current).sets,null);
assert.equal(trainingSummary(data,{...status,workouts:'error'},current).sessions,null);
assert.equal(trainingSummary({...data,workouts:[{...workout('current','2025-02-10'),duration_minutes:null}]},status,current).minutes,null);
assert.equal(nutritionSummary({...data,nutrition:[...data.nutrition,data.nutrition[0]]},status,current).counts.protein_g,0,'ambiguous daily records excluded');
assert.equal(nutritionSummary({...data,nutrition:[{nutrition_date:'2025-02-10',protein_g:0,source:'Food A'}]},status,current).means.protein_g,0,'recorded zero remains zero');
assert.equal(laboratoryReport(data,status,current).selected.delta,2);
for(const altered of [
 {...data,labs:data.labs.map(r=>({...r,method:null}))},
 {...data,labs:[data.labs[0],{...data.labs[1],method:'Assay B'}]},
 {...data,labs:[data.labs[0],{...data.labs[1],unit:'other'}]},
 {...data,labs:[data.labs[0],{...data.labs[1],laboratory:'Lab B'}]},
 {...data,labs:[data.labs[0],{...data.labs[1],result_raw:'< 12'}]},
 {...data,labs:[...data.labs,data.labs[1]]}
])assert.notEqual(laboratoryReport(altered,status,current).selected.comparable,true);
const censored=laboratoryReport({...data,labs:[data.labs[0],{...data.labs[1],result_raw:'< 12'}]},status,current);
assert.equal(censored.rows.at(-1).result_raw,'< 12');assert.equal(censored.points.length,1);
const metrics=[{metric_date:'2025-02-10',metric_type:'sleep_duration_h',source_family:'Watch',source_name:'Device A',canonical_status:'candidate',unit:'h',value:7},{metric_date:'2025-01-20',metric_type:'sleep_duration_h',source_family:'Watch',source_name:'Device B',canonical_status:'candidate',unit:'h',value:8}];
const model=usefulReports({...data,sourceMetrics:metrics},status,{analysisPeriod:'30'},'2025-03-02');
assert.equal(model.prior.recovery.points.length,0,'prior window cannot substitute another device');
assert.equal(model.nutritionComparable,true);
assert.equal(usefulReports({...data,nutrition:data.nutrition.map((r,i)=>i===1?{...r,source:null}:r)},status,{analysisPeriod:'30'},'2025-03-02').nutritionComparable,false);
const all=usefulReports(data,status,{analysisPeriod:'all'},'2025-03-02');assert.equal(all.current.start,'2025-01-20');assert.equal(all.prior,null);
const future=usefulReports({...data,body:[...data.body,body('2025-03-03')]},status,{analysisPeriod:'30'},'2025-03-02');assert.equal(future.body.latest.measured_at,'2025-02-23');
assert.equal(JSON.stringify(data),snapshot,'reports do not mutate source records');
assert.doesNotMatch(contextChart([{date:'2025-02-02',value:30}],{bar:true,selectable:false}),/data-health-date/);
state.data={...data,labs:[{...lab('2025-02-25',12),biomarker:'<script>alert(1)</script>'}]};state.domainStatus=status;state.ui={analysisPeriod:'all'};
const html=renderUsefulReports();assert.match(html,/Onde o corpo mudou/);assert.match(html,/Exames ao longo do tempo/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>alert/);
state.data=data;state.ui={analysisPeriod:'all',reportLabPoint:null};
assert.match(renderUsefulReports().match(/<select id="reportLabPoint"[\s\S]*?<\/select>/)?.[0]||'',/<option value="1" selected>/,'a newly selected marker opens its latest point');
state.ui.reportLabPoint='0';
assert.match(renderUsefulReports().match(/<select id="reportLabPoint"[\s\S]*?<\/select>/)?.[0]||'',/<option value="0" selected>/,'the earliest point remains explicitly selectable');
console.log('Useful reports: calendar windows, segment/device boundaries, interval context, missingness, lab comparability, provenance and escaping passed.');

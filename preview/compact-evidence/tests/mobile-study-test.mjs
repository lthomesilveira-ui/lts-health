import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.location={search:'?fixture=1'};
const {renderMobileStudy}=await import('../src/mobile-study.js');
const status=Object.fromEntries(['body','workouts','exercises','sets','nutrition','sourceMetrics','metrics','labs','treatments','polarSessions','waterReferences'].map(k=>[k,'ready']));
const data={body:[{source_record_id:'synthetic-a',measured_at:'2025-03-01',source:'Synthetic A',weight_kg:80,fat_mass_kg:20,skeletal_muscle_mass_kg:30},{source_record_id:'synthetic-b',measured_at:'2025-04-01',source:'Synthetic B',weight_kg:79,fat_mass_kg:21,skeletal_muscle_mass_kg:29}]};
let html=renderMobileStudy(data,status,'90',{},'2025-05-03');
assert.equal((html.match(/data-study-domain=/g)||[]).length,6);
assert.match(html,/Peso caiu 1,0 kg; gordura estimada não caiu/);
assert.match(html,/data-body-start="2025-03-01" data-body-end="2025-04-01"/);
assert.match(html,/80,0 kg/);assert.match(html,/79,0 kg/);assert.match(html,/\+1,0 kg/);
assert.doesNotMatch(html,/<text/);assert.doesNotMatch(html,/NaN|undefined/);
assert.match(renderMobileStudy({},status,'30',{},'2025-05-03'),/Ainda não há uma comparação/);
const root=new URL('../',import.meta.url),index=fs.readFileSync(new URL('index.html',root),'utf8');
const map=JSON.parse(index.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
assert.equal(map['./src/home-reference.js?v=real-hierarchy-20261014.57'],'./src/health-dashboard.js?v=health-dashboard-20261017.64');
assert.equal(map['./src/core.js'],'./src/core.js?v=health-dashboard-20261017.64');
assert.ok(index.indexOf('preview-readonly.js')<index.indexOf('type="module"'));
for(const ref of [...index.matchAll(/(?:src|href)="([^"?#]+)[^" ]*"/g)].map(m=>m[1]).filter(x=>x.startsWith('.'))){assert.ok(fs.existsSync(new URL(ref,root)),`dependency exists: ${ref}`);}
const renderer=fs.readFileSync(new URL('src/mobile-study.js',root),'utf8');assert.doesNotMatch(renderer,/\b(fetch|XMLHttpRequest|createClient|localStorage|sessionStorage)\b/);
console.log('Study renderer and isolated dependency/guard contract passed.');
const single=renderMobileStudy({body:[data.body[0]]},status,'90',{},'2025-05-03');assert.equal((single.match(/class="studySingle"/g)||[]).length,3);assert.doesNotMatch(single,/class="studyPair /);

assert.match(html,/class="studyHome ltsHomeReference"/,'shared compatibility controller must recognize ownership');

const {observedRange}=await import('../src/mobile-study.js');
assert.equal(observedRange([6,6],'h',1),'6,0 h');
assert.equal(observedRange([2000,2000],'kcal/dia',0),'2.000 kcal/dia');
assert.equal(observedRange([null,undefined],'h',1),null);
const sleepData={sourceMetrics:[
 {source_record_id:'synthetic-sleep-1',metric_date:'2025-05-01',metric_type:'sleep_duration_h',value:6,unit:'h',source_name:'Synthetic sleep',source_family:'synthetic',canonical_status:'canonical'},
 {source_record_id:'synthetic-sleep-2',metric_date:'2025-05-02',metric_type:'sleep_duration_h',value:8,unit:'h',source_name:'Synthetic sleep',source_family:'synthetic',canonical_status:'canonical'},
 {source_record_id:'synthetic-sleep-today',metric_date:'2025-05-03',metric_type:'sleep_duration_h',value:3,unit:'h',source_name:'Synthetic sleep',source_family:'synthetic',canonical_status:'canonical'}]};
const sleepHtml=renderMobileStudy(sleepData,status,'30',{},'2025-05-03');
assert.match(sleepHtml,/7,0 h/,'mean uses only two closed nights');
assert.match(sleepHtml,/Ponto de hoje parcial, fora da média/);
assert.match(sleepHtml,/data-date="2025-05-03" data-value="3"/);
assert.match(sleepHtml,/2 noites em 29 dias encerrados/);
const noToday=renderMobileStudy({sourceMetrics:sleepData.sourceMetrics.slice(0,2)},status,'30',{},'2025-05-03');
assert.doesNotMatch(noToday,/Ponto de hoje parcial/);

const trainingData={workouts:[],exercises:[],sets:[]};
for(let c=0;c<4;c++)for(let n=0;n<2;n++){
 const day=n?'2025-04-25':'2025-04-05',w='synthetic-w-'+c+'-'+n,e='synthetic-e-'+c+'-'+n;
 trainingData.workouts.push({source_record_id:w,workout_date:day,source:'Synthetic diary',location:'Synthetic gym',is_canonical:true});
 trainingData.exercises.push({source_record_id:e,workout_source_record_id:w,exercise:'Synthetic exercise '+c,machine:'Synthetic machine '+c,source:'Synthetic diary'});
 trainingData.sets.push({source_record_id:'synthetic-s-'+c+'-'+n,workout_source_record_id:w,exercise_source_record_id:e,weight:20+c*10+n,reps_numeric:8,weight_unit:'kg',phase:null});
}
const recurringHtml=renderMobileStudy(trainingData,status,'90',{},'2025-05-03');
const overview=recurringHtml.match(/<div class="studyTrainingOverview">([\s\S]*?)<\/div>/)?.[1];
assert.ok(overview,'training overview is visible without opening details');
assert.equal((overview.match(/<section>/g)||[]).length,3);
assert.match(overview,/20 → 21 kg × 8 repetições/);
assert.match(overview,/05\/04\/2025 → 25\/04\/2025/);
assert.match(recurringHtml,/Comparações dos registros, sem medir ganho de força/);
for(const [i,date] of ['2025-04-10','2025-04-20'].entries()){
 const w='synthetic-extra-w-'+i,e='synthetic-extra-e-'+i;
 trainingData.workouts.push({source_record_id:w,workout_date:date,source:'Synthetic diary',location:'Synthetic gym',is_canonical:true});
 trainingData.exercises.push({source_record_id:e,workout_source_record_id:w,exercise:'Synthetic exercise 0',machine:'Synthetic machine 0',source:'Synthetic diary'});
 trainingData.sets.push({source_record_id:'synthetic-extra-s-'+i,workout_source_record_id:w,exercise_source_record_id:e,weight:15+i,reps_numeric:10,weight_unit:'kg',phase:null});
}
const differentPairDates=renderMobileStudy(trainingData,status,'90',{},'2025-05-03');
assert.match(differentPairDates,/20 → 21 kg × 8 repetições<small>05\/04\/2025 → 25\/04\/2025/);
assert.match(differentPairDates,/15 → 16 kg × 10 repetições<small>10\/04\/2025 → 20\/04\/2025/);
assert.doesNotMatch(differentPairDates,/15 → 16 kg × 10 repetições<small>05\/04\/2025 → 25\/04\/2025/);
assert.match(differentPairDates,/10 repetições<small>10\/04\/2025 → 20\/04\/2025<\/small>/,'expanded load comparison retains each pair dates');
assert.match(differentPairDates,/Claro: primeiro registro do par/);
const findingData={...data,labs:[
 {source_record_id:'synthetic-lab-before',collection_date:'2025-02-01',biomarker:'Synthetic marker',result_numeric:30,result_raw:'30',unit:'u',laboratory:'Synthetic lab',method:'Synthetic method',reference_range:'10 a 40'},
 {source_record_id:'synthetic-lab-after',collection_date:'2025-04-01',biomarker:'Synthetic marker',result_numeric:25,result_raw:'25',unit:'u',laboratory:'Synthetic lab',method:'Synthetic method',reference_range:'12 a 42'}]};
const findingHtml=renderMobileStudy(findingData,status,'90',{},'2025-05-03');
assert.ok((findingHtml.match(/data-study-finding=/g)||[]).length<=3);
assert.doesNotMatch(findingHtml,/class="studyFindings"/);
assert.match(findingHtml,/30,0 u/);assert.match(findingHtml,/25,0 u/);assert.match(findingHtml,/Diferença registrada: -5,0 u/);
assert.match(findingHtml,/coleta anterior está fora do período selecionado/);
assert.match(findingHtml,/Referência: 10 a 40/);assert.match(findingHtml,/Referência: 12 a 42/);
assert.match(findingHtml,/data-study-lab-context=/);
assert.match(findingHtml,/Ver Synthetic marker e laudo/);
assert.doesNotMatch(renderMobileStudy({...findingData,labs:[]},status,'90',{},'2025-05-03'),/data-study-finding="labs"/);
console.log('Finding presentation, pair-specific expanded dates, independent references and absence contracts passed.');

const {studyLabSelection}=await import('../src/mobile-study.js');
const initialUi={homeLabKey:'user-selected-A',homePeriod:'90',reportNutritionSource:'selected-food-source'};
const nextUi=studyLabSelection({row:findingData.labs[1]},'90',initialUi);
assert.equal(nextUi.homeLabKey,'user-selected-A');assert.equal(nextUi.homePeriod,'90');assert.equal(nextUi.reportNutritionSource,'selected-food-source');
assert.equal(nextUi.productLabMarker,'synthetic marker');assert.equal(nextUi.productLabPeriod,'90');
assert.deepEqual(initialUi,{homeLabKey:'user-selected-A',homePeriod:'90',reportNutritionSource:'selected-food-source'},'action context does not mutate original selection');
const missingMethod=renderMobileStudy({...findingData,labs:findingData.labs.map(x=>({...x,method:'não informado'}))},status,'90',{},'2025-05-03');
assert.doesNotMatch(missingMethod,/data-study-finding="labs"/);
assert.doesNotMatch(missingMethod,/Diferença registrada:/,'card and finding use same known-method rule');

const bodyIndex=findingHtml.indexOf('data-study-domain="body"');
assert.ok(bodyIndex>0&&findingHtml.indexOf('data-study-domain="training"')>bodyIndex);
assert.doesNotMatch(findingHtml,/studyFindings|studyOtherLabs/,'no duplicate support or same-marker trajectory');
const extraLabData={...findingData,labs:[...findingData.labs,...findingData.labs.map(r=>({...r,source_record_id:r.source_record_id+'-other',biomarker:'Synthetic other',result_numeric:r.result_numeric+2}))]};
const extraLabHtml=renderMobileStudy(extraLabData,status,'90',{},'2025-05-03');
const extraBlock=extraLabHtml.match(/<section class="studyOtherLabs"[\s\S]*?<\/section>/)?.[0];
assert.ok(extraBlock);assert.match(extraBlock,/Synthetic other/);assert.doesNotMatch(extraBlock,/Synthetic marker:/,'selected marker is never duplicated among additional trajectories');
assert.ok((extraBlock.match(/class="studyLabTrajectory"/g)||[]).length<=2);
assert.match(findingHtml,/productLabPeriod/);assert.match(findingHtml,/productLabCohort/);

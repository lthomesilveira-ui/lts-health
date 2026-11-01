// Deterministic public QA data only. These are invented rows, not user exports.
export const HISTORY_TODAY='2026-10-15';
export const HISTORY_SOURCE='Synthetic historical MyFitnessPal';
export const CURRENT_SOURCE='Synthetic current MyFitnessPal';
export const MIRROR_FAMILY='synthetic mirror';
export const FIRST_HISTORY_DAY='2018-02-03';
export const LAST_HISTORY_DAY='2026-08-26';
export const MISSING_HISTORY_DAY='2022-04-17';
export const FOOD_KEYS=['calories_kcal','protein_g','carbs_g','fat_g','fiber_g'];
export const historySourceKey=label=>JSON.stringify(['nutrition',label.toLowerCase(),'canonical']);
export const mirrorSourceKey=status=>JSON.stringify(['sourceMetrics',MIRROR_FAMILY,HISTORY_SOURCE.toLowerCase(),status]);
const add=(date,days)=>new Date(Date.parse(`${date}T12:00:00Z`)+days*86400000).toISOString().slice(0,10);
const domains=['nutrition','sourceMetrics','metrics','body','segmental','workouts','workoutEvidence','exercises','sets','labs','treatments','regimens','docs','goals','waterReferences','polarSessions','meals','uploads','activity','nutritionPlans'];
const tables={nutrition:'health_daily_nutrition',sourceMetrics:'health_source_daily_metrics',metrics:'health_metrics',body:'health_body_composition',segmental:'health_segmental_composition',workouts:'health_workouts',workoutEvidence:'health_workout_source_evidence',exercises:'health_workout_exercises',sets:'health_workout_sets',labs:'health_lab_results',treatments:'health_medication_events',regimens:'health_medication_regimens',docs:'health_documents',goals:'health_personal_goals',polarSessions:'health_polar_sessions',meals:'health_nutrition_meals',uploads:'health_uploads',activity:'health_activity_records'};
export function makeNutritionHistoryFixture(){
  const data=Object.fromEntries(domains.map(domain=>[domain,[]])),status=Object.fromEntries(domains.map(domain=>[domain,'ready']));
  const span=Math.round((Date.parse(LAST_HISTORY_DAY)-Date.parse(FIRST_HISTORY_DAY))/86400000);
  const available=Array.from({length:span+1},(_,index)=>add(FIRST_HISTORY_DAY,index)).filter(date=>!date.startsWith('2022-'));
  const dates=Array.from({length:2503},(_,index)=>available[Math.floor(index*(available.length-1)/2502)]);
  dates.forEach((date,index)=>{
    data.nutrition.push({source_record_id:`synthetic-history-day-${index}`,nutrition_date:date,source:HISTORY_SOURCE,calories_kcal:1800+index%200,protein_g:90+index%30,carbs_g:200+index%20,fat_g:50+index%10,fiber_g:index===0?0:20+index%5,water_ml:1600+index%400,confidence:'synthetic'});
    // 2,503 × 2 + 101 = 5,107 historical meals. Meal totals deliberately do
    // not equal daily totals: the app must display stored totals, not sum meals.
    for(let meal=0;meal<(index<101?3:2);meal++)data.meals.push({source_record_id:`synthetic-history-meal-${index}-${meal}`,meal_date:date,meal_name:`Synthetic historical meal ${index}/${meal+1}`,source:HISTORY_SOURCE,calories_kcal:300+meal*50,protein_g:20+meal,carbs_g:30+meal,fat_g:10+meal,record_status:'validated',confidence:'synthetic'});
  });
  // Both origins display as MyFitnessPal in Timeline. Exact origin keys and
  // record IDs, rather than display aliases, must govern navigation and joins.
  const currentDates=[FIRST_HISTORY_DAY,...Array.from({length:23},(_,index)=>add(HISTORY_TODAY,index-22))];
  currentDates.forEach((date,index)=>{
    data.nutrition.push({source_record_id:`synthetic-current-day-${index}`,nutrition_date:date,source:CURRENT_SOURCE,calories_kcal:8800+index,protein_g:444,carbs_g:555,fat_g:111,fiber_g:66,water_ml:3300});
    data.meals.push({source_record_id:`synthetic-current-meal-${index}`,meal_date:date,meal_name:`Synthetic current-only meal ${index}`,source:CURRENT_SOURCE,calories_kcal:777,protein_g:77,carbs_g:88,fat_g:22,record_status:'validated'});
  });
  const mealOnlyDay=Array.from({length:31},(_,index)=>add(FIRST_HISTORY_DAY,index)).find(date=>!dates.includes(date));
  data.meals.push({source_record_id:'synthetic-history-meal-only',meal_date:mealOnlyDay,meal_name:'Synthetic meal without daily total',source:HISTORY_SOURCE,calories_kcal:432,protein_g:23,carbs_g:44,fat_g:12,record_status:'validated'});
  for(const [state,offset] of [['canonical',0],['candidate',100],['held',200]])for(const [key,type,unit,value] of [['calories_kcal','dietary_energy_kcal','kcal',9001],['protein_g','dietary_protein_g','g',901],['carbs_g','dietary_carbs_g','g',902],['fat_g','dietary_fat_g','g',903],['fiber_g','dietary_fiber_g','g',904]]){
    data.sourceMetrics.push({source_record_id:`synthetic-mirror-${state}-${key}`,metric_date:FIRST_HISTORY_DAY,metric_type:type,value:value+offset,unit,source_name:HISTORY_SOURCE,source_family:MIRROR_FAMILY,canonical_status:state});
  }
  // A same-day duplicate must remain explicit, never choose either row or pool.
  const ambiguousDay=dates[100];
  data.nutrition.push({...data.nutrition[100],source_record_id:'synthetic-history-duplicate',calories_kcal:6666});
  const db=Object.fromEntries(Object.entries(tables).map(([domain,table])=>[table,structuredClone(data[domain])]));
  return {today:HISTORY_TODAY,data,status,db,dates,mealOnlyDay,ambiguousDay,historicalDays:dates.length,historicalMeals:data.meals.filter(row=>row.source===HISTORY_SOURCE).length};
}

/** A minimal SDK replacement for the real paginated loader, with strict writes.
 * The browser installs it in place of the SDK before the app starts. */
export function nutritionHistoryService(db,{pauseTable=null,pauseFrom=0,failTable=null}={}){return `
window.__historyQA={reads:[],writes:[],failTable:${JSON.stringify(failTable)},pauseTable:${JSON.stringify(pauseTable)},pauseFrom:${pauseFrom},pauseReleased:false};window.__historyDb=${JSON.stringify(db)};
window.__releaseHistoryReads=()=>{window.__historyQA.pauseReleased=true;(window.__historyResume||[]).splice(0).forEach(resolve=>resolve());};
const mutation=(kind,target)=>{window.__historyQA.writes.push({kind,target});throw new Error('Synthetic QA forbids writes: '+kind+' '+target);};
window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-history-browser-user'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 functions:{invoke:name=>mutation('invoke',name)},rpc:name=>mutation('rpc',name),storage:{from:name=>({upload:()=>mutation('upload',name),remove:()=>mutation('remove',name)})},
 from(table){let from=0,to=999,projection='*';const filters=[],orders=[];
 const rows=()=>{let selected=(window.__historyDb[table]||[]).filter(row=>filters.every(([key,value])=>row[key]===value));if(orders.length)selected=selected.slice().sort((a,b)=>{for(const[key,asc]of orders){const result=String(a[key]??'').localeCompare(String(b[key]??''));if(result)return asc?result:-result;}return 0;});return selected;};
 const record=()=>window.__historyQA.reads.push({table,projection,filters:filters.map(pair=>pair.slice()),from,to,orders:orders.map(pair=>pair.slice())});
 const result=async()=>{record();if(window.__historyQA.pauseTable===table&&from>=window.__historyQA.pauseFrom&&!window.__historyQA.pauseReleased)await new Promise(resolve=>(window.__historyResume??=[]).push(resolve));return window.__historyQA.failTable===table?{data:null,error:{message:'Synthetic historical read failure'}}:{data:rows().slice(from,to+1),error:null};};
 const q={select(value){projection=value;return q;},eq(key,value){filters.push([key,value]);return q;},is(key,value){filters.push([key,value]);return q;},range(a,b){from=a;to=b;return q;},order(key,options={}){orders.push([key,options.ascending!==false]);return q;},limit(n){to=from+n-1;return q;},maybeSingle:async()=>{record();const selected=rows();return selected.length>1?{data:null,error:{message:'Multiple synthetic rows'}}:{data:selected[0]||null,error:null};},then(resolve,reject){return result().then(resolve,reject);}};
 for(const name of ['insert','update','upsert','delete'])q[name]=()=>mutation(name,table);return q;}
})};`;}

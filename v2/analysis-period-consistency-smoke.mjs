import {chromium} from 'playwright';
const base='http://127.0.0.1:4173/?fixture=1#analise';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Análise');
  const audit=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {renderAnalysisHub}=await import('./src/analysis-screen.js');
    const {normalizeMuscleGroup,periodBounds,trainingDistributionModel,nutritionPeriodModel}=await import('./src/integrated-analysis.js');
    const bounds=periodBounds('365','2026-08-31');
    const recentDates=['2026-07-07','2026-07-14','2026-07-25','2026-08-05','2026-08-20','2026-08-27','2026-08-31'];
    const oldDates=['2025-10-01','2025-11-01','2025-12-01','2026-01-05','2026-02-05','2026-03-05','2026-04-05','2026-05-05'];
    const dates=[...oldDates,...recentDates],workouts=[],exercises=[],sets=[];
    dates.forEach((date,i)=>{
      const w=`w-${i}`,e=`e-${i}`;
      workouts.push({source_record_id:w,workout_date:date,workout_type:'Pernas',is_canonical:true,record_status:'validated'});
      exercises.push({source_record_id:e,workout_source_record_id:w,workout_date:date,exercise:'Extensora',machine:'Life Fitness',muscle_group:'Quadríceps'});
      sets.push({source_record_id:`s-${i}`,exercise_source_record_id:e,workout_source_record_id:w,workout_date:date,weight:80,weight_unit:'kg'});
    });
    exercises.push({source_record_id:'e-ad',workout_source_record_id:'w-13',workout_date:'2026-08-27',exercise:'Abdutora',machine:'Life Fitness',muscle_group:'Adutor/Abdutor'});
    const synthetic={
      body:[{measured_at:'2026-07-16',weight_kg:100,skeletal_muscle_mass_kg:48,fat_mass_kg:14,body_fat_pct:14},{measured_at:'2026-08-24',weight_kg:99,skeletal_muscle_mass_kg:48.4,fat_mass_kg:13.2,body_fat_pct:13.3}],
      segmental:[{measured_at:'2026-07-16',lean_right_arm_kg:5,lean_left_arm_kg:5,lean_trunk_kg:35,lean_right_leg_kg:12,lean_left_leg_kg:12,fat_right_arm_kg:1,fat_left_arm_kg:1,fat_trunk_kg:7,fat_right_leg_kg:2,fat_left_leg_kg:2},{measured_at:'2026-08-24',lean_right_arm_kg:5.1,lean_left_arm_kg:5.1,lean_trunk_kg:35.2,lean_right_leg_kg:12.2,lean_left_leg_kg:12.2,fat_right_arm_kg:.9,fat_left_arm_kg:.9,fat_trunk_kg:6.8,fat_right_leg_kg:1.9,fat_left_leg_kg:1.9}],
      workouts,exercises,sets,
      nutrition:[{nutrition_date:'2026-08-01',calories_kcal:2000,protein_g:120,carbs_g:220,fat_g:70,fiber_g:25,water_ml:null},{nutrition_date:'2026-08-02',calories_kcal:2100,protein_g:130,carbs_g:230,fat_g:75,fiber_g:27,water_ml:null}],
      labs:[{collection_date:'2026-05-21',laboratory:'Fleury',biomarker:'Glicose',result_numeric:90,unit:'mg/dL'}],
      sourceMetrics:[{metric_date:'2026-08-10',metric_type:'sleep_duration_h',value:7,canonical_status:'candidate',source_name:'Polar'}]
    };
    const status={body:'ready',segmental:'ready',workouts:'ready',exercises:'ready',sets:'ready',nutrition:'ready',labs:'ready',sourceMetrics:'ready'};
    const annual=trainingDistributionModel(synthetic,status,bounds.start,bounds.end);
    const recent=trainingDistributionModel(synthetic,status,'2026-07-07','2026-08-31');
    const nutrition=nutritionPeriodModel(synthetic,status,bounds.start,bounds.end);
    const snapshot={data:state.data,domainStatus:state.domainStatus,analysisPeriod:state.ui.analysisPeriod};
    state.data=synthetic;state.domainStatus={...status};state.ui.analysisPeriod='365';
    const html=renderAnalysisHub();
    state.data=snapshot.data;state.domainStatus=snapshot.domainStatus;state.ui.analysisPeriod=snapshot.analysisPeriod;
    const doc=new DOMParser().parseFromString(html,'text/html');
    const bars=[...doc.querySelectorAll('.analysisBarRow')].map(r=>({label:r.querySelector('span')?.textContent||'',sessions:Number(r.querySelector('b')?.textContent||0)}));
    const top=[...doc.querySelectorAll('.analysisLead .analysisSecondaryMetrics .metric')].map(r=>({label:r.querySelector('span')?.textContent||'',value:r.querySelector('strong')?.textContent||''}));
    const legs=[...doc.querySelectorAll('.analysisRegion')].find(r=>r.querySelector('.analysisRegionHead span')?.textContent==='Pernas');
    return{
      bounds,
      adductor:normalizeMuscleGroup('Adutor/Abdutor'),
      abdomen:normalizeMuscleGroup('Abdômen'),
      annualQuad:annual.rows.find(r=>r.label==='Quadríceps')?.sessions,
      recentQuad:recent.rows.find(r=>r.label==='Quadríceps')?.sessions,
      annualAbdomen:annual.rows.find(r=>r.label==='Abdômen')?.sessions||0,
      nutrition,
      renderedQuad:bars.find(r=>r.label==='Quadríceps')?.sessions,
      renderedTotal:top.find(r=>r.label==='Treinos')?.value,
      renderedLegText:legs?.textContent||'',
      text:doc.body.textContent||''
    };
  });
  if(audit.bounds.start!=='2025-09-01'||audit.bounds.end!=='2026-08-31')throw new Error(`${label}: 365-day bounds incorrect ${JSON.stringify(audit.bounds)}`);
  if(audit.adductor!=='Adutores/abdutores'||audit.abdomen!=='Abdômen')throw new Error(`${label}: muscle taxonomy incorrect`);
  if(audit.annualQuad!==15||audit.recentQuad!==7)throw new Error(`${label}: period counts inconsistent annual=${audit.annualQuad} recent=${audit.recentQuad}`);
  if(audit.annualAbdomen!==0)throw new Error(`${label}: adductor leaked into abdomen`);
  if(audit.renderedQuad!==15||audit.renderedTotal!=='15')throw new Error(`${label}: rendered selected-period workout counts do not match canonical model`);
  if(!audit.renderedLegText.includes('3 sessão(ões) relacionadas'))throw new Error(`${label}: segmental interval did not preserve its separate 3-session context`);
  if(!audit.text.includes('As contagens abaixo usam somente esse intervalo, não o período inteiro.'))throw new Error(`${label}: segmental scope is not explicit`);
  if(!audit.text.includes('Mesma janela em toda esta seção'))throw new Error(`${label}: selected-period scope contract missing`);
  if(!audit.text.includes('Água ingerida')||!audit.text.includes('Sem dado')||!audit.text.includes('Carboidratos médios')||!audit.text.includes('Gordura média')||!audit.text.includes('Fibra média'))throw new Error(`${label}: expanded nutrition context missing`);
  if(audit.nutrition.waterDays!==0||audit.nutrition.waterAvgMl!==null)throw new Error(`${label}: missing water was converted to zero`);
  if(/\b(causou|provou|garante|piorou)\b/i.test(audit.text))throw new Error(`${label}: causal/value judgment leaked`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  await browser.close();
}
await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 analysis period consistency smoke passed');

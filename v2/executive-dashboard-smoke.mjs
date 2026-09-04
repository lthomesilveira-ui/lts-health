import {chromium} from 'playwright';
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/?fixture=1';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(`${base}#hoje`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-executive-dashboard]');

  const boundary=await page.evaluate(async()=>{
    const {buildIntegratedAnalysis}=await import('./src/integrated-analysis.js');
    const status={body:'ready',segmental:'ready',workouts:'ready',exercises:'ready',sets:'ready',nutrition:'ready',sourceMetrics:'ready',labs:'ready'};
    const data={
      body:[{measured_at:'2026-01-01',weight_kg:80,skeletal_muscle_mass_kg:36,fat_mass_kg:16,body_fat_pct:20},{measured_at:'2026-02-01',weight_kg:81,skeletal_muscle_mass_kg:36.5,fat_mass_kg:15.5,body_fat_pct:19}],
      segmental:[{measured_at:'2026-01-01',lean_right_arm_kg:4,lean_left_arm_kg:4,lean_trunk_kg:30,lean_right_leg_kg:10,lean_left_leg_kg:10,fat_right_arm_kg:1,fat_left_arm_kg:1,fat_trunk_kg:8,fat_right_leg_kg:2,fat_left_leg_kg:2},{measured_at:'2026-02-01',lean_right_arm_kg:4.1,lean_left_arm_kg:4.1,lean_trunk_kg:30.2,lean_right_leg_kg:10.2,lean_left_leg_kg:10.2,fat_right_arm_kg:.9,fat_left_arm_kg:.9,fat_trunk_kg:7.8,fat_right_leg_kg:1.9,fat_left_leg_kg:1.9}],
      workouts:[{source_record_id:'w1',workout_date:'2026-01-20',is_canonical:true,record_status:'validated'},{source_record_id:'w2',workout_date:'2026-02-02',is_canonical:true,record_status:'validated'},{source_record_id:'ghost',workout_date:'2099-01-01',is_canonical:false,record_status:'validated'}],
      exercises:[{source_record_id:'e1',workout_source_record_id:'w1',workout_date:'2026-01-20',exercise:'Agachamento Smith',machine:'Smith',muscle_group:'Quadríceps'},{source_record_id:'e2',workout_source_record_id:'w2',workout_date:'2026-02-02',exercise:'Agachamento Smith',machine:'Smith',muscle_group:'Quadríceps'},{source_record_id:'eg',workout_source_record_id:'ghost',workout_date:'2099-01-01',exercise:'Fantasma',machine:'X',muscle_group:'Peito'}],
      sets:[{exercise_source_record_id:'e1',weight:60,weight_unit:'kg'},{exercise_source_record_id:'e2',weight:80,weight_unit:'kg'},{exercise_source_record_id:'eg',weight:999,weight_unit:'kg'}],
      nutrition:[{nutrition_date:'2026-01-15',protein_g:120,calories_kcal:2200},{nutrition_date:'2026-01-31',protein_g:130,calories_kcal:2250},{nutrition_date:'2026-02-01',protein_g:140,calories_kcal:2300}],
      sourceMetrics:[{metric_date:'2026-01-31',metric_type:'sleep_duration_h',value:7,canonical_status:'candidate',source_name:'Apple Watch'},{metric_date:'2026-02-01',metric_type:'sleep_duration_h',value:7.2,canonical_status:'held',source_name:'Polar'}],
      labs:[{collection_date:'2026-01-01',laboratory:'Lab A',biomarker:'X',result_numeric:1,unit:'u'},{collection_date:'2026-02-01',laboratory:'Lab A',biomarker:'X',result_numeric:2,unit:'u'}]
    };
    const m=buildIntegratedAnalysis(data,status,new Date('2026-02-03T12:00:00Z'));
    return{referenceDay:m.referenceDay,total:m.training.distribution.totalSessions,groups:m.training.distribution.rows.map(r=>r.label),performance:m.training.performance[0]?.weight||null,sleep:m.sleep.days,labs:m.labs.comparable};
  });
  if(boundary.referenceDay!=='2026-02-02')throw new Error(`${label}: noncanonical workout moved reference day`);
  if(boundary.total!==2||boundary.groups.includes('Peito'))throw new Error(`${label}: noncanonical workout leaked into distribution`);
  if(boundary.performance!==80)throw new Error(`${label}: comparable performance failed`);
  if(boundary.sleep!==2)throw new Error(`${label}: preserved sleep coverage failed`);
  if(boundary.labs!==1)throw new Error(`${label}: safe lab comparison failed`);

  const text=(await page.textContent('#screenHost'))||'';
  for(const expected of ['Visão geral da sua saúde','Leitura principal da janela','Composição corporal','Treinos','Nutrição','Recuperação','Exames','Resumo executivo','Próximas revisões','Dados conectados','Hidratação'])if(!text.includes(expected))throw new Error(`${label}: missing executive cockpit section ${expected}`);
  if((await page.locator('.cockpitStatus').count())!==5)throw new Error(`${label}: cockpit should expose five executive domains`);
  if((await page.locator('.cockpitModule').count())<6)throw new Error(`${label}: analytical cockpit modules missing`);
  if(!await page.locator('#analysisPeriod').isVisible())throw new Error(`${label}: global period filter missing`);
  if(!text.includes('Sem registro de ingestão de água')||!text.includes('Água corporal da bioimpedância não é hidratação'))throw new Error(`${label}: missing hydration boundary is not explicit`);
  for(const forbidden of ['LTS Health Intelligence','ActivitySummary','source_family','canonical','candidato'])if(text.includes(forbidden))throw new Error(`${label}: technical language leaked: ${forbidden}`);
  if(/\b(causou|provou|garante|piorou)\b/i.test(text))throw new Error(`${label}: causal/value judgment language leaked`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}
await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
await run({width:320,height:700},'compact');
console.log('LTS Health executive cockpit smoke passed');

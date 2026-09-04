import { chromium } from 'playwright';

async function noOverflow(page,label,route){const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);if(overflow>3)throw new Error(`${label}/${route}: horizontal overflow ${overflow}px`);}
async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto('http://127.0.0.1:4173/?fixture=1#hoje',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Visão geral da sua saúde');
  const text=(await page.locator('#screenHost').textContent())||'';
  for(const expected of ['assistente longitudinal','Composição corporal','Treinos','Nutrição','Recuperação','Exames','Leitura principal da janela','Ritmo e distribuição','Registro e médias','Gordura corporal','Resumo executivo','Próximas revisões','Dados conectados'])if(!text.includes(expected))throw new Error(`${label}: cockpit v3 missing ${expected}`);
  if((await page.locator('.cockpitStatus').count())!==5)throw new Error(`${label}: cockpit should expose five executive domains`);
  if(!text.includes('Sem registro de ingestão de água')||!text.includes('Água corporal da bioimpedância não é hidratação'))throw new Error(`${label}: hydration boundary is not explicit`);
  if(!await page.locator('#analysisPeriod').isVisible())throw new Error(`${label}: period filter missing from cockpit`);
  await page.selectOption('#analysisPeriod','90');
  await page.waitForFunction(()=>document.querySelector('[data-executive-dashboard]')?.dataset.period==='90');
  if((await page.locator('.cockpitChart svg').count())<2)throw new Error(`${label}: useful filtered charts missing`);
  await noOverflow(page,label,'hoje');

  const audit=await page.evaluate(async()=>{
    const {executiveCockpitModel,activitySleepSnapshot}=await import('./src/today-screen.js');
    const status={body:'ready',workouts:'ready',exercises:'ready',sets:'ready',nutrition:'ready',labs:'ready',metrics:'ready',sourceMetrics:'ready'};
    const data={
      body:[{measured_at:'2026-07-15',weight_kg:100,skeletal_muscle_mass_kg:49,fat_mass_kg:14,body_fat_pct:14,source:'same'},{measured_at:'2026-08-20',weight_kg:99,skeletal_muscle_mass_kg:49.5,fat_mass_kg:13.2,body_fat_pct:13.3,source:'same'}],
      workouts:[{source_record_id:'w1',workout_date:'2026-07-10',workout_type:'Upper',is_canonical:true,record_status:'validated'},{source_record_id:'w2',workout_date:'2026-07-20',workout_type:'Lower',is_canonical:true,record_status:'validated'},{source_record_id:'w3',workout_date:'2026-08-10',workout_type:'Upper',is_canonical:true,record_status:'validated'},{source_record_id:'w4',workout_date:'2026-08-20',workout_type:'Lower',is_canonical:true,record_status:'validated'}],
      exercises:[{source_record_id:'e1',workout_source_record_id:'w1',workout_date:'2026-07-10',exercise:'Supino',machine:'A',muscle_group:'Peito'},{source_record_id:'e2',workout_source_record_id:'w2',workout_date:'2026-07-20',exercise:'Extensora',machine:'B',muscle_group:'Quadríceps'},{source_record_id:'e3',workout_source_record_id:'w3',workout_date:'2026-08-10',exercise:'Supino',machine:'A',muscle_group:'Peito'},{source_record_id:'e4',workout_source_record_id:'w4',workout_date:'2026-08-20',exercise:'Extensora',machine:'B',muscle_group:'Quadríceps'}],
      sets:[{source_record_id:'s1',exercise_source_record_id:'e1',workout_source_record_id:'w1',workout_date:'2026-07-10',weight:80,weight_unit:'kg'},{source_record_id:'s2',exercise_source_record_id:'e3',workout_source_record_id:'w3',workout_date:'2026-08-10',weight:85,weight_unit:'kg'}],
      nutrition:[{nutrition_date:'2026-08-18',calories_kcal:2200,protein_g:160,water_ml:null},{nutrition_date:'2026-08-19',calories_kcal:2300,protein_g:170,water_ml:null},{nutrition_date:'2026-08-19',calories_kcal:9999,protein_g:999,water_ml:4000}],
      labs:[{collection_date:'2026-08-15',laboratory:'Lab',biomarker:'Glicose',result_numeric:90,unit:'mg/dL'}],
      metrics:[{measured_at:'2026-08-20T12:00:00Z',metric_type:'active_energy_kcal',value:650,unit:'kcal',source:'Apple Health ActivitySummary'},{measured_at:'2099-01-01T12:00:00Z',metric_type:'active_energy_kcal',value:9999,unit:'kcal',source:'Other Device'}],
      sourceMetrics:[{metric_date:'2026-08-18',metric_type:'sleep_duration_h',value:7.2,unit:'h',canonical_status:'candidate',source_name:'Apple Watch',source_family:'apple_watch'},{metric_date:'2026-08-18',metric_type:'sleep_duration_h',value:6.8,unit:'h',canonical_status:'held',source_name:'Polar Flow',source_family:'polar_flow'}]
    };
    const m=executiveCockpitModel(data,status,'30'),a=activitySleepSnapshot(data,status);
    return{nutritionDays:m.nutrition.days,waterDays:m.water.length,sleepSources:m.sleep.sources.length,energy:a.activeEnergy.row?.value,topGroups:m.training.topGroups.map(x=>x.label),bodyAvailable:m.body.available};
  });
  if(audit.nutritionDays!==1)throw new Error(`${label}: ambiguous nutrition day entered cockpit averages`);
  if(audit.waterDays!==0)throw new Error(`${label}: ambiguous or missing water was promoted`);
  if(audit.sleepSources!==2)throw new Error(`${label}: sleep sources were consolidated`);
  if(audit.energy!==650)throw new Error(`${label}: non-approved activity source entered cockpit`);
  if(!audit.topGroups.includes('Peito')||!audit.topGroups.includes('Quadríceps'))throw new Error(`${label}: structured training groups missing`);
  if(!audit.bodyAvailable)throw new Error(`${label}: comparable body pair not recognized`);
  await page.evaluate(()=>{location.hash='#analise'});
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Insights');
  const insightText=(await page.locator('#screenHost').textContent())||'';
  if(!insightText.includes('Resumo executivo')||!insightText.includes('Protocolos'))throw new Error(`${label}: Insights route regressed`);
  await noOverflow(page,label,'insights');
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}
await run({width:1440,height:1000},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health cockpit v3 smoke passed');

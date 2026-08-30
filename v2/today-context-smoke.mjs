import {chromium} from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#hoje';

async function rerenderHome(page){
  await page.evaluate(()=>{location.hash='bio';});
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Bio');
  await page.evaluate(()=>{location.hash='hoje';});
  await page.waitForSelector('[data-executive-dashboard]');
}

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForSelector('[data-executive-dashboard]');

  let text=(await page.textContent('#screenHost'))||'';
  for(const expected of ['LTS Health Intelligence','Estado atual','Intelligence','Pontos de atenção','Cobertura','Pergunte ao histórico']){
    if(!text.includes(expected))throw new Error(`${label}: missing executive context section ${expected}`);
  }
  if(!text.includes('sem atribuir causa às mudanças corporais'))throw new Error(`${label}: cross-domain body context does not state the causal limitation`);
  if(/\b(causou|provou|garante|melhorou|piorou)\b/i.test(text))throw new Error(`${label}: dashboard used causal or value-judgment language`);
  if(/\bNaN\b|\bundefined\b/.test(text))throw new Error(`${label}: dashboard rendered an invalid missing value`);
  if((await page.locator('.intelCurrentCard').count())!==6)throw new Error(`${label}: current-state snapshot should contain six cards`);

  const engineChecks=await page.evaluate(async()=>{
    const {buildHealthIntelligence}=await import('./src/intelligence-engine.js');
    const ready={body:'ready',workouts:'ready',exercises:'ready',sets:'ready',nutrition:'ready',metrics:'ready',sourceMetrics:'ready',labs:'ready',uploads:'ready'};
    const baseData={body:[],nutrition:[],metrics:[],sourceMetrics:[],labs:[],uploads:[]};
    const differentMachines={
      ...baseData,
      workouts:[
        {source_record_id:'new',workout_date:'2026-03-02',workout_type:'A'},
        {source_record_id:'old',workout_date:'2026-03-01',workout_type:'B'}
      ],
      exercises:[
        {source_record_id:'ex-new',workout_source_record_id:'new',workout_date:'2026-03-02',exercise:'Remada',machine:'Máquina B'},
        {source_record_id:'ex-old',workout_source_record_id:'old',workout_date:'2026-03-01',exercise:'Remada',machine:'Máquina A'}
      ],
      sets:[
        {source_record_id:'set-new',exercise_source_record_id:'ex-new',workout_source_record_id:'new',weight:80,weight_unit:'kg'},
        {source_record_id:'set-old',exercise_source_record_id:'ex-old',workout_source_record_id:'old',weight:70,weight_unit:'kg'}
      ]
    };
    const sameMachine={
      ...differentMachines,
      exercises:[
        {source_record_id:'ex-new',workout_source_record_id:'new',workout_date:'2026-03-02',exercise:'Remada',machine:'Máquina A'},
        {source_record_id:'ex-old',workout_source_record_id:'old',workout_date:'2026-03-01',exercise:'Remada',machine:'Máquina A'}
      ]
    };
    const candidateOnly={
      ...baseData,
      workouts:[],exercises:[],sets:[],
      sourceMetrics:[{source_record_id:'candidate',metric_date:'2026-03-02',metric_type:'steps',value:1000,unit:'count',source_name:'Apple Watch',source_family:'apple_watch',canonical_status:'candidate'}]
    };
    const diff=buildHealthIntelligence(differentMachines,ready,new Date('2026-03-02T12:00:00Z'));
    const same=buildHealthIntelligence(sameMachine,ready,new Date('2026-03-02T12:00:00Z'));
    const candidate=buildHealthIntelligence(candidateOnly,ready,new Date('2026-03-02T12:00:00Z'));
    return{
      crossMachinePerformance:diff.insights.some(i=>i.title==='Performance comparável registrada'),
      sameMachinePerformance:same.insights.some(i=>i.title==='Performance comparável registrada'),
      candidatePending:candidate.pending?.title||'',
      candidateMetricSummary:candidate.cross.find(i=>i.title==='Cobertura recente de atividade e sono')?.summary||''
    };
  });
  if(engineChecks.crossMachinePerformance)throw new Error(`${label}: performance was compared across different machines`);
  if(!engineChecks.sameMachinePerformance)throw new Error(`${label}: same exercise/machine/unit comparison disappeared`);
  if(!engineChecks.candidatePending.includes('fora da visão principal'))throw new Error(`${label}: candidate-only source data is not held outside conclusions`);
  if(!engineChecks.candidateMetricSummary.includes('atividade aparece em 0 dia(s)'))throw new Error(`${label}: candidate-only source data leaked into consolidated activity coverage`);

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.metrics=[];
    state.data.sourceMetrics=[{source_record_id:'apple-candidate',metric_date:'2026-03-02',metric_type:'steps',value:1000,unit:'count',source_name:'Apple Watch',source_family:'apple_watch',canonical_status:'candidate'}];
  });
  await rerenderHome(page);
  text=(await page.textContent('#screenHost'))||'';
  const activity=(await page.locator('.intelCurrentCard').filter({hasText:'Atividade consolidada'}).textContent())||'';
  const sleep=(await page.locator('.intelCurrentCard').filter({hasText:'Sono consolidado'}).textContent())||'';
  if(!activity.includes('Sem dado consolidado')||activity.includes('1.000'))throw new Error(`${label}: candidate steps appeared as consolidated current activity`);
  if(!sleep.includes('Sem dado consolidado'))throw new Error(`${label}: missing consolidated sleep was not explicit`);
  if(!text.includes('Há dados recebidos ainda fora da visão principal'))throw new Error(`${label}: candidate review state is not surfaced as an attention point`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: intelligence context caused horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health intelligence context smoke passed');

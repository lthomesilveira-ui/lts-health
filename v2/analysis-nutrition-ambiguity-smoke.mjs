import {chromium} from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#analise';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Análise');

  const html=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {renderAnalysisHub}=await import('./src/analysis-screen.js');
    const original={body:state.data.body,segmental:state.data.segmental,nutrition:state.data.nutrition,period:state.ui.analysisPeriod,status:{...state.domainStatus}};
    state.domainStatus.body='ready';
    state.domainStatus.segmental='ready';
    state.domainStatus.nutrition='ready';
    state.data.body=[
      {source_record_id:'b1',measured_at:'2026-01-01',weight_kg:80,skeletal_muscle_mass_kg:36,fat_mass_kg:16,body_fat_pct:20},
      {source_record_id:'b2',measured_at:'2026-02-01',weight_kg:81,skeletal_muscle_mass_kg:36.5,fat_mass_kg:15.5,body_fat_pct:19}
    ];
    state.data.segmental=[
      {source_record_id:'s1',measured_at:'2026-01-01',lean_right_arm_kg:4,lean_left_arm_kg:4,lean_trunk_kg:30,lean_right_leg_kg:10,lean_left_leg_kg:10},
      {source_record_id:'s2',measured_at:'2026-02-01',lean_right_arm_kg:4.1,lean_left_arm_kg:4.1,lean_trunk_kg:30.2,lean_right_leg_kg:10.2,lean_left_leg_kg:10.2}
    ];
    state.data.nutrition=[
      {source_record_id:'n1',nutrition_date:'2026-01-15',protein_g:100,calories_kcal:2000},
      {source_record_id:'n2',nutrition_date:'2026-01-15',protein_g:220,calories_kcal:9000}
    ];
    state.ui.analysisPeriod='all';
    const result=renderAnalysisHub();
    state.data.body=original.body;
    state.data.segmental=original.segmental;
    state.data.nutrition=original.nutrition;
    state.ui.analysisPeriod=original.period;
    Object.assign(state.domainStatus,original.status);
    return result;
  });

  for(const expected of ['Alimentação em revisão','1 dia tem mais de um registro preservado','Nenhum deles foi somado, escolhido ou usado em médias','1 dia em revisão','fica fora das médias e comparações até revisão'])if(!html.includes(expected))throw new Error(`${label}: missing nutrition review state ${expected}`);
  for(const forbidden of ['6.000 kcal/dia','160 g/dia'])if(html.includes(forbidden))throw new Error(`${label}: ambiguous nutrition leaked into averages ${forbidden}`);
  if(/Alimentação · todo o histórico[\s\S]{0,400}<strong>0<\/strong>/.test(html))throw new Error(`${label}: review-only nutrition rendered as numeric zero`);
  if(errors.length)throw new Error(`${label}: page errors ${errors.join(' | ')}`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 analysis nutrition ambiguity smoke passed');

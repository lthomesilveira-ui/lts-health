import {webkit} from 'playwright';
import {auditIntegratedDashboard} from './real-auth-dashboard-checks.mjs';

// Uses the existing one-time owner audit session against the public app.
// Authentication state and observations stay in memory. Only fixed case names,
// booleans and layout dimensions enter logs; screenshots use the encrypted path.
const ready={hoje:'[data-health-dashboard]',treinos:'.ltsTrainingV2',saude:'.ltsLabsV2',nutricao:'.ltsNutritionProduct',dados:'[data-health-auto-export]'};
const requireCheck=(ok,stage,checks)=>{if(!ok){const error=new Error('Owner browser flow failed; private observations withheld');error.auditCode=`owner-flow-${stage}`;error.flowChecks=checks;throw error;}};

async function geometry(page){
 const checks=await page.evaluate(()=>{
  const host=document.querySelector('#screenHost');
  const controls=[...document.querySelectorAll('.refMetricLine b,.refMetricLine small,.ltsPointReadout p,.ltsRefSetTable')].filter(el=>el.getBoundingClientRect().width>0);
  const components={};
  for(const [name,selector]of Object.entries({labPage:'.ltsLabsV2',labMarker:'#productLabMarkerSelect',labCohort:'#productLabCohort',labPoint:'#productLabPoint',labTrend:'#productLabsTrend',labHistory:'#productLabsHistory',labCollection:'#productLabsCollection',labContext:'.ltsLabSeriesContext',labHistoryRow:'.ltsLabsHistoryRow',labRail:'.ltsLabsMarkerRail'})){
   const nodes=[...document.querySelectorAll(selector)];
   components[name+'Width']=Math.max(0,...nodes.map(el=>el.getBoundingClientRect().width));
   components[name+'Right']=Math.max(0,...nodes.map(el=>el.getBoundingClientRect().right));
   components[name+'Scroll']=Math.max(0,...nodes.map(el=>el.scrollWidth));
  }
  return {...components,documentFits:document.documentElement.scrollWidth<=innerWidth+1,hostFits:!host||host.scrollWidth<=host.clientWidth+1,
   fontsReadable:controls.every(el=>parseFloat(getComputedStyle(el).fontSize)>=10.5),minimumFont:controls.length?Math.min(...controls.map(el=>parseFloat(getComputedStyle(el).fontSize))):null,
   documentWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,hostWidth:host?.clientWidth??0,hostScrollWidth:host?.scrollWidth??0};
 });
 requireCheck(checks.documentFits&&checks.hostFits&&checks.fontsReadable,'geometry',checks);
}

async function runSurface(page,{label,mobile,appUrl,evidenceDir,owner,expectedBuild}){
 const report=[],activate=locator=>mobile?locator.tap():locator.click();
 const visit=async route=>{
  const nav=mobile?'#mobileNav':'#primaryNav',direct=page.locator(`${nav} [data-route="${route}"]`);
  if(await direct.count())await activate(direct);
  else{await activate(page.locator(`${nav} [data-route="mais"]`));await page.waitForSelector('#moreSheet:not(.hidden)');await activate(page.locator(`#moreSheet [data-route="${route}"]`));}
  await page.waitForFunction(async({route,selector})=>{
   const {state}=await import('./src/core.js');
   return state.route===route&&location.hash===`#${route}`&&document.body.dataset.productRoute===route&&Boolean(document.querySelector(selector))&&!document.querySelector('#screenHost .loadingState');
  },{route,selector:ready[route]});
 };
 requireCheck(await page.evaluate(async expected=>{const {state,fixtureMode}=await import('./src/core.js');return !fixtureMode&&state.session?.user?.id===expected;},owner),'auth');

 const cases={
  home:async()=>{
   await visit('hoje');
   // The published import map routes Home to the integrated dashboard. Reuse
   // its established source/coverage audit, rather than the retired renderer.
   await auditIntegratedDashboard(page,{expectedBuild});
   for(const period of ['30','90','30']){
    await activate(page.locator('[data-dashboard-mode="period"]'));
    await page.locator('#dashboard-period').selectOption(period);
    await page.waitForFunction(async period=>{
     const {state,fmtNum}=await import('./src/core.js'),{healthDashboardModel}=await import('./src/health-dashboard-model.js');
     const model=healthDashboardModel(state.data,state.domainStatus,state.ui);
     return state.ui.dashboardPeriod===period&&model.mode==='period'&&document.querySelector('#dashboard-period')?.value===period&&
      model.metrics.every(metric=>document.querySelector(`[data-dashboard-card="${metric.key}"] .healthMetricValue strong`)?.textContent===(metric.value==null?'—':fmtNum(metric.value,metric.key==='sleep'?1:0)));
    },period);
    await geometry(page);
    await page.screenshot({path:`${evidenceDir}/owner-${label}-home-${period}.png`,fullPage:true});
   }
  },
  workout:async()=>{
   await visit('treinos');await activate(page.locator('.ltsRefTrainTabs [data-depth-training-view="history"]'));
   await activate(page.locator('[data-depth-clear="training"]'));
   const target=await page.evaluate(async()=>{
    const {state,sb,workoutRows,exercisesFor,setsFor}=await import('./src/core.js');
    const row=workoutRows().find(w=>exercisesFor(w).some(e=>setsFor(e).length));if(!row)return null;
    const [exercises,sets]=await Promise.all([
     sb.from('health_workout_exercises').select('source_record_id').eq('workout_source_record_id',row.source_record_id),
     sb.from('health_workout_sets').select('source_record_id').eq('workout_source_record_id',row.source_record_id)
    ]);
    if(exercises.error||sets.error)return null;
    const expectedExercises=exercisesFor(row),expectedSets=expectedExercises.flatMap(setsFor);
    if(exercises.data.length!==expectedExercises.length||sets.data.length!==expectedSets.length)return null;
    return{id:row.source_record_id,exercises:exercises.data.length,sets:sets.data.length};
   });
   requireCheck(target&&target.sets>0,'workout');
   let selected=page.locator(`[data-depth-workout=${JSON.stringify(target.id)}]`);
   for(let attempt=0;!(await selected.count())&&attempt<100;attempt++){
    const next=page.locator('[data-depth-page="productTrainingPage"]').last();if(await next.isDisabled())break;await activate(next);
   }
   requireCheck(await selected.count()===1,'workout');
   const before=await page.evaluate(async()=>{const {state}=await import('./src/core.js');return JSON.stringify([state.ui.productTrainingPage||1,state.ui.productTrainingYear||'all',state.ui.productTrainingQuery||'']);});
   await activate(selected);await page.waitForFunction(id=>document.querySelector('.ltsTrainingV2')?.dataset.workoutId===id,target.id);
   await activate(page.locator('.ltsRefTrainTabs [data-depth-training-view="exercises"]'));
   await page.waitForSelector('.ltsRefExerciseCard .ltsRefSetTable');
   requireCheck(await page.locator('.ltsRefExerciseCard').count()===target.exercises&&await page.locator('.ltsRefExerciseCard .ltsRefSetTable>div:not(.ltsRefSetEmpty)').count()===target.sets,'workout');
   await geometry(page);await page.screenshot({path:`${evidenceDir}/owner-${label}-workout-series.png`,fullPage:true});
   await activate(page.locator('.ltsRefTrainTabs [data-depth-training-view="history"]'));
   const returned=await page.evaluate(async before=>{
    const {state}=await import('./src/core.js');
    return state.route==='treinos'&&document.querySelector('.ltsTrainingV2')?.dataset.trainingView==='history'&&
     JSON.stringify([state.ui.productTrainingPage||1,state.ui.productTrainingYear||'all',state.ui.productTrainingQuery||''])===before;
   },before);
   requireCheck(returned,'workout-return');
   requireCheck(await page.locator(`[data-depth-workout=${JSON.stringify(target.id)}]`).count()===1,'workout-return');
  },
  labs:async()=>{
   await visit('saude');
   if(await page.locator('[data-lab-clear-asof]').count())await activate(page.locator('[data-lab-clear-asof]'));
   await page.locator('#productLabQuery').fill('');await activate(page.locator('[data-depth-period="productLabPeriod"][data-value="all"]'));
   const target=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');const {labGroups,labCohorts,labChartModel,labResultText}=await import('./src/labs-layout-v2.js');
    for(const group of labGroups(state.data.labs))for(const cohort of labCohorts(group)){
     const points=labChartModel(cohort).points;if(points.length<2)continue;
     return{marker:group.key,cohort:cohort.key,index:0,date:points[0].date,value:points[0].value,unit:cohort.unit,raw:labResultText(points[0].row)};
    }return null;
   });
   requireCheck(Boolean(target),'labs');await page.locator('#productLabMarkerSelect').selectOption(target.marker);
   await page.locator('#productLabCohort').selectOption(target.cohort);await page.locator('#productLabPoint').selectOption(String(target.index));
   await page.waitForFunction(expected=>document.querySelector('.ltsPointReadout p > b')?.textContent===expected,`${Number(target.value).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:20})} ${target.unit}`);
   const exact=await page.locator('.ltsPointReadout').evaluate((node,target)=>node.textContent.includes(target.date.split('-').reverse().join('/'))&&[...node.querySelectorAll('span')].some(span=>span.textContent===`Resultado original: ${target.raw}`),target);
   requireCheck(exact,'labs');await geometry(page);
   await page.screenshot({path:`${evidenceDir}/owner-${label}-lab-point.png`,fullPage:true});
  },
  water:async()=>{
   await visit('nutricao');
   const matches=await page.evaluate(async()=>{
    const {state,fmtDate,fmtNum}=await import('./src/core.js'),{homeCockpitModel}=await import('./src/home-cockpit.js');
    const c=homeCockpitModel(state.data,state.domainStatus,state.ui.nutritionPeriod||state.ui.analysisPeriod||'90',state.ui),last=c.evo.latestWater;
    const panel=[...document.querySelectorAll('.ltsCockpitPanel')].find(node=>node.querySelector('h2')?.textContent==='Água consumida');
    if(!panel||!c.r.water.available||!last)return false;
    return panel.querySelector('.ltsCockpitCaption')?.textContent===`${fmtDate(last.date)} · consumo registrado`&&
     panel.textContent.includes(`${fmtNum(last.value,0)} mL`)&&panel.textContent.includes('dias ausentes não são zero')&&
     (last.date>=c.m.today||!c.r.water.rows.some(row=>row.date===c.m.today));
   });
   requireCheck(matches,'water');await geometry(page);
   await page.getByRole('heading',{name:'Água consumida',exact:true}).scrollIntoViewIfNeeded();
   await page.screenshot({path:`${evidenceDir}/owner-${label}-water-history.png`,fullPage:true});
  },
  receipts:async()=>{
   await visit('dados');
   await page.waitForSelector('[data-google-health][aria-busy="false"]');
   const response=page.waitForResponse(response=>response.url().endsWith('/functions/v1/health-auto-export-connection')&&response.request().method()==='POST'&&response.request().postDataJSON()?.action==='status');
   await activate(page.locator('[data-hae-check]'));const received=await response;
   requireCheck(received.ok(),'receipts');const status=await received.json();
   await page.waitForFunction(async status=>{
    const {state}=await import('./src/core.js');const actual=state.autoExportConnection;
    return actual?.status==='ready'&&['configured','received','last_received_at','last_metric_date','last_metric_count','last_water_date'].every(key=>JSON.stringify(actual[key]??null)===JSON.stringify(status[key]??null))&&!document.querySelector('[data-hae-check]')?.disabled;
   },status);
   const matches=await page.evaluate(async status=>{
    const {sb,fmtDate}=await import('./src/core.js');
    const [{data:google,error:googleError},{data:polar,error:polarError}]=await Promise.all([
     sb.functions.invoke('health-google-connection',{body:{action:'status'}}),sb.functions.invoke('health-polar-connection',{body:{action:'status'}})
    ]);
    if(googleError||polarError||typeof google?.configured!=='boolean'||typeof google.connected!=='boolean'||typeof polar?.configured!=='boolean'||typeof polar.connected!=='boolean')return false;
    const card=document.querySelector('[data-health-auto-export]'),gap=status.configured&&status.received&&status.last_metric_date&&(!status.last_water_date||status.last_water_date<status.last_metric_date);
    const expected=gap?'Água sem atualização':status.configured&&status.received?'Histórico disponível':status.configured?'Aguardando primeiro envio':'Ativação no iPhone pendente';
    if(card?.querySelector('.pill')?.textContent!==expected)return false;
    if(status.received&&(!card.textContent.includes(new Date(status.last_received_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))||!card.textContent.includes(fmtDate(status.last_metric_date))))return false;
    if(status.last_water_date&&!card.textContent.includes(fmtDate(status.last_water_date)))return false;
    if(gap&&!card.querySelector('.healthSourceCaution'))return false;
    const googleLabel=google.last_error==='authorization_expired'?'Autorização expirada':google.connected?'Conta autorizada':google.configured?'Conta não conectada':'Integração indisponível';
    const polarLabel=polar.connected?'Conta conectada':polar.configured?'Pronta para conectar':'Configuração pendente';
    const cards=[...document.querySelectorAll('[data-connections] .sourceStatus')];
    const polarCard=cards.find(card=>card.querySelector('.sourceStatusTop b')?.textContent==='Polar Flow');
    const mfpCard=cards.find(card=>card.querySelector('.sourceStatusTop b')?.textContent==='MyFitnessPal');
    return document.querySelector('[data-google-health] .pill')?.textContent===googleLabel&&polarCard?.querySelector('.pill')?.textContent===polarLabel&&mfpCard?.querySelector('.pill')?.textContent==='Pelo Saúde do iPhone'&&
     !document.querySelector('[data-disclosure="health-auto-export-setup"]')?.open&&!document.querySelector('input[aria-label="Chave privada do Health Auto Export"]');
   },status);
   requireCheck(matches,'integrations');await geometry(page);
   await page.locator('[data-health-auto-export]').scrollIntoViewIfNeeded();
   await page.screenshot({path:`${evidenceDir}/owner-${label}-receipt-states.png`,fullPage:true});
  }
 };
 for(const [name,operation]of Object.entries(cases)){
  try{await operation();report.push({surface:label,case:name,passed:true});}
  catch(error){
   const stage=/^owner-flow-(?:auth|home|workout|workout-return|labs|water|receipts|integrations|geometry)$/.test(error?.auditCode||'')?error.auditCode:`owner-flow-${name}`;
   try{await page.screenshot({path:`${evidenceDir}/owner-${label}-${name}-failure.png`,fullPage:true});}catch{}
   const allowed=['ready','period','range','chartBounds','nutrition','sleep','water','nutritionChart','sleepChart','waterChart','documentFits','hostFits','fontsReadable','minimumFont','documentWidth','viewportWidth','hostWidth','hostScrollWidth'];
   const checks=error?.flowChecks&&Object.fromEntries(Object.entries(error.flowChecks).filter(([key,value])=>(allowed.includes(key)||/^lab(?:Page|Marker|Cohort|Point|Trend|History|Collection|Context|HistoryRow|Rail)(?:Width|Right|Scroll)$/.test(key))&&(typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=100000||value===null)));
   report.push({surface:label,case:name,passed:false,stage,...(checks?{checks}:{})});
  }
 }
 return report;
}

export async function verifyOwnerBrowserFlows(page,{appUrl,evidenceDir,expectedBuild}){
 const owner=await page.evaluate(async()=>{const {state}=await import('./src/core.js');return state.session?.user?.id;});
 requireCheck(Boolean(owner),'auth');
 await page.setViewportSize({width:1440,height:1000});
 const report=await runSurface(page,{label:'desktop-chromium',mobile:false,appUrl,evidenceDir,owner,expectedBuild});
 let browser;
 try{
  browser=await webkit.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,storageState:await page.context().storageState()});
  const mobile=await context.newPage();let errors=0;
  mobile.on('pageerror',()=>errors++);mobile.on('console',message=>{if(message.type()==='error')errors++;});
  await mobile.goto(appUrl,{waitUntil:'domcontentloaded'});await mobile.waitForSelector('#app:not(.hidden)',{timeout:30000});
  report.push(...await runSurface(mobile,{label:'mobile-webkit-touch',mobile:true,appUrl,evidenceDir,owner,expectedBuild}));
  requireCheck(errors===0,'runtime');await context.close();
 }catch(error){report.push({surface:'mobile-webkit-touch',case:'environment',passed:false,stage:/^owner-flow-(?:auth|runtime)$/.test(error?.auditCode||'')?error.auditCode:'owner-flow-auth'});}
 finally{if(browser)await browser.close();}
 console.log('Authenticated owner browser flow outcomes: '+JSON.stringify(report));
 const failure=report.find(item=>!item.passed);if(failure){const error=new Error('Owner browser verification failed; private details withheld');error.auditCode=failure.stage;throw error;}
}

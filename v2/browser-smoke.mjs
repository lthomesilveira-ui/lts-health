import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1';
const forbidden=/\b(canonical|parity|backend|provenance[- ]first|readiness|PWA)\b/i;

async function assertScreen(page,title,label){
  await page.waitForFunction(t=>document.querySelector('#screenHost h1')?.textContent===t,title);
  const text=(await page.textContent('#screenHost'))||'';
  if(text.trim().length<20) throw new Error(`${label}: screen unexpectedly empty`);
  if(text.match(forbidden)) throw new Error(`${label}: implementation jargon visible`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3) throw new Error(`${label}: horizontal overflow ${overflow}px`);
}

async function openMoreRoute(page,nav,route,title,label){
  await page.click(`${nav} [data-route="mais"]`);
  await page.waitForSelector('#moreSheet:not(.hidden)');
  await page.click(`#moreSheet [data-route="${route}"]`);
  await assertScreen(page,title,label);
}

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await assertScreen(page,'Bio',`${label}/bio`);
  const nav=viewport.width<720?'#mobileNav':'#primaryNav';

  const parserRouting=await page.evaluate(async()=>{
    const {inspectFunctionForSource}=await import('./src/core.js');
    return {
      apple:inspectFunctionForSource('apple_health'),
      mfp:inspectFunctionForSource('myfitnesspal'),
      polar:inspectFunctionForSource('polar_flow'),
      fleury:inspectFunctionForSource('fleury'),
      einstein:inspectFunctionForSource('einstein')
    };
  });
  if(Object.values(parserRouting).some(value=>value!=='health-inspect-upload'))throw new Error(`${label}: stable ingestion routing is incorrect`);

  const initial=await page.textContent('#screenHost');
  if(!initial.includes('90,0')||!initial.includes('91,0')||!initial.includes('Primeiro e último registro')) throw new Error(`${label}: fixture body history did not render`);
  await page.click('[data-bio-metric="skeletal_muscle_mass_kg"]');
  await page.waitForFunction(()=>document.querySelector('[data-bio-metric="skeletal_muscle_mass_kg"]')?.classList.contains('active'));
  await page.selectOption('#compareA','2026-01-01');
  await page.selectOption('#compareB','2026-02-01');
  await page.click('#routeAction');
  await page.waitForSelector('#entryModal:not(.hidden) #bodyEntryForm');
  await page.click('#closeEntry');

  await page.click(`${nav} [data-route="treinos"]`);
  await assertScreen(page,'Treinos',`${label}/treinos`);
  await page.selectOption('#trainingPeriod','all');
  await page.waitForSelector('[data-workout="workout-2"]');
  await page.click('[data-workout="workout-2"]');
  await page.waitForSelector('.session.open .sessionBody');
  const trainingText=await page.textContent('#screenHost');
  if(!trainingText.includes('Supino máquina')||!trainingText.includes('90 kg')) throw new Error(`${label}: workout drilldown did not render`);
  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.exercises=[...(state.data.exercises||[]),{source_record_id:'ex-progression',workout_source_record_id:'workout-1',workout_date:'2026-01-28',order_index:4,exercise:'Supino máquina',machine:'Máquina de teste',muscle_group:'Peito',source:'Fixture de interface'}];
    state.data.sets=[...(state.data.sets||[]),{source_record_id:'set-progression',exercise_source_record_id:'ex-progression',workout_source_record_id:'workout-1',workout_date:'2026-01-28',set_index:1,phase:'working',weight:70,weight_unit:'kg',reps_numeric:10,reps_raw:'10',source:'Fixture de interface'}];
  });
  await page.fill('#exerciseQuery','supino');
  await page.waitForFunction(()=>document.querySelectorAll('.exerciseList button').length===1);
  await page.waitForSelector('.exerciseProgressUnit svg');
  const progression=(await page.locator('.exerciseProgression').textContent())||'';
  if(!progression.includes('70 → 90 kg')||!progression.includes('Não estima repetição máxima'))throw new Error(`${label}: unit-safe exercise progression did not render`);
  await page.click('#routeAction');
  await page.waitForSelector('#entryModal:not(.hidden) #workoutEntryForm');
  await page.click('[data-add-exercise]');
  if((await page.locator('.exerciseEntry').count())!==2) throw new Error(`${label}: add exercise control failed`);
  await page.click('.exerciseEntry:first-child [data-add-set]');
  if((await page.locator('.exerciseEntry:first-child .setEntry').count())!==2) throw new Error(`${label}: add set control failed`);
  page.once('dialog',dialog=>dialog.accept());
  await page.click('#closeEntry');
  await page.waitForFunction(()=>document.querySelector('#entryModal')?.classList.contains('hidden')===true);

  await page.click(`${nav} [data-route="evolucao"]`);
  await assertScreen(page,'Evolução',`${label}/evolucao`);
  await page.click('[data-evolution-metric="skeletal_muscle_mass_kg"]');
  await page.waitForFunction(()=>document.querySelector('[data-evolution-metric="skeletal_muscle_mass_kg"]')?.classList.contains('active'));
  if((await page.locator('[data-segmental-date]').count())!==2) throw new Error(`${label}: segmental dates missing`);
  await page.click('[data-segmental-date="2026-01-01"]');
  await page.waitForFunction(()=>document.querySelector('[data-segmental-date="2026-01-01"]')?.classList.contains('active'));

  await page.click(`${nav} [data-route="analise"]`);
  await assertScreen(page,'Análise',`${label}/analise`);

  await openMoreRoute(page,nav,'hoje','Hoje',`${label}/hoje`);
  const todayText=await page.textContent('#screenHost');
  if(!todayText.includes('Último treino')||!todayText.includes('Última bio')||!todayText.includes('Passos')||!todayText.includes('FC de repouso')||!todayText.includes('7.200 passos')||!todayText.includes('61 bpm')) throw new Error(`${label}: Today essentials or existing metric records missing`);

  await openMoreRoute(page,nav,'timeline','Timeline',`${label}/timeline`);
  const timelineText=await page.textContent('#screenHost');
  if(!timelineText.includes('Caminhada')||!timelineText.includes('Sono')) throw new Error(`${label}: activity/sleep timeline events missing`);

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.labs=[...(state.data.labs||[]),{source_record_id:'lab-history',collection_date:'2026-01-03',report_date:'2026-01-03',laboratory:'Laboratório de teste',biomarker:'Marcador A',result_raw:'8',result_numeric:8,unit:'u',reference_range:'5–15',source:'Fixture de interface'}];
  });
  await openMoreRoute(page,nav,'saude','Saúde & exames',`${label}/saude`);
  if((await page.locator('#collectionSelect option').count())!==2) throw new Error(`${label}: lab collection history missing`);
  if((await page.locator('.markerList button').count())!==2) throw new Error(`${label}: biomarker explorer missing`);
  await page.waitForSelector('.labHistoryChart svg');
  const labHistory=(await page.locator('.exerciseDetail').textContent())||'';
  if(!labHistory.includes('Série histórica')||!labHistory.includes('Diferença +2,0 u')||!labHistory.includes('não classifica o resultado'))throw new Error(`${label}: compatible-unit lab trend chart missing or over-interpreted`);
  if((await page.locator('.documentSummary').count())!==1||(await page.locator('.evidenceDateList article').count())<1)throw new Error(`${label}: longitudinal document/evidence browsing missing`);
  const healthText=(await page.textContent('#screenHost'))||'';
  if(!healthText.includes('Resultados e documentos na mesma data')||!healthText.includes('Coincidência de data não demonstra causa'))throw new Error(`${label}: cross-evidence guardrail missing`);
  if(!healthText.includes('Comparação com a coleta anterior')||!healthText.includes('Diferenças só são calculadas'))throw new Error(`${label}: collection comparison guardrail missing`);
  await page.fill('#labQuery','Marcador A');
  await page.waitForFunction(()=>document.querySelectorAll('.markerList button').length===1);

  await openMoreRoute(page,nav,'nutricao','Nutrição',`${label}/nutricao`);
  await page.selectOption('#nutritionPeriod','all');
  await page.click('[data-nutrition-date="2026-02-02"]');
  const nutritionText=await page.textContent('#screenHost');
  if(!nutritionText.includes('Almoço')||!nutritionText.includes('Jantar')) throw new Error(`${label}: nutrition day drilldown missing meals`);

  await openMoreRoute(page,nav,'dados','Dados',`${label}/dados`);
  await page.waitForSelector('#uploadForm');
  if((await page.locator('#uploadType option').count())<6) throw new Error(`${label}: import source options missing`);
  if((await page.locator('.sourceStatus').count())!==5) throw new Error(`${label}: source status cards missing`);
  const dataText=(await page.textContent('#screenHost'))||'';
  if(!dataText.includes('Sincronização automática parcial')||!dataText.includes('Apple Saúde candidato + arquivo')||!dataText.includes('Arquivo preservado + revisão')) throw new Error(`${label}: import capability labels missing`);
  if(!dataText.includes('Automático canônico: energia ativa, minutos de exercício, horas em pé e duração do sono')||!dataText.includes('intervalos sobrepostos são unidos antes do total diário')||!dataText.includes('Passos e FC de repouso não entram automaticamente por este fluxo'))throw new Error(`${label}: validated Apple Health scope missing`);
  if(!dataText.includes('Calorias, proteína, carboidratos, gordura e fibra podem chegar pelo Apple Saúde')||!dataText.includes('permanecem separados da nutrição canônica'))throw new Error(`${label}: MyFitnessPal candidate nutrition boundary is not explicit`);
  if(!dataText.includes('Resultados só são estruturados quando a leitura for validada')||!dataText.includes('valor, unidade ou faixa ambíguos ficam para revisão'))throw new Error(`${label}: lab safety copy missing`);
  await page.click('[data-source-upload="apple_health"]');
  if(await page.inputValue('#uploadType')!=='apple_health') throw new Error(`${label}: Apple upload shortcut failed`);
  await page.click('[data-source-upload="fleury"]');
  if(await page.inputValue('#uploadType')!=='fleury') throw new Error(`${label}: Fleury upload shortcut failed`);
  await page.click('[data-source-upload="einstein"]');
  if(await page.inputValue('#uploadType')!=='einstein') throw new Error(`${label}: Einstein upload shortcut failed`);

  await openMoreRoute(page,nav,'tratamentos','Tratamentos',`${label}/tratamentos`);
  const treatmentText=await page.textContent('#screenHost');
  if(!treatmentText.includes('Histórico')||treatmentText.match(/\b(dose|dosagem|ciclo|aplica[cç][aã]o)\b/i)) throw new Error(`${label}: treatment history screen exposed operational guidance`);
  if(errors.length) throw new Error(`${label}: page errors: ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 browser smoke passed');

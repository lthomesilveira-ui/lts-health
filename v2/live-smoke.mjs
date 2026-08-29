import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const base=process.env.LTS_HEALTH_BASE_URL||'https://lthomesilveira-ui.github.io/lts-health/v2/?fixture=1';
const forbidden=/\b(canonical|parity|backend|provenance[- ]first|readiness|PWA)\b/i;

async function assertScreen(page,title,label){
  await page.waitForFunction(t=>document.querySelector('#screenHost h1')?.textContent===t,title);
  const text=(await page.textContent('#screenHost'))||'';
  if(text.trim().length<20)throw new Error(`${label}: empty screen`);
  if(forbidden.test(text))throw new Error(`${label}: implementation jargon visible`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
}

async function assertMobileShell(page,label){
  const layout=await page.evaluate(()=>{
    const host=document.querySelector('#screenHost').getBoundingClientRect();
    const nav=document.querySelector('#mobileNav').getBoundingClientRect();
    const topbar=document.querySelector('.topbar').getBoundingClientRect();
    const navPosition=getComputedStyle(document.querySelector('#mobileNav')).position;
    const metrics=[...document.querySelectorAll('#screenHost>.grid.cols4 .card.metric')].slice(0,4).map(el=>el.getBoundingClientRect());
    return {
      hostBottom:host.bottom,
      navTop:nav.top,
      navPosition,
      topbarHeight:topbar.height,
      metricRects:metrics.map(r=>({top:r.top,width:r.width}))
    };
  });
  if(layout.navPosition==='fixed')throw new Error(`${label}: deployed mobile nav still overlays content`);
  if(layout.hostBottom>layout.navTop+1)throw new Error(`${label}: deployed mobile content overlaps navigation`);
  if(layout.topbarHeight>62)throw new Error(`${label}: deployed mobile header is too tall (${Math.round(layout.topbarHeight)}px)`);
  if(layout.metricRects.length===4){
    const[a,b,c]=layout.metricRects;
    if(Math.abs(a.top-b.top)>2||c.top<=a.top+2)throw new Error(`${label}: deployed Bio KPIs are not a compact 2x2 grid`);
    if(a.width<130||b.width<130)throw new Error(`${label}: deployed Bio KPIs are too narrow`);
  }
}

async function more(page,nav,route,title,label){
  await page.click(`${nav} [data-route="mais"]`);
  await page.waitForSelector('#moreSheet:not(.hidden)');
  await page.click(`#moreSheet [data-route="${route}"]`);
  await assertScreen(page,title,label);
}

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport,acceptDownloads:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base,{waitUntil:'networkidle',timeout:45000});
  await page.waitForSelector('#app:not(.hidden)');
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
  if(Object.values(parserRouting).some(value=>value!=='health-inspect-upload'))throw new Error(`${label}: deployed stable ingestion routing is incorrect`);

  await assertScreen(page,'Bio',`${label}/bio`);
  if((await page.locator('[data-body-date]').count())<2)throw new Error(`${label}: Bio history missing`);
  if(viewport.width<720)await assertMobileShell(page,label);

  await page.click(`${nav} [data-route="treinos"]`);
  await assertScreen(page,'Treinos',`${label}/treinos`);
  await page.selectOption('#trainingPeriod','all');
  const latest=page.locator('.sessions .session').first();
  if(!(await latest.evaluate(el=>el.classList.contains('latest')))||!((await latest.textContent())||'').includes('mais recente'))throw new Error(`${label}: deployed latest workout is not prioritized`);
  await page.click('[data-workout="workout-2"]');
  if(!(await page.locator('.session.open').textContent())?.includes('Supino máquina'))throw new Error(`${label}: training drilldown missing`);
  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.exercises=[...(state.data.exercises||[]),{source_record_id:'live-ex-progression',workout_source_record_id:'workout-1',workout_date:'2026-01-28',order_index:4,exercise:'Supino máquina',machine:'Máquina de teste',muscle_group:'Peito',source:'Fixture de interface'}];
    state.data.sets=[...(state.data.sets||[]),{source_record_id:'live-set-progression',exercise_source_record_id:'live-ex-progression',workout_source_record_id:'workout-1',workout_date:'2026-01-28',set_index:1,phase:'working',weight:70,weight_unit:'kg',reps_numeric:10,reps_raw:'10',source:'Fixture de interface'}];
  });
  await page.fill('#exerciseQuery','supino');
  await page.waitForSelector('.exerciseProgressUnit svg');
  if(!((await page.locator('.exerciseProgression').textContent())||'').includes('70 → 90 kg'))throw new Error(`${label}: deployed exercise progression chart missing`);

  await page.click(`${nav} [data-route="evolucao"]`);
  await assertScreen(page,'Evolução',`${label}/evolucao`);
  let evolution=(await page.textContent('#screenHost'))||'';
  for(const text of ['Análise segmentar','Gordura segmentar','Diferença entre lados','Mudança entre medições','Comparar com'])if(!evolution.includes(text))throw new Error(`${label}: evolution missing ${text}`);
  if((await page.locator('#segmentalCompareDate option').count())!==1)throw new Error(`${label}: deployed free segmental comparison selector missing`);
  if(!evolution.includes('Diferença entre 01/01/2026 e 01/02/2026')||!evolution.includes('Braço D +0,20 kg'))throw new Error(`${label}: deployed segmental comparison values missing`);
  await page.click('[data-segmental-date="2026-01-01"]');
  await page.waitForFunction(()=>document.querySelector('[data-segmental-date="2026-01-01"]')?.classList.contains('active'));
  evolution=(await page.textContent('#screenHost'))||'';
  if(!evolution.includes('Diferença entre 01/02/2026 e 01/01/2026')||!evolution.includes('Braço D -0,20 kg'))throw new Error(`${label}: deployed reverse segmental comparison missing`);

  await page.click(`${nav} [data-route="analise"]`);
  await assertScreen(page,'Análise',`${label}/analise`);

  await more(page,nav,'hoje','Hoje',`${label}/hoje`);
  const today=(await page.textContent('#screenHost'))||'';
  for(const text of ['Passos','FC de repouso','7.200 passos','61 bpm','Contexto recente','peso +1,0 kg','tipo(s) de métrica','02/02/2026'])if(!today.includes(text))throw new Error(`${label}: Today missing deployed fact ${text}`);
  if(/Métricas\s*0 tipo\(s\) de métrica/.test(today))throw new Error(`${label}: Today rendered metric context as zero`);

  await more(page,nav,'timeline','Timeline',`${label}/timeline`);
  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.labs=[...(state.data.labs||[]),{source_record_id:'live-lab-history',collection_date:'2026-01-03',report_date:'2026-01-03',laboratory:'Laboratório de teste',biomarker:'Marcador A',result_raw:'8',result_numeric:8,unit:'u',reference_range:'5–15',source:'Fixture de interface'}];
  });
  await more(page,nav,'saude','Saúde & exames',`${label}/saude`);
  await page.waitForSelector('.labHistoryChart svg');
  if(!((await page.locator('.exerciseDetail').textContent())||'').includes('Diferença +2,0 u'))throw new Error(`${label}: deployed compatible-unit lab chart missing`);
  await more(page,nav,'nutricao','Nutrição',`${label}/nutricao`);
  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.uploads=[{id:'live-upload',created_at:'2026-02-03T12:00:00Z',original_filename:'export.zip',source_type:'apple_health',status:'uploaded'}];
    state.data.quality=[{status:'open',category:'metadata_only',entity_name:'DOC_TECHNICAL_NAME',description:'Há apenas metadados deste documento; o arquivo original ainda precisa ser disponibilizado.'}];
  });
  await more(page,nav,'dados','Dados',`${label}/dados`);
  const data=(await page.textContent('#screenHost'))||'';
  for(const text of [
    'Sincronização automática parcial',
    'Apple Saúde candidato + arquivo',
    'Arquivo preservado + revisão',
    'Automático canônico: energia ativa, minutos de exercício e horas em pé',
    'Passos, FC de repouso, HRV, frequência respiratória e peso podem chegar como candidatos',
    'Sono permanece fora da sincronização automática',
    'Calorias, proteína, carboidratos, gordura e fibra podem chegar pelo Apple Saúde',
    'Resultados só são estruturados quando a leitura for validada',
    'valor, unidade ou faixa ambíguos ficam para revisão',
    'Exportar backup',
    'Apple Saúde · recebido',
    'Arquivo original ainda não disponível'
  ])if(!data.includes(text))throw new Error(`${label}: Data import, quality copy or backup capability missing: ${text}`);
  for(const stale of ['Passos e FC de repouso não são importados automaticamente por este fluxo','A leitura automática validada inclui energia ativa, minutos de exercício, horas em pé e duração do sono','Leitura automática de nutrição','metadata_only','DOC_TECHNICAL_NAME'])if(data.includes(stale))throw new Error(`${label}: stale or technical ingestion/quality copy visible: ${stale}`);
  const downloadPromise=page.waitForEvent('download');
  await page.click('#backupExportBtn');
  const download=await downloadPromise,path=await download.path();if(!path)throw new Error(`${label}: deployed backup did not create a file`);
  const backup=JSON.parse(await readFile(path,'utf8'));
  if(backup.format!=='lts-health-structured-backup'||backup.counts?.body!==2||backup.counts?.metrics!==3)throw new Error(`${label}: deployed backup contents invalid`);
  await more(page,nav,'tratamentos','Tratamentos',`${label}/tratamentos`);
  const treatment=(await page.textContent('#screenHost'))||'';
  if(treatment.match(/\b(dose|dosagem|ciclo|aplica[cç][aã]o)\b/i))throw new Error(`${label}: treatment screen exposed operational guidance`);

  if(errors.length)throw new Error(`${label}: browser errors: ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop-live');
await run({width:390,height:844},'mobile-live');
console.log('LTS Health v2 deployed browser smoke passed');

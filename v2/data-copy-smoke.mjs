import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#dados';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Dados');
  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.uploads=[
      {id:'u1',created_at:'2026-02-04T12:00:00Z',original_filename:'a.zip',source_type:'apple_health',status:'uploaded'},
      {id:'u2',created_at:'2026-02-03T12:00:00Z',original_filename:'mfp.zip',source_type:'myfitnesspal',status:'imported'},
      {id:'u3',created_at:'2026-02-02T12:00:00Z',original_filename:'lab.pdf',source_type:'fleury',status:'review_required'},
      {id:'u4',created_at:'2026-02-01T12:00:00Z',original_filename:'bad.zip',source_type:'other',status:'rejected'}
    ];
    state.data.previews=[
      {upload_id:'u3',status:'review_required',detected_format:'pdf',warnings:['RAW_PARSER_WARNING private_field=example'],error_message:'STACK_TRACE parser failed at internal.module:42'},
      {upload_id:'u4',status:'failed',detected_format:'zip',warnings:['RAW_FAILURE_DIAGNOSTIC'],error_message:'INTERNAL_ERROR_PAYLOAD {"secret":"value"}'}
    ];
    state.data.quality=[
      {status:'open',category:'workout_parsing',entity_name:'INTERNAL_ENTITY',description:'Detalhe ainda depende de revisão da fonte.'},
      {status:'open',category:'unknown_internal_category',entity_name:'RAW_INTERNAL_ENTITY',description:'RAW_INTERNAL_DESCRIPTION backend_table=row'},
      {status:'accepted',category:'metadata_only',entity_name:'HealthDocument',description:'Arquivo ausente.',resolution_notes:'Inventário preservado; depende do arquivo original.'},
      {status:'accepted',category:'missing_event_dose',issue_code:'treatment_dose_missing',entity_name:'SECRET_TREATMENT_ENTITY',description:'SENSITIVE_OPERATIONAL_DETAIL 999 mg frequência aplicação',resolution_notes:'SENSITIVE_RESOLUTION_DETAIL'},
      {status:'resolved',category:'migration_integrity',entity_name:'WorkoutExercise',description:'Migração corrigida.',resolution_notes:'Exercícios recuperados sem inferir séries.'}
    ];
    state.data.sourceMetrics=[
      {source_record_id:'apple-sleep',metric_date:'2026-02-04',metric_type:'sleep_duration_h',value:7.2,unit:'h',source_name:'Apple Saúde',source_family:'healthkit_candidate',canonical_status:'candidate'},
      {source_record_id:'polar-sleep',metric_date:'2026-02-04',metric_type:'sleep_duration_h',value:7.1,unit:'h',source_name:'Polar Flow',source_family:'polar_flow',canonical_status:'held'},
      {source_record_id:'iphone-steps',metric_date:'2026-02-04',metric_type:'steps',value:8400,unit:'count',source_name:'iPhone',source_family:'iphone',canonical_status:'candidate'}
    ];
    for(const key of ['uploads','previews','quality','sourceMetrics'])state.domainStatus[key]='ready';
  });
  const nav=viewport.width<720?'#mobileNav':'#primaryNav';
  const rerenderData=async()=>{
    await page.click(`${nav} [data-route="bio"]`);
    await page.click(`${nav} [data-route="mais"]`);
    await page.waitForSelector('#moreSheet:not(.hidden)');
    await page.click('#moreSheet [data-route="dados"]');
    await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Dados');
  };
  await rerenderData();

  let text=(await page.textContent('#screenHost'))||'';
  for(const expected of [
    'Conferências','3 itens realmente precisam de você','O que precisa de você','O que está guardado aguardando uma regra segura',
    'Sono','Passos','Apple Saúde + Polar Flow','Fontes sobrepostas continuam separadas e não são somadas.','O que já está no seu histórico',
    'Bioimpedâncias','Treinos','Alimentação por dia','Refeições','Atividade','Exames','Documentos','Tratamentos',
    'Histórico de arquivos','Qualidade e limitações','Inventário preservado; depende do arquivo original.',
    'Contexto histórico de tratamento','Registro histórico preservado sem detalhe operacional nesta tela.',
    'O arquivo está guardado e ainda não entrou nas análises. Você não precisa revisar linha por linha.',
    'O processamento não foi concluído. O arquivo original continua guardado.',
    'Passos, frequência cardíaca em repouso, variabilidade da frequência cardíaca, frequência respiratória, peso e sono ficam separados até conferência',
    'Fontes diferentes de sono continuam separadas','O arquivo direto do MyFitnessPal é a fonte preferida','Detalhes por origem'
  ]){
    if(!text.includes(expected))throw new Error(`${label}: missing user-facing status ${expected}`);
  }
  for(const forbidden of ['review_required','rejected','uploaded','INTERNAL_ENTITY','workout_parsing','SECRET_TREATMENT_ENTITY','SENSITIVE_OPERATIONAL_DETAIL','SENSITIVE_RESOLUTION_DETAIL','999 mg','frequência aplicação','RAW_PARSER_WARNING','STACK_TRACE','RAW_FAILURE_DIAGNOSTIC','INTERNAL_ERROR_PAYLOAD','RAW_INTERNAL_ENTITY','RAW_INTERNAL_DESCRIPTION','backend_table=row','ActivitySummary','source_family','source_payload','storage_path','canônico','candidato']){
    if(text.includes(forbidden))throw new Error(`${label}: raw internal or operational value visible: ${forbidden}`);
  }

  const inboxStats=await page.locator('[data-review-inbox] .reviewStat strong').allTextContents();
  if(inboxStats.join('|')!=='3|4|1|1')throw new Error(`${label}: review inbox counts are wrong ${inboxStats.join('|')}`);
  const sourceCards=await page.locator('.sourceStatus').allTextContents();
  const sourceCard=name=>sourceCards.find(card=>card.includes(name))||'';
  if(!sourceCard('Apple Saúde').includes('processando')||sourceCard('Apple Saúde').includes('com dados'))throw new Error(`${label}: Apple upload was falsely presented as confirmed data`);
  if(!sourceCard('MyFitnessPal').includes('arquivo recebido')||sourceCard('MyFitnessPal').includes('com dados'))throw new Error(`${label}: MyFitnessPal file was falsely presented as confirmed data`);
  if(!sourceCard('Fleury').includes('aguardando leitura')||sourceCard('Fleury').includes('com dados'))throw new Error(`${label}: Fleury review upload was falsely presented as confirmed data`);
  if(!sourceCard('Einstein').includes('ainda não conectado'))throw new Error(`${label}: Einstein missing state is not clear`);

  await page.selectOption('#dataUploadStatus','attention');
  await page.waitForFunction(()=>document.querySelectorAll('.uploadAuditRow').length===2);
  text=(await page.textContent('.card:has-text("Histórico de arquivos")'))||'';
  if(!text.includes('Fleury · aguardando leitura segura')||!text.includes('Outra origem · não processado')||text.includes('MyFitnessPal · importado'))throw new Error(`${label}: attention filter failed`);
  await page.selectOption('#dataUploadSource','fleury');
  await page.waitForFunction(()=>document.querySelectorAll('.uploadAuditRow').length===1);
  text=(await page.textContent('.card:has-text("Histórico de arquivos")'))||'';
  if(!text.includes('Fleury · aguardando leitura segura')||text.includes('Outra origem · não processado'))throw new Error(`${label}: source filter failed`);

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.ui.dataUploadStatus='all';state.ui.dataUploadSource='all';
    state.data.uploads=state.data.uploads.map(u=>u.source_type==='apple_health'?{...u,status:'imported'}:u);
    state.data.metrics=[{source_record_id:'apple-steps-only',measured_at:'2026-02-04T12:00:00Z',metric_type:'steps',value:1000,unit:'count',source:'Apple Health',source_family:'apple_watch'}];
  });
  await rerenderData();
  const appleCardLocator=page.locator('.sourceStatus:has([data-source-upload="apple_health"])');
  let appleCard=(await appleCardLocator.textContent())||'';
  if(!appleCard.includes('arquivo recebido')||appleCard.includes('com dados'))throw new Error(`${label}: Apple steps incorrectly proved confirmed Apple readiness`);
  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.metrics.push({source_record_id:'apple-energy',measured_at:'2026-02-04T12:00:00Z',metric_type:'active_energy_kcal',value:100,unit:'kcal',source:'Apple Health ActivitySummary',source_family:'apple_activity_summary'});
  });
  await rerenderData();
  appleCard=(await appleCardLocator.textContent())||'';
  if(!appleCard.includes('com dados'))throw new Error(`${label}: confirmed Apple activity did not prove Apple readiness`);
  if(!appleCard.includes('Confirmado até: 04/02/2026'))throw new Error(`${label}: confirmed Apple coverage date missing from source card`);
  if(appleCard.includes('Registros adicionais guardados até: 04/02/2026'))throw new Error(`${label}: same-day preserved evidence was incorrectly presented as newer than confirmed coverage`);

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.quality=state.data.quality.map(issue=>({...issue,status:issue.status==='open'?'accepted':issue.status}));
    state.data.uploads=state.data.uploads.map(upload=>upload.status==='rejected'?{...upload,status:'imported'}:upload);
  });
  await rerenderData();
  text=(await page.textContent('[data-review-inbox]'))||'';
  if(!text.includes('Nada exige sua ação agora')||!text.includes('Nenhum clique ou decisão sua é necessário agora.'))throw new Error(`${label}: calm zero-action state missing`);

  await page.evaluate(async()=>{const {state}=await import('./src/core.js');state.domainStatus.uploads='error';});
  await rerenderData();
  text=(await page.textContent('#screenHost'))||'';
  const failedStats=await page.locator('[data-review-inbox] .reviewStat strong').allTextContents();
  if(failedStats[0]!=='—'||failedStats[2]!=='—'||failedStats[3]!=='—')throw new Error(`${label}: unloaded uploads rendered numeric inbox counts ${failedStats.join('|')}`);
  if(!text.includes('Não foi possível verificar os arquivos agora.'))throw new Error(`${label}: missing upload-domain failure state`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 data copy smoke passed');

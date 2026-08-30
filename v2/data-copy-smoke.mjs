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
  for(const expected of ['Apple Saúde · recebido','MyFitnessPal · importado','Fleury · revisão necessária','Outra origem · não processado','Detalhe do treino precisa de revisão','Acompanhamento dos arquivos','Em andamento','Concluídos','Para revisar','Com falha','Há ação necessária.','Filtre por situação ou origem.','Qualidade dos dados','Ação necessária','Limitações conhecidas','Resolvidos','Inventário preservado; depende do arquivo original.','Contexto histórico de tratamento','Registro histórico preservado sem detalhe operacional nesta tela.','Há detalhes que precisam de revisão antes de concluir a leitura.','O processamento não foi concluído. O arquivo original continua guardado.','Revisão registrada sem detalhe exibido nesta tela.','Automático canônico: energia ativa, minutos de exercício e horas em pé','Passos, FC de repouso, HRV, frequência respiratória, peso e sono podem chegar como candidatos com origem preservada','intervalos sobrepostos da mesma origem são unidos antes do total diário','Calorias, proteína, carboidratos, gordura e fibra podem chegar pelo Apple Saúde']){
    if(!text.includes(expected))throw new Error(`${label}: missing plain-language status ${expected}`);
  }
  const sourceCards=await page.locator('.sourceStatus').allTextContents();
  const sourceCard=name=>sourceCards.find(card=>card.includes(name))||'';
  if(!sourceCard('Apple Saúde').includes('processando')||sourceCard('Apple Saúde').includes('com dados'))throw new Error(`${label}: Apple upload was falsely presented as structured data`);
  if(!sourceCard('MyFitnessPal').includes('arquivo recebido')||sourceCard('MyFitnessPal').includes('com dados'))throw new Error(`${label}: MyFitnessPal file was falsely presented as structured data`);
  if(!sourceCard('Fleury').includes('precisa de atenção')||sourceCard('Fleury').includes('com dados'))throw new Error(`${label}: Fleury review upload was falsely presented as structured data`);
  if(!sourceCard('Einstein').includes('a importar'))throw new Error(`${label}: missing Einstein empty source state`);

  const overview=await page.locator('.card:has-text("Acompanhamento dos arquivos") .sourceCard span').allTextContents();
  if(overview.join('|')!=='1|1|2|0')throw new Error(`${label}: unexpected processing overview ${overview.join('|')}`);
  const qualityOverview=await page.locator('.card:has-text("Qualidade dos dados") > .sourceGrid .sourceCard span').allTextContents();
  if(qualityOverview.join('|')!=='2|2|1')throw new Error(`${label}: unexpected quality overview ${qualityOverview.join('|')}`);
  for(const forbidden of ['review_required','rejected','uploaded','INTERNAL_ENTITY','workout_parsing','SECRET_TREATMENT_ENTITY','SENSITIVE_OPERATIONAL_DETAIL','SENSITIVE_RESOLUTION_DETAIL','999 mg','frequência aplicação','RAW_PARSER_WARNING','STACK_TRACE','RAW_FAILURE_DIAGNOSTIC','INTERNAL_ERROR_PAYLOAD','RAW_INTERNAL_ENTITY','RAW_INTERNAL_DESCRIPTION','backend_table=row']){
    if(text.includes(forbidden))throw new Error(`${label}: raw internal or operational value visible: ${forbidden}`);
  }

  await page.selectOption('#dataUploadStatus','attention');
  await page.waitForFunction(()=>document.querySelectorAll('.uploadAuditRow').length===2);
  text=(await page.textContent('.card:has-text("Arquivos recebidos")'))||'';
  if(!text.includes('Fleury · revisão necessária')||!text.includes('Outra origem · não processado')||text.includes('MyFitnessPal · importado'))throw new Error(`${label}: attention filter failed`);
  await page.selectOption('#dataUploadSource','fleury');
  await page.waitForFunction(()=>document.querySelectorAll('.uploadAuditRow').length===1);
  text=(await page.textContent('.card:has-text("Arquivos recebidos")'))||'';
  if(!text.includes('Fleury · revisão necessária')||text.includes('Outra origem · não processado'))throw new Error(`${label}: source filter failed`);

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.ui.dataUploadStatus='all';state.ui.dataUploadSource='all';
    state.data.uploads=state.data.uploads.map(u=>u.source_type==='apple_health'?{...u,status:'imported'}:u);
    state.data.metrics=[{source_record_id:'apple-steps-only',measured_at:'2026-02-04T12:00:00Z',metric_type:'steps',value:1000,unit:'count',source:'Apple Health'}];
  });
  await rerenderData();
  const appleCardLocator=page.locator('.sourceStatus:has([data-source-upload="apple_health"])');
  let appleCard=(await appleCardLocator.textContent())||'';
  if(!appleCard.includes('arquivo recebido')||appleCard.includes('com dados'))throw new Error(`${label}: Apple steps incorrectly proved stable Apple readiness`);
  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.metrics.push({source_record_id:'apple-sleep',measured_at:'2026-02-04T12:00:00Z',metric_type:'sleep_duration_h',value:7.5,unit:'h',source:'Apple Health'});
  });
  await rerenderData();
  appleCard=(await appleCardLocator.textContent())||'';
  if(!appleCard.includes('arquivo recebido')||appleCard.includes('com dados'))throw new Error(`${label}: Apple sleep incorrectly proved canonical Apple readiness`);
  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.metrics.push({source_record_id:'apple-energy',measured_at:'2026-02-04T12:00:00Z',metric_type:'active_energy_kcal',value:100,unit:'kcal',source:'Apple Health'});
  });
  await rerenderData();
  appleCard=(await appleCardLocator.textContent())||'';
  if(!appleCard.includes('com dados'))throw new Error(`${label}: canonical Apple energy did not prove Apple readiness`);

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.sourceMetrics=[...(state.data.sourceMetrics||[]),{source_record_id:'mfp-dietary',metric_date:'2026-02-04',metric_type:'dietary_protein_g',value:150,unit:'g',source_name:'MyFitnessPal',source_family:'myfitnesspal',canonical_status:'candidate'},{source_record_id:'ring-sleep',metric_date:'2026-02-04',metric_type:'sleep_duration_h',value:7.2,unit:'h',source_name:'RingConn',source_family:'ringconn',canonical_status:'candidate'}];
  });
  await rerenderData();
  const mfpCardLocator=page.locator('.sourceStatus:has([data-source-upload="myfitnesspal"])');
  let mfpCard=(await mfpCardLocator.textContent())||'';
  if(!mfpCard.includes('arquivo recebido')||mfpCard.includes('com dados'))throw new Error(`${label}: MyFitnessPal candidate incorrectly proved canonical readiness`);
  const provenance=(await page.locator('.provenancePanel').textContent())||'';
  if(!provenance.includes('MyFitnessPal')||!provenance.includes('RingConn')||!provenance.includes('candidato'))throw new Error(`${label}: source-preserving provenance candidate missing`);
  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.nutrition=[...(state.data.nutrition||[]),{source_record_id:'mfp-canonical-day',nutrition_date:'2026-02-04',calories_kcal:2100,protein_g:150,source:'MyFitnessPal'}];
  });
  await rerenderData();
  mfpCard=(await mfpCardLocator.textContent())||'';
  if(!mfpCard.includes('com dados'))throw new Error(`${label}: canonical MyFitnessPal nutrition did not prove readiness`);

  await page.evaluate(async()=>{const {state}=await import('./src/core.js');state.domainStatus.uploads='error';});
  await rerenderData();
  text=(await page.textContent('#screenHost'))||'';
  const failedOverview=await page.locator('.card:has-text("Acompanhamento dos arquivos") .sourceCard span').allTextContents();
  if(failedOverview.join('|')!=='—|—|—|—')throw new Error(`${label}: unloaded uploads rendered numeric counts ${failedOverview.join('|')}`);
  if(!text.includes('Não foi possível verificar os arquivos agora.'))throw new Error(`${label}: missing upload-domain failure state`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 data copy smoke passed');

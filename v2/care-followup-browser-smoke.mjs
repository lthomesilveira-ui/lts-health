import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
import {syntheticNutritionPlanRow} from '../preview/compact-evidence/tests/documented-nutrition-plan-fixture.mjs';
mkdirSync('v2/public-audit-evidence',{recursive:true});

const browser=await chromium.launch({headless:true});
try{
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
    const page=await browser.newPage({viewport});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/?fixture=1#tratamentos');
    await page.waitForSelector('#app:not(.hidden)');
    await page.waitForSelector('.protocolSummaryGrid');
    if(await page.locator('.careFollowup').count())throw new Error('A consultation was invented from ordinary documents');
    await page.evaluate(async()=>{
      const {state}=await import('./src/core.js');
      const context={schema_version:1,consultation_date:'2026-01-15',physician:'Profissional de teste',title:'Acompanhamento da consulta',baseline:[{name:'Registro A',reported_dose:'Valor relatado',source_date:'2026-01-10'}],products:[{key:'new-item',name:'Novo item de teste',status:'Início não registrado',purchase_status:'Compra não registrada'}],followups:[{key:'exam',label:'Exame solicitado',status:'Agendamento não registrado',due_date:null},{key:'window',label:'Revisão de acompanhamento',status:'Aguardando início registrado',window:'4–6 semanas após início registrado'},{key:'resolved',label:'Informação recuperada',status:'Resolvido pelo histórico',resolved:true}],contacts:[{name:'Contato de teste',products:['Item de teste'],message:'Mensagem para orçamento <script>window.careUnsafe=true</script>'}],physician_message:'Mensagem para o profissional',pending_nutrition:'Plano alimentar aguardado.',record_rule:'Ausência de resposta não é dose omitida.'};
      state.data.docs=[...(state.data.docs||[]),{source_record_id:'fixture-consultation',document_date:'2026-01-15',document_type:'care_followup',title:'Consulta de teste',care_context:context}];
      state.domainStatus.docs='ready';
      const {renderTreatmentHub}=await import('./src/treatment-screen.js');
      document.querySelector('#screenHost').innerHTML=renderTreatmentHub();
    });
    const care=page.locator('.careFollowup');
    await care.waitFor();
    for(const text of ['Valor relatado','Início não registrado','Agendamento não registrado','4–6 semanas após início registrado','Plano alimentar aguardado.'])if(!(await care.innerText()).includes(text))throw new Error(`Missing consultation state: ${text}`);
    if((await care.innerText()).includes('Aplicar hoje'))throw new Error('A documented plan became an administration instruction');
    await care.locator('.careMessages summary').click();
    await page.getByText('Mensagem para o profissional',{exact:true}).waitFor();
    if(await care.locator('script').count())throw new Error('Message markup was not escaped');
    await care.locator('.careResolved summary').click();
    await page.getByText('Informação recuperada',{exact:true}).waitFor();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    if(overflow>1)throw new Error(`Consultation overflows at ${viewport.width}px: ${overflow}`);
    await page.evaluate(async plan=>{
      const {state}=await import('./src/core.js');state.data.nutritionPlans=[plan];state.domainStatus.nutritionPlans='ready';
      const {renderTreatmentHub}=await import('./src/treatment-screen.js');document.querySelector('#screenHost').innerHTML=renderTreatmentHub();
    },syntheticNutritionPlanRow('2026-01-20'));
    await care.locator('[data-care-plan-received]').waitFor();
    for(const text of ['Plano alimentar recebido em 20/01/2026','Synthetic nutrition plan.pdf','Início de uso não informado','Registro histórico do documento de 15/01/2026','Plano alimentar aguardado.','pendências registradas na consulta'])if(!(await care.innerText()).includes(text))throw new Error(`Missing dated nutrition-plan evidence: ${text}`);
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Plan receipt annotation overflows');
    await care.locator('.careNotes').scrollIntoViewIfNeeded();await page.screenshot({path:`v2/public-audit-evidence/care-plan-receipt-${viewport.width}.png`});
    await page.evaluate(async()=>{
      const {state}=await import('./src/core.js');state.domainStatus.nutritionPlans='error';
      const {renderTreatmentHub}=await import('./src/treatment-screen.js');document.querySelector('#screenHost').innerHTML=renderTreatmentHub();
    });
    if(await care.locator('[data-care-plan-received]').count())throw new Error('Failed plan reader retained stale receipt');
    if(!(await care.locator('[data-care-nutrition-history]').innerText()).includes('Plano alimentar aguardado.'))throw new Error('Historical consultation quote was lost');
    await care.locator('[data-care-plan-status="error"]').waitFor();
    await page.evaluate(async()=>{
      const {state}=await import('./src/core.js');state.domainStatus.docs='error';
      const {renderTreatmentHub}=await import('./src/treatment-screen.js');document.querySelector('#screenHost').innerHTML=renderTreatmentHub();
    });
    await page.getByText('O acompanhamento não carregou.',{exact:false}).waitFor();
    if(await page.locator('.careBaseline').count())throw new Error('Failed consultation data remained visible');
    if(!(await page.locator('.protocolSummaryGrid').count()))throw new Error('Consultation failure hid the application history');
    if(errors.length)throw new Error(errors.join('; '));
    await page.close();
  }
  console.log('Consultation follow-up passed: desktop, mobile, escaping, unconfirmed states and partial failure');
}finally{await browser.close();}

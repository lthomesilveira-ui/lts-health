import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {chromium} from 'playwright';

// Synthetic data only. Tests the real authenticated renderer, not a demo page.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/v2/';
const dir='v2/integrated-review-visual';mkdirSync(dir,{recursive:true});
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const date=offset=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-offset);return d.toISOString().slice(0,10);};
const db={health_workouts:[],health_daily_nutrition:[],health_source_daily_metrics:[]};
db.health_body_composition=Array.from({length:5},(_,i)=>({measured_at:date(i*3+1),source_record_id:`body-${i}`,source:'Synthetic scan',device_name:'Synthetic device',weight_kg:80+i*.2,body_fat_pct:20+i*.1,fat_mass_kg:16+i*.1,skeletal_muscle_mass_kg:32}));
db.health_lab_results=[{source_record_id:'lab-1',collection_date:date(2),biomarker:'Synthetic marker',unit:'u',result_numeric:12,result_raw:'12',source:'Synthetic lab',laboratory:'Synthetic lab',method:'Synthetic method'}];
for(let i=0;i<=16;i++){
  db.health_daily_nutrition.push({source_record_id:`n${i}`,nutrition_date:date(i),source:'Synthetic food',calories_kcal:i?2000:9000,protein_g:100});
  db.health_source_daily_metrics.push({source_record_id:`health_auto_export:w${i}`,metric_date:date(i),metric_type:'dietary_water_ml',unit:'mL',value:i===0?1250:i%2?1000:1200,source_name:'Synthetic water',source_family:'health_auto_export',canonical_status:'canonical',confidence:'authenticated_auto_export'},
    {source_record_id:`s${i}`,metric_date:date(i),metric_type:'sleep_duration_h',unit:'h',value:i%2?8:7,source_name:'Synthetic sleep',source_family:'synthetic',canonical_status:'candidate'});
  if(i>0)db.health_source_daily_metrics.push({source_record_id:`other${i}`,metric_date:date(i),metric_type:'sleep_duration_h',unit:'h',value:20,source_name:'Other sleep',source_family:'synthetic',canonical_status:'candidate'});
  if(i>0&&i%2===0)db.health_workouts.push({source_record_id:`w${i}`,workout_date:date(i),workout_type:'Synthetic session',source:'Synthetic log',is_canonical:true,record_status:'validated',duration_minutes:40});
}
const service=`window.__reviewDb=${JSON.stringify(db)};window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-review-user'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},functions:{invoke:async()=>({data:null,error:null})},from(table){let from=0,to=999;const q={select(){return q;},range(a,b){from=a;to=b;return q;},order(){return q;},then(resolve,reject){return Promise.resolve({data:(window.__reviewDb[table]||[]).slice(from,to+1),error:null}).then(resolve,reject);}};return q;}})};`;
const browser=await chromium.launch({headless:true,...(process.env.LTS_BROWSER_PATH?{executablePath:process.env.LTS_BROWSER_PATH}:{}),args:['--no-sandbox']});
const errors=[];
const noOverflow=async page=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no document overflow');
const capture=async(page,selector,path)=>{await page.evaluate(s=>document.querySelector(s)?.scrollIntoView({block:'start',behavior:'auto'}),selector);await page.screenshot({path});};
try{
  for(const[label,width,height]of [['desktop',1536,864],['mobile',390,844],['physical-viewport',393,650],['small',320,740]]){
    const page=await browser.newPage({viewport:{width,height},acceptDownloads:true});page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'application/javascript',body:service}));
    await page.goto(base+'#hoje');await page.waitForSelector('.ltsHomeReference');
    await page.screenshot({path:`${dir}/${label}-home.png`});
    assert.equal(await page.locator('[data-home-period]').count(),4,'one shared period control, not duplicate viewport controls');
    if(width>840){
      assert.equal(await page.locator('.ltsExecutiveCard').count(),5);
      assert.equal(await page.locator('.ltsCockpitGrid .ltsCockpitPanel').count(),6);
      assert.match(await page.locator('.ltsCockpitReading:visible h2').innerText(),/Peso .*medições compatíveis/);
      assert.notEqual(await page.locator('.ltsCockpitReading:visible h2').innerText(),await page.locator('.ltsCockpitFooter article').first().locator('p').innerText(),'no duplicated main reading');
      assert.match(await page.locator('.ltsCockpitFooter article').last().innerText(),/Dados carregados.*não confirma sincronização/s);
      assert.equal(await page.locator('.ltsMobileHome').first().isVisible(),false);
      const geometry=await page.locator('.ltsDesktopCockpit').evaluate(el=>{const top=s=>el.querySelector(s).getBoundingClientRect().top;return {cards:top('.ltsExecutiveCards'),reading:top('.ltsCockpitReading'),charts:top('.ltsCockpitGrid'),footer:top('.ltsCockpitFooter')};});
      assert.ok(geometry.cards<geometry.reading&&geometry.reading<geometry.charts&&geometry.charts<geometry.footer,'approved executive hierarchy');
      assert.ok(geometry.footer<800,`executive footer fits desktop viewport: ${geometry.footer}`);
      const footerBottom=await page.locator('.ltsCockpitFooter').evaluate(el=>el.getBoundingClientRect().bottom);
      assert.ok(footerBottom<=864,`the complete executive footer fits the desktop reference, not only its first line: ${footerBottom}`);
      for(const selector of ['#refreshBtn','#logoutBtn']){
        assert.ok(await page.locator(`${selector} .topActionIcon`).isVisible(),'icon-only header actions must retain their visible SVG');
        const box=await page.locator(selector).boundingBox();assert.ok(box.width>=44&&box.height>=44,'header actions retain a usable target');
      }
      const periodBox=await page.locator('.ltsCockpitWindow').boundingBox(),refreshBox=await page.locator('#refreshBtn').boundingBox();assert.ok(periodBox.x+periodBox.width<=refreshBox.x,'period and utility controls do not overlap');
      const axes=await page.locator('.ltsCockpitGrid .ltsContextAxis').allTextContents();assert.equal(new Set(axes).size,1,'all populated cockpit modules share one calendar');
    }else{
      assert.equal(await page.locator('.ltsDesktopCockpit').isVisible(),false);
      assert.ok(await page.locator('.ltsRefMetrics').isVisible());
      assert.ok(await page.locator('.ltsRefToday').isVisible());
      const order=await page.evaluate(()=>['.ltsRefMetrics','.ltsRefToday','.ltsRefProgress','.ltsCockpitReading.mobile','.ltsRefTrend'].map(s=>document.querySelector(s).getBoundingClientRect().top));assert.deepEqual(order,[...order].sort((a,b)=>a-b),'mobile Today/progress take priority over deep analysis');
    }
    assert.equal(await page.locator('[data-disclosure="home-history"]').getAttribute('open'),null,'deep evidence does not compete with the Home reading');
    assert.match(await page.locator('.ltsRefToday').innerText(),/1\.250 mL registrados hoje/);
    assert.equal(await page.locator('.ltsRefProgressItem.water b').innerText(),'7/7');
    assert.equal(await page.locator('.ltsDayWater').count(),1);await noOverflow(page);
    await page.screenshot({path:`${dir}/${label}-home.png`});
    await page.locator('.ltsCockpitReading:visible [data-home-insight-details]').click();await page.waitForSelector('#reportIntegratedReview');
    assert.equal(await page.locator('.ltsReportWorkspace[open]').count(),0,'history workspaces are progressive by default');
    assert.equal(await page.locator('#analysisPeriod').inputValue(),'30');
    assert.match(await page.locator('.ltsReviewContrast').first().innerText(),/1\.200 mL.*1\.000 mL/s);
    assert.match(await page.locator('.ltsReviewCoverage').innerText(),/16 dias/);await noOverflow(page);
    assert.match(await page.locator('.ltsReviewContrast').last().innerText(),/7,0 h.*8,0 h/s);
    await capture(page,'#reportIntegratedReview',`${dir}/${label}-overview.png`);
    await page.locator('[data-review-view="day"]').click();await page.waitForSelector('#reviewDate');
    assert.match(await page.locator('.ltsReviewDay').innerText(),/Dia em andamento/);
    await page.locator('#reviewDate').selectOption(date(2));await page.waitForFunction(()=>document.querySelector('.ltsReviewDayFacts')?.textContent.includes('1.200 mL'));
    assert.match(await page.locator('.ltsReviewDayFacts').innerText(),/Synthetic session.*2\.000 kcal.*1\.200 mL/s);
    await page.locator('.ltsReviewCalendar summary').click();assert.equal(await page.locator('.ltsReviewCalendar tbody tr').count(),7);
    const beforePage=await page.locator('.ltsReviewCalendar tbody').elementHandle();
    await page.locator('[data-report-page="reviewDayPage"]').last().click();await page.waitForFunction(element=>!element.isConnected,beforePage);
    await page.locator('.ltsReviewSources summary').click();
    const other=JSON.stringify(['sleep_duration_h','synthetic','Other sleep','h']);
    const beforeSource=await page.locator('#reviewPanel').elementHandle();
    await page.locator('#reviewSleepSource').selectOption(other);await page.waitForFunction(element=>!element.isConnected,beforeSource);
    await page.waitForFunction(()=>document.querySelector('.ltsDaySleep')?.textContent.includes('20,0 h'));
    await noOverflow(page);await capture(page,'.ltsReviewDayControls',`${dir}/${label}-day.png`);
    await page.locator('[data-review-view="consultation"]').click();await page.waitForSelector('[data-review-export]');
    const downloadPromise=page.waitForEvent('download');await page.locator('[data-review-export]').click();const download=await downloadPromise;
    assert.match(download.suggestedFilename(),/^LTS_Health_Resumo_\d{4}-\d{2}-\d{2}\.txt$/);
    const text=readFileSync(await download.path(),'utf8');assert.match(text,/20,0 h/);assert.match(text,/1\.100 mL/);assert.match(text,/Não é laudo/);
    await noOverflow(page);await capture(page,'.ltsReviewExport',`${dir}/${label}-consultation.png`);
    await page.locator('[data-report-section="reportHydration"]').click();assert.equal(new URL(page.url()).hash,'#analise','section jump does not corrupt app routing');
    assert.equal(await page.locator('[data-disclosure="report-workspace-water"]').getAttribute('open'),'','direct evidence link opens its workspace');
    await page.locator('#analysisPeriod').selectOption('90');await page.waitForFunction(()=>document.querySelector('#analysisPeriod')?.value==='90');
    assert.equal(await page.locator('[data-review-view="consultation"]').getAttribute('aria-pressed'),'true','period change preserves the current task');
    await page.evaluate(async()=>{const {state}=await import('./src/core.js');state.domainStatus.sourceMetrics='error';state.ui.reviewView='overview';const {renderUsefulReports}=await import('./src/reports-screen.js');document.querySelector('#screenHost').innerHTML=renderUsefulReports();});
    assert.match(await page.locator('#reportIntegratedReview').innerText(),/Comparação bloqueada/);assert.doesNotMatch(await page.locator('.ltsReviewContrasts').innerText(),/1\.200 mL/);await noOverflow(page);
    await page.locator(`${width>840?'.primaryNav':'.mobileNav'} [data-route="hoje"]`).click();await page.waitForSelector('.ltsHomeReference');
    await page.evaluate(async()=>{const {state}=await import('./src/core.js');for(const key of ['body','nutrition','sourceMetrics','workouts','labs'])state.domainStatus[key]='error';const {renderProductHomeReference}=await import('./src/home-reference.js');document.querySelector('#screenHost').innerHTML=renderProductHomeReference();});
    assert.match(await page.locator('.ltsCockpitReading:visible').innerText(),/não carregou/);
    if(width>840){
      assert.match(await page.locator('.ltsDesktopCockpit').innerText(),/Dados não carregaram/);
      assert.doesNotMatch(await page.locator('.ltsDesktopCockpit').innerText(),/Sem coleta|0 registros de sono|Nenhum registro nesta janela/);
      assert.match(await page.locator('.ltsCockpitSources').innerText(),/Exames —/);
    }
    await noOverflow(page);await capture(page,'.ltsHomeReference',`${dir}/${label}-unavailable.png`);
    await page.close();
  }
  assert.deepEqual(errors,[]);
  console.log('Integrated review UI: 1536/390/393x650/320, bridge water in Home, independent means, date and source controls, paginated map, private text export, routing/period preservation and failed readers passed.');
}finally{await browser.close();}

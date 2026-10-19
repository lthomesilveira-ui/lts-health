import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {consumerRouteSettled,consumerDomainSettled} from './consumer-language-readiness.mjs';
import {visibleTextGeometry,contrastRatio} from './consumer-language-geometry.mjs';
import {LANGUAGE_ERROR} from './consumer-language-fixture.mjs';
import {
  makeLabReadingConsistencyFixture,labReadingConsistencyService,LAB_READING_TODAY,
  LAB_READING_LITERAL,LAB_READING_CONDITIONAL_REFERENCE,labMarkerKey,labOriginalText
} from './lab-reading-consistency-fixture.mjs';

// Run in the already authorized CI browser environment only. Do not launch a
// browser/server locally to work around an execution denial. The existing CI
// server supplies this isolated preview; startup and every control are real.
// Only SDK data and the session identity are mocked. There are no real records,
// credentials, external requests, uploads, storage writes or backend mutations.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/preview/compact-evidence/';
const origin=new URL(base);
assert.ok(['127.0.0.1','localhost','[::1]'].includes(origin.hostname),'Use loopback synthetic QA only');
assert.equal(origin.protocol,'http:');assert.ok(origin.pathname.endsWith('/preview/compact-evidence/'));
assert.equal(origin.search,'','Never use ?fixture');assert.equal(origin.hash,'');
const dir=process.env.LTS_LAB_READING_EVIDENCE_DIR||'lab-reading-consistency-visual';
mkdirSync(dir,{recursive:true});
const results=[],captures=[],failures=[],refreshProof=[],literalTextEvidence=[],contrastEvidence=[];
const roots={saude:'.ltsLabsV2',hoje:'[data-health-dashboard]',nutricao:'.ltsNutritionProduct'};
const sizes=[[320,740],[393,844],[1180,757],[1440,900]];
const flags={syntheticOnly:true,authenticatedReal:false,authenticatedWithRealAccount:false};
function save(){writeFileSync(`${dir}/results.json`,JSON.stringify({...flags,fixedDate:LAB_READING_TODAY,productionStartup:true,deviceScaleFactor:1,originalResolutionScreenshots:true,viewportWidths:sizes.map(([width])=>width),results,captures,refreshProof,literalTextEvidence,contrastEvidence,failures},null,2));}
async function installAppProbe(page){
  await page.evaluate(async()=>{
    if(window.__languageApp)return;
    const {state,fixtureMode}=await import('./src/core.js'),{isRouteReady}=await import('./src/data-layer.js');
    const imports=JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports;
    const coreUrl=new URL(imports['./src/core.js'],document.baseURI).href;
    if(state!==(await import(coreUrl)).state)throw new Error('Application and test imported different core state');
    window.__languageApp={state,fixtureMode,isRouteReady};
  });
}
async function stable(page,route='saude',{afterRefresh=false}={}){
  await installAppProbe(page);
  await page.evaluate(()=>{window.__languageStableRoot=null;window.__languageFrames=0;});
  // Imports happen above, never inside this synchronous polling predicate.
  assert.equal(await (await page.waitForFunction(consumerRouteSettled,{route,selector:roots[route],afterRefresh})).jsonValue(),true);
}
async function navigate(page,route,width){
  const nav=width<=840?'#mobileNav':'#primaryNav',direct=page.locator(`${nav} [data-route="${route}"]`);
  if(await direct.count())await direct.click();
  else{await page.locator(`${nav} [data-route="mais"]`).click();await page.locator(`#moreSheet [data-route="${route}"]`).click();}
  await stable(page,route);
}
async function choosePeriod(page,period){
  const button=page.locator(`[data-depth-period="productLabPeriod"][data-value="${period}"]`);
  await button.click();await stable(page);
  assert.equal(await button.getAttribute('aria-pressed'),'true');
}
async function chooseMarker(page,marker){
  const key=labMarkerKey(marker);await page.locator('#productLabMarkerSelect').selectOption(key);await stable(page);
  assert.equal(await page.locator('#productLabMarkerSelect').inputValue(),key);
  assert.equal(await page.locator('.ltsLabsHeroTop > div > span').textContent(),marker);
}
async function layout(page,name){
  const report=await page.evaluate(()=>{
    const host=document.querySelector('#screenHost'),root=document.querySelector('.ltsLabsV2'),rawText=[],controls=[];
    const walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT);let node,nodeId=0;
    while(node=walker.nextNode()){
      nodeId++;const el=node.parentElement;
      if(!node.textContent.trim()||!el||el.closest('svg,select,option,script,style')||!el.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}))continue;
      const clips=[];
      for(let parent=el;parent;parent=parent.parentElement){
        const css=getComputedStyle(parent),x=/^(hidden|clip|scroll|auto)$/.test(css.overflowX),y=/^(hidden|clip|scroll|auto)$/.test(css.overflowY);
        if((!x&&!y)||css.display==='inline'||css.display==='contents')continue;
        const box=parent.getBoundingClientRect(),left=box.left+parent.clientLeft,top=box.top+parent.clientTop;
        clips.push({x,y,left,right:left+parent.clientWidth,top,bottom:top+parent.clientHeight});
      }
      const range=document.createRange();range.selectNodeContents(node);
      for(const rect of range.getClientRects())if(rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<innerHeight)rawText.push({nodeId,text:node.textContent.trim().slice(0,140),rect:{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom},clips});
    }
    for(const el of root?.querySelectorAll('button,select,input,summary')||[]){
      if(el.disabled||!el.checkVisibility({checkVisibilityCSS:true}))continue;
      const b=el.getBoundingClientRect();controls.push({tag:el.tagName,id:el.id,text:el.textContent.trim().slice(0,70),width:b.width,height:b.height});
    }
    return {viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,hostWidth:host.clientWidth,hostScrollWidth:host.scrollWidth,rootWidth:root?.clientWidth,rootScrollWidth:root?.scrollWidth,rawText,controls};
  });
  Object.assign(report,visibleTextGeometry(report.rawText,report.viewport.width));
  writeFileSync(`${dir}/${name}-layout.json`,JSON.stringify({...flags,...report},null,2));
  const issues=[];
  if(report.documentWidth>report.viewport.width+1||report.bodyWidth>report.viewport.width+1||report.hostScrollWidth>report.hostWidth+1||report.rootScrollWidth>report.rootWidth+1)issues.push('horizontal overflow');
  if(report.overflowingText.length)issues.push('painted text outside viewport');
  if(report.overlaps.length)issues.push('overlapping painted text');
  if(issues.length)failures.push({name,category:'layout',issues,evidence:`${name}-layout.json`});
  return report;
}
async function capture(page,name,selector=null,{login=false}={}){
  assert.ok(!captures.some(capture=>capture.name===name),'Do not overwrite original evidence');
  if(selector){const target=page.locator(selector).first();assert.equal(await target.isVisible(),true);await target.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));}
  else await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('#screenHost')?.scrollTo({top:0,left:0,behavior:'instant'});});
  await page.screenshot({path:`${dir}/${name}.png`,animations:'disabled',scale:'css'});
  const report=login?{viewport:page.viewportSize()}:await layout(page,name);
  captures.push({name,selector,viewport:report.viewport,originalResolution:true,...flags});save();
}
async function literal(page,selector,expected,name,{mustWrap=false}={}){
  const target=page.locator(selector);assert.equal(await target.count(),1);
  assert.equal(await target.textContent(),expected,'Original laboratory text is preserved exactly, rather than reformatted from a number');
  assert.equal(await target.locator('*').count(),0,'HTML-looking original text stays escaped plain copy');
  const evidence=await target.evaluate(el=>{
    const box=el.getBoundingClientRect(),range=document.createRange(),characters=[];
    const rectangle=r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height});
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node,nodeIndex=0;
    while(node=walker.nextNode()){
      let offset=0;
      for(const character of node.textContent){
        range.setStart(node,offset);range.setEnd(node,offset+character.length);
        characters.push({nodeIndex,offset,character,whitespace:/^\s$/u.test(character),rects:[...range.getClientRects()].map(rectangle)});offset+=character.length;
      }
      nodeIndex++;
    }
    const ink=characters.filter(c=>!c.whitespace),positive=r=>r.width>0&&r.height>0;
    const overflowingCharacters=ink.filter(c=>c.rects.some(r=>positive(r)&&(r.left<box.left-1||r.right>box.right+1)));
    return {viewport:{width:innerWidth,height:innerHeight},box:rectangle(box),characters,overflowingCharacters,lineCount:new Set(ink.flatMap(c=>c.rects.filter(positive).map(r=>r.top))).size};
  });
  const file=`${name}-literal.json`;writeFileSync(`${dir}/${file}`,JSON.stringify({...flags,selector,expected,...evidence},null,2));
  literalTextEvidence.push({name,file,selector,lineCount:evidence.lineCount,overflowingCharacters:evidence.overflowingCharacters.length});save();
  assert.equal(evidence.overflowingCharacters.length,0,'Every painted original character fits, including around wrapped lines');
  if(mustWrap)assert.ok(evidence.lineCount>=3,'Original text wraps into several real lines on the narrow screen');
}
async function contrast(page,name,selectors=['.ltsHistoryContext','.ltsHistoryContext > b','.ltsLabsHistoryRow:first-child b','.ltsLabsHistoryRow:first-child small']){
  const rows=await page.evaluate(selectors=>selectors.flatMap(selector=>{
    const el=document.querySelector(selector);if(!el||!el.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}))return [];
    const layers=[];for(let p=el;p;p=p.parentElement){const css=getComputedStyle(p);layers.push({background:css.backgroundColor,image:css.backgroundImage,opacity:css.opacity});if(/^rgba?\([^)]*\)$/.test(css.backgroundColor)&&!css.backgroundColor.startsWith('rgba'))break;}
    return [{selector,text:el.innerText,color:getComputedStyle(el).color,layers}];
  }),selectors);
  assert.equal(rows.length,selectors.length,'All requested original/context text has measurable visible styles');
  const rgb=value=>{const match=value.match(/^rgba?\(([^)]+)\)$/);assert.ok(match,`Expected sRGB style: ${value}`);const parts=match[1].split(',').map(Number);return [...parts.slice(0,3),parts[3]??1];};
  const blend=(fg,bg)=>fg.slice(0,3).map((value,i)=>value*fg[3]+bg[i]*(1-fg[3]));
  for(const row of rows){
    assert.ok(row.layers.every(layer=>layer.image==='none'&&Number(layer.opacity)===1),'Do not invent contrast over gradients or opacity');
    let background=[255,255,255];for(const layer of [...row.layers].reverse())background=blend(rgb(layer.background),background);
    row.background=background;row.ratio=contrastRatio(blend(rgb(row.color),background),background);
  }
  const file=`${name}-contrast.json`;writeFileSync(`${dir}/${file}`,JSON.stringify({...flags,rows},null,2));contrastEvidence.push({name,file,minimumRatio:Math.min(...rows.map(row=>row.ratio))});save();
  for(const row of rows)assert.ok(row.ratio>=4.5,`${name}/${row.selector}: normal-size text needs 4.5:1, got ${row.ratio}`);
}
async function shell(page){
  for(const selector of ['.ltsLabsHero','.ltsLabCollection','.ltsLabsMarkers','.ltsLabsTrend','.ltsLabsHistory','.ltsLabsTrust'])assert.equal(await page.locator(selector).count(),1,`Approved .71 section preserved: ${selector}`);
  assert.equal(await page.locator('[data-depth-period="productLabPeriod"]').count(),4);
  assert.doesNotMatch(await page.locator('#screenHost').innerText(),/\b(?:NaN|undefined|Infinity)\b/);
}
async function assertScene(page,scene,label,width){
  await chooseMarker(page,scene.marker);await shell(page);
  const history=await page.locator('.ltsLabsHistoryList').innerText();
  for(const row of scene.rows.slice(0,10))if(!scene.history)assert.ok(history.includes(labOriginalText(row)),`${scene.key}: retain every original in history`);
  assert.equal(await page.locator('.ltsLabsHistoryList').getAttribute('data-lab-history-total'),String(scene.rows.length));
  const hero=page.locator('.ltsLabsHeroTop strong');
  if(scene.ambiguous)assert.match(await hero.textContent(),/2 resultados|mais de um/i);
  else await literal(page,'.ltsLabsHeroTop strong',labOriginalText(scene.latest),`${label}-hero`,{mustWrap:scene.literal&&width<=393});
  const context=await page.locator('.ltsHistoryContext').innerText();
  assert.doesNotMatch(context,/non_exact_value|different_or_missing_reference|source_record_id|numeric_kind|source_verified/,'Primary limitation copy is human-readable');
  assert.equal(await page.locator('.ltsLabsChart path.ltsDepthLine').count(),scene.comparable?1:0,'A connecting line requires a comparable series, not merely two numeric projections');
  assert.equal(await page.locator('.ltsLabsChart svg circle').count(),scene.expectedPoints,'Only exact, non-conflicting results are eligible chart points');
  if(scene.comparable){assert.match(context,/\d{2}\/\d{2}\/\d{4}\s*→/);if(scene.delta)assert.ok(context.includes(scene.delta));}
  else{
    assert.doesNotMatch(context,/\d{2}\/\d{2}\/\d{4}\s*→/,'Never silently compare an older exact pair instead of the newest result');
    assert.match(context,/n[aã]o|sem|diferent|limite|textual|conflit|m[uú]ltipl|mais de um|compar[aá]v|uma coleta/i,'A visible explanation accompanies the absent automatic comparison');
    if(scene.reason==='method')assert.match(context,/m[eé]todo/i);
    if(scene.reason==='reference')assert.match(context,/refer[eê]ncia/i);
    if(scene.reason==='laboratory')assert.match(context,/laborat[oó]rio|origem/i);
    if(scene.reason==='unit')assert.match(context,/unidade/i);
    if(scene.reason==='interrupted')assert.match(context,/intermedi[aá]ria|outro contexto|n[aã]o pular/i);
    if(scene.reason==='non-exact')assert.match(context,/textual|limite|exat|formato|n[aã]o confirmad/i);
  }
  if(scene.classified!==undefined){
    await page.locator('#productLabCollection').selectOption(scene.latest.collection_date);await stable(page);
    const card=page.locator(`.ltsLabValueCard[data-lab-marker="${labMarkerKey(scene.marker)}"]`);
    assert.equal(await card.count(),1,'The collection includes this known panel marker');
    assert.equal(await card.locator('.ltsLabReferencePosition').count(),scene.classified?1:0,'Only exact values with one unambiguous report interval receive a reference position');
    assert.equal(await card.locator('strong').textContent(),labOriginalText(scene.latest));
    if(scene.key==='conditional-reference')assert.equal(await card.locator('small').textContent(),`Referência do laudo: ${LAB_READING_CONDITIONAL_REFERENCE}`);
  }
  if(scene.cohorts){
    const choices=await page.locator('#productLabCohort option').evaluateAll(options=>options.map(option=>option.value));assert.equal(choices.length,scene.cohorts);
    for(const choice of choices){await page.locator('#productLabCohort').selectOption(choice);await stable(page);assert.equal(await page.locator('.ltsLabsChart path.ltsDepthLine').count(),0);assert.doesNotMatch(await page.locator('.ltsHistoryContext').innerText(),/\d{2}\/\d{2}\/\d{4}\s*→/);}
    await chooseMarker(page,scene.marker);
  }
  await capture(page,`${label}-trend`,'.ltsHistoryContext');
  if(scene.literal||scene.classified===false||scene.proof){await capture(page,`${label}-original-hero`,'.ltsLabsHero');await capture(page,`${label}-original-history`,'.ltsLabsHistoryList');}
  if(scene.literal){await literal(page,'.ltsLabsHistoryRow b',LAB_READING_LITERAL,`${label}-history`,{mustWrap:width<=393});await contrast(page,label);}
  if(['comparable','latest-inexact','method-placeholder','reference-changed'].includes(scene.key))await contrast(page,label);
  if(scene.proof){
    await page.locator('#productLabCollection').selectOption(scene.rows[0].collection_date);await stable(page);
    const card=page.locator(`.ltsLabValueCard[data-lab-marker="${labMarkerKey(scene.marker)}"]`);
    assert.equal(await card.locator('strong').textContent(),labOriginalText(scene.rows[0]));
    assert.equal(await card.locator('.ltsLabReferencePosition').count(),scene.proof==='valid'?1:0,'The same existing row-bound Hb/Ht proof controls collection classification');
    await capture(page,`${label}-reviewed-prior-collection`,'.ltsLabCollection');
  }
}
async function historyControls(page,fixture,label){
  const scene=fixture.scenes.find(scene=>scene.history);await chooseMarker(page,scene.marker);
  const expected=scene.rows.slice().sort((a,b)=>b.collection_date.localeCompare(a.collection_date));
  assert.deepEqual(await page.locator('.ltsLabsHistoryRow b').allTextContents(),expected.slice(0,10).map(labOriginalText));
  const next=page.locator('[data-depth-page="productLabPage"][aria-label="Próxima página"]'),previous=page.locator('[data-depth-page="productLabPage"][aria-label="Página anterior"]');
  assert.equal(await previous.isDisabled(),true);assert.equal(await next.isDisabled(),false);
  await capture(page,`${label}-history-page-1`,'.ltsLabsHistoryList');await next.click();await stable(page);
  assert.deepEqual(await page.locator('.ltsLabsHistoryRow b').allTextContents(),expected.slice(10).map(labOriginalText));
  assert.match(await page.locator('.ltsPager').innerText(),/Página 2 de 2/);assert.equal(await next.isDisabled(),true);
  await capture(page,`${label}-history-page-2`,'.ltsLabsHistoryList');await previous.click();await stable(page);
  await choosePeriod(page,'30');assert.equal(await page.locator('.ltsLabsChart svg circle').count(),1);
  assert.equal(await page.locator('.ltsLabsHistoryList').getAttribute('data-lab-history-total'),'13','Period changes never discard the complete readable archive');
  await choosePeriod(page,'90');assert.equal(await page.locator('.ltsLabsChart svg circle').count(),3);
  await choosePeriod(page,'365');assert.equal(await page.locator('.ltsLabsChart svg circle').count(),10);
  await choosePeriod(page,'all');assert.equal(await page.locator('.ltsLabsChart svg circle').count(),13);
  await page.locator('#productLabPoint').selectOption('0');await stable(page);
  assert.match(await page.locator('.ltsPointReadout').innerText(),/22,0 u/);
  assert.equal(await page.locator('.ltsLabsChart circle.selected').count(),1);
  const options=await page.locator('#productLabMarkerSelect option').evaluateAll(items=>items.filter(item=>item.value).map(item=>item.value));
  assert.deepEqual(options.slice().sort(),fixture.scenes.map(scene=>labMarkerKey(scene.marker)).sort(),'The complete selector includes every marker, not only shortcut cards');
  await page.locator('#productLabQuery').fill('Método não informado');await stable(page);
  assert.deepEqual(await page.locator('#productLabMarkerSelect option').evaluateAll(items=>items.filter(item=>item.value).map(item=>item.value)),[labMarkerKey('Método não informado sintético')]);
  await chooseMarker(page,'Método não informado sintético');await capture(page,`${label}-search-selection`,'.ltsLabsMarkers');
  await page.locator('#productLabQuery').fill('sem-correspondencia-sintetica');await stable(page);
  assert.equal(await page.locator('#productLabMarkerSelect option').count(),1);assert.match(await page.locator('.ltsLabsMarkers').innerText(),/Nenhum marcador corresponde/);
  await page.locator('#productLabQuery').fill('');await stable(page);await chooseMarker(page,'Glicose');
  await page.locator('#productLabCollection').selectOption(fixture.date(2));await stable(page);
  await page.locator(`.ltsLabValueCard[data-lab-marker="${labMarkerKey('Ferritina')}"]`).click();await stable(page);
  assert.equal(await page.locator('#productLabMarkerSelect').inputValue(),labMarkerKey('Ferritina'),'Collection cards still open the complete marker history');
  await capture(page,`${label}-collection-selection`,'.ltsLabsHero');
}
async function homeProofConsistency(page,fixture,width,label){
  await navigate(page,'hoje',width);assert.equal(await page.locator('[data-dashboard-card]').count(),7,'Approved Home metric layout is unchanged');
  await page.locator('#dashboard-period').selectOption('all');await stable(page,'hoje');
  for(const key of ['dashboard-other-labs','dashboard-historical-labs']){
    const details=page.locator(`[data-disclosure="${key}"]`);
    if(await details.count()&&!(await details.evaluate(el=>el.open)))await details.locator(':scope > summary').click();
  }
  for(const scene of fixture.scenes.filter(scene=>scene.proof)){
    const item=page.locator('[data-dashboard-lab-item]').filter({has:page.getByRole('heading',{name:scene.marker,exact:true})});
    assert.equal(await item.count(),1);assert.equal(await item.locator('.healthLabDelta').count(),scene.comparable?1:0,'Home and Exames use the same already-reviewed Hb/Ht contract');
    const original=await item.locator('.healthLabValues').innerText();for(const row of scene.rows)assert.ok(original.includes(row.result_raw));
    if(!scene.comparable)assert.match(await item.innerText(),/formato numérico não confirmado/);
    await capture(page,`${label}-home-${scene.key}`,`[data-dashboard-lab-item]:has(h3:text-is("${scene.marker}"))`);
  }
  await navigate(page,'saude',width);await choosePeriod(page,'all');
}
async function visibleRefresh(page,width,status,label){
  const actionRoute=await page.locator('#refreshBtn').isVisible()?'saude':'nutricao';
  if(actionRoute!=='saude')await navigate(page,actionRoute,width);
  assert.equal(await page.locator('#refreshBtn').isVisible(),true,'Use the visible production refresh control');
  const readsBefore=await page.evaluate(({status,selector})=>{window.__historyQA.failTable=status==='error'?'health_lab_results':null;window.__languageBeforeRefreshRoot=document.querySelector(selector);return window.__historyQA.reads.length;},{status,selector:roots[actionRoute]});
  await capture(page,`${label}-${status}-refresh-control`,'#refreshBtn');await page.locator('#refreshBtn').click();await stable(page,actionRoute,{afterRefresh:true});
  if(actionRoute!=='saude')await navigate(page,'saude',width);
  assert.equal(await (await page.waitForFunction(consumerDomainSettled,{domain:'labs',status})).jsonValue(),true);
  const proof=await page.evaluate(({readsBefore,actionRoute})=>({actionRoute,route:window.__languageApp.state.route,status:window.__languageApp.state.domainStatus.labs,newReads:window.__historyQA.reads.slice(readsBefore).filter(read=>read.table==='health_lab_results'),error:window.__languageApp.state.errors.labs||null,retainedRows:window.__languageApp.state.data.labs?.length}),{readsBefore,actionRoute});
  assert.ok(proof.newReads.length>0);assert.equal(proof.status,status);assert.equal(proof.route,'saude');refreshProof.push({label,width,...proof});save();return proof;
}
async function failureRecovery(page,width,label){
  await chooseMarker(page,'Glicose');const before=await page.locator('.ltsLabsHero').innerText();
  const proof=await visibleRefresh(page,width,'error',label);assert.ok(proof.retainedRows>0,'Include retained prior data to detect stale values presented as current');assert.ok(proof.error.includes(LANGUAGE_ERROR));
  const text=await page.locator('#screenHost').innerText();assert.match(text,/resultados laboratoriais não carregaram/i);
  assert.doesNotMatch(text,/Nenhum resultado laboratorial|Não há pontos numéricos|Sem resultado/i,'A failed read is never confirmed absence');
  assert.ok(!text.includes(LANGUAGE_ERROR));assert.equal(await page.locator('.ltsLabsHero,.ltsLabsChart,.ltsLabsHistoryRow').count(),0,'No stale result survives the failed source state');
  await capture(page,`${label}-unavailable`,'.ltsDepthError');await contrast(page,`${label}-unavailable`,['.ltsDepthError > b','.ltsDepthError > span']);
  await visibleRefresh(page,width,'ready',label);await shell(page);assert.equal(await page.locator('#productLabMarkerSelect').inputValue(),labMarkerKey('Glicose'));
  assert.equal(await page.locator('.ltsLabsHero').innerText(),before,'Recovery restores the same marker and original result');
  assert.equal(await page.locator('.ltsLabsChart path.ltsDepthLine').count(),1);await capture(page,`${label}-recovered`,'.ltsHistoryContext');
}
async function security(page,traffic,{signedOut=false,empty=false}={}){
  await installAppProbe(page);
  const proof=await page.evaluate(()=>{
    const {state,fixtureMode}=window.__languageApp,client=window.supabase.createClient('synthetic','synthetic'),guards=[];
    const operations=[()=>client.from('synthetic').insert({}),()=>client.from('synthetic').update({}),()=>client.from('synthetic').upsert({}),()=>client.from('synthetic').delete(),()=>client.rpc('synthetic'),()=>client.functions.invoke('synthetic'),()=>client.storage.from('synthetic').upload('synthetic',new Blob(['synthetic'])),()=>client.storage.from('synthetic').remove(['synthetic'])];
    for(const operation of operations){try{operation();guards.push(false);}catch(error){guards.push(error.code==='preview_read_only');}}
    return {fixtureMode,readonly:Boolean(window.LTSPreviewReadOnly),user:state.session?.user?.id??null,reads:window.__historyQA.reads,writes:window.__historyQA.writes,guards,loadedRows:(state.data.labs||[]).map(row=>({id:row.source_record_id,sourcePayload:Object.hasOwn(row,'source_payload'),numericKindProjected:Object.hasOwn(row,'numeric_kind'),proofProjected:Object.hasOwn(row,'reference_verification')}))};
  });
  assert.equal(proof.fixtureMode,false);assert.equal(proof.readonly,true);assert.ok(proof.guards.every(Boolean));
  assert.equal(proof.user,signedOut?null:'synthetic-history-browser-user');
  if(signedOut)assert.deepEqual(proof.reads,[],'The signed-out auth boundary prevents every health data read');
  else{
    const reads=proof.reads.filter(read=>read.table==='health_lab_results');assert.ok(reads.length>0);
    for(const read of reads){assert.ok(read.projection.includes('numeric_kind:source_payload->>numeric_kind'));assert.ok(read.projection.includes('reference_verification:source_payload->reference_verification'));assert.ok(!read.projection.split(',').some(field=>field==='*'||field==='source_payload'),'The loader never broadens to an entire sensitive payload');}
    if(!empty)assert.ok(proof.loadedRows.length>0);
    assert.ok(proof.loadedRows.every(row=>!row.sourcePayload&&row.numericKindProjected&&row.proofProjected),'The mock returns only the actual requested projection');
  }
  assert.deepEqual(proof.writes,[]);assert.deepEqual(traffic.writes,[]);assert.deepEqual(traffic.external,[]);assert.deepEqual(traffic.errors,[]);
  return {...flags,productionStartup:true,signedOut,readCount:proof.reads.length,writeCount:0,externalRequestCount:0,guardsChecked:proof.guards.length};
}
async function contextFor(browser,fixture,width,height,options={}){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<=840,hasTouch:width<=840,locale:'pt-BR',timezoneId:'America/Sao_Paulo',serviceWorkers:'block'}),traffic={external:[],writes:[],errors:[]};
  await context.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2'&&request.method()==='GET')return route.fulfill({status:200,contentType:'application/javascript',body:labReadingConsistencyService(fixture.db,options)});
    if(url.origin===origin.origin&&['GET','HEAD'].includes(request.method()))return route.continue();
    if(!['GET','HEAD'].includes(request.method()))traffic.writes.push({url:request.url(),method:request.method()});else traffic.external.push(request.url());
    return route.abort('blockedbyclient');
  });
  const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',error=>traffic.errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('net::ERR_BLOCKED_BY_CLIENT'))traffic.errors.push(message.text());});
  await page.clock.setFixedTime(new Date(`${LAB_READING_TODAY}T15:00:00Z`));return {context,page,traffic};
}
async function recordFailure(page,name,error,traffic){
  const diagnostic=await page.evaluate(()=>({route:window.__languageApp?.state.route,domainStatus:window.__languageApp?.state.domainStatus,reads:window.__historyQA?.reads,visibleText:document.querySelector('#screenHost')?.innerText})).catch(()=>null);
  writeFileSync(`${dir}/${name}-failure-diagnostic.json`,JSON.stringify({...flags,diagnostic,traffic},null,2));
  await page.screenshot({path:`${dir}/${name}-failure.png`,animations:'disabled',scale:'css'}).catch(()=>{});
  failures.push({name,message:String(error.message)});results.push({name,status:'failed',...flags});save();
}
async function check(page,name,traffic,run){
  const initial=failures.length;
  try{const detail=await run();results.push({name,status:failures.length===initial?'passed':'failed',...flags,...detail});save();}
  catch(error){await recordFailure(page,name,error,traffic);}
}

const browser=await chromium.launch({headless:true});
try{
  for(const [width,height] of sizes){
    for(const proof of ['valid','swapped']){
      const fixture=makeLabReadingConsistencyFixture({proof}),label=`${width}-${proof}`,{context,page,traffic}=await contextFor(browser,fixture,width,height);
      try{
        await page.goto(`${base}#hoje`);await stable(page,'hoje');assert.equal(await page.locator('[data-dashboard-card]').count(),7);
        await navigate(page,'saude',width);await choosePeriod(page,'all');await shell(page);
        for(const scene of fixture.scenes.filter(scene=>proof==='valid'||scene.proof))await check(page,`${label}-${scene.key}`,traffic,()=>assertScene(page,scene,`${label}-${scene.key}`,width));
        await check(page,`${label}-home-proof-consistency`,traffic,()=>homeProofConsistency(page,fixture,width,label));
        if(proof==='valid'){
          await check(page,`${label}-history-controls`,traffic,()=>historyControls(page,fixture,label));
          await check(page,`${label}-route-return`,traffic,async()=>{await chooseMarker(page,'Glicose');await navigate(page,'hoje',width);await page.goBack();await stable(page);assert.equal(await page.locator('#productLabMarkerSelect').inputValue(),labMarkerKey('Glicose'));});
          await check(page,`${label}-failure-recovery`,traffic,()=>failureRecovery(page,width,label));
        }
        await check(page,`${label}-security`,traffic,()=>security(page,traffic));
      }catch(error){await recordFailure(page,`${label}-startup`,error,traffic);}finally{await context.close();}
    }
    for(const kind of ['signed-out','confirmed-empty']){
      const fixture=makeLabReadingConsistencyFixture({empty:kind==='confirmed-empty'}),label=`${width}-${kind}`,{context,page,traffic}=await contextFor(browser,fixture,width,height,{signedOut:kind==='signed-out'});
      try{
        await page.goto(`${base}#saude`);
        if(kind==='signed-out'){
          await page.locator('#login:not(.hidden)').waitFor();assert.equal(await page.locator('#app').isVisible(),false);assert.equal(await page.locator('.ltsLabsHero,.ltsLabsHistoryRow').count(),0);
          await capture(page,label,'#login',{login:true});await check(page,label,traffic,()=>security(page,traffic,{signedOut:true}));
        }else{
          await stable(page);const text=await page.locator('#screenHost').innerText();assert.match(text,/Nenhum resultado laboratorial nesta janela/);assert.equal(await page.locator('.ltsDepthError').count(),0);
          await capture(page,label,'.ltsEmptyCard');await check(page,label,traffic,()=>security(page,traffic,{empty:true}));
        }
      }catch(error){await recordFailure(page,label,error,traffic);}finally{await context.close();}
    }
  }
  const fixture=makeLabReadingConsistencyFixture(),{context,page,traffic}=await contextFor(browser,fixture,393,844,{pauseTable:'health_lab_results'});
  try{
    await page.goto(`${base}#saude`);await installAppProbe(page);
    assert.equal(await (await page.waitForFunction(()=>Boolean(window.__historyQA?.reads.some(read=>read.table==='health_lab_results')&&!window.__historyQA.pauseReleased&&window.__languageApp.state.domainStatus.labs==='loading'&&document.querySelector('#screenHost .loadingState')?.checkVisibility({checkVisibilityCSS:true})))).jsonValue(),true);
    assert.equal(await page.locator('.ltsLabsHero,.ltsLabsHistoryRow,.ltsEmptyCard').count(),0,'Unresolved reads do not render a completed empty result');
    await capture(page,'393-loading','.loadingState');await page.evaluate(()=>window.__releaseHistoryReads());await stable(page);await choosePeriod(page,'all');await chooseMarker(page,'Glicose');
    assert.equal(await page.locator('.ltsLabsChart path.ltsDepthLine').count(),1);await capture(page,'393-loading-recovered','.ltsHistoryContext');
    await check(page,'393-loading-recovery',traffic,()=>security(page,traffic));
  }catch(error){await recordFailure(page,'393-loading-recovery',error,traffic);}finally{await context.close();}
}finally{save();await browser.close();}
assert.equal(failures.length,0,`Laboratory reading consistency: ${failures.length} failures; inspect ${dir}/results.json and original-resolution PNG evidence.`);
console.log('Laboratory reading consistency: four widths, exactness and comparison boundaries, latest-original preservation, reviewed/swapped Hb/Ht evidence, full history controls, failure/recovery, signed-out guard and zero writes. Synthetic only; no real authenticated QA.');

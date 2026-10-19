import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {makeDocumentaryNumericRow} from './documentary-numeric-reading-fixture.mjs';
import {makeConsumerLanguageFixture,consumerLanguageService,languageDatabase,LANGUAGE_TODAY} from './consumer-language-fixture.mjs';
import {consumerRouteSettled} from './consumer-language-readiness.mjs';
import {visibleTextGeometry} from './consumer-language-geometry.mjs';

// CI-only browser contract for the existing loopback server and Playwright
// 1.56.1. Do not start a local browser/server to work around an execution denial.
// The application, auth boundary, loader, route controls and renderers are real;
// only SDK responses and the session identity are invented. No PDF, patient,
// credential, external request, upload, backend write or publication is used.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/preview/compact-evidence/';
const origin=new URL(base);
assert.equal(origin.protocol,'http:');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(origin.hostname),'Synthetic browser QA uses loopback only');
assert.ok(origin.pathname.endsWith('/preview/compact-evidence/'));
assert.equal(origin.search,'','Exercise production startup, never a fixture query route');
assert.equal(origin.hash,'');
const dir=process.env.LTS_DOCUMENTARY_NUMERIC_EVIDENCE_DIR||'documentary-numeric-reading-visual';
mkdirSync(dir,{recursive:true});
const sizes=[[320,740],[393,844],[1180,757],[1440,900]];
const roots={hoje:'[data-health-dashboard]',saude:'.ltsLabsV2'};
const results=[],captures=[],failures=[],projectionEvidence=[],readingEvidence=[];
const flags={syntheticOnly:true,authenticatedWithRealAccount:false,realDocumentsUsed:false};
const markerKey=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const original=row=>`${row.result_raw}${row.unit&&!row.result_raw.toLowerCase().includes(row.unit.toLowerCase())?` ${row.unit}`:''}`;
const dateLabel=date=>date.split('-').reverse().join('/');
function save(){writeFileSync(`${dir}/results.json`,JSON.stringify({...flags,fixedDate:LANGUAGE_TODAY,productionStartup:true,viewportWidths:sizes.map(([width])=>width),deviceScaleFactor:1,originalResolutionScreenshots:true,results,captures,projectionEvidence,readingEvidence,failures},null,2));}

function makeFixture(){
  const f=makeConsumerLanguageFixture('empty'),scenes=[];
  const add=(key,marker,kind='footnote',options={})=>{
    const grouped=kind!=='footnote',unit=grouped?'u/L':'ng/mL';
    const common={kind,biomarker:marker,unit,reference_range:grouped?'1000 a 9000 u/L':'10 a 90 ng/mL'};
    const previous=makeDocumentaryNumericRow({...common,id:`${key}-previous`,collection_date:f.date(21),token:grouped?'4.670':'73,4',...options.previous});
    const current=makeDocumentaryNumericRow({...common,id:`${key}-current`,collection_date:f.date(2),token:grouped?'5.120':'74,6',...options.current});
    const scene={key,marker,kind,previous,current,rows:[previous,current],exact:true,comparable:true,expectedPoints:2,...options.expected};
    options.change?.(scene);scenes.push(scene);return scene;
  };
  add('verified-footnote','Ferritina');
  add('verified-grouping','Leucócitos','grouped');
  add('verified-footnote-grouping','Marcador agrupado com nota sintético','footnote_grouped');
  add('invalid-hash','Estradiol','footnote',{expected:{exact:false,comparable:false,expectedPoints:1,reason:'non-exact'},change:({current})=>{current.numeric_reading_verification.clinical.evidence_text_sha256='0'.repeat(64);}});
  add('swapped-proof','Triglicérides','footnote',{expected:{exact:false,comparable:false,expectedPoints:1,reason:'non-exact'},change:({previous,current})=>{current.numeric_reading_verification=structuredClone(previous.numeric_reading_verification);}});
  add('absent-proof','TSH','footnote',{expected:{exact:false,comparable:false,expectedPoints:1,reason:'non-exact'},change:({current})=>{current.numeric_reading_verification=null;}});
  // Build matching bindings/evolution text around the censored raw. A matching
  // digest or "source_verified" flag can never turn an actual limit into a point.
  add('censored-raw','T4 Livre','footnote',{current:{result_raw:'<74,6(1)'},expected:{exact:false,comparable:false,expectedPoints:1,reason:'non-exact'}});
  add('censored-kind','Vitamina B-12','footnote',{current:{numeric_kind:'censored'},expected:{exact:false,comparable:false,expectedPoints:1,reason:'non-exact'}});
  add('different-method','Glicose','footnote',{previous:{method:'Método sintético A'},current:{method:'Método sintético B'},expected:{comparable:false,expectedPoints:1,cohorts:2,reason:'method'}});
  add('different-reference','HDL-Colesterol','footnote',{current:{reference_range:'20 a 95 ng/mL'},expected:{comparable:false,expectedPoints:2,reason:'reference'}});
  f.data.labs=scenes.flatMap(scene=>scene.rows).map(input=>{
    const row=structuredClone(input);
    row.source_payload={numeric_kind:row.numeric_kind??null,reference_verification:null,numeric_reading_verification:row.numeric_reading_verification??null};
    delete row.numeric_kind;delete row.reference_verification;delete row.numeric_reading_verification;return row;
  });
  f.db=languageDatabase(f.data);return {...f,scenes};
}

function documentaryService(db){
  const script=consumerLanguageService(db),needle='return selected;};';
  assert.equal(script.split(needle).length,2,'Review the shared SDK mock before its production-path projection changes');
  return script.replace(needle,`return table==='health_lab_results'?selected.map(row=>{
    const copy={};
    for(const field of projection.split(',').map(value=>value.trim())){
      if(field==='numeric_kind:source_payload->>numeric_kind')copy.numeric_kind=row.source_payload?.numeric_kind??null;
      else if(field==='reference_verification:source_payload->reference_verification')copy.reference_verification=row.source_payload?.reference_verification??null;
      else if(field==='numeric_reading_verification:source_payload->numeric_reading_verification')copy.numeric_reading_verification=row.source_payload?.numeric_reading_verification??null;
      else if(field!=='*'&&field!=='source_payload'&&Object.hasOwn(row,field))copy[field]=structuredClone(row[field]);
    }
    return copy;
  }):selected;};`);
}

async function installProbe(page){
  await page.evaluate(async()=>{
    if(window.__languageApp)return;
    const {state,fixtureMode}=await import('./src/core.js'),{isRouteReady}=await import('./src/data-layer.js');
    const imports=JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports;
    const actual=await import(new URL(imports['./src/core.js'],document.baseURI).href);
    if(actual.state!==state)throw new Error('The browser test must inspect the same core module as the application');
    const {labResultReading,compareLabResults}=await import('./src/health-dashboard-labs.js');
    window.__languageApp={state,fixtureMode,isRouteReady,labResultReading,compareLabResults};
  });
}
async function stable(page,route){
  await installProbe(page);
  await page.evaluate(()=>{window.__languageStableRoot=null;window.__languageFrames=0;});
  assert.equal(await (await page.waitForFunction(consumerRouteSettled,{route,selector:roots[route]})).jsonValue(),true);
}
async function navigate(page,route,width){
  const nav=width<=840?'#mobileNav':'#primaryNav',button=page.locator(`${nav} [data-route="${route}"]`);
  if(await button.count())await button.click();
  else{await page.locator(`${nav} [data-route="mais"]`).click();await page.locator(`#moreSheet [data-route="${route}"]`).click();}
  await stable(page,route);
}

// Keep the existing painted-text detector unchanged. In addition, separately
// record hidden/clip boundaries so clipped ink cannot be "fixed" by clipping it
// out of the overflow calculation. Scroll-port edges are covered by tiles;
// non-scrollable hidden/clip edges remain real failures at a one-pixel tolerance.
async function layout(page,name,target){
  const report=await target.evaluate(el=>{
    const host=document.querySelector('#screenHost'),root=host.querySelector('[data-health-dashboard],.ltsLabsV2');
    const rawText=[],hardClippedText=[],walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT);let node,nodeId=0;
    const box=r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom});
    while(node=walker.nextNode()){
      nodeId++;const parent=node.parentElement;
      if(!node.textContent.trim()||!parent||parent.closest('svg,select,option,script,style')||!parent.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}))continue;
      const clips=[],hardClips=[],scrollClips=[];
      for(let p=parent;p;p=p.parentElement){
        const css=getComputedStyle(p),x=/^(hidden|clip|scroll|auto)$/.test(css.overflowX),y=/^(hidden|clip|scroll|auto)$/.test(css.overflowY);
        if((!x&&!y)||['inline','contents'].includes(css.display))continue;
        const b=p.getBoundingClientRect(),left=b.left+p.clientLeft,top=b.top+p.clientTop;
        const clip={x,y,left,right:left+p.clientWidth,top,bottom:top+p.clientHeight};clips.push(clip);
        const scroll={...clip,x:/^(scroll|auto)$/.test(css.overflowX),y:/^(scroll|auto)$/.test(css.overflowY)};
        if(scroll.x||scroll.y)scrollClips.push(scroll);
        const hard={...clip,x:/^(hidden|clip)$/.test(css.overflowX),y:/^(hidden|clip)$/.test(css.overflowY)};
        if(hard.x||hard.y)hardClips.push(hard);
      }
      const range=document.createRange();range.selectNodeContents(node);
      for(const r of range.getClientRects()){
        if(r.width<=0||r.height<=0||r.bottom<=0||r.top>=innerHeight)continue;
        const item={nodeId,text:node.textContent.trim(),rect:box(r),clips};rawText.push(item);
        // Ink outside a genuine scroll-port is accessible in another tile.
        // Intersect scroll boundaries only, before testing every hard boundary;
        // never use the already hidden/clip-adjusted visible rectangle here.
        const scrollVisible={...item.rect};
        for(const clip of scrollClips){if(clip.x){scrollVisible.left=Math.max(scrollVisible.left,clip.left);scrollVisible.right=Math.min(scrollVisible.right,clip.right);}if(clip.y){scrollVisible.top=Math.max(scrollVisible.top,clip.top);scrollVisible.bottom=Math.min(scrollVisible.bottom,clip.bottom);}}
        if(scrollVisible.right<=scrollVisible.left||scrollVisible.bottom<=scrollVisible.top)continue;
        for(const clip of hardClips)if((clip.x&&(scrollVisible.left<clip.left-1||scrollVisible.right>clip.right+1))||(clip.y&&(scrollVisible.top<clip.top-1||scrollVisible.bottom>clip.bottom+1)))hardClippedText.push({text:item.text,rect:item.rect,scrollVisible,clip});
      }
    }
    let visibleTop=0,visibleBottom=innerHeight,visibleLeft=0,visibleRight=innerWidth;
    for(let p=el.parentElement;p;p=p.parentElement){
      const css=getComputedStyle(p),b=p.getBoundingClientRect();
      if(/^(hidden|clip|scroll|auto)$/.test(css.overflowY)){visibleTop=Math.max(visibleTop,b.top+p.clientTop);visibleBottom=Math.min(visibleBottom,b.top+p.clientTop+p.clientHeight);}
      if(/^(hidden|clip|scroll|auto)$/.test(css.overflowX)){visibleLeft=Math.max(visibleLeft,b.left+p.clientLeft);visibleRight=Math.min(visibleRight,b.left+p.clientLeft+p.clientWidth);}
    }
    const targetBox=el.getBoundingClientRect(),targetText=[];
    const targetWalker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    while(node=targetWalker.nextNode()){
      if(!node.textContent.trim()||!node.parentElement.checkVisibility({checkVisibilityCSS:true,checkOpacity:true})||node.parentElement.closest('select,option,svg,script,style'))continue;
      const range=document.createRange();range.selectNodeContents(node);
      if([...range.getClientRects()].some(r=>r.width>0&&r.height>0&&r.top>=visibleTop-1&&r.bottom<=visibleBottom+1&&r.right>visibleLeft&&r.left<visibleRight))targetText.push(node.textContent.trim());
    }
    return {viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,
      hostWidth:host.clientWidth,hostScrollWidth:host.scrollWidth,rootWidth:root.clientWidth,rootScrollWidth:root.scrollWidth,
      target:{box:box(targetBox),height:targetBox.height,visibleTop,visibleBottom,coveredStart:Math.max(0,visibleTop-targetBox.top),coveredEnd:Math.min(targetBox.height,visibleBottom-targetBox.top),text:targetText.join(' ')},rawText,hardClippedText};
  });
  Object.assign(report,visibleTextGeometry(report.rawText,report.viewport.width));
  writeFileSync(`${dir}/${name}-layout.json`,JSON.stringify({...flags,...report},null,2));
  const issues=[];
  if(report.documentWidth>report.viewport.width+1||report.bodyWidth>report.viewport.width+1||report.hostScrollWidth>report.hostWidth+1||report.rootScrollWidth>report.rootWidth+1)issues.push('horizontal overflow');
  if(report.overflowingText.length)issues.push('painted text outside viewport');
  if(report.overlaps.length)issues.push('overlapping painted text');
  if(report.hardClippedText.length)issues.push('text actually cut by hidden/clip bounds');
  if(!report.target.text.trim()||report.target.coveredEnd<=report.target.coveredStart)issues.push('empty or offscreen target tile');
  if(issues.length)failures.push({name,category:'layout',issues,evidence:`${name}-layout.json`});
  return report;
}

async function captureTiles(page,name,target){
  assert.equal(await target.count(),1);assert.equal(await target.isVisible(),true);
  let offset=0,covered=0,index=0,finished=false;
  while(!finished){
    assert.ok(index<100,'A target must remain reachable through its real scroll container');
    await target.evaluate((el,offset)=>{
      el.scrollIntoView({block:'start',inline:'nearest',behavior:'instant'});
      for(let p=el.parentElement;p;p=p.parentElement){
        if(/^(auto|scroll)$/.test(getComputedStyle(p).overflowY)&&p.scrollHeight>p.clientHeight){
          const top=Math.max(0,p.getBoundingClientRect().top+p.clientTop)+12;
          p.scrollTop+=el.getBoundingClientRect().top-top+offset;return;
        }
      }
      window.scrollBy({top:el.getBoundingClientRect().top-12+offset,left:0,behavior:'instant'});
    },offset);
    const tile=`${name}-tile-${++index}`;
    assert.ok(!captures.some(capture=>capture.name===tile),'Preserve every original evidence image');
    const buffer=await page.screenshot({path:`${dir}/${tile}.png`,fullPage:false,animations:'disabled',scale:'css'});
    const viewport=page.viewportSize();
    assert.equal(buffer.subarray(1,4).toString(),'PNG');assert.equal(buffer.readUInt32BE(16),viewport.width);assert.equal(buffer.readUInt32BE(20),viewport.height);
    assert.ok(buffer.length>2000,'The original-resolution capture must contain rendered content');
    const report=await layout(page,tile,target),range=report.target;
    captures.push({name:tile,viewport,originalResolution:true,bytes:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex'),coveredStart:range.coveredStart,coveredEnd:range.coveredEnd,targetHeight:range.height,visibleTargetText:range.text,...flags});
    assert.ok(range.coveredStart<=covered+1,'Viewport tiles leave no unseen vertical gap in the target');
    assert.ok(range.coveredEnd>covered,'Each tile exposes additional target content');
    covered=range.coveredEnd;finished=covered>=range.height-1;
    offset=Math.max(offset+1,covered-32);save();
  }
}

async function literal(page,target,expected,name){
  assert.equal(await target.count(),1);assert.equal(await target.textContent(),expected,'Preserve the complete raw string, notation and precision');
  assert.equal(await target.locator('*').count(),0,'The original result remains escaped plain text');
  const evidence=await target.evaluate(el=>{
    const b=el.getBoundingClientRect(),characters=[],range=document.createRange(),walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node;
    while(node=walker.nextNode())for(let offset=0;offset<node.textContent.length;){
      const character=String.fromCodePoint(node.textContent.codePointAt(offset));range.setStart(node,offset);range.setEnd(node,offset+character.length);
      characters.push({character,offset,rects:[...range.getClientRects()].map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}))});offset+=character.length;
    }
    const bad=characters.filter(c=>!/^\s$/u.test(c.character)&&c.rects.some(r=>r.width>0&&r.height>0&&(r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1)));
    return {box:{left:b.left,right:b.right,top:b.top,bottom:b.bottom},fontSize:parseFloat(getComputedStyle(el).fontSize),characters,clippedCharacters:bad};
  });
  writeFileSync(`${dir}/${name}-literal.json`,JSON.stringify({...flags,expected,...evidence},null,2));
  assert.equal(evidence.clippedCharacters.length,0,'Every original character fits its own box, with no hidden tail');
  assert.ok(evidence.fontSize>=12,'Original numerical results remain legible at native viewport resolution');
}

async function verifyReadings(page,fixture,width){
  const proof=await page.evaluate(()=>{
    const {state,labResultReading,compareLabResults}=window.__languageApp;
    return {readings:state.data.labs.map(row=>({id:row.id,sourceRecordId:row.source_record_id,raw:row.result_raw,numeric:row.result_numeric,hasPayload:Object.hasOwn(row,'source_payload'),hasProof:Object.hasOwn(row,'numeric_reading_verification'),reading:labResultReading(row)})),
      comparisons:[...new Set(state.data.labs.map(row=>row.biomarker))].map(marker=>{const rows=state.data.labs.filter(row=>row.biomarker===marker).sort((a,b)=>a.collection_date.localeCompare(b.collection_date));return {marker,...compareLabResults(rows[1],rows[0])};})};
  });
  assert.equal(proof.readings.length,fixture.scenes.length*2);
  for(const scene of fixture.scenes){
    for(const row of scene.rows){
      const actual=proof.readings.find(item=>item.id===row.id),exact=row===scene.previous||scene.exact;
      assert.ok(actual,`The real loader projects the bound database id: ${row.id}`);
      assert.equal(actual.hasPayload,false);assert.equal(actual.hasProof,true);assert.equal(actual.raw,row.result_raw);assert.equal(actual.numeric,row.result_numeric);
      assert.equal(actual.reading.exactValue,exact?row.result_numeric:null,`${scene.key}: only the exact, bound documentary value is eligible`);
      if(exact){
        const reading=actual.reading.documentaryNumericReading;assert.ok(reading,'The shared reading exposes its documentary provenance');
        assert.equal(reading.value,row.result_numeric);assert.equal(reading.originalRaw,row.result_raw);assert.equal(reading.proofReference.sourceRecordId,row.source_record_id);assert.ok(reading.transformations.length>0);
      }else{assert.equal(actual.reading.documentaryNumericReading??null,null);assert.equal(actual.reading.referencePosition,'unknown');}
    }
    const comparison=proof.comparisons.find(item=>item.marker===scene.marker);assert.equal(comparison.comparable,scene.comparable);
    assert.equal(comparison.delta,scene.comparable?Number((scene.current.result_numeric-scene.previous.result_numeric).toPrecision(12)):null);
  }
  readingEvidence.push({width,...proof});save();
}

async function homeScene(page,scene,label){
  const item=page.locator('[data-dashboard-lab-item]').filter({has:page.getByRole('heading',{name:scene.marker,exact:true})});
  assert.equal(await item.count(),1);assert.equal(await item.locator('.healthLabDelta').count(),scene.comparable?1:0);
  const raw=item.locator('.healthLabValues b');assert.equal(await raw.count(),2);
  for(const [index,row] of scene.rows.entries())await literal(page,raw.nth(index),original(row),`${label}-home-original-${index}`);
  if(scene.comparable){
    const delta=Number((scene.current.result_numeric-scene.previous.result_numeric).toPrecision(12));
    assert.ok((await item.locator('.healthLabDelta').innerText()).includes(delta.toLocaleString('pt-BR',{maximumFractionDigits:10})));
  }else{
    const text=await item.innerText();assert.doesNotMatch(text,/aproximou da referência|afastou da referência/);
    assert.match(text,scene.reason==='method'?/métodos.*diferentes/i:scene.reason==='reference'?/referências.*diferentes/i:/textual|limite|formato numérico não confirmado/i);
  }
  const details=item.locator('details');if(!(await details.evaluate(el=>el.open)))await details.locator(':scope > summary').click();
  assert.match(await details.innerText(),/A direção do número e a distância da referência não definem melhora ou piora clínica/);
  const primary=await item.evaluate(el=>{const copy=el.cloneNode(true);copy.querySelectorAll('details').forEach(node=>node.remove());return copy.textContent;});
  assert.doesNotMatch(primary,/melhorou|piorou|melhora clínica|piora clínica|diagnóstico confirmado/i,'A documentary number does not create a clinical improvement claim');
  await captureTiles(page,`${label}-home`,item);
  // Exercise the actual contextual action and its selected-marker/cohort state.
  await item.locator('[data-dashboard-lab]').click();await stable(page,'saude');
  assert.equal(await page.locator('#productLabMarkerSelect').inputValue(),markerKey(scene.marker));
  assert.equal(await page.locator('[data-depth-period="productLabPeriod"][data-value="all"]').getAttribute('aria-pressed'),'true');
}

async function healthScene(page,scene,label){
  const expectedOriginal=original(scene.current);
  await literal(page,page.locator('.ltsLabsHeroTop strong'),expectedOriginal,`${label}-hero-original`);
  assert.deepEqual(await page.locator('.ltsLabsHistoryRow b').allTextContents(),[scene.current,scene.previous].map(original));
  assert.equal(await page.locator('.ltsLabsHistoryList').getAttribute('data-lab-history-total'),'2');
  for(const [index,row] of [scene.current,scene.previous].entries())await literal(page,page.locator('.ltsLabsHistoryRow b').nth(index),original(row),`${label}-history-original-${index}`);
  assert.equal(await page.locator('.ltsLabsChart svg circle').count(),scene.expectedPoints);
  assert.equal(await page.locator('.ltsLabsChart path.ltsDepthLine').count(),scene.comparable?1:0,'An exact reading alone never connects incompatible collections');
  const context=await page.locator('.ltsHistoryContext').innerText();
  if(scene.comparable){assert.ok(context.includes(dateLabel(scene.previous.collection_date)));assert.ok(context.includes(dateLabel(scene.current.collection_date)));assert.match(context,/→/);}
  else{assert.doesNotMatch(context,/\d{2}\/\d{2}\/\d{4}\s*→/);assert.match(context,/nota|limite|formato|referências|uma coleta|diferentes|separados/i);}
  assert.doesNotMatch(await page.locator('.ltsLabsHero,.ltsHistoryContext,.ltsLabsHistoryList').allInnerTexts().then(items=>items.join('\n')),/melhorou|piorou|melhora clínica|piora clínica|diagnóstico confirmado/i);
  await captureTiles(page,`${label}-hero`,page.locator('.ltsLabsHero'));
  await captureTiles(page,`${label}-trend`,page.locator('.ltsLabsTrend'));
  await captureTiles(page,`${label}-history`,page.locator('.ltsLabsHistory'));
  if(scene.cohorts){
    const options=await page.locator('#productLabCohort option').evaluateAll(items=>items.map(item=>item.value));assert.equal(options.length,scene.cohorts);
    for(const option of options){await page.locator('#productLabCohort').selectOption(option);await stable(page,'saude');assert.equal(await page.locator('.ltsLabsChart svg circle').count(),1);assert.equal(await page.locator('.ltsLabsChart path.ltsDepthLine').count(),0);assert.doesNotMatch(await page.locator('.ltsHistoryContext').innerText(),/\d{2}\/\d{2}\/\d{4}\s*→/);}
  }
  const card=page.locator(`.ltsLabValueCard[data-lab-marker="${markerKey(scene.marker)}"]`);
  if(await card.count()){
    await page.locator('#productLabCollection').selectOption(scene.current.collection_date);await stable(page,'saude');
    await literal(page,card.locator('strong'),expectedOriginal,`${label}-collection-original`);
    assert.equal(await card.locator('.ltsLabReferencePosition').count(),scene.exact?1:0,'Collection position uses the same exactness boundary');
    await captureTiles(page,`${label}-collection`,card);
  }
}

async function security(page,fixture,traffic,width){
  const proof=await page.evaluate(()=>{
    const {state,fixtureMode}=window.__languageApp,client=window.supabase.createClient('synthetic','synthetic'),guards=[];
    for(const run of [()=>client.from('synthetic').insert({}),()=>client.from('synthetic').update({}),()=>client.from('synthetic').upsert({}),()=>client.from('synthetic').delete(),()=>client.rpc('synthetic'),()=>client.functions.invoke('synthetic'),()=>client.storage.from('synthetic').upload('synthetic',new Blob(['synthetic'])),()=>client.storage.from('synthetic').remove(['synthetic'])]){
      try{run();guards.push(false);}catch(error){guards.push(error.code==='preview_read_only');}
    }
    return {fixtureMode,readonly:Boolean(window.LTSPreviewReadOnly),user:state.session?.user?.id,reads:window.__historyQA.reads,writes:window.__historyQA.writes,guards,db:window.__historyDb};
  });
  assert.equal(proof.fixtureMode,false);assert.equal(proof.readonly,true);assert.equal(proof.user,'synthetic-history-browser-user');assert.ok(proof.guards.every(Boolean));
  const reads=proof.reads.filter(read=>read.table==='health_lab_results');assert.ok(reads.length>0);
  for(const read of reads){
    const fields=read.projection.split(',').map(value=>value.trim());
    assert.ok(fields.includes('id'),'The production loader projects the exact bound database id');
    assert.ok(fields.includes('numeric_reading_verification:source_payload->numeric_reading_verification'),'The production loader explicitly projects documentary numeric proof');
    assert.ok(fields.includes('numeric_kind:source_payload->>numeric_kind'));
    assert.ok(!fields.includes('*')&&!fields.includes('source_payload'),'Never broaden the read to an entire source payload');
  }
  assert.deepEqual(proof.db,fixture.db,'No original raw, numeric, reference or proof record is rewritten');
  assert.deepEqual(proof.writes,[]);assert.deepEqual(traffic.writes,[]);assert.deepEqual(traffic.external,[]);assert.deepEqual(traffic.errors,[]);
  projectionEvidence.push({width,reads,guardsChecked:proof.guards.length,writeCount:0,externalRequestCount:0,originalRecordsUnchanged:true});save();
}

async function recordFailure(page,name,error,traffic){
  const diagnostic=await page.evaluate(()=>({route:window.__languageApp?.state.route,status:window.__languageApp?.state.domainStatus,reads:window.__historyQA?.reads,visibleText:document.querySelector('#screenHost')?.innerText})).catch(()=>null);
  writeFileSync(`${dir}/${name}-failure-diagnostic.json`,JSON.stringify({...flags,message:String(error.message),diagnostic,traffic},null,2));
  await page.screenshot({path:`${dir}/${name}-failure.png`,animations:'disabled',scale:'css'}).catch(()=>{});
  failures.push({name,message:String(error.message)});results.push({name,status:'failed',...flags});save();
}

const browser=await chromium.launch({headless:true});
try{
  for(const [width,height] of sizes){
    const fixture=makeFixture(),traffic={external:[],writes:[],errors:[]};
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<=840,hasTouch:width<=840,locale:'pt-BR',timezoneId:'America/Sao_Paulo',serviceWorkers:'block'});
    await context.route('**/*',route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.protocol==='https:'&&url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2'&&request.method()==='GET')return route.fulfill({status:200,contentType:'application/javascript',body:documentaryService(fixture.db)});
      if(url.origin===origin.origin&&['GET','HEAD'].includes(request.method())&&(url.pathname.startsWith(origin.pathname)||url.pathname==='/favicon.ico'))return route.continue();
      if(!['GET','HEAD'].includes(request.method()))traffic.writes.push({url:request.url(),method:request.method()});else traffic.external.push(request.url());
      return route.abort('blockedbyclient');
    });
    const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',error=>traffic.errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('net::ERR_BLOCKED_BY_CLIENT'))traffic.errors.push(message.text());});
    await page.clock.setFixedTime(new Date(`${LANGUAGE_TODAY}T15:00:00Z`));
    try{
      await page.goto(`${base}#hoje`);await stable(page,'hoje');
      assert.equal(await page.locator('[data-dashboard-card]').count(),7,'The approved dashboard shell stays intact');
      await verifyReadings(page,fixture,width);
      for(const scene of fixture.scenes){
        const label=`${width}-${scene.key}`,before=failures.length;
        try{
          if((await page.evaluate(()=>window.__languageApp.state.route))!=='hoje')await navigate(page,'hoje',width);
          await page.locator('#dashboard-period').selectOption('all');await stable(page,'hoje');
          for(const name of ['dashboard-other-labs','dashboard-historical-labs']){
            const details=page.locator(`[data-disclosure="${name}"]`);if(await details.count()&&!(await details.evaluate(el=>el.open)))await details.locator(':scope > summary').click();
          }
          await homeScene(page,scene,label);await healthScene(page,scene,label);
          results.push({name:label,width,height,kind:scene.kind,exact:scene.exact,comparable:scene.comparable,expectedPoints:scene.expectedPoints,rawPreserved:true,status:failures.length===before?'passed':'failed',...flags});save();
        }catch(error){await recordFailure(page,label,error,traffic);}
      }
      await security(page,fixture,traffic,width);
      results.push({name:`${width}-production-loader-and-readonly`,status:'passed',...flags});save();
    }catch(error){await recordFailure(page,`${width}-startup-or-security`,error,traffic);}
    finally{await context.close();save();}
  }
}finally{save();await browser.close();}
assert.equal(failures.length,0,`Documentary numeric reading: ${failures.length} failures; inspect ${dir}/results.json and native-resolution viewport tiles.`);
assert.ok(sizes.every(([width])=>captures.some(capture=>capture.viewport.width===width)),'All four widths produce visible original-resolution evidence');
console.log('Documentary numeric reading: real loader projection, original raw in Home/Exames/history, exact documentary values, rejected missing/bad/swapped/censored proof, independent method/reference boundaries, four viewport widths, clipping/overflow checks and zero writes. Entirely synthetic; no real authenticated QA.');

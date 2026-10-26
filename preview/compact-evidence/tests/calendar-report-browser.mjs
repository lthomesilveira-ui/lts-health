import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {chromium,webkit} from 'playwright';
import {visibleTextGeometry} from './consumer-language-geometry.mjs';
import {consumerRouteSettled} from './consumer-language-readiness.mjs';
import {makeCalendarReportFixture,calendarReportService,expectedCalendarMetric,CALENDAR_TODAY,CALENDAR_KEYS,CALENDAR_WINDOWS,CALENDAR_DATES,CALENDAR_INJECTION} from './calendar-report-fixture.mjs';

// CI-only, using the approved loopback server. The application, navigation,
// loader, report model, renderer and print stylesheet are real. The identity,
// SDK responses and window.print dialog are synthetic. Chromium page.pdf is
// real A4 output; WebKit is engine coverage, never a physical iPhone/Safari test.
// Do not launch this locally or start a server to bypass an execution denial.
assert.ok(process.env.CI,'This acceptance suite may run only in the approved CI workflow');
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/preview/compact-evidence/';
const origin=new URL(base);
assert.equal(origin.protocol,'http:');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(origin.hostname));
assert.ok(origin.pathname.endsWith('/preview/compact-evidence/'));
assert.equal(origin.search,'');assert.equal(origin.hash,'');
const dir=process.env.LTS_CALENDAR_REPORT_EVIDENCE_DIR||'calendar-report-visual';mkdirSync(dir,{recursive:true});
const sizes=[[320,740],[393,844],[1440,900]],results=[],captures=[],failures=[],pdfs=[],securityEvidence=[];
const flags={syntheticOnly:true,realDocumentsUsed:false,authenticatedWithRealAccount:false,physicalSafariOrIPhoneTested:false};
const dateLabel=date=>date.split('-').reverse().join('/');
const normalized=value=>String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const tokenCounts=value=>{const result=new Map();for(const token of normalized(value).match(/[\p{L}\p{N}]+/gu)||[])result.set(token,(result.get(token)||0)+1);return result;};
const save=()=>writeFileSync(`${dir}/results.json`,JSON.stringify({...flags,fixedDate:CALENDAR_TODAY,productionStartup:true,deepLink:'analise',engines:['chromium','webkit'],viewportWidths:sizes.map(([width])=>width),deviceScaleFactor:1,results,captures,pdfs,securityEvidence,failures},null,2));

async function installProbe(page){
  await page.evaluate(async()=>{
    if(window.__languageApp)return;
    const {state,fixtureMode}=await import('./src/core.js'),{isRouteReady}=await import('./src/data-layer.js');
    const imports=JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports;
    const actual=await import(new URL(imports['./src/core.js'],document.baseURI).href);
    if(actual.state!==state)throw new Error('QA must inspect the production core instance');
    const {calendarReport}=await import('./src/calendar-report-model.js');
    window.__languageApp={state,fixtureMode,isRouteReady,calendarReport};
  });
}
async function stable(page){
  await installProbe(page);
  await page.evaluate(()=>{window.__languageStableRoot=null;window.__languageFrames=0;});
  assert.equal(await (await page.waitForFunction(consumerRouteSettled,{route:'analise',selector:'#calendarReport'})).jsonValue(),true);
  // The compatibility controller polls every 250 ms after startup. Three RAFs
  // can precede its last ready-data redraw, which would reset a tile's scroll.
  // Observe an unchanged report node and geometry beyond one controller cycle;
  // retain all subsequent no-gap, clipping and incremental-coverage assertions.
  await page.evaluate(()=>{window.__calendarSettledGeometry=null;});
  await page.waitForFunction(()=>{
    const root=document.querySelector('#calendarReport');if(!root)return false;
    const box=root.getBoundingClientRect(),signature=[box.top,box.left,box.width,box.height,scrollY].join('|');
    const previous=window.__calendarSettledGeometry;
    if(!previous||previous.root!==root||previous.signature!==signature){window.__calendarSettledGeometry={root,signature,since:performance.now()};return false;}
    return performance.now()-previous.since>=350;
  });
}
async function report(page){return page.evaluate(today=>{const {state,calendarReport}=window.__languageApp;return calendarReport(state.data,state.domainStatus,state.ui,today);},CALENDAR_TODAY);}
async function choose(page,{mode='week',selection='last',date}={}){
  await page.locator(`#calendar-mode-${mode}`).click();await stable(page);
  await page.locator('#calendar-selection').selectOption(selection);await stable(page);
  if(selection==='date'){
    const input=page.locator('#calendar-date'),type=await input.getAttribute('type');
    await input.fill(type==='month'?date.slice(0,7):date);await input.dispatchEvent('change');await stable(page);
  }
}
async function assertWindow(page,fixture,expected,{partial=false,nominalEnd=expected.end}={}){
  const m=await report(page),body=await page.locator('#calendarReport').innerText();
  assert.equal(m.calendar.bounds.start,expected.start);assert.equal(m.calendar.bounds.end,expected.end);assert.equal(m.calendar.bounds.days,expected.days);
  assert.equal(m.calendar.partial,partial);assert.equal(m.calendar.nominalBounds.end,nominalEnd);
  assert.ok(body.includes(dateLabel(expected.start))&&body.includes(dateLabel(expected.end)),'Visible report states its actual dates');
  assert.equal(await page.locator('#calendarReport .ltsCalendarMetric[data-calendar-metric]').count(),8);
  for(const key of CALENDAR_KEYS){
    const expectedMetric=expectedCalendarMetric(fixture,key,expected),metric=m.metricsByKey[key],card=page.locator(`#calendarReport [data-calendar-metric="${key}"]`);
    assert.equal(metric.count,expectedMetric.count,`${key}: only eligible observed days count`);
    assert.equal(metric.expectedDays,expected.days-(expected.end===CALENDAR_TODAY?1:0),`${key}: coverage denominator includes only elapsed closed days`);
    if(expectedMetric.value==null)assert.equal(metric.value,null);else assert.ok(Math.abs(metric.value-expectedMetric.value)<1e-9,`${key}: independent arithmetic oracle`);
    assert.ok(metric.points.every(point=>point.date<=expected.end),'No point after the selected period');
    assert.ok(metric.points.filter(point=>point.eligible).every(point=>point.date<CALENDAR_TODAY),'Today is never part of a closed-day mean');
    assert.deepEqual(await card.locator('[data-calendar-plot-date]').evaluateAll(nodes=>nodes.map(node=>node.dataset.calendarPlotDate).sort()),expectedMetric.dates,`${key}: chart includes exact eligible dates, gaps stay gaps and zero stays a point`);
    const coverage=await card.locator('.ltsCalendarCoverage').innerText();
    assert.equal(coverage,`${expectedMetric.count}/${metric.expectedDays} dias encerrados com valor`,`${key}: exact visible recorded-day coverage`);
    const value=expectedMetric.value==null?'Sem dado':`${expectedMetric.value.toLocaleString('pt-BR',{maximumFractionDigits:0})} ${metric.unit}`;
    assert.equal(await card.locator('.ltsCalendarMetricValue').innerText(),value,`${key}: the independently calculated observed mean is visible`);
    assert.ok((await card.locator('.ltsCalendarSource').innerText()).trim(),`${key}: visible source`);
    assert.ok((await card.locator('.ltsCalendarComparison').innerText()).trim(),`${key}: visible comparison or explanation`);
  }
  assert.doesNotMatch(body,/\b(?:NaN|undefined|Infinity|SQLSTATE|source_record_id|canonical_status|payload)\b/);
  assert.doesNotMatch(body,/MARCADOR FUTURO NÃO DEVE APARECER|EVENTO FUTURO NÃO DEVE APARECER|987\.654|987654/);
  assert.equal(await page.evaluate(()=>globalThis.__calendarInjection),undefined);
  return m;
}
async function openEvidence(page){
  for(const detail of await page.locator('#calendarReport details').all())if(!(await detail.evaluate(el=>el.open)))await detail.locator(':scope > summary').click();
  await stable(page);
}
async function controls(page,name){
  const undersized=await page.locator('#calendarReport').evaluate(root=>[...root.querySelectorAll('button,select,input,summary')].filter(el=>!el.disabled&&el.checkVisibility({checkVisibilityCSS:true})).flatMap(el=>{const r=el.getBoundingClientRect();return r.width>=43.5&&r.height>=43.5?[]:[{tag:el.tagName,id:el.id,width:r.width,height:r.height}];}));
  assert.deepEqual(undersized,[],`${name}: report controls provide 44 × 44 CSS-pixel targets`);
}
async function sourceControls(page,fixture,name){
  const original=await report(page),sourceA=original.metricsByKey.water.source.key,sourceB=original.metricsByKey.water.sources.find(source=>source.label==='Synthetic B food').key;
  const legacy=await page.evaluate(()=>{const ui=window.__languageApp.state.ui;return Object.fromEntries(['dashboardSources','dashboardMode','dashboardPeriod','homeNutritionSource','homeWaterSource','reportNutritionSource','analysisPeriod','nutritionPlanRetrospective'].map(key=>[key,ui[key]??null]));});
  await page.locator('#calendar-source-water').selectOption(sourceB);await stable(page);
  let selected=await report(page);assert.equal(selected.metricsByKey.water.source.key,sourceB);assert.equal(selected.metricsByKey.water.value,expectedCalendarMetric(fixture,'water',CALENDAR_WINDOWS.lastWeek,'B').value);
  assert.equal(selected.metricsByKey.protein.value,original.metricsByKey.protein.value,'Selecting water never changes the protein origin');
  await choose(page,{mode:'month'});selected=await report(page);
  assert.equal(selected.metricsByKey.water.source.key,sourceB,'An explicit origin is preserved across calendar modes');
  assert.equal(selected.metricsByKey.water.value,expectedCalendarMetric(fixture,'water',CALENDAR_WINDOWS.lastMonth,'B').value,'Separate origins are never pooled');
  await choose(page,{mode:'week'});await openEvidence(page);
  for(const status of ['candidate','held']){
    const source=original.metricsByKey.water.sources.find(item=>item.status===status);assert.ok(source);
    await page.locator('#calendar-source-water').selectOption(source.key);await stable(page);
    const card=page.locator('#calendarReport [data-calendar-metric="water"]'),text=await card.innerText();
    assert.equal((await report(page)).metricsByKey.water.source.status,status);
    assert.match(text,status==='candidate'?/registro adicional/i:/limitações/i);
    assert.doesNotMatch(text,/\b(?:candidate|held|canonical|sourceMetrics)\b/,'Internal status names never become consumer-facing labels');
    await captureTiles(page,`${name}-source-${status}`,card);
  }
  await page.locator('#calendar-source-water').selectOption(sourceA);await stable(page);
  assert.deepEqual(await page.evaluate(()=>{const ui=window.__languageApp.state.ui;return Object.fromEntries(['dashboardSources','dashboardMode','dashboardPeriod','homeNutritionSource','homeWaterSource','reportNutritionSource','analysisPeriod','nutritionPlanRetrospective'].map(key=>[key,ui[key]??null]));}),legacy,'Report controls never change the approved dashboard or rolling-report selections');
  await assertWindow(page,fixture,CALENDAR_WINDOWS.lastWeek);
}

// The existing documentary-reading detector is retained below. It compares
// actual Range ink and separately fails hidden/clip boundaries; clipping text
// out of the overflow calculation never makes a broken layout pass.
async function layout(page,name,target,{expectedIssues=null}={}){
  const report=await target.evaluate(el=>{
    const root=document.querySelector('body.ltsCalendarPrinting #calendarPrintRoot')||document.querySelector('#calendarReport'),host=root;
    const rawText=[],hardClippedText=[],walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node,nodeId=0;
    const box=r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom});
    while(node=walker.nextNode()){
      nodeId++;const parent=node.parentElement;
      if(!node.textContent.trim()||!parent||parent.closest('svg,select,option,script,style')||!parent.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}))continue;
      const clips=[],hardClips=[],scrollClips=[];
      for(let p=parent;p;p=p.parentElement){
        const css=getComputedStyle(p),x=/^(hidden|clip|scroll|auto)$/.test(css.overflowX),y=/^(hidden|clip|scroll|auto)$/.test(css.overflowY);
        if((!x&&!y)||['inline','contents'].includes(css.display))continue;
        // Root overflow is propagated to the viewport. The HTML element's
        // https://www.w3.org/TR/css-overflow-3/#overflow-propagation
        // bounding box moves with window scroll; it is not a moving hard clip.
        // CI1's tile 2 visibly painted below y=44, whereas the old arithmetic
        // (-1079 + 1123) incorrectly declared all that visible ink clipped.
        // Root scroll edges are covered by adjacent tiles. Real descendants
        // with hidden/clip retain the unchanged hard-boundary check below.
        if(p===document.documentElement){
          // Horizontal viewport escape remains an error, including negative
          // left overflow that need not increase document.scrollWidth.
          const viewportClip={x:false,y,left:0,right:innerWidth,top:0,bottom:innerHeight,rootViewport:true,declaredOverflowX:x};
          clips.push(viewportClip);scrollClips.push(viewportClip);continue;
        }
        const b=p.getBoundingClientRect(),left=b.left+p.clientLeft,top=b.top+p.clientTop;
        const clip={x,y,left,right:left+p.clientWidth,top,bottom:top+p.clientHeight,tag:p.tagName,id:p.id};clips.push(clip);
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
      if(p===document.documentElement)continue; // The viewport is initialized above.
      const css=getComputedStyle(p),b=p.getBoundingClientRect();
      if(/^(hidden|clip|scroll|auto)$/.test(css.overflowY)){visibleTop=Math.max(visibleTop,b.top+p.clientTop);visibleBottom=Math.min(visibleBottom,b.top+p.clientTop+p.clientHeight);}
      if(/^(hidden|clip|scroll|auto)$/.test(css.overflowX)){visibleLeft=Math.max(visibleLeft,b.left+p.clientLeft);visibleRight=Math.min(visibleRight,b.left+p.clientLeft+p.clientWidth);}
    }
    const targetBox=el.getBoundingClientRect(),targetText=[],chromeOccluders=[];
    for(const chrome of document.querySelectorAll('.topbar,#primaryNav,#mobileNav')){
      if(!chrome.checkVisibility({checkVisibilityCSS:true,checkOpacity:true})||!['fixed','sticky'].includes(getComputedStyle(chrome).position))continue;
      const b=chrome.getBoundingClientRect();
      if(b.width<=0||b.height<=0||b.right<=targetBox.left||b.left>=targetBox.right)continue;
      chromeOccluders.push({tag:chrome.tagName,id:chrome.id,className:chrome.className,...box(b)});
      if(b.top<=visibleTop+1&&b.bottom>visibleTop)visibleTop=Math.min(visibleBottom,b.bottom);
      if(b.bottom>=visibleBottom-1&&b.top<visibleBottom)visibleBottom=Math.max(visibleTop,b.top);
    }
    const targetWalker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    while(node=targetWalker.nextNode()){
      if(!node.textContent.trim()||!node.parentElement.checkVisibility({checkVisibilityCSS:true,checkOpacity:true})||node.parentElement.closest('select,option,svg,script,style'))continue;
      const range=document.createRange();range.selectNodeContents(node);
      if([...range.getClientRects()].some(r=>r.width>0&&r.height>0&&r.top>=visibleTop-1&&r.bottom<=visibleBottom+1&&r.right>visibleLeft&&r.left<visibleRight))targetText.push(node.textContent.trim());
    }
    const overflowElements=[root,...root.querySelectorAll('*')].filter(element=>element.clientWidth>0&&element.scrollWidth>element.clientWidth+1&&element.checkVisibility({checkVisibilityCSS:true})).map(element=>({tag:element.tagName,id:element.id,className:typeof element.className==='string'?element.className:'',clientWidth:element.clientWidth,scrollWidth:element.scrollWidth,overflowX:getComputedStyle(element).overflowX,box:box(element.getBoundingClientRect())}));
    return {viewport:{width:innerWidth,height:innerHeight},windowScroll:{x:scrollX,y:scrollY},rootOverflow:{x:getComputedStyle(document.documentElement).overflowX,y:getComputedStyle(document.documentElement).overflowY},overflowElements,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,
      hostWidth:host.clientWidth,hostScrollWidth:host.scrollWidth,rootWidth:root.clientWidth,rootScrollWidth:root.scrollWidth,
      target:{box:box(targetBox),height:targetBox.height,visibleTop,visibleBottom,chromeOccluders,coveredStart:Math.max(0,visibleTop-targetBox.top),coveredEnd:Math.min(targetBox.height,visibleBottom-targetBox.top),text:targetText.join(' ')},rawText,hardClippedText};
  });
  Object.assign(report,visibleTextGeometry(report.rawText,report.viewport.width));
  writeFileSync(`${dir}/${name}-layout.json`,JSON.stringify({...flags,...report},null,2));
  const issues=[];
  if(report.documentWidth>report.viewport.width+1||report.bodyWidth>report.viewport.width+1||report.hostScrollWidth>report.hostWidth+1||report.rootScrollWidth>report.rootWidth+1)issues.push('horizontal overflow');
  if(report.overflowingText.length)issues.push('painted text outside viewport');
  if(report.overlaps.length)issues.push('overlapping painted text');
  if(report.hardClippedText.length)issues.push('text actually cut by hidden/clip bounds');
  if(!report.target.text.trim()||report.target.coveredEnd<=report.target.coveredStart)issues.push('empty or offscreen target tile');
  if(expectedIssues!==null)assert.deepEqual(issues,expectedIssues,`${name}: detector control must have exactly the expected findings`);
  else if(issues.length)failures.push({name,category:'layout',issues,evidence:`${name}-layout.json`});
  return {...report,issues};
}

async function verifyViewportClippingDetector(browser,engine){
  const page=await browser.newPage({viewport:{width:320,height:740},deviceScaleFactor:1});
  try{
    await page.setContent('<!doctype html><html><head><style>html{height:100%;overflow:hidden}body{margin:0}#calendarReport{position:relative;width:320px;height:2200px;font:16px/20px Arial}#rootControlText{position:absolute;left:12px;top:850px;width:270px;margin:0}</style></head><body><div id="calendarReport"><p id="rootControlText">Visible synthetic viewport text</p></div></body></html>');
    await page.evaluate(()=>window.scrollTo(0,600));assert.equal(await page.evaluate(()=>scrollY),600);
    let name=`${engine}-detector-root-viewport`;
    const root=await layout(page,name,page.locator('#rootControlText'),{expectedIssues:[]});
    assert.ok(root.target.box.top>140&&root.target.box.bottom<740,'The root-control ink is below the old false clip and inside the real viewport');
    assert.equal(root.hardClippedText.length,0);assert.ok(root.target.text.includes('Visible synthetic viewport text'));
    await page.screenshot({path:`${dir}/${name}.png`,scale:'css'});
    await page.evaluate(()=>{document.querySelector('#calendarReport').innerHTML='<div id="hardClipControl" style="position:absolute;left:12px;top:850px;width:100px;height:24px;overflow:hidden"><span style="position:absolute;left:80px;top:2px;white-space:nowrap">CLIPPED SYNTHETIC TEXT</span></div>';});
    name=`${engine}-detector-descendant-hidden`;
    const hidden=await layout(page,name,page.locator('#hardClipControl'),{expectedIssues:['text actually cut by hidden/clip bounds']});
    assert.ok(hidden.hardClippedText.some(item=>item.clip.tag==='DIV'&&item.clip.id==='hardClipControl'),'An actual descendant div with overflow:hidden remains a hard failure');
    await page.screenshot({path:`${dir}/${name}.png`,scale:'css'});
    await page.evaluate(()=>{document.querySelector('#calendarReport').innerHTML='<p id="overflowControl" style="position:absolute;left:280px;top:850px;width:160px;white-space:nowrap;margin:0">OVERFLOW SYNTHETIC</p>';});
    name=`${engine}-detector-horizontal-overflow`;
    const overflow=await layout(page,name,page.locator('#overflowControl'),{expectedIssues:['horizontal overflow','painted text outside viewport']});
    assert.ok(overflow.documentWidth>overflow.viewport.width||overflow.rootScrollWidth>overflow.rootWidth,'Viewport propagation never suppresses the independent horizontal-overflow failure');
    await page.screenshot({path:`${dir}/${name}.png`,scale:'css'});
    await page.evaluate(()=>{document.querySelector('#overflowControl').style.left='-20px';});
    name=`${engine}-detector-negative-overflow`;
    const negative=await layout(page,name,page.locator('#overflowControl'),{expectedIssues:['painted text outside viewport']});
    assert.ok(negative.overflowingText.some(item=>item.left<0),'Left-side text escape fails even when document width is unchanged');
    await page.screenshot({path:`${dir}/${name}.png`,scale:'css'});
    results.push({name:`${engine}-clipping-detector-controls`,status:'passed',rootViewportAccepted:true,descendantHiddenRejected:true,horizontalOverflowRejected:true,negativeLeftTextRejected:true,...flags});save();
  }finally{await page.close();}
}

async function captureTiles(page,name,target){
  assert.equal(await target.count(),1);assert.equal(await target.isVisible(),true);
  let offset=0,covered=0,index=0,finished=false;
  while(!finished){
    assert.ok(index<100,'A target must remain reachable through its real scroll container');
    await target.evaluate((el,offset)=>{
      el.scrollIntoView({block:'start',inline:'nearest',behavior:'instant'});
      let visibleTop=0,visibleBottom=innerHeight;
      for(let p=el.parentElement;p;p=p.parentElement){
        if(p===document.documentElement)continue; // Root overflow clips at the fixed viewport.
        if(!/^(hidden|clip|scroll|auto)$/.test(getComputedStyle(p).overflowY))continue;
        const b=p.getBoundingClientRect();visibleTop=Math.max(visibleTop,b.top+p.clientTop);visibleBottom=Math.min(visibleBottom,b.top+p.clientTop+p.clientHeight);
      }
      const targetBox=el.getBoundingClientRect();
      for(const chrome of document.querySelectorAll('.topbar,#primaryNav,#mobileNav')){
        if(!chrome.checkVisibility({checkVisibilityCSS:true,checkOpacity:true})||!['fixed','sticky'].includes(getComputedStyle(chrome).position))continue;
        const b=chrome.getBoundingClientRect();
        if(b.width<=0||b.height<=0||b.right<=targetBox.left||b.left>=targetBox.right)continue;
        if(b.top<=visibleTop+1&&b.bottom>visibleTop)visibleTop=Math.min(visibleBottom,b.bottom);
        if(b.bottom>=visibleBottom-1&&b.top<visibleBottom)visibleBottom=Math.max(visibleTop,b.top);
      }
      const top=visibleTop+12;
      for(let p=el.parentElement;p;p=p.parentElement){
        if(p===document.documentElement)continue; // Window scrolling is handled below.
        if(/^(auto|scroll)$/.test(getComputedStyle(p).overflowY)&&p.scrollHeight>p.clientHeight){
          p.scrollTop+=el.getBoundingClientRect().top-top+offset;return;
        }
      }
      window.scrollBy({top:el.getBoundingClientRect().top-top+offset,left:0,behavior:'instant'});
    },offset);
    const tile=`${name}-tile-${++index}`;
    assert.ok(!captures.some(capture=>capture.name===tile),'Preserve every original evidence image');
    const buffer=await page.screenshot({path:`${dir}/${tile}.png`,fullPage:false,animations:'disabled',scale:'css'});
    const viewport=page.viewportSize();
    assert.equal(buffer.subarray(1,4).toString(),'PNG');assert.equal(buffer.readUInt32BE(16),viewport.width);assert.equal(buffer.readUInt32BE(20),viewport.height);
    assert.ok(buffer.length>2000,'The original-resolution capture must contain rendered content');
    const report=await layout(page,tile,target),range=report.target;
    captures.push({name:tile,viewport,originalResolution:true,bytes:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex'),coveredStart:range.coveredStart,coveredEnd:range.coveredEnd,targetHeight:range.height,visibleTop:range.visibleTop,visibleBottom:range.visibleBottom,chromeOccluders:range.chromeOccluders,visibleTargetText:range.text,...flags});
    assert.ok(range.coveredStart<=covered+1,'Viewport tiles leave no unseen vertical gap in the target');
    assert.ok(range.coveredEnd>covered,'Each tile exposes additional target content');
    covered=range.coveredEnd;finished=covered>=range.height-1;
    offset=Math.max(offset+1,covered-32);save();
  }
}

function inspectPdf(path,name,expectedText){
  const info=execFileSync('pdfinfo',[path],{encoding:'utf8'});writeFileSync(`${dir}/${name}-pdfinfo.txt`,info);
  const pageCount=Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);assert.ok(pageCount>0,'A real PDF must contain pages');
  const bbox=`${dir}/${name}-bbox.html`,plain=`${dir}/${name}-text.txt`;
  execFileSync('pdftotext',['-bbox-layout',path,bbox]);execFileSync('pdftotext',['-layout',path,plain]);
  const parsed=JSON.parse(execFileSync('python3',['-c',`
import json,sys,xml.etree.ElementTree as E
root=E.parse(sys.argv[1]).getroot()
pages=[]
for p in root.iter():
 if p.tag.rsplit('}',1)[-1]!='page': continue
 words=[]
 for w in p.iter():
  if w.tag.rsplit('}',1)[-1]=='word': words.append({'text':''.join(w.itertext()),**{k:float(w.attrib[k]) for k in ['xMin','yMin','xMax','yMax']}})
 pages.append({'width':float(p.attrib['width']),'height':float(p.attrib['height']),'words':words})
print(json.dumps(pages,ensure_ascii=False))
`,bbox],{encoding:'utf8',maxBuffer:20*1024*1024}));
  assert.equal(parsed.length,pageCount);
  const issues=[];
  for(const [index,page] of parsed.entries()){
    if(Math.abs(page.width-595.28)>1||Math.abs(page.height-841.89)>1)issues.push({page:index+1,reason:'not A4',width:page.width,height:page.height});
    if(!page.words.length)issues.push({page:index+1,reason:'blank page'});
    for(const word of page.words)if(word.xMin<8||word.yMin<8||word.xMax>page.width-8||word.yMax>page.height-8||word.xMax<=word.xMin||word.yMax<=word.yMin)issues.push({page:index+1,reason:'text outside printable page or degenerate bounding box',word});
  }
  const extracted=readFileSync(plain,'utf8'),actual=tokenCounts(extracted),expected=tokenCounts(expectedText),missing=[];
  for(const [token,count] of expected)if((actual.get(token)||0)<count)missing.push({token,expected:count,actual:actual.get(token)||0});
  // All visible print text must survive PDF pagination, not only a title or
  // the first screenshot. This detects content lost in clipped scroll boxes.
  writeFileSync(`${dir}/${name}-pdf-layout.json`,JSON.stringify({...flags,pages:parsed,missingTokens:missing,issues},null,2));
  execFileSync('pdftoppm',['-png','-r','144',path,`${dir}/${name}-pdf-page`],{maxBuffer:5*1024*1024});
  const images=readdirSync(dir).filter(file=>file.startsWith(`${name}-pdf-page-`)&&file.endsWith('.png'));
  assert.equal(images.length,pageCount,'Every PDF page has a native-resolution visual artifact');
  const bytes=readFileSync(path);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  const record={name,path: `${name}.pdf`,pages:pageCount,pageImages:images,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),format:'A4',allPrintTextPreserved:missing.length===0,printableBoundsChecked:true,status:issues.length||missing.length?'failed':'passed',...flags};pdfs.push(record);save();
  assert.deepEqual(issues,[],`${name}: no blank, wrong-sized or edge-clipped PDF page`);
  assert.deepEqual(missing,[],`${name}: every visible word and recorded number survives PDF export`);
  return record;
}

async function printContract(page,name,{pdf=false,engine='chromium'}={}){
  const failureStart=failures.length;
  const original={title:await page.title(),viewport:page.viewportSize(),text:await page.locator('#calendarReport').innerText()},before=await page.evaluate(()=>window.__calendarPrintCalls.length);
  await page.locator('#calendar-export').click();
  await page.waitForSelector('body.ltsCalendarPrinting #calendarPrintRoot',{state:'attached'});
  const invocation=await page.evaluate(()=>window.__calendarPrintCalls.at(-1));
  assert.equal(await page.evaluate(()=>window.__calendarPrintCalls.length),before+1,'Exactly one print dialog invocation per click');
  assert.equal(invocation.synchronous,true,'window.print remains in the trusted click task for WebKit user-gesture compatibility');
  assert.equal(invocation.hasPrintRoot,true);assert.equal(invocation.hasPrintClass,true);
  assert.match(invocation.title,/LTS Health/i);
  assert.equal(await page.locator('#calendarPrintRoot details,#calendarPrintRoot button,#calendarPrintRoot select,#calendarPrintRoot input').count(),0,'PDF is expanded and has no interactive-only controls');
  await page.setViewportSize({width:794,height:1123});await page.emulateMedia({media:'print'});
  await page.evaluate(()=>document.fonts.ready);
  const printText=await page.locator('#calendarPrintRoot').evaluate(root=>{
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),parts=[];let node;
    while(node=walker.nextNode())if(node.textContent.trim()&&node.parentElement.checkVisibility({checkVisibilityCSS:true,checkOpacity:true})&&!node.parentElement.closest('script,style,svg'))parts.push(node.textContent.trim());
    return parts.join(' ');
  });
  assert.ok(printText.length>500,'The print root contains the full report');
  assert.doesNotMatch(printText,/\b(?:NaN|undefined|Infinity|SQLSTATE|source_record_id|canonical_status)\b/);
  for(const key of CALENDAR_KEYS){assert.equal(await page.locator(`#calendarPrintRoot [data-calendar-metric="${key}"]`).count(),1);assert.ok(await page.locator(`#calendarPrintRoot [data-calendar-evidence="${key}"]`).count(),'All daily evidence is present in print');}
  writeFileSync(`${dir}/${name}-print-dom.txt`,printText);
  // A capture failure is still a test failure, but must not prevent creating
  // the real PDF and every page image needed to diagnose print pagination.
  try{await captureTiles(page,`${name}-print`,page.locator('#calendarPrintRoot'));}
  catch(error){await recordFailure(page,`${name}-print-capture`,error,{});}
  if(pdf){
    assert.equal(engine,'chromium','Only Chromium produces page.pdf');
    const path=`${dir}/${name}.pdf`;
    try{
      await page.pdf({path,format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
      inspectPdf(path,name,printText);
    }catch(error){await recordFailure(page,`${name}-pdf`,error,{});}
  }
  // Native afterprint is also fired by Chromium printToPDF. The explicit event
  // covers the intercepted-dialog/WebKit path and idempotent cleanup.
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  assert.equal(await page.locator('#calendarPrintRoot').count(),0);assert.equal(await page.locator('body.ltsCalendarPrinting').count(),0);
  assert.equal(await page.title(),original.title,'afterprint restores the original app title');
  await page.emulateMedia({media:'screen'});await page.setViewportSize(original.viewport);await stable(page);
  assert.equal(await page.locator('#calendarReport').innerText(),original.text,'Print cleanup preserves the selected report and data');
  results.push({name,engine,status:failures.length===failureStart?'passed':'failed',localPrintInvocations:1,synchronousGesture:true,restoredAfterPrint:true,pdfRequested:pdf,realPdf:pdfs.some(item=>item.name===name),...flags});save();
}

async function printFailure(page,name){
  const title=await page.title();await page.evaluate(()=>{window.__calendarPrintMode='throw';});
  await page.locator('#calendar-export').click();
  await page.waitForFunction(()=>!document.querySelector('#calendarPrintRoot')&&!document.body.classList.contains('ltsCalendarPrinting'));
  assert.equal(await page.title(),title,'A thrown print call restores the page title');
  const message=await page.locator('#calendarReportStatus').innerText();assert.match(message,/(?:não foi possível|não (?:abriu|conseguiu)|tente|indisponível)/i);
  assert.doesNotMatch(message,/Synthetic|stack|Error:/);
  await page.evaluate(()=>{window.__calendarPrintMode='normal';});
  results.push({name,status:'passed',restoredAfterPrintFailure:true,...flags});save();
}

async function security(page,fixture,traffic,name){
  const proof=await page.evaluate(()=>{
    const {state,fixtureMode}=window.__languageApp,client=window.supabase.createClient('synthetic','synthetic'),guards=[];
    for(const run of [()=>client.from('synthetic').insert({}),()=>client.from('synthetic').update({}),()=>client.from('synthetic').upsert({}),()=>client.from('synthetic').delete(),()=>client.rpc('synthetic'),()=>client.functions.invoke('synthetic'),()=>client.storage.from('synthetic').upload('synthetic',new Blob(['synthetic'])),()=>client.storage.from('synthetic').remove(['synthetic'])]){try{run();guards.push(false);}catch(error){guards.push(error.code==='preview_read_only');}}
    return {fixtureMode,readonly:Boolean(window.LTSPreviewReadOnly),user:state.session?.user?.id,reads:window.__historyQA.reads,writes:window.__historyQA.writes,guards,db:window.__historyDb,status:state.domainStatus};
  });
  assert.equal(proof.fixtureMode,false);assert.equal(proof.readonly,true);assert.equal(proof.user,'synthetic-history-browser-user');assert.ok(proof.guards.every(Boolean));
  assert.ok(proof.reads.some(read=>read.table==='health_documents'&&read.projection.includes('nutrition_plan:')),'Direct #analise startup loads the documented nutrition plan');
  assert.deepEqual(proof.db,fixture.db,'Changing periods and exporting never rewrites source records');
  assert.deepEqual(proof.writes,[]);assert.deepEqual(traffic.writes,[]);assert.deepEqual(traffic.external,[]);assert.deepEqual(traffic.errors,[]);
  securityEvidence.push({name,reads:proof.reads,guardsChecked:proof.guards.length,status:proof.status,writeCount:0,externalRequestCount:0,sourceRecordsUnchanged:true});save();
}
async function recordFailure(page,name,error,traffic){
  const diagnostic=await page.evaluate(()=>({route:window.__languageApp?.state.route,ui:window.__languageApp?.state.ui,status:window.__languageApp?.state.domainStatus,reads:window.__historyQA?.reads,visibleText:document.querySelector('#calendarReport')?.innerText,printText:document.querySelector('#calendarPrintRoot')?.innerText})).catch(()=>null);
  writeFileSync(`${dir}/${name}-failure.json`,JSON.stringify({...flags,message:String(error.message),stack:String(error.stack),diagnostic,traffic},null,2));
  await page.screenshot({path:`${dir}/${name}-failure.png`,animations:'disabled',scale:'css'}).catch(()=>{});
  failures.push({name,message:String(error.message)});results.push({name,status:'failed',...flags});save();
}
async function session(browser,engine,width,height,fixture,run,{failTable}={}){
  const name=`${engine}-${width}-${fixture.kind}${failTable?'-plan-error':''}`,traffic={external:[],writes:[],errors:[]};
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<=840,hasTouch:width<=840,locale:'pt-BR',timezoneId:'America/Sao_Paulo',serviceWorkers:'block'});
  await context.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.protocol==='https:'&&url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2'&&request.method()==='GET')return route.fulfill({status:200,contentType:'application/javascript',body:calendarReportService(fixture,failTable?{failTable}:{})});
    if(url.origin===origin.origin&&['GET','HEAD'].includes(request.method())&&(url.pathname.startsWith(origin.pathname)||url.pathname==='/favicon.ico'))return route.continue();
    if(!['GET','HEAD'].includes(request.method()))traffic.writes.push({url:request.url(),method:request.method()});else traffic.external.push(request.url());return route.abort('blockedbyclient');
  });
  await context.addInitScript(()=>{
    window.__calendarPrintCalls=[];window.__calendarPrintMode='normal';window.__calendarClickActive=false;
    document.addEventListener('click',event=>{
      if(!event.target.closest?.('[data-calendar-print]'))return;
      // A microtask can run between capture and bubble listeners. Clear at
      // the next task, so a normal synchronous delegated click is not rejected.
      window.__calendarClickActive=event.isTrusted;setTimeout(()=>{window.__calendarClickActive=false;},0);
    },true);
    window.print=()=>{
      window.__calendarPrintCalls.push({synchronous:window.__calendarClickActive,hasPrintRoot:Boolean(document.querySelector('#calendarPrintRoot')),hasPrintClass:document.body.classList.contains('ltsCalendarPrinting'),title:document.title});
      if(window.__calendarPrintMode==='throw')throw new Error('Synthetic print dialog failure');
    };
  });
  const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',error=>traffic.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('net::ERR_BLOCKED_BY_CLIENT'))traffic.errors.push(message.text());});
  await page.clock.setFixedTime(new Date(`${CALENDAR_TODAY}T15:00:00Z`));
  try{
    await page.goto(`${base}#analise`);await stable(page);await run(page,name);
    await security(page,fixture,traffic,name);results.push({name,engine,width,height,status:'passed',...flags});save();
  }catch(error){await recordFailure(page,name,error,traffic);}
  finally{await context.close();save();}
}

save();
for(const command of ['pdfinfo','pdftotext','pdftoppm'])execFileSync(command,['-v'],{stdio:'pipe'});
for(const [engine,browserType] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await browserType.launch({headless:true});
  try{
    try{await verifyViewportClippingDetector(browser,engine);}
    catch(error){failures.push({name:`${engine}-clipping-detector-controls`,message:String(error.message)});results.push({name:`${engine}-clipping-detector-controls`,status:'failed',...flags});save();}
    for(const [width,height] of engine==='chromium'?sizes:[[393,844]]){
      const fixture=makeCalendarReportFixture();
      await session(browser,engine,width,height,fixture,async(page,name)=>{
        // Keep the existing independent arithmetic/gap oracle on origin A.
        // Automatic period-aware selection is covered separately by the model regression.
        const availableOrigins=await report(page);
        for(const metric of availableOrigins.metrics){
          const desired=metric.sources.find(source=>source.label===(['water','protein','energy','carbs','fat','fiber'].includes(metric.key)?'Synthetic A food':'Synthetic A watch'));
          assert.ok(desired,`Explicit arithmetic fixture origin exists for ${metric.key}`);
          await page.locator(`#calendar-source-${metric.key}`).selectOption(desired.key);await stable(page);
        }
        const initial=await assertWindow(page,fixture,CALENDAR_WINDOWS.lastWeek);
        assert.equal(initial.training.sessions,3,'Three detailed sessions remain three, despite nine exercises and matching Polar records');
        assert.equal(initial.training.polar.sessions,3,'Three device records are separately reported');
        assert.equal(initial.metricsByKey.water.comparison.comparable,false,'Sparse, mismatched coverage cannot create a precise comparison');
        assert.ok(initial.nutritionPlan,'Direct report startup has a documented plan model');
        assert.match(await page.locator('#calendarReport .ltsCalendarContext').innerText(),/(?:plano|document)/i);
        await controls(page,name);await captureTiles(page,`${name}-last-week`,page.locator('#calendarReport'));
        await openEvidence(page);
        assert.match(await page.locator('#calendarReport .ltsCalendarTraining').innerText(),/(?:não são somad|não somad|separad)/i);
        assert.match(await page.locator('#calendarReport .ltsCalendarLabs').innerText(),/<4/,'Censored results preserve the original limit');
        assert.doesNotMatch(await page.locator('#calendarReport .ltsCalendarLabs').innerText(),/(?:<4[^\n]*(?:diferença|↑|↓))/i);
        assert.ok((await page.locator('#calendarReport .ltsCalendarContext').innerText()).includes(CALENDAR_INJECTION),'Document-like text is preserved literally');
        assert.equal(await page.locator('#calendarReport img,#calendarReport script').count(),0,'Source text never creates executable HTML');
        const water=page.locator('#calendarReport [data-calendar-evidence="water"]');
        assert.match(await water.locator(`[data-calendar-day="${CALENDAR_DATES.zero}"]`).innerText(),/\b0\s*mL\b/,'Literal zero remains recorded water');
        assert.match(await water.locator(`[data-calendar-day="${CALENDAR_DATES.missing}"]`).innerText(),/(?:sem registro|sem dado|sem valor|não registrado)/i);
        assert.match(await water.locator(`[data-calendar-day="${CALENDAR_DATES.partial}"]`).innerText(),/parcial|incompleto/i);
        assert.match(await water.locator(`[data-calendar-day="${CALENDAR_DATES.conflict}"]`).innerText(),/(?:conflit|mais de um|diverg|revisão)/i);
        await captureTiles(page,`${name}-water-evidence`,water);
        await sourceControls(page,fixture,name);
        if(engine==='webkit'||width===320)await printContract(page,`${name}-last-week-export`,{pdf:engine==='chromium',engine});
        await choose(page,{mode:'month'});const month=await assertWindow(page,fixture,CALENDAR_WINDOWS.lastMonth);
        assert.equal(month.calendar.previousBounds.start,'2026-08-01');assert.equal(month.calendar.previousBounds.end,'2026-08-31','The prior month is August, not a rolling 30-day window');
        assert.equal(month.labs.collections.some(collection=>String(collection.date||collection.collection_date).startsWith('2026-10')),false,'Historical month does not include later lab collections');
        await controls(page,name);await captureTiles(page,`${name}-last-month`,page.locator('#calendarReport'));
        if(engine==='chromium'&&width===393)await printContract(page,`${name}-last-month-export`,{pdf:true,engine});
        await choose(page,{mode:'week',selection:'current'});const current=await assertWindow(page,fixture,CALENDAR_WINDOWS.currentWeek,{partial:true,nominalEnd:'2026-10-18'});
        assert.ok(current.todayMetrics?.length||Object.keys(current.todayMetrics||{}).length,'Today has a separate partial view');
        assert.match(await page.locator('#calendarReport .ltsCalendarToday').innerText(),/hoje|parcial/i);
        assert.equal(await page.locator('#calendar-next').isDisabled(),true,'Cannot navigate beyond the current calendar period');
        await captureTiles(page,`${name}-current-week`,page.locator('#calendarReport'));
        if(engine==='chromium'&&width===1440)await printContract(page,`${name}-current-week-export`,{pdf:true,engine});
        await choose(page,{mode:'month',selection:'current'});await assertWindow(page,fixture,CALENDAR_WINDOWS.currentMonth,{partial:true,nominalEnd:'2026-10-31'});
        await captureTiles(page,`${name}-current-month`,page.locator('#calendarReport'));
        if(engine==='chromium'&&width===1440)await printContract(page,`${name}-current-month-export`,{pdf:true,engine});
        if(engine==='webkit')await printContract(page,`${name}-current-month-print`,{engine});
        await choose(page,{mode:'month',selection:'date',date:'2024-02-10'});await assertWindow(page,fixture,CALENDAR_WINDOWS.leapMonth);
        await page.locator('#calendar-next').click();await stable(page);assert.equal((await report(page)).calendar.bounds.start,'2024-03-01');assert.equal((await report(page)).calendar.bounds.end,'2024-03-31');
        await page.locator('#calendar-prev').click();await stable(page);await assertWindow(page,fixture,CALENDAR_WINDOWS.leapMonth);
        await choose(page,{mode:'week',selection:'date',date:'2026-01-01'});await assertWindow(page,fixture,CALENDAR_WINDOWS.yearWeek);
        await captureTiles(page,`${name}-year-boundary`,page.locator('#calendarReport'));
        await choose(page,{mode:'week',selection:'last'});await assertWindow(page,fixture,CALENDAR_WINDOWS.lastWeek);
        const plan=page.locator('#calendarReport .ltsCalendarPlan');
        assert.equal((await report(page)).nutritionPlan.state,'retrospective_required');
        assert.equal(await plan.locator('.ltsCalendarPlanMetrics').count(),0,'No retrospective dietary comparison before an explicit choice');
        await plan.locator('[data-plan-retrospective]').click();await stable(page);
        assert.equal((await report(page)).nutritionPlan.isRetrospective,true);
        assert.match(await plan.innerText(),/retrospectiv[ao].*não indica adesão passada/i);
        assert.equal(await plan.locator('.ltsCalendarPlanMetrics > li').count(),6,'Documented targets remain six separate observed comparisons');
        await captureTiles(page,`${name}-retrospective-plan`,plan);
        await printFailure(page,`${name}-print-failure`);await printContract(page,`${name}-print-retry`,{engine});
      });
    }
    if(engine==='chromium')for(const scenario of [{kind:'empty'},{kind:'error'},{kind:'complete',failTable:'health_documents'}]){
      const fixture=makeCalendarReportFixture(scenario.kind);
      await session(browser,engine,393,844,fixture,async(page,name)=>{
        const m=await report(page),root=page.locator('#calendarReport'),text=await root.innerText();
        if(scenario.kind==='empty'){
          assert.equal(m.metricsByKey.water.count,0);assert.equal(m.metricsByKey.water.value,null);
          assert.match(await root.locator('.ltsCalendarMetric[data-calendar-metric="water"]').innerText(),/(?:sem registro|sem dado|nenhum)/i);
          assert.doesNotMatch(await root.locator('.ltsCalendarContext').innerText(),/(?:falhou|não carreg|não foi possível atualizar)/i,'An absent plan is distinct from a failed plan read');
        }else if(scenario.failTable){
          assert.equal(await page.evaluate(()=>window.__languageApp.state.domainStatus.nutritionPlans),'error');
          assert.match(await root.locator('.ltsCalendarContext').innerText(),/(?:não carreg|não foi possível|indisponível|falh)/i,'Failed plan load is visible and not replaced by an invented goal');
        }else{
          assert.equal(m.metricsByKey.steps.value,null,'Failed wearable source does not keep stale values');
          assert.match(await root.locator('[data-calendar-metric="steps"]').innerText(),/(?:não carreg|não foi possível|indisponível|falh)/i);
          assert.ok(m.metricsByKey.water.value!==null,'Unaffected food records remain available');
        }
        assert.doesNotMatch(text,/SQLSTATE|source_record_id|canonical_status|NaN|undefined|Infinity/);
        await controls(page,name);await captureTiles(page,name,root);
        await printContract(page,`${name}-export`,{pdf:scenario.kind==='empty',engine});
      },scenario);
    }
  }finally{await browser.close();save();}
}
assert.equal(failures.length,0,`Calendar reports: ${failures.length} failures; inspect ${dir}/results.json and original-resolution artifacts.`);
assert.ok(sizes.every(([width])=>captures.some(capture=>capture.viewport.width===width)),'All requested screen widths have visible evidence');
assert.ok(pdfs.length>=5,'Historical week/month, current week/month and empty PDF are real Chromium artifacts');
console.log('Calendar reports: synthetic production startup, calendar boundaries, observed-only averages, independent sources, current-day separation, source failures, local synchronous print, A4 PDFs and WebKit engine coverage passed. No real account or physical iPhone/Safari was tested.');

// Runs only inside the existing protected, read-only owner audit session.
// Source values stay in memory; private screenshots use the existing encrypted
// artifact path. Never log clinical values, row identifiers or proof excerpts.
const auditId='health-lab-documentary-review-20261112';
const expectedCount=15;
const projection='id,source_record_id,collection_date,report_date,laboratory,biomarker,result_raw,result_numeric,unit,reference_range,flag,method,source,source_file,numeric_kind:source_payload->>numeric_kind,numeric_reading_verification:source_payload->numeric_reading_verification';
const fail=(stage)=>{const error=new Error('Reviewed laboratory presentation or read-only integrity check failed; private details withheld');error.auditCode=`lab-reviewed-${stage}`;throw error;};

async function snapshot(page){
  return page.evaluate(async({auditId,projection})=>{
    const {sb,state,norm}=await import('./src/core.js');
    const {reviewedDocumentaryNumericReading}=await import('./src/health-lab-documentary-numeric.js');
    const {labResultReading}=await import('./src/health-dashboard-labs.js');
    const {labGroups,labCohorts,labChartModel}=await import('./src/labs-layout-v2.js');
    const all=[];
    for(let offset=0;;offset+=1000){
      const {data,error}=await sb.from('health_lab_results').select(projection).order('source_record_id').range(offset,offset+999);
      if(error)return{read:false};
      all.push(...data);if(data.length<1000)break;
    }
    const rows=all.filter(row=>row.numeric_reading_verification?.audit_id===auditId);
    const loaded=(state.data.labs||[]).filter(row=>row.numeric_reading_verification?.audit_id===auditId);
    const shape=row=>Object.fromEntries(Object.keys(row).sort().map(key=>[key,row[key]]));
    const fingerprint=JSON.stringify(rows.map(shape));
    const loadedAgree=state.domainStatus.labs==='ready'&&loaded.length===rows.length&&rows.every(row=>{
      const actual=loaded.find(item=>item.id===row.id);
      return actual&&Object.keys(row).every(key=>JSON.stringify(actual[key]??null)===JSON.stringify(row[key]??null));
    });
    const targets=rows.map(row=>{
      const proof=reviewedDocumentaryNumericReading(row),reading=labResultReading(row);
      const group=labGroups(state.data.labs).find(item=>item.key===norm(row.biomarker));
      const cohort=labCohorts(group).find(item=>item.all.some(item=>item.id===row.id));
      const point=cohort&&labChartModel(cohort).points.find(item=>item.row.id===row.id);
      return{id:row.id,marker:norm(row.biomarker),date:row.collection_date,raw:row.result_raw,
        value:row.result_numeric,unit:row.unit,reference:row.reference_range,cohort:cohort?.key,
        accepted:Boolean(proof&&proof.value===row.result_numeric&&reading.exactValue===row.result_numeric&&
          reading.rawValue===row.result_raw&&point?.value===row.result_numeric)};
    });
    return{read:true,loadedAgree,fingerprint,targets,unique:new Set(rows.map(row=>row.id)).size===rows.length,
      sameDate:new Set(rows.map(row=>row.collection_date)).size===1};
  },{auditId,projection});
}

export async function verifyReviewedLaboratoryPresentation(page,{waitForRoute,evidenceDir}){
  await waitForRoute('saude');
  const clearCut=page.locator('[data-lab-clear-asof]');
  if(await clearCut.count())await clearCut.click();
  await page.locator('#productLabQuery').fill('');
  await page.locator('[data-depth-period="productLabPeriod"][data-value="all"]').click();
  const before=await snapshot(page);
  if(!before.read)fail('read');
  if(!before.loadedAgree)fail('loaded');
  if(!before.unique||!before.sameDate||before.targets.length!==expectedCount)fail('identity');
  if(before.targets.some(row=>!row.accepted||!row.cohort))fail('eligibility');
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    await page.locator('#productLabCollection').selectOption(before.targets[0].date);
    await page.waitForFunction(date=>document.querySelector('#productLabCollection')?.value===date&&
      document.querySelector('#productLabsCollection h2')?.textContent?.includes(date.split('-').reverse().join('/')),before.targets[0].date);
    for(const target of before.targets){
      const selected=page.locator(`#productLabsCollection [data-lab-marker=${JSON.stringify(target.marker)}]`);
      if(await selected.count()!==1)fail('collection-card');
      const expectedRaw=`${target.raw} ${target.unit}`;
      if(await selected.locator('strong').innerText()!==expectedRaw)fail('collection-value');
      if(target.reference&&!(await selected.innerText()).includes(`Referência do laudo: ${target.reference}`))fail('collection-reference');
    }
    await page.locator('#productLabsCollection').scrollIntoViewIfNeeded();
    await page.screenshot({path:`${evidenceDir}/reviewed-labs-${viewport.width}-collection.png`,fullPage:true});
    for(const target of before.targets){
      await page.locator('#productLabMarkerSelect').selectOption(target.marker);
      await page.waitForFunction(marker=>document.querySelector('#productLabMarkerSelect')?.value===marker, target.marker);
      await page.locator('#productLabCohort').selectOption(target.cohort);
      await page.waitForFunction(async key=>{
        const {labsModel}=await import('./src/labs-layout-v2.js');
        return document.querySelector('#productLabCohort')?.value===key&&labsModel().cohort?.key===key;
      },target.cohort);
      const point=await page.evaluate(async id=>{
        const {labsModel,labChartModel}=await import('./src/labs-layout-v2.js');
        return labChartModel(labsModel().cohort).points.findIndex(item=>item.row.id===id);
      },target.id);
      if(point<0)fail('graph-point');
      await page.locator('#productLabPoint').selectOption(String(point));
      const expectedValue=`${Number(target.value).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:20})} ${target.unit}`;
      await page.waitForFunction(expected=>document.querySelector('.ltsPointReadout p > b')?.textContent===expected,expectedValue);
      const readout=await page.locator('.ltsPointReadout').innerText();
      if(!readout.includes(`Resultado original: ${target.raw} ${target.unit}`)||
        !readout.includes(target.date.split('-').reverse().join('/')))fail('graph-original');
      if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))fail('overflow');
    }
    await page.screenshot({path:`${evidenceDir}/reviewed-labs-${viewport.width}-point.png`,fullPage:true});
  }
  const after=await snapshot(page);
  if(!after.read||!after.loadedAgree||after.fingerprint!==before.fingerprint)fail('final-integrity');
}

// Read-only checks inside the established protected CI authentication flow.
// Return only booleans: no health values, source identifiers or raw payloads.
export async function verifyOriginalPolarHistory(page){
  const result=await page.evaluate(async()=>{
    const {sb,state}=await import('./src/core.js');
    const {dashboardContext}=await import('./src/health-dashboard-context.js');
    const {healthDashboardCalendar}=await import('./src/health-dashboard-model.js');
    const fields=['source_record_id','workout_date','recorded_start','session_name','duration_minutes','heart_rate_avg','heart_rate_max','source_name'];
    const rows=[];
    for(let offset=0;;offset+=1000){
      const {data,error}=await sb.from('health_polar_sessions').select(fields.join(',')).order('workout_date').order('source_record_id').range(offset,offset+999);
      if(error)return{read:false};
      rows.push(...data);
      if(data.length<1000)break;
    }
    const original=rows.filter(row=>row.source_record_id.startsWith('polar_apple_xml_v1:'));
    const provider=rows.filter(row=>row.source_record_id.startsWith('polar_v4:session:'));
    if(!original.length||!provider.length)return{read:true,available:false};
    const boundary=provider.map(row=>row.workout_date).sort()[0];
    const projection=row=>Object.fromEntries(fields.map(key=>[key,row[key]??null]));
    const shape=list=>JSON.stringify(list.map(projection).sort((a,b)=>a.source_record_id.localeCompare(b.source_record_id)));
    const loaded=(state.data.polarSessions||[]).filter(row=>row.source_record_id.startsWith('polar_apple_xml_v1:'));
    const calendar=healthDashboardCalendar(state.data,state.domainStatus,state.ui);
    const context=dashboardContext(state.data,state.domainStatus,{today:calendar.today,bounds:{start:original.map(row=>row.workout_date).sort()[0],end:calendar.today}});
    const history=context.training.polar.history.filter(row=>row.sourceRecordId.startsWith('polar_apple_xml_v1:'));
    return {read:true,available:true,loaded:state.domainStatus.polarSessions==='ready'&&shape(loaded)===shape(original),
      separate:original.every(row=>row.workout_date<boundary&&row.source_name==='Polar Flow · original Apple Saúde'&&row.heart_rate_avg===null&&row.heart_rate_max===null),
      unique:new Set(original.map(row=>row.source_record_id)).size===original.length,
      model:history.length===original.length&&history.every(row=>row.classification==='device_record'&&row.canonicalWorkoutId===null)};
  });
  if(!result.read||!result.available||!result.loaded||!result.separate||!result.unique||!result.model){
    throw new Error('Original Polar history failed protected read, loaded-data or separate-observation verification');
  }
}

// Compare the published session disclosure with independent owner-scoped reads.
// Source notes, dates and account identifiers stay in the protected process.
export async function verifyTrainingDeviceRecords(page){
  const samples=await page.evaluate(async()=>{
    const {sb,state,fmtDate}=await import('./src/core.js');
    if(state.domainStatus.workouts!=='ready'||state.domainStatus.workoutEvidence!=='ready')throw new Error('Workout sources unavailable');
    const visibleDates=new Map(state.data.workouts.map(row=>[row.source_record_id,row.workout_date]));
    const visible=row=>visibleDates.get(row.workout_source_record_id)===row.workout_date;
    const select='workout_source_record_id,workout_date,source_family,source_file,notes';
    const source=()=>sb.from('health_workout_source_evidence').select(select);
    const [possible,confirmed]=await Promise.all([
      source().eq('evidence_kind','session_reference').eq('evidence_status','candidate')
        .in('source_family',['apple_watch','polar_flow']).order('workout_date',{ascending:false}).limit(8),
      source().eq('evidence_kind','telemetry').eq('evidence_status','confirmed').eq('source_family','polar_flow')
        .like('source_file','https://flow.polar.com/training/analysis/%').order('workout_date',{ascending:false}).limit(1)
    ]);
    if(possible.error||confirmed.error)throw new Error('Unable to read device records');
    const format=(row,status)=>({
      selector:'[data-depth-workout="'+CSS.escape(row.workout_source_record_id)+'"]',
      date:fmtDate(row.workout_date),note:row.notes||null,
      link:/^https:\/\/flow\.polar\.com\/training\/analysis\/\d+$/.test(row.source_file||'')?row.source_file:null,
      title:(row.source_family==='apple_watch'?'Apple Watch':'Polar Flow')+' · '+status
    });
    return [...possible.data.filter(visible).map(row=>format(row,'Possível correspondência')),...confirmed.data.filter(visible).map(row=>format(row,'Vínculo confirmado'))];
  });
  for(const sample of samples){
    await page.locator('.ltsRefTrainTabs [data-depth-training-view="history"]').click();
    await page.locator('[data-depth-clear="training"]').click();
    await page.locator('#productTrainingQuery').fill(sample.date);
    await page.locator('.ltsWorkoutList '+sample.selector).click();
    const panel=page.locator('.ltsTrainingReference .ltsDeviceRecords');
    if(!await panel.evaluate(element=>element.open))await panel.locator('summary').click();
    await panel.locator('li').first().waitFor({state:'visible'});
    const found=await panel.locator('li').evaluateAll((items,sample)=>items.some(item=>
      item.querySelector('strong')?.textContent===sample.title&&
      (!sample.note||item.querySelector('p')?.textContent===sample.note)&&
      (item.querySelector('a')?.getAttribute('href')??null)===sample.link
    ),sample);
    if(!found)throw new Error('Published device record differs from the source');
  }
}

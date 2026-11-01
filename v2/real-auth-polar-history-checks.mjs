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

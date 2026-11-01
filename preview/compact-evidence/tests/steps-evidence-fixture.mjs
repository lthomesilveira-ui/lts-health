// Synthetic only. No user records, dates, accounts, credentials or network.
export const today='2024-03-08';
export const status=Object.fromEntries(['nutrition','sourceMetrics','metrics','body','segmental','workouts','workoutEvidence','exercises','sets','labs','treatments','regimens','docs','goals','waterReferences','nutritionPlans','polarSessions','meals','uploads'].map(key=>[key,'ready']));
export const step=(date,value,source='Synthetic unnamed origin',extra={})=>({source_record_id:`synthetic:${date}:${source}`,metric_date:date,metric_type:'steps',value,unit:'count',source_name:source,source_family:'synthetic_export',canonical_status:'candidate',updated_at:`${today}T15:34:00+00:00`,...extra});
export function fixture(){return {...Object.fromEntries(Object.keys(status).map(key=>[key,[]])),sourceMetrics:[
  step('2024-03-04',1234),step('2024-03-04',4321,'Synthetic watch|Synthetic phone'),
  step('2024-03-05',0),step('2024-03-06',1600),step('2024-03-07',1024.125006),step(today,250)
]};}

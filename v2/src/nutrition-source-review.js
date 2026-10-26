// Generic, read-only candidate contract. Does not change canonical_status.
const types={dietary_energy_kcal:'kcal',dietary_protein_g:'g',dietary_carbs_g:'g',dietary_carbohydrates_g:'g',dietary_fat_g:'g',dietary_fiber_g:'g'};
const day=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const d=new Date(`${value}T12:00:00Z`);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;};
const numericScalar=v=>(typeof v==='number'&&Number.isFinite(v))||(typeof v==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v.trim()));
export function nutritionSourceReview(row){
 const r=row?.nutrition_review;
 if(!r)return {state:'unreviewed',verified:false,excludeFromClosedMeans:false,partial:false};
 const invalid={state:'review_invalid',verified:false,excludeFromClosedMeans:true,partial:false};
 if(r.schema!=='apple_nutrition_source_review_v1'||r.method!=='sum_distinct_meal_samples_v1'||r.status!=='verified')return invalid;
 if(row.source_family!=='myfitnesspal'||row.source_name!=='MyFitnessPal via Apple Health'||!['candidate','canonical'].includes(row.canonical_status))return invalid;
 if(!row.source_file||r.source_file!==row.source_file||!r.source_sha256||!/^[a-f0-9]{64}$/.test(r.source_sha256)||r.original_source!=='MyFitnessPal')return invalid;
 if(typeof row.source_record_id!=='string'||!row.source_record_id.trim()||!Object.hasOwn(types,row.metric_type)||typeof row.unit!=='string'||!day(row.metric_date)||r.metric_date!==row.metric_date||r.source_record_id!==row.source_record_id||r.metric_type!==row.metric_type||types[row.metric_type]!==row.unit||r.unit!==row.unit)return invalid;
 if(!numericScalar(row.value)||!numericScalar(r.verified_value)||typeof row.value==='boolean'||row.value==null||String(row.value).trim()===''||typeof r.verified_value==='boolean'||String(r.verified_value??'').trim()===''||!Number.isFinite(Number(row.value))||Number(row.value)<0||r.verified_value==null||Number(r.verified_value)!==Number(row.value))return invalid;
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(r.exported_at)||!Number.isFinite(Date.parse(r.exported_at)))return invalid;
 const exportDay=r.exported_at.slice(0,10);
 if(!day(exportDay)||row.metric_date>exportDay||!Number.isInteger(r.sample_count)||r.sample_count<1||r.duplicate_count!==0)return invalid;
 const partial=row.metric_date===exportDay;
 return {state:'source_verified',verified:true,partial,excludeFromClosedMeans:partial,exportedAt:r.exported_at,sourceHash:r.source_sha256,
 label:partial?'Arquivo conferido · dia parcial':'Arquivo conferido · total observado',
 note:partial?'Fotografia exportada antes de encerrar o dia; excluída das médias de dias encerrados.':'Extração conferida; isso não comprova que todas as refeições foram registradas.'};
}
export function reviewedNutrientMean(rows,today){
 if(!day(today))return {points:[],count:0,mean:null,reason:'invalid_today'};
 const points=rows.map(row=>({...row,review:nutritionSourceReview(row)}));
 const identities=new Set(points.filter(r=>r.review.verified).map(r=>JSON.stringify([r.source_family,r.source_name,r.source_file,r.canonical_status,r.metric_type,r.unit,r.nutrition_review?.source_sha256])));
 if(identities.size>1)return {points,count:0,mean:null,reason:'mixed_sources_or_variables'};
 const dates=rows.map(r=>r.metric_date);if(new Set(dates).size!==dates.length)return {points,count:0,mean:null,reason:'ambiguous_dates'};
 const eligible=points.filter(row=>row.metric_date<today&&row.review.verified&&!row.review.excludeFromClosedMeans&&row.value!=null&&Number.isFinite(Number(row.value)));
 return {points,count:eligible.length,mean:eligible.length?eligible.reduce((s,r)=>s+Number(r.value),0)/eligible.length:null};
}

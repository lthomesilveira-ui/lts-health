// Candidate summary for private receiver logs; no payload values, tokens or source names.
const food=new Set(['dietary_energy_kcal','dietary_protein_g','dietary_carbs_g','dietary_carbohydrates_g','dietary_fat_g','dietary_fiber_g']);
const outcomes=new Set(['accepted','no_supported_data','validation_rejected','rate_limited','ingestion_failed']);
const validationCodes=new Set(['json_required','daily_aggregation_required','invalid_date','invalid_source','invalid_value','unsupported_unit','invalid_payload','health_metrics_only','duplicate_daily_metric','too_many_points','payload_too_large']);
const periods=new Set(['none','default','lastsync','today','yesterday','previous7days']);
// Documented labels and deep-link tokens are diagnostics, not proof of coverage.
// Never echo arbitrary header text or coerce non-string input into a label.
const periodLabels=new Map([['since last sync','lastsync'],['previous 7 days','previous7days']]);
const normalizedPeriod=value=>{
 if(typeof value!=='string'||value.length>64||!/^[A-Za-z0-9 ]+$/.test(value))return 'unknown';
 const key=value.trim().toLowerCase();
 return periods.has(key)?key:periodLabels.get(key)||'unknown';
};
const count=n=>Number.isInteger(n)&&n>=0?n:0;
const validDay=d=>{if(typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d))return false;const x=new Date(`${d}T12:00:00Z`);return Number.isFinite(x.getTime())&&x.toISOString().slice(0,10)===d;};
export function receiveSummary({outcome,metrics=[],ignoredPoints=0,ignoredBasalBlocks=null,ignoredBasalPoints=null,acceptedMetrics=0,acceptedBasalCandidates=0,basalCandidatePoints=null,automationPeriod=null,correlationId=null,validationCode=null}={}){
 const safeOutcome=outcomes.has(outcome)?outcome:'ingestion_failed';
 // Absent counters mean unobserved (including legacy or rejected payloads), never zero.
 // Only the exact basal identifier is counted; this does not establish coverage.
 const hasBasalCounts=Number.isInteger(ignoredBasalBlocks)&&ignoredBasalBlocks>=0&&ignoredBasalBlocks<=80&&Number.isInteger(ignoredBasalPoints)&&ignoredBasalPoints>=0&&ignoredBasalPoints<=2500&&ignoredBasalPoints<=count(ignoredPoints)&&(ignoredBasalBlocks>0||ignoredBasalPoints===0);
 const basalCounts=hasBasalCounts?{ignored_basal_blocks:ignoredBasalBlocks,ignored_basal_points:ignoredBasalPoints}:{};
 const capturedCount=Number.isInteger(acceptedBasalCandidates)&&acceptedBasalCandidates>=0&&acceptedBasalCandidates<=2500?acceptedBasalCandidates:0;
 const candidateCounts=Number.isInteger(basalCandidatePoints)&&basalCandidatePoints>0&&basalCandidatePoints<=2500
   ?{basal_candidate_points_observed:basalCandidatePoints,accepted_basal_candidates:safeOutcome==='accepted'?capturedCount:0,basal_coverage_verified:false}:{};
 const nutrientRows=metrics.filter(r=>food.has(r?.metric_type));
 const days=[...new Set(nutrientRows.map(r=>r.metric_date).filter(validDay))].sort();
 const origins=new Map();for(const row of nutrientRows){const key=JSON.stringify([row.source_family||null,row.source_name||null]);if(!origins.has(key))origins.set(key,[]);origins.get(key).push(row);}
 const originSummaries=[...origins.values()].map((items,index)=>({origin_index:index+1,metrics:items.length,dates:[...new Set(items.map(r=>r.metric_date).filter(validDay))].length}));
 return {...basalCounts,...candidateCounts,validation_code:validationCodes.has(validationCode)?validationCode:null,correlation_id:typeof correlationId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(correlationId)?correlationId:null,nutrition_origin_summaries:originSummaries,event:'health_export_receive_summary_v1',outcome:safeOutcome==='accepted'&&count(acceptedMetrics)===0&&capturedCount===0?'accepted_without_writes':safeOutcome==='accepted'&&!nutrientRows.length?'accepted_without_nutrition':safeOutcome,
  supported_metrics:count(metrics.length),ignored_points:count(ignoredPoints),accepted_metrics:safeOutcome==='accepted'?count(acceptedMetrics):0,
  nutrition_metrics_observed:count(nutrientRows.length),nutrition_dates_observed:days.length,nutrition_first_date_observed:days[0]||null,nutrition_last_date_observed:days.at(-1)||null,
  automation_period:normalizedPeriod(automationPeriod),requested_interval:'unknown',coverage_verified:false};
}

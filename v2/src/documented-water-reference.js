// Read-only documentary context. This module never creates a personal goal,
// infers a clinical start, writes to storage, or calculates exercise additions.
export const documentedWaterProjection='source_record_id,document_date,document_type,source_file,source,checksum,water_reference:source_payload->water_reference_ui';
const text=value=>typeof value==='string'?value.trim():'';
const date=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const parsed=new Date(`${value}T12:00:00Z`);return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value?value:null;};
const checksum=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)?value:null;
const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

export function documentedWaterReference(row){
  if(!object(row)||row.document_type!=='medical_plan')return null;
  const ref=row.water_reference,documentDate=date(row.document_date),sourceRecordId=text(row.source_record_id),sourceFile=text(row.source_file),hash=checksum(row.checksum);
  if(!object(ref)||ref.schema_version!==1||ref.type!=='documented_water_base'||!sourceRecordId||!sourceFile||!documentDate||!hash)return null;
  if(!positive(ref.base_ml_per_day)||!Number.isSafeInteger(ref.source_page)||ref.source_page<1||date(ref.documented_on)!==documentDate||ref.source_sha256!==hash)return null;
  if(ref.date_basis!=='document_update'||ref.clinical_start!=='not_explicit'||!text(ref.exercise_addition))return null;
  return {
    value:ref.base_ml_per_day,documentDate,documentedOn:documentDate,dateBasis:'document_update',clinicalStart:'not_explicit',
    sourceRecordId,sourceFile,source:text(row.source)||sourceFile,checksum:hash,sourcePage:ref.source_page,exerciseAddition:text(ref.exercise_addition),
    notes:`${sourceFile}, página ${ref.source_page}. Data de atualização do documento; início clínico não explicitado. ${text(ref.exercise_addition)}`
  };
}

export function documentedWaterReferenceForDate(rows,asOfDate,status){
  const end=date(asOfDate);if(status!=='ready'||!end)return null;
  // A newer malformed water projection blocks fallback to an older reference.
  // Other medical documents without a water projection do not declare a change.
  const eligible=(Array.isArray(rows)?rows:[]).filter(row=>object(row)&&row.document_type==='medical_plan'&&row.water_reference!=null&&date(row.document_date)&&row.document_date<=end);
  if(!eligible.length)return null;
  const newest=eligible.map(row=>row.document_date).sort().at(-1),latest=eligible.filter(row=>row.document_date===newest);
  if(latest.length!==1)return null;
  const selected=documentedWaterReference(latest[0]);if(!selected)return null;
  if(eligible.filter(row=>text(row.source_record_id)===selected.sourceRecordId).length!==1)return null;
  return {...selected,asOfDate:end};
}

export function recordedWaterDifference(record,reference){
  const recordedDate=date(record?.date),recordedValue=record?.value;
  if(!recordedDate||typeof recordedValue!=='number'||!Number.isFinite(recordedValue)||recordedValue<0)return null;
  if(!reference||reference.dateBasis!=='document_update'||reference.clinicalStart!=='not_explicit'||!positive(reference.value)||!date(reference.documentDate))return null;
  if(!text(reference.sourceRecordId)||!checksum(reference.checksum)||!Number.isSafeInteger(reference.sourcePage)||reference.sourcePage<1)return null;
  if(recordedDate<reference.documentDate||(reference.asOfDate&&(!date(reference.asOfDate)||recordedDate>reference.asOfDate)))return null;
  return {recordedDate,recordedValue,documentDate:reference.documentDate,baseValue:reference.value,delta:recordedValue-reference.value,basis:'documentary_reference',partialRecordPossible:true};
}

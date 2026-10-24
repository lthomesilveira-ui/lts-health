// Read-only interpretation of an independently reviewed, exact-bound result.
// TRUST BOUNDARY: only an authenticated source may supply this approved review.
// A caller-provided status, excerpt or digest cannot create an approval. The
// hashes detect drift; they are not signatures. The PDF hash identifies the
// separately inspected artifact; this browser helper does not fetch or verify
// PDF bytes. Never construct a proof from an ambiguous result in the UI.
import {documentaryEvidenceSha256 as sha256} from './health-lab-reviewed-numeric.js';

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const present=value=>typeof value==='string'&&value.length>0&&value.length<=2048&&value.trim()===value&&
  !['unknown','null','none','n/a','—','-'].includes(value.toLowerCase());
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const page=(value,total)=>Number.isSafeInteger(value)&&value>0&&value<=total;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const grouped=/^[1-9]\d{0,2}(?:\.\d{3})+$/;
const unsigned=/^\d+(?:,\d+)?$/;
const fields=['id','source_record_id','source_file','biomarker','unit','collection_date','report_date','result_raw','result_numeric'];
const legend='Resultado fora da faixa de referência.';
const date=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const parsed=new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
};
const printedDate=value=>value.split('-').reverse().join('/');
const timestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)&&
  date(value.slice(0,10))&&Number.isFinite(new Date(value).getTime())&&new Date(value).toISOString()===(value.includes('.')?value:value.replace('Z','.000Z'));
const evidence=(text,hash)=>typeof text==='string'&&text.length>0&&text.length<=32768&&digest(hash)&&sha256(text)===hash;
const stable=value=>Array.isArray(value)?value.map(stable):object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
function same(a,b){try{return JSON.stringify(stable(a))===JSON.stringify(stable(b));}catch{return false;}}
export function hasDocumentaryNumericProof(row){
  return row?.numeric_reading_verification!=null||row?.source_payload?.numeric_reading_verification!=null;
}
function numericKindsAreExact(row){
  return [row.numeric_kind,row.source_payload?.numeric_kind].every(kind=>kind==null||kind===''||
    (typeof kind==='string'&&kind.trim().toLowerCase()==='exact'));
}
function numericToken(text,token,start=text.indexOf(token)){
  if(start<0||text.slice(start,start+token.length)!==token)return false;
  // Select a complete source token. Never repair signs, censuring, invisible
  // formatting or unreviewed notes by stripping characters from its boundary.
  const before=text.slice(0,start),after=text.slice(start+token.length);
  const invisible='[\\p{Cf}\\p{M}\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F]';
  if(new RegExp(`${invisible}[\\s\\p{Cf}\\p{M}]*$`,'u').test(before)||
    new RegExp(`^[\\s\\p{Cf}\\p{M}]*${invisible}`,'u').test(after))return false;
  // Colon/pipe are explicit transcription delimiters; / and % can begin a
  // printed unit. Other immediately attached characters are not delimiters.
  if(before&&!/[\s:|]$/u.test(before)||after&&!/^[\s/%]/u.test(after))return false;
  // A punctuation colon cannot hide a qualifier (for example, a limit sign
  // followed by a colon). This local check never edits the source excerpt.
  const prefix=before.replace(/:\s*$/u,''),left=prefix.trimEnd(),right=after.trimStart();
  const leftChar=left.match(/.$/u)?.[0],rightChar=right.match(/^./u)?.[0];
  const signOrNote=/[\p{Sm}\p{Pd}\p{Sk}\p{Sc}\p{So}\p{No}\p{Nl}\p{Lm}\p{Cf}*†‡§¶※]/u;
  if(leftChar&&leftChar!=='|'&&signOrNote.test(leftChar)||
    rightChar&&rightChar!=='|'&&signOrNote.test(rightChar))return false;
  // Spaced superscripts, scientific notation and scale factors still belong
  // to the result token. Inspect only its immediate continuation, so a later
  // unit or explicit column separator keeps other columns out of this check.
  if(/^(?:(?:x|vezes)\s*[+\-−]?\s*\d|e\s*[+\-−]?\s*\d|\d+\s*(?:\^|\*\*|[⁰¹²³⁴⁵⁶⁷⁸⁹]))/iu.test(right)||
    /^(?:ou\s+(?:menos|mais|inferior|superior)|(?:(?:no|ao|pelo)\s+)?(?:m[áa]ximo|m[íi]nimo))/iu.test(right)||
    /\b(?:(?:no|ao|pelo|por)\s+)?(?:m[áa]ximo|m[íi]nimo)(?:\s+de)?\s*$/iu.test(prefix)||
    /\b(?:pelo|ao)\s+(?:menos|mais)\s*$/iu.test(prefix)||
    /\b(?:(?:less|more)\s+than|at\s+(?:most|least))\s*$/iu.test(prefix))return false;
  if(/(?:\b(?:inferior|superior|menor|maior)(?:\s+ou\s+igual)?(?:\s+(?:a|que|do\s+que))?|(?:até|ate)|\b(?:abaixo|acima|cerca|em torno)(?:\s+de)?|\b(?:menos|mais)(?:\s+(?:de|que))?|\b(?:aproximadamente|aproximado|approx|about))\s*$/i.test(prefix)||
    /\d(?:[.,]\d+)?\s*(?:a|até|ate|to|e|[-–—])\s*$/i.test(prefix)||
    /^\s*(?:[([{⁽]|(?:a|até|ate|to|[-–—])\s*\d|(?:aproximad|estimad)|\/\s*\d)/i.test(after))return false;
  return true;
}
function spansMatch(clinical){
  const text=clinical.evidence_text,spans=clinical.spans,ordered=[];
  if(!object(spans))return false;
  for(const[key,value]of [['analyte',clinical.printed_analyte],['result',clinical.numeric_token],['unit',clinical.printed_unit]]){
    const span=spans[key];
    if(!Array.isArray(span)||span.length!==2||!Array.from(span).every(Number.isSafeInteger)||span[0]<0||span[0]>=span[1]||span[1]>text.length||text.slice(...span)!==value)return false;
    ordered.push(span);
  }
  ordered.sort((a,b)=>a[0]-b[0]);
  return ordered.every((span,index)=>index===0||ordered[index-1][1]<=span[0])&&numericToken(text,clinical.numeric_token,spans.result[0]);
}
function safeNumber(token,isGrouped){
  if(!(isGrouped?grouped:unsigned).test(token))return null;
  const digits=token.replace(/[.,]/g,'').replace(/^0+/,'');
  const value=Number(isGrouped?token.replaceAll('.',''):token.replace(',','.'));
  if(digits.length>15||!finite(value)||(Number.isInteger(value)&&!Number.isSafeInteger(value))||(value===0&&/[1-9]/.test(token)))return null;
  return value;
}

export function reviewedDocumentaryNumericReading(row){
  if(!object(row)||!numericKindsAreExact(row)||!hasDocumentaryNumericProof(row))return null;
  const payload=object(row.source_payload)?row.source_payload:null;
  const projected=Object.hasOwn(row,'numeric_reading_verification');
  const embedded=Boolean(payload&&Object.hasOwn(payload,'numeric_reading_verification'));
  if(projected&&embedded&&!same(row.numeric_reading_verification,payload.numeric_reading_verification))return null;
  const proof=projected?row.numeric_reading_verification:payload?.numeric_reading_verification;
  if(!object(proof)||proof.schema!=='documentary_numeric_reading_v1'||proof.status!=='source_verified'||
    !present(proof.audit_id)||proof.audit_id.length>160||!timestamp(proof.reviewed_at)||!object(proof.binding))return null;
  for(const key of fields){
    if(!Object.hasOwn(row,key)||!Object.hasOwn(proof.binding,key)||proof.binding[key]!==row[key]||
      (key==='result_numeric'?!finite(row[key]):!present(row[key])))return null;
    if(payload&&Object.hasOwn(payload,key)&&payload[key]!==row[key])return null;
  }
  for(const key of ['laboratory','method','reference_range','flag','source','reference_verification','method_verification',
    'source_file_id','library_file_id','sha256','pdf_sha256','pdf_page_count','pdf_page']){
    if(payload&&Object.hasOwn(row,key)&&Object.hasOwn(payload,key)&&!same(row[key],payload[key]))return null;
  }
  if(!date(row.collection_date)||!date(row.report_date))return null;
  const raw=row.result_raw,suffix=raw.endsWith('(1)'),token=suffix?raw.slice(0,-3):raw,isGrouped=grouped.test(token);
  // This additive contract covers only a proven terminal (1), documented dot
  // grouping, or both. Plain values continue through the existing reader.
  if(!suffix&&!isGrouped)return null;
  const value=safeNumber(token,isGrouped);
  if(value===null||value!==row.result_numeric)return null;
  const document=proof.document,clinical=proof.clinical,evolution=proof.evolution,footnote=proof.footnote,locale=proof.locale;
  if(!object(document)||!digest(document.pdf_sha256)||!present(document.source_file_id)||!present(document.library_file_id)||
    !Number.isSafeInteger(document.pdf_page_count)||document.pdf_page_count<1||document.pdf_page_count>10000||
    !Array.isArray(document.visual_review_pages)||!document.visual_review_pages.length||
    !Array.from(document.visual_review_pages).every(value=>page(value,document.pdf_page_count))||
    new Set(document.visual_review_pages).size!==document.visual_review_pages.length)return null;
  const reviewedPage=value=>page(value,document.pdf_page_count)&&document.visual_review_pages.includes(value);
  // Full-row audit/replay and narrow loader projections must never disagree.
  for(const source of [row,payload])if(source){
    for(const[key,bound]of [['source_file_id',document.source_file_id],['library_file_id',document.library_file_id],
      ['sha256',document.pdf_sha256],['pdf_sha256',document.pdf_sha256],['pdf_page_count',document.pdf_page_count]]){
      if(Object.hasOwn(source,key)&&source[key]!=null&&source[key]!==bound)return null;
    }
  }
  if(!object(clinical)||clinical.section!=='current_report_result_section'||!reviewedPage(clinical.pdf_page)||
    clinical.pixels_inspected!==true||!present(clinical.printed_analyte)||!present(clinical.accession)||
    clinical.collection_date!==row.collection_date||clinical.printed_unit!==row.unit||
    clinical.result_has_footnote_1!==false||clinical.result_unit_confirmed_without_evolution_reference_column!==true||
    !evidence(clinical.evidence_text,clinical.evidence_text_sha256)||!present(clinical.numeric_token)||!spansMatch(clinical)||
    clinical.identity_text!==`${clinical.accession} | ${printedDate(row.collection_date)}`||
    !evidence(clinical.identity_text,clinical.identity_text_sha256))return null;
  for(const source of [row,payload])if(source&&Object.hasOwn(source,'pdf_page')&&source.pdf_page!=null&&source.pdf_page!==clinical.pdf_page)return null;
  const clinicalGrouped=grouped.test(clinical.numeric_token),clinicalValue=safeNumber(clinical.numeric_token,clinicalGrouped);
  if(clinicalValue===null||clinicalValue!==value||(!isGrouped&&clinical.numeric_token!==token))return null;
  // Printed source labels are transcribed by the independent review. They do
  // not rename the bound biomarker or introduce aliases into series identity.
  if(!object(evolution)||evolution.section!=='LAUDO EVOLUTIVO'||!reviewedPage(evolution.pdf_page)||evolution.pixels_inspected!==true||
    !present(evolution.printed_analyte)||evolution.accession!==clinical.accession||evolution.collection_date!==row.collection_date||
    evolution.result_raw!==raw||evolution.result_cell_only!==true||evolution.reference_column_used_for_clinical_range!==false||
    evolution.footnote_is_visually_superscript!==suffix||
    evolution.evidence_text!==`${evolution.printed_analyte} | ${clinical.accession} | ${printedDate(row.collection_date)} | ${raw}`||
    !evidence(evolution.evidence_text,evolution.evidence_text_sha256))return null;
  if(suffix){
    if(!object(footnote)||footnote.token!=='(1)'||footnote.legend!==legend||footnote.scope!=='LAUDO EVOLUTIVO only'||
      footnote.meaning!=='source_reported_outside_reference_annotation'||!reviewedPage(footnote.pdf_page)||footnote.pixels_inspected!==true||
      footnote.evidence_text!==legend||!evidence(footnote.evidence_text,footnote.evidence_text_sha256))return null;
  }else if(footnote!==null)return null;
  if(!object(locale)||locale.decimal_separator!==','||locale.thousands_separator!=='.'||locale.grouping_length!==3||locale.scope!=='exact_bound_record')return null;
  const grouping=locale.grouping_evidence;
  if(isGrouped){
    if(!object(grouping))return null;
    if(grouping.kind==='ungrouped_clinical_confirmation'){
      if(!/^\d+$/.test(clinical.numeric_token)||clinical.numeric_token!==String(value))return null;
    }else if(grouping.kind==='document_local_notation'){
      if(!reviewedPage(grouping.pdf_page)||grouping.pixels_inspected!==true||!evidence(grouping.evidence_text,grouping.evidence_text_sha256)||
        !/^\d+,\d+$/.test(grouping.decimal_comma_token)||safeNumber(grouping.decimal_comma_token,false)===null||
        grouping.grouped_integer_token!==token||clinical.numeric_token!==token||
        !numericToken(grouping.evidence_text,grouping.decimal_comma_token)||!numericToken(grouping.evidence_text,token))return null;
    }else return null;
  }else if(grouping!==null)return null;
  const transformations=[];
  if(suffix)transformations.push('remove_verified_terminal_footnote_1');
  if(isGrouped)transformations.push('remove_verified_dot_grouping');
  if(token.includes(','))transformations.push('read_verified_decimal_comma');
  return {value,originalRaw:raw,proofReference:{schema:proof.schema,auditId:proof.audit_id,reviewedAt:proof.reviewed_at,
    sourceRecordId:row.source_record_id,pdfSha256:document.pdf_sha256,clinicalPage:clinical.pdf_page,evolutionPage:evolution.pdf_page},
    transformations,...(suffix?{sourceNote:legend}:{})};
}

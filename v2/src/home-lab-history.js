import {labReferenceStatus} from './labs-layout-v2.js';
import {validDay} from './history-tools.js';
const norm=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
const number=v=>v==null||typeof v==='boolean'||String(v).trim()===''||!Number.isFinite(Number(v))?null:Number(v);
const unit=v=>String(v??'').trim().replace(/\s+/g,' ');
const identity=r=>JSON.stringify([norm(r.biomarker),norm(r.laboratory),unit(r.unit)]);
const key=identity;
const exactNumeric=r=>number(r.result_numeric)!=null&&!/[<>≤≥]|menor que|maior que|inferior a|superior a/i.test(String(r.result_raw||''));
// Generic names of explicitly structured documentary fields; no patient values.
const documentaryFields={hematocrit_pct:['hematocrito','%'],hemoglobin_g_dl:['hemoglobina','g/dL'],ck_u_l:['creatinoquinase (ck)','U/L'],urea_mg_dl:['ureia','mg/dL'],vitamin_d_ng_ml:['25-oh vitamina d total','ng/mL'],hba1c_pct:['hemoglobina glicada (a1c)','%']};
function documentaryContext(row,data,status,today){
 if(status.waterReferences!=='ready')return null;
 return (data.waterReferences||[]).filter(d=>d.document_type==='care_followup'&&d.extraction_status==='extracted'&&d.confidence==='high'&&d.document_date>=row.collection_date&&validDay(d.document_date)&&d.document_date<=today&&d.source_file&&d.source_record_id).sort((a,b)=>b.document_date.localeCompare(a.document_date)).map(d=>{
  const base=d.clinical_baseline;if(!base||base.collection_date!==row.collection_date)return null;
  const field=Object.entries(documentaryFields).find(([field,[name,expectedUnit]])=>name===norm(row.biomarker)&&expectedUnit===unit(row.unit)&&number(base[field])!=null&&number(base[field])===number(row.result_numeric));
  return field?{date:d.document_date,source:d.source_file,documentId:d.source_record_id,field:field[0]}:null;
 }).find(Boolean)||null;
}
export function homeLabHistory(data={},status={},m={},ui={}){
 const available=status.labs==='ready',bounds=m.bounds||{},today=m.today||bounds.end;
 if(!available)return {available:false,candidates:[],selected:null,requestedMissing:Boolean(ui.homeLabKey)};
 const all=(data.labs||[]).filter(r=>validDay(r.collection_date)&&r.collection_date<=today&&exactNumeric(r)&&norm(r.biomarker)&&norm(r.unit));
 const inPeriod=all.filter(r=>r.collection_date>=bounds.start&&r.collection_date<=bounds.end),byIdentity=new Map();
 for(const row of inPeriod){const id=identity(row);if(!byIdentity.has(id)||row.collection_date>byIdentity.get(id).collection_date)byIdentity.set(id,row);}
 const current=[...byIdentity.values()];
 const candidates=[];
 for(const row of current){
  const same=all.filter(r=>identity(r)===identity(row));
  const duplicates=new Set(same.filter((r,i)=>same.some((x,j)=>i!==j&&x.collection_date===r.collection_date)).map(r=>r.collection_date));
  if(duplicates.has(row.collection_date))continue;
  const history=same.filter(r=>!duplicates.has(r.collection_date)&&r.collection_date<=row.collection_date).sort((a,b)=>a.collection_date.localeCompare(b.collection_date));
  const previous=history.filter(r=>r.collection_date<row.collection_date).at(-1)||null;
  const comparable=Boolean(previous&&norm(row.laboratory)&&norm(row.method)&&norm(previous.method)===norm(row.method));
  const delta=previous?number(row.result_numeric)-number(previous.result_numeric):null;
  const document=documentaryContext(row,data,status,today);
  candidates.push({key:key(row),row,range:labReferenceStatus(row),history,previous,comparable,delta,document,
   priorOutside:Boolean(previous&&previous.collection_date<bounds.start),ambiguousDates:[...duplicates],
   periodHistory:history.filter(r=>r.collection_date>=bounds.start&&r.collection_date<=bounds.end),
   comparisonLabel:comparable?'Mesmo laboratório, unidade e método declarados':previous&&norm(row.method)&&norm(previous.method)?'Métodos diferentes; valores separados':'Método não informado; valores separados'});
 }
 candidates.sort((a,b)=>Number(Boolean(b.document))-Number(Boolean(a.document))||Number(Boolean(b.previous))-Number(Boolean(a.previous))||String(a.row.biomarker).localeCompare(String(b.row.biomarker),'pt-BR'));
 let requested=ui.homeLabKey;try{const parts=JSON.parse(requested);if(Array.isArray(parts)&&parts.length===4){const legacy=candidates.filter(c=>norm(c.row.biomarker)===parts[0]&&norm(c.row.laboratory)===parts[1]&&norm(c.row.unit)===parts[2]);requested=legacy.length===1?legacy[0].key:requested;}}catch{}
 const selected=requested?candidates.find(c=>c.key===requested)||null:candidates[0]||null;
 return {available,candidates,selected,selectedByUser:Boolean(ui.homeLabKey&&selected),requestedMissing:Boolean(ui.homeLabKey&&!selected),selectionRule:'Resultados citados em acompanhamento documental, depois histórico disponível e nome. A ordem não representa gravidade clínica.'};
}

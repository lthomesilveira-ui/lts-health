// Read-only laboratory context. Each result keeps its own report and collection.
import {reviewedHemogramFootnoteValue} from './health-lab-reviewed-numeric.js';
import {hasDocumentaryNumericProof,reviewedDocumentaryNumericReading} from './health-lab-documentary-numeric.js';
const text=value=>typeof value==='string'?value.trim().replace(/\s+/g,' '):'';
const norm=value=>text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const known=value=>Boolean(text(value)&&!['unknown','unknown method','not informed','not provided','not available','unreported','nao informado','nao informada','nao disponivel','nao consta','metodo nao informado','metodo desconhecido','desconhecido','desconhecida','n/a','na','null','none','—','-'].includes(norm(value)));
const number=value=>(typeof value==='number'||(typeof value==='string'&&/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim())))&&Number.isFinite(Number(value))?Number(value):null;
const unique=values=>[...new Set(values)];
const day=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:$|T|\s)/.test(value))return null;
  const result=value.slice(0,10),parsed=new Date(`${result}T12:00:00Z`);
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===result?result:null;
};
const inside=(date,bounds)=>Boolean(date&&date>=bounds.start&&date<=bounds.end);
const groups=(rows,key)=>{const map=new Map();for(const row of rows){const id=key(row);if(!map.has(id))map.set(id,[]);map.get(id).push(row);}return map;};
const ordered=rows=>rows.slice().sort((a,b)=>a.date.localeCompare(b.date)||String(a.key).localeCompare(String(b.key)));
const sourceState=(status,key)=>status?.[key]==='ready'?'ready':status?.[key]==='error'?'error':status?.[key]==='loading'?'loading':'unavailable';
const state=(status,key,count)=>sourceState(status,key)==='ready'?(count?'ready':'empty'):sourceState(status,key);
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const fingerprint=value=>JSON.stringify(stable(value));

// Exact duplicate observations may be counted once. Conflicting identities are
// excluded; no source row is silently preferred over another one.
function deduplicate(rows,key,shape){
  const result=[],duplicates=[];
  for(const[id,list]of groups(rows,key)){
    const variants=[...groups(list,row=>fingerprint(shape(row))).values()].map(items=>items[0]);
    if(list.length>1)duplicates.push({key:id,count:list.length,conflicting:variants.length>1});
    if(variants.length===1)result.push(variants[0]);
  }
  return {rows:result,duplicates};
}

const decimalPattern='[+-]?(?:\\d+(?:[.,]\\d+)?|[.,]\\d+)';
function decimal(raw){
  // A single separator with three trailing digits can be a thousands separator.
  if(!new RegExp(`^${decimalPattern}$`).test(raw)||/^[+-]?[1-9]\d{0,2}[.,]\d{3}$/.test(raw))return null;
  const value=Number(raw.replace(',','.'));return Number.isFinite(value)?value:null;
}
function referenceInterval(reference,unit){
  if(!known(unit)||!text(reference))return null;
  const original=text(reference);
  // A single explicitly qualified range belongs to this report. Preserve its
  // qualification rather than selecting a population or a clinical target.
  const scopeMatch=original.match(/^(Homens|Mulheres|Sexo masculino|Sexo feminino|Masculino|Feminino|Adultos|Homens adultos|Maiores de \d+ anos|Maior que \d+ anos|Homens até \d+ anos|\d+ a \d+ anos):\s*/i);
  const scope=scopeMatch?scopeMatch[1]:null;
  let input=scopeMatch?original.slice(scopeMatch[0].length):original;
  input=input.replace(/;\s*resultado confirmado após diluição$/i,'');
  // Unambiguous wording only. Multiple conditions and advice remain unread
  // by this parser and visible verbatim in the result.
  input=input.replace(/^maior ou igual a\s*/i,'>= ').replace(/^menor ou igual a\s*/i,'<= ')
    .replace(/^(?:inferior a|menor que)\s*/i,'< ').replace(/^(?:superior a|maior que)\s*/i,'> ').replace(/^até\s*/i,'<= ');
  // % is an explicit unit even when the report omits the separating space.
  if(unit==='%')input=input.replace(/(\d)%$/,'$1 %');
  const limit=input.match(new RegExp(`^(<=|>=|<|>|≤|≥)\\s*(${decimalPattern})(?:\\s+(.+))?$`));
  if(limit){
    const value=decimal(limit[2]);if(value==null||(limit[3]&&text(limit[3])!==unit))return null;
    const below=['<','<=','≤'].includes(limit[1]),inclusive=['<=','>=','≤','≥'].includes(limit[1]);
    return {lower:below?null:value,upper:below?value:null,lowerInclusive:below?false:inclusive,upperInclusive:below?inclusive:false,reference:original,unit,scope};
  }
  const range=input.match(new RegExp(`^(${decimalPattern})\\s*(?:a|até|to|[-–—])\\s*(${decimalPattern})(?:\\s+(.+))?$`,'i'));
  if(!range)return null;
  const lower=decimal(range[1]),upper=decimal(range[2]);
  if(lower==null||upper==null||lower>=upper||(range[3]&&text(range[3])!==unit))return null;
  return {lower,upper,lowerInclusive:true,upperInclusive:true,reference:original,unit,scope};
}

function referencePosition(value,range){
  if(value==null||!range)return 'unknown';
  if(range.lower!=null&&(value<range.lower||(!range.lowerInclusive&&value===range.lower)))return 'below';
  if(range.upper!=null&&(value>range.upper||(!range.upperInclusive&&value===range.upper)))return 'above';
  return 'within';
}
function distanceToRange(value,range){
  if(value==null||!range)return null;
  if(range.lower!=null&&value<range.lower)return range.lower-value;
  if(range.upper!=null&&value>range.upper)return value-range.upper;
  return 0;
}
const intervalKey=range=>range?JSON.stringify([range.lower,range.upper,range.lowerInclusive,range.upperInclusive,range.unit,norm(range.scope)]):null;
function exactValue(row,documentaryReading){
  const value=number(row.result_numeric);if(value==null)return null;
  // A reported non-exact extraction must not become exact merely because the
  // raw qualifier is missing or the numeric projection resembles a plain value.
  if([row.numeric_kind,row.source_payload?.numeric_kind].some(kind=>kind!=null&&kind!==''&&(typeof kind!=='string'||kind.trim().toLowerCase()!=='exact')))return null;
  const reviewedKind=norm(row.numeric_kind||row.source_payload?.numeric_kind);
  // An explicit invalid additive proof cannot fall back to an older review or
  // the generic numeric reader. Absence preserves the legacy Hb/Ht contract.
  if(hasDocumentaryNumericProof(row))return documentaryReading?.value??null;
  const raw=text(row.result_raw);if(!raw)return value;
  // Only an existing, row-bound documentary Hb/Ht review can interpret (1).
  // The original raw result remains visible; no source value is rewritten.
  if(raw.endsWith('(1)'))return reviewedHemogramFootnoteValue(row);
  // Grouped whole counts need an explicitly reviewed exact extraction, a
  // count unit and agreement with the structured number. Generic 1.234 remains
  // ambiguous; censored values, suffixes and conflicting numbers never qualify.
  if(reviewedKind==='exact'&&['/mm3','/uL','/µL','/μL'].includes(text(row.unit))&&/^[1-9]\d{0,2}(?:\.\d{3})+$/.test(raw)){
    const whole=Number(raw.replaceAll('.',''));return Number.isSafeInteger(whole)&&whole===value?value:null;
  }
  const match=raw.match(new RegExp(`^(${decimalPattern})(?:\\s+(.+))?$`));
  if(!match||(match[2]&&text(match[2])!==text(row.unit)))return null;
  // result_numeric is authoritative, but contradictory or censored raw results
  // cannot become exact values for comparison or reference classification.
  return decimal(match[1])===value?value:null;
}
function reportedFlag(flag){
  if(flag===true)return true;
  if(!known(flag))return false;
  return !['normal','n','within','within range','dentro da referencia','dentro da faixa','sem alteracao','sem alteracoes','sem flag','false','false flag','0','no','nao'].includes(norm(flag));
}
function laboratoryObservation(row,bounds){
  const documentaryReading=reviewedDocumentaryNumericReading(row);
  const date=day(row.collection_date),unit=text(row.unit),value=number(row.result_numeric),exact=exactValue(row,documentaryReading),reference=text(row.reference_range)||null;
  const interval=referenceInterval(reference,unit),position=referencePosition(exact,interval),flag=reportedFlag(row.flag);
  return {key:text(row.source_record_id)||fingerprint([date,row.biomarker,row.laboratory,unit,row.method,row.result_raw,row.result_numeric,reference]),
    sourceRecordId:text(row.source_record_id)||null,date,collection_date:date,biomarker:text(row.biomarker)||'Marcador não informado',markerKnown:known(row.biomarker),laboratory:text(row.laboratory)||null,
    value,rawValue:text(row.result_raw)||null,unit:unit||null,reference,method:text(row.method)||null,source:text(row.source)||null,
    sourceFile:text(row.source_file)||null,reportDate:day(row.report_date),numericKind:text(row.numeric_kind||row.source_payload?.numeric_kind)||null,
    ...(documentaryReading?{documentaryNumericReading:documentaryReading}:{}),
    exactValue:exact,interval,referencePosition:position,referenceLabel:position==='within'?'dentro da referência':['below','above'].includes(position)?'fora da referência':null,
    referenceScope:interval?.scope||null,currentReferenceLabel:position==='unknown'?null:`${({within:'Dentro da faixa transcrita no laudo',below:'Abaixo da faixa transcrita no laudo',above:'Acima da faixa transcrita no laudo'})[position]}${interval?.scope?' · '+interval.scope:''}`,
    flag:typeof row.flag==='string'?text(row.flag):row.flag===true?true:null,reportedFlag:flag,attention:flag||['below','above'].includes(position),
    attentionLabel:flag||['below','above'].includes(position)?'atenção ao laudo':null,inPeriod:inside(date,bounds),
    periodLabel:inside(date,bounds)?'No período selecionado':'Fora do período selecionado'};
}
const labIdentity=row=>JSON.stringify([norm(row.biomarker),text(row.unit),norm(row.laboratory),row.markerKnown?null:row.key]);
function comparisonReasonLabel(reason,current,previous){
  if(reason==='ambiguous_collection')return 'Há múltiplos resultados na mesma coleta; nenhum foi escolhido para comparação.';
  if(reason==='no_previous')return 'Sem coleta anterior nesta série de laboratório e unidade.';
  if(reason==='unknown_laboratory')return 'Laboratório não informado em uma das coletas.';
  if(reason==='unknown_unit')return 'Unidade não informada em uma das coletas.';
  if(reason==='non_exact_value')return `${current.exactValue==null?'O resultado atual':'O resultado anterior'} é textual, um limite ou tem formato numérico não confirmado para comparação automática.`;
  if(reason==='unknown_method')return `Método ${!known(current.method)&&!known(previous?.method)?'não informado nas duas coletas':!known(current.method)?'não informado na coleta atual':'não informado na coleta anterior'}.`;
  if(reason==='different_method')return 'Os métodos registrados são diferentes.';
  if(reason==='different_or_missing_reference')return !known(current.reference)&&!known(previous?.reference)?'Referências não informadas nas duas coletas.':!known(current.reference)?'Referência não informada na coleta atual.':!known(previous?.reference)?'Referência não informada na coleta anterior.':'As referências registradas são diferentes.';
  return 'Mesmo laboratório, unidade, método e referência registrados; diferença numérica entre coletas.';
}
function compareLabs(current,previous,ambiguous){
  const sameMethod=Boolean(previous&&known(current.method)&&known(previous.method)&&norm(current.method)===norm(previous.method));
  const sameReference=Boolean(previous&&known(current.reference)&&known(previous.reference)&&(current.reference===previous.reference||(intervalKey(current.interval)&&intervalKey(current.interval)===intervalKey(previous.interval))));
  const reason=ambiguous?'ambiguous_collection':!previous?'no_previous':!known(current.laboratory)||!known(previous.laboratory)?'unknown_laboratory':
    !known(current.unit)||!known(previous.unit)?'unknown_unit':current.exactValue==null||previous.exactValue==null?'non_exact_value':
    !known(current.method)||!known(previous.method)?'unknown_method':!sameMethod?'different_method':!sameReference?'different_or_missing_reference':'comparable';
  const comparable=reason==='comparable',rangeComparable=Boolean(comparable&&current.interval&&previous.interval&&intervalKey(current.interval)===intervalKey(previous.interval));
  let label='sem comparação';
  if(rangeComparable){
    const currentInside=current.referencePosition==='within',previousInside=previous.referencePosition==='within';
    const currentDistance=distanceToRange(current.exactValue,current.interval),previousDistance=distanceToRange(previous.exactValue,previous.interval);
    label=currentInside&&previousInside?'dentro da referência':currentInside&&!previousInside?'aproximou da referência':!currentInside&&previousInside?'afastou da referência':
      currentDistance<previousDistance?'aproximou da referência':currentDistance>previousDistance?'afastou da referência':'fora da referência';
  }
  return {comparable,rangeComparable,sameMethod,sameReference,comparisonReason:reason,comparisonReasonLabel:comparisonReasonLabel(reason,current,previous),label,status:label,
    delta:comparable?Number((current.exactValue-previous.exactValue).toPrecision(12)):null,
    comparisonLabel:comparable?'Mesmo laboratório, unidade, método e referência registrados':'Valores separados; comparação não estabelecida'};
}

// Shared read-only contract for consumers of raw laboratory rows. Keep these
// wrappers on the dashboard's existing interpretation; they neither normalize
// source values nor invent documentary evidence for an ambiguous result.
export const knownLabMetadata=known;
export function labResultReading(row={}){
  return laboratoryObservation(row??{},{});
}
export function labHistoryConflicts(rows=[]){
  const observed=rows.map(labResultReading);
  const review=deduplicate(observed,row=>row.sourceRecordId||row.key,row=>row);
  const conflicting=new Set(review.duplicates.filter(row=>row.conflicting).map(row=>row.key));
  const unverified=new Set([...groups(observed.filter(row=>!row.sourceRecordId),row=>row.key)].filter(([,list])=>list.length>1).map(([key])=>key));
  return new Set(rows.filter((row,index)=>row.identityConflict||conflicting.has(observed[index].sourceRecordId||observed[index].key)||unverified.has(observed[index].key)));
}
export function compareLabResults(currentRow,previousRow,{ambiguous=false}={}){
  const current=labResultReading(currentRow),previous=previousRow==null?null:labResultReading(previousRow);
  // The dashboard establishes identity, chronology and collection ambiguity
  // while grouping whole histories. A pairwise consumer must establish them
  // explicitly, and pass ambiguity found elsewhere in the collection.
  const conflict=Boolean(currentRow?.identityConflict||previousRow?.identityConflict||currentRow?.ambiguous||previousRow?.ambiguous||
    (previous&&current.sourceRecordId&&current.sourceRecordId===previous.sourceRecordId));
  const reason=ambiguous||conflict?'ambiguous_collection':!previous?null:
    !current.markerKnown||!previous.markerKnown?'unknown_biomarker':
    norm(current.biomarker)!==norm(previous.biomarker)?'different_biomarker':
    !known(current.laboratory)||!known(previous.laboratory)?'unknown_laboratory':
    norm(current.laboratory)!==norm(previous.laboratory)?'different_laboratory':
    !known(current.unit)||!known(previous.unit)?'unknown_unit':current.unit!==previous.unit?'different_unit':
    !current.date||!previous.date?'invalid_collection_date':current.date<=previous.date?'non_chronological_collections':null;
  const comparison=compareLabs(current,previous,Boolean(reason));
  if(!reason)return comparison;
  const labels={unknown_biomarker:'Marcador não informado em uma das coletas.',different_biomarker:'Os marcadores registrados são diferentes.',
    different_laboratory:'Os laboratórios registrados são diferentes.',different_unit:'As unidades registradas são diferentes.',
    invalid_collection_date:'Data de coleta ausente ou inválida em um dos resultados.',
    non_chronological_collections:'A coleta anterior precisa ter uma data válida anterior à coleta atual.'};
  return {...comparison,comparisonReason:reason,comparisonReasonLabel:labels[reason]||comparisonReasonLabel(reason,current,previous)};
}
export function dashboardLabs(data={},status={},bounds={}){
  const available=status.labs==='ready',observed=available?(data.labs||[]).filter(row=>day(row?.collection_date)&&day(row.collection_date)<=bounds.end).map(row=>laboratoryObservation(row,bounds)):[];
  const canonical=deduplicate(observed,row=>row.sourceRecordId||row.key,row=>row);
  const unverifiedIds=new Set([...groups(observed.filter(row=>!row.sourceRecordId),row=>row.key)].filter(([,rows])=>rows.length>1).map(([key])=>key));
  canonical.rows=canonical.rows.filter(row=>!unverifiedIds.has(row.key));
  canonical.duplicates=canonical.duplicates.map(row=>unverifiedIds.has(row.key)?{...row,conflicting:true,reason:'unverified_identity'}:row);
  // Keep conflicting laboratory observations readable, including a conflict on
  // the newest collection. Never silently substitute an older value as latest.
  const conflictingIds=new Set(canonical.duplicates.filter(row=>row.conflicting).map(row=>row.key));
  const conflicts=[...groups(observed.filter(row=>conflictingIds.has(row.sourceRecordId||row.key)),fingerprint).values()].map(([row])=>({...row,identityConflict:true}));
  const history=ordered([...canonical.rows,...conflicts]),periodRows=history.filter(row=>row.inPeriod),items=[];
  for(const[key,list]of groups(history,labIdentity)){
    const byDate=groups(list,row=>row.date),latestDate=list.at(-1).date,latest=byDate.get(latestDate),ambiguous=latest.length>1||latest.some(row=>row.identityConflict);
    const previousDate=[...byDate.keys()].filter(date=>date<latestDate).sort().at(-1),prior=previousDate?byDate.get(previousDate):[];
    const previous=prior.length===1&&!prior[0].identityConflict?prior[0]:null,current=latest[0];
    const comparison=compareLabs(current,previous,ambiguous||prior.length>1||prior.some(row=>row.identityConflict));
    const item={...current,key,...comparison,previous,previousDate:previous?.date||null,priorOutside:Boolean(previous&&!previous.inPeriod),ambiguous,
      observations:latest,history:list,periodHistory:list.filter(row=>row.inPeriod),ambiguousDates:[...byDate].filter(([,rows])=>rows.length>1||rows.some(row=>row.identityConflict)).map(([date])=>date),
      references:[...(previous?[{date:previous.date,reference:previous.reference,unit:previous.unit,method:previous.method,laboratory:previous.laboratory}]:[]),
        ...latest.map(row=>({date:row.date,reference:row.reference,unit:row.unit,method:row.method,laboratory:row.laboratory}))],
      dates:{previous:previous?.date||null,current:latestDate},selectionNote:'Ordem alfabética; sem classificação de gravidade clínica.'};
    if(ambiguous){
      Object.assign(item,{value:null,rawValue:null,exactValue:null,reference:null,interval:null,referencePosition:'unknown',referenceLabel:null,currentReferenceLabel:null,referenceScope:null,method:null,
        attention:latest.some(row=>row.attention),attentionLabel:latest.some(row=>row.attention)?'atenção ao laudo':null,
        flag:null,reportedFlag:latest.some(row=>row.reportedFlag),comparisonLabel:'Múltiplos resultados na mesma data; consulte cada observação'});
      // A collection summary must not expose one arbitrarily chosen derived
      // value; each original observation retains its own documentary reading.
      delete item.documentaryNumericReading;
    }
    items.push(item);
  }
  items.sort((a,b)=>a.biomarker.localeCompare(b.biomarker,'pt-BR')||String(a.laboratory).localeCompare(String(b.laboratory),'pt-BR')||String(a.unit).localeCompare(String(b.unit)));
  const collectionDates=unique(history.map(row=>row.date)).sort(),latestCollectionDate=collectionDates.at(-1)||null;
  const latestCollectionRows=history.filter(row=>row.date===latestCollectionDate),latestCollectionItems=items.filter(row=>row.date===latestCollectionDate);
  // Summary rows all come from the newest collection. Older series are still
  // readable, but their direction/flag cannot masquerade as a current finding.
  const n=predicate=>available?latestCollectionItems.filter(predicate).length:null;
  const latestCollectionSummary={count:available?latestCollectionItems.length:null,results:available?latestCollectionRows.length:null,
    attention:n(row=>row.attention),reportedFlags:n(row=>row.reportedFlag),within:n(row=>row.referencePosition==='within'),
    above:n(row=>row.referencePosition==='above'),below:n(row=>row.referencePosition==='below'),unclassified:n(row=>row.referencePosition==='unknown'),
    near:n(row=>row.label==='aproximou da referência'),away:n(row=>row.label==='afastou da referência'),
    comparable:n(row=>row.comparable),ambiguous:n(row=>row.ambiguous)};
  return {available,status:state(status,'labs',history.length),items,allItems:items,latestRows:items,
    latestCollectionDate,latestCollectionRows,latestCollectionItems,latestCollectionCount:available?latestCollectionRows.length:null,latestCollectionSummary,
    collectionDates,collectionCountAll:available?collectionDates.length:null,historicalCollectionCount:available?Math.max(0,collectionDates.length-1):null,rows:periodRows,periodRows,history,
    count:available?periodRows.length:null,knownCount:available?history.length:null,collectionCount:available?unique(periodRows.map(row=>row.date)).length:null,
    latestDate:history.at(-1)?.date||null,inPeriodCount:items.filter(row=>row.inPeriod).length,outsidePeriodCount:items.filter(row=>!row.inPeriod).length,
    duplicates:canonical.duplicates,partial:canonical.duplicates.some(row=>row.conflicting),
    note:'Últimos resultados conhecidos até o fim da janela; datas externas são identificadas. Referências pertencem a cada laudo. Aproximação da faixa e direção numérica não definem melhora clínica, diagnóstico ou meta individual.'};
}

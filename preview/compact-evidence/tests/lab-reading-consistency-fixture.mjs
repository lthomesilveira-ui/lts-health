import {makeConsumerLanguageFixture,consumerLanguageService,languageDatabase,LANGUAGE_TODAY} from './consumer-language-fixture.mjs';
import {makeReviewedBloodCountPair} from './reviewed-blood-count-fixture.mjs';

// Invented data only. None of these values, identifiers or documentary excerpts
// comes from a person, a real health export, a real account or a real PDF.
export const LAB_READING_TODAY=LANGUAGE_TODAY;
export const LAB_READING_CONDITIONAL_REFERENCE='Com jejum: inferior a 150 mg/dL; sem jejum: inferior a 175 mg/dL. Condições distintas permanecem como texto original.';
export const LAB_READING_LITERAL='Não quantificado <4 & observação <b>literal</b>: este resultado sintético permanece escrito por inteiro, com pontuação e palavras originais, mesmo quando ocupa várias linhas em uma tela pequena.';
export const labMarkerKey=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export const labOriginalText=row=>`${row.result_raw}${row.unit&&!row.result_raw.toLowerCase().includes(row.unit.toLowerCase())?` ${row.unit}`:''}`;
const dateBefore=age=>new Date(Date.parse(`${LAB_READING_TODAY}T12:00:00Z`)-age*86400000).toISOString().slice(0,10);
const row=(id,marker,age,value,extra={})=>({
  source_record_id:`synthetic-reading-${id}`,collection_date:dateBefore(age),report_date:dateBefore(age),
  laboratory:'Laboratório sintético de consistência',biomarker:marker,result_raw:String(value).replace('.',','),result_numeric:value,
  unit:'u',reference_range:'1 a 30',method:'Método sintético registrado',source:'Laudo inventado para QA',source_file:'laudo-sintetico.pdf',...extra
});
const payloadRow=input=>{
  const result=structuredClone(input);
  result.source_payload={numeric_kind:result.numeric_kind??null,reference_verification:result.reference_verification??null};
  delete result.numeric_kind;delete result.reference_verification;
  return result;
};
export function makeLabReadingConsistencyFixture({proof='valid',empty=false}={}){
  if(!['valid','swapped'].includes(proof))throw new Error('Use only invented valid or swapped proof');
  const f=makeConsumerLanguageFixture('empty'),scenes=[];
  const pair=(key,marker,previousExtra={},currentExtra={},expect={})=>{
    const previous=row(`${key}-previous`,marker,21,12,previousExtra),current=row(`${key}-current`,marker,2,14,currentExtra);
    const scene={key,marker,rows:[previous,current],latest:current,expectedPoints:2,comparable:false,...expect};
    scenes.push(scene);return scene;
  };
  pair('comparable','Glicose',{result_raw:'82',result_numeric:82,unit:'mg/dL',reference_range:'70 a 99'},{result_raw:'88',result_numeric:88,unit:'mg/dL',reference_range:'70 a 99'},{comparable:true,delta:'+6,00 mg/dL',classified:true});
  pair('previous-lower-limit','Limite inferior sintético',{result_raw:'<7',result_numeric:7},{},{expectedPoints:1,reason:'non-exact'});
  pair('current-upper-limit','Estradiol',{},{result_raw:'>8',result_numeric:8},{expectedPoints:1,reason:'non-exact',classified:false});
  pair('unreviewed-footnote','Ferritina',{},{result_raw:'18,4(1)',result_numeric:18.4},{expectedPoints:1,reason:'non-exact',classified:false});
  pair('raw-number-disagreement','TSH',{},{result_raw:'3,1',result_numeric:2.7},{expectedPoints:1,reason:'non-exact',classified:false});
  pair('non-exact-kind','T4 Livre',{},{result_raw:'1,3',result_numeric:1.3,numeric_kind:'censored'},{expectedPoints:1,reason:'non-exact',classified:false});
  pair('unconfirmed-thousands','Leucócitos',{unit:'/mm3',reference_range:'3000 a 10000',result_raw:'7321',result_numeric:7321},{unit:'/mm3',reference_range:'3000 a 10000',result_raw:'7.654',result_numeric:7654},{expectedPoints:1,reason:'non-exact',classified:false});
  pair('reviewed-exact-count','Contagem exata sintética',{unit:'/mm3',reference_range:'3000 a 10000',result_raw:'7.321',result_numeric:7321,numeric_kind:'exact'},{unit:'/mm3',reference_range:'3000 a 10000',result_raw:'7.654',result_numeric:7654,numeric_kind:'exact'},{comparable:true,delta:'+333,00 /mm3'});
  pair('reference-changed','HDL-Colesterol',{reference_range:'10 a 30'},{reference_range:'12 a 40'},{reason:'reference'});
  pair('reference-missing','Referência ausente sintética',{reference_range:null},{reference_range:null},{reason:'reference'});
  pair('method-missing','Vitamina B-12',{method:''},{method:''},{reason:'method'});
  pair('method-placeholder','Método não informado sintético',{method:'Não informado'},{method:'Não informado'},{reason:'method'});
  pair('laboratory-missing','Laboratório ausente sintético',{laboratory:null},{laboratory:null},{reason:'laboratory'});
  pair('unit-missing','Unidade ausente sintética',{unit:null},{unit:null},{expectedPoints:0,reason:'unit'});
  for(const [key,marker,previousExtra,currentExtra] of [
    ['method-changed','Método diferente sintético',{method:'Método sintético A'},{method:'Método sintético B'}],
    ['laboratory-changed','Laboratório diferente sintético',{laboratory:'Laboratório sintético A'},{laboratory:'Laboratório sintético B'}],
    ['unit-changed','Unidade diferente sintética',{unit:'mg/dL'},{unit:'mmol/L'}]
  ])pair(key,marker,previousExtra,currentExtra,{expectedPoints:1,cohorts:2,reason:'separate-cohorts'});
  const interrupted=pair('interrupted-cohort','Série interrompida sintética',{method:'Método sintético A'},{method:'Método sintético A'},{expectedPoints:2,cohorts:2,reason:'interrupted'});
  interrupted.rows.splice(1,0,row('interrupted-cohort-middle',interrupted.marker,12,null,{method:'Método sintético B',result_raw:'Não quantificado',result_numeric:null}));
  const conditional=row('conditional-reference','Triglicérides',2,124,{unit:'mg/dL',reference_range:LAB_READING_CONDITIONAL_REFERENCE});
  scenes.push({key:'conditional-reference',marker:conditional.biomarker,rows:[conditional],latest:conditional,expectedPoints:1,comparable:false,classified:false});
  const literal=row('literal-result','Resultado textual sintético',2,4,{result_raw:LAB_READING_LITERAL,result_numeric:null,unit:null});
  scenes.push({key:'literal-result',marker:literal.biomarker,rows:[literal],latest:literal,expectedPoints:0,comparable:false,literal:true});
  const latest=pair('latest-inexact','25-OH Vitamina D Total',{result_raw:'21',result_numeric:21},{result_raw:'<4',result_numeric:4},{expectedPoints:2,reason:'non-exact',classified:false});
  latest.rows.unshift(row('latest-inexact-earlier',latest.marker,42,18));
  const ambiguous=pair('conflicting-latest','Apolipoproteína B',{},{result_raw:'19',result_numeric:19},{expectedPoints:1,reason:'ambiguous',ambiguous:true});
  ambiguous.rows.push({...ambiguous.latest,source_record_id:'synthetic-reading-conflicting-latest-other',result_raw:'22',result_numeric:22});
  const history=Array.from({length:13},(_,index)=>row(`archive-${index}`,'Marcador histórico sintético',index*37+2,10+index,{result_raw:`${10+index},00`}));
  scenes.push({key:'paginated-history',marker:history[0].biomarker,rows:history,latest:history[0],expectedPoints:13,comparable:true,history:true});
  const pairs=['Hemoglobina','Hematócrito'].map(marker=>makeReviewedBloodCountPair(marker));
  if(proof==='swapped'){
    // Genuine-looking synthetic proof copied from the other marker must fail
    // the row-bound checks, without overwriting either raw or numeric result.
    const first=structuredClone(pairs[0].previous.reference_verification);
    pairs[0].previous.reference_verification=structuredClone(pairs[1].previous.reference_verification);
    pairs[1].previous.reference_verification=first;
  }
  for(const pair of pairs)scenes.push({key:pair.current.biomarker==='Hemoglobina'?'reviewed-hb':'reviewed-ht',marker:pair.current.biomarker,rows:[pair.previous,pair.current],latest:pair.current,expectedPoints:proof==='valid'?2:1,comparable:proof==='valid',proof,reason:proof==='valid'?null:'non-exact'});
  f.data.labs=empty?[]:scenes.flatMap(scene=>scene.rows).map(payloadRow);
  f.db=languageDatabase(f.data);
  return {...f,proof,empty,scenes:empty?[]:scenes,date:dateBefore};
}

// Keep the established production-path SDK and failure controls, but require
// the real loader to request each lab projection. Source payloads cannot leak
// through this mock and accidentally make a missing projection test pass.
export function labReadingConsistencyService(db,{signedOut=false,...options}={}){
  let script=consumerLanguageService(db,options);
  const needle='return selected;};';
  if(script.split(needle).length!==2)throw new Error('The shared SDK mock changed; review lab projection before continuing');
  script=script.replace(needle,`return table==='health_lab_results'?selected.map(row=>{
    const fields=projection.split(','),copy={};
    for(const field of fields){
      if(field==='numeric_kind:source_payload->>numeric_kind')copy.numeric_kind=row.source_payload?.numeric_kind??null;
      else if(field==='reference_verification:source_payload->reference_verification')copy.reference_verification=row.source_payload?.reference_verification??null;
      else if(field!=='*'&&field!=='source_payload'&&Object.hasOwn(row,field))copy[field]=structuredClone(row[field]);
    }
    return copy;
  }):selected;};`);
  if(signedOut){
    const session="session:{user:{id:'synthetic-history-browser-user'}}";
    if(script.split(session).length!==2)throw new Error('The shared SDK auth mock changed; review signed-out setup');
    script=script.replace(session,'session:null');
  }
  return script;
}

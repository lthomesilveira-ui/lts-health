import {createHash} from 'node:crypto';

// Independently invented fixture data. No patient row, PDF, identifier,
// accession, date, numerical value or private evidence is copied here.
export const documentarySyntheticSha256=value=>createHash('sha256').update(value,'utf8').digest('hex');
const hash=documentarySyntheticSha256;
const bindingKeys=['id','source_record_id','source_file','biomarker','unit','collection_date','report_date','result_raw','result_numeric'];
const printedDate=value=>value.split('-').reverse().join('/');
export function makeDocumentaryNumericRow({kind='footnote',token,clinicalToken,grouping='local',id='a',
  collection_date='2024-06-12',report_date=collection_date,biomarker='Marcador sintético documental',unit='u/L',
  method='Método sintético documental',laboratory='Laboratório imaginário',reference_range='10 a 90 u/L',...overrides}={}){
  if(!['footnote','grouped','footnote_grouped'].includes(kind))throw new Error('Unknown synthetic fixture kind');
  const suffix=kind!=='grouped',isGrouped=kind!=='footnote';
  token??=isGrouped?'4.670':'73,4';
  const value=Number(token.replaceAll('.','').replace(',','.'));
  clinicalToken??=isGrouped&&grouping==='ungrouped'?String(value):token;
  const row={id:`synthetic-documentary-id-${id}`,source_record_id:`synthetic-documentary-source-${id}`,collection_date,report_date,
    biomarker,unit,method,laboratory,reference_range,result_raw:`${token}${suffix?'(1)':''}`,result_numeric:value,
    source:'Documento inteiramente sintético',source_file:'relatorio-totalmente-inventado.pdf',numeric_kind:null,flag:null,...overrides};
  const accession='SYNTHETIC-ACCESSION',printed=biomarker.toUpperCase(),evidence=`${printed}: ${clinicalToken} ${unit}`;
  const analyteStart=evidence.indexOf(printed),resultStart=printed.length+2,unitStart=resultStart+clinicalToken.length+1;
  const identity=`${accession} | ${printedDate(collection_date)}`,evolution=`${biomarker} | ${accession} | ${printedDate(collection_date)} | ${row.result_raw}`;
  const legend='Resultado fora da faixa de referência.',notation=`Amostra decimal sintética: 8,6 u/L. Contagem sintética: ${token} ${unit}`;
  row.numeric_reading_verification={schema:'documentary_numeric_reading_v1',status:'source_verified',
    audit_id:'synthetic-independent-documentary-review',reviewed_at:'2024-07-01T10:30:00Z',
    binding:Object.fromEntries(bindingKeys.map(key=>[key,row[key]])),
    document:{pdf_sha256:hash('Invented PDF bytes for a documentary synthetic fixture'),source_file_id:'synthetic-documentary-file',
      library_file_id:'synthetic-documentary-library',pdf_page_count:9,visual_review_pages:[2,6,8]},
    clinical:{section:'current_report_result_section',pdf_page:2,printed_analyte:printed,numeric_token:clinicalToken,printed_unit:unit,
      collection_date,accession,evidence_text:evidence,evidence_text_sha256:hash(evidence),
      spans:{analyte:[analyteStart,analyteStart+printed.length],result:[resultStart,resultStart+clinicalToken.length],unit:[unitStart,unitStart+unit.length]},
      identity_text:identity,identity_text_sha256:hash(identity),result_has_footnote_1:false,
      result_unit_confirmed_without_evolution_reference_column:true,pixels_inspected:true},
    evolution:{section:'LAUDO EVOLUTIVO',pdf_page:6,printed_analyte:biomarker,accession,collection_date,result_raw:row.result_raw,
      evidence_text:evolution,evidence_text_sha256:hash(evolution),result_cell_only:true,reference_column_used_for_clinical_range:false,
      footnote_is_visually_superscript:suffix,pixels_inspected:true},
    footnote:suffix?{token:'(1)',legend,scope:'LAUDO EVOLUTIVO only',meaning:'source_reported_outside_reference_annotation',
      pdf_page:8,evidence_text:legend,evidence_text_sha256:hash(legend),pixels_inspected:true}:null,
    locale:{decimal_separator:',',thousands_separator:'.',grouping_length:3,scope:'exact_bound_record',
      grouping_evidence:!isGrouped?null:grouping==='ungrouped'?{kind:'ungrouped_clinical_confirmation'}:
        {kind:'document_local_notation',pdf_page:2,evidence_text:notation,evidence_text_sha256:hash(notation),
          decimal_comma_token:'8,6',grouped_integer_token:token,pixels_inspected:true}}};
  return row;
}
export function makeDocumentaryNumericPair(options={}){
  const previous=makeDocumentaryNumericRow({...options,id:'previous'});
  const current={...previous,id:'synthetic-documentary-id-current',source_record_id:'synthetic-documentary-source-current',
    collection_date:'2024-07-12',report_date:'2024-07-12',result_numeric:previous.result_numeric+1,
    result_raw:String(previous.result_numeric+1).replace('.',','),numeric_kind:'exact',numeric_reading_verification:null};
  return {previous,current};
}

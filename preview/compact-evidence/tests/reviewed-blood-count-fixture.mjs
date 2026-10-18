import {createHash} from 'node:crypto';

// Invented reports only; never generated from a patient record or document.
export const syntheticSha256=value=>createHash('sha256').update(value,'utf8').digest('hex');
export function makeReviewedBloodCountPair(marker='Hemoglobina'){
  if(!['Hemoglobina','Hematócrito'].includes(marker))throw new Error('Synthetic Hb/Ht fixture only');
  const hemoglobin=marker==='Hemoglobina',stem=hemoglobin?'18,4':'51,3',unit=hemoglobin?'g/dL':'%',reference=hemoglobin?'12,1 a 15,9':'37,4 a 48,2';
  const previous={source_record_id:`synthetic-reviewed-${hemoglobin?'hb':'ht'}-prior`,collection_date:'2025-03-20',report_date:'2025-03-20',
    laboratory:'Laboratório sintético',biomarker:marker,result_raw:`${stem}(1)`,result_numeric:Number(stem.replace(',','.')),
    unit,reference_range:reference,flag:'reported_outside_reference',method:'Método sintético de contagem',numeric_kind:null,
    source:'Relatório sintético',source_file:'hemograma-inventado.pdf',confidence:'high',notes:'Synthetic test data only'};
  const evidence=`HEMOGRAMA, sangue total\nVALORES DE REFERÊNCIA / Escopo sintético\n${marker.toUpperCase()} : ${stem} ${unit} ${reference}\nRECEBIDO/COLETADO EM: 20/03/2025`;
  previous.reference_verification={status:'source_verified',audit_id:'synthetic-document-review',source_section:'current_report_result_section',
    source_file:previous.source_file,source_file_id:'synthetic-document-id',library_file_id:'synthetic-library-id',collection_date:previous.collection_date,
    reference_unit:unit,reference_text:reference,pdf_sha256:syntheticSha256('Synthetic PDF identity, no real document bytes'),
    pdf_page:2,pdf_page_count:12,visual_review_pages:[2],evidence_text:evidence,evidence_text_sha256:syntheticSha256(evidence),
    result_raw_preserved:true,result_numeric_preserved:true,
    evolution_footnote:{legend:'Resultado fora da faixa de referência.',
      meaning:'The superscript (1) belongs to the evolutionary table; it is not a decimal digit or a censoring limit.',
      table_page:7,legend_page:10,visual_review_pages:[7,10],raw_result_string_preserved:previous.result_raw}};
  const currentValue=hemoglobin?18.9:52.4;
  const current={...previous,source_record_id:`synthetic-reviewed-${hemoglobin?'hb':'ht'}-current`,collection_date:'2025-04-20',report_date:'2025-04-20',
    result_raw:String(currentValue).replace('.',','),result_numeric:currentValue,numeric_kind:'exact',reference_verification:null,source_file:'hemograma-inventado-seguinte.pdf'};
  return {previous,current};
}

import { getDocumentProxy, definePDFJSModule } from 'npm:unpdf@1.7.0';
import { readFleuryPdf, FLEURY_PREVIEW_VERSION, FLEURY_LIMITS } from './fleury-lab-preview.mjs';

// Pin the serverless bundle explicitly; do not depend on runtime-specific bare
// package self-resolution or PDF.js dynamically loading another worker version.
await definePDFJSModule(() => import('npm:unpdf@1.7.0/pdfjs'));

// Called only after the generic inspector verifies the owner and downloads the
// owner's private object with that user's JWT. Never use a service-role client.
export async function inspectFleuryPdf(sb: any, file: Blob) {
  const held = (reason: string) => ({
    parserVersion: FLEURY_PREVIEW_VERSION,
    p: { detected_format:'pdf',detected_schema:'fleury_text_report',row_count:null,column_names:[],sample:{lab_preview:{kind:'fleury_lab_preview_v1',read_only:true,results:[],reason}},date_min:null,date_max:null,status:'review_required',warnings:['O original está guardado. Este formato não pôde ser lido por completo; nenhum resultado foi incluído ou alterado.'] },
    auto: { imported:0,lab_preview:true }
  });
  if(file.size>FLEURY_LIMITS.bytes)return held('pdf_size_limit');
  try {
    const bytes=new Uint8Array(await file.arrayBuffer());
    const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
    const parsed=await readFleuryPdf(bytes,getDocumentProxy);
    const {data:documents,error:documentError}=await sb.from('health_documents').select('checksum,extraction_status,confidence').eq('checksum',sha256);
    const source_verified=!documentError && (documents||[]).some((d:any)=>d.extraction_status==='validated'&&d.confidence==='high');
    let history_available=false, history_matches=0;
    const results=parsed.results.map((row:any)=>({...row,already_in_history:false}));
    if(source_verified){
      const {data:existing,error}=await sb.from('health_lab_results').select('biomarker,collection_date,result_raw,result_numeric,unit,source_payload').contains('source_payload',{sha256});
      history_available=!error;
      if(!error){
        const unit=(u:string|null)=>u==='mcg/dL'?'microg/dL':u;
        for(const row of results){
          const candidates=(existing||[]).filter((r:any)=>r.biomarker===row.biomarker&&r.collection_date===row.collection_date&&row.source_pages.includes(Number(r.source_payload?.pdf_page)));
          const same=candidates.length===1&&unit(candidates[0].unit)===unit(row.unit)&&(
            row.result_numeric===null ? candidates[0].result_numeric===null&&String(candidates[0].result_raw).trim().toLocaleLowerCase('pt-BR')===row.result_raw.trim().toLocaleLowerCase('pt-BR') : candidates[0].result_numeric!==null&&Number(candidates[0].result_numeric)===row.result_numeric
          );
          row.already_in_history=same;if(same)history_matches++;
        }
      }
    }
    const dates=[...new Set(results.map((r:any)=>r.collection_date))].sort();
    const complete=parsed.unsupported_blocks.length===0&&parsed.conflicts.length===0;
    const verified=complete&&source_verified&&history_available&&history_matches===results.length;
    return {
      parserVersion:FLEURY_PREVIEW_VERSION,
      p:{detected_format:'pdf',detected_schema:'fleury_text_report',row_count:results.length,column_names:['biomarker','result_raw','unit','collection_date','pdf_page'],
        sample:{source_sha256:sha256,lab_preview:{kind:parsed.kind,read_only:true,results,page_count:parsed.page_count,document_print_dates:parsed.document_print_dates,source_verified,history_available,history_matches,unsupported_count:parsed.unsupported_blocks.length,conflicts:parsed.conflicts}},
        date_min:dates[0]||null,date_max:dates.at(-1)||null,status:verified?'inspected':'review_required',
        warnings:verified?['Leitura conferida com o original já validado e os resultados presentes no histórico. Nenhum exame foi duplicado ou alterado.']:['Prévia de leitura: nenhum resultado foi incluído ou alterado. Referências, método e interpretação continuam no laudo original.']},
      auto:{imported:0,lab_preview:true}
    };
  } catch {
    // Do not serialize parser exceptions: a PDF library may include source text.
    return held('specialized_reading_unavailable');
  }
}

// Invented document identities and observations, never patient fixtures.
export const LAB_ORIGINAL_TODAY='2026-02-02';
export const LAB_ORIGINAL_ID='libfile_'+'0'.repeat(31)+'3';
export function labOriginalFixture(){
 const sha='a'.repeat(64),source_file='laudo-sintetico.pdf';
 const document={source_record_id:`fleury:document:${sha}`,document_date:'2026-01-30',document_type:'laboratory_report',source_file,source:'Fleury laboratory report',checksum:sha,extraction_status:'validated',confidence:'high',original_file_id:LAB_ORIGINAL_ID,original_page_count:8,original_import_version:'reviewed-20261003-v1'};
 const row={source_record_id:'fleury:2026-01-30:'+'1'.repeat(24),collection_date:'2026-01-30',report_date:'2026-01-31',laboratory:'Fleury',biomarker:'Ferritina',result_raw:'5,25',result_numeric:5.25,unit:'ng/mL',reference_range:'2 a 8',method:'Método sintético',source:'Fleury laboratory report',source_file,confidence:'high',original_file_id:LAB_ORIGINAL_ID,original_sha256:sha,original_page:3,original_page_count:8,original_import_version:'reviewed-20261003-v1',original_date_kind:'report_print_date'};
 return {row,document};
}

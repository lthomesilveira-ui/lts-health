// Independently invented records for navigation and history tests only.
export function labAccessRows(){
 const rows=Array.from({length:33},(_,marker)=>Array.from({length:25},(_,i)=>({
  source_record_id:`synthetic-lab-access-${marker}-${i}`,biomarker:`Marcador sintético ${String(marker+1).padStart(2,'0')}`,
  collection_date:`2024-01-${String(i+1).padStart(2,'0')}`,laboratory:'Laboratório sintético A',method:'Método sintético A',unit:'u/L',
  result_numeric:20+i,result_raw:String(20+i),reference_range:'10 a 90 u/L',source:'Fonte sintética',source_file:'synthetic-labs.csv'
 }))).flat();
 rows.push({...rows[0],source_record_id:'synthetic-lab-access-other-source',laboratory:'Laboratório sintético B',collection_date:'2024-02-01',result_numeric:99,result_raw:'99'});
 rows.push({...rows[0],source_record_id:'synthetic-lab-access-other-unit',unit:'mg/dL',reference_range:'10 a 90 mg/dL',collection_date:'2024-02-02'});
 rows.push({...rows[0],source_record_id:'synthetic-lab-access-text',biomarker:'Marcador textual sintético',collection_date:'2024-02-03',result_numeric:null,result_raw:'Não reagente'});
 return rows;
}

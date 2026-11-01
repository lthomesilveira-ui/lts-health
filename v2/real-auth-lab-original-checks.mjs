// Only source metadata and boolean conclusions leave the protected page scope.
// Patient PDFs are never opened into a workflow capture or public artifact.
export async function verifyLaboratoryOriginalFlow(page,navigate){
 await navigate('saude');await page.locator('[data-depth-period="productLabPeriod"][data-value="all"]').click();await page.waitForSelector('#productLabMarkerSelect');
 const choice=await page.evaluate(async()=>{
  const {sb,norm}=await import('./src/core.js'),{fetchAll}=await import('./src/data-layer.js');
  const {labOriginalColumns,labOriginalDocumentColumns,attachLabOriginals,labOriginalUrl}=await import('./src/lab-original-link.js');
  const [rows,documents]=await Promise.all([
   fetchAll('health_lab_results','source_record_id,collection_date,laboratory,biomarker,source,source_file,confidence,'+labOriginalColumns,'collection_date',false,'source_record_id',sb),
   fetchAll('health_documents',labOriginalDocumentColumns,'document_date',false,'source_record_id',sb,{document_type:'laboratory_report'})
  ]);
  const selected=attachLabOriginals(rows,documents).find(row=>labOriginalUrl(row));
  return selected?{marker:norm(selected.biomarker),url:labOriginalUrl(selected)}:null;
 });
 if(!choice)throw Error('No independently source-validated laboratory original is available');
 await page.locator('#productLabMarkerSelect').selectOption(choice.marker);await page.waitForSelector('.ltsLabsHistory [data-lab-original]');
 const matches=await page.locator('[data-lab-original]').evaluateAll((links,expected)=>links.length>0&&links.every(a=>a.getAttribute('href')===expected&&a.target==='_blank'&&a.rel==='noopener noreferrer'&&a.referrerPolicy==='no-referrer'),choice.url);
 if(!matches)throw Error('Protected laboratory original access differs from the independent source/document identity');
}

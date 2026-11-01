// Only source metadata and boolean conclusions leave the protected page scope.
// Patient PDFs are never opened into a workflow capture or public artifact.
export async function verifyLaboratoryOriginalFlow(page,navigate){
 await navigate('saude');await page.locator('[data-depth-period="productLabPeriod"][data-value="all"]').click();await page.waitForSelector('#productLabMarkerSelect');
 const choice=await page.evaluate(async()=>{
  const {sb,norm}=await import('./src/core.js'),{fetchAll}=await import('./src/data-layer.js');
  const {labOriginalColumns,labOriginalDocumentColumns,attachLabOriginals,labOriginalUrl}=await import('./src/lab-original-link.js');
  const [rows,documents]=await Promise.all([
   fetchAll('health_lab_results','source_record_id,collection_date,report_date,laboratory,biomarker,source,source_file,confidence,'+labOriginalColumns,'collection_date',false,'source_record_id',sb),
   fetchAll('health_documents',labOriginalDocumentColumns,'document_date',false,'source_record_id',sb,{document_type:'laboratory_report'})
  ]);
  const reviewedEinstein=rows.filter(row=>row.original_import_version==='einstein-source-audit-v1');
  if(!reviewedEinstein.length||!reviewedEinstein.every(row=>labOriginalUrl(attachLabOriginals([row],documents)[0])))throw Error('Reviewed Einstein source/page/release metadata did not resolve through the owner-scoped read');
  const selected=attachLabOriginals(rows,documents).find(row=>labOriginalUrl(row));
  const dated=reviewedEinstein.find(row=>row.original_date_kind==='legacy_collection_date');
  if(!dated)throw Error('The preserved legacy/source release-date distinction was not available');
  const original=attachLabOriginals([dated],documents)[0];
  return selected?{marker:norm(selected.biomarker),url:labOriginalUrl(selected),einstein:{marker:norm(dated.biomarker),url:labOriginalUrl(original),releaseLabel:dated.original_release_date.split('-').reverse().join('/')}}:null;
 });
 if(!choice)throw Error('No independently source-validated laboratory original is available');
 await page.locator('#productLabMarkerSelect').selectOption(choice.marker);await page.waitForSelector('.ltsLabsHistory [data-lab-original]');
 const matches=await page.locator('[data-lab-original]').evaluateAll((links,expected)=>links.length>0&&links.every(a=>a.getAttribute('href')===expected&&a.target==='_blank'&&a.rel==='noopener noreferrer'&&a.referrerPolicy==='no-referrer'),choice.url);
 if(!matches)throw Error('Protected laboratory original access differs from the independent source/document identity');
 await page.locator('#productLabMarkerSelect').selectOption(choice.einstein.marker);
 // The legacy-date examples are qualitative. They stay in the complete
 // history; a numeric chart point must never be manufactured for this check.
 await page.waitForSelector('.ltsLabsHistory [data-lab-original]');
 const source=page.locator('.ltsLabsHistory .ltsLabOriginal');
 if(await source.locator('a').getAttribute('href')!==choice.einstein.url||!(await source.innerText()).includes('Liberação no laudo: '+choice.einstein.releaseLabel))throw Error('The exact Einstein original and explicit source release date did not reach the protected application');
}

export const isAutoExportNutrition=row=>String(row?.source_record_id||'').startsWith('health_auto_export:nutrition:')&&row?.confidence==='authenticated_auto_export'&&String(row?.source||'').endsWith('(Health Auto Export)');
export function nutritionWithAutoExport(rows,baseRows){
  const direct=baseRows.filter(row=>!String(row?.source_record_id||'').startsWith('health_auto_export:'));
  const directDates=new Set(direct.map(row=>String(row.nutrition_date||'').slice(0,10)));
  // The existing original daily history wins. Never sum two nutrition origins.
  return [...direct,...rows.filter(row=>isAutoExportNutrition(row)&&!directDates.has(String(row.nutrition_date||'').slice(0,10)))];
}

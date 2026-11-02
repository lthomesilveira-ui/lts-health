// Keep patient values and original notes in the protected page scope.
export async function verifyRecordedLoadSourceProjection(page){
 const consistent=await page.evaluate(async()=>{
  const {state,sb}=await import('./src/core.js');
  const {fetchAll}=await import('./src/data-layer.js');
  const {isApproximateTrainingLoad}=await import('./src/training-load-qualifier.js');
  const source=await fetchAll('health_workout_sets','source_record_id,notes,weight_is_approximate:source_payload->weight_approximate','workout_date',false,'source_record_id',sb);
  const byId=new Map();for(const set of source){if(!byId.has(set.source_record_id))byId.set(set.source_record_id,[]);byId.get(set.source_record_id).push(set);}
  return state.domainStatus.sets==='ready'&&Array.isArray(state.data.sets)&&state.data.sets.length>0&&state.data.sets.every(set=>{
   const originals=byId.get(set.source_record_id)||[];
   return originals.length===1&&(set.weight_is_approximate??null)===(originals[0].weight_is_approximate??null)&&isApproximateTrainingLoad(set)===isApproximateTrainingLoad(originals[0]);
  });
 });
 if(!consistent)throw Error('Training load qualifiers differ from the independent owner-scoped source read');
 console.log('Training load qualifiers agree with the independent owner-scoped source read.');
}

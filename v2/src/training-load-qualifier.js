// Use only an explicit source flag or the preserved affirmative legacy note.
// Absence, string booleans and notes about duration do not qualify a load.
const legacyApproximation=/^(?:peso|carga)(?: informad[oa] como)? aproximad[oa](?:$|[.;,:\n])/i;
export function isApproximateTrainingLoad(set){
 if(set?.weight_is_approximate===true)return true;
 return typeof set?.notes==='string'&&legacyApproximation.test(set.notes.trim());
}

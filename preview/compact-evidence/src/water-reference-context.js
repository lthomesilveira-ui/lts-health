import {waterReferenceForDate} from './personal-goals.js';
import {documentedWaterReferenceForDate} from './documented-water-reference.js';

// Independently loaded documentary context never becomes a personal goal.
export function waterReferenceContext(data={},status={},date){
  const candidate=waterReferenceForDate(data.goals,date,status.goals);
  const personal=candidate?.dateBasis==='personal_target'?candidate:null;
  const documented=documentedWaterReferenceForDate(data.waterReferences,date,status.waterReferences);
  return {personal,documented,selected:personal||documented};
}

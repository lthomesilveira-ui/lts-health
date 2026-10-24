// Pure recorded-load contract. Descriptions are never proof of physical identity.
// No aliases, estimated strength, unit conversions or maximum-load selection.
const normalize=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
const numeric=value=>value==null||typeof value==='boolean'||String(value).trim()===''||!Number.isFinite(Number(value))?null:Number(value);
const dateOf=value=>{const text=String(value??'');if(!/^\d{4}-\d{2}-\d{2}(?:$|T|\s)/.test(text))return null;const date=text.slice(0,10),parsed=new Date(`${date}T12:00:00Z`);return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?date:null;};
const groups=(rows,key)=>{const map=new Map();for(const row of rows){const k=key(row);if(!map.has(k))map.set(k,[]);map.get(k).push(row);}return map;};
const unique=values=>[...new Set(values)];
const truth=value=>value===true?'yes':value===false?'no':'unknown';
const hasIdentity=value=>typeof value==='string'&&value.trim().length>0;
export const recordedLoadUnits=Object.freeze({kg:'kg',lb:'lb',lb_per_side:'lb por lado',plate_index:'placas (sem conversão para kg)'});

/**
 * trainingComparability({workouts, exercises, sets}, {bounds, today, closedOnly,
 * requireCanonical = true})
 *
 * observed: same recorded descriptions, unit, reps, phase, technique and effort;
 * unknowns remain unknown and never establish equivalent conditions.
 * comparable: equivalent RECORDED working-load conditions only: working phase,
 * integer reps, known unit, explicit technique, boolean failure/near_failure,
 * and matching, nonempty workout/exercise/set provenance labels. This does not
 * confirm original documentary evidence, physical station, execution or strength.
 * No new database fields, inferred confirmation flags or semantic aliases.
 *
 * history preserves every input set and exclusion reason. No input is changed.
 * Multiple different loads/occurrences/sessions in one day/context are ambiguous.
 * Repeated identical sets within one occurrence may form one point with setIds.
 * The module never chooses a cohort or replaces ambiguity with a maximum.
 */
export function trainingComparability(data={},options={}){
 const {bounds={},today=null,closedOnly=false,requireCanonical=true}=options;
 // Missing IDs are never join keys. JSON array keys otherwise collapse null and
 // undefined, allowing unrelated anonymous parents to appear as real identity.
 const workoutGroups=groups((data.workouts||[]).filter(row=>hasIdentity(row.source_record_id)),row=>row.source_record_id);
 const exerciseGroups=groups((data.exercises||[]).filter(row=>hasIdentity(row.workout_source_record_id)&&hasIdentity(row.source_record_id)),row=>JSON.stringify([row.workout_source_record_id,row.source_record_id]));
 const setIds=groups((data.sets||[]).filter(row=>row.source_record_id),row=>row.source_record_id);
 const history=[];
 for(const set of data.sets||[]){
  const reasons=[],hasWorkoutId=hasIdentity(set.workout_source_record_id),hasExerciseId=hasIdentity(set.exercise_source_record_id);
  const workouts=hasWorkoutId?workoutGroups.get(set.workout_source_record_id)||[]:[];
  const exercises=hasWorkoutId&&hasExerciseId?exerciseGroups.get(JSON.stringify([set.workout_source_record_id,set.exercise_source_record_id]))||[]:[];
  const workout=workouts.length===1?workouts[0]:null,exercise=exercises.length===1?exercises[0]:null;
  if(!hasWorkoutId)reasons.push('missing_workout_identity');
  else if(workouts.length!==1)reasons.push(workouts.length?'ambiguous_workout_id':'missing_workout');
  if(!hasExerciseId)reasons.push('missing_exercise_identity');
  else if(hasWorkoutId&&exercises.length!==1)reasons.push(exercises.length?'ambiguous_exercise_id':'missing_exercise');
  if(set.source_record_id&&setIds.get(set.source_record_id).length!==1)reasons.push('duplicate_set_id');
  const date=dateOf(workout?.workout_date||workout?.date);
  if(!date)reasons.push('invalid_event_date');
  if(date&&((bounds.start&&date<bounds.start)||(bounds.end&&date>bounds.end)))reasons.push('outside_period');
  if(date&&today&&(date>today||(closedOnly&&date===today)))reasons.push('open_or_future_day');
  if(workout&&((requireCanonical&&workout.is_canonical!==true)||workout.record_status==='quarantined'))reasons.push('noncanonical_workout');
  if(set.workout_date&&dateOf(set.workout_date)!==date)reasons.push('set_event_date_mismatch');
  if(exercise?.workout_date&&dateOf(exercise.workout_date)!==date)reasons.push('exercise_event_date_mismatch');
  const phase=normalize(set.phase)||'unknown',unit=normalize(set.weight_unit),weight=numeric(set.weight),reps=numeric(set.reps_numeric);
  if(['drop','rest_pause'].includes(phase))reasons.push('extension');
  else if(['warmup','other'].includes(phase))reasons.push('nonworking_phase');
  else if(!['working','unknown'].includes(phase))reasons.push('unrecognized_phase');
  if(!normalize(exercise?.exercise))reasons.push('exercise_unidentified');
  if(!normalize(exercise?.machine))reasons.push('equipment_unidentified');
  if(!normalize(workout?.location))reasons.push('location_unidentified');
  if(!Object.hasOwn(recordedLoadUnits,unit))reasons.push('unit_unidentified');
  if(weight==null||weight<0)reasons.push('invalid_load');
  if(reps==null||reps<=0)reasons.push('invalid_repetitions');
  const context=[normalize(exercise?.exercise),normalize(exercise?.machine),normalize(workout?.location),unit,reps,phase,normalize(set.technique),truth(set.failure),truth(set.near_failure)];
  const row={set,exercise,workout,date,value:weight,unit,reps,phase,technique:set.technique??null,workoutId:workout?.source_record_id??null,exerciseId:exercise?.source_record_id??null,setId:set.source_record_id??null,key:JSON.stringify(context),reasons,eligible:reasons.length===0};
  row.comparisonReasons=[...reasons];
  if(phase!=='working')row.comparisonReasons.push('working_phase_not_recorded');
  if(!Number.isInteger(reps))row.comparisonReasons.push('fractional_repetitions');
  if(!normalize(set.technique))row.comparisonReasons.push('technique_unrecorded');
  if(typeof set.failure!=='boolean')row.comparisonReasons.push('failure_unrecorded');
  if(typeof set.near_failure!=='boolean')row.comparisonReasons.push('near_failure_unrecorded');
  const sourceContext=[normalize(workout?.source_recorded??workout?.source),normalize(exercise?.source),normalize(set.source)];
  if(sourceContext.some(source=>!source))row.comparisonReasons.push('provenance_unrecorded');
  row.comparableEligible=row.comparisonReasons.length===0;
  row.comparableKey=row.comparableEligible?JSON.stringify([...context,...sourceContext]):null;
  history.push(row);
 }
 const makeCohorts=(records,keyName,classification)=>[...groups(records,row=>row[keyName])].map(([key,rows])=>{
  const first=rows[0],points=[],ambiguous=[];
  for(const[date,list]of groups(rows,row=>row.date)){
   const reasons=[];
   if(unique(list.map(row=>row.value)).length!==1)reasons.push('multiple_loads_same_context');
   if(unique(list.map(row=>row.workoutId)).length!==1)reasons.push('multiple_sessions_same_day');
   if(unique(list.map(row=>row.exerciseId)).length!==1)reasons.push('multiple_exercise_occurrences_same_day');
   if(reasons.length){ambiguous.push({date,reasons,records:list});continue;}
   const sample=list[0];points.push({date,value:sample.value,weight:sample.value,unit:sample.unit,reps:sample.reps,phase:sample.phase,workoutId:sample.workoutId,exerciseId:sample.exerciseId,setId:sample.setId,setIds:list.map(row=>row.setId),setCount:list.length,cohort:key});
  }
  points.sort((a,b)=>a.date.localeCompare(b.date));
  const usable=points.length>=2,sourceKeys=unique(rows.map(row=>JSON.stringify([normalize(row.workout.source_recorded??row.workout.source),normalize(row.exercise.source),normalize(row.set.source)])));
  const warnings=[];
  warnings.push('physical_identity_and_conditions_unconfirmed','documentary_confirmation_not_adjudicated');
  if(first.phase==='unknown')warnings.push('phase_unknown');
  if(rows.some(row=>truth(row.set.failure)==='unknown'||truth(row.set.near_failure)==='unknown'))warnings.push('effort_incomplete');
  if(rows.some(row=>!normalize(row.set.technique)))warnings.push('technique_not_documented');
  if(rows.some(row=>!Number.isInteger(row.reps)))warnings.push('fractional_repetitions_descriptive_only');
  if(sourceKeys.length>1)warnings.push('provenance_labels_differ');
  if(ambiguous.length)warnings.push('ambiguous_dates_excluded');
  return{key,classification:usable?classification:'indeterminate',exercise:first.exercise.exercise,machine:first.exercise.machine,location:first.workout.location,unit:first.unit,reps:first.reps,phase:first.phase,technique:first.technique,points,records:rows,ambiguous,ambiguousDates:ambiguous.map(item=>item.date),warnings,reason:usable?null:'insufficient_unambiguous_dates',firstDate:points[0]?.date??null,lastDate:points.at(-1)?.date??null,previous:usable?points.at(-2):null,latest:points.at(-1)??null,recordedDelta:usable?points.at(-1).value-points.at(-2).value:null,delta:usable&&classification==='comparable'?points.at(-1).value-points.at(-2).value:null,recordedConditionsEquivalent:classification==='comparable',comparisonMeaning:'recorded_conditions_only',conditionsConfirmed:false,phaseConfirmedFromOriginal:false,effortConfirmedFromOriginal:false};
 }).sort((a,b)=>Number(b.phase==='working')-Number(a.phase==='working')||b.points.length-a.points.length||(b.lastDate||'').localeCompare(a.lastDate||'')||a.key.localeCompare(b.key));
 const observedCohorts=makeCohorts(history.filter(row=>row.eligible),'key','observed');
 const ambiguousContexts=new Set(observedCohorts.flatMap(cohort=>cohort.ambiguousDates.map(date=>JSON.stringify([cohort.key,date]))));
 for(const row of history)if(ambiguousContexts.has(JSON.stringify([row.key,row.date]))){row.comparisonReasons.push('ambiguous_context_date');row.comparableEligible=false;}
 const comparableCohorts=makeCohorts(history.filter(row=>row.comparableEligible),'comparableKey','comparable');
 return{history,observed:observedCohorts.filter(row=>row.classification==='observed'),comparable:comparableCohorts.filter(row=>row.classification==='comparable'),cohorts:observedCohorts,comparableCohorts,
  indeterminate:[...history.filter(row=>!row.eligible).map(row=>({kind:'record',reasons:row.reasons,record:row})),...observedCohorts.filter(row=>row.reason).map(row=>({kind:'cohort',reasons:[row.reason],cohort:row})),...observedCohorts.flatMap(row=>row.ambiguous.map(item=>({kind:'day',...item,cohortKey:row.key})))],
  comparisonPending:history.filter(row=>row.eligible&&!row.comparableEligible),
  notes:'Mesmas descrições registradas não confirmam estação física, condições equivalentes ou ganho de força. Fases, esforço e proveniência desconhecidos permanecem explícitos.'};
}

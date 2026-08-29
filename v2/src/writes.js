import {sb,state,fixtureMode} from './core.js';

function requiredSession(){
  if(fixtureMode) return {user:{id:'fixture-user'}};
  if(!state.session?.user) throw new Error('authentication_required');
  return state.session;
}

function optionalNumber(value){
  if(value===null||value===undefined||String(value).trim()==='') return null;
  const n=Number(String(value).replace(',','.'));
  if(!Number.isFinite(n)) throw new Error('invalid_number');
  return n;
}

function optionalNonNegativeNumber(value){
  const n=optionalNumber(value);
  if(n!=null&&n<0) throw new Error('negative_number_not_allowed');
  return n;
}

export async function saveBodyRecord(payload){
  const session=requiredSession();
  const measuredAt=String(payload.measured_at||'').trim();
  if(!measuredAt) throw new Error('date_required');
  const record={
    user_id:session.user.id,
    source_record_id:`manual-body:${crypto.randomUUID()}`,
    measured_at:measuredAt,
    weight_kg:optionalNonNegativeNumber(payload.weight_kg),
    skeletal_muscle_mass_kg:optionalNonNegativeNumber(payload.skeletal_muscle_mass_kg),
    fat_mass_kg:optionalNonNegativeNumber(payload.fat_mass_kg),
    body_fat_pct:optionalNonNegativeNumber(payload.body_fat_pct),
    body_water_l:optionalNonNegativeNumber(payload.body_water_l),
    visceral_fat_level:optionalNonNegativeNumber(payload.visceral_fat_level),
    score:optionalNonNegativeNumber(payload.score),
    waist_hip_ratio:optionalNonNegativeNumber(payload.waist_hip_ratio),
    bmr_kcal:optionalNonNegativeNumber(payload.bmr_kcal),
    source:'LTS Health manual entry',
    confidence:'user_reported',
    notes:String(payload.notes||'').trim()||null,
    source_payload:{entry_method:'body_form_v2'}
  };
  const hasMetric=['weight_kg','skeletal_muscle_mass_kg','fat_mass_kg','body_fat_pct','body_water_l','visceral_fat_level','score','waist_hip_ratio','bmr_kcal'].some(k=>record[k]!=null);
  if(!hasMetric) throw new Error('metric_required');
  if(fixtureMode){ state.data.body.push(record); return record.source_record_id; }
  const {error}=await sb.from('health_body_composition').insert(record);
  if(error) throw error;
  return record.source_record_id;
}

export async function saveWorkout(payload){
  requiredSession();
  const exercises=(payload.exercises||[]).map(ex=>({
    name:String(ex.name||'').trim(),
    muscle_group:String(ex.muscle_group||'').trim()||null,
    machine:String(ex.machine||'').trim()||null,
    notes:String(ex.notes||'').trim()||null,
    sets:(ex.sets||[]).map(s=>({
      phase:['warmup','working','other'].includes(s.phase)?s.phase:'working',
      weight:optionalNonNegativeNumber(s.weight),
      weight_unit:['kg','lb','plate_index','unitless'].includes(s.weight_unit)?s.weight_unit:null,
      reps:optionalNonNegativeNumber(s.reps),
      notes:String(s.notes||'').trim()||null
    }))
  })).filter(ex=>ex.name&&ex.sets.length);
  if(!payload.workout_date||!String(payload.workout_type||'').trim()||!exercises.length) throw new Error('workout_fields_required');
  const body={
    workout_date:String(payload.workout_date),
    workout_type:String(payload.workout_type).trim(),
    location:String(payload.location||'').trim()||null,
    duration_minutes:optionalNonNegativeNumber(payload.duration_minutes),
    calories_kcal:optionalNonNegativeNumber(payload.calories_kcal),
    notes:String(payload.notes||'').trim()||null,
    exercises
  };
  if(fixtureMode) return {ok:true,source_record_id:'fixture-manual-workout'};
  const {data,error}=await sb.rpc('health_log_structured_workout',{p_payload:body});
  if(error) throw error;
  return data;
}

const norm = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const tidy = value => String(value || '').trim().replace(/\s+/g,' ');
const numeric = value => Number(String(value).replace(',','.'));
const defaults = ['Agachamento livre','Cadeira extensora','Cadeira flexora','Desenvolvimento de ombros','Elevação lateral','Leg press','Puxada na frente','Remada baixa','Rosca direta','Supino reto','Tríceps na polia'];

export function workoutCatalog(workouts=[],exercises=[]) {
  const parents=new Map(workouts.filter(w=>w.is_canonical===true&&norm(w.record_status)!=='quarantined').map(w=>[w.source_record_id,w.workout_date]));
  const items=new Map();
  for(const row of exercises){
    const date=parents.get(row.workout_source_record_id),name=tidy(row.exercise);
    if(!date||!name)continue;
    const machine=tidy(row.machine),group=tidy(row.muscle_group),key=[name,machine,group].map(norm).join('|');
    const item=items.get(key)||{name,machine,group,date,count:0};
    item.count++;if(date>item.date)item.date=date;items.set(key,item);
  }
  const sorted=[...items.values()].sort((a,b)=>b.date.localeCompare(a.date)||b.count-a.count||a.name.localeCompare(b.name,'pt-BR'));
  const known=new Set(sorted.map(item=>norm(item.name)));
  for(const name of defaults)if(!known.has(norm(name)))sorted.push({name,machine:'',group:'',date:'',count:0});
  return sorted;
}
export function searchWorkoutCatalog(catalog,term,limit=10){
  const words=norm(term).split(/\s+/).filter(Boolean);
  return catalog.filter(row=>{
    const description=norm([row.name,row.machine,row.group].join(' '));
    return words.every(word=>description.includes(word));
  }).slice(0,limit);
}

const N=String.raw`\d+(?:[.,]\d+)?`, U=String.raw`(?:kgs?|quilos?|lbs?|libras?)`;
const rangeSeparator=String.raw`(?:\s*[-–—]\s*|\s+(?:a|at[ée])\s+)`;
const loadAmount=`${N}(?:${rangeSeparator}${N})?`;
// A dash before another load or set count separates two sets.
const repsAmount=String.raw`${N}(?:${rangeSeparator}${N}(?!\d|[.,]\d|\s*(?:${U}\b|[x×]\s*\d|s[ée]ries?\b)))?`;
const plateLabel=String.raw`(?:n[ií]vel|(?:[ií]ndice\s+da\s+)?placa)`;
const repLabel=String.raw`(?:reps?|repeti[çc][õo]es)`;
const pattern = source => new RegExp(source,'gi');
function setValues(weight,unit,reps,count=1){
  const weightUnit=unit==='plate_index'?'plate_index':/^(lb|libra)/i.test(unit||'')?'lb':'kg';
  return {count,weight:weight==null?'':numeric(weight),unit:weight==null?'unitless':weightUnit,reps:numeric(reps)};
}
const rules=[
 [String.raw`\b(\d+)\s*(?:[x×]\s*|s[ée]ries?\s*de\s*)(${repsAmount})\s*(?:${repLabel}\s*)?(?:no|na|com|em|@)?\s*${plateLabel}\s*:?\s*(${loadAmount})\b`,m=>setValues(m[3],'plate_index',m[2],+m[1])],
 [String.raw`\b(${repsAmount})\s*${repLabel}\s*(?:no|na|com|em|@)\s*${plateLabel}\s*:?\s*(${loadAmount})\b`,m=>setValues(m[2],'plate_index',m[1])],
 [String.raw`\b${plateLabel}\s*:?\s*(${loadAmount})(?:\s*[x×,:-]\s*|\s+(?:por|para)\s+|\s+)(${repsAmount})(?:\s*${repLabel})?`,m=>setValues(m[1],'plate_index',m[2])],
 [String.raw`\b(\d+)\s*[x×]\s*(${repsAmount})\s+(?:@\s*)?(${loadAmount})\s*(${U})\b`,m=>setValues(m[3],m[4],m[2],+m[1])],
 [String.raw`\b(\d+)\s*(?:s[ée]ries?\s*(?:de|com)?\s*|[x×]\s*)(${repsAmount})\s*(?:${repLabel})?\s*(?:com|a|@|de)\s*(${loadAmount})\s*(${U})\b`,m=>setValues(m[3],m[4],m[2],+m[1])],
 [String.raw`\b(${loadAmount})\s*(${U})\s*[,–:-]?\s*(?:em\s*)?(\d+)\s*s[ée]ries?\s*de\s*(${repsAmount})(?:\s*${repLabel})?`,m=>setValues(m[1],m[2],m[4],+m[3])],
 [String.raw`\b(\d+)\s*s[ée]ries?\s*de\s*(${repsAmount})(?:\s*${repLabel})?`,m=>setValues(null,null,m[2],+m[1])],
 [String.raw`\b(${repsAmount})\s*${repLabel}\s*(?:com|a|@|de)\s*(${loadAmount})\s*(${U})\b`,m=>setValues(m[2],m[3],m[1])],
 [String.raw`\b(${loadAmount})\s*(${U})\s*(?:[x×,:-]\s*|por\s+|para\s+)?(${repsAmount})(?:\s*${repLabel})?(?!\d)`,m=>setValues(m[1],m[2],m[3])],
 [String.raw`\b(${loadAmount})\s*[x×]\s*(${repsAmount})(?:\s*${repLabel})?(?!\d)`,m=>Number.isInteger(+m[1])&&+m[1]<=6?setValues(null,null,m[2],+m[1]):setValues(m[1],'kg',m[2])],
 [String.raw`\b(${repsAmount})\s*${repLabel}\b`,m=>setValues(null,null,m[1])]
];

function reportsFailure(marker){
  // Keep a negated or near-failure description in the note. Only an affirmative
  // mention of muscular failure sets the checkbox.
  const qualifiedBefore=/\b(?:sem|nao|nunca|quase|antes|perto|proxim[oa]|longe|evit\w*)(?:\s+(?:cheg\w*|ating\w*|alcanc\w*|ir|fui|foi|vou|levei|levar|ate|a|da|de|na))*\s*$/;
  for(const mention of marker.matchAll(/\bfalha\b/g)){
    const before=marker.slice(0,mention.index);
    const after=marker.slice(mention.index+mention[0].length);
    if(!qualifiedBefore.test(before)&&!/^\s+(?:nao\s+(?:atingida|alcancada)|(?:do|no)\s+(?:aparelho|polar))\b/.test(after))return true;
  }
  return false;
}
function readSets(text) {
  const hits=[];
  for(const [source,build] of rules)for(const match of text.matchAll(pattern(source))){
    const start=match.index,end=start+match[0].length;
    if(!hits.some(hit=>start<hit.end&&end>hit.start))hits.push({start,end,...build(match)});
  }
  return hits.sort((a,b)=>a.start-b.start);
}
function naturalOrder(line){
  const sentence=line.replace(/^(?:(?:hoje\s+)?(?:eu\s+)?fiz)\s+/i,'');
  const match=/^(\d+\s*(?:s[ée]ries?\s*de|[x×])\s*\d+(?:[.,]\d+)?)(?:\s+(?:reps?|repeti[çc][õo]es))?\s+(?:no|na|de)\s+(.+?)\s+(com\s+\d+(?:[.,]\d+)?\s*(?:kgs?|lbs?|quilos?|libras?))(.*)$/i.exec(sentence);
  return match?match[2]+': '+match[1]+' '+match[3]+match[4]:line;
}
function splitExerciseClauses(line){
  const clauses=[];
  let remaining=line;
  for(const separator of [...line.matchAll(/\s+(?:e|depois)\s+(?=[a-zà-ÿ])/gi)].reverse()){
    const at=separator.index,next=remaining.slice(at+separator[0].length);
    const nextHit=readSets(next)[0];
    if(nextHit&&possibleHeading(exerciseName(next.slice(0,nextHit.start)))&&readSets(remaining.slice(0,at)).length){
      clauses.unshift(next);remaining=remaining.slice(0,at);
    }
  }
  return [remaining,...clauses];
}
function exerciseName(value){
  return tidy(value).replace(/^[•*\-–\s]+/,'').replace(/^(?:(?:hoje\s+)?(?:eu\s+)?(?:fiz|comecei com|terminei com|completei)|depois(?: fiz)?)\s+/i,'').replace(/[\s:,\-–]+$/,'').trim();
}
function possibleHeading(value){
  return value.length<105&&/[a-zà-ÿ]/i.test(value)&&!/^(?:at[ée]|falha|pausa|descanso|rir|rpe|aquecimento|observa[çc][aã]o|s[ée]rie|rest[ -]?pause|drop|carga|peso|treino|hoje\s|depois\s|me senti|finalizei|terminei|foi |fui |muito |leve\b|pesado\b|\d)/i.test(value);
}
function localDay(text,reference){
  const match=/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(text);
  if(!match)return null;
  const value=[match[3]||String(reference||'').slice(0,4),match[2].padStart(2,'0'),match[1].padStart(2,'0')].join('-'),instant=new Date(value+'T12:00:00Z');
  return Number.isFinite(+instant)&&instant.toISOString().slice(0,10)===value?value:null;
}
function metadataLine(line,metadata,date) {
  const match=/^(treino|tipo|local|academia|data|in[ií]cio|hor[aá]rio|dura[çc][aã]o)\s*:\s*(.+)$/i.exec(line);
  if(!match)return null;
  const key=norm(match[1]),rest=tidy(match[2]);
  if(key==='treino'||key==='tipo')metadata.workout_type=rest;
  else if(key==='local'||key==='academia')metadata.location=rest;
  else if(key==='data'){const d=localDay(rest,date);if(!d)return false;metadata.workout_date=d;}
  else if(key==='inicio'||key==='horario'){const t=/^(\d{1,2})[h:](\d{2})$/.exec(rest);if(!t||+t[1]>=24||+t[2]>=60)return false;metadata.start_clock=t[1].padStart(2,'0')+':'+t[2];}
  else {const t=/^(\d+(?:[.,]\d+)?)\s*(?:min(?:utos?)?)?$/i.exec(rest);if(!t)return false;metadata.duration_minutes=numeric(t[1]);}
  return true;
}

export function parseWorkoutText(input,referenceDate) {
  const raw=String(input||'').trim(),exercises=[],unresolved=[],metadata={};
  if(!raw||raw.length>16000)return {raw,exercises,unresolved,metadata,error:raw?'text_too_long':'empty_text'};
  const mark=line=>{if(line&&!unresolved.includes(line))unresolved.push(line);};
  const segments=raw.replace(/\r/g,'').split(/\n|;|\s+e\s+depois\s+|\.\s+(?=[A-ZÀ-Ý])/).flatMap(splitExerciseClauses).map(naturalOrder).map(s=>s.trim()).filter(Boolean);
  let current=null,heading=null;
  for(const line of segments){
    const meta=metadataLine(line,metadata,referenceDate);
    if(meta!==null){if(!meta)mark(line);continue;}
    const hits=readSets(line);
    if(!hits.length){
      const name=exerciseName(line);
      if(possibleHeading(name)){if(heading)mark(heading);heading=name;}else mark(line);
      continue;
    }
    const prefix=exerciseName(line.slice(0,hits[0].start)).replace(/\s+(?:com|em|de|no|na)$/i,'').trim();
    const tagged=/^(?:s[ée]rie\s*\d*|aquecimento|s[ée]rie de trabalho|rest[ -]?pause|drop(?:set)?)$/i.test(prefix);
    const name=prefix&&!tagged&&possibleHeading(prefix)?prefix:heading;
    if(name){current={name,muscle_group:'',machine:'',notes:'',sets:[]};exercises.push(current);if(heading&&name!==heading)mark(heading);heading=null;}
    if(!current){mark(line);continue;}
    for(let i=0;i<hits.length;i++){
      const hit=hits[i];
      if(!Number.isFinite(hit.reps)||(hit.weight!==''&&!Number.isFinite(hit.weight))){mark(line);continue;}
      if(hit.count<1||hit.count>50||current.sets.length+hit.count>99){mark(line);continue;}
      const extra=line.slice(hit.end,hits[i+1]?.start??line.length).replace(/^[\s.,/:–\-]+|[\s.,/:–\-]+$/g,'').trim();
      const before=i?line.slice(hits[i-1].end,hit.start):prefix;
      const extension=/rest[ -]?pause|pausa[^/]{0,30}\+/i.test(before)?'rest_pause':/drop(?:set)?/i.test(before)?'drop':null;
      if(i&&/\+/.test(before)&&!extension){mark(line);continue;}
      const marker=norm([tagged?prefix:'',extra].filter(Boolean).join(' '));
      if(/rest[ -]?pause|dropset|\bdrop\b|parciais|curtas/.test(marker))mark(line);
      const phase=extension||(/aquecimento/.test(marker)?'warmup':/^(?:rest[ -]?pause|drop(?:set)?)$/i.test(prefix)?(/rest/i.test(prefix)?'rest_pause':'drop'):'working');
      const failure=reportsFailure(marker);
      for(let j=0;j<hit.count;j++)current.sets.push({phase,weight:hit.weight,weight_unit:hit.unit,reps:hit.reps,notes:extra||'',failure:failure||null});
    }
  }
  if(heading)mark(heading);
  return {raw,exercises:exercises.filter(exercise=>exercise.sets.length),unresolved,metadata,error:null};
}

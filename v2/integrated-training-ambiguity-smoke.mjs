globalThis.location={search:'?fixture'};
const {comparablePerformanceModel}=await import('./src/integrated-analysis.js');

const status={workouts:'ready',exercises:'ready',sets:'ready'};
const base={
  workouts:[
    {source_record_id:'w1',workout_date:'2026-01-10',is_canonical:true,record_status:'validated'},
    {source_record_id:'w2',workout_date:'2026-01-25',is_canonical:true,record_status:'validated'}
  ],
  exercises:[
    {source_record_id:'e1',workout_source_record_id:'w1',workout_date:'2026-01-10',exercise:'Agachamento Smith',machine:'Smith'},
    {source_record_id:'e2',workout_source_record_id:'w2',workout_date:'2026-01-25',exercise:'Agachamento Smith',machine:'Smith'}
  ],
  sets:[
    {exercise_source_record_id:'e1',weight:60,weight_unit:'kg'},
    {exercise_source_record_id:'e2',weight:80,weight_unit:'kg'}
  ]
};

const baseline=comparablePerformanceModel(base,status,3);
if(baseline.length!==1||baseline[0].weight!==80||baseline[0].previousWeight!==60)throw new Error('baseline comparable performance changed');

const ambiguous={
  ...base,
  workouts:[...base.workouts,{source_record_id:'w3',workout_date:'2026-01-25',is_canonical:true,record_status:'validated'}],
  exercises:[...base.exercises,{source_record_id:'e3',workout_source_record_id:'w3',workout_date:'2026-01-25',exercise:'Agachamento Smith',machine:'Smith'}],
  sets:[...base.sets,{exercise_source_record_id:'e3',weight:300,weight_unit:'kg'}]
};
const result=comparablePerformanceModel(ambiguous,status,3);
if(result.length!==0)throw new Error('same-day duplicate sessions were collapsed into a false progression');

const differentUnit={
  ...base,
  workouts:[...base.workouts,{source_record_id:'w3',workout_date:'2026-01-25',is_canonical:true,record_status:'validated'}],
  exercises:[...base.exercises,{source_record_id:'e3',workout_source_record_id:'w3',workout_date:'2026-01-25',exercise:'Agachamento Smith',machine:'Smith'}],
  sets:[...base.sets,{exercise_source_record_id:'e3',weight:300,weight_unit:'lb'}]
};
const unitSafe=comparablePerformanceModel(differentUnit,status,3);
if(unitSafe.length!==1||unitSafe[0].unit!=='kg'||unitSafe[0].weight!==80)throw new Error('compatible kg progression was lost when a different unit appeared on the same day');

console.log('LTS Health v2 integrated training ambiguity smoke passed');

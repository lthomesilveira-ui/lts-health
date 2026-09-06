import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const tokenHash=readFileSync('/tmp/lts-health-token-hash','utf8').trim();
if(!tokenHash)throw new Error('authenticated token hash missing');

const coreSource=readFileSync(new URL('./src/core.js',import.meta.url),'utf8');
const supabaseUrl=/url:\s*'([^']+)'/.exec(coreSource)?.[1];
const supabaseKey=/key:\s*'([^']+)'/.exec(coreSource)?.[1];
if(!supabaseUrl||!supabaseKey)throw new Error('public Supabase configuration not resolved');

const appUrl='https://lthomesilveira-ui.github.io/lts-health/v2/';
let runtimeErrorCount=0;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
page.on('pageerror',()=>runtimeErrorCount++);
page.on('console',message=>{if(message.type()==='error')runtimeErrorCount++;});

async function waitForRoute(route){
  await page.evaluate(value=>{location.hash=`#${value}`;},route);
  await page.waitForFunction(value=>location.hash===`#${value}`&&Boolean(document.querySelector('#screenHost h1')),route,{timeout:30000});
  await page.waitForTimeout(150);
}

async function assertNoHorizontalOverflow(){
  const ok=await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
  if(!ok)throw new Error('real-data route overflow detected');
}

async function readIntegritySnapshot(){
  return page.evaluate(async ({url,key})=>{
    const client=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
    const {data:sessionData,error:sessionError}=await client.auth.getSession();
    if(sessionError||!sessionData?.session?.user)return{error:'authenticated data session unavailable'};

    async function fetchAll(table,select){
      const pageSize=1000,rows=[];
      for(let from=0;;from+=pageSize){
        const {data,error}=await client.from(table).select(select).range(from,from+pageSize-1);
        if(error)return{error:`${table}: ${error.message}`};
        const chunk=data||[];
        rows.push(...chunk);
        if(chunk.length<pageSize)break;
      }
      return{rows};
    }

    const specs=[
      ['workouts','health_workouts','source_record_id,workout_date,is_canonical,record_status'],
      ['exercises','health_workout_exercises','source_record_id,workout_source_record_id'],
      ['sets','health_workout_sets','source_record_id,workout_source_record_id,exercise_source_record_id'],
      ['evidence','health_workout_source_evidence','source_record_id,workout_source_record_id'],
      ['sourceMetrics','health_source_daily_metrics','source_record_id,metric_type,source_family,canonical_status'],
      ['quality','health_data_quality_issues','source_record_id,status'],
      ['uploads','health_uploads','id,status']
    ];
    const results=await Promise.all(specs.map(([,table,select])=>fetchAll(table,select)));
    const failure=results.find(result=>result.error);
    if(failure)return{error:failure.error};
    const data=Object.fromEntries(specs.map(([keyName],index)=>[keyName,results[index].rows]));

    const workoutIds=new Set(data.workouts.map(row=>row.source_record_id).filter(Boolean));
    const exerciseIds=new Set(data.exercises.map(row=>row.source_record_id).filter(Boolean));
    const orphanExercises=data.exercises.filter(row=>!row.workout_source_record_id||!workoutIds.has(row.workout_source_record_id)).length;
    const orphanSetsByWorkout=data.sets.filter(row=>!row.workout_source_record_id||!workoutIds.has(row.workout_source_record_id)).length;
    const orphanSetsByExercise=data.sets.filter(row=>row.exercise_source_record_id&&!exerciseIds.has(row.exercise_source_record_id)).length;
    const orphanEvidence=data.evidence.filter(row=>!row.workout_source_record_id||!workoutIds.has(row.workout_source_record_id)).length;

    const allowedCanonical=new Set([
      'apple_activity_summary|active_energy_kcal',
      'apple_activity_summary|exercise_minutes',
      'apple_activity_summary|stand_hours'
    ]);
    const canonicalBoundaryViolations=data.sourceMetrics.filter(row=>{
      if(String(row.canonical_status||'').toLowerCase()!=='canonical')return false;
      return !allowedCanonical.has(`${String(row.source_family||'').toLowerCase()}|${String(row.metric_type||'').toLowerCase()}`);
    }).length;

    const visibleWorkouts=data.workouts
      .filter(row=>row.is_canonical===true&&String(row.record_status||'').toLowerCase()!=='quarantined')
      .sort((a,b)=>String(b.workout_date||'').localeCompare(String(a.workout_date||''))||String(a.source_record_id||'').localeCompare(String(b.source_record_id||'')));
    const latestWorkoutId=visibleWorkouts[0]?.source_record_id||null;
    const latestExpectedExercises=latestWorkoutId?data.exercises.filter(row=>row.workout_source_record_id===latestWorkoutId).length:0;
    const latestExpectedSets=latestWorkoutId?data.sets.filter(row=>row.workout_source_record_id===latestWorkoutId).length:0;
    const internalQualityCount=data.quality.filter(row=>['open','in_progress'].includes(String(row.status||'').toLowerCase())).length;
    const uploadActionCount=data.uploads.filter(row=>['rejected','failed'].includes(String(row.status||'').toLowerCase())).length;

    return{
      orphanExercises,orphanSetsByWorkout,orphanSetsByExercise,orphanEvidence,
      canonicalBoundaryViolations,latestWorkoutId,latestExpectedExercises,latestExpectedSets,
      internalQualityCount,uploadActionCount
    };
  },{url:supabaseUrl,key:supabaseKey});
}

try{
  await page.goto(`${appUrl}#hoje`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>Boolean(window.supabase?.createClient),null,{timeout:20000});

  const sessionResult=await page.evaluate(async ({url,key,tokenHash})=>{
    const client=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    const {data,error}=await client.auth.verifyOtp({token_hash:tokenHash,type:'email'});
    return{ok:!error&&Boolean(data?.session?.user)};
  },{url:supabaseUrl,key:supabaseKey,tokenHash});
  if(!sessionResult.ok)throw new Error('real authenticated session could not be established');
  await page.reload({waitUntil:'domcontentloaded',timeout:45000});

  await page.waitForSelector('#app:not(.hidden)',{timeout:30000});
  if(await page.locator('#login:not(.hidden)').count())throw new Error('real authenticated app returned to login');
  if(page.url().includes('fixture'))throw new Error('fixture mode is not allowed in real authenticated E2E');

  const integrity=await readIntegritySnapshot();
  if(integrity.error)throw new Error(`real-data integrity snapshot failed: ${integrity.error}`);
  const linkageFailures=integrity.orphanExercises+integrity.orphanSetsByWorkout+integrity.orphanSetsByExercise+integrity.orphanEvidence;
  if(linkageFailures)throw new Error(`real-data linkage integrity failed: ${JSON.stringify(integrity)}`);
  if(integrity.canonicalBoundaryViolations)throw new Error(`real-data canonical boundary failed: ${integrity.canonicalBoundaryViolations}`);
  if(!integrity.latestWorkoutId||integrity.latestExpectedExercises<1||integrity.latestExpectedSets<1)throw new Error('latest canonical workout has no structured linkage');

  await waitForRoute('hoje');
  await page.waitForSelector('[data-executive-dashboard]',{timeout:30000});
  const homeState=await page.evaluate(()=>{
    const training=[...document.querySelectorAll('.cockpitStatus')].find(card=>card.querySelector('small')?.textContent?.trim()==='Treinos');
    return{
      title:document.querySelector('[data-executive-dashboard] h1')?.textContent?.trim()||'',
      trainingValue:training?.querySelector('b')?.textContent?.trim()||''
    };
  });
  if(homeState.title!=='Visão geral da sua saúde')throw new Error('real-data cockpit title missing');
  if(!homeState.trainingValue||homeState.trainingValue==='0'||homeState.trainingValue==='—')throw new Error('real-data training state is contradictory');
  await assertNoHorizontalOverflow();

  await waitForRoute('treinos');
  await page.waitForSelector('.session',{timeout:30000});
  const latest=page.locator('.session.latest').first();
  if(await latest.count()!==1)throw new Error('latest real workout card missing');
  await latest.locator('.sessionHead').click();
  await page.waitForTimeout(120);
  const exerciseCount=await latest.locator('.exercise').count();
  const setCount=await latest.locator('.set').count();
  if(exerciseCount!==integrity.latestExpectedExercises||setCount!==integrity.latestExpectedSets){
    throw new Error(`latest real workout linkage mismatch: ui=${exerciseCount}/${setCount} data=${integrity.latestExpectedExercises}/${integrity.latestExpectedSets}`);
  }

  await waitForRoute('tratamentos');
  if(await page.locator('.timelineItem').count()<1)throw new Error('real protocol history missing');

  await waitForRoute('dados');
  if(await page.locator('.qualityRow').count()<1)throw new Error('real quality history missing');
  const resolvedCount=await page.locator('.qualityRow').filter({hasText:'resolvido'}).count();
  if(resolvedCount<1)throw new Error('resolved real quality item missing');
  const dataText=await page.locator('#screenHost').innerText();
  if(integrity.uploadActionCount===0&&!dataText.includes('Nada exige sua ação agora'))throw new Error('real Data Inbox action state is contradictory');
  if(integrity.uploadActionCount>0&&dataText.includes('Nada exige sua ação agora'))throw new Error('real Data Inbox hides required user action');
  if(integrity.internalQualityCount>0&&!dataText.includes('Tratamento interno'))throw new Error('real Data Inbox internal-quality state is contradictory');

  const routes=['hoje','treinos','nutricao','bio','analise','saude','tratamentos','evolucao','timeline','dados'];
  await page.setViewportSize({width:390,height:844});
  for(const route of routes){
    await waitForRoute(route);
    await assertNoHorizontalOverflow();
  }

  await page.evaluate(async ({url,key})=>{
    const client=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
    await client.auth.signOut({scope:'local'});
  },{url:supabaseUrl,key:supabaseKey});

  if(runtimeErrorCount)throw new Error('browser runtime errors occurred during real authenticated E2E');
  console.log(`LTS Health real authenticated E2E passed; integrity=${JSON.stringify(integrity)}`);
}finally{
  await browser.close();
}

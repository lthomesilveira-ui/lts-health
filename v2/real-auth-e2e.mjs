import { readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const tokenHash=readFileSync('/tmp/lts-health-token-hash','utf8').trim();
if(!tokenHash)throw new Error('authenticated token hash missing');
const coreSource=readFileSync(new URL('./src/core.js',import.meta.url),'utf8');
const supabaseUrl=/url:\s*'([^']+)'/.exec(coreSource)?.[1];
const supabaseKey=/key:\s*'([^']+)'/.exec(coreSource)?.[1];
if(!supabaseUrl||!supabaseKey)throw new Error('public Supabase configuration not resolved');

const appUrl='https://lthomesilveira-ui.github.io/lts-health/v2/';
const evidenceDir='v2/real-auth-evidence';
mkdirSync(evidenceDir,{recursive:true});
let runtimeErrorCount=0;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
page.on('pageerror',()=>runtimeErrorCount++);
page.on('console',m=>{if(m.type()==='error')runtimeErrorCount++;});

async function waitForRoute(route){
  await page.evaluate(value=>{location.hash=`#${value}`;},route);
  await page.waitForFunction(value=>location.hash===`#${value}`&&Boolean(document.querySelector('#screenHost h1')),route,{timeout:30000});
  await page.waitForTimeout(300);
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
      const rows=[],pageSize=1000;
      for(let from=0;;from+=pageSize){
        const {data,error}=await client.from(table).select(select).range(from,from+pageSize-1);
        if(error)return{error:`${table}: ${error.message}`};
        const chunk=data||[];rows.push(...chunk);if(chunk.length<pageSize)break;
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
    const failure=results.find(r=>r.error);if(failure)return{error:failure.error};
    const data=Object.fromEntries(specs.map(([name],i)=>[name,results[i].rows]));
    const workoutIds=new Set(data.workouts.map(r=>r.source_record_id).filter(Boolean));
    const exerciseIds=new Set(data.exercises.map(r=>r.source_record_id).filter(Boolean));
    const visibleWorkouts=data.workouts.filter(r=>r.is_canonical===true&&String(r.record_status||'').toLowerCase()!=='quarantined')
      .sort((a,b)=>String(b.workout_date||'').localeCompare(String(a.workout_date||''))||String(a.source_record_id||'').localeCompare(String(b.source_record_id||'')));
    const latest=visibleWorkouts[0]||null;
    const allowedCanonical=new Set(['apple_activity_summary|active_energy_kcal','apple_activity_summary|exercise_minutes','apple_activity_summary|stand_hours']);
    return{
      orphanExercises:data.exercises.filter(r=>!r.workout_source_record_id||!workoutIds.has(r.workout_source_record_id)).length,
      orphanSetsByWorkout:data.sets.filter(r=>!r.workout_source_record_id||!workoutIds.has(r.workout_source_record_id)).length,
      orphanSetsByExercise:data.sets.filter(r=>r.exercise_source_record_id&&!exerciseIds.has(r.exercise_source_record_id)).length,
      orphanEvidence:data.evidence.filter(r=>!r.workout_source_record_id||!workoutIds.has(r.workout_source_record_id)).length,
      canonicalBoundaryViolations:data.sourceMetrics.filter(r=>String(r.canonical_status||'').toLowerCase()==='canonical'&&!allowedCanonical.has(`${String(r.source_family||'').toLowerCase()}|${String(r.metric_type||'').toLowerCase()}`)).length,
      latestWorkoutId:latest?.source_record_id||null,
      latestWorkoutDate:latest?.workout_date||null,
      latestExpectedExercises:latest?data.exercises.filter(r=>r.workout_source_record_id===latest.source_record_id).length:0,
      latestExpectedSets:latest?data.sets.filter(r=>r.workout_source_record_id===latest.source_record_id).length:0,
      internalQualityCount:data.quality.filter(r=>['open','in_progress'].includes(String(r.status||'').toLowerCase())).length,
      uploadActionCount:data.uploads.filter(r=>['rejected','failed'].includes(String(r.status||'').toLowerCase())).length
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
  await page.waitForSelector('.ltsHomeV2',{timeout:30000});
  const homeState=await page.evaluate(()=>({
    title:document.querySelector('.ltsHomeV2 h1')?.textContent?.trim()||'',
    trainingValue:document.querySelector('.ltsHealthTile.training b')?.textContent?.trim()||'',
    legacyVisible:Boolean(document.querySelector('[data-executive-dashboard]'))
  }));
  if(homeState.title!=='Seu panorama de saúde')throw new Error(`structural Home missing: ${JSON.stringify(homeState)}`);
  if(!homeState.trainingValue||homeState.trainingValue==='0'||homeState.trainingValue==='—')throw new Error('real-data training state is contradictory');
  if(homeState.legacyVisible)throw new Error('legacy executive Home remained active');
  await assertNoHorizontalOverflow();
  await page.screenshot({path:`${evidenceDir}/desktop-home.png`,fullPage:true});

  await waitForRoute('treinos');
  await page.waitForSelector('.ltsTrainingV2',{timeout:30000});
  await page.waitForSelector('.ltsExerciseCard',{timeout:30000});
  const trainingState=await page.evaluate(()=>({
    exercises:document.querySelectorAll('.ltsExerciseCard').length,
    sets:document.querySelectorAll('.ltsExerciseCard .ltsSetList>div:not(.ltsMuted)').length,
    text:document.querySelector('.ltsTrainingV2')?.innerText||''
  }));
  if(trainingState.exercises!==integrity.latestExpectedExercises||trainingState.sets!==integrity.latestExpectedSets){
    throw new Error(`latest real workout linkage mismatch: ui=${trainingState.exercises}/${trainingState.sets} data=${integrity.latestExpectedExercises}/${integrity.latestExpectedSets}`);
  }
  if(integrity.latestWorkoutDate&&!trainingState.text.includes(String(integrity.latestWorkoutDate).split('-').reverse().join('/')))throw new Error('latest workout date missing from structural Training');

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

  await page.setViewportSize({width:390,height:844});
  await waitForRoute('hoje');
  await page.waitForSelector('.ltsHomeV2',{timeout:30000});
  await assertNoHorizontalOverflow();
  await page.screenshot({path:`${evidenceDir}/mobile-home.png`,fullPage:true});
  await waitForRoute('treinos');
  await page.waitForSelector('.ltsTrainingV2',{timeout:30000});
  await assertNoHorizontalOverflow();
  await page.screenshot({path:`${evidenceDir}/mobile-training.png`,fullPage:true});
  for(const route of ['nutricao','bio','analise','saude','tratamentos','evolucao','timeline','dados']){await waitForRoute(route);await assertNoHorizontalOverflow();}

  await page.evaluate(async ({url,key})=>{const client=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});await client.auth.signOut({scope:'local'});},{url:supabaseUrl,key:supabaseKey});
  if(runtimeErrorCount)throw new Error(`browser runtime errors occurred during real authenticated E2E: ${runtimeErrorCount}`);
  console.log(`LTS Health real authenticated E2E passed; integrity=${JSON.stringify(integrity)}`);
}finally{await browser.close();}
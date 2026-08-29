import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900},timezoneId:'America/Sao_Paulo'});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:4173/?fixture=1#bio',{waitUntil:'domcontentloaded'});
await page.waitForSelector('#app:not(.hidden)');

const result=await page.evaluate(async()=>{
  const {state}=await import('./src/core.js');
  const {saveBodyRecord,saveWorkout}=await import('./src/writes.js');
  const {localDateValue}=await import('./src/entry.js');
  const initialBody=state.data.body.length;
  const failures=[];
  async function expectReject(name,fn){try{await fn();failures.push(`${name}:accepted`);}catch(error){if(error?.message!=='negative_number_not_allowed')failures.push(`${name}:${error?.message||error}`);}}

  if(localDateValue(new Date('2026-08-30T02:30:00Z'))!=='2026-08-29')failures.push('local date drifted to UTC next day');

  await expectReject('negative body',()=>saveBodyRecord({measured_at:'2026-02-10',weight_kg:'-1'}));
  if(state.data.body.length!==initialBody)failures.push('negative body mutated fixture');

  await expectReject('negative duration',()=>saveWorkout({workout_date:'2026-02-10',workout_type:'Teste',duration_minutes:'-5',exercises:[{name:'Exercício',sets:[{weight:'10',weight_unit:'kg',reps:'8'}]}]}));
  await expectReject('negative weight',()=>saveWorkout({workout_date:'2026-02-10',workout_type:'Teste',exercises:[{name:'Exercício',sets:[{weight:'-10',weight_unit:'kg',reps:'8'}]}]}));
  await expectReject('negative reps',()=>saveWorkout({workout_date:'2026-02-10',workout_type:'Teste',exercises:[{name:'Exercício',sets:[{weight:'10',weight_unit:'kg',reps:'-1'}]}]}));

  const bodyId=await saveBodyRecord({measured_at:'2026-02-10',weight_kg:'92,3',skeletal_muscle_mass_kg:'',body_fat_pct:'',notes:''});
  const saved=state.data.body.find(row=>row.source_record_id===bodyId);
  if(!saved)failures.push('valid body not saved');
  if(saved?.weight_kg!==92.3)failures.push(`decimal comma not parsed: ${saved?.weight_kg}`);
  if(saved?.skeletal_muscle_mass_kg!==null||saved?.body_fat_pct!==null)failures.push('blank body fields did not remain null');

  const workout=await saveWorkout({workout_date:'2026-02-10',workout_type:'Teste',duration_minutes:'',calories_kcal:'',exercises:[{name:'Exercício',muscle_group:'Teste',sets:[{phase:'working',weight:'',weight_unit:'kg',reps:''}]}]});
  if(!workout?.ok)failures.push('blank optional workout values were rejected');
  return {failures};
});

if(result.failures.length)throw new Error(result.failures.join(' | '));

// Exercise the actual form: expected validation stays visible and does not close the dialog.
await page.locator('#routeAction').click();
await page.waitForSelector('#entryModal:not(.hidden)');
await page.locator('#bodyEntryForm [name="weight_kg"]').fill('-1');
await page.locator('#bodyEntryForm button[type="submit"]').click();
await page.waitForFunction(()=>document.querySelector('#entryMsg')?.textContent==='Use apenas valores iguais ou maiores que zero.');
if(await page.locator('#entryModal').evaluate(el=>el.classList.contains('hidden')))throw new Error('validation closed the entry dialog');
if(errors.length)throw new Error(`browser errors: ${errors.join(' | ')}`);

await context.close();
await browser.close();
console.log('LTS Health v2 write integrity smoke passed');

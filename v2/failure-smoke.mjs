import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1';
const forbidden=/\b(canonical|candidate|parity|backend|provenance[- ]first|readiness|PWA|source_family|ActivitySummary|MME)\b|não consolidado|count\/min|can[oô]nic[oa]|candidat[oa]/i;

async function open(kind,route,title){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(`${base}&fixtureError=${kind}#${route}`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(t=>document.querySelector('#screenHost h1')?.textContent===t,title);
  const text=(await page.textContent('#screenHost'))||'';
  if(text.match(forbidden))throw new Error(`${route}/${kind}: implementation jargon visible`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);if(overflow>3)throw new Error(`${route}/${kind}: horizontal overflow ${overflow}px`);
  return{browser,page,text,errors};
}

async function openToday(kind,viewport){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(`${base}&fixtureError=${kind}#hoje`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForSelector('[data-executive-dashboard]');
  const text=(await page.textContent('#screenHost'))||'';
  if(text.match(forbidden))throw new Error(`hoje/${kind}: implementation jargon visible`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);if(overflow>3)throw new Error(`hoje/${kind}: horizontal overflow ${overflow}px`);
  return{browser,page,text,errors};
}

async function finish(ctx,label){if(ctx.errors.length)throw new Error(`${label}: page errors ${ctx.errors.join(' | ')}`);await ctx.browser.close();}

{
  const ctx=await open('segmental','evolucao','Evolução');
  const metric=await ctx.page.locator('.metric').filter({hasText:'Análises segmentares'}).first().textContent();
  if(!metric?.includes('—')||!ctx.text.includes('medições segmentares não carregaram'))throw new Error('evolucao/segmental: failure hidden or rendered as zero');
  if(await ctx.page.locator('[data-segmental-date]').count())throw new Error('evolucao/segmental: stale date controls visible');
  await finish(ctx,'evolucao/segmental');
}
{
  const ctx=await open('workouts','evolucao','Evolução');
  const metric=await ctx.page.locator('.metric').filter({hasText:'Treinos'}).first().textContent();
  if(!metric?.includes('—')||!ctx.text.includes('ritmo semanal não pode ser calculado'))throw new Error('evolucao/workouts: failure hidden or rendered as zero');
  await finish(ctx,'evolucao/workouts');
}
{
  const ctx=await open('nutrition','analise','Análise');
  const metric=await ctx.page.locator('.analysisLead .metric').filter({hasText:'Alimentação'}).first().textContent();
  const nutritionBlock=await ctx.page.locator('section.card').filter({hasText:'Alimentação no período'}).first().textContent();
  if(!metric?.includes('—')||!nutritionBlock?.includes('Os dados de alimentação não carregaram agora.')||!ctx.text.includes('nenhuma falha é convertida em zero'))throw new Error('analise/nutrition: failure hidden or rendered as zero');
  if(/\b\d+(?:[.,]\d+)?\s*(?:kcal|g|mL)\b/i.test(nutritionBlock||''))throw new Error('analise/nutrition: failed domain rendered numeric nutrition values');
  await finish(ctx,'analise/nutrition');
}
{
  const ctx=await open('sourceMetrics','analise','Análise');
  const metric=await ctx.page.locator('.metric').filter({hasText:'Sono preservado'}).first().textContent();
  if(!metric?.includes('—')||!ctx.text.includes('registros por origem não carregaram agora'))throw new Error('analise/sourceMetrics: failure hidden or rendered as zero');
  await finish(ctx,'analise/sourceMetrics');
}
{
  const ctx=await open('labs','timeline','Timeline');
  if(!ctx.text.includes('Parte da Timeline está indisponível agora')||!ctx.text.includes('Exames'))throw new Error('timeline/labs: unavailable domain not disclosed');
  if(!ctx.text.includes('Caminhada')||!ctx.text.includes('Sono'))throw new Error('timeline/labs: healthy domains disappeared');
  await finish(ctx,'timeline/labs');
}
{
  const ctx=await open('uploads','dados','Dados');
  if(!ctx.text.includes('Não foi possível verificar os arquivos agora'))throw new Error('dados/uploads: upload failure is not explicit');
  if(/Arquivos recebidos[\s\S]{0,80}\b0\b/i.test(ctx.text))throw new Error('dados/uploads: upload failure rendered as zero');
  await finish(ctx,'dados/uploads');
}
{
  const ctx=await open('labs','dados','Dados');
  const exams=await ctx.page.locator('.sourceCard').filter({hasText:'Exames'}).first().textContent();
  if(!exams?.includes('—')||!exams?.includes('não carregou agora'))throw new Error('dados/labs: failed exam area was presented as zero or absent');
  await finish(ctx,'dados/labs');
}
{
  const ctx=await open('treatments','tratamentos','Tratamentos');
  if(!ctx.text.includes('histórico de tratamentos não carregou agora'))throw new Error('tratamentos: failure hidden');
  if(ctx.text.match(/\b(dose|dosagem|ciclo|aplica[cç][aã]o)\b/i))throw new Error('tratamentos: operational guidance visible');
  await finish(ctx,'tratamentos');
}
{
  const ctx=await openToday('nutrition',{width:390,height:844});
  const card=await ctx.page.locator('.dashboardCurrent').filter({hasText:'Alimentação'}).first().textContent();
  if(!card?.includes('Indisponível agora')||card?.includes('Sem registro recente')||card?.match(/\b0\s*kcal\b/i))throw new Error('hoje/nutrition mobile: failed domain presented as absence or zero');
  if(!ctx.text.includes('Último treino'))throw new Error('hoje/nutrition mobile: healthy snapshot cards disappeared');
  await finish(ctx,'hoje/nutrition mobile');
}
{
  const ctx=await openToday('labs',{width:1440,height:900});
  const card=await ctx.page.locator('.dashboardCurrent').filter({hasText:'Exames'}).first().textContent();
  if(!card?.includes('Indisponível agora')||card?.includes('Sem coleta estruturada')||card?.match(/\b0\b/))throw new Error('hoje/labs desktop: failed domain presented as absence or zero');
  if(!ctx.text.includes('Último treino')||!ctx.text.includes('Composição'))throw new Error('hoje/labs desktop: healthy snapshot cards disappeared');
  await finish(ctx,'hoje/labs desktop');
}

console.log('LTS Health v2 failure-state smoke passed');

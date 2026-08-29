import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1';
const forbidden=/\b(canonical|parity|backend|provenance[- ]first|readiness|PWA)\b/i;

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
  const metric=await ctx.page.locator('.metric').filter({hasText:'Alimentação · 90 dias'}).first().textContent();
  if(!metric?.includes('—')||!ctx.text.includes('cruzamento não pode ser calculado'))throw new Error('analise/nutrition: failure hidden or rendered as zero');
  await finish(ctx,'analise/nutrition');
}
{
  const ctx=await open('metrics','analise','Análise');
  const metric=await ctx.page.locator('.metric').filter({hasText:'Sono · 90 dias'}).first().textContent();
  if(!metric?.includes('—')||!ctx.text.includes('pareamento não pode ser calculado'))throw new Error('analise/metrics: failure hidden or rendered as zero');
  await finish(ctx,'analise/metrics');
}
{
  const ctx=await open('labs','timeline','Timeline');
  if(!ctx.text.includes('Parte da Timeline está indisponível agora')||!ctx.text.includes('Exames'))throw new Error('timeline/labs: unavailable domain not disclosed');
  if(!ctx.text.includes('Caminhada')||!ctx.text.includes('Sono'))throw new Error('timeline/labs: healthy domains disappeared');
  await finish(ctx,'timeline/labs');
}
{
  const ctx=await open('uploads','dados','Dados');
  if(!ctx.text.includes('não verificado')||!ctx.text.includes('Arquivos indisponíveis agora'))throw new Error('dados/uploads: source state falsely presented as missing');
  if(/Arquivos recebidos[\s\S]{0,80}\b0\b/i.test(ctx.text))throw new Error('dados/uploads: upload failure rendered as zero');
  await finish(ctx,'dados/uploads');
}
{
  const ctx=await open('labs','dados','Dados');
  const exams=await ctx.page.locator('.sourceCard').filter({hasText:'Exames'}).first().textContent();
  if(!exams?.includes('—')||!exams?.includes('indisponível agora'))throw new Error('dados/labs: area count rendered as zero');
  await finish(ctx,'dados/labs');
}
{
  const ctx=await open('treatments','tratamentos','Tratamentos');
  if(!ctx.text.includes('histórico de tratamentos não carregou agora'))throw new Error('tratamentos: failure hidden');
  if(ctx.text.match(/\b(dose|dosagem|ciclo|aplica[cç][aã]o)\b/i))throw new Error('tratamentos: operational guidance visible');
  await finish(ctx,'tratamentos');
}

console.log('LTS Health v2 failure-state smoke passed');

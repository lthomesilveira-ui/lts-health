import {state,esc,day,fmtDate,fmtNum,num,norm,fixtureMode} from './core.js';
import {fetchAll} from './data-layer.js';
import {consolidatedWeightSeries,labNarrativeSeries,sampleSeries} from './longitudinal-model.js';

let weightPromise=null;
let timer=null;
let observer=null;

function route(){return String(location.hash||'#hoje').replace(/^#/,'')||'hoje';}
function sourceLabel(value=''){
  const key=norm(value);
  if(key.includes('inbody'))return'InBody';
  if(key.includes('bioimped'))return'Bioimpedância';
  if(key.includes('myfitnesspal'))return'MyFitnessPal';
  return String(value||'Origem registrada').trim()||'Origem registrada';
}
function uniqueLatestBody(rows=[]){
  const groups=new Map();
  for(const row of rows){const d=day(row?.measured_at);if(!d)continue;if(!groups.has(d))groups.set(d,[]);groups.get(d).push(row);}
  const safe=[...groups.entries()].filter(([,items])=>items.length===1).sort((a,b)=>a[0].localeCompare(b[0]));
  return safe.at(-1)?.[1]?.[0]||null;
}
async function mfpWeightMetrics(){
  const loaded=(state.data?.metrics||[]).filter(row=>row?.metric_type==='weight_kg'&&norm(row?.source).includes('myfitnesspal'));
  if(loaded.length||fixtureMode)return loaded;
  if(!weightPromise)weightPromise=fetchAll('health_metrics','source_record_id,measured_at,metric_type,value,unit,source,source_file,confidence,notes','measured_at',false).then(rows=>rows.filter(row=>row?.metric_type==='weight_kg'&&norm(row?.source).includes('myfitnesspal'))).catch(()=>[]);
  return weightPromise;
}
function sparkline(points=[]){
  const rows=sampleSeries(points,72).filter(point=>point?.date&&num(point?.value)!=null);
  if(rows.length<2)return'<div class="longitudinalEmpty">Ainda não há pontos suficientes para desenhar a evolução.</div>';
  const values=rows.map(row=>num(row.value)),minRaw=Math.min(...values),maxRaw=Math.max(...values),span=Math.max(maxRaw-minRaw,1),min=minRaw-span*.12,max=maxRaw+span*.12,w=720,h=180,left=16,right=16,top=15,bottom=20,plotW=w-left-right,plotH=h-top-bottom;
  const x=index=>left+index*plotW/Math.max(1,rows.length-1),y=value=>top+(max-value)*plotH/Math.max(max-min,.001);
  const path=rows.map((row,index)=>`${index?'L':'M'}${x(index).toFixed(1)} ${y(num(row.value)).toFixed(1)}`).join(' ');
  const sourceBreaks=rows.map((row,index)=>index>0&&row.sourceKind!==rows[index-1].sourceKind?`<circle class="longitudinalBreak" cx="${x(index).toFixed(1)}" cy="${y(num(row.value)).toFixed(1)}" r="4"><title>Mudança de origem em ${esc(fmtDate(row.date))}</title></circle>`:'').join('');
  return `<div class="longitudinalChart"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Evolução longitudinal do peso"><path class="longitudinalGrid" d="M${left} ${top+plotH*.25}H${w-right} M${left} ${top+plotH*.5}H${w-right} M${left} ${top+plotH*.75}H${w-right}"/><path class="longitudinalLine" d="${path}"/>${sourceBreaks}</svg><div class="longitudinalAxis"><span>${esc(fmtDate(rows[0].date))}</span><span>${esc(fmtDate(rows.at(-1).date))}</span></div></div>`;
}
function fact(label,value,sub=''){return `<div><span>${esc(label)}</span><b>${esc(value)}</b>${sub?`<small>${esc(sub)}</small>`:''}</div>`;}

async function enhanceBio(host){
  if(host.querySelector('[data-longitudinal-bio]'))return;
  const title=host.querySelector('.screenTitle');if(!title)return;
  const latest=uniqueLatestBody(state.data?.body||[]);if(!latest)return;
  const hero=document.createElement('section');hero.className='bioLatestHero';hero.dataset.longitudinalBio='1';
  const bodyFacts=[
    fact('Peso',num(latest.weight_kg)==null?'—':`${fmtNum(latest.weight_kg,1)} kg`),
    fact('Massa muscular',num(latest.skeletal_muscle_mass_kg)==null?'—':`${fmtNum(latest.skeletal_muscle_mass_kg,1)} kg`),
    fact('Gordura corporal',num(latest.body_fat_pct)==null?'—':`${fmtNum(latest.body_fat_pct,1)}%`),
    fact('Água corporal',num(latest.body_water_l)==null?'—':`${fmtNum(latest.body_water_l,1)} L`,'composição, não ingestão')
  ].join('');
  hero.innerHTML=`<div class="bioLatestLead"><span>Última bioimpedância</span><h2>${esc(fmtDate(latest.measured_at))}</h2><small>${esc(sourceLabel(latest.source))} · ${(state.data?.body||[]).length} medição(ões) preservadas</small></div><div class="bioLatestFacts">${bodyFacts}</div><button type="button" class="storyAction" data-route="dados">Ver fontes →</button>`;
  const legacyNote=host.querySelector('.screenTitle + .note');if(legacyNote)legacyNote.replaceWith(hero);else title.after(hero);

  const metrics=await mfpWeightMetrics();
  if(route()!=='bio'||host.querySelector('[data-longitudinal-weight]'))return;
  const series=consolidatedWeightSeries(state.data?.body||[],metrics);
  if(!series.points.length)return;
  const card=document.createElement('section');card.className='card longitudinalWeightCard';card.dataset.longitudinalWeight='1';
  const bodyCount=series.sourceCounts.body_composition||0,mfpCount=series.sourceCounts.myfitnesspal||0,last=series.last,first=series.first;
  card.innerHTML=`<div class="longitudinalHead"><div><span>História do peso</span><h2>${last?`${esc(fmtNum(last.value,1))} kg`:'—'}</h2><small>${first&&last?`${esc(fmtDate(first.date))} → ${esc(fmtDate(last.date))}`:'histórico disponível'}</small></div><div class="longitudinalCoverage"><b>${series.points.length}</b><span>pontos únicos</span></div></div>${sparkline(series.points)}<div class="longitudinalFacts">${fact('MyFitnessPal',`${mfpCount} ponto(s)`,'preenche dias sem InBody')}${fact('InBody / bioimpedância',`${bodyCount} ponto(s)`,'prioridade quando há a mesma data')}${fact('Overlaps resolvidos',`${series.overlap.total}`,'sem média e sem dupla contagem')}${fact('Datas em revisão',`${series.blockedDates.length}`,'fora da série até ficarem inequívocas')}</div><p class="longitudinalRule">Regra desta série: quando MyFitnessPal e InBody têm peso no mesmo dia, a bioimpedância é usada para aquele dia; o MyFitnessPal completa as demais datas. Nenhum valor é somado ou promediado.</p>`;
  hero.after(card);
}

function labCard(item){
  const last=`${fmtNum(item.lastValue)} ${item.unit}`.trim(),delta=`${item.delta>0?'+':''}${fmtNum(item.delta)} ${item.unit}`.trim();
  return `<button type="button" class="labStoryCard" data-story-marker="${esc(item.key)}"><span>${esc(item.label)}</span><b>${esc(last)}</b><small>${item.pointCount} pontos comparáveis · ${esc(fmtDate(item.firstDate))} → ${esc(fmtDate(item.lastDate))}</small><em>Diferença na série: ${esc(delta)}${item.seriesCount>1?' · outras origens/unidades seguem separadas':''}</em><i>Ver histórico →</i></button>`;
}
function enhanceLabs(host){
  if(host.querySelector('[data-longitudinal-labs]'))return;
  const title=host.querySelector('.screenTitle');if(!title||state.domainStatus?.labs==='error')return;
  const items=labNarrativeSeries(state.data?.labs||[]).slice(0,6);if(!items.length)return;
  const section=document.createElement('section');section.className='card labStory';section.dataset.longitudinalLabs='1';
  section.innerHTML=`<div class="labStoryHead"><div><span>Evolução dos exames</span><h2>Histórico que vale acompanhar</h2><p>Séries são comparadas somente dentro da mesma origem e unidade. “Subiu” ou “desceu” é descritivo; o app não transforma isso automaticamente em melhor ou pior.</p></div><div><b>${items.length}</b><small>atalhos longitudinais</small></div></div><div class="labStoryGrid">${items.map(labCard).join('')}</div>`;
  title.after(section);
  section.addEventListener('click',event=>{
    const button=event.target.closest('[data-story-marker]');if(!button)return;
    const key=button.dataset.storyMarker,target=[...host.querySelectorAll('button[data-marker]')].find(node=>node.dataset.marker===key);
    if(target){target.click();setTimeout(()=>host.querySelector('.markerHead')?.scrollIntoView({behavior:'smooth',block:'start'}),80);}
  });
}

async function enhance(){
  const host=document.getElementById('screenHost');if(!host||!document.getElementById('app')||document.getElementById('app').classList.contains('hidden'))return;
  const current=route();
  if(current==='bio')await enhanceBio(host);
  if(current==='saude')enhanceLabs(host);
}
function schedule(delay=0){clearTimeout(timer);timer=setTimeout(()=>enhance().catch(error=>console.warn('Longitudinal story enhancement skipped:',error)),delay);}
function start(){
  const host=document.getElementById('screenHost');if(!host)return;
  observer=new MutationObserver(()=>schedule(20));observer.observe(host,{childList:true,subtree:false});
  window.addEventListener('hashchange',()=>schedule(20));
  document.addEventListener('click',event=>{if(event.target.closest('[data-route]')||event.target.closest('#refreshBtn'))schedule(120);});
  schedule(60);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

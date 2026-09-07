import {state,esc,day,fmtDate,fmtNum,num,norm,fixtureMode} from './core.js';
import {fetchAll} from './data-layer.js';
import {consolidatedWeightSeries,labNarrativeSeries,sampleSeries} from './longitudinal-model.js';

let weightPromise=null;
const timers=new Set();

function route(){return String(location.hash||'#hoje').replace(/^#/,'')||'hoje';}
function sourceLabel(value=''){
  const key=norm(value);
  if(key.includes('inbody'))return'InBody';
  if(key.includes('bioimped'))return'Bioimpedância';
  if(key.includes('myfitnesspal'))return'MyFitnessPal';
  return String(value||'Origem registrada').trim()||'Origem registrada';
}
function bodySource(row){return norm(row?.source_family||row?.source_name||row?.source||'');}
function uniqueBodyRows(rows=[]){
  const groups=new Map();
  for(const row of rows){const d=day(row?.measured_at);if(!d)continue;if(!groups.has(d))groups.set(d,[]);groups.get(d).push(row);}
  return [...groups.entries()].filter(([,items])=>items.length===1).sort((a,b)=>a[0].localeCompare(b[0])).map(([,items])=>items[0]);
}
async function mfpWeightMetrics(){
  const loaded=(state.data?.metrics||[]).filter(row=>row?.metric_type==='weight_kg'&&norm(row?.source).includes('myfitnesspal'));
  if(loaded.length||fixtureMode)return loaded;
  if(!weightPromise){
    weightPromise=fetchAll('health_metrics','source_record_id,measured_at,metric_type,value,unit,source,source_file,confidence,notes','measured_at',false)
      .then(rows=>rows.filter(row=>row?.metric_type==='weight_kg'&&norm(row?.source).includes('myfitnesspal')))
      .catch(error=>{console.warn('Longitudinal weight history unavailable:',error);weightPromise=null;return[];});
  }
  return weightPromise;
}
function signed(value,digits=1,unit=''){
  const n=num(value);if(n==null)return null;
  return `${n>0?'+':''}${fmtNum(n,digits)}${unit?` ${unit}`:''}`;
}
function bodyChange(latest,previous){
  if(!previous)return{headline:'Primeira medição comparável do histórico carregado.',detail:'Ainda não existe uma medição anterior inequívoca para calcular diferença.'};
  const currentSource=bodySource(latest),previousSource=bodySource(previous);
  if(!currentSource||!previousSource||currentSource!==previousSource){
    return{headline:`Mudança desde ${fmtDate(previous.measured_at)} não calculada.`,detail:'A origem da medição mudou; os valores permanecem visíveis sem comparação automática.'};
  }
  const pieces=[],delta=(a,b)=>{a=num(a);b=num(b);return a==null||b==null?null:a-b;};
  const weight=signed(delta(latest.weight_kg,previous.weight_kg),1,'kg');if(weight)pieces.push(`peso ${weight}`);
  const muscle=signed(delta(latest.skeletal_muscle_mass_kg,previous.skeletal_muscle_mass_kg),1,'kg');if(muscle)pieces.push(`massa muscular ${muscle}`);
  const fat=signed(delta(latest.body_fat_pct,previous.body_fat_pct),1,'p.p.');if(fat)pieces.push(`gordura corporal ${fat}`);
  return pieces.length?{headline:`Mudança desde ${fmtDate(previous.measured_at)}`,detail:pieces.join(' · ')}:{headline:`Medição anterior em ${fmtDate(previous.measured_at)}`,detail:'Os campos comparáveis necessários para resumir a mudança não estão completos.'};
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
  if(host.querySelector('[data-longitudinal-bio]'))return true;
  const title=host.querySelector('.screenTitle');if(!title)return false;
  const bodyRows=uniqueBodyRows(state.data?.body||[]),latest=bodyRows.at(-1);if(!latest)return false;
  const previous=bodyRows.at(-2),change=bodyChange(latest,previous);
  const hero=document.createElement('section');hero.className='bioLatestHero';hero.dataset.longitudinalBio='1';
  const bodyFacts=[
    fact('Peso',num(latest.weight_kg)==null?'—':`${fmtNum(latest.weight_kg,1)} kg`),
    fact('Massa muscular',num(latest.skeletal_muscle_mass_kg)==null?'—':`${fmtNum(latest.skeletal_muscle_mass_kg,1)} kg`),
    fact('Gordura corporal',num(latest.body_fat_pct)==null?'—':`${fmtNum(latest.body_fat_pct,1)}%`),
    fact('Água corporal',num(latest.body_water_l)==null?'—':`${fmtNum(latest.body_water_l,1)} L`,'composição, não ingestão')
  ].join('');
  hero.innerHTML=`<div class="bioLatestLead"><span>Resumo</span><h2>Última medição</h2><strong>${esc(fmtDate(latest.measured_at))}</strong><small>${esc(sourceLabel(latest.source))} · ${(state.data?.body||[]).length} medição(ões) preservadas</small></div><div class="bioLatestFacts">${bodyFacts}</div><div class="bioLatestChange"><span>Mudança relevante</span><b>${esc(change.headline)}</b><small>${esc(change.detail)}</small></div><div class="storyActions"><button type="button" class="storyAction primaryStory" data-story-scroll="weight">Ver tendência do peso</button><button type="button" class="storyAction" data-route="dados">Ver fontes</button></div>`;
  const legacyNote=host.querySelector('.screenTitle + .note');if(legacyNote)legacyNote.replaceWith(hero);else title.after(hero);

  const metrics=await mfpWeightMetrics();
  if(route()!=='bio'||!document.body.contains(host)||host.querySelector('[data-longitudinal-weight]'))return true;
  const series=consolidatedWeightSeries(state.data?.body||[],metrics);if(!series.points.length)return true;
  const card=document.createElement('section');card.className='card longitudinalWeightCard';card.dataset.longitudinalWeight='1';
  const bodyCount=series.sourceCounts.body_composition||0,mfpCount=series.sourceCounts.myfitnesspal||0,last=series.last,first=series.first;
  const overall=first&&last?signed(num(last.value)-num(first.value),1,'kg'):null;
  card.innerHTML=`<div class="longitudinalHead"><div><span>Tendência</span><h2>História do peso</h2><p>${last?`${esc(fmtNum(last.value,1))} kg em ${esc(fmtDate(last.date))}`:'Histórico disponível'}${overall?` · diferença desde o primeiro ponto ${esc(overall)}`:''}</p><small>${first&&last?`${esc(fmtDate(first.date))} → ${esc(fmtDate(last.date))}`:'histórico disponível'}</small></div><div class="longitudinalCoverage"><b>${series.points.length}</b><span>dias únicos</span></div></div>${sparkline(series.points)}<div class="longitudinalFacts">${fact('MyFitnessPal',`${mfpCount} ponto(s)`,'preenche dias sem InBody')}${fact('InBody / bioimpedância',`${bodyCount} ponto(s)`,'prioridade quando há a mesma data')}${fact('Sobreposições resolvidas',`${series.overlap.total}`,'sem média e sem dupla contagem')}${fact('Datas em revisão',`${series.blockedDates.length}`,'fora da série até ficarem inequívocas')}</div><p class="longitudinalRule">Regra da série: quando MyFitnessPal e InBody têm peso no mesmo dia, a bioimpedância prevalece; o MyFitnessPal completa as demais datas. Nenhum valor é somado ou promediado.</p><div class="storyActions"><button type="button" class="storyAction" data-story-scroll="body-detail">Ver detalhe das medições</button></div>`;
  hero.after(card);return true;
}

function labCard(item){
  const last=`${fmtNum(item.lastValue)} ${item.unit}`.trim(),delta=`${item.delta>0?'+':''}${fmtNum(item.delta)} ${item.unit}`.trim();
  return `<button type="button" class="labStoryCard" data-story-marker="${esc(item.key)}"><span>${esc(item.label)}</span><b>${esc(last)}</b><small>${item.pointCount} pontos comparáveis · ${esc(fmtDate(item.firstDate))} → ${esc(fmtDate(item.lastDate))}</small><em>Mudança na série: ${esc(delta)}${item.seriesCount>1?' · outras origens/unidades seguem separadas':''}</em><i>Abrir histórico</i></button>`;
}
function prioritizeLabs(items=[]){
  const preferred=[],rest=[];
  for(const item of items){const key=norm(item?.label);(key.includes('ferritina')||key.includes('testosterona')?preferred:rest).push(item);}
  return [...preferred,...rest].slice(0,6);
}
function enhanceLabs(host){
  if(host.querySelector('[data-longitudinal-labs]'))return true;
  const title=host.querySelector('.screenTitle');if(!title||state.domainStatus?.labs==='error')return false;
  const items=prioritizeLabs(labNarrativeSeries(state.data?.labs||[]));if(!items.length)return false;
  const section=document.createElement('section');section.className='card labStory';section.dataset.longitudinalLabs='1';
  section.innerHTML=`<div class="labStoryHead"><div><span>Resumo longitudinal</span><h2>Evolução dos exames</h2><p>Veja primeiro o último resultado, depois a mudança na mesma série e abra o gráfico detalhado quando precisar. Séries só unem a mesma origem e unidade.</p></div><div><b>${items.length}</b><small>atalhos com histórico</small></div></div><div class="labStoryGrid">${items.map(labCard).join('')}</div><p class="longitudinalRule">“Subiu” ou “desceu” aqui é apenas descritivo. O LTS Health não transforma a direção da série em melhor ou pior e não combina origens ou unidades diferentes.</p>`;
  title.after(section);return true;
}

async function enhance(){
  const app=document.getElementById('app'),host=document.getElementById('screenHost');
  if(!host||!app||app.classList.contains('hidden'))return false;
  const current=route();
  if(current==='bio')return enhanceBio(host);
  if(current==='saude')return enhanceLabs(host);
  return true;
}
function scheduleAttempts(){
  for(const timer of timers)clearTimeout(timer);timers.clear();
  for(const delay of [0,80,240,650,1400,3000,6500,12000]){
    const timer=setTimeout(()=>{timers.delete(timer);enhance().catch(error=>console.warn('Longitudinal story enhancement skipped:',error));},delay);
    timers.add(timer);
  }
}
function scrollTarget(kind){
  const host=document.getElementById('screenHost');if(!host)return;
  const target=kind==='weight'?host.querySelector('[data-longitudinal-weight]'):host.querySelector('[data-body-date],.bioDetailHead,.bioCombinedGrid');
  target?.scrollIntoView({behavior:'smooth',block:'start'});
}
function openLabMarker(button){
  const host=document.getElementById('screenHost'),key=button?.dataset?.storyMarker;if(!host||!key)return;
  const target=[...host.querySelectorAll('button[data-marker]')].find(node=>node.dataset.marker===key);
  if(target){target.click();setTimeout(()=>host.querySelector('.markerHead')?.scrollIntoView({behavior:'smooth',block:'start'}),120);}
}
function start(){
  document.addEventListener('click',event=>{
    const storyScroll=event.target.closest('[data-story-scroll]');if(storyScroll){event.preventDefault();scrollTarget(storyScroll.dataset.storyScroll);return;}
    const storyMarker=event.target.closest('[data-story-marker]');if(storyMarker){event.preventDefault();openLabMarker(storyMarker);scheduleAttempts();return;}
    if(event.target.closest('[data-route],#refreshBtn,[data-marker],[data-bio-metric],[data-body-date]'))scheduleAttempts();
  });
  document.addEventListener('input',event=>{if(['labQuery'].includes(event.target?.id))scheduleAttempts();});
  document.addEventListener('change',event=>{if(['collectionSelect','compareA','compareB'].includes(event.target?.id))scheduleAttempts();});
  window.addEventListener('hashchange',scheduleAttempts);
  window.addEventListener('pageshow',scheduleAttempts);
  scheduleAttempts();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

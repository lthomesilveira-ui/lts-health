import {state,day,num,fmtNum} from './core.js';
import {executiveCockpitModel} from './today-screen.js';

const periodOptions=[
  ['30','30 dias'],
  ['90','90 dias'],
  ['365','1 ano'],
  ['all','Histórico']
];

const iconSvgs={
  body:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2.2" fill="currentColor"/><path d="M9.2 8.5c1.9-1.1 3.7-1.1 5.6 0l1.9 2.9-1.8 1.1-1.2-1.9v3.2l2.1 5.4-2.1.8-1.7-4.1-1.7 4.1-2.1-.8 2.1-5.4v-3.2l-1.2 1.9-1.8-1.1 1.9-2.9z" fill="currentColor"/></svg>',
  training:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="9" width="3" height="6" rx="1" fill="currentColor"/><rect x="18" y="9" width="3" height="6" rx="1" fill="currentColor"/><rect x="7" y="7" width="3" height="10" rx="1" fill="currentColor"/><rect x="14" y="7" width="3" height="10" rx="1" fill="currentColor"/><rect x="10" y="11" width="4" height="2" rx="1" fill="currentColor"/></svg>',
  nutrition:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.8 6.1c1.1-2.1 2.4-3.1 4.1-3.1-.1 2.1-1.2 3.4-3.2 4.1" fill="currentColor"/><path d="M12 8.2c2.1-2.2 6-1.7 7.2 1.4 1.7 4.4-1.3 10.1-4.5 10.1-1.2 0-1.6-.6-2.7-.6s-1.5.6-2.7.6c-3.2 0-6.2-5.7-4.5-10.1C6 6.5 9.9 6 12 8.2z" fill="currentColor"/></svg>',
  recovery:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.8 15.9A8.2 8.2 0 0 1 8.1 5.2a8.5 8.5 0 1 0 10.7 10.7z" fill="currentColor"/></svg>',
  labs:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6v2l-1.2 1.8v2.5l4.4 7.7A2.7 2.7 0 0 1 15.9 21H8.1a2.7 2.7 0 0 1-2.3-4l4.4-7.7V6.8L9 5V3zm1.8 9-2.7 4.8c-.4.7.1 1.6.9 1.6h6c.8 0 1.3-.9.9-1.6L13.2 12h-2.4z" fill="currentColor"/></svg>'
};

function ensurePixelParityStyles(){
  if(document.querySelector('link[data-dashboard-pixel-parity]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=new URL('../dashboard-pixel-parity.css',import.meta.url).href;
  link.dataset.dashboardPixelParity='1';
  document.head.appendChild(link);
}

function ensureSidebarBrand(){
  const nav=document.getElementById('primaryNav');
  if(!nav||nav.querySelector('.sidebarBrandGlyph'))return;
  const mark=document.createElement('span');
  mark.className='sidebarBrandGlyph';
  mark.setAttribute('aria-hidden','true');
  mark.innerHTML='<svg viewBox="0 0 32 32"><path d="M5 25.7 13.1 6.5c.8-1.9 3.4-1.9 4.2-.1l2.1 4.8-3.7 7.7-2.3-5.3-4.9 12.1H5z" fill="#2f80ed"/><path d="M18.1 7.3 28 24.8c1 1.8-.3 4-2.3 4H8.8l3.1-6.5h8.9l-6.2-10.7 3.5-4.3z" fill="#6ab0ff"/></svg>';
  nav.appendChild(mark);
}

function formatDate(value){
  const d=day(value);if(!d)return null;
  const [y,m,dd]=d.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'short',year:'numeric'}).format(new Date(Date.UTC(y,m-1,dd))).replace(/\./g,'');
}

function dateRangeText(model){
  if(model?.period==='all')return['Histórico','Todo o período disponível'];
  const start=formatDate(model?.bounds?.start),end=formatDate(model?.bounds?.end);
  if(start&&end)return[start,end];
  return['Janela atual','Período selecionado'];
}

function miniSvg(points,{bar=false}={}){
  const values=(points||[]).map(p=>num(p?.value)).filter(v=>v!=null).slice(-12);
  if(!values.length)return '<svg viewBox="0 0 64 38" aria-hidden="true"><line class="cockpitMiniBase" x1="4" y1="28" x2="60" y2="28"/></svg>';
  const lo=bar?0:Math.min(...values),hi=Math.max(...values),span=Math.max(hi-lo,1);
  if(bar){
    const gap=2,w=Math.max(3,(56-gap*(values.length-1))/values.length);
    const bars=values.map((v,i)=>{const h=8+(v-lo)/span*22;const x=4+i*(w+gap),y=33-h;return `<rect class="cockpitMiniBar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.3"/>`;}).join('');
    return `<svg viewBox="0 0 64 38" aria-hidden="true">${bars}</svg>`;
  }
  if(values.length===1)return '<svg viewBox="0 0 64 38" aria-hidden="true"><line class="cockpitMiniBase" x1="4" y1="20" x2="60" y2="20"/></svg>';
  const pts=values.map((v,i)=>{const x=4+i*56/(values.length-1),y=31-(v-lo)/span*22;return{x,y};});
  const path=pts.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 64 38" aria-hidden="true"><path class="cockpitMiniLine" d="${path}"/>${pts.slice(-1).map(p=>`<circle class="cockpitMiniDot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="1.7"/>`).join('')}</svg>`;
}

function bodyWeightSeries(model){
  const bounds=model?.bounds||{};
  return (state.data?.body||[]).map(row=>({date:day(row?.measured_at),value:num(row?.weight_kg)})).filter(row=>row.date&&row.value!=null&&(!bounds.start||row.date>=bounds.start)&&(!bounds.end||row.date<=bounds.end)).sort((a,b)=>a.date.localeCompare(b.date));
}

function labCollectionSeries(model){
  const counts=new Map();
  for(const row of model?.labs?.rows||[]){const d=day(row?.collection_date);if(d)counts.set(d,(counts.get(d)||0)+1);}
  return [...counts.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,value])=>({date,value}));
}

function signedShort(value,unit='kg'){
  const n=num(value);if(n==null)return null;
  return `${n>0?'+':''}${fmtNum(n,1)} ${unit}`;
}

function insightHeadline(model){
  const parts=[];
  if(model?.body?.available){
    const muscle=signedShort(model.body.delta?.muscleKg),fat=signedShort(model.body.delta?.fatKg);
    if(muscle||fat)parts.push(`composição: ${muscle?`músculo ${muscle}`:''}${muscle&&fat?' e ':''}${fat?`gordura ${fat}`:''}`);
  }
  if(model?.training?.available)parts.push(`${model.training.totalSessions||0} sessão(ões) de treino`);
  if(model?.nutrition?.coveragePct!=null)parts.push(`${model.nutrition.coveragePct}% de cobertura nutricional`);
  if(!parts.length&&model?.labs?.collections)parts.push(`${model.labs.collections} coleta(s) de exames na janela`);
  if(!parts.length)return'Ainda não há cobertura suficiente para uma leitura integrada desta janela.';
  const sentence=`Na janela, ${parts.join(', com ')}.`;
  return sentence.charAt(0).toUpperCase()+sentence.slice(1);
}

function insightSupporting(model){
  const notes=[];
  if(!model?.water?.length)notes.push('Ainda não há registro estruturado de ingestão de água, o que limita a leitura de hidratação.');
  if(!model?.sleep?.days)notes.push('Sono sem cobertura estruturada nesta janela.');
  if(model?.labs?.last)notes.push(`Última coleta de exames em ${formatDate(model.labs.last)}.`);
  return notes.slice(0,2).join(' ')||'A leitura usa somente dados disponíveis e preserva a separação entre fontes quando necessário.';
}

function enhancePeriodControl(root=document){
  const select=root.querySelector?.('#analysisPeriod');
  if(!select)return false;
  const label=select.closest('.cockpitPeriod');
  if(!label)return false;
  label.classList.add('executivePeriodControl');
  select.classList.add('executivePeriodSelect');
  select.style.setProperty('display','block','important');
  select.style.setProperty('position','absolute','important');
  select.style.setProperty('width','1px','important');
  select.style.setProperty('height','1px','important');
  select.style.setProperty('padding','0','important');
  select.style.setProperty('border','0','important');
  select.style.setProperty('opacity','0','important');
  select.style.setProperty('pointer-events','none','important');

  let tabs=label.querySelector('.executivePeriodTabs');
  if(!tabs){
    tabs=document.createElement('div');tabs.className='executivePeriodTabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Período da visão geral');
    for(const[value,text]of periodOptions){
      const button=document.createElement('button');button.type='button';button.dataset.period=value;button.textContent=text;
      button.addEventListener('click',()=>{if(select.value===value)return;select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));queueEnhancement();});
      tabs.appendChild(button);
    }
    label.appendChild(tabs);
  }
  tabs.querySelectorAll('button').forEach(button=>{const active=button.dataset.period===select.value;button.classList.toggle('active',active);button.setAttribute('aria-pressed',active?'true':'false');});
  return true;
}

function enhanceHeader(root,model){
  const supporting=root.querySelector('.cockpitWelcome p');
  if(supporting)supporting.textContent='Um resumo longitudinal e executivo da sua saúde, com base nos dados da janela atual.';
  const label=root.querySelector('.executivePeriodControl');if(!label)return;
  let range=label.querySelector('.executiveDateRange');
  if(!range){range=document.createElement('div');range.className='executiveDateRange';range.innerHTML='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" stroke-width="1.7"/><path d="M7 3v4M17 3v4M3 9h18" stroke-width="1.7"/></svg><span><b></b><small></small></span>';label.appendChild(range);}
  const [start,end]=dateRangeText(model);range.querySelector('b').textContent=start;range.querySelector('small').textContent=end;
}

function enhanceCards(root,model){
  const cards=[...root.querySelectorAll('.cockpitStatus')];
  const configs=[
    {label:'Composição',icon:'body',points:bodyWeightSeries(model),bar:false},
    {label:'Treinos',icon:'training',points:model?.trainingSeries,bar:true},
    {label:'Nutrição',icon:'nutrition',points:model?.calorieSeries,bar:true},
    {label:'Recuperação',icon:'recovery',points:model?.sleep?.sources?.[0]?.periodPoints,bar:false},
    {label:'Exames',icon:'labs',points:labCollectionSeries(model),bar:true}
  ];
  cards.forEach((card,index)=>{
    const config=configs[index];if(!config)return;
    const label=card.querySelector('.cockpitStatusText small');if(label)label.textContent=config.label;
    const icon=card.querySelector('.cockpitIcon');if(icon)icon.innerHTML=iconSvgs[config.icon]||'';
    const visual=card.querySelector('.cockpitArrow');if(visual)visual.innerHTML=miniSvg(config.points,{bar:config.bar});
  });
}

function enhanceTrainingMetrics(root,model){
  const module=root.querySelector('.cockpitModule.training');if(!module)return;
  let metrics=module.querySelector('.cockpitTrainingMetrics');
  if(!metrics){metrics=document.createElement('div');metrics.className='cockpitTrainingMetrics';const old=module.querySelector('.cockpitGroupBars');if(old)old.before(metrics);else module.appendChild(metrics);}
  const activeWeeks=(model?.trainingSeries||[]).filter(point=>num(point?.value)>0).length;
  const groups=model?.training?.rows?.length||0;
  metrics.innerHTML=`<div><b>${model?.training?.totalSessions||0}</b><span>sessões</span></div><div><b>${groups}</b><span>grupos estruturados</span></div><div><b>${activeWeeks}</b><span>semanas com treino</span></div>`;
}

function enhanceModules(root,model){
  const bodyTitle=root.querySelector('.cockpitModule.body .cockpitModuleHead span');if(bodyTitle)bodyTitle.textContent='Composição corporal';
  const recoveryTitle=root.querySelector('.cockpitModule.recovery .cockpitModuleHead span');if(recoveryTitle)recoveryTitle.textContent='Sono e recuperação';
  const labTitle=root.querySelector('.cockpitModule.labs .cockpitModuleHead span');if(labTitle)labTitle.textContent='Exames';
  const reviewTitle=root.querySelector('.cockpitReview .cockpitModuleHead span');if(reviewTitle)reviewTitle.textContent='Pontos a revisar';
  root.querySelectorAll('.cockpitModuleHead .cockpitButton').forEach(button=>{button.textContent='Ver mais →';});
  const sourceButton=root.querySelector('.cockpitSources .cockpitButton');if(sourceButton)sourceButton.textContent='Gerenciar fontes →';
  const insight=root.querySelector('.cockpitInsightHero');
  if(insight){
    const button=insight.querySelector('.cockpitButton');if(button)button.textContent='Ver detalhes →';
    const text=insight.querySelector('div:nth-child(2)');
    const headline=text?.querySelector('b');if(headline)headline.textContent=insightHeadline(model);
    let small=text?.querySelector('.cockpitInsightSupporting');
    if(text&&!small){small=document.createElement('small');small.className='cockpitInsightSupporting';text.appendChild(small);}
    if(small)small.textContent=insightSupporting(model);
  }
  enhanceTrainingMetrics(root,model);
}

function enhanceDashboard(){
  ensurePixelParityStyles();ensureSidebarBrand();
  const host=document.getElementById('screenHost');
  if(!host||!enhancePeriodControl(host))return false;
  try{
    const select=host.querySelector('#analysisPeriod');
    const model=executiveCockpitModel(state.data||{},state.domainStatus||{},select?.value||'30');
    enhanceHeader(host,model);enhanceCards(host,model);enhanceModules(host,model);
  }catch(error){console.warn('Dashboard parity enhancement skipped:',error);}
  return true;
}

let enhancementTimer=null;
function queueEnhancement(attempt=0){
  clearTimeout(enhancementTimer);
  enhancementTimer=setTimeout(()=>{if(enhanceDashboard()||attempt>=16)return;queueEnhancement(attempt+1);},attempt?60:0);
}

function start(){
  ensurePixelParityStyles();ensureSidebarBrand();queueEnhancement();
  window.addEventListener('hashchange',()=>queueEnhancement());
  document.addEventListener('change',event=>{if(event.target?.matches?.('#analysisPeriod'))queueEnhancement();});
  document.addEventListener('click',event=>{if(event.target.closest('#refreshBtn')||event.target.closest('[data-route="hoje"]'))queueEnhancement();});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();

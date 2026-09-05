const periodOptions=[
  ['30','30 dias'],
  ['90','90 dias'],
  ['365','1 ano'],
  ['all','Histórico']
];

function enhancePeriodControl(root=document){
  const select=root.querySelector?.('#analysisPeriod');
  if(!select||select.dataset.executiveEnhanced==='1')return Boolean(select);
  const label=select.closest('.cockpitPeriod');
  if(!label)return false;
  select.dataset.executiveEnhanced='1';
  label.classList.add('executivePeriodControl');
  select.classList.add('executivePeriodSelect');

  /*
    Keep the native select present for form semantics and regression coverage,
    while the approved segmented tabs remain the visible control.
  */
  select.style.setProperty('display','block','important');
  select.style.setProperty('position','absolute','important');
  select.style.setProperty('width','1px','important');
  select.style.setProperty('height','1px','important');
  select.style.setProperty('padding','0','important');
  select.style.setProperty('border','0','important');
  select.style.setProperty('opacity','0','important');
  select.style.setProperty('pointer-events','none','important');

  const tabs=document.createElement('div');
  tabs.className='executivePeriodTabs';
  tabs.setAttribute('role','group');
  tabs.setAttribute('aria-label','Período da visão geral');

  const sync=()=>{
    tabs.querySelectorAll('button').forEach(button=>{
      const active=button.dataset.period===select.value;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',active?'true':'false');
    });
  };

  for(const[value,text]of periodOptions){
    const button=document.createElement('button');
    button.type='button';
    button.dataset.period=value;
    button.textContent=text;
    button.addEventListener('click',()=>{
      if(select.value===value)return;
      select.value=value;
      sync();
      select.dispatchEvent(new Event('change',{bubbles:true}));
      queueEnhancement();
    });
    tabs.appendChild(button);
  }

  label.appendChild(tabs);
  select.addEventListener('change',()=>{sync();queueEnhancement();});
  sync();
  return true;
}

function enhanceDashboard(){
  const host=document.getElementById('screenHost');
  const supporting=host?.querySelector('.cockpitWelcome p');
  if(supporting)supporting.style.setProperty('font-size','13px','important');
  return host?enhancePeriodControl(host):false;
}

let enhancementTimer=null;
function queueEnhancement(attempt=0){
  clearTimeout(enhancementTimer);
  enhancementTimer=setTimeout(()=>{
    if(enhanceDashboard()||attempt>=16)return;
    queueEnhancement(attempt+1);
  },attempt?60:0);
}

function start(){
  queueEnhancement();
  window.addEventListener('hashchange',()=>queueEnhancement());
  document.addEventListener('click',event=>{
    if(event.target.closest('#refreshBtn')||event.target.closest('[data-route="hoje"]'))queueEnhancement();
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
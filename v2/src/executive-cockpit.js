const periodOptions=[
  ['30','30 dias'],
  ['90','90 dias'],
  ['365','1 ano'],
  ['all','Histórico']
];

function enhancePeriodControl(root=document){
  const select=root.querySelector?.('#analysisPeriod');
  if(!select||select.dataset.executiveEnhanced==='1')return;
  const label=select.closest('.cockpitPeriod');
  if(!label)return;
  select.dataset.executiveEnhanced='1';
  label.classList.add('executivePeriodControl');
  select.classList.add('executivePeriodSelect');

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
    });
    tabs.appendChild(button);
  }

  label.appendChild(tabs);
  select.addEventListener('change',sync);
  sync();
}

function enhanceDashboard(){
  const host=document.getElementById('screenHost');
  if(!host)return;
  enhancePeriodControl(host);
}

const observer=new MutationObserver(()=>enhanceDashboard());
const start=()=>{
  const host=document.getElementById('screenHost');
  if(!host)return;
  observer.observe(host,{childList:true,subtree:true});
  enhanceDashboard();
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();

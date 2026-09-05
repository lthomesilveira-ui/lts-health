import {state} from './core.js';

// The approved Dashboard reference opens on the 30-day window.
// Apply that only to the initial in-memory default; later user choices are preserved.
if(state.ui?.analysisPeriod==='365')state.ui.analysisPeriod='30';

function polishInsight(){
  const headline=document.querySelector('.cockpitInsightHero b');
  if(!headline)return false;
  let text=headline.textContent||'';
  text=text.replace(/(\d+) sessão\(ões\) de treino/g,(_,n)=>`${n} ${Number(n)===1?'sessão':'sessões'} de treino`);
  text=text.replace(/, com /g,'; ');
  text=text.replace(/(\d+)% de cobertura nutricional/g,'cobertura nutricional de $1%');
  headline.textContent=text;
  return true;
}

let timer=null;
function queue(attempt=0){
  clearTimeout(timer);
  timer=setTimeout(()=>{
    polishInsight();
    if(attempt<16)queue(attempt+1);
  },attempt?70:20);
}

window.addEventListener('hashchange',()=>queue());
document.addEventListener('change',event=>{if(event.target?.matches?.('#analysisPeriod'))queue();});
document.addEventListener('click',event=>{if(event.target.closest?.('[data-period]')||event.target.closest?.('[data-route="hoje"]'))queue();});
queue();

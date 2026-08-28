(function(){
  'use strict';
  function polish(){
    const hero=document.querySelector('#productToday .productHeroMain');
    if(!hero)return;
    const kicker=hero.querySelector('.productKicker');
    const title=hero.querySelector('h1');
    const text=hero.querySelector('p');
    if(kicker)kicker.textContent='HOJE';
    if(title)title.textContent='Seu resumo mais recente';
    if(text)text.textContent='Composição corporal, treino e registros recentes em um só lugar. Quando um dado não existe, ele permanece em branco — nada é estimado.';
    const labels=hero.querySelectorAll('.productHeroStat span');
    const copy=['Peso','Massa muscular','Gordura corporal','Último treino'];
    labels.forEach((el,i)=>{if(copy[i])el.textContent=copy[i]});
    hero.dataset.todayHeroPolished='1';
    const brand=document.querySelector('.brandtext small');
    if(brand)brand.textContent='treino, composição, nutrição e exames';
  }
  const root=document.getElementById('productToday')||document.getElementById('today');
  if(root){
    const observer=new MutationObserver(()=>polish());
    observer.observe(root,{childList:true,subtree:true});
  }
  window.addEventListener('load',()=>setTimeout(polish,50));
  setTimeout(polish,1200);
})();

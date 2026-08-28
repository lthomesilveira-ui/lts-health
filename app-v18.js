(function(){
  const ensure=(id,parent,before=null)=>{let e=q(id);if(e)return e;e=document.createElement('div');e.id=id;if(before)parent.insertBefore(e,before);else parent.appendChild(e);return e};
  const day=v=>String(v||'').slice(0,10);
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
  const cut=days=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-days+1);return d.toISOString().slice(0,10)};
  const range=(startDays,endDays)=>{const hi=cut(startDays),lo=cut(endDays);return d=>{const x=day(d);return x>=lo&&x<hi}};
  const unique=a=>[...new Set(a.filter(Boolean))];
  function install(){
    document.body.classList.add('healthV18');
    const today=q('today');
    const changes=ensure('v18Changes',today,q('v17Rhythm')||q('v14Quick')||today?.querySelector('.hero'));changes.className='v18Panel';
    compactToday(today);
    installDrawer();
  }
  function compactToday(today){
    if(!today||q('v18Audit'))return;
    const details=document.createElement('details');details.id='v18Audit';details.className='v18Audit';details.innerHTML='<summary>Auditoria e base canônica</summary><div id="v18AuditBody" class="v18AuditBody"></div>';
    today.appendChild(details);const body=q('v18AuditBody');
    const candidates=[
      today.querySelector(':scope > .hero'),
      today.querySelector(':scope > .kpis'),
      q('statusTraining')?.parentElement,
      q('recentWorkouts')?.closest('.grid2'),
      q('qualityCount')?.closest('.grid2'),
      q('v12Coverage'),q('todayPulse'),q('v13Freshness')
    ].filter(Boolean);
    [...new Set(candidates)].forEach(el=>{if(el!==details&&el.parentElement===today)body.appendChild(el)});
  }
  function installDrawer(){
    const old=q('moreBtn');if(old&&!q('v18MoreBtn')){const b=old.cloneNode(true);b.id='v18MoreBtn';old.replaceWith(b);b.addEventListener('click',e=>{e.preventDefault();openDrawer()})}
    if(q('v18Drawer'))return;
    const el=document.createElement('div');el.id='v18Drawer';el.className='v18Drawer hidden';el.innerHTML=`<div class="v18DrawerSheet"><div class="v18DrawerHead"><b>Mais áreas</b><button id="v18DrawerClose">×</button></div><div class="v18DrawerGrid"><button data-v18-go="evolution">Evolução<small>Composição e segmentar</small></button><button data-v18-go="nutrition">Nutrição<small>Histórico MyFitnessPal</small></button><button data-v18-go="insights">Insights<small>Leituras e evidência</small></button><button data-v18-go="inbox">Dados / Inbox<small>Fontes e auditoria</small></button></div><button class="v18DrawerSearch" id="v18DrawerSearch">Buscar no histórico</button></div>`;document.body.appendChild(el);
    el.addEventListener('click',e=>{if(e.target===el)closeDrawer();const b=e.target.closest('[data-v18-go]');if(b){closeDrawer();activateTab(b.dataset.v18Go)}});
    q('v18DrawerClose').onclick=closeDrawer;q('v18DrawerSearch').onclick=()=>{closeDrawer();q('v17SearchBtn')?.click()};
  }
  function openDrawer(){q('v18Drawer')?.classList.remove('hidden')}
  function closeDrawer(){q('v18Drawer')?.classList.add('hidden')}
  function deltaText(current,previous){const a=n(current),b=n(previous);if(a==null||b==null)return{main:'—',small:'comparação indisponível',tone:''};const d=a-b;return{main:`${d>0?'+':''}${fmtNum(d,1)}`,small:'diferença entre janelas registradas',tone:d>0?'up':d<0?'down':''}}
  function renderChanges(){
    const w=state.canonicalWorkouts||[],nut=(state.mfp?.trendNutrition?.length?state.mfp.trendNutrition:state.nutrition)||[],body=[...(state.body||[])].sort((a,b)=>String(b.measured_at).localeCompare(String(a.measured_at))),labs=state.labs||[],quality=state.quality||[];
    const cur14=d=>day(d)>=cut(14),prev14=range(15,28);
    const wNow=w.filter(x=>cur14(x.workout_date)).length,wPrev=w.filter(x=>prev14(x.workout_date)).length;
    const nNow=unique(nut.filter(x=>cur14(x.nutrition_date)).map(x=>day(x.nutrition_date))).length,nPrev=unique(nut.filter(x=>prev14(x.nutrition_date)).map(x=>day(x.nutrition_date))).length;
    const wd=deltaText(wNow,wPrev),nd=deltaText(nNow,nPrev),latest=body[0],previous=body[1];
    const bd=latest&&previous&&n(latest.weight_kg)!=null&&n(previous.weight_kg)!=null?`${n(latest.weight_kg)-n(previous.weight_kg)>0?'+':''}${fmtNum(n(latest.weight_kg)-n(previous.weight_kg),1)} kg`:'—';
    const latestLab=unique(labs.map(x=>x.collection_date)).sort().reverse()[0];
    const open=quality.filter(x=>String(x.status).toLowerCase()==='open').length,quar=(state.quarantined||[]).length,review=(state.uploads||[]).filter(x=>['review_required','processing'].includes(String(x.status))).length;
    const metrics=state.metrics||[],sleep=metrics.filter(x=>x.metric_type==='sleep_duration_h').sort((a,b)=>String(b.measured_at).localeCompare(String(a.measured_at)))[0];
    q('v18Changes').innerHTML=`<div class="v18Head"><div><b>O que mudou recentemente</b><small>Comparações descritivas entre janelas equivalentes e medições consecutivas. Não são metas, diagnósticos ou avaliação estética.</small></div></div><div class="v18CompareGrid"><div class="v18Compare"><span>Treinos · 14 dias</span><strong>${wNow}<em class="${wd.tone}">${wd.main==='—'?'':wd.main}</em></strong><small>janela anterior: ${wPrev} sessões</small></div><div class="v18Compare"><span>Nutrição registrada · 14 dias</span><strong>${nNow}/14<em class="${nd.tone}">${nd.main==='—'?'':nd.main}</em></strong><small>janela anterior: ${nPrev}/14 dias</small></div><div class="v18Compare"><span>Última diferença de peso</span><strong>${bd}</strong><small>${latest&&previous?`${fmtDate(previous.measured_at)} → ${fmtDate(latest.measured_at)}`:'medições insuficientes'}</small></div><div class="v18Compare"><span>Última coleta laboratorial</span><strong>${latestLab?fmtDate(latestLab):'—'}</strong><small>${latestLab?labs.filter(x=>x.collection_date===latestLab).length+' resultados estruturados':'sem coleta estruturada'}</small></div></div><div class="v18Attention"><div class="v18AttentionCard ${open?'pending':'ok'}"><b>Qualidade dos dados</b><small>${open?`${open} questão(ões) aberta(s) aguardando evidência.`:'Nenhuma questão aberta no ledger atual.'}</small></div><div class="v18AttentionCard ${quar||review?'pending':'ok'}"><b>Revisão / quarentena</b><small>${quar} registro(s) em quarentena · ${review} upload(s) em revisão/processamento.</small></div><div class="v18AttentionCard ${sleep?'ok':'pending'}"><b>Recuperação contínua</b><small>${sleep?`Último sono registrado em ${fmtDate(sleep.measured_at)}.`:'Sono contínuo ainda depende de fonte compatível, como Apple Health.'}</small></div></div>`;
  }
  function renderV18(){renderChanges();const f=document.querySelector('.footer');if(f)f.textContent='LTS Health · v18 · cohesive dashboard + audit separation · dedicated GitHub / Supabase · provenance first'}
  install();
  const prior=loadAll;
  loadAll=async function(){await prior();renderV18()};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(renderV18,2300)});
})();

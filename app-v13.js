(function(){
  const V13={exercise:'',unit:'',biomarker:'',labUnit:''};
  const num=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
  const norm=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim();
  const day=v=>String(v||'').slice(0,10);
  const uniq=a=>[...new Set(a.filter(Boolean))];
  const ensure=(id,parent,before=null)=>{let e=q(id);if(e)return e;e=document.createElement('div');e.id=id;if(before)parent.insertBefore(e,before);else parent.appendChild(e);return e};
  const ageDays=v=>{if(!v)return null;const t=new Date(day(v)+'T12:00:00').getTime();return Number.isFinite(t)?Math.max(0,Math.floor((Date.now()-t)/86400000)):null};
  const freshClass=d=>d==null?'pending':d<=14?'ok':d<=60?'partial':'pending';
  const freshText=d=>d==null?'sem registro':d===0?'hoje':d===1?'há 1 dia':`há ${d} dias`;
  function install(){
    document.body.classList.add('healthV13');
    const today=q('today');
    const anchor=q('v12Coverage')||today?.querySelector('.hero');
    const fresh=ensure('v13Freshness',today,anchor);fresh.className='v13Panel';

    const training=q('training');
    const explorer=q('v12ExerciseExplorer')||training?.querySelector('.grid2');
    const trend=ensure('v13TrainingTrend',training,explorer);trend.className='v13Panel';
    trend.innerHTML=`<div class="v13Head"><div><b>Evolução registrada por exercício</b><small>Comparação descritiva apenas entre sessões com a mesma unidade de carga; nenhuma unidade é convertida.</small></div><div class="v13Controls"><select id="v13Exercise"></select><select id="v13Unit"></select></div></div><div id="v13TrainingTrendBody"></div>`;

    const health=q('health');
    const clinical=q('v12Clinical')||health?.querySelector('.grid2');
    const lab=ensure('v13LabTrend',health,clinical);lab.className='v13Panel';
    lab.innerHTML=`<div class="v13Head"><div><b>Histórico por biomarcador</b><small>Resultados são comparados somente quando nome e unidade são compatíveis. Um único ponto permanece um único ponto.</small></div><div class="v13Controls"><select id="v13Biomarker"></select><select id="v13LabUnit"></select></div></div><div id="v13LabTrendBody"></div>`;

    const inbox=q('inbox');
    const firstGrid=inbox?.querySelector('.grid2');
    const apple=ensure('v13AppleHealth',inbox,firstGrid);apple.className='v13Panel';
    apple.innerHTML=`<div class="v13Head"><div><b>Apple Health · caminho de ingestão</b><small>O fluxo preserva o ZIP/export.xml original antes de normalizar somente métricas suportadas com proveniência.</small></div></div><div class="v13Apple"><div class="v13AppleFlow"><div class="v13Step"><b>1 · Exportar</b><small>No app Saúde, gerar a exportação dos dados.</small></div><div class="v13Step"><b>2 · Enviar</b><small>Selecionar Apple Health no Data Inbox e enviar ZIP ou XML.</small></div><div class="v13Step"><b>3 · Inspecionar</b><small>O original fica no bucket privado e o formato é identificado.</small></div><div class="v13Step"><b>4 · Normalizar</b><small>Somente métricas suportadas entram no histórico estruturado.</small></div></div><div class="v13Support"><div class="v13SupportRow"><b>Energia ativa diária</b><span class="ready">suportado</span></div><div class="v13SupportRow"><b>Minutos de exercício</b><span class="ready">suportado</span></div><div class="v13SupportRow"><b>Horas em pé</b><span class="ready">suportado</span></div><div class="v13SupportRow"><b>Duração do sono</b><span class="ready">suportado</span></div><div class="v13SupportRow"><b>Passos com múltiplas fontes</b><span class="held">retido</span></div></div></div><div class="v13Foot">Passos permanecem retidos quando o export contém fontes/dispositivos sobrepostos; o LTS Health não soma valores potencialmente duplicados só para preencher um indicador.</div>`;

    q('v13Exercise')?.addEventListener('change',e=>{V13.exercise=e.target.value;V13.unit='';renderTrainingTrend()});
    q('v13Unit')?.addEventListener('change',e=>{V13.unit=e.target.value;renderTrainingTrend()});
    q('v13Biomarker')?.addEventListener('change',e=>{V13.biomarker=e.target.value;V13.labUnit='';renderLabTrend()});
    q('v13LabUnit')?.addEventListener('change',e=>{V13.labUnit=e.target.value;renderLabTrend()});

    injectPwaShell();
  }
  function injectPwaShell(){
    if(!document.querySelector('link[rel="manifest"]')){const l=document.createElement('link');l.rel='manifest';l.href='./manifest.webmanifest';document.head.appendChild(l)}
    const metas=[['apple-mobile-web-app-capable','yes'],['apple-mobile-web-app-status-bar-style','default'],['apple-mobile-web-app-title','LTS Health']];
    for(const [name,content] of metas){if(!document.querySelector(`meta[name="${name}"]`)){const m=document.createElement('meta');m.name=name;m.content=content;document.head.appendChild(m)}}
    if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('LTS Health service worker',e));
  }
  function renderFreshness(){
    const w=(state.canonicalWorkouts||[])[0],b=(state.body||[])[0],n=(state.mfp?.recentNutrition||state.nutrition||[])[0],labs=state.labs||[];
    const lastLab=[...labs].sort((a,b)=>String(b.collection_date).localeCompare(String(a.collection_date)))[0];
    const cards=[['Treino',w?.workout_date,w?`${esc(w.workout_type||'sessão')} · ${esc(w.location||'local não informado')}`:'nenhuma sessão registrada'],['Composição',b?.measured_at,b?`${b.weight_kg!=null?fmtNum(b.weight_kg,1)+' kg':''}${b.skeletal_muscle_mass_kg!=null?' · massa muscular '+fmtNum(b.skeletal_muscle_mass_kg,1)+' kg':''}`:'sem medição'],['Nutrição',n?.nutrition_date,n?.calories_kcal!=null?`${fmtNum(n.calories_kcal,0)} kcal registradas`:'sem dia nutricional'],['Laboratório',lastLab?.collection_date,lastLab?`${new Set(labs.filter(x=>x.collection_date===lastLab.collection_date).map(x=>x.biomarker)).size} biomarcadores na coleta`:'sem coleta estruturada']];
    q('v13Freshness').innerHTML=`<div class="v13Head"><div><b>Atualidade das fontes</b><small>Quando cada domínio foi observado pela última vez. Ausência de dado não é preenchida por estimativa.</small></div></div><div class="v13FreshGrid">${cards.map(([label,date,small])=>{const d=ageDays(date);return `<div class="v13Fresh ${freshClass(d)}"><span>${esc(label)}</span><strong>${date?fmtDate(date):'—'}</strong><small>${esc(freshText(d))} · ${small}</small></div>`}).join('')}</div>`;
  }
  function exerciseGroups(){
    const map=new Map();for(const e of state.exercises||[]){const k=norm(e.exercise);if(!k)continue;const g=map.get(k)||{key:k,label:e.exercise,rows:[]};g.rows.push(e);map.set(k,g)}return [...map.values()].sort((a,b)=>String(a.label).localeCompare(String(b.label),'pt-BR'));
  }
  function barChart(points,label){
    if(!points.length)return '<div class="v13Empty">Sem pontos estruturados nesta combinação.</div>';
    const max=Math.max(...points.map(x=>x.value),1),sample=points.length>40?points.filter((_,i)=>i%Math.ceil(points.length/40)===0):points;
    return `<div class="v13ChartWrap"><div class="v13ChartTitle">${esc(label)}</div><div class="v13Bars">${sample.map(p=>`<i style="height:${Math.max(4,p.value/max*100)}%"><span>${esc(p.date)} · ${fmtNum(p.value,1)}</span></i>`).join('')}</div><div class="v13Axis"><span>${fmtDate(sample[0].date)}</span><span>${sample.length} sessão(ões) exibida(s)</span><span>${fmtDate(sample.at(-1).date)}</span></div></div>`;
  }
  function renderTrainingTrend(){
    const groups=exerciseGroups(),sel=q('v13Exercise');if(!sel)return;
    if(!V13.exercise||!groups.some(g=>g.key===V13.exercise))V13.exercise=groups[0]?.key||'';
    sel.innerHTML=groups.length?groups.map(g=>`<option value="${esc(g.key)}" ${g.key===V13.exercise?'selected':''}>${esc(g.label)}</option>`).join(''):'<option>Sem exercícios</option>';
    const g=groups.find(x=>x.key===V13.exercise);if(!g){q('v13TrainingTrendBody').innerHTML='<div class="v13Empty">Sem exercícios estruturados.</div>';return}
    const ids=new Set(g.rows.map(x=>x.source_record_id));const sets=(state.sets||[]).filter(s=>ids.has(s.exercise_source_record_id)&&num(s.weight)!=null);
    const units=uniq(sets.map(s=>String(s.weight_unit||'unidade não informada'))).sort();if(!V13.unit||!units.includes(V13.unit))V13.unit=units[0]||'';
    const unitSel=q('v13Unit');unitSel.innerHTML=units.length?units.map(u=>`<option value="${esc(u)}" ${u===V13.unit?'selected':''}>${esc(u)}</option>`).join(''):'<option>Sem carga</option>';
    const byDate=new Map();for(const s of sets.filter(x=>String(x.weight_unit||'unidade não informada')===V13.unit)){const d=day(s.workout_date);if(!d)continue;const cur=byDate.get(d)||{date:d,max:0,sets:0,reps:0};cur.max=Math.max(cur.max,num(s.weight)||0);cur.sets++;cur.reps+=num(s.reps_numeric)||0;byDate.set(d,cur)}
    const points=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));const latest=points.at(-1),first=points[0];
    q('v13TrainingTrendBody').innerHTML=`<div class="v13TrendGrid"><div class="v13Summary"><div class="v13Mini"><span>Sessões com carga</span><strong>${points.length}</strong><small>na unidade selecionada</small></div><div class="v13Mini"><span>Séries estruturadas</span><strong>${sets.filter(x=>String(x.weight_unit||'unidade não informada')===V13.unit).length}</strong><small>${esc(V13.unit||'—')}</small></div><div class="v13Mini"><span>Primeiro registro</span><strong>${first?fmtDate(first.date):'—'}</strong><small>${first?fmtNum(first.max,1)+' '+esc(V13.unit):'sem ponto'}</small></div><div class="v13Mini"><span>Último registro</span><strong>${latest?fmtDate(latest.date):'—'}</strong><small>${latest?fmtNum(latest.max,1)+' '+esc(V13.unit):'sem ponto'}</small></div></div>${barChart(points.map(x=>({date:x.date,value:x.max})),`Maior carga registrada por sessão · ${V13.unit||'sem unidade'}`)}</div><div class="v13Foot">O gráfico descreve a maior carga registrada por sessão na mesma unidade. Ele não define meta, recomendação de progressão ou intensidade de treino.</div>`;
  }
  function biomarkerGroups(){
    const map=new Map();for(const x of state.labs||[]){const k=norm(x.biomarker);if(!k)continue;const g=map.get(k)||{key:k,label:x.biomarker,rows:[]};g.rows.push(x);map.set(k,g)}return [...map.values()].sort((a,b)=>String(a.label).localeCompare(String(b.label),'pt-BR'));
  }
  function renderLabTrend(){
    const groups=biomarkerGroups(),sel=q('v13Biomarker');if(!sel)return;
    if(!V13.biomarker||!groups.some(g=>g.key===V13.biomarker))V13.biomarker=groups[0]?.key||'';
    sel.innerHTML=groups.length?groups.map(g=>`<option value="${esc(g.key)}" ${g.key===V13.biomarker?'selected':''}>${esc(g.label)}</option>`).join(''):'<option>Sem biomarcadores</option>';
    const g=groups.find(x=>x.key===V13.biomarker);if(!g){q('v13LabTrendBody').innerHTML='<div class="v13Empty">Sem resultados laboratoriais estruturados.</div>';return}
    const units=uniq(g.rows.map(x=>x.unit||'sem unidade')).sort();if(!V13.labUnit||!units.includes(V13.labUnit))V13.labUnit=units[0]||'';
    const unitSel=q('v13LabUnit');unitSel.innerHTML=units.map(u=>`<option value="${esc(u)}" ${u===V13.labUnit?'selected':''}>${esc(u)}</option>`).join('');
    const rows=g.rows.filter(x=>(x.unit||'sem unidade')===V13.labUnit).sort((a,b)=>String(a.collection_date).localeCompare(String(b.collection_date)));
    const numeric=rows.filter(x=>num(x.result_numeric)!=null).map(x=>({date:x.collection_date,value:num(x.result_numeric)}));
    const chart=numeric.length>=2?barChart(numeric,`${g.label} · ${V13.labUnit}`):`<div class="v13ChartWrap"><div class="v13ChartTitle">${esc(g.label)} · ${esc(V13.labUnit)}</div><div class="v13Empty">${numeric.length===1?'Há apenas um ponto numérico estruturado; tendência longitudinal não é calculada.':'Não há série numérica compatível para gráfico.'}</div></div>`;
    q('v13LabTrendBody').innerHTML=`<div class="v13TrendGrid"><div><div class="v13Summary"><div class="v13Mini"><span>Resultados</span><strong>${rows.length}</strong><small>${esc(V13.labUnit||'sem unidade')}</small></div><div class="v13Mini"><span>Coletas distintas</span><strong>${uniq(rows.map(x=>x.collection_date)).length}</strong><small>para este biomarcador</small></div></div><div class="v13Rows">${rows.slice(-8).reverse().map(x=>`<div class="v13Row"><b>${fmtDate(x.collection_date)}</b><small>${esc(x.laboratory||'laboratório não informado')}${x.reference_range?` · ref. ${esc(x.reference_range)}`:''}</small><div class="v13Value">${esc(x.result_raw||'—')}</div></div>`).join('')}</div></div>${chart}</div><div class="v13Foot">Mudanças entre resultados só ganham interpretação quando existe série comparável e contexto clínico suficiente; o app preserva referência, unidade e fonte.</div>`;
  }
  function renderV13(){renderFreshness();renderTrainingTrend();renderLabTrend();const f=document.querySelector('.footer');if(f)f.textContent='LTS Health · v13 · product shell + longitudinal exploration · dedicated GitHub / Supabase · provenance first'}
  install();
  const prior=loadAll;
  loadAll=async function(){await prior();renderV13()};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(renderV13,1100)});
})();

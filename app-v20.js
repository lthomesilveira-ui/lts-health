(function(){
  const V20={busy:false,spans:{}};
  const ensure=(id,parent,before=null)=>{let e=q(id);if(e)return e;e=document.createElement('div');e.id=id;if(before)parent.insertBefore(e,before);else parent.appendChild(e);return e};
  const day=v=>String(v||'').slice(0,10);
  function install(){
    document.body.classList.add('healthV20');
    const inbox=q('inbox');const before=q('v17AppleGuide')||inbox?.querySelector('.uploadBox')||inbox?.firstChild;const panel=ensure('v20Data',inbox,before);panel.className='v20Panel';
  }
  async function exactSpan(table,dateCol){
    const [count,first,last]=await Promise.all([
      sb.from(table).select('*',{count:'exact',head:true}),
      sb.from(table).select(dateCol).order(dateCol,{ascending:true}).limit(1),
      sb.from(table).select(dateCol).order(dateCol,{ascending:false}).limit(1)
    ]);
    if(count.error||first.error||last.error)return{count:null,first:null,last:null,error:true};
    return{count:count.count||0,first:first.data?.[0]?.[dateCol]||null,last:last.data?.[0]?.[dateCol]||null,error:false};
  }
  async function loadSpans(){
    if(!currentSession?.user)return;
    const defs=[['nutrition','health_daily_nutrition','nutrition_date'],['meals','health_nutrition_meals','meal_date'],['activity','health_activity_records','activity_date'],['metrics','health_metrics','measured_at']];
    const vals=await Promise.all(defs.map(async d=>[d[0],await exactSpan(d[1],d[2])]));V20.spans=Object.fromEntries(vals);renderData();
  }
  function card(label,count,first,last,tone='ready'){return `<div class="v20Source ${tone}"><span>${esc(label)}</span><strong>${count==null?'—':Number(count).toLocaleString('pt-BR')}</strong><small>${first||last?`${fmtDate(first)} → ${fmtDate(last)}`:'intervalo indisponível'}</small></div>`}
  function renderData(){
    const w=state.canonicalWorkouts||[],b=state.body||[],labs=state.labs||[],docs=state.docs||[],u=state.uploads||[];
    const ws=[...w].map(x=>x.workout_date).filter(Boolean).sort(),bs=[...b].map(x=>x.measured_at).filter(Boolean).sort(),ls=[...labs].map(x=>x.collection_date).filter(Boolean).sort();
    q('v20Data').innerHTML=`<div class="v20Head"><div><b>Mapa do patrimônio de dados</b><small>Contagem e cobertura temporal do que está estruturado no LTS Health. O backup abaixo é gerado localmente no navegador e não publica dados no GitHub.</small></div><div class="v20Actions"><button id="v20Refresh">Atualizar mapa</button><button class="primary" id="v20Export">Exportar backup estruturado</button></div></div><div class="v20SourceTable">${card('Treinos canônicos',w.length,ws[0],ws.at(-1))}${card('Composição corporal',b.length,bs[0],bs.at(-1))}${card('Resultados laboratoriais',labs.length,ls[0],ls.at(-1),new Set(labs.map(x=>x.collection_date)).size>1?'ready':'partial')}${card('Documentos',docs.length,null,null,docs.length?'ready':'partial')}${card('Nutrição diária',V20.spans.nutrition?.count,V20.spans.nutrition?.first,V20.spans.nutrition?.last,V20.spans.nutrition?.error?'partial':'ready')}${card('Refeições MFP',V20.spans.meals?.count,V20.spans.meals?.first,V20.spans.meals?.last,V20.spans.meals?.error?'partial':'ready')}${card('Atividades MFP',V20.spans.activity?.count,V20.spans.activity?.first,V20.spans.activity?.last,V20.spans.activity?.error?'partial':'ready')}${card('Métricas',V20.spans.metrics?.count,V20.spans.metrics?.first,V20.spans.metrics?.last,V20.spans.metrics?.error?'partial':'ready')}${card('Uploads preservados',u.length,null,null,u.length?'ready':'partial')}</div><div class="v20Note"><b>Backup estruturado:</b> inclui dados normalizados e metadados de proveniência acessíveis ao usuário, mas não inclui os bytes originais dos arquivos privados do Inbox nem campos operacionais de dose/frequência de tratamentos. Os originais continuam preservados no storage privado.</div><div class="v20Progress"><i id="v20ProgressBar"></i></div><div id="v20Msg" class="v20Msg"></div>`;
    q('v20Refresh').onclick=loadSpans;q('v20Export').onclick=exportStructured;
  }
  async function fetchAll(table,select='*',orderCol=null,max=12000){const out=[];let from=0,size=800;while(from<max){let x=sb.from(table).select(select);if(orderCol)x=x.order(orderCol,{ascending:true});const r=await x.range(from,Math.min(from+size-1,max-1));if(r.error)throw new Error(`${table}: ${r.error.message}`);out.push(...(r.data||[]));if(!r.data||r.data.length<size)break;from+=size}return out}
  async function exportStructured(){
    if(V20.busy||!currentSession?.user)return;V20.busy=true;const btn=q('v20Export');if(btn)btn.disabled=true;setMsg('Preparando backup estruturado…','');setProgress(5);
    try{
      const jobs=[
        ['workouts',()=>fetchAll('health_workouts','*','workout_date')],['workout_exercises',()=>fetchAll('health_workout_exercises','*','workout_date')],['workout_sets',()=>fetchAll('health_workout_sets','*','workout_date')],['body_composition',()=>fetchAll('health_body_composition','*','measured_at')],['segmental_composition',()=>fetchAll('health_segmental_composition','*','measured_at')],['lab_results',()=>fetchAll('health_lab_results','*','collection_date')],['documents',()=>fetchAll('health_documents','*','document_date')],['daily_nutrition',()=>fetchAll('health_daily_nutrition','*','nutrition_date')],['nutrition_meals',()=>fetchAll('health_nutrition_meals','*','meal_date')],['activity_records',()=>fetchAll('health_activity_records','*','activity_date')],['metrics',()=>fetchAll('health_metrics','*','measured_at')],['data_quality',()=>fetchAll('health_data_quality_issues','*','detected_at')],['data_requests',()=>fetchAll('health_data_requests','*','created_at')],['insights',()=>fetchAll('health_insights','*','generated_at')],['uploads',()=>fetchAll('health_uploads','id,user_id,source_type,original_filename,mime_type,size_bytes,status,created_at,processed_at,notes','created_at')],['treatment_events_safe',()=>fetchAll('health_medication_events','event_date,medication,event_type,source,confidence','event_date')],['treatment_inventory_safe',()=>fetchAll('health_medication_regimens','medication,source,confidence')]
      ];
      const data={};for(let i=0;i<jobs.length;i++){const [name,fn]=jobs[i];setMsg(`Exportando ${name.replaceAll('_',' ')}…`,'');data[name]=await fn();setProgress(8+Math.round((i+1)/jobs.length*84))}
      const payload={schema:'lts-health-structured-backup-v20',generated_at:new Date().toISOString(),project:'LTS Health',notes:['Backup gerado localmente após autenticação do usuário.','Arquivos binários privados do Inbox não estão embutidos.','Campos operacionais de dose/frequência de tratamentos não são incluídos nesta exportação de interface.'],coverage:V20.spans,data};
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`lts-health-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setProgress(100);setMsg('Backup estruturado gerado no dispositivo.','ok');
    }catch(e){console.error('v20 export',e);setProgress(0);setMsg(`Não foi possível concluir o backup: ${e.message||e}`,'bad')}finally{V20.busy=false;if(btn)btn.disabled=false}
  }
  function setMsg(text,kind){const e=q('v20Msg');if(!e)return;e.className='v20Msg'+(kind?' '+kind:'');e.textContent=text}
  function setProgress(p){const e=q('v20ProgressBar');if(e)e.style.width=Math.max(0,Math.min(100,p))+'%'}
  function renderV20(){renderData();const f=document.querySelector('.footer');if(f)f.textContent='LTS Health · v20 · structured backup + data estate map · dedicated GitHub / Supabase · provenance first'}
  install();
  const prior=loadAll;
  loadAll=async function(){await prior();renderV20();await loadSpans()};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(async()=>{renderV20();await loadSpans()},2800)});
})();

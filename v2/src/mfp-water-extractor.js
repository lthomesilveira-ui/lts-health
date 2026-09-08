export const MFP_WATER_CHECKPOINT_KEY='lts-health-mfp-water-export-v1';

export function mfpWaterBookmarkletMain(){
  'use strict';
  const KEY='lts-health-mfp-water-export-v1',SCHEMA='lts-health-mfp-water-export',VERSION=1,METHOD='mfp_food_water_v1',MAX=10000,BATCH=4,PACE=650;
  const host=String(location.hostname||'').toLowerCase();
  if(host!=='myfitnesspal.com'&&!host.endsWith('.myfitnesspal.com')){alert('Abra myfitnesspal.com, entre na sua conta e execute este favorito novamente.');return;}
  if(window.__ltsMfpWaterRunning){document.getElementById('lts-mfp-water-extractor')?.scrollIntoView();return;}
  window.__ltsMfpWaterRunning=true;
  let stopped=false;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const validDate=value=>{const text=String(value||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return false;const[y,m,d]=text.split('-').map(Number),check=new Date(Date.UTC(y,m-1,d));return check.getUTCFullYear()===y&&check.getUTCMonth()===m-1&&check.getUTCDate()===d;};
  const dayNumber=value=>{const[y,m,d]=value.split('-').map(Number);return Math.floor(Date.UTC(y,m-1,d)/86400000);};
  const localToday=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;};
  const datesBetween=(from,to)=>{if(!validDate(from)||!validDate(to)||to<from)throw new Error('Período inválido. Use AAAA-MM-DD.');const first=dayNumber(from),last=dayNumber(to),total=last-first+1;if(total>MAX)throw new Error('O período ultrapassa 10.000 dias.');return Array.from({length:total},(_,i)=>new Date((first+i)*86400000).toISOString().slice(0,10));};
  const readCheckpoint=()=>{try{const value=JSON.parse(localStorage.getItem(KEY)||'null');if(value?.schema===SCHEMA&&value?.version===VERSION&&['running','complete'].includes(value?.status)&&validDate(value?.period?.from)&&validDate(value?.period?.to)&&Array.isArray(value.rows)&&Number.isInteger(value.next_index))return value;}catch{}return null;};
  const saveCheckpoint=value=>localStorage.setItem(KEY,JSON.stringify(value));

  document.getElementById('lts-mfp-water-extractor')?.remove();
  const panel=document.createElement('section');
  panel.id='lts-mfp-water-extractor';
  panel.setAttribute('aria-live','polite');
  panel.style.cssText='position:fixed;z-index:2147483647;left:12px;right:12px;bottom:12px;max-width:620px;margin:auto;padding:18px;border:1px solid #315167;border-radius:18px;background:#08131d;color:#eef8fb;box-shadow:0 20px 70px rgba(0,0,0,.55);font:15px/1.45 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;text-align:left';
  panel.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:start"><div><b style="display:block;font-size:18px">Água do MFP → LTS Health</b><span id="lts-mfp-status" style="display:block;color:#b7c8d2;margin-top:4px">Preparando…</span></div><button id="lts-mfp-close" style="font:inherit;color:#fff;background:transparent;border:0;padding:2px 8px;font-size:24px" aria-label="Fechar">×</button></div><div style="height:8px;background:#152633;border-radius:999px;margin:16px 0 8px;overflow:hidden"><i id="lts-mfp-progress" style="display:block;width:0;height:100%;background:#24c7d9"></i></div><small id="lts-mfp-detail" style="display:block;color:#8fa7b5">Nenhum dado é enviado ao LTS durante a leitura.</small><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px"><button id="lts-mfp-pause" style="font:inherit;font-weight:700;color:#eef8fb;background:#132431;border:1px solid #315167;border-radius:10px;padding:10px 13px">Pausar</button><button id="lts-mfp-save" hidden style="font:inherit;font-weight:800;color:#061018;background:#24c7d9;border:0;border-radius:10px;padding:10px 13px">Salvar arquivo</button><button id="lts-mfp-restart" style="font:inherit;font-weight:700;color:#b7c8d2;background:transparent;border:1px solid #315167;border-radius:10px;padding:10px 13px">Recomeçar</button></div>';
  document.body.appendChild(panel);
  const status=panel.querySelector('#lts-mfp-status'),detail=panel.querySelector('#lts-mfp-detail'),bar=panel.querySelector('#lts-mfp-progress'),pause=panel.querySelector('#lts-mfp-pause'),save=panel.querySelector('#lts-mfp-save');
  const setView=(state,message)=>{const total=Math.max(1,state?.total_days||1),done=Math.min(total,state?.next_index||0);bar.style.width=`${Math.round(done/total*100)}%`;status.textContent=message;detail.textContent=state?`${done.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} dias verificados · ${state.rows.length.toLocaleString('pt-BR')} dias com água`:'Nenhum dado é enviado ao LTS durante a leitura.';};
  const exportFile=async state=>{const output={schema:SCHEMA,version:VERSION,source:'MyFitnessPal authenticated web',method:METHOD,status:'complete',started_at:state.started_at,completed_at:state.completed_at,period:state.period,days_scanned:state.total_days,positive_days:state.rows.length,days_without_positive_total:state.total_days-state.rows.length,rows:state.rows.slice().sort((a,b)=>a.date.localeCompare(b.date))};const name=`lts-health-mfp-water-${state.period.from}_${state.period.to}.json`,blob=new Blob([JSON.stringify(output,null,2)],{type:'application/json'}),file=typeof File==='function'?new File([blob],name,{type:'application/json'}):null;try{if(file&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'Água do MyFitnessPal'});return;}}catch(error){if(error?.name==='AbortError')return;}const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);};
  pause.onclick=()=>{stopped=true;pause.disabled=true;status.textContent='Pausado. Execute o favorito novamente para continuar.';window.__ltsMfpWaterRunning=false;};
  panel.querySelector('#lts-mfp-close').onclick=()=>{stopped=true;panel.remove();window.__ltsMfpWaterRunning=false;};
  panel.querySelector('#lts-mfp-restart').onclick=()=>{if(confirm('Apagar somente o progresso desta extração e escolher outro período?')){stopped=true;localStorage.removeItem(KEY);panel.remove();window.__ltsMfpWaterRunning=false;alert('Progresso apagado. Execute o favorito novamente para iniciar.');}};

  const fetchDay=async date=>{
    let lastError;
    for(let attempt=0;attempt<5;attempt++){
      try{
        const response=await fetch(`/food/water?date=${encodeURIComponent(date)}`,{credentials:'include',cache:'no-store',headers:{Accept:'application/json'}});
        if(response.status===401||response.status===403)throw new Error('Sua sessão do MyFitnessPal expirou. Entre novamente e repita o favorito.');
        if(response.status===429||response.status>=500){lastError=new Error(`MyFitnessPal respondeu ${response.status}`);await wait(1500*Math.pow(2,attempt));continue;}
        if(!response.ok)throw new Error(`MyFitnessPal respondeu ${response.status}.`);
        const type=response.headers.get('content-type')||'';
        if(!type.includes('json'))throw new Error('A página não devolveu JSON. Confirme que você continua conectado ao MyFitnessPal.');
        const payload=await response.json(),item=payload?.item,value=Number(item?.milliliters);
        if(item?.date!==date||!Number.isFinite(value)||value<0||value>100000)throw new Error(`Resposta inválida para ${date}.`);
        return Math.round(value);
      }catch(error){lastError=error;if(/sessão|conectado|Resposta inválida/.test(String(error?.message||'')))throw error;if(attempt<4)await wait(900*Math.pow(2,attempt));}
    }
    throw lastError||new Error(`Não foi possível ler ${date}.`);
  };

  (async()=>{
    let state=readCheckpoint();
    if(!state){
      const from=prompt('Data inicial da extração (AAAA-MM-DD):','2018-01-01');
      if(from===null){panel.remove();window.__ltsMfpWaterRunning=false;return;}
      const to=prompt('Data final da extração (AAAA-MM-DD):',localToday());
      if(to===null){panel.remove();window.__ltsMfpWaterRunning=false;return;}
      let allDates;
      try{allDates=datesBetween(from.trim(),to.trim());}catch(error){alert(error.message);panel.remove();window.__ltsMfpWaterRunning=false;return;}
      state={schema:SCHEMA,version:VERSION,method:METHOD,status:'running',started_at:new Date().toISOString(),completed_at:null,period:{from:from.trim(),to:to.trim()},total_days:allDates.length,next_index:0,rows:[]};
      saveCheckpoint(state);
    }
    let dates;
    try{dates=datesBetween(state.period.from,state.period.to);}catch(error){localStorage.removeItem(KEY);throw error;}
    if(state.status==='complete'){
      setView(state,'Extração já concluída. Toque em “Salvar arquivo”.');pause.hidden=true;save.hidden=false;save.onclick=()=>exportFile(state);window.__ltsMfpWaterRunning=false;return;
    }
    setView(state,state.next_index?'Retomando a extração…':'Iniciando a extração…');
    try{
      while(state.next_index<dates.length&&!stopped){
        const batch=dates.slice(state.next_index,state.next_index+BATCH);
        const values=await Promise.all(batch.map(fetchDay));
        for(let index=0;index<batch.length;index++)if(values[index]>0)state.rows.push({date:batch[index],water_ml:values[index]});
        state.next_index+=batch.length;state.last_error=null;saveCheckpoint(state);
        setView(state,`Lendo ${dates[Math.min(state.next_index,dates.length)-1]}…`);
        if(state.next_index<dates.length)await wait(PACE);
      }
      if(stopped)return;
      state.status='complete';state.completed_at=new Date().toISOString();saveCheckpoint(state);
      setView(state,'Extração concluída. Toque em “Salvar arquivo”.');pause.hidden=true;save.hidden=false;save.onclick=()=>exportFile(state);window.__ltsMfpWaterRunning=false;
    }catch(error){state.last_error=String(error?.message||error);saveCheckpoint(state);setView(state,`Pausado: ${state.last_error}`);pause.disabled=true;pause.textContent='Execute o favorito para continuar';window.__ltsMfpWaterRunning=false;}
  })();
}

export function buildMyFitnessPalWaterBookmarklet(){
  return `javascript:(${mfpWaterBookmarkletMain.toString()})()`;
}

export function setupMfpWaterExtractorInstaller(root=document){
  const code=buildMyFitnessPalWaterBookmarklet(),field=root.getElementById('bookmarkletCode'),copy=root.getElementById('copyBookmarklet'),link=root.getElementById('bookmarkletLink'),message=root.getElementById('copyStatus'),copyPageLink=root.getElementById('copyPageLink'),pageMessage=root.getElementById('pageLinkStatus');
  if(field)field.value=code;
  if(link)link.href=code;
  copy?.addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(code);message.textContent='Código copiado. No notebook, cole-o no endereço do favorito.';}
    catch{field?.focus();field?.select();message.textContent='Selecione e copie o código exibido abaixo.';}
  });
  copyPageLink?.addEventListener('click',async()=>{
    const pageUrl=String(location.href||'').split('#')[0];
    try{await navigator.clipboard.writeText(pageUrl);pageMessage.textContent='Link copiado. Abra-o no notebook quando puder.';}
    catch{pageMessage.textContent='Use a opção Compartilhar do navegador para enviar esta página ao notebook.';}
  });
}

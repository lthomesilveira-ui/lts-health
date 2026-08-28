(function(){
  'use strict';
  const S={timer:null,lastStart:0,lastSuccess:0,retryBusy:false};
  const q=id=>document.getElementById(id);
  function ensureHost(){
    let host=q('runtimeRecovery');
    if(host)return host;
    host=document.createElement('div');host.id='runtimeRecovery';host.className='runtimeRecovery hidden';host.setAttribute('role','status');host.setAttribute('aria-live','polite');
    const wrap=document.querySelector('.wrap');if(wrap)wrap.insertBefore(host,wrap.firstChild);return host;
  }
  function hide(){const h=ensureHost();h.classList.add('hidden');h.innerHTML=''}
  function show(message,canRetry=true){
    const h=ensureHost();h.classList.remove('hidden');h.innerHTML=`<div><b>Não foi possível concluir o carregamento.</b><span>${esc(message||'Sua sessão continua aberta e nenhum dado foi alterado.')}</span></div>${canRetry?'<button type="button" id="runtimeRetry">Tentar novamente</button>':''}`;
    const b=q('runtimeRetry');if(b)b.onclick=async()=>{if(S.retryBusy)return;S.retryBusy=true;b.disabled=true;b.textContent='Tentando…';try{await loadAll()}finally{S.retryBusy=false}};
  }
  function monitor(){
    clearTimeout(S.timer);S.lastStart=Date.now();
    S.timer=setTimeout(()=>{
      const sync=q('syncState');
      const stillLoading=sync&&/sincronizando|carregando/i.test(sync.textContent||'');
      if(stillLoading){sync.textContent='carregamento lento';show('A conexão está demorando mais que o normal. Você pode tentar novamente sem perder o que já está salvo.');}
    },12000);
  }
  function markSuccess(){clearTimeout(S.timer);S.lastSuccess=Date.now();hide()}
  function markFailure(err){clearTimeout(S.timer);const sync=q('syncState');if(sync)sync.textContent='falha ao atualizar';show(err?.message||'O app não recebeu todos os dados necessários.');}
  const prior=loadAll;
  loadAll=async function(){monitor();try{const out=await prior();markSuccess();return out}catch(err){markFailure(err);throw err}};
  window.addEventListener('unhandledrejection',e=>{if(!currentSession)return;markFailure(e.reason||new Error('Falha inesperada durante o carregamento.'))});
  window.addEventListener('error',e=>{if(!currentSession)return;const src=String(e.filename||'');if(src&&src.includes('supabase-js'))return;markFailure(e.error||new Error(e.message||'Falha inesperada.'))});
  window.addEventListener('online',()=>{const h=q('runtimeRecovery');if(h&&!h.classList.contains('hidden'))show('A conexão voltou. Você pode tentar carregar novamente.')});
  window.addEventListener('offline',()=>show('O aparelho está sem conexão. Os dados existentes não serão substituídos por valores vazios.',false));
})();

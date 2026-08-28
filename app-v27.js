(function(){
  const V27={lock:null,lastOk:null,lastError:null};
  function stamp(){return new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
  function install(){document.body.classList.add('healthV27');const s=q('syncState');if(s)s.title='Última sincronização do estado canônico'}
  const prior=loadAll;
  loadAll=async function(){
    if(V27.lock)return V27.lock;
    if(typeof navigator!=='undefined'&&!navigator.onLine){const s=q('syncState');if(s)s.textContent='offline · sem nova sincronização';return null}
    V27.lock=(async()=>{
      const s=q('syncState');if(s)s.textContent='sincronizando…';
      try{const out=await prior();V27.lastOk=new Date();V27.lastError=null;if(s)s.textContent=`atualizado ${stamp()}`;return out}
      catch(e){V27.lastError=e;console.error('LTS Health sync coordinator',e);if(s)s.textContent='falha ao atualizar';throw e}
      finally{V27.lock=null}
    })();
    return V27.lock;
  };
  function refreshLabel(){const s=q('syncState');if(!s||V27.lock||!V27.lastOk)return;const min=Math.floor((Date.now()-V27.lastOk.getTime())/60000);s.textContent=min<1?`atualizado ${V27.lastOk.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`:`há ${min} min`;}
  setInterval(refreshLabel,30000);
  install();
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(()=>{V27.lastOk=new Date();refreshLabel()},4600)});
})();

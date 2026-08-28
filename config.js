// LTS Health dedicated production backend.
// No LTS Wealth backend reference belongs in this repository.
// Publishable keys are client-safe only when paired with Row Level Security.
window.LTS_HEALTH_CONFIG = Object.freeze({
  mode: 'dedicated',
  backend: Object.freeze({
    label: 'lts-health-production',
    projectRef: 'plztdqyuqcjohiimudnr',
    url: 'https://plztdqyuqcjohiimudnr.supabase.co',
    publishableKey: 'sb_publishable_7SdlV1H52wVVbPEsN7i7hg_jbluJ8aI'
  }),
  storageBucket: 'health-inbox',
  inspectFunction: 'health-inspect-upload-v2'
});

// index.html owns the canonical v11-v16 layers. Only newer product layers
// are appended here, once, to avoid duplicate execution of loadAll wrappers.
['./v17.css','./v18.css','./v19.css','./v20.css','./v21.css','./v22.css','./v23.css','./v24.css','./v25.css','./v26.css'].forEach(href=>{
  if(!document.querySelector(`link[href="${href}"]`)){
    const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l);
  }
});
function loadHealthLayer(src,marker){
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector(`script[${marker}]`);if(existing){resolve();return}
    const s=document.createElement('script');s.src=src;s.setAttribute(marker,'1');s.onload=resolve;s.onerror=reject;document.body.appendChild(s);
  });
}
window.addEventListener('load',async()=>{
  try{
    await loadHealthLayer('./app-v17.js','data-lts-health-v17');
    await loadHealthLayer('./app-v18.js','data-lts-health-v18');
    await loadHealthLayer('./app-v19.js','data-lts-health-v19');
    await loadHealthLayer('./app-v20.js','data-lts-health-v20');
    await loadHealthLayer('./app-v21.js','data-lts-health-v21');
    await loadHealthLayer('./app-v22.js','data-lts-health-v22');
    await loadHealthLayer('./app-v23.js','data-lts-health-v23');
    await loadHealthLayer('./app-v24.js','data-lts-health-v24');
    await loadHealthLayer('./app-v25.js','data-lts-health-v25');
    await loadHealthLayer('./app-v26.js','data-lts-health-v26');
  }catch(e){console.error('LTS Health product layer load failed',e)}
});

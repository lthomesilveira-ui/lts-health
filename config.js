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
  // v2 forwards non-Apple sources to the stable parser and uses the
  // conservative Apple Health parser for validated, non-overlapping metrics.
  inspectFunction: 'health-inspect-upload-v2'
});

// Modular product surfaces extend the consolidated shell without reviving
// the deprecated numbered-layer runtime.
const LTS_HEALTH_MODULES = [
  ['training-product','./training-product.css','./training-product.js'],
  ['evolution-product','./evolution-product.css','./evolution-product.js'],
  ['today-product','./today-product.css','./today-product.js'],
  ['nutrition-product','./nutrition-product.css','./nutrition-product.js'],
  ['health-product','./health-product.css','./health-product.js'],
  ['nutrition-analytics','./nutrition-analytics.css','./nutrition-analytics.js']
];
for (const [name, css] of LTS_HEALTH_MODULES) {
  if (document.querySelector(`link[data-lts-${name}]`)) continue;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = css;
  link.setAttribute(`data-lts-${name}`, '1');
  document.head.appendChild(link);
}
window.addEventListener('load', async () => {
  for (const [name,,src] of LTS_HEALTH_MODULES) {
    if (document.querySelector(`script[data-lts-${name}]`)) continue;
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;
      script.setAttribute(`data-lts-${name}`,'1');
      script.onload=resolve;
      script.onerror=reject;
      document.body.appendChild(script);
    });
  }
});

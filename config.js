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
  ['training-progression-deep','./training-progression-deep.css','./training-progression-deep.js'],
  ['evolution-product','./evolution-product.css','./evolution-product.js'],
  ['segmental-history','./segmental-history.css','./segmental-history.js'],
  ['today-product','./today-product.css','./today-product.js'],
  ['today-current','./today-current.css','./today-current.js'],
  ['today-evidence','./today-evidence.css','./today-evidence.js'],
  ['timeline-product','./timeline-product.css','./timeline-product.js'],
  ['nutrition-product','./nutrition-product.css','./nutrition-product.js'],
  ['health-product','./health-product.css','./health-product.js'],
  ['health-longitudinal','./health-longitudinal.css','./health-longitudinal.js'],
  ['health-evidence-bundles','./health-evidence-bundles.css','./health-evidence-bundles.js'],
  ['nutrition-analytics','./nutrition-analytics.css','./nutrition-analytics.js'],
  ['inbox-operations','./inbox-operations.css','./inbox-operations.js'],
  ['source-coverage','./source-coverage.css','./source-coverage.js'],
  ['source-onboarding','./source-onboarding.css','./source-onboarding.js'],
  ['insights-evidence','./insights-evidence.css','./insights-evidence.js'],
  ['search-product','./search-product.css','./search-product.js'],
  ['claude-parity','./claude-parity.css','./claude-parity.js']
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

import assert from 'node:assert/strict';
globalThis.location={search:'?fixture=1'};
const {state}=await import('../src/core.js');
const {homePeriodModel,nutritionPeriodModel}=await import('../src/home-period-model.js');
const {integratedReview,consultationLines}=await import('../src/integrated-review.js');
const {evolutionModel}=await import('../src/evolution-model.js');
const {nutritionTrainingContrast}=await import('../src/evidence-insights.js');
const {usefulReports}=await import('../src/reports-model.js');
const {renderIntegratedReview}=await import('../src/integrated-review-view.js');
const {renderUsefulReports}=await import('../src/reports-screen.js');
const {homeCockpitModel,nutritionPanel}=await import('../src/home-cockpit.js');
const today='2026-10-14',date=age=>new Date(Date.parse(`${today}T12:00:00Z`)-age*86400000).toISOString().slice(0,10);
const status=Object.fromEntries(['nutrition','sourceMetrics','metrics','workouts','exercises','sets','body','segmental','labs','treatments','goals','meals','polarSessions'].map(key=>[key,'ready']));
const data=Object.fromEntries(Object.keys(status).map(key=>[key,[]]));
for(let age=40;age<=80;age++)data.nutrition.push({nutrition_date:date(age),source:'Synthetic archive',calories_kcal:2400,protein_g:204});
for(let age=0;age<=15;age++)data.nutrition.push({nutrition_date:date(age),source:'Synthetic connected',calories_kcal:age?2600:99999,protein_g:age?225:9999});
for(const [canonical_status,protein]of [['canonical',110],['candidate',120],['held',130]]){
  for(let age=0;age<=10;age++)for(const [metric_type,unit,value]of [['dietary_protein_g','g',age?protein:9999],['dietary_energy_kcal','kcal',age?2100:99999],['dietary_fiber_g','g',age===1?0:null]]){
    data.sourceMetrics.push({metric_date:date(age),metric_type,unit,value,source_name:'Synthetic same label',source_family:'synthetic',canonical_status});
  }
}
// The same label in another table remains a separate identity.
data.nutrition.push({nutrition_date:date(1),source:'Synthetic same label',protein_g:900,calories_kcal:9000});
for(let age=1;age<=10;age+=2)data.workouts.push({workout_date:date(age),is_canonical:true,record_status:'validated',source:'Synthetic workout'});
const original=structuredClone(data),initial=homePeriodModel(data,status,'90',{},today);
const archived=initial.nutrition.sources.find(source=>source.label==='Synthetic archive').key;
const recent=initial.nutrition.sources.find(source=>source.label==='Synthetic connected').key;
function models(period,key,d=data,st=status){
  const ui={homePeriod:period,analysisPeriod:period,reportNutritionSource:key};
  const home=homePeriodModel(d,st,period,ui,today),reports=usefulReports(d,st,ui,today);
  const review=integratedReview(d,st,reports.current,ui,today),evolution=evolutionModel(d,st,reports,review,ui);
  return {ui,home,reports,review,evolution,lines:consultationLines(review,reports,evolution).join('\n')};
}
const a=models('90',archived);
assert.equal(a.home.nutrition.counts.protein_g,41);assert.equal(a.home.nutrition.means.protein_g,204);
assert.equal(a.review.nutrition.source.key,archived);assert.equal(a.review.nutrition.counts.protein_g,41);
assert.equal(a.review.nutrition.means.protein_g,204);assert.match(a.lines,/Proteína média: 204 g · 41 dias com valor/);
assert.equal(a.evolution.periodModel.nutrition.source.key,archived);
assert.equal(a.evolution.recent.nutrition.protein_g.current,204);
// Every source, including canonical/candidate/held metrics, has identical raw
// dates, individual denominators and averages through Home, summary and back.
for(const source of initial.nutrition.sources)for(const period of ['30','90','365','all']){
  const m=models(period,source.key),n=m.home.nutrition,r=m.review.nutrition;
  assert.deepEqual(m.reports.nutrition.rows,n.rows);assert.deepEqual(m.reports.nutrition.means,n.means);assert.deepEqual(m.reports.nutrition.counts,n.counts);assert.equal(m.reports.nutrition.source?.key,n.source?.key);
  if(m.reports.prior?.nutrition.source)assert.equal(m.reports.prior.nutrition.source.key,n.source?.key||source.key);
  assert.deepEqual(r.rows,n.rows);assert.deepEqual(r.closedRows,n.closedRows);
  assert.deepEqual(r.means,n.means);assert.deepEqual(r.counts,n.counts);
  assert.equal(r.source?.key,n.source?.key);assert.equal(r.source?.status,n.source?.status);
  assert.equal(m.evolution.periodModel.nutrition.source?.key,n.source?.key);
  const contrast=nutritionTrainingContrast(data,status,m.reports.current,source.key,today);
  assert.equal(contrast.selected?.key,n.source?.key);
  assert.deepEqual(contrast.selected?.days.map(d=>d.row)||[],n.closedRows);
  for(const stat of contrast.rows)assert.equal(stat.withDays+stat.withoutDays,n.counts[stat.key]);
  assert.deepEqual(homePeriodModel(data,status,period,m.ui,today).nutrition.rows,n.rows,'return preserves choice and every point');
  if(source.domain==='sourceMetrics'&&n.source){
    const expected={canonical:110,candidate:120,held:130}[source.status];
    assert.equal(n.means.protein_g,expected);assert.equal(n.counts.protein_g,10);
    assert.equal(n.means.fiber_g,0);assert.equal(n.counts.fiber_g,1);
    if(source.status!=='canonical')assert.match(m.lines,source.status==='candidate'?/Synthetic same label · Registro adicional/:/Synthetic same label · Registro com limitações/);
  }
}
// An absent selection never substitutes a more recent origin, even in insights.
const missing=models('30',archived);
for(const n of [missing.home.nutrition,missing.review.nutrition,missing.evolution.periodModel.nutrition]){
  assert.equal(n.requestedSource,archived);assert.equal(n.requestedSourceMissing,true);
  assert.equal(n.source,null);assert.equal(n.means.protein_g,null);assert.equal(n.counts.protein_g,0);
}
assert.match(missing.lines,/Origem escolhida sem dados disponíveis nesta janela/);
assert.match(missing.lines,/Proteína média: Sem dado · 0 dias com valor/);
assert.equal(missing.evolution.insights.nutrition.selected,null);
assert.equal(models('90',archived).review.nutrition.counts.protein_g,41);
assert.equal(models('30',recent).review.nutrition.means.protein_g,225,'only explicit replacement changes the source');
assert.equal(models('90','synthetic same label').review.nutrition.source,null,'ambiguous legacy labels never choose a domain/status');
assert.equal(models('90','synthetic archive').review.nutrition.source.key,archived,'unambiguous legacy labels remain compatible');
const candidate=initial.nutrition.sources.find(source=>source.status==='candidate').key;
const failed=models('90',candidate,data,{...status,sourceMetrics:'error'});
assert.equal(failed.review.nutrition.source,null);assert.equal(failed.review.nutrition.means.protein_g,null);
assert.equal(failed.evolution.periodModel.nutrition.source,null);
const metricOnly={...data,nutrition:[]},only=models('90',candidate,metricOnly,{...status,nutrition:'error'});
assert.equal(only.review.nutrition.means.protein_g,120);assert.equal(only.review.nutrition.source.status,'candidate');
// A failed selected source is not an empty diary just because another domain
// loaded successfully. Copy must not suppress a valid independent selection.
const panelFor=(key,st=status,d=data,period='90')=>{
  const context=homeCockpitModel(d,st,period,{reportNutritionSource:key},today),before=structuredClone(context.r.nutrition);
  const html=nutritionPanel(context);assert.deepEqual(context.r.nutrition,before,'rendering never alters the selected source model');return html;
};
for(const [key,domain]of [[recent,'nutrition'],[candidate,'sourceMetrics']]){
  const html=panelFor(key,{...status,[domain]:'error'});
  assert.match(html,/Diário indisponível nesta atualização/);assert.match(html,/Não foi possível carregar o diário escolhido/);assert.match(html,/Sua escolha foi preservada/);
  assert.doesNotMatch(html,/Sem diário nesta janela|Não há dados do diário escolhido|O diário escolhido não tem dados|Sem registros neste período|Nenhum registro nesta janela/);
  assert.match(html,/<div class="ltsContextEmpty" role="status">O gráfico não está disponível nesta atualização\.<\/div>/);
  assert.match(html,/id="home-reportNutritionSource"/,'other sources remain explicitly selectable');
}
assert.match(panelFor(candidate,{...status,nutrition:'error'}),/120 g/,'valid source metrics remain visible when nutrition fails');
assert.match(panelFor(recent,{...status,sourceMetrics:'error'}),/225 g/,'valid diary remains visible when source metrics fail');
for(const st of [status,{...status,sourceMetrics:'error'}]){
  const html=panelFor(archived,st,data,'30');assert.match(html,/Sem diário nesta janela/);assert.match(html,/Não há dados do diário escolhido neste período/);assert.doesNotMatch(html,/Não foi possível carregar o diário escolhido/);
}
const emptyPanel=panelFor(null,status,{...data,nutrition:[],sourceMetrics:[]});assert.match(emptyPanel,/Sem diário nesta janela/);assert.match(emptyPanel,/<div class="ltsContextEmpty" role="status">Nenhum registro nesta janela\.<\/div>/);assert.doesNotMatch(emptyPanel,/indisponível|Não foi possível carregar/);
const unknownPanel=panelFor(null,{...status,nutrition:'error'},{...data,nutrition:[],sourceMetrics:[]});assert.match(unknownPanel,/Não foi possível carregar todos os diários/);assert.doesNotMatch(unknownPanel,/Sem diário nesta janela|Sem registros neste período/);
// Duplicates affect only their metric and source; other origins on the same date stay usable.
const duplicate=structuredClone(data),dup=duplicate.sourceMetrics.find(row=>row.canonical_status==='candidate'&&row.metric_type==='dietary_protein_g'&&row.metric_date===date(1));duplicate.sourceMetrics.push({...dup,value:999});
const d=models('90',candidate,duplicate);assert.equal(d.review.nutrition.counts.protein_g,9);assert.equal(d.review.nutrition.counts.calories_kcal,10);assert.equal(d.review.nutrition.means.protein_g,120);
const future=nutritionPeriodModel({...data,nutrition:[...data.nutrition,{nutrition_date:date(-1),source:'Synthetic archive',protein_g:9999}]},status,{end:date(-1)},{reportNutritionSource:archived},today);
assert.equal(future.counts.protein_g,41);
state.data=data;state.domainStatus=status;state.ui={...missing.ui,reviewView:'consultation'};
const html=renderIntegratedReview(missing.reports);
assert.match(html,/<option[^>]*selected disabled>Origem sem dados nesta janela<\/option>/);
assert.match(html,/Origem escolhida sem dados disponíveis nesta janela/);
assert.match(html,/Proteína média: Sem dado · 0 dias com valor/);
const full=renderUsefulReports();assert.match(full,/id="reportNutritionSource"[^>]*><option[^>]*selected disabled>Origem sem dados nesta janela/);
assert.equal(state.ui.reportNutritionSource,archived,'rendering never overwrites the stored choice');
assert.deepEqual(data,original,'source inputs unchanged');
console.log('Nutrition source contract: full Home → consultation → Home identity, exact means/counts/raw dates, 30/90/365/all, canonical/candidate/held isolation, metric duplicates, explicit missing/failed origin, legacy ambiguity, render placeholders and nonmutation passed.');

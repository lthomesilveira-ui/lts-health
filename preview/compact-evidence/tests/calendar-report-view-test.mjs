import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeCalendarReportFixture,expectedCalendarMetric,CALENDAR_KEYS,CALENDAR_WINDOWS,CALENDAR_TODAY,CALENDAR_SOURCES} from './calendar-report-fixture.mjs';
globalThis.location={search:'?fixture=1'};
const {renderCalendarReport,renderCalendarReportPrint,calendarReportPrintTitle,updateCalendarReportSelection,printCalendarReport}=await import('../src/calendar-report-view.js');
const {calendarReport}=await import('../src/calendar-report-model.js');
const {state}=await import('../src/core.js');
const {renderCalendarOverview,renderCalendarSummaryPrint}=await import('../src/calendar-report-overview.js');
const card=(html,key)=>html.match(new RegExp(`<article[^>]+data-calendar-metric="${key}"[^>]*>([\\s\\S]*?)<\\/article>`))?.[1]||'';
const capture=value=>structuredClone(value);
// Arithmetic/gap assertions deliberately inspect an explicitly selected origin.
const chosenSources={water:CALENDAR_SOURCES.food,protein:CALENDAR_SOURCES.food,energy:CALENDAR_SOURCES.food,carbs:CALENDAR_SOURCES.food,fat:CALENDAR_SOURCES.food,fiber:CALENDAR_SOURCES.food,steps:CALENDAR_SOURCES.watch,activeEnergy:CALENDAR_SOURCES.watch};
const f=makeCalendarReportFixture(),before=capture(f.data),ui={calendarReportSources:chosenSources,analysisPeriod:'365',dashboardMode:'day',dashboardDate:'2026-10-01'},uiBefore=capture(ui),stateBefore=capture(state);
const html=renderCalendarReport(f.data,f.status,ui,f.today),model=calendarReport(f.data,f.status,ui,f.today);
assert.match(html,/<details class="ltsCalendarFullDetails" data-disclosure="calendar-full">/,'Detailed records start closed, with a native accessible disclosure');
assert.ok(html.indexOf('ltsReportOverview')<html.indexOf('ltsCalendarFullDetails'),'The visual reading precedes the complete record workspace');
assert.equal((html.match(/id="calendarReportStatus"/g)||[]).length,1,'One live export status, without duplicate IDs');
assert.match(html,/id="calendar-summary-export" data-calendar-print="summary"/);
assert.match(html,/id="calendar-export" data-calendar-print="full"/,'The full original evidence export remains available');
for(const key of ['energy','protein','carbs','fat','fiber']){
  const overview=renderCalendarOverview(model,{selected:key}),expected=expectedCalendarMetric(f,key,CALENDAR_WINDOWS.lastWeek);
  const plotted=[...overview.matchAll(/data-report-plot-date="([^"]+)"/g)].map(match=>match[1]).sort();
  assert.deepEqual(plotted,expected.dates,`${key}: overview charts preserve the independent eligibility/gap/source oracle`);
  assert.match(overview,new RegExp(`data-calendar-chart="${key}" aria-pressed="true"`));
}
const summary=renderCalendarSummaryPrint(model);
assert.equal((summary.match(/<tr>/g)||[]).length,9,'Concise export contains all eight source-specific indicator rows');
assert.doesNotMatch(summary,/<details|<button|<select|data-calendar-day=|ltsCalendarAllEvidence/,'Summary and full-evidence export are explicit separate choices');
assert.match(summary,/Dados completos/);assert.match(summary,/Ausência não é zero/);
for(const metric of model.metrics)assert.ok(summary.includes(sourceDisplayForTest(metric)));
function sourceDisplayForTest(metric){return metric.value==null?'Sem registro':metric.value.toLocaleString('pt-BR',{maximumFractionDigits:1});}
assert.match(html,/id="calendarReport"/);assert.match(html,/05\/10\/2026 a 11\/10\/2026/);assert.match(html,/segunda a domingo/);
assert.match(html,/data-calendar-mode="week" aria-pressed="true"/);assert.match(html,/value="last" selected/);
assert.match(html,/Imprimir \/ salvar PDF/);assert.match(html,/Nada é enviado automaticamente/);
assert.equal((html.match(/data-calendar-metric=/g)||[]).length,8);
for(const key of CALENDAR_KEYS){
  const expected=expectedCalendarMetric(f,key,CALENDAR_WINDOWS.lastWeek),section=card(html,key);
  assert.ok(section.includes(expected.value.toLocaleString('pt-BR',{maximumFractionDigits:0})),`${key} whole-window value matches independent arithmetic`);
  assert.ok(section.includes(`${expected.count}/7 dias encerrados com valor`),`${key} denominator`);
  assert.match(section,/ltsCalendarSource/);assert.match(section,/ltsCalendarComparison/);assert.match(section,/data-calendar-source=/);
}
const water=card(html,'water');
assert.match(water,/data-calendar-day="2026-10-05"[^>]*>[\s\S]*?<b>0 mL<\/b>/);
assert.doesNotMatch(water,/data-calendar-plot-date="2026-10-06"/);
assert.doesNotMatch(water,/data-calendar-plot-date="2026-10-07"/);
assert.doesNotMatch(water,/data-calendar-plot-date="2026-10-08"/);
assert.match(water,/Mais de um valor; fora da média/);assert.match(water,/Registro incompleto; fora da média/);
assert.doesNotMatch(html,/ltsCalendarToday|MARCADOR FUTURO|EVENTO FUTURO|>987654|NaN|Infinity|undefined/);
assert.match(html,/Anterior fora do período selecionado: 03\/09\/2026/);
assert.match(html,/13,4567 u\/L/);assert.match(html,/&lt;4 u\/L/);
assert.match(html,/Grupos principais e secundários não foram informados/);
assert.match(html,/comparação retrospectiva está desativada/i);
assert.deepEqual(f.data,before);assert.deepEqual(ui,uiBefore);assert.deepEqual(state,stateBefore);

assert.match(html,/O que a média não mostra/);
assert.equal((html.match(/data-calendar-highlight=/g)||[]).length,3);
for(const item of model.highlights.ranges){
  const highlight=html.match(new RegExp(`<article[^>]+data-calendar-highlight="${item.key}"[^>]*>([\\s\\S]*?)<\\/article>`))[1];
  assert.ok(highlight.includes(item.minimum.value.toLocaleString('pt-BR',{maximumFractionDigits:1})));
  assert.ok(highlight.includes(item.maximum.value.toLocaleString('pt-BR',{maximumFractionDigits:1})));
  assert.ok(highlight.includes(`${item.count}/${item.expectedDays} dias encerrados com valor`));
}
assert.match(html,/ltsCalendarGroupBar/);
assert.match(html,/Incluem aquecimento e ajuste quando informados/);
assert.doesNotMatch(renderCalendarReport(f.data,{...f.status,sets:'error'},ui,f.today),/class="ltsCalendarGroupBar"/,'Failed series never become visual zero bars');
assert.match(renderCalendarReportPrint(model),/O que a média não mostra/,'The local PDF shares the exact descriptive model');

const current=renderCalendarReport(f.data,f.status,{calendarReportSelection:'current'},f.today);
assert.match(current,/12\/10\/2026 a 17\/10\/2026/);assert.match(current,/ltsCalendarToday/);assert.match(current,/Hoje · 17\/10\/2026 · parcial/);assert.match(current,/Fora das médias e comparações/);
const monday=renderCalendarReport(f.data,f.status,{calendarReportSelection:'current'},'2026-10-19');assert.match(monday,/0\/0 dias encerrados com valor/);assert.doesNotMatch(monday,/NaN|Infinity|undefined/);
const month=renderCalendarReport(f.data,f.status,{calendarReportMode:'month'},f.today);assert.match(month,/01\/09\/2026 a 30\/09\/2026/);assert.match(month,/Mês do calendário/);
const history=renderCalendarReport(f.data,f.status,{calendarReportMode:'month',calendarReportSelection:'date',calendarReportDate:'2024-02'},f.today);assert.match(history,/01\/02\/2024 a 29\/02\/2024/);assert.match(history,/type="month"/);assert.doesNotMatch(history,/ltsCalendarToday/);
const empty=makeCalendarReportFixture('empty');const emptyHtml=renderCalendarReport(empty.data,empty.status,{},empty.today);assert.match(emptyHtml,/0\/7 dias encerrados com valor/);assert.match(emptyHtml,/Nenhuma coleta registrada/);assert.doesNotMatch(emptyHtml,/NaN|Infinity|undefined/);
const failed=renderCalendarReport(f.data,Object.fromEntries(Object.keys(f.status).map(key=>[key,'error'])),{},f.today);assert.match(failed,/Cobertura indisponível/);assert.match(failed,/treinos não carregaram/i);assert.doesNotMatch(card(failed,'water'),/0 mL/);

// CI1 regression: a successful empty metrics domain cannot disguise a failed
// sourceMetrics read as an ordinary 0/N history gap. A surviving food source
// remains usable, with a visible read limitation in both screen and PDF.
const partiallyFailedStatus={...f.status,sourceMetrics:'error'},partiallyFailed=calendarReport(f.data,partiallyFailedStatus,{calendarReportSources:chosenSources},f.today),partiallyFailedHtml=renderCalendarReport(f.data,partiallyFailedStatus,{calendarReportSources:chosenSources},f.today);
assert.match(card(partiallyFailedHtml,'steps'),/Falha ao carregar/);assert.match(card(partiallyFailedHtml,'steps'),/Cobertura indisponível/);assert.doesNotMatch(card(partiallyFailedHtml,'steps'),/0\/7 dias encerrados/);
assert.match(card(partiallyFailedHtml,'water'),/803 mL/);assert.match(card(partiallyFailedHtml,'water'),/4\/7 dias encerrados/);assert.match(card(partiallyFailedHtml,'water'),/não carregou/i);
const failedPrint=renderCalendarReportPrint(partiallyFailed);assert.match(card(failedPrint,'steps'),/Falha ao carregar/);assert.match(failedPrint,/Os dias deste período não puderam ser verificados/);assert.match(failedPrint,/Cobertura indisponível/);
const pendingHtml=renderCalendarReport(f.data,{...f.status,sourceMetrics:'loading'},{},f.today);assert.match(card(pendingHtml,'steps'),/Carregando/);assert.match(card(pendingHtml,'steps'),/Cobertura indisponível/);
const print=renderCalendarReportPrint(model);assert.match(print,/LTS HEALTH/);assert.match(print,/data-calendar-comparison-table/);assert.match(print,/Dias, origens e limites/);assert.match(print,/70%/);assert.match(print,/mesmo treino pode aparecer/);assert.match(print,/Arquivo criado localmente/);
assert.match(print,/<p class="ltsCalendarEyebrow">LTS HEALTH · RELATÓRIO SEMANAL<\/p>/);
assert.match(renderCalendarReportPrint(calendarReport(f.data,f.status,{calendarReportMode:'month'},f.today)),/<p class="ltsCalendarEyebrow">LTS HEALTH · RELATÓRIO MENSAL<\/p>/);
assert.doesNotMatch(print,/<details|<summary|<button|<select|<input|data-calendar-print|ltsCalendarToday|undefined|NaN|Infinity/);
for(const metric of model.metrics)for(const point of metric.points)assert.ok(print.includes(`data-calendar-day="${point.date}"`));
assert.match(print,/13,4567 u\/L/);assert.match(print,/&lt;4 u\/L/);assert.match(print,/referência/i);assert.match(print,/Método sintético/);
assert.equal(calendarReportPrintTitle(model),'LTS Health - Relatório semanal - 2026-10-05 a 2026-10-11');
// A historical date alone is not opt-in to compare against a later plan.
const retrospectiveUI={calendarReportMode:'month',nutritionPlanRetrospective:true},retrospectiveModel=calendarReport(f.data,f.status,retrospectiveUI,f.today);
assert.equal(model.nutritionPlan.state,'retrospective_required');assert.equal(retrospectiveModel.nutritionPlan.state,'ready');
for(const markup of [html,print]){
  assert.match(markup,/Este período inclui datas anteriores ao documento ou ao recebimento do plano/);
  assert.match(markup,/Esta janela inclui datas anteriores ao plano recebido 17\/10\/2026\./);
  assert.match(markup,/comparação retrospectiva está desativada/);
  assert.doesNotMatch(markup,/A comparação é retrospectiva com a versão mais recente|class="ltsCalendarPlanMetrics"/);
}
for(const markup of [renderCalendarReport(f.data,f.status,retrospectiveUI,f.today),renderCalendarReportPrint(retrospectiveModel)]){
  assert.match(markup,/A comparação é retrospectiva com a versão mais recente; não indica adesão passada/);
  assert.match(markup,/Comparação retrospectiva; não indica adesão passada/);
  assert.match(markup,/class="ltsCalendarPlanMetrics"/);assert.doesNotMatch(markup,/comparação retrospectiva está desativada/);
}
assert.match(model.nutritionPlan.notes[0],/A comparação é retrospectiva/,'view leaves inherited model immutable');
const large=capture(model);large.metrics[0].points=Array.from({length:120},(_,i)=>({date:`2025-${String(Math.floor(i/28)+1).padStart(2,'0')}-${String(i%28+1).padStart(2,'0')}`,value:i,eligible:true}));
assert.equal((renderCalendarReportPrint(large).match(/data-calendar-evidence="water"[\s\S]*?<\/section>/)?.[0].match(/data-calendar-day=/g)||[]).length,120,'print never truncates evidence to a preview limit');

const injected={data:capture(f.data),status:capture(f.status),today:f.today};const payload='<img src=x onerror=alert(1)>';
injected.data.nutrition.forEach(row=>row.source=payload);injected.data.workouts.forEach(row=>{row.workout_type=payload;row.source=payload;row.location=payload;row.session_comment=payload;});injected.data.exercises.forEach(row=>{row.exercise=payload;row.machine=payload;row.muscle_group=payload;});injected.data.labs.forEach(row=>{row.biomarker=payload;row.result_raw=payload;row.reference_range=payload;row.method=payload;row.laboratory=payload;row.source_file=payload;});injected.data.treatments.forEach(row=>{row.medication=payload;row.source=payload;});
for(const markup of [renderCalendarReport(injected.data,injected.status,{},injected.today),renderCalendarReportPrint(calendarReport(injected.data,injected.status,{},injected.today))]){assert.ok(markup.includes('&lt;img'));assert.doesNotMatch(markup,/<img|<script/);}

assert.deepEqual(updateCalendarReportSelection(ui,'mode','month',f.today),{calendarReportMode:'month'});
assert.deepEqual(updateCalendarReportSelection(ui,'step',-1,f.today),{calendarReportSelection:'date',calendarReportDate:'2026-09-28'});
assert.deepEqual(updateCalendarReportSelection({calendarReportMode:'month'},'step',1,f.today),{calendarReportSelection:'date',calendarReportDate:'2026-10-01'});
assert.equal(updateCalendarReportSelection({calendarReportSelection:'current'},'step',1,f.today),null);
assert.equal(updateCalendarReportSelection(ui,'date','2026-02-31',f.today),null);assert.equal(updateCalendarReportSelection(ui,'date','2026-10-18',f.today),null);assert.equal(updateCalendarReportSelection(ui,'date','',f.today),null);
assert.deepEqual(updateCalendarReportSelection(ui,'date','2024-02',f.today),{calendarReportSelection:'date',calendarReportDate:'2024-02-01'});assert.deepEqual(ui,uiBefore);

// Unit doubles for local-print lifecycle, not a browser or visual test.
const handlers=new Map(),mediaHandlers=new Set(),classes=new Set(),children=[],message={textContent:''};let calls=0,focused=0,shouldThrow=false;
const active={isConnected:true,focus:()=>focused++};
globalThis.document={title:'Original app title',activeElement:active,body:{appendChild:element=>children.push(element),classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)}},createElement:()=>({id:'',innerHTML:'',remove(){const index=children.indexOf(this);if(index>=0)children.splice(index,1);}}),getElementById:id=>id==='calendarReportStatus'?message:children.find(item=>item.id===id)};
globalThis.window={addEventListener:(type,fn)=>handlers.set(type,fn),removeEventListener:(type,fn)=>{if(handlers.get(type)===fn)handlers.delete(type);},matchMedia:()=>({addEventListener:(_,fn)=>mediaHandlers.add(fn),removeEventListener:(_,fn)=>mediaHandlers.delete(fn)}),print:()=>{calls++;assert.equal(children.length,1);assert.ok(classes.has('ltsCalendarPrinting'));assert.equal(document.title,calendarReportPrintTitle(model));assert.ok(children[0].innerHTML.includes('data-calendar-comparison-table'));if(shouldThrow)throw new Error('Synthetic print failure');}};
assert.equal(printCalendarReport(f.data,f.status,{},f.today),true);assert.equal(calls,1,'window.print invoked before return');assert.equal(children.length,1,'do not remove document before async Safari preview finishes');handlers.get('afterprint')();assert.equal(children.length,0);assert.equal(document.title,'Original app title');assert.equal(classes.size,0);assert.equal(focused,1);assert.equal(mediaHandlers.size,0);
shouldThrow=true;assert.equal(printCalendarReport(f.data,f.status,{},f.today),false);assert.equal(children.length,0);assert.equal(classes.size,0);assert.equal(document.title,'Original app title');assert.match(message.textContent,/Não foi possível abrir/);
shouldThrow=false;assert.equal(printCalendarReport(f.data,f.status,{},f.today),true);assert.equal(children.length,1);assert.equal(printCalendarReport(f.data,f.status,{},f.today),true);assert.equal(children.length,1,'repeated export cleans the prior temporary document');for(const callback of [...mediaHandlers])callback({matches:false});assert.equal(children.length,0);assert.equal(document.title,'Original app title');
delete globalThis.document;delete globalThis.window;

const css=readFileSync(new URL('../calendar-reports.css',import.meta.url),'utf8'),source=readFileSync(new URL('../src/calendar-report-view.js',import.meta.url),'utf8'),main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),reports=readFileSync(new URL('../src/reports-screen.js',import.meta.url),'utf8');
assert.match(css,/body\.ltsCalendarPrinting>\*:not\(#calendarPrintRoot\)\{display:none!important\}/);assert.match(css,/@page\{size:A4/);assert.match(css,/html:has\(body\.ltsCalendarPrinting\)\{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important/);assert.match(css,/ltsCalendarSourcePicker select\{[^}]*appearance:none;[^}]*text-overflow:ellipsis/);assert.match(css,/ltsCalendarControls>label\{grid-column:1\/-1;width:100%/);assert.match(css,/max-width:600px/);assert.match(css,/page-break-inside:avoid/);assert.match(css,/thead\{display:table-header-group/);
// CI2 PDF: tracked letters were visible but extracted as separate words; keep
// each clinical observation/reference and short session summary together.
assert.match(css,/#calendarPrintRoot \.ltsCalendarEyebrow\{letter-spacing:normal\}/);
assert.match(css,/#calendarPrintRoot \.ltsCalendarSession,#calendarPrintRoot \.ltsCalendarLabRow,#calendarPrintRoot \.ltsCalendarLabs \.ltsCalendarEvidence>ul>li\{break-inside:avoid;page-break-inside:avoid\}/);
assert.match(css,/\.ltsCalendarModes button\{padding-inline:8px;white-space:nowrap\}/);
assert.doesNotMatch(source,/\blocalStorage\b|\bsessionStorage\b|\bfetch\s*\(|console\.|window\.open|navigator\.sendBeacon/);
assert.match(main,/state\.ui\.calendarReportSources=/);assert.match(reports,/renderCalendarReport\(\)/);assert.match(reports,/Além deste resumo/);assert.match(reports,/renderIntegratedReview\(m\)/);assert.match(reports,/renderEvidenceInsights/);
console.log('Calendar report view: independent windows, all eight metric values/coverage, chart gaps and zero, origin isolation, dated labs, training and plan limits, escaped full print evidence, A4/mobile CSS, synchronous print/cancel/error/repeat lifecycle, and preserved old workspaces passed. Browser layout and native iPhone saving require separate acceptance tests.');

assert.match(css, /ltsCalendarPrintComparison td:last-child\{word-spacing:1pt\}/, 'PDF zero differences keep a visible, extractable separator before the unit');

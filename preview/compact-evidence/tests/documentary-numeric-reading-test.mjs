import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewedDocumentaryNumericReading as derive,hasDocumentaryNumericProof} from '../src/health-lab-documentary-numeric.js';
import {documentaryEvidenceSha256} from '../src/health-lab-reviewed-numeric.js';
import {labResultReading,compareLabResults,dashboardLabs} from '../src/health-dashboard-labs.js';
import {makeDocumentaryNumericRow as make,makeDocumentaryNumericPair as pair,documentarySyntheticSha256 as hash} from './documentary-numeric-reading-fixture.mjs';
import {makeReviewedBloodCountPair} from './reviewed-blood-count-fixture.mjs';

// Synthetic inputs only. Tests validate consumers of an already independently
// approved source proof; neither a hash nor this test factory authorizes one.
let count=0;const test=(name,run)=>{run();console.log(`ok ${++count} - ${name}`);};
const proof=row=>row.numeric_reading_verification;
const blocked=row=>{assert.equal(derive(row),null);assert.equal(labResultReading(row).exactValue,null);};
const mutate=(change,options)=>{const row=make(options);change(proof(row),row);blocked(row);};
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const bounds={start:'2024-06-01',end:'2024-07-31'};

test('verified unsigned integers and decimal-comma footnotes produce an additive projection',()=>{
  for(const token of ['73','0','73,4','0,04','1,234']){
    const row=make({token}),reading=derive(row);
    assert.equal(reading.value,row.result_numeric);assert.equal(reading.originalRaw,row.result_raw);
    assert.equal(reading.sourceNote,'Resultado fora da faixa de referência.');
    assert.deepEqual(reading.transformations,['remove_verified_terminal_footnote_1',...(token.includes(',')?['read_verified_decimal_comma']:[])]);
    assert.equal(reading.proofReference.auditId,proof(row).audit_id);
    assert.equal(labResultReading(row).exactValue,row.result_numeric);
    assert.deepEqual(labResultReading(row).documentaryNumericReading,reading);
  }
});
test('grouped integer proof supports local notation or independent ungrouped clinical confirmation',()=>{
  for(const kind of ['grouped','footnote_grouped'])for(const grouping of ['local','ungrouped'])for(const token of ['4.670','1.234.567']){
    const row=make({kind,grouping,token}),reading=derive(row);
    assert.equal(reading.value,row.result_numeric);assert.ok(reading.transformations.includes('remove_verified_dot_grouping'));
    assert.equal(Object.hasOwn(reading,'sourceNote'),kind==='footnote_grouped');
    assert.equal(labResultReading(row).rawValue,row.result_raw);
  }
});
test('a unit transcribed from a column header may precede the selected analyte and result',()=>{
  const row=make({kind:'grouped'}),c=proof(row).clinical;
  c.evidence_text=`Cabeçalho: % | ${c.printed_unit}. ${c.printed_analyte}: 42,7 | ${c.numeric_token}`;
  c.evidence_text_sha256=hash(c.evidence_text);
  for(const[key,token]of [['analyte',c.printed_analyte],['result',c.numeric_token],['unit',c.printed_unit]]){
    const start=c.evidence_text.indexOf(token);c.spans[key]=[start,start+token.length];
  }
  assert.equal(derive(row).value,row.result_numeric);
});
test('UTF-16 spans remain exact for invented labels containing supplementary Unicode',()=>{
  const row=make({biomarker:'🧪 Marcador sintético'});assert.equal(derive(row).value,row.result_numeric);
  mutate(p=>{p.audit_id='x'.repeat(161);});
});
test('projected, embedded and semantically identical dual representations agree',()=>{
  const row=make(),expected=derive(row),embedded=structuredClone(row);
  embedded.source_payload={numeric_reading_verification:embedded.numeric_reading_verification};delete embedded.numeric_reading_verification;
  assert.deepEqual(derive(embedded),expected);
  row.source_payload={numeric_reading_verification:Object.fromEntries(Object.entries(proof(row)).reverse())};
  assert.deepEqual(derive(row),expected);
  for(const reviewed_at of ['2024-07-01T10:30:00Z','2024-07-01T10:30:00.000Z','2024-07-01T10:30:00.123Z']){
    proof(row).reviewed_at=reviewed_at;row.source_payload.numeric_reading_verification=structuredClone(proof(row));
    assert.equal(derive(row).proofReference.reviewedAt,reviewed_at);
  }
});
test('every exact binding field is mandatory and independently detects row or proof drift',()=>{
  for(const field of Object.keys(proof(make()).binding)){
    mutate((p,r)=>{r[field]=typeof r[field]==='number'?r[field]+1:`${r[field]} changed`;});
    mutate(p=>{p.binding[field]=typeof p.binding[field]==='number'?p.binding[field]+1:`${p.binding[field]} changed`;});
    mutate((p,r)=>{delete r[field];});mutate(p=>{delete p.binding[field];});
    mutate((p,r)=>{r.source_payload={[field]:typeof r[field]==='number'?r[field]+1:`${r[field]} changed`};});
  }
});
test('missing, null, malformed and unapproved proofs cannot promote an annotated or grouped value',()=>{
  for(const value of [undefined,null,false,true,0,'source_verified',{},[],{status:'source_verified'}]){
    for(const kind of ['footnote','grouped']){const row=make({kind});row.numeric_reading_verification=value;blocked(row);}
  }
  for(const field of ['schema','status','audit_id','reviewed_at','binding','document','clinical','evolution','footnote','locale']){
    mutate(p=>{delete p[field];});mutate(p=>{p[field]=false;});
  }
  for(const value of ['2024-02-30T10:30:00Z','2024-07-01T25:00:00Z','2024-07-01','2024-07-01T10:30:00+00:00',''])mutate(p=>{p.reviewed_at=value;});
});
test('explicit non-exact kinds veto either representation, including a conflicting exact projection',()=>{
  for(const kind of ['censored','lower_bound','upper_bound','range','approximation','text','unknown','exáct',true,0,{},' ']){
    mutate((p,r)=>{r.numeric_kind=kind;});mutate((p,r)=>{r.source_payload={numeric_kind:kind};});
    mutate((p,r)=>{r.numeric_kind='exact';r.source_payload={numeric_kind:kind};});
    mutate((p,r)=>{r.numeric_kind=kind;r.source_payload={numeric_kind:'exact'};});
  }
  for(const kind of [null,undefined,'','exact','EXACT',' exact ']){
    const row=make({numeric_kind:kind});assert.equal(derive(row).value,row.result_numeric);
  }
  assert.equal(labResultReading({result_numeric:4,result_raw:'4',numeric_kind:'exact',source_payload:{numeric_kind:'censored'}}).exactValue,null);
});
test('new explicit invalid proof blocks every older or generic fallback',()=>{
  for(const marker of ['Hemoglobina','Hematócrito']){
    const {previous}=makeReviewedBloodCountPair(marker);assert.equal(labResultReading(previous).exactValue,previous.result_numeric);
    for(const invalid of [false,{},'invalid'])blocked({...previous,numeric_reading_verification:invalid});
    assert.equal(labResultReading({...previous,numeric_reading_verification:null}).exactValue,previous.result_numeric);
  }
  for(const row of [{result_numeric:4,result_raw:'4'}, {result_numeric:4670,result_raw:'4.670',unit:'/mm3',numeric_kind:'exact'}]){
    assert.equal(labResultReading(row).exactValue,row.result_numeric);blocked({...row,numeric_reading_verification:{}});
  }
});
test('conflicting projected and full proof metadata never silently prefers either representation',()=>{
  mutate((p,r)=>{r.source_payload={numeric_reading_verification:{...p,audit_id:'other-review'}};});
  mutate((p,r)=>{r.source_payload={numeric_reading_verification:null};});
  for(const field of ['laboratory','method','reference_range','flag','source','reference_verification','method_verification']){
    mutate((p,r)=>{r[field]='projected';r.source_payload={[field]:'conflicting full-row metadata'};});
    mutate((p,r)=>{r[field]=null;r.source_payload={[field]:{status:'source_verified'}};});
  }
  const embedded=make();embedded.source_payload={numeric_reading_verification:proof(embedded)};embedded.numeric_reading_verification=null;blocked(embedded);
  for(const [field,value]of [['source_file_id','other-file'],['library_file_id','other-library'],['sha256',hash('other PDF')],
    ['pdf_sha256',hash('other PDF')],['pdf_page_count',20],['pdf_page',3]])for(const where of ['row','payload']){
    mutate((p,r)=>{if(where==='row')r[field]=value;else r.source_payload={[field]:value};});
  }
});
test('document source identities, valid page counts and every reviewed page are mandatory',()=>{
  for(const field of ['pdf_sha256','source_file_id','library_file_id','pdf_page_count','visual_review_pages'])mutate(p=>{delete p.document[field];});
  for(const value of ['x'.repeat(64),'A'.repeat(64),'1'.repeat(63),''])mutate(p=>{p.document.pdf_sha256=value;});
  for(const value of [0,-1,1.5,10001,'9',null])mutate(p=>{p.document.pdf_page_count=value;});
  for(const value of [[],[2,6],[2,8],[6,8],[2,6,8,10],[2,6,8,0],[2,6,8,2],['2',6,8]])mutate(p=>{p.document.visual_review_pages=value;});
  for(const section of ['clinical','evolution','footnote'])for(const page of [0,1,10,-1,2.5,'2',null])mutate(p=>{p[section].pdf_page=page;});
});
test('every clinical evidence field and all non-overlapping selected spans are required',()=>{
  for(const field of Object.keys(proof(make()).clinical))mutate(p=>{delete p.clinical[field];});
  for(const field of ['section','printed_analyte','numeric_token','printed_unit','collection_date','accession','evidence_text','identity_text']){
    mutate(p=>{p.clinical[field]+=' changed';});
  }
  for(const field of ['result_has_footnote_1','result_unit_confirmed_without_evolution_reference_column','pixels_inspected'])mutate(p=>{p.clinical[field]=!p.clinical[field];});
  for(const field of ['evidence_text_sha256','identity_text_sha256'])mutate(p=>{p.clinical[field]=hash('different text');});
  for(const key of ['analyte','result','unit'])for(const value of [[],[0],[-1,2],[0,99999],[1,1],[0,1.5],['0',2],null]){
    mutate(p=>{p.clinical.spans[key]=value;});
  }
  mutate(p=>{p.clinical.spans.result=p.clinical.spans.analyte;});
  // Even slices that match all three tokens cannot overlap and reuse a number
  // or label as documentary evidence for a different field.
  const row=make({biomarker:'u/L',unit:'u/L'}),c=proof(row).clinical;c.printed_analyte='u/L';c.evidence_text='u/L: 73,4';
  c.evidence_text_sha256=hash(c.evidence_text);c.spans={analyte:[0,3],unit:[0,3],result:[5,9]};blocked(row);
});
test('rehashed clinical excerpts cannot turn limits, annotations or numeric substrings into plain results',()=>{
  for(const [before,after]of [['< ',''],['≤ ',''],['>',''],['+',''],['- ',''],['aproximadamente ',''],['inferior a ',''],['até ',''],['abaixo de ',''],['acima de ',''],['cerca de ',''],['menor ou igual a ',''],['3–',''],['3 a ',''],['1',''],['','0'],['','(1)'],['',' (1)'],['','e2'],['',' a 90'],['','–90'],['',' aproximado'],['','é'],['','¹']]){
    mutate(p=>{const c=p.clinical,at=c.spans.result[0];c.evidence_text=c.evidence_text.slice(0,at)+before+c.numeric_token+after+c.evidence_text.slice(c.spans.result[1]);
      c.spans.result=c.spans.result.map(n=>n+before.length);c.spans.unit=c.spans.unit.map(n=>n+before.length+after.length);c.evidence_text_sha256=hash(c.evidence_text);});
  }
});
test('Unicode signs, censoring, footnote symbols and invisible token boundaries fail closed',()=>{
  const cases=[['−',''],['− ',''],['≦',''],['≧ ',''],['menos de ',''],['mais que ',''],['','*'],['','†'],['',' ‡'],
    ['','⁽¹⁾'],['','[1]'],['',' (nota)'],['',' / 100'],['＜ ',''],['＋ ',''],['','＊'],['','※'],['𝛁 ',''],['',' 𝛁'],['📝 ',''],['',' 📝'],
    ...['\u200b','\u200c','\u200d','\u2060','\u2066','\u2069','\ufeff','\u0000','\u0301','\ufe0f'].flatMap(char=>
      [[char,''],['<'+char,''],['< '+char+' ',''],['',char],['',char+'†'],['',' '+char+'*']])];
  for(const [before,after]of cases){
    mutate(p=>{const c=p.clinical,at=c.spans.result[0];c.evidence_text=c.evidence_text.slice(0,at)+before+c.numeric_token+after+c.evidence_text.slice(c.spans.result[1]);
      c.spans.result=c.spans.result.map(n=>n+before.length);c.spans.unit=c.spans.unit.map(n=>n+before.length+after.length);c.evidence_text_sha256=hash(c.evidence_text);});
  }
  // Document-local examples use the same strict boundary check.
  for(const before of ['−','≧ ','menos de ','<\u200b'])mutate(p=>{const g=p.locale.grouping_evidence;
    g.evidence_text=`Decimal: ${before}${g.decimal_comma_token}; inteiro: ${g.grouped_integer_token}`;g.evidence_text_sha256=hash(g.evidence_text);
  },{kind:'grouped'});
});
test('spaced annotations, scientific scales and explicit minimum or maximum qualifiers remain non-exact',()=>{
  const cases=[['',' ¹'],['',' ²'],['',' ³'],['',' ⁴'],['',' ₁'],['',' ᵃ'],['',' Ⅰ'],['',' x 10³'],['',' x10^3'],['',' X 10 ** 3'],
    ['',' x 2'],['',' vezes 10³'],['',' e2'],['',' E -2'],['',' e + 2'],['',' 10^3'],['',' 10³'],
    ['no máximo ',''],['no maximo ',''],['no mínimo ',''],['no minimo de ',''],['mínimo ',''],['máximo de ',''],['pelo menos ',''],['ao menos ',''],['menor do que ',''],['maior do que ',''],
    ['inferior a: ',''],['≤: ',''],['≧: ',''],['menos de: ',''],['less than ',''],['at most ',''],['at least ',''],['more than: ',''],
    ['',' ou menos'],['',' ou mais'],['',' ou inferior'],['',' ou superior'],['',' X 10^-3'],['',' no máximo'],['',' no mínimo'],['',' máximo'],['',' mínimo']];
  for(const [before,after]of cases){
    mutate(p=>{const c=p.clinical,at=c.spans.result[0];c.evidence_text=c.evidence_text.slice(0,at)+before+c.numeric_token+after+c.evidence_text.slice(c.spans.result[1]);
      c.spans.result=c.spans.result.map(n=>n+before.length);c.spans.unit=c.spans.unit.map(n=>n+before.length+after.length);c.evidence_text_sha256=hash(c.evidence_text);});
  }
  // The same words in an explicitly separate reference column do not qualify
  // the selected result and cannot supply or change its clinical reference.
  const row=make(),c=proof(row).clinical;
  c.evidence_text=`${c.printed_unit} | ${c.printed_analyte}: ${c.numeric_token} | Outra coluna: no máximo 90; mínimo 10; 2 x 10³`;
  c.evidence_text_sha256=hash(c.evidence_text);
  for(const[key,token]of [['analyte',c.printed_analyte],['result',c.numeric_token],['unit',c.printed_unit]]){
    const start=c.evidence_text.indexOf(token);c.spans[key]=[start,start+token.length];
  }
  assert.equal(derive(row).value,row.result_numeric);
  assert.equal(labResultReading(row).reference,row.reference_range);
});
test('evolution evidence binds the exact collection column, token, scope and source-only annotation',()=>{
  for(const field of Object.keys(proof(make()).evolution))mutate(p=>{delete p.evolution[field];});
  for(const field of ['section','printed_analyte','accession','collection_date','result_raw','evidence_text'])mutate(p=>{p.evolution[field]+=' changed';});
  for(const field of ['result_cell_only','reference_column_used_for_clinical_range','footnote_is_visually_superscript','pixels_inspected'])mutate(p=>{p.evolution[field]=!p.evolution[field];});
  mutate(p=>{p.evolution.evidence_text_sha256=hash('wrong evolution');});
  mutate(p=>{p.evolution.evidence_text+=' current reference';p.evolution.evidence_text_sha256=hash(p.evolution.evidence_text);});
});
test('the exact evolution legend cannot be replaced by a clinical NOTA(1), missing note or inferred classification',()=>{
  for(const field of Object.keys(proof(make()).footnote))mutate(p=>{delete p.footnote[field];});
  for(const field of ['token','legend','scope','meaning','evidence_text'])mutate(p=>{p.footnote[field]+=' changed';});
  mutate(p=>{p.footnote.evidence_text_sha256=hash('wrong legend');});
  mutate(p=>{p.footnote.pixels_inspected=false;});mutate(p=>{p.footnote.scope='clinical NOTA(1)';});
  mutate(p=>{p.footnote=proof(make()).footnote;},{kind:'grouped'});
  mutate(p=>{p.footnote=null;});
});
test('document-local grouping requires the exact convention and independent complete numeric tokens',()=>{
  for(const field of Object.keys(proof(make({kind:'grouped'})).locale))mutate(p=>{delete p.locale[field];},{kind:'grouped'});
  for(const [field,value]of [['decimal_separator','.'],['thousands_separator',','],['grouping_length',2],['scope','all_documents']])mutate(p=>{p.locale[field]=value;},{kind:'grouped'});
  for(const field of Object.keys(proof(make({kind:'grouped'})).locale.grouping_evidence))mutate(p=>{delete p.locale.grouping_evidence[field];},{kind:'grouped'});
  for(const [field,value]of [['kind','plausible_number'],['pdf_page',1],['pixels_inspected',false],['decimal_comma_token','8.6'],['grouped_integer_token','1.670']]){
    mutate(p=>{p.locale.grouping_evidence[field]=value;},{kind:'grouped'});
  }
  mutate(p=>{p.locale.grouping_evidence.evidence_text+=' changed';},{kind:'grouped'});
  mutate(p=>{p.locale.grouping_evidence.kind='ungrouped_clinical_confirmation';},{kind:'grouped'});
  mutate(p=>{p.locale.grouping_evidence=proof(make({kind:'grouped'})).locale.grouping_evidence;});
  for(const text of ['Decimal: 18,6; inteiro: 4.670','Decimal: 8,6; inteiro: 14.670','Decimal: <8,6; inteiro: 4.670']){
    mutate(p=>{const g=p.locale.grouping_evidence;g.evidence_text=text;g.evidence_text_sha256=hash(text);},{kind:'grouped'});
  }
});
test('only one terminal literal (1) and unsigned complete source tokens are supported',()=>{
  for(const token of ['','(1)','73(1)','(1)73','73(2)','73*','73 4','73,4 suffix','+73','-73','73e0','73.4','73.','73,','73,4,0',
    '<73','>73','<=73','>=73','≤73','≥73','~73','≈73','Inferior a 73','Superior a 73','73 a 90','73-90']){
    blocked(make({token,result_numeric:73}));
  }
  for(const token of ['0.123','01.234','1234.567','1.23','1.2345','1..234','.123','1.234,5','1,234.567','1 234','4.670(1)']){
    blocked(make({kind:'grouped',token,result_numeric:4670}));
  }
  for(const value of [NaN,Infinity,-Infinity,null,'73.4',true])blocked(make({result_numeric:value}));
  for(const token of ['9007199254740992','1234567890123456','1.234.567.890.123.456',`0,${'0'.repeat(400)}1`]){
    blocked(make({token}));
  }
  blocked(make({token:'73,4',result_numeric:73.5}));
  blocked(make({token:'73,4',result_raw:'73,4'}));
});
test('real calendar dates, exact unit spelling and unchanged identity are required',()=>{
  for(const collection_date of ['2024-02-30','2024-13-01','12/06/2024','2024-6-12','2024-06-12T00:00:00Z'])blocked(make({collection_date}));
  for(const report_date of ['2024-02-30','2024-06-12T00:00:00Z',null])blocked(make({report_date}));
  for(const unit of ['U/L',' u/L','u/L '])mutate((p,r)=>{r.unit=unit;});
  const row=make();assert.equal(derive(row).value,row.result_numeric);row.biomarker='Synthetic alias';blocked(row);
});
test('bounded UTF-8 hashes match the independent implementation and detect exact drift',()=>{
  for(const input of ['', 'abc','á β 😀\nlinha\r\n','x'.repeat(32768)])assert.equal(documentaryEvidenceSha256(input),hash(input));
  for(const section of ['clinical','evolution','footnote']){
    mutate(p=>{p[section].evidence_text=p[section].evidence_text.replaceAll(' ','\u00a0');});
    mutate(p=>{p[section].evidence_text='x'.repeat(32769);p[section].evidence_text_sha256=hash(p[section].evidence_text);});
  }
});
test('success and failure are pure with frozen input; output changes do not alter future readings',()=>{
  for(const kind of ['footnote','grouped','footnote_grouped']){
    const row=make({kind}),before=JSON.stringify(row);freeze(row);const first=derive(row);
    first.transformations.push('not saved');first.proofReference.auditId='not saved';
    assert.equal(JSON.stringify(row),before);assert.notDeepEqual(derive(row),first);
    labResultReading(row);dashboardLabs({labs:[row]},{labs:'ready'},bounds);assert.equal(JSON.stringify(row),before);
    const invalid=structuredClone(row);invalid.numeric_reading_verification.clinical.evidence_text+=' drift';const saved=JSON.stringify(invalid);freeze(invalid);blocked(invalid);assert.equal(JSON.stringify(invalid),saved);
  }
});
test('derived readings preserve every method, reference, laboratory, unit and identity comparison gate',()=>{
  const checks=[['method',null,'unknown_method'],['method','Outro método','different_method'],['reference_range',null,'different_or_missing_reference'],
    ['reference_range','0 a 50 u/L','different_or_missing_reference'],['laboratory','Outro laboratório','different_laboratory'],
    ['unit','U/L','different_unit'],['biomarker','Alias sintético','different_biomarker']];
  for(const [field,value,reason]of checks){
    const {previous,current}=pair();current[field]=value;const result=compareLabResults(current,previous);
    assert.equal(labResultReading(previous).exactValue,previous.result_numeric);assert.equal(result.comparable,false);assert.equal(result.delta,null);assert.equal(result.comparisonReason,reason);
  }
  const {previous,current}=pair({reference_range:'Grupo A: 10 a 90 u/L; Grupo B: 20 a 100 u/L'});
  const result=compareLabResults(current,previous);assert.equal(result.rangeComparable,false);assert.equal(result.label,'sem comparação');
  assert.equal(labResultReading(previous).referencePosition,'unknown');
  current.identityConflict=true;assert.equal(compareLabResults(current,previous).comparisonReason,'ambiguous_collection');
});

// All consumer imports use the existing synthetic read-only app mode.
globalThis.location={search:'?fixture=1'};
const {labGroups,labCohorts,labCohortPoints,labReferenceStatus}=await import('../src/labs-layout-v2.js');
const {laboratoryReport}=await import('../src/reports-model.js');
const {labTrend,contextChart}=await import('../src/health-context.js');
const {homeCockpitModel,renderHomeCockpit}=await import('../src/home-cockpit.js');
const status=Object.fromEntries(['body','segmental','nutrition','sourceMetrics','metrics','workouts','exercises','sets','labs','treatments','polarSessions','goals','meals','waterReferences'].map(k=>[k,'ready']));
const points=rows=>labCohortPoints(labCohorts(labGroups(rows)[0])[0]);
test('dashboard, reports, detailed points and context share the exact same documentary acceptance',()=>{
  for(const kind of ['footnote','grouped','footnote_grouped']){
    const {previous,current}=pair({kind}),rows=[previous,current],snapshot=structuredClone(rows);
    const expected=compareLabResults(current,previous),report=laboratoryReport({labs:rows},{labs:'ready'},bounds);
    assert.equal(expected.comparable,true);assert.equal(report.selected.delta,expected.delta);assert.equal(points(rows).length,2);
    const dashboard=dashboardLabs({labs:rows},{labs:'ready'},bounds);assert.equal(dashboard.items[0].delta,expected.delta);
    assert.equal(dashboard.history[0].exactValue,previous.result_numeric);
    assert.equal(labReferenceStatus(previous).status,kind==='footnote'?'within':'above');
    const trend=labTrend(rows,null,bounds);assert.equal(trend.points.length,2);
    const home=homeCockpitModel({labs:rows},status,'all',{},bounds.end);
    const panel=renderHomeCockpit(home).split('<article class="ltsCockpitPanel labs">')[1]?.split('<article class="ltsCockpitPanel water">')[0]||'';
    assert.equal((panel.match(/class="ltsContextLine"/g)||[]).length,1);
    assert.ok(panel.includes(previous.result_raw));
    assert.deepEqual(rows,snapshot);
    proof(previous).clinical.evidence_text+=' drift';
    assert.equal(labResultReading(previous).exactValue,null);assert.equal(points(rows).length,1);
    assert.equal(laboratoryReport({labs:rows},{labs:'ready'},bounds).selected.delta,null);
    assert.equal(dashboardLabs({labs:rows},{labs:'ready'},bounds).items[0].delta,null);
  }
});
test('newly readable values never connect incompatible or ambiguous consumer curves',()=>{
  for(const patch of [{method:null},{method:'Different method'},{reference_range:null},{reference_range:'0 a 60 u/L'},
    {laboratory:'Different laboratory'},{unit:'U/L'},{identityConflict:true}]){
    const {previous,current}=pair();Object.assign(current,patch);const rows=[previous,current];
    assert.equal(laboratoryReport({labs:rows},{labs:'ready'},bounds).selected.delta,null);
    assert.equal((contextChart(labTrend(rows,null,bounds).points,{selectable:false}).match(/class="ltsContextLine"/g)||[]).length,0);
    const html=renderHomeCockpit(homeCockpitModel({labs:rows},status,'all',{},bounds.end));
    const panel=html.split('<article class="ltsCockpitPanel labs">')[1]?.split('<article class="ltsCockpitPanel water">')[0]||'';
    assert.equal((panel.match(/class="ltsContextLine"/g)||[]).length,0);
  }
});
test('an ambiguous collection exposes separate proofs without choosing one aggregate derived value',()=>{
  const rows=[make({id:'first'}),make({id:'second',token:'74,4'})];
  const item=dashboardLabs({labs:rows},{labs:'ready'},bounds).items[0];
  assert.equal(item.ambiguous,true);assert.equal(item.exactValue,null);assert.equal(item.delta,null);
  assert.equal(Object.hasOwn(item,'documentaryNumericReading'),false);
  assert.equal(item.observations.length,2);
  assert.deepEqual(item.observations.map(row=>row.documentaryNumericReading.value).sort(),[73.4,74.4]);
});
test('the loader projects only required identity and new review, never the full private payload',()=>{
  const source=readFileSync(new URL('../src/data-layer.js',import.meta.url),'utf8');
  const line=source.split('\n').find(line=>line.includes("labs:()=>fetchAll('health_lab_results'"));
  assert.ok(line.includes("'id,source_record_id,"));assert.ok(line.includes('numeric_reading_verification:source_payload->numeric_reading_verification'));
  assert.ok(line.includes('reference_verification:source_payload->reference_verification'));assert.doesNotMatch(line,/'\*'|,source_payload,/);
});
test('presence detection fails closed for malformed explicit proof but leaves absent legacy proof alone',()=>{
  for(const value of [null,undefined])assert.equal(hasDocumentaryNumericProof({numeric_reading_verification:value}),false);
  for(const value of [false,'',{},0])assert.equal(hasDocumentaryNumericProof({numeric_reading_verification:value}),true);
  assert.equal(hasDocumentaryNumericProof({source_payload:{numeric_reading_verification:{}}}),true);
  assert.equal(hasDocumentaryNumericProof(null),false);assert.equal(derive(null),null);
});
console.log(`Documentary numeric reading: ${count} synthetic groups passed.`);

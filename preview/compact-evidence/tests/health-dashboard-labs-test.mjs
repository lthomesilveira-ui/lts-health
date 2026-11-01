import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dashboardLabs} from '../src/health-dashboard-labs.js';
import {reviewedHemogramFootnoteValue} from '../src/health-lab-reviewed-numeric.js';
import {makeReviewedBloodCountPair,syntheticSha256} from './reviewed-blood-count-fixture.mjs';

// Entirely synthetic. No patient values, database snapshots, dates, or documents.
const bounds={start:'2025-04-01',end:'2025-04-30'};
const row=(id,date,value,extra={})=>({source_record_id:`synthetic-${id}`,collection_date:date,biomarker:'Marcador A',
  laboratory:'Laboratório sintético',unit:'mg/L',method:'Método sintético',result_numeric:value,result_raw:String(value),reference_range:'2 a 8',...extra});
const model=(rows,status='ready')=>dashboardLabs({labs:rows},{labs:status},bounds);
const one=extra=>model([row('a','2025-04-20',9,extra)]).items[0];
let count=0;const test=(name,run)=>{run();count++;console.log(`ok ${count} - ${name}`);};

test('four old approaches cannot become a direction in the latest collection',()=>{
  const rows=[];
  for(let i=0;i<4;i++)rows.push(row(`old-a-${i}`,'2023-02-01',12,{biomarker:`Histórico ${i}`}),row(`old-b-${i}`,'2024-03-01',9,{biomarker:`Histórico ${i}`}));
  rows.push(row('latest','2025-04-20',5,{biomarker:'Atual'}));
  const m=model(rows);assert.equal(m.items.filter(r=>r.label==='aproximou da referência').length,4);
  assert.equal(m.latestCollectionDate,'2025-04-20');assert.equal(m.latestCollectionSummary.near,0);assert.equal(m.latestCollectionSummary.away,0);
  assert.equal(m.latestCollectionSummary.attention,0);assert.equal(m.latestCollectionSummary.within,1);assert.equal(m.latestCollectionCount,1);
  assert.equal(m.collectionCountAll,3);assert.equal(m.historicalCollectionCount,2);assert.equal(m.knownCount,9);
  assert.equal(m.latestCollectionItems.length,1);assert.equal(m.latestCollectionRows.length,1);assert.equal(m.allItems,m.items);
});

test('latest collection is explicit even outside the chosen recent window',()=>{
  const m=model([row('old','2025-02-20',4),row('later','2025-03-20',5),row('future','2025-05-01',6)]);
  assert.equal(m.count,0);assert.equal(m.latestCollectionDate,'2025-03-20');assert.equal(m.latestCollectionCount,1);
  assert.equal(m.latestCollectionItems[0].inPeriod,false);assert.equal(m.collectionCountAll,2);assert.equal(m.latestCollectionSummary.comparable,1);
});

test('current reference position stays independent from a blocked comparison',()=>{
  const m=model([row('prior','2025-03-20',4,{method:null}),row('latest','2025-04-20',9)]),item=m.items[0];
  assert.equal(item.comparable,false);assert.equal(item.label,'sem comparação');assert.equal(item.referencePosition,'above');
  assert.match(item.currentReferenceLabel,/Acima da faixa transcrita no laudo/);assert.match(item.comparisonReasonLabel,/Método não informado na coleta anterior/);
  assert.equal(m.latestCollectionSummary.attention,1);assert.equal(m.latestCollectionSummary.above,1);
});

test('one explicitly scoped range preserves qualification and never chooses among populations',()=>{
  for(const scope of ['Homens','Mulheres','Adultos','Masculino','Sexo feminino','Maiores de 21 anos','30 a 45 anos']){
    const item=one({reference_range:`${scope}: 2 a 8 mg/L`});assert.equal(item.referencePosition,'above');
    assert.equal(item.referenceScope,scope);assert.ok(item.currentReferenceLabel.endsWith(scope));
  }
  for(const reference of ['Homens: 2 a 8; Mulheres: 1 a 6','Adultos: 2 a 8; idosos: 3 a 9','30 a 45 anos: 2 a 8; 46 a 60 anos: 3 a 9']){
    const item=one({reference_range:reference});assert.equal(item.referencePosition,'unknown');assert.equal(item.currentReferenceLabel,null);
  }
});

test('scope is part of interval identity and cannot silently change between collections',()=>{
  const m=model([row('a','2025-03-20',3,{reference_range:'Homens: 2 a 8'}),row('b','2025-04-20',4,{reference_range:'Mulheres: 2 a 8'})]);
  assert.equal(m.items[0].comparable,false);assert.equal(m.items[0].comparisonReason,'different_or_missing_reference');
});

test('only the exact dilution footnote can follow a single interval',()=>{
  const safe=one({reference_range:'Homens: 2 a 8 mg/L; resultado confirmado após diluição'});assert.equal(safe.referencePosition,'above');
  for(const tail of ['; alvo abaixo de 5','; idosos: 4 a 10','; repetir se > 9','; referência alterada em 01/01/2025']){
    assert.equal(one({reference_range:`Homens: 2 a 8 mg/L; resultado confirmado após diluição${tail}`}).referencePosition,'unknown');
  }
});

test('a percent unit without a space is exact and unit mismatches stay rejected',()=>{
  assert.equal(one({unit:'%',reference_range:'2,0 a 8,0%'}).referencePosition,'above');
  assert.equal(one({unit:'mg/L',reference_range:'2,0 a 8,0%'}).referencePosition,'unknown');
  assert.equal(one({unit:'%',reference_range:'2,0 a 8,0%; desejável abaixo de 5%'}).referencePosition,'unknown');
});

test('explicit textual inequalities preserve inclusive and exclusive endpoints',()=>{
  for(const [reference,value,position]of [['Inferior a 8 mg/L',8,'above'],['Superior a 2 mg/L',2,'below'],['Até 8 mg/L',8,'within'],['Maior ou igual a 2 mg/L',2,'within'],['Menor ou igual a 8 mg/L',8,'within']]){
    assert.equal(one({result_numeric:value,result_raw:String(value),reference_range:reference}).referencePosition,position);
  }
  assert.equal(one({reference_range:'Normal: maior que 3; limítrofe 2 a 3'}).referencePosition,'unknown');
});

test('grouped whole counts require exact extraction, count units and numeric agreement',()=>{
  const base={result_numeric:12345,result_raw:'12.345',unit:'/mm3',reference_range:'4000 a 10000'};
  assert.equal(one(base).referencePosition,'unknown');
  assert.equal(one({...base,numeric_kind:'exact'}).referencePosition,'above');
  assert.equal(one({...base,source_payload:{numeric_kind:'exact'}}).referencePosition,'above');
  for(const extra of [{numeric_kind:'censored'},{numeric_kind:'exact',result_numeric:12.345},{numeric_kind:'exact',unit:'mg/L'},
    {numeric_kind:'exact',result_raw:'<12.345'},{numeric_kind:'exact',result_raw:'12.345(1)'},{numeric_kind:'exact',result_raw:'12,345'}]){
    assert.equal(one({...base,...extra}).exactValue,null);
  }
});

test('non-exact extraction metadata vetoes plain or absent raw numeric values',()=>{
  for(const kind of ['censored','lower_bound','upper_bound','text','unknown'])for(const raw of ['9',null])for(const metadata of [{numeric_kind:kind},{source_payload:{numeric_kind:kind}}]){
    const m=model([row('prior','2025-03-20',12),row('latest','2025-04-20',9,{result_raw:raw,...metadata})]),item=m.items[0];
    assert.equal(item.value,9);assert.equal(item.rawValue,raw);assert.equal(item.exactValue,null);assert.equal(item.referencePosition,'unknown');
    assert.equal(item.comparable,false);assert.equal(item.delta,null);assert.equal(item.comparisonReason,'non_exact_value');
    assert.equal(m.latestCollectionSummary.above,0);assert.equal(m.latestCollectionSummary.near,0);
  }
  assert.equal(one({numeric_kind:'exact'}).exactValue,9);
  assert.equal(one({numeric_kind:'exact',result_raw:'< 9'}).exactValue,null);
});

test('placeholder references never establish a matching report reference',()=>{
  for(const reference of ['Não informado','unknown','—','N/A']){
    const item=model([row('prior','2025-03-20',12,{reference_range:reference}),row('latest','2025-04-20',9,{reference_range:reference})]).items[0];
    assert.equal(item.reference,reference);assert.equal(item.previous.reference,reference);assert.equal(item.sameReference,false);
    assert.equal(item.comparable,false);assert.equal(item.delta,null);assert.equal(item.comparisonReason,'different_or_missing_reference');
    assert.equal(item.comparisonReasonLabel,'Referências não informadas nas duas coletas.');
  }
});

test('unverified duplicate identity in the prior collection is reported as ambiguity',()=>{
  const prior=row('prior','2025-03-20',12,{source_record_id:null});
  const item=model([prior,{...prior},row('latest','2025-04-20',9)]).items[0];
  assert.equal(item.previous,null);assert.equal(item.comparable,false);assert.equal(item.delta,null);
  assert.equal(item.comparisonReason,'ambiguous_collection');assert.match(item.comparisonReasonLabel,/múltiplos resultados/);
  assert.deepEqual(item.ambiguousDates,['2025-03-20']);assert.equal(item.ambiguous,false);
});

test('reference limits, missing historical methods and result footnotes are not guessed',()=>{
  const m=model([row('prior','2025-03-20',4,{reference_range:null}),row('latest','2025-04-20',9)]);
  assert.equal(m.items[0].comparable,false);assert.match(m.items[0].comparisonReasonLabel,/Referência não informada na coleta anterior/);
  assert.equal(one({result_raw:'9(1)'}).exactValue,null);
  assert.equal(one({result_raw:'Inferior a 9',numeric_kind:'exact'}).exactValue,null);
});

test('summary keeps positions, printed flags and ambiguity transparent',()=>{
  const m=model([row('a','2025-04-20',5),row('b','2025-04-20',null,{biomarker:'B',result_raw:'Ausente',reference_range:null,flag:'H'}),
    row('c','2025-04-20',10,{biomarker:'C'}),row('c','2025-04-20',12,{biomarker:'C'})]);
  assert.equal(m.latestCollectionCount,4);assert.equal(m.latestCollectionSummary.count,3);assert.equal(m.latestCollectionSummary.results,4);
  assert.equal(m.latestCollectionSummary.within,1);assert.equal(m.latestCollectionSummary.unclassified,2);assert.equal(m.latestCollectionSummary.reportedFlags,1);
  assert.equal(m.latestCollectionSummary.attention,2);assert.equal(m.latestCollectionSummary.ambiguous,1);
  const c=m.items.find(r=>r.biomarker==='C');assert.equal(c.currentReferenceLabel,null);assert.match(c.comparisonReasonLabel,/múltiplos resultados/);
});

test('empty and unavailable newest-collection totals remain different',()=>{
  const empty=model([]);assert.equal(empty.latestCollectionCount,0);assert.equal(empty.collectionCountAll,0);assert.equal(empty.historicalCollectionCount,0);
  for(const state of ['error','unavailable','loading']){
    const failed=model([row('stale','2025-04-20',4)],state);assert.equal(failed.latestCollectionCount,null);assert.equal(failed.latestCollectionSummary.count,null);
    assert.equal(failed.collectionCountAll,null);assert.equal(failed.historicalCollectionCount,null);assert.equal(failed.latestCollectionDate,null);
  }
});

test('laboratories, units, text results and all older observations stay separately readable',()=>{
  const rows=[row('a','2025-03-20',3),row('b','2025-04-20',4,{laboratory:'Laboratório B'}),row('c','2025-04-20',5,{unit:'g/L'}),
    row('d','2025-04-20',null,{biomarker:'Texto',result_raw:'Não detectado'})];
  const before=JSON.stringify(rows),m=model(rows);assert.equal(m.items.length,4);assert.equal(m.history.length,4);assert.equal(m.latestCollectionCount,3);
  assert.ok(m.items.every(i=>i.comparisonReason==='no_previous'));assert.equal(JSON.stringify(rows),before);assert.deepEqual(model(rows),m);
});

const proof=row=>row.reference_verification;
const rehash=row=>{proof(row).evidence_text_sha256=syntheticSha256(proof(row).evidence_text);};
const rejectReview=(change,marker='Hemoglobina')=>{
  const {previous,current}=makeReviewedBloodCountPair(marker);change(previous,current);
  const before=structuredClone(previous);
  assert.equal(reviewedHemogramFootnoteValue(previous),null);
  assert.deepEqual(previous,before,'review rejection does not mutate input');
  const item=model([previous,current]).items.find(item=>item.sourceRecordId===current.source_record_id);
  assert.equal(item?.comparable,false,'rejected proof cannot establish a comparison');
};

test('reviewed Hb/Ht interpretation preserves raw, numeric, method and reference fields',()=>{
  for(const marker of ['Hemoglobina','Hematócrito']){
    const {previous,current}=makeReviewedBloodCountPair(marker),rows=[previous,current],before=structuredClone(rows);
    const item=model(rows).items[0];
    assert.equal(reviewedHemogramFootnoteValue(previous),previous.result_numeric);
    assert.equal(item.comparable,true);assert.equal(item.comparisonReason,'comparable');
    assert.equal(item.delta,Number((current.result_numeric-previous.result_numeric).toPrecision(12)));
    assert.equal(item.previous.rawValue,previous.result_raw);assert.ok(item.previous.rawValue.endsWith('(1)'));
    assert.equal(item.rawValue,current.result_raw);assert.equal(item.previous.value,previous.result_numeric);
    assert.equal(item.previous.exactValue,previous.result_numeric);assert.equal(item.previous.method,previous.method);
    assert.equal(item.previous.reference,previous.reference_range);assert.equal(item.previous.unit,previous.unit);
    assert.equal(item.label,'afastou da referência');assert.equal(item.previous.referencePosition,'above');
    assert.deepEqual(rows,before);assert.deepEqual(model(rows),model(rows));
  }
});

test('production loader projects only the documentary review in addition to numeric kind',()=>{
  const source=readFileSync(new URL('../src/data-layer.js',import.meta.url),'utf8');
  assert.match(source,/labs:\(\)=>fetchLaboratoryRows\(\)/,'the laboratory loader delegates to the verified reader');
  const select=source.match(/fetchAll\('health_lab_results','([^']+)'/)[1].split(',');
  assert.ok(select.includes('numeric_kind:source_payload->>numeric_kind'));
  assert.ok(select.includes('reference_verification:source_payload->reference_verification'));
  assert.ok(!select.includes('source_payload'));assert.ok(!select.includes('*'));
  const {previous}=makeReviewedBloodCountPair();assert.equal(previous.source_payload,undefined);
  assert.equal(reviewedHemogramFootnoteValue(previous),previous.result_numeric);
});

test('full-row audit and exact loader projection give identical interpretations',()=>{
  const {previous,current}=makeReviewedBloodCountPair();
  const full=structuredClone(previous);full.source_payload={reference_verification:full.reference_verification,numeric_kind:full.numeric_kind,
    library_file_id:full.reference_verification.library_file_id,pdf_page:full.reference_verification.pdf_page};
  delete full.reference_verification;delete full.numeric_kind;
  assert.deepEqual(model([full,current]),model([previous,current]));
  assert.equal(reviewedHemogramFootnoteValue(full),previous.result_numeric);
});

for(const [name,change]of [
  ['missing review',r=>{delete r.reference_verification;}],
  ['null review',r=>{r.reference_verification=null;}],
  ['status alone',r=>{r.reference_verification={status:'source_verified'};}],
  ['unverified review',r=>{proof(r).status='unverified';}],
  ['absent audit',r=>{delete proof(r).audit_id;}],
  ['placeholder audit',r=>{proof(r).audit_id='unknown';}],
  ['different source section',r=>{proof(r).source_section='evolutionary_table';}],
  ['different source file',r=>{proof(r).source_file='unrelated-synthetic.pdf';}],
  ['missing source on both sides',r=>{delete r.source_file;delete proof(r).source_file;}],
  ['missing source record identity',r=>{delete r.source_record_id;}],
  ['empty source record identity',r=>{r.source_record_id=' ';}],
  ['missing PDF digest',r=>{delete proof(r).pdf_sha256;}],
  ['malformed PDF digest',r=>{proof(r).pdf_sha256='not-a-document-digest';}],
  ['missing file identity',r=>{delete proof(r).source_file_id;}],
  ['missing library identity',r=>{delete proof(r).library_file_id;}],
  ['source payload disagrees on document',r=>{r.source_payload={sha256:syntheticSha256('a different synthetic document')};}],
  ['source payload disagrees on library file',r=>{r.source_payload={library_file_id:'another-synthetic-library-file'};}],
  ['source payload disagrees on source file',r=>{r.source_payload={source_file_id:'another-synthetic-file'};}],
  ['source payload disagrees on result page',r=>{r.source_payload={pdf_page:3};}],
  ['two conflicting reviews',r=>{r.source_payload={reference_verification:{...proof(r),audit_id:'different-synthetic-audit'}};}],
  ['explicit null projection cannot fall back',r=>{r.source_payload={reference_verification:proof(r)};r.reference_verification=null;}],
  ['raw preservation not asserted',r=>{proof(r).result_raw_preserved=false;}],
  ['numeric preservation not asserted',r=>{proof(r).result_numeric_preserved='true';}],
  ['missing footnote',r=>{delete proof(r).evolution_footnote;}],
  ['other legend',r=>{proof(r).evolution_footnote.legend='Synthetic clinical note.';}],
  ['other footnote meaning',r=>{proof(r).evolution_footnote.meaning='A numeric digit or a censoring limit.';}],
  ['missing footnote meaning',r=>{delete proof(r).evolution_footnote.meaning;}],
  ['unbound raw string',r=>{proof(r).evolution_footnote.raw_result_string_preserved='18,3(1)';}],
  ['missing page count',r=>{delete proof(r).pdf_page_count;}],
  ['unreviewed result page',r=>{proof(r).visual_review_pages=[1];}],
  ['unreviewed table page',r=>{proof(r).evolution_footnote.visual_review_pages=[10];}],
  ['unreviewed legend page',r=>{proof(r).evolution_footnote.visual_review_pages=[7];}],
  ['out-of-document legend page',r=>{proof(r).evolution_footnote.legend_page=99;proof(r).evolution_footnote.visual_review_pages=[7,99];}],
  ['zero result page',r=>{proof(r).pdf_page=0;proof(r).visual_review_pages=[0];}],
  ['fractional table page',r=>{proof(r).evolution_footnote.table_page=7.5;proof(r).evolution_footnote.visual_review_pages=[7.5,10];}],
  ['malformed review pages',r=>{proof(r).visual_review_pages='2';}],
  ['unknown footnote pages',r=>{proof(r).evolution_footnote.visual_review_pages=null;}],
  ['mismatched collection metadata',r=>{proof(r).collection_date='2025-03-21';}],
  ['row and metadata date disagree with printed date',r=>{r.collection_date=proof(r).collection_date='2025-03-21';}],
  ['date missing on both sides',r=>{delete r.collection_date;delete proof(r).collection_date;}],
  ['invalid calendar date',r=>{r.collection_date=proof(r).collection_date='2025-02-30';}],
  ['date includes a time',r=>{r.collection_date=proof(r).collection_date+='T12:00:00Z';}],
  ['mismatched unit',r=>{proof(r).reference_unit='%';}],
  ['mismatched reference',r=>{proof(r).reference_text='12,1 a 15,8';}],
  ['reference missing on both sides',r=>{delete r.reference_range;delete proof(r).reference_text;}],
  ['numeric value disagrees',r=>{r.result_numeric=18.5;}],
  ['raw and preserved raw disagree with printed numeral',r=>{r.result_raw=proof(r).evolution_footnote.raw_result_string_preserved='18,5(1)';r.result_numeric=18.5;}],
  ['missing evidence digest',r=>{delete proof(r).evidence_text_sha256;}],
  ['incorrect evidence digest',r=>{proof(r).evidence_text_sha256=syntheticSha256('unrelated synthetic excerpt');}],
  ['excerpt drift without rehash',r=>{proof(r).evidence_text+=' ';}],
  ['no evidence',r=>{proof(r).evidence_text='';rehash(r);}],
  ['oversized evidence',r=>{proof(r).evidence_text+='x'.repeat(32769);rehash(r);}]
])test(`documentary Hb/Ht gate rejects ${name}`,()=>rejectReview(change));

for(const [name,transform]of [
  ['wrong analyte',s=>s.replace('HEMOGLOBINA :','HEMATÓCRITO :')],
  ['analyte alias',s=>s.replace('HEMOGLOBINA :','HB :')],
  ['different result',s=>s.replace('18,4 g/dL','18,5 g/dL')],
  ['numeric substring',s=>s.replace('18,4 g/dL','118,4 g/dL')],
  ['different decimal spelling',s=>s.replace('18,4 g/dL','18.4 g/dL')],
  ['censored printed result',s=>s.replace('18,4 g/dL','<18,4 g/dL')],
  ['unverified suffix in current result section',s=>s.replace('18,4 g/dL','18,4(1) g/dL')],
  ['wrong printed unit',s=>s.replace('g/dL','g/L')],
  ['wrong printed reference',s=>s.replace('12,1 a 15,9','12,1 a 15,8')],
  ['wrong printed collection',s=>s.replace('20/03/2025','21/03/2025')],
  ['missing printed date',s=>s.split('\n').slice(0,-1).join('\n')],
  ['duplicate collection line',s=>s+'\nRECEBIDO/COLETADO EM: 21/03/2025'],
  ['repeated analyte result',s=>s+'\nHEMOGLOBINA : 18,4 g/dL 12,1 a 15,9'],
  ['narrative rather than result line',s=>s.replace('HEMOGLOBINA :','OBSERVAÇÃO HEMOGLOBINA :')],
  ['reference number mistaken for a result',s=>s.replace('HEMOGLOBINA : 18,4 g/dL 12,1 a 15,9','HEMOGLOBINA : ausente g/dL 12,1 a 18,4')]
])test(`matching excerpt hash does not bypass ${name}`,()=>rejectReview(r=>{proof(r).evidence_text=transform(proof(r).evidence_text);rehash(r);}));

test('SHA-256 matches independent Node UTF-8 digests across block boundaries and Unicode',()=>{
  for(let length=0;length<140;length++)for(const marker of ['Hemoglobina','Hematócrito']){
    const {previous}=makeReviewedBloodCountPair(marker);
    proof(previous).evidence_text='Cabeçalho sintético 漢字 🧪 '+'.'.repeat(length)+'\n'+proof(previous).evidence_text.replaceAll(' : ','\u00a0:\u00a0');
    rehash(previous);assert.equal(reviewedHemogramFootnoteValue(previous),previous.result_numeric,`UTF-8 padding length ${length}`);
  }
  const {previous}=makeReviewedBloodCountPair();proof(previous).evidence_text=proof(previous).evidence_text.replaceAll('\n','\r\n');rehash(previous);
  assert.equal(reviewedHemogramFootnoteValue(previous),previous.result_numeric);
});

test('the gate is limited to exact Hb/Ht names and their original units',()=>{
  for(const biomarker of ['Hb','Ht','Hematocrito','Hemoglobin','Hemoglobina glicada','Hemácias','Leucócitos','Plaquetas','Marcador A']){
    rejectReview(r=>{r.biomarker=biomarker;proof(r).evidence_text=proof(r).evidence_text.replace('HEMOGLOBINA :',`${biomarker.toUpperCase()} :`);rehash(r);});
  }
  rejectReview(r=>{r.unit=proof(r).reference_unit='g/L';proof(r).evidence_text=proof(r).evidence_text.replace('g/dL','g/L');rehash(r);});
  rejectReview(r=>{r.unit=proof(r).reference_unit='L/L';proof(r).evidence_text=proof(r).evidence_text.replace('%','L/L');rehash(r);},'Hematócrito');
});

test('swapping Hb and Ht documentary reviews cannot classify either observation',()=>{
  const hb=makeReviewedBloodCountPair(),ht=makeReviewedBloodCountPair('Hematócrito');
  [hb.previous.reference_verification,ht.previous.reference_verification]=[ht.previous.reference_verification,hb.previous.reference_verification];
  assert.equal(reviewedHemogramFootnoteValue(hb.previous),null);assert.equal(reviewedHemogramFootnoteValue(ht.previous),null);
  assert.equal(model([hb.previous,hb.current,ht.previous,ht.current]).latestCollectionSummary.comparable,0);
});

test('no reviewed footnote can create an absent, textual, boolean or non-finite number',()=>{
  for(const value of [undefined,null,'',false,true,'18.4',NaN,Infinity,-Infinity])rejectReview(r=>{r.result_numeric=value;});
});

test('censoring, other suffixes and unsupported numeric formats stay blocked',()=>{
  for(const raw of ['<18,4(1)','>18,4(1)','≤18,4(1)','≥18,4(1)','Inferior a 18,4(1)','18,4(2)','18,4[1]',
    '18,4(1)(1)','18,4 (1)','18,4( 1 )','18,4(1) g/dL','18,4*','18,4(1)\n','1.840(1)','1,840(1)','18e0(1)']){
    rejectReview(r=>{r.result_raw=proof(r).evolution_footnote.raw_result_string_preserved=raw;});
  }
});

test('both numeric-kind declarations independently veto a documentary derivation',()=>{
  for(const kind of ['censored','lower_bound','upper_bound','text','unknown','not_exact',false,{}]){
    rejectReview(r=>{r.numeric_kind=kind;r.source_payload={numeric_kind:'exact'};});
    rejectReview(r=>{r.numeric_kind='exact';r.source_payload={numeric_kind:kind};});
  }
  for(const declarations of [{},{numeric_kind:'exact'},{source_payload:{numeric_kind:'exact'}},{numeric_kind:'exact',source_payload:{numeric_kind:'exact'}}]){
    const {previous}=makeReviewedBloodCountPair();Object.assign(previous,declarations);
    assert.equal(reviewedHemogramFootnoteValue(previous),previous.result_numeric);
  }
});

test('documentary agreement never bypasses conservative numeric precision',()=>{
  for(const stem of ['9007199254740993','9007199254740992','18,4000000000000009','1.234','1,234','1.234.567','0,'+'0'.repeat(340)+'1']){
    rejectReview(r=>{r.result_raw=proof(r).evolution_footnote.raw_result_string_preserved=`${stem}(1)`;r.result_numeric=Number(stem.replace(',','.'));
      proof(r).evidence_text=proof(r).evidence_text.replace('18,4 g/dL',`${stem} g/dL`);rehash(r);});
  }
});

test('recognizing a footnote does not infer matching methods, references or laboratories',()=>{
  for(const [change,reason]of [
    [(p,c)=>{p.method=null;},'unknown_method'],[(p,c)=>{c.method='Outro método sintético';},'different_method'],
    [(p,c)=>{c.reference_range='12,1 a 16,0';},'different_or_missing_reference'],
    [(p,c)=>{c.reference_range=null;},'different_or_missing_reference'],
    [(p,c)=>{p.laboratory=c.laboratory=null;},'unknown_laboratory']]){
    const {previous,current}=makeReviewedBloodCountPair();change(previous,current);const item=model([previous,current]).items[0];
    assert.equal(item.previous.exactValue,previous.result_numeric);assert.equal(item.comparable,false);assert.equal(item.delta,null);assert.equal(item.comparisonReason,reason);
  }
  const {previous,current}=makeReviewedBloodCountPair(),conflicting={...previous,result_raw:'18,5(1)',result_numeric:18.5};
  const item=model([previous,conflicting,current]).items[0];assert.equal(item.comparisonReason,'ambiguous_collection');assert.equal(item.delta,null);
});

test('a synthetic ten-comparison baseline gains exactly the two reviewed Hb/Ht pairs',()=>{
  const rows=[];
  for(let i=0;i<10;i++)rows.push(row(`ordinary-prior-${i}`,'2025-03-20',4,{biomarker:`Ordinary ${i}`}),row(`ordinary-current-${i}`,'2025-04-20',5,{biomarker:`Ordinary ${i}`}));
  for(const marker of ['Hemoglobina','Hematócrito']){const {previous,current}=makeReviewedBloodCountPair(marker);rows.push(previous,current);}
  for(let i=0;i<17;i++)rows.push(row(`blocked-prior-${i}`,'2025-03-20',4,{biomarker:`Blocked ${i}`,result_raw:'4(1)'}),row(`blocked-current-${i}`,'2025-04-20',5,{biomarker:`Blocked ${i}`}));
  const baseline=rows.map(row=>({...row,reference_verification:null})),before=model(baseline),after=model(rows);
  assert.equal(before.latestCollectionSummary.comparable,10);assert.equal(after.latestCollectionSummary.comparable,12);
  const changed=after.items.filter(item=>item.comparable&&!before.items.find(prior=>prior.key===item.key).comparable).map(item=>item.biomarker).sort();
  assert.deepEqual(changed,['Hematócrito','Hemoglobina']);
  assert.deepEqual(after.history.map(item=>item.rawValue),before.history.map(item=>item.rawValue));
  assert.equal(after.items.filter(item=>item.comparisonReason==='non_exact_value').length,17);
});

console.log(`Health dashboard labs: ${count} synthetic checks passed.`);

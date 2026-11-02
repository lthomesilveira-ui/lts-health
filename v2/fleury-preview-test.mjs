import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {laboratoryNumber,parseFleuryLayout,positionedPageLayout,readFleuryPdf,FLEURY_LIMITS} from '../supabase/functions/_shared/fleury-lab-preview.mjs';
import {fleuryPreviewModel,renderFleuryPreview,isConfirmedFleuryUpload} from './src/fleury-preview.js';

// Invented report text only. The independent full original-file audit stays private.
const assay=(raw='83',date='03/02/2001',unit='mg/dL',heading='GLICOSE, soro')=>`${heading}\nMétodo: exemplo inventado\nRESULTADO                        VALORES DE REFERÊNCIA\n${raw} ${unit}                    70 a 99\nNOTA(1): Não é dado real.\nRECEBIDO/COLETADO EM: ${date} - LIBERADO EM: ${date}\nAssinatura digital avançada: invented\nImpresso em: 04/02/2001`;
for(const [raw,style,expected]of [['1,25','comma',1.25],['12.345','grouped_count',12345],['52.4','dot',52.4],['inferior a 0,5','comma',null],['<0,5','comma',null],['1e3','comma',null],['1.234,5','comma',null],['1,25 mg/dL','comma',null]])assert.equal(laboratoryNumber(raw,style),expected);
assert.throws(()=>laboratoryNumber('1','unknown'),/unknown_decimal_style/);
const exact=parseFleuryLayout(assay());
assert.equal(exact.results.length,1);assert.deepEqual([exact.results[0].result_raw,exact.results[0].result_numeric,exact.results[0].unit,exact.results[0].collection_date,exact.results[0].pdf_page],['83',83,'mg/dL','2001-02-03',1]);
for(const qualifier of ['inferior a 0,5','superior a 500','<0,5','>=500']){const r=parseFleuryLayout(assay(qualifier)).results[0];assert.equal(r.result_raw,qualifier);assert.equal(r.result_numeric,null);}
assert.equal(parseFleuryLayout(assay('83','31/02/2001')).rows.length,0);
assert.equal(parseFleuryLayout(assay('83','03/02/2001','unidade desconhecida')).rows.length,0);
assert.equal(parseFleuryLayout(assay('83','03/02/2001','mg/dL','ENSAIO DESCONHECIDO')).unsupported_blocks.length,1);
assert.equal(parseFleuryLayout(assay().replace('83 mg/dL','                    83 mg/dL')).rows.length,0,'reference column must not become a result');
assert.equal(parseFleuryLayout('LAUDO EVOLUTIVO\n'+assay()).rows.length,0);
const copies=parseFleuryLayout(assay()+'\f'+assay());
assert.equal(copies.rows.length,2);assert.equal(copies.results.length,1);assert.deepEqual(copies.results[0].source_pages,[1,2]);
const conflict=parseFleuryLayout(assay()+'\f'+assay('84'));
assert.equal(conflict.results.length,0);assert.equal(conflict.conflicts.length,1);
const hyphen=assay('0,8','03/02/2001','mg/dL','NÃOHDLCOLESTEROL, soro');
assert.equal(parseFleuryLayout(hyphen).results[0].biomarker,'Colesterol não-HDL');
assert.throws(()=>positionedPageLayout([{str:'hidden\u202e83',x:14,y:20,width:60,dir:'ltr'}]),/unsupported_text_direction/);
assert.throws(()=>positionedPageLayout([{str:'83',x:Infinity,y:20,width:60}]),/invalid_pdf_text_item/);
assert.throws(()=>parseFleuryLayout('x'.repeat(FLEURY_LIMITS.text+1)),/pdf_text_limit/);
let calls=0;await assert.rejects(()=>readFleuryPdf(new Uint8Array(FLEURY_LIMITS.bytes+1),()=>{calls++}),/pdf_size_limit/);assert.equal(calls,0);
await assert.rejects(()=>readFleuryPdf(new TextEncoder().encode('wrong'),()=>{calls++}),/invalid_pdf_header/);assert.equal(calls,0);
let destroyed=false;
await assert.rejects(()=>readFleuryPdf(new TextEncoder().encode('%PDF-invented'),async()=>({numPages:65,destroy:async()=>{destroyed=true;}})),/pdf_page_limit/);assert.equal(destroyed,true);
const preservedBytes=new TextEncoder().encode('%PDF-invented');
await readFleuryPdf(preservedBytes,async data=>{
  structuredClone(data,{transfer:[data.buffer]});
  return{numPages:1,destroy:async()=>{},getPage:async()=>({getViewport:()=>({width:595,height:842}),getTextContent:async()=>({items:[{str:assay(),transform:[1,0,0,1,14,700],width:50,dir:'ltr'}]}),cleanup(){}})};
});
assert.equal(preservedBytes.byteLength,13,'PDF worker transfer must not detach caller original bytes');
const lab={kind:'fleury_lab_preview_v1',read_only:true,results:copies.results,source_verified:false,history_available:false,unsupported_count:0,conflicts:[]};
const preview={upload_id:'invented',lab_preview:lab};
assert.equal(fleuryPreviewModel(preview).complete,false);
assert.match(renderFleuryPreview(preview),/ainda não foram incluídos nas análises/);
lab.source_verified=true;lab.history_available=true;lab.results[0].already_in_history=true;
assert.equal(fleuryPreviewModel(preview).complete,true);
assert.match(renderFleuryPreview(preview),/Nenhum exame foi duplicado ou alterado/);
assert.match(renderFleuryPreview(preview),/tabindex="0"/);
lab.source_sha256='1'.repeat(64);
const confirmedUpload={id:'invented',source_type:'fleury',status:'review_required'};
const confirmedPreview={...structuredClone(preview),source_type:'fleury',status:'inspected',row_count:lab.results.length};
assert.equal(isConfirmedFleuryUpload(confirmedUpload,confirmedPreview),true);
const beforeConfirmation=JSON.stringify([confirmedUpload,confirmedPreview]);
for(const change of [
  p=>{p.upload_id='another-upload';},p=>{p.source_type='einstein';},p=>{p.status='failed';},
  p=>{p.row_count++;},p=>{p.lab_preview.read_only=false;},p=>{p.lab_preview.source_verified=false;},
  p=>{p.lab_preview.history_available=false;},p=>{p.lab_preview.source_sha256='not-a-hash';},
  p=>{p.lab_preview.results[0].already_in_history=false;},p=>{p.lab_preview.results=[];p.row_count=0;},
  p=>{p.lab_preview.conflicts=[{reason:'source_conflict'}];},p=>{p.lab_preview.unsupported_count=1;},
  p=>{delete p.lab_preview.unsupported_count;},p=>{delete p.lab_preview.conflicts;}
]){const altered=structuredClone(confirmedPreview);change(altered);assert.equal(isConfirmedFleuryUpload(confirmedUpload,altered),false);}
for(const status of ['uploaded','processing','rejected','failed'])assert.equal(isConfirmedFleuryUpload({...confirmedUpload,status},confirmedPreview),false);
assert.equal(isConfirmedFleuryUpload({...confirmedUpload,source_type:'einstein'},confirmedPreview),false);
assert.equal(isConfirmedFleuryUpload(confirmedUpload,null),false);
assert.equal(JSON.stringify([confirmedUpload,confirmedPreview]),beforeConfirmation,'confirmation changes no upload, preview or clinical value');
const original={original_pdf_status:'ready',original_pdf:{schema_version:1,status:'source_verified',library_file_id:'libfile_'+'1'.repeat(32),source_sha256:'1'.repeat(64),page:1,page_count:2}};
assert.match(renderFleuryPreview(preview,undefined,[original]),/Abrir laudo original/);
assert.match(renderFleuryPreview(preview,undefined,[original]),/referrerpolicy="no-referrer"/);
assert.ok(!renderFleuryPreview(preview,undefined,[{...original,original_pdf:{...original.original_pdf,source_sha256:'2'.repeat(64)}}]).includes('Abrir laudo original'));
assert.ok(!renderFleuryPreview(preview,undefined,[{...original,original_pdf_status:'error'}]).includes('Abrir laudo original'));
lab.results[0].biomarker='<img src=x onerror=alert(1)>';
assert.ok(!renderFleuryPreview(preview).includes('<img'));
assert.match(renderFleuryPreview(preview),/&lt;img/);
assert.equal(fleuryPreviewModel({lab_preview:{...lab,results:new Array(501).fill(lab.results[0])}}),null);
const wrapper=await readFile('supabase/functions/_shared/fleury-upload-preview.ts','utf8');
assert.ok(!/\.insert\(|\.upsert\(|\.update\(|SERVICE_ROLE|console\./.test(wrapper),'specialized reader must not write canonical data, elevate permissions or log source text');
const loader=await readFile('v2/src/data-layer.js','utf8');
assert.ok(loader.includes('lab_preview:sample->lab_preview'));
assert.ok(!/previews:[^\n]*,sample[,']/.test(loader),'generic ingestion samples must not be loaded');
console.log('Fleury preview: numeric/qualifier, date, column, copies, bounds, cleanup, read-only and private projection checks passed.');

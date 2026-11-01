// Deterministic reading of the independently validated Fleury text layout.
// Preview only: this module has no database client or canonical write path.
export const FLEURY_PREVIEW_VERSION = 'fleury-positioned-preview-v1';
export const FLEURY_LIMITS = Object.freeze({ bytes: 8 * 1024 * 1024, pages: 64, items: 60000, rows: 500, text: 1200000 });
const fold = value => String(value).replace(/\u00ad/g, '-').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const compact = value => fold(value).replace(/\s+/g, ' ').trim();
// PDF.js omits discretionary hyphens. Only assay/column names use this key;
// result strings, signs, qualifiers and units are never passed through it.
const labelKey = value => compact(value).replace(/-/g, '');
const escapeRE = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SIMPLE = {
  "TGO (AST)": "TRANSAMINASE GLUTAMICO-OXALACETICA",
  "TGP (ALT)": "TRANSAMINASE GLUTAMICO-PIRUVICA",
  "TSH": "HORMONIO TIROESTIMULANTE",
  "Ureia": "UREIA,",
  "Ferritina": "FERRITINA,",
  "25-OH Vitamina D Total": "25 HIDROXI-VITAMINA D",
  "Ácido fólico": "ACIDO FOLICO,",
  "T4 Livre": "TIROXINA (T4) LIVRE",
  "Vitamina B-12": "VITAMINA B-12,",
  "Cortisol": "CORTISOL,",
  "Ferro": "FERRO,",
  "Gama-GT": "GAMA GLUTAMIL",
  "Fosfatase Alcalina": "FOSFATASE ALCALINA",
  "Testosterona Total": "TESTOSTERONA,",
  "Testosterona livre": "TESTOSTERONA LIVRE,",
  "SHBG": "GLOBULINA LIGADORA DE HORMONIOS SEXUAIS(SHBG)",
  "LH": "HORMONIO LUTEINIZANTE",
  "FSH": "HORMONIO FOLICULO ESTIMULANTE",
  "Prolactina": "PROLACTINA",
  "Insulina": "INSULINA,",
  "Glicose": "GLICOSE,",
  "Zinco (ICP/MS)": "ZINCO,",
  "Magnésio": "MAGNESIO,",
  "Ácido Úrico": "ACIDO URICO,",
  "Fibrinogênio": "FIBRINOGENIO,",
  "Proteína C Reativa": "PROTEINA C-REATIVA,",
  "Homocisteína": "HOMOCISTEINA,",
  "Apolipoproteína A1": "APOLIPOPROTEINA A-1",
  "Apolipoproteína B": "APOLIPOPROTEINA B,",
  "LDL-Colesterol": "LDL-COLESTEROL",
  "Colesterol Total": "COLESTEROL TOTAL",
  "HDL-Colesterol": "HDL-COLESTEROL",
  "Triglicérides": "TRIGLICERIDES",
  "VLDL-Colesterol": "VLDL-COLESTEROL",
  "Colesterol não-HDL": "NAO-HDL-COLESTEROL",
  "Albumina": "ALBUMINA,",
  "Proteína Total": "PROTEINA TOTAL,",
  "Anti-tireoglobulina": "ANTICORPOS ANTITIROGLOBULINA",
  "Anti-TPO": "ANTICORPOS ANTI-PEROXIDASE TIROIDIANA",
  "IGF-1": "IGF-1, SOMATOMEDINA",
  "Frutosamina": "FRUTOSAMINA,",
  "Creatinoquinase (CK)": "CREATINOQUINASE TOTAL",
  "Estradiol": "ESTRADIOL,",
  "Tempo de Protrombina": "TEMPO DE PROTROMBINA,",
  "Dihidrotestosterona": "DIHIDROTESTOSTERONA",
  "IGFBP-3": "IGFBP-3 (",
  "Estrona": "ESTRONA (E1)",
  "Androstenediona": "ANDROSTENEDIONA,",
  "Dímeros D": "DIMEROS D,",
  "PTH": "PARATORMONIO (PTH)",
  "T3 livre": "TRIIODOTIRONINA (T3) LIVRE",
  "G6PD": "GLICOSE-6-FOSFATO DESIDROGENASE",
  "Sódio": "SODIO,",
  "Cobre": "COBRE,",
  "Cálcio": "CALCIO,",
  "Cálcio Ionizado": "CALCIO IONIZADO",
  "Ácido ascorbico, plasma": "ACIDO ASCORBICO,",
  "Vitamina A (retinol), soro": "VITAMINA A (retinol)",
  "Progesterona": "PROGESTERONA,",
  "Hemoglobina Glicada (A1C)": "HEMOGLOBINA GLICADA (A1C)"
};
const UNITS = ["U/g hemoglobina", "ng/mL FEU", "microgramas/mL", "microgramas/dL", "micromol/L", "microg/dL", "microg/L", "milhões/mm3", "segundos", "mmol/L", "nmol/L", "pmol/L", "mcg/dL", "mg/dL", "ng/dL", "ng/mL", "pg/mL", "mUI/L", "mEq/L", "UI/mL", "U/mL", "UI/L", "mU/L", "ng/L", "mg/L", "g/dL", "U/L", "fL", "pg", "%", "mm"];

export function laboratoryNumber(raw, style = 'comma') {
  const patterns = { comma: /^[+-]?\d+(?:,\d+)?$/, dot: /^[+-]?\d+(?:\.\d+)?$/, grouped_count: /^(?:\d{1,3}(?:\.\d{3})+|\d+)$/ };
  if (!patterns[style]) throw new Error('unknown_decimal_style');
  const text = String(raw).trim();
  if (!patterns[style].test(text)) return null;
  const value = Number(style === 'grouped_count' ? text.replace(/\./g, '') : text.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}
const result = (raw, unit, style = 'comma', basis = 'result') => ({ result_raw: raw, result_numeric: laboratoryNumber(raw, style), unit, decimal_style: style, unit_basis: basis });
function isoDate(raw) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (!match) return null;
  const date = `${match[3]}-${match[2]}-${match[1]}`, parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === date ? date : null;
}

export function positionedPageLayout(items) {
  const lines = [];
  for (const item of [...items].sort((a,b) => b.y-a.y || a.x-b.x)) {
    if (typeof item.str !== 'string' || item.str.length > 4000 || ![item.x,item.y,item.width].every(Number.isFinite) || Math.abs(item.x)>10000 || Math.abs(item.y)>10000 || item.width<0 || item.width>10000) throw new Error('invalid_pdf_text_item');
    if (!item.str.trim()) continue;
    if (/[\u202a-\u202e\u2066-\u2069]/.test(item.str) || (item.dir && item.dir !== 'ltr')) throw new Error('unsupported_text_direction');
    let line = lines.find(row => Math.abs(row.y-item.y)<=1);
    if (!line) { line={y:item.y,items:[]}; lines.push(line); }
    line.items.push(item);
  }
  return lines.sort((a,b)=>b.y-a.y).map(line => {
    let text='', lastEnd=0;
    for (const item of line.items.sort((a,b)=>a.x-b.x)) {
      const spaces = text ? Math.max(0,Math.round((item.x-lastEnd)/5.4)) : Math.max(0,Math.round((item.x-14)/5.4));
      text += ' '.repeat(spaces)+item.str.replace(/\u00a0/g,' ');
      lastEnd=item.x+item.width;
    }
    return text;
  }).join('\n');
}

function blocksFromLayout(text) {
  const blocks=[];
  text.split('\f').forEach((page,index)=>{
    let prior=0;
    for (const receipt of page.matchAll(/^\s*RECEBIDO\/COLETADO EM:\s*(\d{2}\/\d{2}\/\d{4})[^\n]*/gm)) {
      let body=page.slice(prior,receipt.index); prior=receipt.index+receipt[0].length;
      body=body.split(/Assinatura digital avançada:[^\n]*\n/).at(-1).replace(/^(?:Cliente:|Data de Nascimento:|Médico:)[^\n]*\n/gm,'');
      if (body.includes('LAUDO EVOLUTIVO') || !body.includes('RESULTADO')) continue;
      const heading=labelKey(body.split(/Método:|RESULTADO|VALORES DE REFER/,1)[0]);
      body=body.split(/\bNOTA(?:\(|:|\s+\d)|RESULTADOS ANTERIORES:/,1)[0];
      const collection_date=isoDate(receipt[1]);
      if (collection_date) blocks.push({heading,body,pdf_page:index+1,collection_date});
    }
  });
  return blocks;
}
function labeled(block,label,unit,style='comma',basis='result') {
  const found=[];
  for(const line of block.body.split('\n')) {
    const colon=line.indexOf(':');
    if (colon<0 || labelKey(line.slice(0,colon))!==labelKey(label).replace(/[ :]+$/,'')) continue;
    const tail=line.slice(colon+1).trim(), match=/^([+-]?\d+(?:[.,]\d+)?)/.exec(tail);
    if (!match) continue;
    if (unit!=='índice') {
      if (basis==='table_header' ? !/g\/dL\s+%/.test(block.body) : !tail.slice(match[0].length).trimStart().startsWith(unit)) continue;
    }
    found.push(result(match[1],unit,style,basis));
  }
  return found;
}

export function parseFleuryLayout(text) {
  if (typeof text!=='string' || text.length>FLEURY_LIMITS.text) throw new Error('pdf_text_limit');
  const pages=text.split('\f');
  if (!pages.length || pages.length>FLEURY_LIMITS.pages) throw new Error('pdf_page_limit');
  const rows=[], unsupported_blocks=[];
  const document_print_dates=[...new Set([...text.matchAll(/Impresso em:\s*(\d{2}\/\d{2}\/\d{4})/g)].map(m=>isoDate(m[1])).filter(Boolean))].sort();
  const measure=new RegExp('^\\s{0,15}((?:inferior a\\s+|superior a\\s+|[<>]=?\\s*)?[+-]?\\d+(?:[.,]\\d+)?)\\s+('+UNITS.map(escapeRE).join('|')+')(?=\\s|$)','i');
  const emit=(block,name,values)=>values.forEach(value=>rows.push({biomarker:name,collection_date:block.collection_date,pdf_page:block.pdf_page,...value}));
  for (const block of blocksFromLayout(text)) {
    const {heading,body}=block, before=rows.length;
    for (const [name,title] of Object.entries(SIMPLE)) if (heading.startsWith(labelKey(title))) {
      const match=body.split('\n').map(line=>measure.exec(line)).find(Boolean);
      if (match) emit(block,name,[result(match[1],match[2])]);
    }
    if (heading.startsWith('hemograma')) {
      const cbc={'Eritrócitos':['ERITRÓCITOS','milhões/mm3'],'Hemoglobina':['HEMOGLOBINA :','g/dL'],'Hematócrito':['HEMATÓCRITO','%'],'HCM':['HEMOGLOBINA CORPUSCULAR MÉDIA','pg'],'VCM':['VOLUME CORPUSCULAR MÉDIO','fL'],'CHCM':['CORPUSCULAR MÉDIA:','g/dL'],'RDW':['VOLUME ERITROCITÁRIO (RDW)','%'],'Plaquetas':['TOTAL DE PLAQUETAS','/mm3'],'Volume Médio Plaquetário':['VOLUME PLAQUETÁRIO MÉDIO','fL']};
      for (const [name,[label,unit]] of Object.entries(cbc)) emit(block,name,labeled(block,label,unit,unit==='/mm3'?'grouped_count':'comma'));
      for (const line of body.split('\n')) {
        if (compact(line).startsWith('leucocitos')) { const m=/^\s*LEUCÓCITOS\s+(\d[\d.]*)/i.exec(line); if(m)emit(block,'Leucócitos',[result(m[1],'/mm3','grouped_count','table_header')]); }
        for (const cell of ['Neutrófilos','Eosinófilos','Basófilos','Linfócitos','Monócitos']) if (compact(line).startsWith(fold(cell)) && line.includes(':')) {
          const m=/^\s*(\d+(?:,\d+)?)\s+(\d[\d.]*)\s/.exec(line.slice(line.indexOf(':')+1));
          if(m&&body.includes('/mm3')&&body.includes('%')) {emit(block,cell+' (%)',[result(m[1],'%','comma','table_header')]);emit(block,cell,[result(m[2],'/mm3','grouped_count','table_header')]);}
        }
      }
    }
    if (heading.startsWith('eletroforese das proteinas') && /g\/dL\s+%/.test(body)) {
      const names={'ALBUMINA':'Albumina (eletroforese)','ALFA-1 GLOBULINAS':'Alfa-1 globulina','ALFA-2 GLOBULINAS':'Alfa-2 globulina','BETA-1 GLOBULINAS':'Beta-1 globulina','BETA-2 GLOBULINAS':'Beta-2 globulina','GAMA GLOBULINAS':'Gama globulina'};
      for(const line of body.split('\n')) for(const [label,name] of Object.entries(names)) if (labelKey(line).startsWith(labelKey(label))&&line.includes(':')) {
        const m=/^\s*(\d+,\d+)\s+\(\s*(\d+\.\d+)\)/.exec(line.slice(line.indexOf(':')+1));
        if(m){emit(block,name,[result(m[1],'g/dL','comma','table_header')]);emit(block,label==='ALBUMINA'?'Albumina (eletroforese, %)':name+' (%)',[result(m[2],'%','dot','table_header')]);}
      }
      emit(block,'Proteína Total (eletroforese)',labeled(block,'TOTAL','g/dL','comma','table_header'));
      emit(block,'Relação Albumina/Globulina (eletroforese)',labeled(block,'RELAÇÃO ALBUMINA/GLOBULINA','índice','comma','dimensionless_calculation'));
    }
    const composites={
      'saturacao da transferrina':[['Ferro','Ferro','mcg/dL'],['Capacidade Total de Ligação do Ferro','Ligação do ferro, capacidade total','mcg/dL'],['Saturação Transferrina','Saturação da Transferrina','%']],
      'bilirrubinas':[['Bilirrubina direta','DIRETA','mg/dL'],['Bilirrubina indireta','INDIRETA','mg/dL'],['Bilirrubina total','TOTAL','mg/dL']],
      'proteina total e fracoes':[['Proteína Total','PROTEINA TOTAL','g/dL'],['Albumina','ALBUMINA','g/dL'],['Globulinas','GLOBULINAS','g/dL'],['Relação Albumina/Globulina','ALBUMINA/GLOBULINAS','índice']],
      'tempo de tromboplastina parcial ativada':[['Tempo de Tromboplastina Parcial Ativada','RESULTADO','segundos'],['Relação TTPA paciente/normal','RELACAO PACIENTE/NORMAL','índice']],
      'tempo de protrombina':[['INR','INR','índice']], 'insulina,':[['HOMA-IR','Cálculo do HOMA-IR','índice']], 'apolipoproteina b,':[['Relação ApoB/ApoA1','Razão Apo B / Apo A1','índice']],
      'hemossedimentacao':[['VHS (1ª hora)','PRIMEIRA HORA','mm']], 'antigeno prostatico especifico':[['PSA Total','PSA Total','ng/mL'],['PSA Livre','PSA Livre','ng/mL'],['Relação PSA Livre/Total','Relacao PSA livre/PSA total','índice']]
    };
    for (const [prefix,cells] of Object.entries(composites)) if (heading.startsWith(labelKey(prefix))) for(const [name,label,unit]of cells)emit(block,name,labeled(block,label,unit,'comma',unit==='índice'?'dimensionless_calculation':'result'));
    if(heading.startsWith('hemoglobina glicada')) {const m=/de\s+(\d+)\s+mg\/dL\./.exec(body);if(m)emit(block,'Glicemia Média Estimada',[result(m[1],'mg/dL','comma','reported_calculation')]);}
    const qualitative={'antigeno e do virus da hepatite b':['Hepatite B - HBeAg',null],'sifilis, anticorpos':['Sífilis - VDRL',null],'hepatite b, anticorpo contra antigeno de superficie':['Hepatite B - Anti-HBs','UI/L'],'anticorpos anti-virus da hepatite c':['Sorologia HCV',null]};
    for(const [prefix,[name,unit]]of Object.entries(qualitative))if(heading.startsWith(labelKey(prefix))){
      const matches=body.split('\n').filter(line=>/^\s{0,15}não reagente/i.test(line)).map(line=>line.trim().split('  ')[0]);
      if(matches.length!==1)continue;let raw=matches[0];
      if(name==='Sorologia HCV'){const m=/^\s*Índice:\s*(\d+,\d+)/m.exec(body);if(!m)continue;raw+='; índice '+m[1];}
      if(unit&&!body.includes(unit))continue;
      emit(block,name,[result(raw,unit,'comma',unit?'assay_reference':'qualitative')]);
    }
    if(rows.length===before)unsupported_blocks.push({pdf_page:block.pdf_page,reason:'unsupported_layout'});
    if(rows.length>FLEURY_LIMITS.rows)throw new Error('pdf_result_limit');
  }
  const groups=new Map();
  for(const row of rows){const key=JSON.stringify([row.biomarker,row.collection_date]);const group=groups.get(key)||[];group.push(row);groups.set(key,group);}
  const results=[],conflicts=[];
  for(const group of groups.values()){
    const signatures=new Set(group.map(r=>JSON.stringify([r.result_numeric??compact(r.result_raw),r.result_numeric===null,r.unit])));
    if(signatures.size!==1){conflicts.push({biomarker:group[0].biomarker,collection_date:group[0].collection_date,reason:'conflicting_source_copies'});continue;}
    results.push({...group[0],source_pages:[...new Set(group.map(r=>r.pdf_page))].sort((a,b)=>a-b)});
  }
  return {kind:'fleury_lab_preview_v1',read_only:true,page_count:pages.length,rows,results,unsupported_blocks,conflicts,document_print_dates};
}

export async function readFleuryPdf(bytes, getDocumentProxy) {
  if (!(bytes instanceof Uint8Array)||!bytes.byteLength||bytes.byteLength>FLEURY_LIMITS.bytes)throw new Error('pdf_size_limit');
  if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('invalid_pdf_header');
  let pdf;
  try {
    // PDF.js may transfer and detach its input buffer. Keep the caller's
    // original bytes available for independent hashing and preservation checks.
    pdf=await getDocumentProxy(bytes.slice(),{isEvalSupported:false,disableFontFace:true,useSystemFonts:true,maxImageSize:16777216,verbosity:0});
    if(pdf.numPages<1||pdf.numPages>FLEURY_LIMITS.pages)throw new Error('pdf_page_limit');
    const pages=[],started=performance.now();let itemCount=0,textSize=0;
    for(let n=1;n<=pdf.numPages;n++){
      const page=await pdf.getPage(n);
      try{
        const view=page.getViewport({scale:1});
        if(Math.abs(view.width-595)>5||Math.abs(view.height-842)>5)throw new Error('unsupported_pdf_page_layout');
        const text=await page.getTextContent({disableNormalization:true});
        itemCount+=text.items.length;if(itemCount>FLEURY_LIMITS.items)throw new Error('pdf_text_item_limit');
        const layout=positionedPageLayout(text.items.filter(i=>'str'in i).map(i=>({str:i.str,x:i.transform[4],y:i.transform[5],width:i.width,dir:i.dir})));
        textSize+=layout.length;if(textSize>FLEURY_LIMITS.text)throw new Error('pdf_text_limit');
        pages.push(layout);
        if(performance.now()-started>1600)throw new Error('pdf_processing_limit');
      }finally{page.cleanup();}
    }
    const layout=pages.join('\f');
    // The validated reports have a raster logo, so a missing text URL does
    // not identify another provider. Require the characteristic report layout;
    // the caller's selected source remains a declaration, not identity proof.
    if(!/RECEBIDO\/COLETADO EM:/.test(layout)||!/Assinatura digital avançada:/.test(layout)||!/Impresso em:/.test(layout))throw new Error('unrecognized_laboratory_layout');
    const parsed=parseFleuryLayout(layout);
    if(!parsed.results.length)throw new Error('no_supported_laboratory_results');
    return parsed;
  } finally {if(pdf)await pdf.destroy();}
}

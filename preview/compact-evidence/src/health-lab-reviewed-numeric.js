// Narrow, read-only interpretation of an already audited Hb/Ht result.
// Trust boundary: the authenticated data source owns the documentary review.
// SHA-256 detects drift in its exact UTF-8 excerpt; it is not a signature or
// proof of who reviewed it. The PDF digest is an identity, not a client-side
// verification of PDF bytes. Never create a review from these checks.
const compact=value=>typeof value==='string'?value.trim().replace(/\s+/g,' '):'';
const present=value=>Boolean(compact(value)&&!['unknown','null','none','n/a','—','-'].includes(compact(value).toLowerCase()));
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const page=(value,total)=>Number.isSafeInteger(value)&&value>0&&value<=total;
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const decimalPattern='[+-]?(?:\\d+(?:[.,]\\d+)?|[.,]\\d+)';

// Synchronous SHA-256 keeps the existing pure dashboard model synchronous.
// Only bounded, already-loaded review excerpts reach this function. All
// arithmetic below uses SHA-256's unsigned 32-bit words, not patient numbers.
function sha256(input){
  const bytes=new TextEncoder().encode(input),length=bytes.length;
  const buffer=new Uint8Array(Math.ceil((length+9)/64)*64);
  buffer.set(bytes);buffer[length]=0x80;
  const view=new DataView(buffer.buffer);view.setUint32(buffer.length-4,length*8);
  const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const rotate=(word,bits)=>(word>>>bits)|(word<<(32-bits)),w=new Uint32Array(64);
  for(let offset=0;offset<buffer.length;offset+=64){
    for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4);
    for(let i=16;i<64;i++){
      const x=w[i-15],y=w[i-2],s0=rotate(x,7)^rotate(x,18)^(x>>>3),s1=rotate(y,17)^rotate(y,19)^(y>>>10);
      w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;
    }
    let[a,b,c,d,e,f,g,hh]=h;
    for(let i=0;i<64;i++){
      const s1=rotate(e,6)^rotate(e,11)^rotate(e,25),ch=(e&f)^(~e&g);
      const t1=(hh+s1+ch+k[i]+w[i])>>>0,s0=rotate(a,2)^rotate(a,13)^rotate(a,22),maj=(a&b)^(a&c)^(b&c),t2=(s0+maj)>>>0;
      hh=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    [a,b,c,d,e,f,g,hh].forEach((word,i)=>{h[i]=(h[i]+word)>>>0;});
  }
  return h.map(word=>word.toString(16).padStart(8,'0')).join('');
}

export function reviewedHemogramFootnoteValue(row){
  const unit=row?.biomarker==='Hemoglobina'?'g/dL':row?.biomarker==='Hematócrito'?'%':null;
  if(!unit||row.unit!==unit||typeof row.result_numeric!=='number'||!Number.isFinite(row.result_numeric))return null;
  // Check both declarations independently: an exact projection cannot mask a
  // censored or otherwise non-exact kind recorded in the original payload.
  if([row.numeric_kind,row.source_payload?.numeric_kind].some(kind=>kind!=null&&kind!==''&&compact(kind).toLowerCase()!=='exact'))return null;
  if(!present(row.source_record_id)||!present(row.source_file)||!present(row.reference_range))return null;
  const raw=row.result_raw,match=typeof raw==='string'?raw.match(new RegExp(`^(${decimalPattern})\\(1\\)$`)):null;
  if(!match)return null;
  const stem=match[1],value=Number(stem.replace(',','.'));
  const digits=stem.replace(/[+.,-]/g,'').replace(/^0+/,'');
  if(/^[+-]?[1-9]\d{0,2}[.,]\d{3}$/.test(stem)||digits.length>15||!Number.isFinite(value)||
    (Number.isInteger(value)&&!Number.isSafeInteger(value))||(value===0&&/[1-9]/.test(stem))||value!==row.result_numeric)return null;
  // The loader projects only this review, never the full source payload.
  // Full-row support is retained for a read-only audit/replay of stored data.
  const proof=Object.hasOwn(row,'reference_verification')?row.reference_verification:row.source_payload?.reference_verification,footnote=proof?.evolution_footnote;
  if(row.reference_verification&&row.source_payload?.reference_verification&&
    JSON.stringify(row.reference_verification)!==JSON.stringify(row.source_payload.reference_verification))return null;
  if(!proof||proof.status!=='source_verified'||!present(proof.audit_id)||proof.source_section!=='current_report_result_section'||
    proof.source_file!==row.source_file||proof.collection_date!==row.collection_date||proof.reference_unit!==unit||
    proof.reference_text!==row.reference_range||proof.result_raw_preserved!==true||proof.result_numeric_preserved!==true)return null;
  if(!digest(proof.pdf_sha256)||!digest(proof.evidence_text_sha256)||!present(proof.source_file_id)||!present(proof.library_file_id))return null;
  // If the source payload also carries these document identities, they must
  // agree. Their absence is not filled by copying identifiers from elsewhere.
  for(const[key,proofKey]of [['library_file_id','library_file_id'],['source_file_id','source_file_id'],['sha256','pdf_sha256'],['pdf_page','pdf_page']]){
    if(row.source_payload?.[key]!=null&&row.source_payload[key]!==proof[proofKey])return null;
  }
  const total=proof.pdf_page_count,reviewed=proof.visual_review_pages,footnotePages=footnote?.visual_review_pages;
  if(!Number.isSafeInteger(total)||total<1||!page(proof.pdf_page,total)||!Array.isArray(reviewed)||
    !reviewed.every(value=>page(value,total))||!reviewed.includes(proof.pdf_page))return null;
  if(!footnote||footnote.legend!=='Resultado fora da faixa de referência.'||
    footnote.meaning!=='The superscript (1) belongs to the evolutionary table; it is not a decimal digit or a censoring limit.'||
    footnote.raw_result_string_preserved!==raw||!page(footnote.table_page,total)||!page(footnote.legend_page,total)||
    !Array.isArray(footnotePages)||!footnotePages.every(value=>page(value,total))||
    !footnotePages.includes(footnote.table_page)||!footnotePages.includes(footnote.legend_page))return null;
  const date=row.collection_date;
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
  const parsed=new Date(`${date}T12:00:00Z`);
  if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)return null;
  const evidence=proof.evidence_text;
  if(typeof evidence!=='string'||!evidence.length||evidence.length>32768||sha256(evidence)!==proof.evidence_text_sha256)return null;
  const lines=evidence.split(/\r?\n/).map(compact),marker=row.biomarker.toUpperCase();
  const markerLines=lines.filter(line=>line.toUpperCase().startsWith(marker));
  const resultLine=new RegExp(`^${escape(marker)}\\s*:\\s*${escape(stem)}\\s+${escape(unit)}\\s+${escape(compact(proof.reference_text))}$`,'i');
  if(markerLines.length!==1||!resultLine.test(markerLines[0]))return null;
  const dateLines=lines.filter(line=>/^RECEBIDO\/COLETADO EM:/i.test(line));
  const printedDate=date.split('-').reverse().join('/');
  if(dateLines.length!==1||dateLines[0].toUpperCase()!==`RECEBIDO/COLETADO EM: ${printedDate}`)return null;
  return value;
}

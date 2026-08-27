(function(){
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
  const ensure=(id,parent,before=null)=>{let e=q(id);if(e)return e;e=document.createElement('div');e.id=id;if(before)parent.insertBefore(e,before);else parent.appendChild(e);return e};
  function install(){
    const today=q('today');
    const bodyStrip=ensure('v16BodyStrip',today,q('v14Quick')||q('v13Freshness')||q('v12Coverage')||today?.querySelector('.hero'));bodyStrip.className='v16BodyStrip';
    const evolution=q('evolution');
    const chart=ensure('v16BodyChart',evolution,q('v12BodyCompare')||q('evolutionLens')||evolution?.querySelector('.grid2'));chart.className='v16Panel';
    const insights=q('insights');
    const evidence=ensure('v16Evidence',insights,q('v15Analysis')||q('v11CrossDomain')||q('insightGrid'));evidence.className='v16Panel';
  }
  function metric(label,value,unit,date){return `<div class="v16BodyStat"><span>${esc(label)}</span><strong>${value==null?'—':`${fmtNum(value,1)}${unit?` ${esc(unit)}`:''}`}</strong><small>${date?`medição ${fmtDate(date)}`:'sem dado registrado'}</small></div>`}
  function renderBodyStrip(){
    const b=[...(state.body||[])].sort((a,c)=>String(c.measured_at).localeCompare(String(a.measured_at))),last=b[0];
    q('v16BodyStrip').innerHTML=[
      metric('Peso',n(last?.weight_kg),'kg',last?.measured_at),
      metric('Massa muscular',n(last?.skeletal_muscle_mass_kg),'kg',last?.measured_at),
      metric('Gordura registrada',n(last?.body_fat_pct),'%',last?.measured_at),
      metric('Visceral',n(last?.visceral_fat_level),'nív.',last?.measured_at),
      metric('Score InBody',n(last?.score),'',last?.measured_at)
    ].join('');
  }
  function lineChart(){
    const rows=[...(state.body||[])].filter(x=>x.measured_at).sort((a,b)=>String(a.measured_at).localeCompare(String(b.measured_at)));
    const series=[
      {key:'weight_kg',cls:'weight'},
      {key:'skeletal_muscle_mass_kg',cls:'muscle'},
      {key:'fat_mass_kg',cls:'fat'}
    ];
    const all=[];for(const r of rows)for(const s of series){const v=n(r[s.key]);if(v!=null)all.push(v)}
    if(rows.length<2||all.length<2)return '<div class="v13Empty">Poucos pontos para o gráfico combinado.</div>';
    const min=Math.min(...all),max=Math.max(...all),span=max-min||1,w=840,h=230,padX=24,padY=18;
    const x=i=>padX+(rows.length===1?0:i*(w-padX*2)/(rows.length-1));
    const y=v=>padY+(max-v)*(h-padY*2)/span;
    const paths=series.map(s=>{
      const pts=rows.map((r,i)=>({i,v:n(r[s.key]),date:r.measured_at})).filter(p=>p.v!=null);
      if(pts.length<2)return'';
      const d=pts.map((p,j)=>`${j?'L':'M'}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
      const dots=pts.filter((_,j)=>j===0||j===pts.length-1||j%Math.max(1,Math.floor(pts.length/10))===0).map(p=>`<circle class="${s.cls}" cx="${x(p.i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="2.7"><title>${fmtDate(p.date)} · ${fmtNum(p.v,1)} kg</title></circle>`).join('');
      return `<path class="${s.cls}" d="${d}"/>${dots}`;
    }).join('');
    return `<div class="v16ChartBox"><svg class="v16Chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Peso, massa muscular e gordura em kg ao longo do tempo"><path class="grid" d="M${padX} ${h/3} H${w-padX} M${padX} ${2*h/3} H${w-padX}"/>${paths}</svg><div class="v16Axis"><span>${fmtDate(rows[0].measured_at)}</span><span>escala conjunta em kg · ${fmtNum(min,1)} a ${fmtNum(max,1)}</span><span>${fmtDate(rows.at(-1).measured_at)}</span></div></div>`;
  }
  function renderBodyChart(){
    q('v16BodyChart').innerHTML=`<div class="v16Head"><div><b>Peso · massa muscular · gordura (kg)</b><small>Visualização conjunta das três séries registradas, como leitura longitudinal. Valores ausentes não são interpolados.</small></div><div class="v16Legend"><span><i class="weight"></i>Peso</span><span><i class="muscle"></i>Massa muscular</span><span><i class="fat"></i>Gordura</span></div></div>${lineChart()}<div class="v16EvidenceNote">As três curvas usam a mesma unidade (kg), mas refletem medições de bioimpedância sujeitas ao contexto de cada coleta. O gráfico é descritivo.</div>`;
  }
  function renderEvidence(){
    q('v16Evidence').innerHTML=`<div class="v16Head"><div><b>Como o LTS Health transforma dados em informação</b><small>A interface mantém explícita a fronteira entre evidência, cálculo e interpretação.</small></div></div><div class="v16Evidence"><div class="v16EvidenceCard"><em>1</em><b>Fonte bruta</b><small>Arquivo, registro manual ou serviço conectado é preservado com origem e data.</small></div><div class="v16EvidenceCard"><em>2</em><b>Normalização</b><small>Campos reconhecidos entram no modelo estruturado sem completar o que não existe.</small></div><div class="v16EvidenceCard"><em>3</em><b>Cálculo</b><small>Deltas, médias e agregações são operações determinísticas sobre dados observados.</small></div><div class="v16EvidenceCard"><em>4</em><b>Insight</b><small>Interpretações só aparecem quando há evidência suficiente e sempre mantêm limitações visíveis.</small></div></div><div class="v16EvidenceNote">Esse fluxo é a base para futuras correlações entre treino, nutrição, composição, exames, atividade e sono sem transformar ausência de dados em certeza artificial.</div>`;
  }
  function renderV16(){renderBodyStrip();renderBodyChart();renderEvidence();const f=document.querySelector('.footer');if(f)f.textContent='LTS Health · v16 · Claude-parity body cockpit + provenance pipeline · dedicated GitHub / Supabase'}
  install();
  const prior=loadAll;
  loadAll=async function(){await prior();renderV16()};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(renderV16,1800)});
})();

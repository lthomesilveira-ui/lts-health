import {sb,state,fixtureMode,CONFIG,esc,fmtDate} from './core.js';
let owner=null,pending=null,setupKey=null,keyExpires=0,reveal=false;
const endpoint=`${CONFIG.url}/functions/v1/health-auto-export-receive`;
const header='x-lts-health-key';
async function invoke(action){
  if(fixtureMode)return {configured:false,received:false,endpoint_url:endpoint,header_name:header};
  const {data,error}=await sb.functions.invoke('health-auto-export-connection',{body:{action,key_revision:state.autoExportConnection?.key_revision||null}});
  if(error||data?.error)throw Error('unavailable');return data;
}
export function resetAutoExportConnection(){state.autoExportConnection=null;owner=null;pending=null;setupKey=null;keyExpires=0;reveal=false;}
export async function checkAutoExportConnection(){
  const user=state.session?.user?.id;if(!user)return;
  if(pending&&owner===user)return pending;
  if(owner!==user){setupKey=null;reveal=false;}owner=user;
  const task=(async()=>{try{const result=await invoke('status');if(state.session?.user?.id===user)state.autoExportConnection={...result,status:'ready'};}catch{if(state.session?.user?.id===user)state.autoExportConnection={status:'error'};}finally{if(pending===task)pending=null;}})();pending=task;return task;
}
export async function actOnAutoExport(action){
  const user=state.session?.user?.id;if(!user)return;
  if(action==='show'){reveal=!reveal;return;}
  if(action==='hide'){setupKey=null;reveal=false;return;}
  if(!['create','rotate','disconnect'].includes(action))return;
  if(action==='rotate'&&!globalThis.confirm('Gerar outra chave desativa a anterior. Será preciso atualizar a automação no iPhone. Continuar?'))return;
  if(action==='disconnect'&&!globalThis.confirm('Interromper os envios do iPhone? O histórico recebido continuará disponível.'))return;
  try{
    const result=await invoke(action);if(state.session?.user?.id!==user)return;
    const {setup_key,...status}=result;
    setupKey=setup_key||null;keyExpires=Date.now()+15*60*1000;reveal=false;owner=user;
    state.autoExportConnection={...status,status:'ready',message:action==='disconnect'?'Envios interrompidos. O histórico foi preservado.':'Configuração pronta. Copie a chave abaixo para o Health Auto Export.'};
  }catch{if(state.session?.user?.id===user)state.autoExportConnection={...state.autoExportConnection,message:'Não foi possível concluir. Verifique o estado da conexão antes de tentar novamente.'};}
}
export async function copyAutoExport(field){
  const s=state.autoExportConnection;let value=field==='url'?endpoint:field==='header'?header:setupKey;
  if(field==='key'&&(owner!==state.session?.user?.id||Date.now()>keyExpires)){setupKey=null;value=null;}
  try{if(!value)throw Error('expired');await navigator.clipboard.writeText(value);s.message=field==='key'?'Chave copiada. Cole no valor do cabeçalho no Health Auto Export.':'Copiado.';}
  catch{if(s)s.message=field==='key'?(setupKey?'Toque em Mostrar chave e selecione o texto para copiar.':'A chave não está mais disponível nesta página. Gere outra chave para configurar.'): 'Selecione o endereço ou nome do cabeçalho abaixo para copiar.';}
}
function setupFields(){
  if(owner!==state.session?.user?.id||Date.now()>keyExpires){setupKey=null;reveal=false;}
  return `<div class="haeFields"><label>URL de destino<textarea readonly rows="3" aria-label="URL do Health Auto Export">${esc(endpoint)}</textarea></label><button type="button" data-hae-copy="url">Copiar URL</button><label>Nome do cabeçalho<input readonly value="${header}" aria-label="Nome do cabeçalho"></label><button type="button" data-hae-copy="header">Copiar nome</button>${setupKey?`<label>Valor do cabeçalho · chave privada<input readonly value="${reveal?esc(setupKey):'••••••••••••••••'}" aria-label="Chave privada do Health Auto Export" autocomplete="off" spellcheck="false"></label><div class="haeButtons"><button type="button" data-hae-copy="key">Copiar chave</button><button type="button" data-hae-action="show">${reveal?'Ocultar chave':'Mostrar chave'}</button><button type="button" data-hae-action="hide">Apagar chave desta tela</button></div><p class="footerNote">A chave fica disponível nesta página por 15 minutos. Guarde-a na automação antes de fechar; para trocar, gere outra chave.</p>`:'<p>A chave só aparece ao gerar a configuração. Se você perdeu a chave antes de configurar o iPhone, use Gerar outra chave.</p>'}</div>`;
}
export function renderAutoExportConnection(){
  const s=state.autoExportConnection,ready=s?.status==='ready',configured=ready&&s.configured,received=configured&&s.received;
  const label=s?.status==='error'?'Estado não verificado':!ready?'Verificando conexão':received?'Recebendo dados':configured?'Aguardando primeiro envio':'Ativação no iPhone pendente';
  return `<section class="card sectionGap haeConnection" data-health-auto-export><div class="sourceStatusTop"><h2>Saúde do iPhone</h2><span class="pill">${esc(label)}</span></div><p>MyFitnessPal → Saúde do iPhone → Health Auto Export → LTS Health. Alimentação e água registradas podem chegar automaticamente, junto dos sinais de sono e recuperação. Os treinos continuam pela conexão Polar.</p>${received?`<p>Último recebimento: <b>${esc(new Date(s.last_received_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))}</b>. Última data com dados: ${fmtDate(s.last_metric_date)}.</p><p>${s.last_water_date?`Água recebida até ${fmtDate(s.last_water_date)}.`:'Ainda não recebemos volume de água por esta ponte.'}</p>`:'<p>O status mudará para Recebendo dados somente depois do primeiro envio válido do iPhone.</p>'}<div class="haeButtons">${ready?`<button type="button" data-hae-action="${configured?'rotate':'create'}">${configured?'Gerar outra chave':'Gerar configuração'}</button>`:''}<button type="button" data-hae-check>Verificar recebimento</button>${configured?'<button type="button" data-hae-action="disconnect">Interromper envios</button>':''}</div><p role="status" class="footerNote">${esc(s?.message||'')}</p><details class="sourceMore" data-disclosure="health-auto-export-setup" ${setupKey?'open':''}><summary>Configurar o Health Auto Export</summary><div class="haeSetup"><ol><li>No MyFitnessPal, abra Mais ou Perfil → Configurações → Compartilhamento e privacidade → Compartilhamento HealthKit. Ative o envio de alimentação ao Saúde. A água precisa aparecer no Saúde para ser exportada.</li><li>No Health Auto Export, permita a leitura dos dados que você quer enviar. Abra Automações → Nova automação → REST API e dê o nome LTS Health.</li><li>Toque em Gerar configuração nesta página e copie a URL, o nome do cabeçalho e a chave para os campos da automação.</li><li>Use as opções da tabela abaixo. Para alimentação, escolha MyFitnessPal em Fontes preferidas, quando disponível.</li><li>Na automação, abra Exportação manual, escolha ontem e hoje e toque em Exportar. Volte aqui e toque em Verificar recebimento; o LTS atualizará os relatórios com os dados recebidos.</li></ol>${configured?setupFields():''}<table class="haeOptions"><tbody><tr><th>Tipo de dados</th><td>Métricas de saúde / Health Metrics</td></tr><tr><th>Formato e versão</th><td>JSON · versão 2</td></tr><tr><th>Resumir dados</th><td>Ativado / ON</td></tr><tr><th>Agrupamento</th><td>Dias / Day</td></tr><tr><th>Período</th><td>Padrão / Default (ontem e hoje)</td></tr><tr><th>Frequência</th><td>1 hora</td></tr><tr><th>Métricas</th><td>Energia alimentar, proteína, carboidratos, gordura total, fibra e água. Opcional: sono, FC de repouso, variabilidade cardíaca, frequência respiratória, saturação, peso, passos, energia ativa, tempo de exercício e horas em pé.</td></tr></tbody></table><p>Ative Atualização em segundo plano no iPhone e adicione o widget de Automações. Os envios dependem das oportunidades que o iOS oferece quando o aparelho está desbloqueado; não são garantidos a cada hora.</p><p>O histórico original de alimentação tem prioridade nas datas em que também houver dados desta ponte. Fontes diferentes mantêm sua identificação. Medidas de bioimpedância e séries de musculação continuam com seus registros próprios.</p><a href="https://help.healthyapps.dev/en/health-auto-export/automations/rest-api/" target="_blank" rel="noopener noreferrer">Guia oficial do Health Auto Export ›</a></div></details></section>`;
}

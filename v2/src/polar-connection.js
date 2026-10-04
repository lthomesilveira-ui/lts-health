import {sb,state,fixtureMode,CONFIG,esc,fmtDate} from './core.js';
import {renderAutoExportConnection} from './health-auto-export-connection.js';

let pending=null,sessionOwner=null;
const callback=`${CONFIG.url}/functions/v1/health-polar-callback`;
async function invoke(action){
  if(fixtureMode)return {configured:false,connected:false,callback_url:callback};
  if(!sb?.functions?.invoke)throw Error('unavailable');
  const {data,error}=await sb.functions.invoke('health-polar-connection',{body:{action}});if(error||data?.error)throw Error('unavailable');return data;
}
export function resetPolarConnection(){state.polarConnection=null;sessionOwner=null;pending=null;}
export async function checkPolarConnection({syncOnOpen=false}={}){
  const owner=state.session?.user?.id;if(!owner)return false;
  if(pending&&sessionOwner===owner)return syncOnOpen?pending.then(()=>state.session?.user?.id===owner?checkPolarConnection({syncOnOpen:true}):false):pending;
  sessionOwner=owner;state.polarConnection={status:'loading'};
  const task=(async()=>{
    try{
      let result=await invoke('status'),synced=false;
      if(syncOnOpen&&result.configured&&result.connected&&(!result.last_attempt_at||Date.now()-Date.parse(result.last_attempt_at)>6*3600000)){
        const sync=await invoke('sync');synced=sync.synced===true;result=await invoke('status');
      }
      if(state.session?.user?.id===owner)state.polarConnection={...result,status:'ready'};
      return state.session?.user?.id===owner&&synced;
    }catch{if(state.session?.user?.id===owner)state.polarConnection={status:'error'};return false;}
    finally{if(pending===task)pending=null;}
  })();pending=task;return task;
}
export async function actOnPolar(action){
  if(!['start','sync','disconnect'].includes(action))return false;
  const owner=state.session?.user?.id;if(!owner)return false;
  state.polarConnection={...state.polarConnection,busy:true,message:''};
  try{
    const result=await invoke(action);if(state.session?.user?.id!==owner)return false;
    if(action==='start'){
      const url=new URL(result.authorization_url);if(url.origin!=='https://auth.polar.com'||url.pathname!=='/oauth/authorize')throw Error('unexpected_url');
      location.assign(url.href);return false;
    }
    await checkPolarConnection();
    state.polarConnection.message=action==='disconnect'?'Autorização removida do LTS. O histórico recebido permanece disponível.':result.synced?'Dados Polar atualizados.':result.in_progress?'Já existe uma atualização em andamento.':'A atualização não foi concluída. O histórico anterior continua disponível.';
    return result.synced===true;
  }catch{if(state.session?.user?.id===owner)state.polarConnection={...state.polarConnection,busy:false,message:'Não foi possível concluir agora. Atualize o estado da conexão para tentar novamente.'};return false;}
}
export function renderConnections(){
  const s=state.polarConnection,verified=s?.status==='ready',connected=verified&&s.connected,configured=verified&&s.configured,busy=s?.busy;
  const label=!s||s.status==='loading'?'Verificando conexão':s.status==='error'?'Estado não verificado':connected?'Conta autorizada':configured?'Pronta para autorizar':'Aguardando cadastro da integração';
  return `<section class="card sectionGap ltsConnections" data-connections><h2>Atualizações das suas contas</h2><p>Arquivos já recebidos e autorização de conta têm estados próprios. A conexão Polar atualiza os dados ao abrir o app; uma rotina em segundo plano ainda não está ativada.</p><div class="sourceStatusGrid"><article class="sourceStatus"><div class="sourceStatusTop"><b>Polar Flow</b><span class="pill">${esc(label)}</span></div><p>${connected?`Última atualização concluída: ${s.last_sync_at?fmtDate(s.last_sync_at):'ainda não houve sincronização'}. Treinos Polar e sono mantêm sua origem; sessões de musculação não são contadas novamente.`:configured?'Autorize a leitura dos seus treinos e do sono na página oficial do Polar.':'O fluxo de autorização está preparado. Falta cadastrar o LTS como integração na conta Polar e configurar as credenciais no servidor.'}</p>${s?.sync_error?'<p role="status">A última tentativa não terminou. O histórico anterior permanece disponível; talvez seja necessário autorizar novamente.</p>':''}${configured?`<button type="button" data-polar-action="start" ${busy?'disabled':''}>${connected?'Autorizar novamente':'Conectar Polar'}</button>`:''}${connected?`<button type="button" data-polar-action="sync" ${busy?'disabled':''}>Atualizar agora</button><button type="button" data-polar-action="disconnect" ${busy?'disabled':''}>Desconectar conta</button>`:''}<button type="button" data-polar-check ${busy?'disabled':''}>Verificar conexão</button><details class="sourceMore" data-disclosure="polar-setup"><summary>Etapa de ativação do Polar</summary><p>Registre uma aplicação chamada LTS Health no <a href="https://admin.polaraccesslink.com" target="_blank" rel="noopener noreferrer">painel oficial Polar AccessLink</a>, usando o endereço do LTS como site.</p><p>Endereço de retorno da autorização:</p><code class="ltsCallback">${esc(callback)}</code><p>As credenciais da integração precisam ser configuradas na área segura do servidor. Não envie a senha Polar nem o segredo da integração pelo chat. Depois, o botão Conectar Polar abrirá a autorização oficial.</p></details></article><article class="sourceStatus"><div class="sourceStatusTop"><b>MyFitnessPal</b><span class="pill">Ponte pelo Saúde do iPhone</span></div><p>A alimentação pode chegar pelo Saúde do iPhone, usando o Health Auto Export. Configure a ponte logo abaixo; a primeira transmissão confirma quais dados estão disponíveis.</p><a href="https://www.myfitnesspal.com/apps/api/version" target="_blank" rel="noopener noreferrer">Consultar acesso oficial à API ›</a><p>Os arquivos originais do histórico continuam com prioridade. A água só entra nesta ponte quando estiver registrada no Saúde; o histórico antigo de água do MFP continua uma etapa separada.</p><details class="sourceMore" data-disclosure="mfp-export"><summary>Atualizar alimentação por arquivo</summary><p>No app MyFitnessPal, abra Mais ou Perfil → Nutrição → Exportar, escolha o período e solicite a exportação. Esse recurso exige Premium ou Premium+. O MyFitnessPal envia por e-mail um ZIP com alimentação, exercícios e medidas; envie o ZIP original em Adicionar arquivo, escolhendo MyFitnessPal.</p><p>O volume de água precisa de uma fonte própria: não será calculado a partir de calorias, líquidos ou bioimpedância. Para o histórico de água, use Importar histórico do MFP.</p><a href="https://support.myfitnesspal.com/hc/en-us/articles/360032273352-Export-your-nutrition-progress-and-exercise-data" target="_blank" rel="noopener noreferrer">Instruções oficiais de exportação ›</a></details></article></div><p class="footerNote" role="status">${esc(s?.message||'Somente a autorização real permite buscar novas informações da conta.')}</p></section>${renderAutoExportConnection()}`;
}

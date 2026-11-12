import {CONFIG, countLabel, esc, fixtureMode, fmtDate, sb, state} from './core.js';
import {localHealthDay} from './health-context.js';
import {addDays} from './integrated-analysis.js';

const callback = `${CONFIG.url}/functions/v1/health-google-callback`;
const readScope = 'https://www.googleapis.com/auth/googlehealth.nutrition.readonly';
const returnKey = 'lts-google-health-return';
let connection = null;

function activeConnection() {
  const owner = state.session?.user?.id;
  if (fixtureMode || window.LTSPreviewReadOnly || !owner) return null;
  if (connection?.owner !== owner) {
    connection = {owner, status: null, pending: null, message: ''};
  }
  return connection;
}

function isCurrent(entry) {
  return connection === entry && state.session?.user?.id === entry.owner;
}

async function invoke(body) {
  const {data, error} = await sb.functions.invoke('health-google-connection', {body});
  if (error || !data || data.error) throw Error('Google Health unavailable');
  return data;
}

async function updateStatus(entry) {
  const status = await invoke({action: 'status'});
  if (typeof status.configured !== 'boolean' || typeof status.connected !== 'boolean') {
    throw Error('Invalid connection status');
  }
  if (isCurrent(entry)) entry.status = status;
}

function run(entry, operation, failure) {
  if (entry.pending) return entry.pending;
  entry.message = '';
  entry.pending = Promise.resolve().then(async () => {
    if (isCurrent(entry)) await operation();
  }).catch(() => {
    if (isCurrent(entry)) entry.message = failure;
  }).finally(() => {
    entry.pending = null;
  });
  return entry.pending;
}

export function googleHealthReadWindow(now = new Date()) {
  const lastDay = localHealthDay(now);
  return {from: addDays(lastDay, -29), to: addDays(lastDay, 1), lastDay};
}

async function readHydration(entry) {
  // Google treats the end date as exclusive; include today's records in the
  // same 30 civil days that the owner sees and the background reader uses.
  const {from, to, lastDay} = googleHealthReadWindow();
  const period = `De ${fmtDate(from)} a ${fmtDate(lastDay)}`;
  let result;
  try {
    result = await invoke({action: 'read', from, to});
  } finally {
    if (isCurrent(entry)) {
      try { await updateStatus(entry); } catch { /* The read response still establishes its outcome. */ }
    }
  }
  if (!isCurrent(entry)) return;
  if (result.in_progress === true) {
    entry.message = 'Já existe uma conferência de água em andamento.';
    return;
  }
  if (result.read !== true || result.canonical_updated !== false ||
      !Number.isInteger(result.observations) || result.observations < 0 ||
      result.empty !== (result.observations === 0)) {
    throw Error('Invalid hydration result');
  }
  entry.message = result.empty
    ? `${period}, o Google Health não retornou registros de água.`
    : `${period}, o Google Health retornou ${countLabel(result.observations, 'registro de água', 'registros de água')} para conferência de origem.`;
}

function googleAuthorizationUrl(value) {
  const url = new URL(value);
  const exactParameter = (name, expected) => {
    const values = url.searchParams.getAll(name);
    return values.length === 1 && values[0] === expected;
  };
  if (url.origin !== 'https://accounts.google.com' || url.pathname !== '/o/oauth2/v2/auth' ||
      url.username || url.password || url.hash ||
      !exactParameter('redirect_uri', callback) || !exactParameter('scope', readScope) ||
      !exactParameter('code_challenge_method', 'S256') || !exactParameter('response_type', 'code')) {
    throw Error('Invalid Google authorization URL');
  }
  return url.href;
}

function rememberReturn(entry) {
  try { sessionStorage.setItem(returnKey, JSON.stringify([entry.owner, Date.now() + 600000])); } catch {}
}

function consumeReturn(entry) {
  try {
    const value = sessionStorage.getItem(returnKey);
    if (!value) return false;
    sessionStorage.removeItem(returnKey);
    const [owner, expires] = JSON.parse(value);
    return owner === entry.owner && Number.isFinite(expires) && expires > Date.now();
  } catch { return false; }
}

export function resetGoogleHealthConnection() {
  connection = null;
  try { sessionStorage.removeItem(returnKey); } catch {}
}

export function checkGoogleHealthConnection({initialRead = false} = {}) {
  const entry = activeConnection();
  if (!entry) return;
  return run(entry, async () => {
    entry.status = null;
    await updateStatus(entry);
    if (isCurrent(entry) && initialRead && entry.status.configured && entry.status.connected &&
        consumeReturn(entry) && !entry.status.last_attempt_at && !entry.status.last_read_at) {
      await readHydration(entry);
    }
  }, 'Não foi possível concluir a verificação agora. Tente novamente em Dados & fontes.');
}

export function actOnGoogleHealth(action) {
  if (action === 'check') return checkGoogleHealthConnection();
  const entry = activeConnection();
  if (!entry?.status?.configured) return;
  if (action === 'authorize') {
    return run(entry, async () => {
      const {authorization_url} = await invoke({action});
      if (!isCurrent(entry)) return;
      const target = googleAuthorizationUrl(authorization_url);
      rememberReturn(entry);
      location.assign(target);
    }, 'Não foi possível abrir a autorização do Google agora.');
  }
  if (!entry.status.connected) return;
  if (action === 'read') {
    return run(entry, () => readHydration(entry), 'Não foi possível conferir os registros de água agora.');
  }
  if (action === 'disconnect') {
    return run(entry, async () => {
      const result = await invoke({action});
      if (!isCurrent(entry)) return;
      if (result.connected !== false) throw Error('Google Health still connected');
      entry.status = result;
      entry.message = 'Conta Google Health desconectada do LTS Health.';
    }, 'Não foi possível desconectar a conta agora.');
  }
}

export function renderGoogleHealthConnection() {
  const entry = activeConnection();
  if (!entry) return '';
  const status = entry.status;
  const reconnect = status?.last_error === 'authorization_expired';
  const label = !status ? (entry.pending ? 'Verificando' : 'A verificar')
    : reconnect ? 'Autorização expirada'
    : status.connected ? 'Conta autorizada'
    : status.configured ? 'Conta não conectada' : 'Integração indisponível';
  const statusMessage = !status ? 'Verifique a conexão para consultar a situação da conta.'
    : reconnect ? 'A autorização precisa ser renovada para voltar a consultar os registros.'
    : status.connected ? 'A autorização da conta e o recebimento de água são conferidos separadamente.'
    : status.configured ? 'A conta Google ainda não foi conectada. Nenhum recebimento de água foi confirmado por esta conexão.'
    : 'A integração Google ainda não está disponível. Os registros de água já existentes continuam no aplicativo.';
  const lastRead = status?.last_read_at ? new Date(status.last_read_at) : null;
  const disabled = entry.pending ? ' disabled' : '';
  const button = (action, caption) => `<button type="button" data-google-health-action="${action}"${disabled}>${caption}</button>`;
  return `<section class="card sectionGap ltsConnections" data-google-health aria-labelledby="google-health-title" aria-busy="${Boolean(entry.pending)}">
    <div class="sourceStatusTop"><h2 id="google-health-title">Google Health</h2><span class="pill">${label}</span></div>
    <p>Consulte a água registrada no Google Health. A origem é conferida antes de incluir os valores nos totais.</p>
    ${lastRead && Number.isFinite(lastRead.getTime()) ? `<p>Última conferência em ${fmtDate(localHealthDay(lastRead))}.</p>` : ''}
    <div class="googleHealthActions">
      ${status?.configured && (!status.connected || reconnect) ? button('authorize', reconnect ? 'Autorizar novamente' : 'Conectar Google Health') : ''}
      ${status?.connected && !reconnect ? button('read', 'Conferir água dos últimos 30 dias') : ''}
      ${status?.connected ? button('disconnect', 'Desconectar do LTS Health') : ''}
      ${!status?.configured ? button('check', 'Verificar Google Health') : ''}
    </div>
    <p class="footerNote" role="status">${esc(entry.message || (entry.pending ? 'Aguarde um instante.' : statusMessage))}</p>
  </section>`;
}

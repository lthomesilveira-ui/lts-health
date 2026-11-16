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

export function googleHealthPeriodWindow(from, lastDay) {
  const valid = day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day + 'T00:00:00Z')) && new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) === day;
  if (!valid(from) || !valid(lastDay) || from > lastDay ||
      (Date.parse(lastDay) - Date.parse(from)) / 86400000 >= 31) throw Error('Invalid period');
  return {from, to: addDays(lastDay, 1), lastDay};
}

async function readHydration(entry, periodWindow = googleHealthReadWindow()) {
  // Google treats the end date as exclusive; include today's records in the
  // same 30 civil days that the owner sees and the background reader uses.
  const {from, to, lastDay} = periodWindow;
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

async function inspectWaterAvailability(entry) {
  const {lastDay, to} = googleHealthReadWindow(), from = addDays(lastDay, -6);
  const result = await invoke({action: 'inspect-hydration', from, to});
  if (!isCurrent(entry)) return;
  if (result.in_progress === true) { entry.message = 'Já existe uma conferência em andamento.'; return; }
  const kinds = ['civil_window', 'latest_all_sources', 'latest_default_sources'];
  const validDay = day => {
    try { googleHealthPeriodWindow(day, day); return true; } catch { return false; }
  };
  if (result.inspected !== true || result.bounded !== true || result.data_type !== 'hydration-log' ||
      result.mode !== 'read_only' || result.canonical_updated !== false || result.water_received !== false ||
      result.from !== from || result.to_exclusive !== to || result.max_points_per_probe !== 25 ||
      !Array.isArray(result.probes) || result.probes.length !== kinds.length || result.probes.some((probe, index) =>
        !probe || probe.kind !== kinds[index] || typeof probe.truncated !== 'boolean' ||
        ![probe.observations, probe.recent_observations, probe.undated_observations].every(value => Number.isInteger(value) && value >= 0 && value <= 25) ||
        probe.recent_observations + probe.undated_observations > probe.observations ||
        (probe.observations === probe.undated_observations
          ? probe.first_day !== null || probe.last_day !== null
          : !validDay(probe.first_day) || !validDay(probe.last_day) || probe.first_day > probe.last_day))) {
    throw Error('Invalid water availability inspection');
  }
  const recent = result.probes.some(probe => probe.recent_observations > 0);
  const undated = result.probes.some(probe => probe.undated_observations > 0);
  const latest = result.probes.map(probe => probe.last_day).filter(Boolean).sort().at(-1);
  entry.message = recent
    ? 'O Google disponibilizou registros recentes de água nesta conferência complementar. A origem ainda precisa ser conferida; nenhum valor foi incluído nos totais.'
    : undated
      ? `Há registros de água sem data local verificável. Não foi possível confirmar o período de ${fmtDate(from)} a ${fmtDate(lastDay)}. Nenhum valor foi incluído nos totais.`
      : `O Google não disponibilizou água de ${fmtDate(from)} a ${fmtDate(lastDay)} nesta conferência.${latest ? ` Entre os registros retornados, a data mais recente é ${fmtDate(latest)}.` : ''} Nenhum valor foi incluído nos totais.`;
  if (result.probes.some(probe => probe.truncated)) entry.message += ' A conferência dos registros recentes foi limitada a 25 por consulta.';
}

async function inspectNutrition(entry) {
  const {lastDay, to} = googleHealthReadWindow();
  const from = addDays(lastDay, -6);
  const result = await invoke({action: 'inspect-nutrition', from, to});
  if (!isCurrent(entry)) return;
  if (result.in_progress === true) {
    entry.message = 'Já existe uma conferência em andamento.';
    return;
  }
  if (result.inspected !== true || result.complete !== true || result.canonical_updated !== false ||
      result.water_received !== false || result.data_type !== 'nutrition-log' ||
      result.from !== from || result.to_exclusive !== to ||
      !Number.isInteger(result.observations) || result.observations < 0 || result.observations > 10000) {
    throw Error('Invalid source inspection');
  }
  entry.message = result.observations === 0
    ? `De ${fmtDate(from)} a ${fmtDate(lastDay)}, o Google também não retornou registros de alimentação. Isso não informa o que está salvo no MyFitnessPal.`
    : `De ${fmtDate(from)} a ${fmtDate(lastDay)}, o Google retornou ${countLabel(result.observations, 'registro de alimentação', 'registros de alimentação')}. O recebimento de água continua sendo conferido separadamente.`;
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

export function actOnGoogleHealth(action, requestedPeriod) {
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
  if (action === 'inspect-hydration') {
    return run(entry, () => inspectWaterAvailability(entry), 'Não foi possível conferir a disponibilidade da água agora.');
  }
  if (action === 'inspect-nutrition') {
    return run(entry, () => inspectNutrition(entry), 'Não foi possível comparar a chegada da alimentação agora.');
  }
  if (action === 'read') {
    return run(entry, () => readHydration(entry), 'Não foi possível conferir os registros de água agora.');
  }
  if (action === 'read-period') {
    entry.period = {from: requestedPeriod?.from || '', lastDay: requestedPeriod?.lastDay || ''};
    return run(entry, async () => {
      let period;
      try { period = googleHealthPeriodWindow(entry.period.from, entry.period.lastDay); }
      catch { entry.message = 'Escolha uma data inicial e uma final, em ordem, com até 31 dias no período.'; return; }
      await readHydration(entry, period);
    }, 'Não foi possível conferir os registros de água agora.');
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
  const stamp = value => {
    const date = value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('pt-BR', {timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short'}).format(date) : null;
  };
  const scheduledAt = stamp(status?.last_scheduled_read_at);
  const scheduledAttempt = stamp(status?.last_scheduled_attempt_at);
  const scheduledPending = scheduledAttempt && (!scheduledAt || Date.parse(status.last_scheduled_attempt_at) > Date.parse(status.last_scheduled_read_at));
  const scheduled = status?.scheduled_result;
  let scheduledPeriod = null;
  if (scheduled) {
    try { scheduledPeriod = googleHealthPeriodWindow(scheduled.from, addDays(scheduled.to_exclusive, -1)); } catch {}
  }
  const scheduledValid = scheduledPeriod && Number.isInteger(scheduled.observations) && scheduled.observations >= 0 &&
    scheduled.observations <= 10000 && scheduled.empty === (scheduled.observations === 0);
  const disabled = entry.pending ? ' disabled' : '';
  const selected = entry.period || googleHealthReadWindow();
  const button = (action, caption) => `<button type="button" data-google-health-action="${action}"${disabled}>${caption}</button>`;
  return `<section class="card sectionGap ltsConnections" data-google-health aria-labelledby="google-health-title" aria-busy="${Boolean(entry.pending)}">
    <div class="sourceStatusTop"><h2 id="google-health-title">Google Health</h2><span class="pill">${label}</span></div>
    <p>Consulte a água registrada no Google Health. A origem é conferida antes de incluir os valores nos totais.</p>
    ${lastRead && Number.isFinite(lastRead.getTime()) ? `<p>Última conferência em ${fmtDate(localHealthDay(lastRead))}.</p>` : ''}
    ${status?.connected ? `<div class="googleHealthAutomatic">
      <p>${scheduledAt ? `Última consulta automática: ${esc(scheduledAt)} (Brasília).` : scheduledAttempt ? `Consulta automática iniciada em ${esc(scheduledAttempt)} (Brasília), ainda sem conclusão confirmada.` : 'Nenhuma consulta automática concluída foi confirmada nesta conexão.'}</p>
      ${scheduledAt && scheduledPending ? `<p>A tentativa automática mais recente, em ${esc(scheduledAttempt)} (Brasília), ainda não tem conclusão confirmada.</p>` : ''}
      ${scheduledAt && scheduledValid ? `<p>De ${fmtDate(scheduledPeriod.from)} a ${fmtDate(scheduledPeriod.lastDay)}, ${scheduled.empty ? 'o Google não retornou registros de água. Dias sem registro continuam sem informação.' : `${countLabel(scheduled.observations, 'registro de água recebido', 'registros de água recebidos')} para conferir a origem; os totais não foram alterados.`}</p>` : ''}
    </div>` : ''}
    <div class="googleHealthActions">
      ${status?.configured && (!status.connected || reconnect) ? button('authorize', reconnect ? 'Autorizar novamente' : 'Conectar Google Health') : ''}
      ${status?.connected && !reconnect ? button('read', 'Conferir água dos últimos 30 dias') : ''}
      ${status?.connected ? button('disconnect', 'Desconectar do LTS Health') : ''}
      ${!status?.configured ? button('check', 'Verificar Google Health') : ''}
    </div>
    ${status?.connected && !reconnect ? `<details class="googleHealthPeriod"><summary>Consultar outro período</summary>
      <p>Inclui a data final, com até 31 dias por consulta. Dias sem registro continuam sem informação.</p>
      <div class="googleHealthPeriodFields">
        <label>Data inicial<input type="date" data-google-health-from value="${esc(selected.from)}"${disabled}></label>
        <label>Data final<input type="date" data-google-health-through value="${esc(selected.lastDay)}"${disabled}></label>
      </div>${button('read-period', 'Conferir água deste período')}
    </details>` : ''}
    ${status?.connected && !reconnect ? `<details class="googleHealthSourceCheck"><summary>Conferir disponibilidade da água</summary>
      <p>Use quando a água aparecer no Google, mas não chegar por esta conexão. Compara o período recente com os últimos registros disponíveis, sem alterar os totais.</p>
      ${button('inspect-hydration', 'Conferir disponibilidade no Google')}
    </details>` : ''}
    ${status?.connected && !reconnect ? `<details class="googleHealthSourceCheck"><summary>Comparar chegada da alimentação</summary>
      <p>Consulta os últimos 7 dias de alimentação no Google para distinguir esse envio do de água. Não importa refeições nem altera os totais.</p>
      ${button('inspect-nutrition', 'Conferir alimentação no Google')}
    </details>` : ''}
    <p class="footerNote" role="status">${esc(entry.message || (entry.pending ? 'Aguarde um instante.' : statusMessage))}</p>
  </section>`;
}

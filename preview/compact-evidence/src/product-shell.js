import {esc} from './core.js';

export function screenTitle(name,description='',section='Área do histórico'){
  return`<header class="screenTitle domainHeader"><div><span class="screenEyebrow">${esc(section)}</span><h1>${esc(name)}</h1>${description?`<p>${esc(description)}</p>`:''}</div><button type="button" class="domainHomeAction" data-route="hoje">Voltar à visão geral</button></header>`;
}

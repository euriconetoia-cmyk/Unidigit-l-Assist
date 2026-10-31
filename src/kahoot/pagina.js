// Lógica da página "Kahoot" da extensão (sem DOM, testável). O pedido de permissão acontece aqui porque o clique
// numa página da própria extensão é um gesto do usuário que o Chrome aceita para chrome.permissions.request.
import { createModuleHost } from '../host/modules.js';

export const KAHOOT_ORIGEM = 'https://create.kahoot.it/*';
export const KAHOOT_URL = 'https://create.kahoot.it/';
const PERMS = { origins: [KAHOOT_ORIGEM] };

export async function temPermissao(chromeApi) { try { return Boolean(await chromeApi.permissions.contains(PERMS)); } catch (_) { return false; } }

// Pede a permissão (o Chrome mostra o próprio aviso). Devolve true/false; nunca lança por recusa.
export async function pedirPermissao(chromeApi) { try { return Boolean(await chromeApi.permissions.request(PERMS)); } catch (_) { return false; } }

export async function abasDoEditor(chromeApi) {
  if (!(await temPermissao(chromeApi))) return [];
  const abas = await chromeApi.tabs.query({ url: KAHOOT_ORIGEM });
  return abas.filter(t => typeof t.id === 'number').map(t => ({ id: t.id, titulo: String(t.title || 'Kahoot').slice(0, 80) }));
}

// Injeta o módulo na aba e abre a janela de importação. Só roda com a permissão concedida.
export async function prepararAba(chromeApi, tabId, { host = createModuleHost(chromeApi) } = {}) {
  if (!(await temPermissao(chromeApi))) throw new Error('Falta a permissão para o Kahoot. Clique em “Permitir” primeiro.');
  return host.call(tabId, 'kahoot', 'kahoot.abrir');
}

// Abre o editor numa aba nova, espera carregar e prepara.
export async function abrirEditor(chromeApi, { host, esperaMs = 20000 } = {}) {
  if (!(await temPermissao(chromeApi))) throw new Error('Falta a permissão para o Kahoot. Clique em “Permitir” primeiro.');
  const tab = await chromeApi.tabs.create({ url: KAHOOT_URL });
  await new Promise((resolve, reject) => {
    const limite = setTimeout(() => { chromeApi.tabs.onUpdated.removeListener(fn); reject(new Error('O Kahoot demorou para abrir. Abra o editor de um quiz e use “Preparar esta aba”.')); }, esperaMs);
    const fn = (id, info) => { if (id === tab.id && info.status === 'complete') { clearTimeout(limite); chromeApi.tabs.onUpdated.removeListener(fn); resolve(); } };
    chromeApi.tabs.onUpdated.addListener(fn);
  });
  return { tabId: tab.id, ...(await prepararAba(chromeApi, tab.id, { host })) };
}

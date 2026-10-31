// Service worker: recebe os cliques do botão lateral, injeta o módulo sob demanda e nomeia downloads.
import { createHandler } from './hub-handler.js';
import { createModuleHost } from './host/modules.js';
import './modules/importar-notas/vendor/background.js'; // nome/pasta dos ZIPs de pendências (mesmo código da extensão original)

if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  // só existe na versão com o editor de blocos (opcional)
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

// Páginas da própria extensão (ex.: Kahoot, onde o pedido de permissão é feito com um clique do usuário). Só nomes conhecidos.
const PAGINAS = { 'kahoot.html': 'kahoot.html' };
const abrirPagina = async nome => { if (!PAGINAS[nome]) throw new Error('Página desconhecida.'); await chrome.tabs.create({ url: chrome.runtime.getURL(PAGINAS[nome]) }); };
const handle = createHandler({ host: createModuleHost(chrome), runtimeId: chrome.runtime.id, abrirPagina });
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'hub-open') return false;
  handle(message, sender).then(sendResponse);
  return true;
});

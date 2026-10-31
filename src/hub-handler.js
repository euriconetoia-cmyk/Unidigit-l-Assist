// Trata o pedido do botão lateral (content script) no service worker. Sem DOM; recebe `host` injetado (testável).
import { APPS } from './apps.js';

export const ALLOWED_ORIGINS = ['https://ead.senai.br', 'https://ead.fieg.com.br'];

export function createHandler({ host, runtimeId }) {
  return async function handle(message, sender) {
    if (!message || message.type !== 'hub-open') return null; // não é conosco
    try {
      if (!sender || sender.id !== runtimeId || !sender.tab || typeof sender.tab.id !== 'number') throw new Error('Origem não autorizada.');
      let origin = '';
      try { origin = new URL(sender.url || (sender.tab && sender.tab.url)).origin; } catch (_) { /* sem URL */ }
      if (!ALLOWED_ORIGINS.includes(origin)) throw new Error('Esta página não é do Moodle permitido.');
      const app = APPS.find(a => a.id === message.app);
      if (!app) throw new Error('Ferramenta desconhecida.');
      if (!app.disponivel) throw new Error(`${app.nome} ainda não está disponível.`);
      const retomar = message.motivo === 'retomar' && Boolean(app.comandoRetomar);
      const value = await host.call(sender.tab.id, app.modulo, retomar ? app.comandoRetomar : app.comando, app.args || {});
      return { ok: true, message: (value && value.mensagem) || 'Pronto.' };
    } catch (error) {
      return { ok: false, error: error && error.message ? error.message : String(error) };
    }
  };
}

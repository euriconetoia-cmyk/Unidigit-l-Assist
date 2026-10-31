// Descobre a aba alvo (a ativa da janela) e só aceita páginas do Moodle permitido.
export const ALLOWED_ORIGINS = ['https://ead.senai.br', 'https://ead.fieg.com.br'];

export async function resolveTab(chromeApi, search = '') {
  const forced = new URLSearchParams(search).get('tab'); // só para testes automatizados
  let tab;
  if (forced) tab = await chromeApi.tabs.get(Number(forced));
  else [tab] = await chromeApi.tabs.query({ active: true, lastFocusedWindow: true });
  let origin = '';
  try { origin = new URL(tab && tab.url).origin; } catch (_) { /* sem URL legível */ }
  if (!tab || !ALLOWED_ORIGINS.includes(origin)) throw new Error('Abra uma página do Moodle (ead.senai.br ou ead.fieg.com.br) na aba ativa e execute de novo.');
  return tab;
}

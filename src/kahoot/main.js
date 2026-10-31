// Tela da página "Kahoot" (extensão). Textos só por textContent.
import { temPermissao, pedirPermissao, abasDoEditor, prepararAba, abrirEditor } from './pagina.js';

const $ = id => document.getElementById(id);
const say = (texto, tipo = '') => { const m = $('msg'); m.textContent = texto; m.className = `msg ${tipo}`; m.hidden = !texto; };

async function desenhar() {
  const ok = await temPermissao(chrome);
  $('sem').hidden = ok; $('com').hidden = !ok;
  if (!ok) return;
  const abas = await abasDoEditor(chrome);
  const lista = $('abas'); lista.replaceChildren();
  $('semAbas').hidden = abas.length > 0;
  abas.forEach(a => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = `Preparar esta aba: ${a.titulo}`;
    b.addEventListener('click', async () => { try { await prepararAba(chrome, a.id); say('Pronto. Volte à aba do Kahoot e escolha o arquivo.', 'ok'); chrome.tabs.update(a.id, { active: true }); } catch (e) { say(e.message, 'err'); } });
    lista.append(b);
  });
}

$('permitir').addEventListener('click', async () => {
  const ok = await pedirPermissao(chrome);
  say(ok ? 'Permissão concedida.' : 'Sem a permissão o Kahoot não é aberto. Nada mudou.', ok ? 'ok' : 'err');
  desenhar();
});
$('agoraNao').addEventListener('click', () => window.close());
$('abrir').addEventListener('click', async () => {
  say('Abrindo o Kahoot…');
  try { await abrirEditor(chrome); say('Pronto. Na aba do Kahoot, escolha o arquivo CSV.', 'ok'); } catch (e) { say(e.message, 'err'); }
});
$('reler').addEventListener('click', desenhar);
desenhar();

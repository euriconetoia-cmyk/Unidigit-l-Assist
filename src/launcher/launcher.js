// Botão lateral das ferramentas EaD. Roda em toda página do Moodle permitido, mas SÓ desenha o botão:
// não consulta o Moodle, não lê a página e não injeta nada até você clicar numa ferramenta.
import { APPS, tipoDaPagina, aplicaNaPagina, MODELO_KAHOOT } from '../apps.js';

const NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  // capelo (educação) + chave (ferramentas)
  ferr: 'M1.5 8.5L10 4.5l8.5 4-8.5 4zM5 10.6v3.6c0 1.2 2.2 2.2 5 2.2M18.5 8.5v4M21.6 14.4a3 3 0 0 1-3.9 3.7L13.4 22.4a1.4 1.4 0 0 1-2-2l4.3-4.3a3 3 0 0 1 3.7-3.9l-1.7 1.7.4 1.6 1.6.4z',
  pend: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2',
  corr: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
  acomp: 'M4 19V5M4 19h16M8 15l4-4 3 3 5-6',
  blo: 'M3 4h8v6H3zM13 14h8v6h-8zM7 10v4h6',
  rel: 'M5 20V10M12 20V4M19 20v-7',
  turma: 'M4 5h16v4H4zM4 11h16v4H4zM4 17h10v3H4zM18 17l2 2 3-3',
  alun: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11a3 3 0 1 0 0-6M21 20c0-2.5-1.6-4.6-4-5.5',
  diag: 'M9 12l2 2 4-4M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z',
  dados: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5',
  kahoot: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.6 9.2a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1.9-1.1 1.7M12 16.6v.1',
  modelo: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 11v6M9.5 14.5L12 17l2.5-2.5',
  ferr2: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5a1.4 1.4 0 0 0 2 2l5.8-5.8a4 4 0 0 0 5.4-5.4l-2.4 2.4-1.7-.4-.4-1.7z',
  voltar: 'M15 5l-7 7 7 7',
  seta: 'M9 5l7 7-7 7',
  close: 'M6 6l12 12M18 6L6 18'
};

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.wrap { position: fixed; right: calc(12px + env(safe-area-inset-right, 0px)); bottom: calc(12px + env(safe-area-inset-bottom, 0px)); z-index: 2147483000; pointer-events: none; display: flex; flex-direction: column; align-items: flex-end; gap: 12px; font: 14px/1.4 Inter, -apple-system, "Segoe UI", system-ui, sans-serif; color: #14202e; --p: #0b5cad; --p2: #0a3f78; --m: #5b6b7c; --line: #dbe3ec; --surf: rgba(255,255,255,.95); --card: #f8fafd; --hover: #eef5fc; --hb: #b9d3ee; --focus: #f6b900; --c-corr: #0b5cad; --c-alun: #13795b; --c-mais: #b4580a; --c-off: #8d9bab; --tipbg: #14202e; --tipfg: #fff; }
@media (prefers-color-scheme: dark) { .wrap { color: #e6ecf5; --m: #9aa8bd; --line: #2b3646; --surf: rgba(26,33,44,.96); --card: #212a37; --hover: #263446; --hb: #3b5877; --c-corr: #2f7fd1; --c-alun: #2f9c76; --c-mais: #d9772a; --tipbg: #e6ecf5; --tipfg: #14202e; } }
svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.tab { pointer-events: auto; position: relative; width: 60px; height: 60px; display: grid; place-items: center; flex-shrink: 0; padding: 0; border: 0; border-radius: 50%; background: linear-gradient(135deg, var(--p), var(--p2)); color: #fff; cursor: pointer; box-shadow: 0 1px 2px rgba(10,30,60,.3), 0 8px 22px rgba(11,92,173,.38); transition: transform .2s, box-shadow .2s; }
.tab:hover { transform: scale(1.07); box-shadow: 0 2px 4px rgba(10,30,60,.3), 0 14px 30px rgba(11,92,173,.5); }
.tab:active { transform: scale(.96); }
.tab svg { position: absolute; width: 28px; height: 28px; transition: transform .3s cubic-bezier(.3,1.4,.5,1), opacity .2s; }
.tab .x { opacity: 0; transform: rotate(-90deg); } .wrap.open .tab .x { opacity: 1; transform: none; } .wrap.open .tab .cap { opacity: 0; transform: rotate(90deg); }
.panel { max-height: calc(100vh - 100px); display: flex; flex-direction: column; align-items: flex-end; gap: 10px; opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 0s linear .4s, visibility 0s linear .4s; }
.wrap.open .panel { opacity: 1; visibility: visible; pointer-events: auto; transition: none; }
.cols { display: flex; flex-direction: row-reverse; align-items: flex-end; gap: 14px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
h2 { margin: 0 0 2px; font-size: 18px; }
.hint { margin: 0 0 6px; color: var(--m); font-size: 13px; }
.sec { margin: 10px 4px 5px; color: var(--m); font-size: 11px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; }
.items { display: grid; gap: 6px; }
.app { width: 100%; display: flex; align-items: center; gap: 12px; padding: 8px 10px; text-align: left; font: inherit; color: inherit; background: var(--card); border: 1px solid var(--line); border-radius: 14px; cursor: pointer; opacity: 0; transform: translateY(10px); transition: background .2s, transform .3s, opacity .3s, border-color .2s, box-shadow .2s; }
.wrap.open .app { opacity: 1; transform: none; transition-delay: calc(var(--i) * 55ms); }
.wrap.open .app:hover:not([aria-disabled="true"]) { background: var(--hover); border-color: var(--hb); box-shadow: 0 6px 18px rgba(11,92,173,.14); transform: translateY(-2px); transition-delay: 0s; }
.app[aria-disabled="true"] { border-style: dashed; cursor: default; } .wrap.open .app[aria-disabled="true"] { opacity: .7; }
.sym { flex: 0 0 38px; width: 38px; height: 38px; display: grid; place-items: center; border-radius: 14px; }
.app[data-fora='true'] { opacity: .55; } .app[data-fora='true']:hover { opacity: .8; }
.g-correcao .sym { background: #e3f0fc; color: #0b5cad; } .g-alunos .sym { background: #e1f5ec; color: #157a4c; } .g-em-breve .sym, .g-ferramentas .sym, .g-mais .sym { background: #eee9fb; color: #5b3fb5; } .g-ajuda-e-dados .sym { background: #eef1f6; color: #4a5a70; }
@media (prefers-color-scheme: dark) { .g-correcao .sym { background: #17324f; color: #7db8f0; } .g-alunos .sym { background: #143a2b; color: #6fd0a0; } .g-em-breve .sym, .g-ferramentas .sym, .g-mais .sym { background: #2a2250; color: #b4a1f2; } .g-ajuda-e-dados .sym { background: #263040; color: #a9b7cc; } }
.txt b { display: block; font-size: 14px; } .txt small { display: block; margin-top: 2px; color: var(--m); font-size: 12px; line-height: 1.3; }
.tag { margin-left: auto; padding: 1px 8px; border-radius: 8px; font-size: 11px; white-space: nowrap; background: var(--line); color: var(--m); }
/* botões circulares do menu principal (FAB): cada ferramenta é um círculo colorido; o nome vira dica */
.stack { display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
.stack .app { position: relative; width: 46px; height: 46px; padding: 0; gap: 0; border: 0; border-radius: 50%; background: transparent; justify-content: center; opacity: 0; transform: scale(0); transform-origin: 50% 100%; transition: transform .22s cubic-bezier(.3,1.5,.5,1), opacity .18s, box-shadow .2s; transition-delay: calc(var(--k) * 30ms); }
.wrap.open .stack .app { opacity: 1; transform: scale(1); transition-delay: calc((6 - var(--k)) * 0ms + var(--k) * 55ms); }
.wrap.open .stack .app:hover:not([aria-disabled="true"]), .wrap.open .stack .app:focus-visible { transform: scale(1.1) translateY(-2px); background: transparent; border-color: transparent; transition-delay: 0s; }
.stack .sym { flex: none; width: 46px; height: 46px; border-radius: 50%; color: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.25), 0 5px 12px rgba(0,0,0,.22); }
.stack .app:hover .sym, .stack .app:focus-visible .sym { box-shadow: 0 2px 4px rgba(0,0,0,.25), 0 10px 20px rgba(0,0,0,.3); }
.stack .g-correcao .sym { background: var(--c-corr); color: #fff; } .stack .g-alunos .sym { background: var(--c-alun); color: #fff; } .stack .g-mais .sym { background: var(--c-mais); color: #fff; }
.stack .app[data-fora='true'], .wrap.open .stack .app[data-fora='true'] { opacity: 1; } .stack .app[data-fora='true'] .sym { background: var(--c-off); box-shadow: none; }
.stack .txt { position: absolute; right: 58px; top: 50%; translate: 6px -50%; max-width: 260px; padding: 7px 10px; border-radius: 8px; background: var(--tipbg); color: var(--tipfg); text-align: left; white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity .15s, translate .15s; }
.stack .txt b { font-size: 13px; font-weight: 600; } .stack .txt small { color: inherit; opacity: .8; font-size: 11.5px; white-space: normal; }
.stack .app:hover .txt, .stack .app:focus-visible .txt { opacity: 1; translate: 0 -50%; } .stack .app[aria-expanded="true"] .txt { opacity: 0; }
.stack .count { position: absolute; top: -3px; left: -3px; margin: 0; min-width: 20px; padding: 0 5px; line-height: 20px; font-size: 11px; background: #14202e; color: #fff; border: 2px solid #fff; border-radius: 99px; } .stack .seta { display: none; }
.drawer { width: min(300px, calc(100vw - 100px)); max-height: calc(100vh - 120px); overflow-y: auto; padding: 14px; border: 1px solid rgba(255,255,255,.6); border-radius: 14px; background: var(--surf); -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); box-shadow: 0 20px 60px rgba(29,42,74,.3); }
@media (prefers-color-scheme: dark) { .drawer { border-color: rgba(255,255,255,.1); } }
.status { min-height: 0; margin: 0; max-width: 300px; color: var(--m); font-size: 12.5px; } .status:empty { display: none; }
.status:not(:empty) { padding: 8px 10px; border-radius: 10px; background: var(--surf); border: 1px solid var(--line); box-shadow: 0 6px 18px rgba(29,42,74,.18); }
.status.err { padding: 8px 10px; border-radius: 8px; background: #fde8e5; color: #8e1b1b; font-weight: 600; }
[hidden] { display: none !important; }
.head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; } .head h2 { margin: 0; font-size: 16px; }
.voltar { width: 34px; height: 34px; flex: 0 0 34px; display: grid; place-items: center; padding: 0; border: 1px solid var(--line); border-radius: 10px; background: var(--card); color: inherit; cursor: pointer; } .voltar svg { width: 18px; height: 18px; }
.count { margin-left: auto; min-width: 22px; padding: 1px 8px; border-radius: 999px; font-size: 12px; text-align: center; background: #5b3fb5; color: #fff; } .app .seta { width: 16px; height: 16px; color: var(--m); flex: 0 0 16px; }
a:focus-visible, button:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
@media (max-width: 540px) { .wrap { right: calc(10px + env(safe-area-inset-right, 0px)); bottom: calc(10px + env(safe-area-inset-bottom, 0px)); } .tab { width: 56px; height: 56px; } .stack { gap: 9px; } .stack .app, .stack .sym { width: 42px; height: 42px; } .stack .txt { right: 54px; } .drawer { padding: 12px; } }
@media print { .wrap { display: none; } }
@media (prefers-reduced-motion: reduce) { * { transition-duration: .01ms !important; transition-delay: 0s !important; animation-duration: .01ms !important; } }
`;

function icon(doc, name, cls) {
  const svg = doc.createElementNS(NS, 'svg');
  if (cls) svg.setAttribute('class', cls);
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  const path = doc.createElementNS(NS, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}
function el(doc, tag, props = {}, ...children) {
  const node = doc.createElement(tag);
  for (const [k, v] of Object.entries(props)) { if (v === undefined || v === null || v === false) continue; if (k === 'class') node.className = v; else node.setAttribute(k, v === true ? '' : v); }
  for (const c of children.flat()) if (c) node.append(c.nodeType ? c : doc.createTextNode(String(c)));
  return node;
}

const slug = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function mountLauncher(doc = document, send = message => chrome.runtime.sendMessage(message), loc = doc.defaultView ? doc.defaultView.location : globalThis.location) {
  if (doc.getElementById('hub-ead-launcher')) return null;
  const host = el(doc, 'div', { id: 'hub-ead-launcher' });
  const shadow = host.attachShadow({ mode: 'open' });
  const style = el(doc, 'style'); style.textContent = CSS;

  const status = el(doc, 'p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const items = [];
  const tipo = loc ? tipoDaPagina(loc) : 'outra';
  const makeButton = (app, extra = {}) => {
    const button = el(doc, 'button', { type: 'button', class: 'app', 'data-app': app.id, style: `--i:${items.length + 1}`, 'aria-disabled': app.disponivel ? 'false' : 'true', 'data-fora': app.disponivel && !aplicaNaPagina(app, tipo) ? 'true' : null },
      el(doc, 'span', { class: 'sym' }, icon(doc, app.icone)),
      el(doc, 'span', { class: 'txt' }, el(doc, 'b', {}, app.nome), el(doc, 'small', {}, app.disponivel && !aplicaNaPagina(app, tipo) && app.dicaPagina ? `${app.descricao} · ${app.dicaPagina}` : app.descricao)),
      app.disponivel ? null : el(doc, 'span', { class: 'tag' }, 'em breve'), ...(extra.filhos || []));
    button.addEventListener('click', extra.onClick || (() => run(app, button)));
    items.push(button);
    return button;
  };
  const secoes = (lista, ordem) => ordem.flatMap(grupo => {
    const apps = lista.filter(a => a.grupo === grupo); if (!apps.length) return [];
    return [el(doc, 'div', { class: 'sec' }, grupo), el(doc, 'div', { class: `items g-${slug(grupo)}` }, ...apps.map(a => makeButton(a)))];
  });
  const principais = APPS.filter(a => !a.gaveta);
  const daGaveta = APPS.filter(a => a.gaveta);
  const ferrApp = { id: 'ferramentas', nome: 'Ferramentas', descricao: 'Kahoot, modelo de perguntas, ajuda e dados', icone: 'ferr2', disponivel: true };
  const botoes = principais.map(a => makeButton(a));
  const ferrBtn = makeButton(ferrApp, { onClick: () => (drawerView.hidden ? showView('gaveta') : showView('main')), filhos: [el(doc, 'span', { class: 'count' }, String(daGaveta.filter(a => a.disponivel).length)), icon(doc, 'seta', 'seta')] });
  ferrBtn.setAttribute('aria-expanded', 'false');
  const grupoClasse = a => `g-${slug(a.grupo)}`;
  [...botoes, ferrBtn].forEach((b, i, todos) => { b.style.setProperty('--k', String(todos.length - 1 - i)); const app = [...principais, ferrApp][i]; b.classList.add(app === ferrApp ? 'g-mais' : grupoClasse(app)); });
  const mainView = el(doc, 'div', { class: 'view stack', 'data-view': 'main' },
    el(doc, 'h2', { class: 'sr' }, 'Unidigit@l Assist'),
    el(doc, 'p', { class: 'sr' }, 'Nada roda sozinho: cada ferramenta só age quando você clica.'), ...botoes, ferrBtn);
  const voltarBtn = el(doc, 'button', { type: 'button', class: 'voltar', 'aria-label': 'Voltar ao menu', title: 'Voltar' }, icon(doc, 'voltar'));
  voltarBtn.addEventListener('click', () => showView('main'));
  const drawerView = el(doc, 'div', { class: 'view drawer', 'data-view': 'gaveta', hidden: true },
    el(doc, 'div', { class: 'head' }, voltarBtn, el(doc, 'h2', {}, 'Ferramentas')),
    el(doc, 'p', { class: 'hint' }, 'As que não se aplicam a esta página aparecem esmaecidas.'), ...secoes(daGaveta, ['Ferramentas', 'Ajuda e dados']));
  const panel = el(doc, 'section', { class: 'panel', id: 'hub-panel', 'aria-label': 'Unidigit@l Assist', inert: true }, el(doc, 'div', { class: 'cols' }, mainView, drawerView), status);
  const tab = el(doc, 'button', { type: 'button', class: 'tab', 'aria-label': 'Abrir Unidigit@l Assist', 'aria-expanded': 'false', 'aria-controls': 'hub-panel', title: 'Unidigit@l Assist' }, icon(doc, 'ferr', 'cap'), icon(doc, 'close', 'x'));
  const wrap = el(doc, 'nav', { class: 'wrap', 'aria-label': 'Unidigit@l Assist' }, panel, tab);
  shadow.append(style, wrap);

  let busy = false;
  const isOpen = () => wrap.classList.contains('open');
  const setStatus = (text, error = false) => { status.textContent = text; status.className = error ? 'status err' : 'status'; };
  const setOpen = value => {
    wrap.classList.toggle('open', value);
    panel.toggleAttribute('inert', !value);
    tab.setAttribute('aria-expanded', String(value));
    tab.setAttribute('aria-label', value ? 'Fechar Unidigit@l Assist' : 'Abrir Unidigit@l Assist');
  };
  function showView(name) {
    drawerView.hidden = name !== 'gaveta'; ferrBtn.setAttribute('aria-expanded', String(name === 'gaveta')); setStatus('');
    (name === 'gaveta' ? voltarBtn : (name === 'main' && isOpen() ? ferrBtn : (items.find(i => i.getAttribute('aria-disabled') !== 'true') || tab))).focus();
  }
  const open = () => { showView('main'); setOpen(true); (items.find(i => i.getAttribute('aria-disabled') !== 'true') || tab).focus(); };
  const close = () => { setOpen(false); drawerView.hidden = true; ferrBtn.setAttribute('aria-expanded', 'false'); tab.focus(); };

  function baixarModelo() {
    const a = el(doc, 'a', { href: URL.createObjectURL(new Blob(['\uFEFF' + MODELO_KAHOOT], { type: 'text/csv;charset=utf-8' })), download: 'modelo-perguntas-kahoot.csv' });
    shadow.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); // dentro do Shadow DOM: o clique não conta como "fora do menu"
  }
  async function run(app, button, motivo) {
    if (!app.disponivel) { setStatus(`${app.nome} ainda não está disponível.`); return; }
    if (!aplicaNaPagina(app, tipo) && motivo !== 'retomar') { setStatus(`${app.nome} não se aplica a esta página. ${app.dicaPagina || ''}.`.replace('..', '.')); return; }
    if (app.local === 'modelo-kahoot') { baixarModelo(); setStatus('Modelo baixado: preencha e use em Kahoot — importar perguntas.'); return; }
    if (busy) return;
    busy = true; button.setAttribute('aria-busy', 'true'); setStatus('Abrindo…');
    try {
      const response = await send(motivo ? { type: 'hub-open', app: app.id, motivo } : { type: 'hub-open', app: app.id });
      if (!response || !response.ok) { setStatus((response && response.error) || 'A extensão não respondeu. Recarregue a página e tente de novo.', true); return; }
      if (isOpen()) close();
    } catch (error) {
      setStatus('A extensão não respondeu. Recarregue a página e tente de novo.', true);
    } finally { busy = false; button.removeAttribute('aria-busy'); }
  }

  // Continuação de algo que o usuário JÁ pediu: (1) Correção numa atividade fora da tela de avaliação, que navega até ela;
  // (2) conferência do que foi salvo (o Moodle recarrega a página ao salvar). Só vale por poucos minutos e só uma vez.
  function continuarPedido() {
    let store = null; try { store = (doc.defaultView || globalThis).sessionStorage; } catch (_) { return; }
    if (!store) return;
    // Conferir datas: há uma fila guardada nesta aba (a pessoa clicou em Aplicar): preenche a edição ou confere o que foi salvo.
    try { if (store.getItem('hub.datas.v1')) { const d = APPS.find(a => a.id === 'conferir-datas'); run(d, items.find(i => i.getAttribute('data-app') === 'conferir-datas'), 'retomar'); } } catch (_) { /* sem continuação */ }
    if (tipo !== 'atividade') return;
    const app = APPS.find(a => a.id === 'correcao');
    try {
      const raw = store.getItem('hub.continuar.v1');
      if (raw) {
        store.removeItem('hub.continuar.v1');
        const data = JSON.parse(raw);
        if (data && data.app === 'correcao' && Date.now() - data.at < 120000) { run(app, items.find(i => i.getAttribute('data-app') === 'correcao'), 'continuar'); return; }
      }
      if (store.getItem('imn_verify_v1')) run(app, items.find(i => i.getAttribute('data-app') === 'correcao'), 'retomar');
    } catch (_) { /* sem continuação */ }
  }

  tab.addEventListener('click', () => (isOpen() ? close() : open()));
  doc.addEventListener('keydown', event => { if (event.key === 'Escape' && isOpen()) close(); });
  doc.addEventListener('click', event => { if (isOpen() && !event.composedPath().includes(host)) setOpen(false); });
  doc.documentElement.append(host);
  continuarPedido();
  return { host, shadow, tab, panel, items, status, open, close, isOpen };
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && typeof document !== 'undefined' && !globalThis.__HUB_TEST__) mountLauncher();

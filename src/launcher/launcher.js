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
.wrap { position: fixed; right: 16px; bottom: 96px; z-index: 2147483000; pointer-events: none; display: flex; align-items: flex-end; gap: 14px; font: 14px/1.4 Inter, -apple-system, "Segoe UI", system-ui, sans-serif; color: #14202e; --p: #0b5cad; --p2: #0a3f78; --m: #5b6b7c; --line: #dbe3ec; --surf: rgba(255,255,255,.93); --card: #f8fafd; --hover: #eef5fc; --hb: #b9d3ee; --focus: #f6b900; }
@media (prefers-color-scheme: dark) { .wrap { color: #e6ecf5; --m: #9aa8bd; --line: #2b3646; --surf: rgba(26,33,44,.94); --card: #212a37; --hover: #263446; --hb: #3b5877; } }
svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.tab { pointer-events: auto; width: 56px; height: 56px; display: grid; place-items: center; flex-shrink: 0; padding: 0; border: 0; border-radius: 18px; background: linear-gradient(135deg, var(--p), var(--p2)); color: #fff; cursor: pointer; box-shadow: 0 10px 26px rgba(11,92,173,.35); transition: transform .25s, box-shadow .25s; }
.tab:hover { transform: scale(1.07); box-shadow: 0 14px 32px rgba(11,92,173,.45); }
.tab svg { width: 26px; height: 26px; }
.tab .x { display: none; } .wrap.open .tab .x { display: block; } .wrap.open .tab .cap { display: none; }
.panel { width: min(348px, calc(100vw - 100px)); max-height: calc(100vh - 112px); overflow-y: auto; padding: 16px; border: 1px solid rgba(255,255,255,.6); border-radius: 14px; background: var(--surf); -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); box-shadow: 0 20px 60px rgba(29,42,74,.3); opacity: 0; visibility: hidden; transform: translateX(24px) scale(.96); transform-origin: right bottom; pointer-events: none; transition: opacity .3s ease, transform .3s ease, visibility .3s; }
@media (prefers-color-scheme: dark) { .panel { border-color: rgba(255,255,255,.1); } }
.wrap.open .panel { opacity: 1; visibility: visible; transform: none; pointer-events: auto; }
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
.status { min-height: 0; margin: 8px 0 0; color: var(--m); font-size: 12.5px; }
.status.err { padding: 8px 10px; border-radius: 8px; background: #fde8e5; color: #8e1b1b; font-weight: 600; }
[hidden] { display: none !important; }
.head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; } .head h2 { margin: 0; font-size: 16px; }
.voltar { width: 34px; height: 34px; flex: 0 0 34px; display: grid; place-items: center; padding: 0; border: 1px solid var(--line); border-radius: 10px; background: var(--card); color: inherit; cursor: pointer; } .voltar svg { width: 18px; height: 18px; }
.count { margin-left: auto; min-width: 22px; padding: 1px 8px; border-radius: 999px; font-size: 12px; text-align: center; background: #5b3fb5; color: #fff; } .app .seta { width: 16px; height: 16px; color: var(--m); flex: 0 0 16px; }
a:focus-visible, button:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
@media (max-width: 540px) { .wrap { right: 12px; bottom: 80px; } .tab { width: 52px; height: 52px; } .panel { padding: 14px; } }
@media print { .wrap { display: none; } }
@media (prefers-reduced-motion: reduce) { * { transition-duration: .01ms !important; animation-duration: .01ms !important; } }
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
      el(doc, 'span', { class: 'txt' }, el(doc, 'b', {}, app.nome), el(doc, 'small', {}, app.descricao)),
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
  const mainSections = secoes(principais, [...new Set(principais.map(a => a.grupo))]);
  const ferrApp = { id: 'ferramentas', nome: 'Ferramentas', descricao: 'Kahoot, modelo de perguntas, ajuda e dados', icone: 'ferr2', disponivel: true };
  const ferrBtn = makeButton(ferrApp, { onClick: () => showView('gaveta'), filhos: [el(doc, 'span', { class: 'count' }, String(daGaveta.filter(a => a.disponivel).length)), icon(doc, 'seta', 'seta')] });
  mainSections.push(el(doc, 'div', { class: 'sec' }, 'Mais'), el(doc, 'div', { class: 'items g-mais' }, ferrBtn));
  const mainView = el(doc, 'div', { class: 'view', 'data-view': 'main' },
    el(doc, 'h2', {}, 'Unidigit@l Assist'),
    el(doc, 'p', { class: 'hint' }, 'Nada roda sozinho: cada ferramenta só age quando você clica.'), ...mainSections);
  const voltarBtn = el(doc, 'button', { type: 'button', class: 'voltar', 'aria-label': 'Voltar ao menu', title: 'Voltar' }, icon(doc, 'voltar'));
  voltarBtn.addEventListener('click', () => showView('main'));
  const drawerView = el(doc, 'div', { class: 'view', 'data-view': 'gaveta', hidden: true },
    el(doc, 'div', { class: 'head' }, voltarBtn, el(doc, 'h2', {}, 'Ferramentas')),
    el(doc, 'p', { class: 'hint' }, 'As que não se aplicam a esta página aparecem esmaecidas.'), ...secoes(daGaveta, ['Ferramentas', 'Ajuda e dados']));
  const panel = el(doc, 'section', { class: 'panel', id: 'hub-panel', 'aria-label': 'Unidigit@l Assist', inert: true }, mainView, drawerView, status);
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
    mainView.hidden = name !== 'main'; drawerView.hidden = name !== 'gaveta'; setStatus('');
    (name === 'gaveta' ? voltarBtn : (items.find(i => i.getAttribute('aria-disabled') !== 'true') || tab)).focus();
  }
  const open = () => { showView('main'); setOpen(true); };
  const close = () => { setOpen(false); mainView.hidden = false; drawerView.hidden = true; tab.focus(); };

  function baixarModelo() {
    const a = el(doc, 'a', { href: URL.createObjectURL(new Blob(['\uFEFF' + MODELO_KAHOOT], { type: 'text/csv;charset=utf-8' })), download: 'modelo-perguntas-kahoot.csv' });
    shadow.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); // dentro do Shadow DOM: o clique não conta como "fora do menu"
  }
  async function run(app, button, motivo) {
    if (!app.disponivel) { setStatus(`${app.nome} ainda não está disponível.`); return; }
    if (!aplicaNaPagina(app, tipo)) { setStatus(`${app.nome} não se aplica a esta página. ${app.dicaPagina || ''}.`.replace('..', '.')); return; }
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
    if (!store || tipo !== 'atividade') return;
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

// Botão lateral das ferramentas EaD. Roda em toda página do Moodle permitido, mas SÓ desenha o botão:
// não consulta o Moodle, não lê a página e não injeta nada até você clicar numa ferramenta.
import { APPS, MENU, APOIO, tipoDaPagina, aplicaNaPagina, MODELO_KAHOOT } from '../apps.js';

const NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  // capelo (educação) + chave (ferramentas)
  ferr: 'M1.5 8.5L10 4.5l8.5 4-8.5 4zM5 10.6v3.6c0 1.2 2.2 2.2 5 2.2M18.5 8.5v4M21.6 14.4a3 3 0 0 1-3.9 3.7L13.4 22.4a1.4 1.4 0 0 1-2-2l4.3-4.3a3 3 0 0 1 3.7-3.9l-1.7 1.7.4 1.6 1.6.4z',
  pend: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2',
  corr: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
  acomp: 'M4 19V5M4 19h16M8 15l4-4 3 3 5-6',
  blo: 'M5.4 4h3.7a1.4 1.4 0 0 1 1.4 1.4v3.7a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 9.1V5.4A1.4 1.4 0 0 1 5.4 4zM14.9 4h3.7A1.4 1.4 0 0 1 20 5.4v3.7a1.4 1.4 0 0 1-1.4 1.4h-3.7a1.4 1.4 0 0 1-1.4-1.4V5.4A1.4 1.4 0 0 1 14.9 4zM5.4 13.5h3.7a1.4 1.4 0 0 1 1.4 1.4v3.7A1.4 1.4 0 0 1 9.1 20H5.4A1.4 1.4 0 0 1 4 18.6v-3.7a1.4 1.4 0 0 1 1.4-1.4zM16.7 13.5V20M13.5 16.7H20',
  rel: 'M5 20V10M12 20V4M19 20v-7',
  turma: 'M4 5h16v4H4zM4 11h16v4H4zM4 17h10v3H4zM18 17l2 2 3-3',
  alun: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11a3 3 0 1 0 0-6M21 20c0-2.5-1.6-4.6-4-5.5',
  diag: 'M12 3.2l7.5 2.8v5.6c0 4.6-3.2 7.8-7.5 9.2-4.3-1.4-7.5-4.6-7.5-9.2V6zM8.8 12l2.2 2.2 4.2-4.4',
  dados: 'M5 6a7 3 0 1 0 14 0 7 3 0 1 0-14 0zM5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3',
  info: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 11v5.2M12 7.9v.1',
  kahoot: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.6 9.2a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1.9-1.1 1.7M12 16.6v.1',
  modelo: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 11v6M9.5 14.5L12 17l2.5-2.5',
  ferr2: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5a1.4 1.4 0 0 0 2 2l5.8-5.8a4 4 0 0 0 5.4-5.4l-2.4 2.4-1.7-.4-.4-1.7z',
  voltar: 'M15 5l-7 7 7 7',
  seta: 'M9 5l7 7-7 7',
  close: 'M6 6l12 12M18 6L6 18',
  ampul: 'M7 3h10M7 21h10M8 3v3a4 4 0 0 0 1.6 3.2L12 12l-2.4 2.8A4 4 0 0 0 8 18v3M16 3v3a4 4 0 0 1-1.6 3.2L12 12l2.4 2.8A4 4 0 0 1 16 18v3',
  docok: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 14l2 2 4-4',
  capelo: 'M2 9l10-5 10 5-10 5zM6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9v6',
  relat: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 17v-3M12 17v-5M15 17v-2',
  calok: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4',
  calcro: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3M13 14h3M8 17h3',
  criar: 'M7.5 4h9A3.5 3.5 0 0 1 20 7.5v9a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 16.5v-9A3.5 3.5 0 0 1 7.5 4zM12 8v8M8 12h8',
  alunos: 'M9 4.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zM3 19.5c0-3.4 2.7-5.3 6-5.3s6 1.9 6 5.3M17.2 6.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8zM16.6 14.4c2.6.2 4.4 1.7 4.4 4.4',
  correcao: 'M7.2 4.5h9.6A2.2 2.2 0 0 1 19 6.7v12.1a2.2 2.2 0 0 1-2.2 2.2H7.2A2.2 2.2 0 0 1 5 18.8V6.7a2.2 2.2 0 0 1 2.2-2.2zM9 4.5v-1h6v1M9 13l2.1 2.1 4.2-4.1',
  datas: 'M6.4 5.5h11.2A2.4 2.4 0 0 1 20 7.9v9.7a2.4 2.4 0 0 1-2.4 2.4H6.4A2.4 2.4 0 0 1 4 17.6V7.9a2.4 2.4 0 0 1 2.4-2.4zM4 10h16M8.5 3.5v4M15.5 3.5v4',
  relatorio: 'M5 20v-9M12 20V4.5M19 20v-6.5',
  engrenagem: 'M12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zM19.4 13.5a7.5 7.5 0 0 0 0-3l1.9-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5a7.6 7.6 0 0 0-2.6 1.5l-2.3-.9-2 3.4L4.6 10.5a7.5 7.5 0 0 0 0 3L2.7 15l2 3.4 2.3-.9c.8.7 1.7 1.2 2.6 1.5l.4 2.5h4l.4-2.5c.9-.3 1.8-.8 2.6-1.5l2.3.9 2-3.4z',
  fechar: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  volta: 'M19 12H5M11 6l-6 6 6 6',
  sobe: 'M6 14l6-6 6 6',
  desce: 'M6 10l6 6 6-6'
};

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.wrap { position: fixed; right: env(safe-area-inset-right, 0px); bottom: var(--bt, 96px); width: 0; height: 0; z-index: 2147483000; pointer-events: none; font: 14px/1.4 Inter, -apple-system, "Segoe UI", system-ui, sans-serif; color: #14202e; --p: #1a4b9f; --p2: #123a7d; --laranja: #ef5e31; --m: #55657a; --line: #d6dee9; --surf: rgba(255,255,255,.97); --card: #f8fafd; --hover: #e8f0fa; --hb: #1a4b9f; --focus: #f6b900; --ring: #14202e; --c-ico: #1a4b9f; --c-tint: #e6eefc; --c-ink: #1a4b9f; --c-off: #657587; --c-selo: #c2410c; --alerta: #b3261e; --pw: 280px; }
@media (prefers-color-scheme: dark) { .wrap { color: #e6ecf5; --m: #9aa8bd; --line: #2e3a4b; --surf: rgba(27,36,49,.98); --card: #222d3b; --hover: #263446; --hb: #6b9be0; --ring: #e6ecf5; --c-ico: #3a69c0; --c-tint: #22314a; --c-ink: #8fb3f0; --c-off: #6f7d8f; --c-selo: #d9541c; --alerta: #ff8a80; } }
svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
/* lingueta na borda direita: 24 px (32 no hover); a área de toque de 44 px vem do ::before invisível */
.tab { pointer-events: auto; position: absolute; right: 0; bottom: 0; width: 24px; height: 64px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; padding: 0; border: 0; border-radius: 14px 0 0 14px; background: linear-gradient(135deg, var(--p), var(--p2)); color: #fff; cursor: pointer; box-shadow: inset 4px 0 0 var(--laranja), -2px 4px 12px rgba(26,75,159,.45); transition: width .22s cubic-bezier(.3,1.4,.5,1), right .34s cubic-bezier(.2,.9,.3,1); }
.tab::before { content: ""; position: absolute; inset: -10px 0 -10px -20px; }
.tab:hover, .tab:focus-visible { width: 32px; }
.tab svg { width: 16px; height: 16px; flex: none; }
.tab .seta-aba { transition: transform .34s cubic-bezier(.3,1.4,.5,1); }
.tab .dica { position: absolute; right: 40px; top: 50%; translate: 6px -50%; padding: 5px 9px; border-radius: 7px; background: #14202e; color: #fff; font-size: 12px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .15s, translate .15s; }
.tab:hover .dica, .tab:focus-visible .dica { opacity: 1; translate: 0 -50%; }
.wrap.open .tab { right: var(--pw); width: 32px; } .wrap.open .tab .seta-aba { transform: rotate(180deg); } .wrap.open .tab .dica { opacity: 0; }
.tab .selo { position: absolute; top: -8px; left: -8px; min-width: 20px; padding: 0 5px; line-height: 20px; font-size: 11px; font-weight: 700; text-align: center; border-radius: 99px; background: var(--c-selo); color: #fff; border: 2px solid #fff; }
.wrap.pulsa .tab { animation: pulso 1.6s ease-in-out 2; }
@keyframes pulso { 0%, 100% { box-shadow: inset 4px 0 0 var(--laranja), -2px 4px 12px rgba(26,75,159,.45); } 50% { box-shadow: inset 4px 0 0 var(--laranja), 0 0 0 9px rgba(26,75,159,.22), -2px 4px 12px rgba(26,75,159,.5); } }
.panel { position: absolute; right: 0; bottom: calc(12px - var(--bt, 96px)); width: var(--pw); max-width: calc(100vw - 56px); max-height: calc(100vh - 24px); overflow-y: auto; padding: 14px 12px 12px; border: 1px solid var(--line); border-right: 0; border-radius: 16px 0 0 16px; background: var(--surf); -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); box-shadow: 0 14px 40px rgba(20,40,70,.3); transform: translateX(105%); opacity: 0; visibility: hidden; pointer-events: none; transition: transform .34s cubic-bezier(.2,.9,.3,1), opacity .2s, visibility 0s linear .34s; }
.wrap.open .panel { transform: none; opacity: 1; visibility: visible; pointer-events: auto; transition: transform .34s cubic-bezier(.2,.9,.3,1), opacity .2s, visibility 0s; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
h2 { margin: 0; font-size: 16px; flex: 1; }
.top { display: flex; align-items: center; gap: 2px; margin: 0 0 6px; padding: 0 2px; } .top .ib { width: 34px; height: 34px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 10px; background: transparent; color: var(--c-ink); cursor: pointer; } .top .ib:hover { background: var(--c-tint); } .top .ib svg { width: 20px; height: 20px; }
.hint { margin: 0 0 6px; color: var(--m); font-size: 13px; }
.sec { margin: 10px 4px 5px; color: var(--m); font-size: 12px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; }
.items { display: grid; gap: 4px; }
.app { width: 100%; min-height: 46px; display: flex; align-items: center; gap: 12px; padding: 6px 8px; text-align: left; font: inherit; color: inherit; background: transparent; border: 1px solid transparent; border-radius: 12px; cursor: pointer; opacity: 0; transform: translateX(14px); transition: background .15s, border-color .15s, transform .3s, opacity .3s; }
.wrap.open .app { opacity: 1; transform: none; transition-delay: calc(var(--i) * 45ms + 120ms); }
.wrap.open .app:hover:not([aria-disabled="true"]) { background: var(--hover); border-color: var(--hb); transition-delay: 0s; }
.app[aria-disabled="true"] { border-style: dashed; border-color: var(--line); cursor: default; }
.sym { flex: 0 0 34px; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px; color: var(--c-ink); background: var(--c-tint); transition: background .15s, color .15s; }
.sym svg { width: 20px; height: 20px; stroke-width: 1.75; }
.wrap.open .app:hover:not([aria-disabled="true"]) .sym, .app:focus-visible .sym { background: var(--c-ico); color: #fff; }
.app[aria-disabled='true'] .sym { color: var(--c-off); }
.txt { min-width: 0; } .txt b { display: block; font-size: 14px; font-weight: 600; }
.tag { margin-left: auto; flex: none; max-width: 92px; padding: 1px 8px; border-radius: 8px; font-size: 11.5px; line-height: 1.3; text-align: center; background: var(--line); color: var(--m); }
.count { margin-left: auto; flex: none; min-width: 22px; padding: 1px 8px; border-radius: 999px; font-size: 12px; text-align: center; background: var(--c-selo); color: #fff; }
.app .seta { width: 16px; height: 16px; color: var(--m); flex: 0 0 16px; transition: transform .25s; } .app[aria-expanded="true"] .seta { transform: rotate(90deg); }
.sec { margin: 8px 4px 4px; color: var(--m); font-size: 12px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; }
.status { margin: 6px 2px 0; color: var(--m); font-size: 12.5px; } .status:empty { display: none; }
.status:not(:empty) { padding: 7px 9px; border-radius: 9px; background: var(--hover); }
.status.err { background: #fde8e5; color: #8e1b1b; font-weight: 600; }
[hidden] { display: none !important; }
.rodape { display: flex; align-items: center; gap: 6px; margin: 8px 2px 0; padding-top: 8px; border-top: 1px solid var(--line); color: var(--m); font-size: 12px; }
.rodape span { margin-right: auto; }
.rodape.ponto::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #1b7a3d; flex: none; }
.mover-linha { display: flex; align-items: center; gap: 6px; margin: 8px 2px 0; padding-top: 8px; border-top: 1px solid var(--line); color: var(--m); font-size: 12.5px; } .mover-linha span { margin-right: auto; }
.mover { width: 32px; height: 32px; display: grid; place-items: center; padding: 0; border: 1px solid var(--line); border-radius: 9px; background: var(--card); color: inherit; cursor: pointer; } .mover svg { width: 16px; height: 16px; }
a:focus-visible, button:focus-visible { outline: 2px solid var(--ring); outline-offset: 1px; box-shadow: 0 0 0 5px var(--focus); }
@media (max-width: 540px) { .app { padding: 10px 8px; } .wrap { --pw: calc(100vw - 56px); } }
@media (max-height: 480px) { .wrap { --bt: 24px; } }
@media print { .wrap { display: none; } }
@media (prefers-reduced-motion: reduce) { * { transition-duration: .01ms !important; transition-delay: 0s !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; } }
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
  const porId = id => APPS.find(a => a.id === id);
  const makeButton = (app, extra = {}) => {
    const button = el(doc, 'button', { type: 'button', class: `app ${extra.classe || ''}`.trim(), 'data-app': extra.id || app.id, style: `--i:${items.length + 1}`, 'aria-disabled': app.disponivel ? 'false' : 'true', title: extra.dica || app.descricao },
      el(doc, 'span', { class: 'sym' }, icon(doc, extra.icone || app.icone)),
      el(doc, 'span', { class: 'txt' }, el(doc, 'b', {}, extra.nome || app.rotulo || app.nome)),
      app.disponivel ? null : el(doc, 'span', { class: 'tag' }, 'em breve'), ...(extra.filhos || []));
    button.addEventListener('click', extra.onClick || (() => run(app, button)));
    items.push(button);
    return button;
  };
  const ib = (nome, ic, onClick, id) => { const b = el(doc, 'button', { type: 'button', class: 'ib', 'aria-label': nome, title: nome, 'data-ctl': id }, icon(doc, ic)); b.addEventListener('click', onClick); return b; };

  // Cada ferramenta existe uma vez (mesmos ids de antes). As que não servem nesta página ficam num depósito oculto: não aparecem, mas a continuação de um pedido (ex.: Conferir datas) ainda as encontra.
  const deposito = el(doc, 'div', { hidden: true, 'data-deposito': '' });
  const views = {};
  const novaView = (nome, titulo, voltar, ...filhos) => {
    const topo = el(doc, 'div', { class: 'top' }, voltar ? ib('Voltar', 'volta', () => showView('main'), 'voltar') : null, el(doc, 'h2', {}, titulo), ...(nome === 'main' ? [ib('Ajuda e dados', 'engrenagem', () => showView('apoio'), 'apoio'), ib('Fechar o menu', 'fechar', () => close(), 'fechar')] : []));
    const v = el(doc, 'div', { class: 'view', 'data-view': nome, hidden: nome !== 'main' }, topo, ...filhos); views[nome] = v; return v;
  };
  const listaMain = el(doc, 'div', { class: 'items g-menu' });
  MENU.forEach(m => {
    const apps = m.apps.map(porId).filter(Boolean);
    const vale = apps.filter(a => a.disponivel && aplicaNaPagina(a, tipo) && !(m.fora || []).includes(tipo));
    apps.forEach(a => { if (!vale.includes(a)) deposito.append(makeButton(a)); });
    if (!vale.length) return;
    if (vale.length === 1) { listaMain.append(makeButton(vale[0], { nome: m.nome, icone: m.icone })); return; }
    const filhosBtns = vale.map(a => makeButton(a));
    novaView(`grupo-${m.id}`, m.nome, true, el(doc, 'div', { class: 'items' }, ...filhosBtns));
    listaMain.append(makeButton({ id: `grupo-${m.id}`, nome: m.nome, icone: m.icone, disponivel: true, descricao: vale.map(a => a.rotulo || a.nome).join(' · ') }, { onClick: () => showView(`grupo-${m.id}`), filhos: [icon(doc, 'seta', 'seta')] }));
  });
  const moverBtn = (nome, ic, passo) => { const b = el(doc, 'button', { type: 'button', class: 'mover', 'aria-label': nome, title: nome }, icon(doc, ic)); b.addEventListener('click', () => moverAba(passo)); return b; };
  const apoioLista = el(doc, 'div', { class: 'items g-apoio' }, ...APOIO.map(porId).filter(Boolean).map(a => makeButton(a)));
  const moverLinha = el(doc, 'div', { class: 'mover-linha' }, el(doc, 'span', {}, 'Mover aba'), moverBtn('Subir a aba', 'sobe', 48), moverBtn('Descer a aba', 'desce', -48));
  novaView('main', 'Unidigit@l Assist', false, listaMain, el(doc, 'div', { class: 'rodape ponto' }, el(doc, 'span', {}, 'Só age quando você clica')));
  novaView('apoio', 'Ajuda e dados', true, apoioLista, moverLinha);
  const panel = el(doc, 'section', { class: 'panel', id: 'hub-panel', 'aria-label': 'Unidigit@l Assist', inert: true }, ...Object.values(views), status, deposito);
  const tab = el(doc, 'button', { type: 'button', class: 'tab', 'aria-label': 'Abrir Unidigit@l Assist', 'aria-expanded': 'false', 'aria-controls': 'hub-panel', 'aria-keyshortcuts': 'Alt+U' }, icon(doc, 'capelo'), icon(doc, 'voltar', 'seta-aba'), el(doc, 'span', { class: 'dica' }, 'Unidigit@l Assist (Alt+U)'));
  const wrap = el(doc, 'nav', { class: 'wrap pulsa', 'aria-label': 'Unidigit@l Assist' }, panel, tab);
  shadow.append(style, wrap);

  // Altura da aba: sobe/desce de 48 em 48 px; lembrada neste navegador (chrome.storage.local, chave uas.aba) quando disponível.
  const area = () => { try { return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local ? chrome.storage.local : null; } catch (_) { return null; } };
  let altura = 96;
  const aplicaAltura = () => wrap.style.setProperty('--bt', `${altura}px`);
  function moverAba(passo) {
    const maximo = Math.max(24, ((doc.defaultView && doc.defaultView.innerHeight) || 800) - 200);
    altura = Math.min(maximo, Math.max(24, altura + passo)); aplicaAltura();
    try { const a = area(); if (a) a.set({ 'uas.aba': { v: 1, bottom: altura } }); } catch (_) { /* sem guardar */ }
  }
  try { const a = area(); if (a) Promise.resolve(a.get('uas.aba')).then(r => { const v = r && r['uas.aba']; if (v && Number.isFinite(v.bottom)) { altura = Math.min(2000, Math.max(24, v.bottom)); aplicaAltura(); } }).catch(() => {}); } catch (_) { /* sem altura guardada */ }

  let busy = false;
  const isOpen = () => wrap.classList.contains('open');
  const setStatus = (text, error = false) => { status.textContent = text; status.className = error ? 'status err' : 'status'; };
  const setOpen = value => {
    wrap.classList.toggle('open', value); wrap.classList.remove('pulsa');
    panel.toggleAttribute('inert', !value);
    tab.setAttribute('aria-expanded', String(value));
    tab.setAttribute('aria-label', value ? 'Fechar Unidigit@l Assist' : 'Abrir Unidigit@l Assist');
  };
  function showView(name) {
    Object.entries(views).forEach(([k, v]) => { v.hidden = k !== name; }); setStatus('');
    const alvo = views[name]; const primeiro = alvo && (alvo.querySelector('.app') || alvo.querySelector('.ib')); if (primeiro && name !== 'main') primeiro.focus();
    if (name === 'main') { const b = views.main.querySelector('.app'); if (b) b.focus(); }
  }
  const primeiroDisponivel = () => items.find(i => i.getAttribute('aria-disabled') !== 'true' && !i.closest('[hidden]')) || tab;
  const open = () => { Object.entries(views).forEach(([k, v]) => { v.hidden = k !== 'main'; }); setStatus(''); setOpen(true); primeiroDisponivel().focus(); };
  const close = () => { setOpen(false); Object.entries(views).forEach(([k, v]) => { v.hidden = k !== 'main'; }); tab.focus(); };
  // Setas ↑ ↓ andam entre as ferramentas visíveis.
  panel.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const lista = items.filter(i => !i.closest('[hidden]')); if (!lista.length) return;
    const atual = lista.indexOf(shadow.activeElement); const prox = event.key === 'ArrowDown' ? (atual + 1) % lista.length : (atual <= 0 ? lista.length - 1 : atual - 1);
    event.preventDefault(); lista[prox].focus();
  });

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
  doc.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isOpen()) close();
    else if (event.altKey && !event.ctrlKey && !event.metaKey && String(event.key).toLowerCase() === 'u') { event.preventDefault(); if (isOpen()) close(); else open(); }
  });
  doc.addEventListener('click', event => { if (isOpen() && !event.composedPath().includes(host)) setOpen(false); });
  doc.documentElement.append(host);
  continuarPedido();
  return { host, shadow, tab, panel, items, status, open, close, isOpen };
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && typeof document !== 'undefined' && !globalThis.__HUB_TEST__) mountLauncher();

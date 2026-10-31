// Painel lateral do módulo Alunos e notas (Shadow DOM). Só abre quando o usuário clica na ferramenta do menu e
// só lê o Moodle quando clica em "Ler". Todo texto vindo da página entra por textContent.
(function (root) {
  'use strict';
  const ALN = root.ALN;
  const HOST_ID = 'hub-aln-host';
  const TABS = [['alunos', 'Alunos'], ['notas', 'Notas'], ['acomp', 'Acompanhamento'], ['relatorio', 'Relatório da UC']];
  const ICON = {
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
    down: '<path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/>', copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>', send: '<path d="M21 4L3 11l7 3 3 7z"/><path d="M10 14l11-10"/>'
  };
  const CSS = `
:host{all:initial}*{box-sizing:border-box}
.drawer{--p:#0b5cad;--pd:#0a3f78;--ink:#14202e;--mut:#5b6b7c;--bd:#dbe3ec;--bg:#f3f6fa;--bg2:#e8eef5;--s:#fff;--ok:#13795b;--okbg:#e3f5ee;--wn:#9a5b00;--wnbg:#fff3dc;--wnbd:#f0d58a;--er:#b42318;--erbg:#fde8e6;--inf:#e6f0fb;--r1:8px;--r2:14px}
@media (prefers-color-scheme:dark){.drawer{--ink:#e6edf5;--mut:#a9b6c5;--bd:#2f3d4f;--bg:#121a24;--bg2:#243246;--s:#1a2431;--ok:#5fd0a6;--okbg:#14382d;--wn:#f0b45a;--wnbg:#3a2c12;--wnbd:#6b4f1d;--er:#ff8a7e;--erbg:#43201c;--inf:#16314f;--p:#5aa6f0}}
.drawer{position:fixed;top:0;right:0;bottom:0;width:min(680px,100vw);z-index:2147483000;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);font:14px/1.4 system-ui,sans-serif;box-shadow:-6px 0 24px rgba(0,0,0,.25)}
header{background:linear-gradient(135deg,#0b5cad,#0a3f78);color:#fff;padding:12px 16px;display:flex;gap:10px;align-items:center}header div{flex:1;min-width:0}header b{font-size:16px;display:block}header small{opacity:.9;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
button,select,input{font:inherit}
.ib{width:40px;height:40px;border-radius:8px;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.12);color:#fff;display:grid;place-items:center;cursor:pointer}
.ib svg,.btn svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
nav{display:flex;background:var(--s);border-bottom:1px solid var(--bd);padding:0 8px;overflow-x:auto}
nav button{border:0;background:none;padding:12px 12px;color:var(--mut);border-bottom:3px solid transparent;cursor:pointer;white-space:nowrap}nav button[aria-selected=true]{color:var(--p);border-color:var(--p);font-weight:600}
.bar{display:flex;gap:8px;align-items:center;padding:10px 16px;background:var(--s);border-bottom:1px solid var(--bd);flex-wrap:wrap}
.bar input[type=search]{flex:1;min-width:140px;height:40px;border:1px solid var(--bd);border-radius:8px;padding:0 12px}
.bar select{height:40px;border:1px solid var(--bd);border-radius:8px;padding:0 8px;background:var(--s);max-width:230px}
.btn{height:40px;min-width:40px;border-radius:8px;border:1px solid var(--bd);background:var(--s);color:var(--p);font-weight:600;display:inline-flex;gap:6px;align-items:center;justify-content:center;padding:0 10px;cursor:pointer}.btn.pri{background:var(--p);color:#fff;border-color:var(--p)}.btn:disabled{opacity:.5;cursor:default}
:focus-visible{outline:3px solid #f6b900;outline-offset:1px}
.cov{padding:8px 16px;font-size:12.5px;color:var(--mut);display:flex;gap:10px;align-items:center;flex-wrap:wrap}.chip{padding:2px 10px;border-radius:999px;font-weight:600;font-size:12px}.ok{background:var(--okbg);color:var(--ok)}.warn{background:var(--wnbg);color:var(--wn)}
.warnbox{margin:0 16px 8px;padding:8px 12px;background:var(--wnbg);border:1px solid var(--wnbd);border-radius:8px;font-size:12.5px}.warnbox p{margin:2px 0}
.body{padding:8px 16px 16px;overflow:auto;flex:1}
.empty{text-align:center;color:var(--mut);padding:48px 16px}.empty .btn{margin-top:12px}
.err{margin:12px 16px;padding:10px 12px;background:var(--erbg);color:var(--er);border-radius:8px}
table{width:100%;border-collapse:collapse;background:var(--s);border:1px solid var(--bd)}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid var(--bd);font-size:13px;vertical-align:top}th{background:var(--bg2);color:var(--mut);font-size:12px;position:sticky;top:0}
.n{text-align:right;font-variant-numeric:tabular-nums}.low{color:var(--er);font-weight:600}.blank{color:var(--mut)}
.pill{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap}
.media{background:var(--okbg);color:var(--ok)}.recuperacao{background:var(--wnbg);color:var(--wn)}.abaixo{background:var(--erbg);color:var(--er)}.sem_nota,.nao_identificado,.verificar{background:var(--bg2);color:var(--mut)}
.regular{background:var(--okbg);color:var(--ok)}.atencao{background:var(--wnbg);color:var(--wn)}.alto{background:var(--erbg);color:var(--er)}.imediato{background:var(--er);color:#fff}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:8px 0 12px}.card{background:var(--s);border:1px solid var(--bd);border-radius:var(--r2);padding:12px}.card b{font-size:22px;display:block}.card span{color:var(--mut);font-size:12px}
.sec{font-weight:600;margin:14px 0 8px}.why{color:var(--mut);font-size:12px;display:block}
.stack{display:flex;height:22px;border-radius:6px;overflow:hidden;background:var(--bg2)}.stack i{display:block}
.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--mut);margin-top:6px}.legend u{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px}
.row{display:grid;grid-template-columns:minmax(120px,210px) 1fr minmax(90px,130px);gap:10px;align-items:center;margin:7px 0;font-size:13px}.track{height:14px;background:var(--bg2);border-radius:999px;overflow:hidden}.track i{display:block;height:100%;background:var(--p)}
.scroll{overflow-x:auto}

.contacted{background:var(--inf);color:var(--p)}.actions{display:flex;gap:6px}
.mback{position:absolute;inset:0;background:rgba(10,20,35,.5);display:grid;place-items:center;padding:16px;z-index:5}
.modal{width:min(560px,100%);max-height:100%;overflow:auto;background:var(--s);color:var(--ink);border-radius:var(--r2);padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
.modal h3{margin:0 0 2px;font-size:17px}.modal textarea{width:100%;min-height:150px;border:1px solid var(--bd);border-radius:var(--r1);padding:10px;font:inherit;resize:vertical;margin-top:8px}
.modal .note{background:var(--wnbg);border:1px solid var(--wnbd);border-radius:var(--r1);padding:8px 10px;font-size:12.5px;margin:8px 0}
.modal .row2{display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}.modal label{display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:13px}
.res{margin-top:10px;padding:8px 10px;border-radius:var(--r1);font-size:13px}.res.ok{background:var(--okbg);color:var(--ok)}.res.warn{background:var(--wnbg);color:var(--wn)}.res.bad{background:var(--erbg);color:var(--er)}

nav button.off{opacity:.55}
.panelbody{padding:16px;overflow:auto;flex:1}
.box{background:var(--s);border:1px solid var(--bd);border-radius:var(--r2);padding:16px}
.big{font-size:17px;font-weight:700;margin:0 0 4px}.sub{color:var(--mut);margin:0 0 14px}.hint{color:var(--mut);font-size:12.5px;margin:10px 0 0}
.btn.wide{width:100%;height:44px}.stackbtn{display:grid;gap:8px;margin-top:14px}
.linkbtn{border:0;background:none;color:var(--p);font-weight:600;cursor:pointer;padding:6px 0;text-align:left}
.prog{height:10px;border-radius:999px;background:var(--bg2);overflow:hidden;margin:12px 0 6px}.prog i{display:block;height:100%;width:40%;border-radius:999px;background:linear-gradient(90deg,var(--p),#3b8be0);background-size:200% 100%;animation:flow 1.4s linear infinite}
@keyframes flow{to{background-position:-200% 0}}
.stp{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:var(--r1);background:var(--bg);margin:6px 0;font-size:13.5px}.stp.bad{background:var(--erbg)}.stp.todo{color:var(--mut)}.stp em{margin-left:auto;font-style:normal;color:var(--mut);font-size:12.5px}
.dot{flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:12px;color:#fff;font-weight:700;background:#9fb0c3}.dot.ok2{background:var(--ok)}.dot.go{background:var(--p)}.dot.no{background:var(--er)}
.partial{margin:12px 16px 0;background:var(--s);border:1px solid var(--bd);border-radius:var(--r2);padding:14px}

.filters{display:grid;gap:8px;margin:4px 0 10px}.fgroup{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.flabel{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--mut);font-weight:700;min-width:92px}
.fchip{border:1px solid var(--bd);background:var(--s);color:var(--ink);border-radius:999px;padding:4px 12px;font:600 12.5px system-ui,sans-serif;cursor:pointer}.fchip b{color:var(--mut);font-weight:600;margin-left:5px}.fchip.on{background:var(--p);border-color:var(--p);color:#fff}.fchip.on b{color:#dbe9f8}
.resline{display:flex;gap:8px;align-items:center;font-size:12.5px;color:var(--mut);margin:0 0 8px}.resline b{color:var(--ink)}
.mini{display:inline-flex;gap:3px;vertical-align:middle}.mini i{width:11px;height:11px;border-radius:3px;background:var(--ok);display:block}.mini i.x{background:var(--bd)}
.old{color:var(--er);font-weight:700}.thbtn{border:0;background:none;color:inherit;font:inherit;font-weight:700;cursor:pointer;padding:0;text-align:left}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.btn.sq{width:36px;padding:0}
.sumbar{background:var(--s);border:1px solid var(--bd);border-radius:var(--r2);padding:10px 14px;display:flex;gap:18px;flex-wrap:wrap;margin:8px 0 12px}.sumbar div{font-size:12px;color:var(--mut)}.sumbar b{display:block;font-size:20px;color:var(--ink);line-height:1.1}.sumbar b.tok{color:var(--ok)}.sumbar b.twn{color:var(--wn)}.sumbar b.ter{color:var(--er)}
.stud{width:100%;text-align:left;background:var(--s);color:var(--ink);border:1px solid var(--bd);border-radius:var(--r2);padding:12px;display:grid;grid-template-columns:40px 1.3fr 1fr 1fr 18px;gap:12px;align-items:center;margin:8px 0;cursor:pointer;font:inherit}.stud:hover{border-color:var(--p)}
.av{width:40px;height:40px;border-radius:50%;background:var(--inf);color:var(--p);display:grid;place-items:center;font-weight:800}.av.big{width:52px;height:52px;font-size:18px}
.stud b{display:block}.stud small{display:block;color:var(--mut);font-size:12px}.stud small.old{color:var(--er);font-weight:700}.sub2{margin-top:4px}.go{color:var(--p);font-size:20px}
.bar2{display:block;height:8px;background:var(--bg2);border-radius:999px;position:relative;margin:5px 0 3px;overflow:visible}.bar2 i{display:block;height:100%;border-radius:999px}.bar2 u{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--ink);opacity:.55}
.hdr{display:flex;gap:12px;align-items:center;margin:4px 0}.hdr h3{margin:0;font-size:19px}.hdr .pill{margin-left:auto}
.k4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}.k4>div{background:var(--bg);border-radius:var(--r1);padding:10px}.k4 b{font-size:22px;display:block;line-height:1.1}.k4 b.low{color:var(--er)}.k4 span{font-size:12px;color:var(--mut)}
.why2{margin:0;padding-left:18px;font-size:13px}.why2 li{margin:3px 0}
.ar{display:grid;grid-template-columns:140px 1fr 52px;gap:10px;align-items:center;font-size:13px;margin:7px 0}.ar .n{text-align:right}
.tag{display:inline-block;font-size:11px;background:var(--inf);color:var(--p);border-radius:999px;padding:1px 8px;font-weight:700;margin-left:6px}.note2{background:var(--wnbg);border-radius:var(--r1);padding:6px 10px}.contact{font-size:13px;margin:4px 0}
.more{margin-top:14px}.more summary{cursor:pointer;font-weight:700;color:var(--p);padding:6px 0}
@media (max-width:560px){.stud{grid-template-columns:40px 1fr 18px}.stud>span:nth-child(3),.stud>span:nth-child(4){grid-column:2}.k4{grid-template-columns:repeat(2,1fr)}}
.mini i.w{background:var(--wn)}.mini i.e{background:var(--er)}
.ftable td,.ftable th{padding:8px 8px}.bar2.mini2{width:70px;display:inline-block;margin:0 0 0 8px;vertical-align:middle}.tag.late{background:var(--erbg);color:var(--er)}
.pend{border:1px solid var(--bd);border-radius:var(--r1);margin:8px 0;overflow:hidden}.pend .ph{background:var(--bg);padding:7px 10px;font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--mut);font-weight:700}.pend label{display:flex;gap:8px;align-items:center;padding:7px 10px;border-top:1px solid var(--bd);font-size:13px}.pend em{margin-left:auto;font-style:normal;font-size:12px;color:var(--mut)}
@media (prefers-reduced-motion:reduce){.prog i{animation:none}}
@media print{.drawer{position:static;width:auto;box-shadow:none}}`;

  function h(tag, attrs, ...kids) {
    const el = root.document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => { if (v == null || v === false) return; if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v); });
    kids.flat().forEach(c => { if (c == null || c === false) return; el.append(c.nodeType ? c : root.document.createTextNode(String(c))); });
    return el;
  }
  const svg = name => { const s = root.document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = ICON[name]; return s; }; // ícones fixos do código, sem dado externo
  const iconBtn = (cls, name, label, onclick, text) => h('button', { class: cls, type: 'button', 'aria-label': label, title: label, onclick }, svg(name), text || null);
  const pill = (cls, text) => h('span', { class: `pill ${cls}` }, text);
  const pct = v => (v == null ? '—' : `${Math.round(v)}%`);

  function download(name, text, type) {
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: type || 'text/csv;charset=utf-8' })), download: name });
    root.document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const slug = s => String(s || 'curso').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'curso';

  function open(initialTab) {
    let host = root.document.getElementById(HOST_ID);
    if (host && host.__api) { host.__api.show(initialTab); return host.__api; }
    host = h('div', { id: HOST_ID });
    host.style.cssText = 'all:initial';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.append(h('style', {}, CSS));
    const st = { tab: initialTab || 'alunos', data: ALN.reader.cached(), busy: false, progress: '', step: '', secs: 0, abort: null, error: '', copied: false, search: '', f: { access: 'todos', graded: 'todos', pend: 'todos', situation: 'todos' }, sortKey: 'name', sortDir: 'asc', rv: 'todos', ficha: null, tdata: ALN.tarefas.cached(), tbusy: false, tmsg: '', tsecs: 0, tabort: null, terr: '', fSituation: 'todos', fLevel: 'todos', onlyBelow: false, category: '', contacts: {}, modal: null };
    const drawer = h('div', { class: 'drawer', role: 'dialog', 'aria-label': 'Alunos e notas' });
    shadow.append(drawer);
    root.document.documentElement.append(host);

    const settings = ALN.DEFAULTS;
    const visibleCategory = () => st.category;
    const studentsFiltered = () => {
      const q = st.search.trim().toLowerCase();
      return (st.data ? st.data.students : []).filter(s => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
    };

    const loadContacts = async () => { try { if (st.data) st.contacts = await ALN.messenger.loadLog(st.data.course); } catch (_) { st.contacts = {}; } };
    const lastContact = s => { const l = st.contacts[s.key]; return l && l.length ? l[l.length - 1] : null; };
    const hhmm = t => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // resume=true continua de onde parou (repete só o que falhou); senão lê tudo de novo.
    async function read(resume) {
      if (st.busy) return;
      const again = resume === true && ALN.reader.canResume();
      st.busy = true; st.error = ''; st.secs = 0; st.progress = again ? 'Continuando a leitura' : 'Começando a leitura'; st.step = '';
      st.abort = new root.AbortController();
      if (!again) st.data = null; // nova leitura: não mostra números antigos como se fossem novos
      render();
      const timer = root.setInterval(() => { st.secs += 1; const el = shadow.querySelector('[data-elapsed]'); if (el) el.textContent = `${st.secs} s`; }, 1000);
      try { st.data = await ALN.reader.readCourse({ resume: again, signal: st.abort.signal, onProgress: p => { if (p.step) st.step = p.step; st.progress = p.text; renderStatusOnly(); if (p.step) renderSteps(); } }); }
      catch (e) { st.error = e && e.message ? e.message : String(e); }
      root.clearInterval(timer);
      st.busy = false; st.abort = null; await loadContacts(); render();
    }
    function renderSteps() { const el = shadow.querySelector('[data-steps]'); if (el) el.replaceChildren(...stepRows()); }
    function cancelRead() { if (st.abort) st.abort.abort(); }
    async function copyDiag(e) {
      const b = e.currentTarget;
      const text = JSON.stringify({ ferramenta: 'Unidigit@l Assist', leitura: ALN.reader.diagnostics(), entregas: ALN.tarefas.diagnostics(), erro: st.error || null, avisos: st.data ? st.data.warnings : [] }, null, 2);
      try { await root.navigator.clipboard.writeText(text); b.textContent = 'Diagnóstico copiado'; } catch (_) { b.textContent = 'Não consegui copiar'; }
      root.setTimeout(() => { b.textContent = 'Copiar diagnóstico'; }, 2500);
    }
    function renderStatusOnly() { const el = shadow.querySelector('[data-progress]'); if (el) el.textContent = st.progress; }

    const covLine = () => {
      if (st.busy) return h('div', { class: 'cov' }, h('span', { class: 'chip warn' }, 'Lendo…'), h('span', { 'data-progress': '' }, st.progress));
      if (!st.data) return null;
      const c = st.data.coverage, when = new Date(st.data.readAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return h('div', { class: 'cov' }, h('span', { class: `chip ${c.complete ? 'ok' : 'warn'}` }, c.complete ? 'Leitura completa' : 'Leitura parcial'),
        `${c.students} aluno(s) · ${st.data.gradebook.items.filter(ALN.isActivityItem).length} atividade(s) · último acesso de ${c.withAccess}/${c.students} · lida às ${when}`,
        h('span', { style: 'margin-left:auto' }, 'Dados só neste navegador'));
    };
    const warnBox = () => (st.data && st.data.warnings.length ? h('div', { class: 'warnbox', role: 'status' }, st.data.warnings.map(w => h('p', {}, w))) : null);
    const categorySelect = () => {
      const cats = st.data ? ALN.categoriesOf(st.data.gradebook) : [];
      if (!cats.length) return null;
      return h('select', { 'aria-label': 'Categoria ou UC', onchange: e => { st.category = e.target.value; render(); } },
        h('option', { value: '' }, 'Todo o curso'), cats.map(c => h('option', { value: c, selected: c === st.category }, c)));
    };
    const search = () => h('input', { type: 'search', placeholder: 'Buscar aluno ou e-mail', 'aria-label': 'Buscar aluno ou e-mail', value: st.search, oninput: e => { st.search = e.target.value; renderBody(); } });
    const readBtn = () => iconBtn(st.data && st.data.pending && st.data.pending.length ? 'btn' : 'btn pri', 'refresh', st.data ? 'Ler de novo' : 'Ler alunos e notas', read, st.data ? 'Atualizar' : 'Ler');
    const csvBtn = (label, fn) => iconBtn('btn', 'down', label, fn, 'CSV');

    // ---- abas ----
    // ---- entregas das atividades (leitura à parte, só ao clicar; "Continuar" repete só o que falhou) ----
    const STATE_LABEL = { avaliada: 'entregue e avaliada', aguardando: 'entregue, aguardando correção', sem_entrega: 'sem entrega', sem_nota: 'sem nota' };
    const STATE_PILL = { avaliada: 'media', aguardando: 'recuperacao', sem_entrega: 'abaixo', sem_nota: 'sem_nota' };
    let ovKey = '';
    function ensureOv() {
      if (!st.data) return;
      const key = `${st.data.readAt}|${st.tdata ? st.tdata.readAt : 0}`;
      if (key === ovKey) return;
      ovKey = key;
      const acts = st.data.gradebook.items.filter(ALN.isActivityItem);
      st.data.students.forEach(s => { s.ov = ALN.tarefas.overview(s, acts, st.tdata); s.pendCount = s.ov.pendencias.length; s.waitingCount = s.ov.counts.aguardando; });
    }
    const entregasLidas = () => Boolean(st.tdata && st.data && st.data.students.some(s => s.ov && s.ov.readEntregas));
    async function readEntregas(resume) {
      if (st.tbusy) return;
      const again = resume === true && ALN.tarefas.canResume();
      st.tbusy = true; st.terr = ''; st.tsecs = 0; st.tmsg = again ? 'Continuando a leitura' : 'Começando a leitura'; st.tabort = new root.AbortController();
      render();
      const timer = root.setInterval(() => { st.tsecs += 1; const el = shadow.querySelector('[data-tsecs]'); if (el) el.textContent = `${st.tsecs} s`; }, 1000);
      try { st.tdata = await ALN.tarefas.read({ resume: again, signal: st.tabort.signal, onProgress: p => { st.tmsg = p.text; const el = shadow.querySelector('[data-tprogress]'); if (el) el.textContent = p.text; } }); }
      catch (e) { st.terr = e && e.message ? e.message : String(e); }
      root.clearInterval(timer);
      st.tbusy = false; st.tabort = null; ovKey = ''; render();
    }
    function entregasCard() {
      if (st.tbusy) return h('div', { class: 'partial', role: 'status' }, h('p', { class: 'big' }, 'Lendo entregas… ', h('span', { 'data-tsecs': '' }, `${st.tsecs} s`)), h('div', { class: 'prog', role: 'progressbar', 'aria-label': 'Leitura das entregas em andamento' }, h('i')),
        h('p', { class: 'hint', 'data-tprogress': '', style: 'margin:0' }, st.tmsg), h('div', { class: 'stackbtn' }, h('button', { type: 'button', class: 'btn', onclick: () => { if (st.tabort) st.tabort.abort(); } }, 'Cancelar')));
      const keep = ALN.tarefas.canResume();
      if (st.terr) return h('div', { class: 'partial', role: 'alert' }, h('p', { class: 'big' }, /cancelada/i.test(st.terr) ? 'Leitura das entregas cancelada' : 'Não foi possível ler as entregas'), /cancelada/i.test(st.terr) ? null : h('p', { class: 'sub', style: 'margin-bottom:8px' }, st.terr),
        h('div', { class: 'stackbtn' }, iconBtn('btn pri wide', 'refresh', keep ? 'Continuar a leitura' : 'Tentar de novo', () => readEntregas(true), keep ? 'Continuar de onde parou' : 'Tentar de novo'), diagBtn()));
      const t = st.tdata;
      if (!t) return h('div', { class: 'partial' }, h('p', { class: 'big' }, 'Quem entregou cada atividade?'),
        h('p', { class: 'sub', style: 'margin-bottom:10px' }, 'Hoje “pendente” significa só “sem nota”. Leia as entregas para separar “sem entrega” de “aguardando a sua correção”.'),
        iconBtn('btn pri wide', 'refresh', 'Ler entregas das atividades', () => readEntregas(false), 'Ler entregas'), h('p', { class: 'hint' }, 'Uma consulta por atividade; costuma levar cerca de 1 minuto.'));
      if (t.pending.length) {
        return h('div', { class: 'partial', role: 'status' }, h('p', { class: 'big' }, 'Entregas incompletas'), h('p', { class: 'sub', style: 'margin-bottom:8px' }, 'As atividades já lidas estão guardadas. Faltam:'),
          t.pending.map(x => h('div', { class: 'stp bad' }, dot('no', '!'), h('b', {}, x.name), h('em', {}, /tempo limite/i.test(x.reason) ? 'demorou demais' : 'não lida'))),
          h('div', { class: 'stackbtn' }, iconBtn('btn pri wide', 'refresh', `Continuar: ler ${t.pending.length} atividade(s)`, () => readEntregas(true), `Continuar: ler ${t.pending.length} atividade(s)`), h('button', { type: 'button', class: 'btn', onclick: () => readEntregas(false) }, 'Ler entregas de novo'), diagBtn()));
      }
      return h('div', { class: 'resline', style: 'margin:8px 16px 0' }, h('span', { class: 'chip ok' }, `Entregas lidas às ${hhmm(t.readAt)}`), `${t.assignments.length} atividade(s)`, h('button', { type: 'button', class: 'linkbtn', style: 'margin-left:auto', onclick: () => readEntregas(false) }, 'Atualizar entregas'));
    }

    // ---- filtros em chips (um clique; clicar no chip ativo limpa o grupo) ----
    const F = ALN.filters;
    const activities = () => st.data.gradebook.items.filter(ALN.isActivityItem);
    const withQ = () => ({ ...st.f, q: st.search });
    function chipGroup(group) {
      const g = F.GROUPS[group], c = F.counts(st.data.students, withQ(), group);
      const chip = (id, label) => h('button', { type: 'button', class: `fchip${st.f[group] === id ? ' on' : ''}`, 'aria-pressed': st.f[group] === id ? 'true' : 'false', onclick: () => { st.f[group] = st.f[group] === id ? 'todos' : id; renderBody(); } }, label, h('b', {}, String(c[id] ?? 0)));
      return h('div', { class: 'fgroup', role: 'group', 'aria-label': g.label }, h('span', { class: 'flabel' }, g.label), chip('todos', 'Todos'), g.options.filter(([id]) => !(group === 'pend' && id === 'aguardando' && !entregasLidas())).map(([id, label]) => chip(id, label)));
    }
    function miniBar(s) {
      const cls = { avaliada: '', aguardando: 'w', sem_entrega: 'e', sem_nota: 'x' };
      return h('span', { class: 'mini', role: 'img', 'aria-label': `${s.ov.entregues} de ${s.itemCount} atividades entregues ou com nota`, title: s.ov.byItem.map(x => `${x.name}: ${STATE_LABEL[x.state]}`).join('\n') },
        s.ov.byItem.map(x => h('i', { class: cls[x.state] })));
    }
    const sortTh = (key, label, cls) => h('th', { class: cls || '', 'aria-sort': st.sortKey === key ? (st.sortDir === 'asc' ? 'ascending' : 'descending') : 'none' },
      h('button', { type: 'button', class: 'thbtn', onclick: () => { st.sortDir = st.sortKey === key && st.sortDir === 'asc' ? 'desc' : 'asc'; st.sortKey = key; renderBody(); } }, label, st.sortKey === key ? (st.sortDir === 'asc' ? ' ▴' : ' ▾') : ''));

    function viewAlunos() {
      const all = st.data.students;
      const list = F.sortStudents(F.filterStudents(all, withQ()), st.sortKey, st.sortDir);
      const active = F.activeCount(withQ());
      const toolbar = h('div', { class: 'bar' }, search(), readBtn(), csvBtn('Exportar alunos em CSV', () => download(`alunos-${slug(st.data.course.name)}.csv`, ALN.studentsCsv(list))));
      const filters = h('div', { class: 'filters' }, chipGroup('access'), chipGroup('graded'), chipGroup('pend'), chipGroup('situation'));
      const resumo = h('div', { class: 'resline' }, `Mostrando ${list.length} de ${all.length} aluno(s)`, active ? h('button', { type: 'button', class: 'linkbtn', style: 'margin-left:auto', onclick: () => { st.f = { access: 'todos', graded: 'todos', pend: 'todos', situation: 'todos' }; st.search = ''; render(); } }, 'Limpar filtros') : null);
      const table = h('table', {}, h('thead', {}, h('tr', {}, sortTh('name', 'Aluno'), sortTh('access', 'Último acesso'), sortTh('graded', 'Itens com nota'), h('th', { class: 'n' }, 'Pendentes'), sortTh('total', 'Nota', 'n'), sortTh('situation', 'Situação'), h('th', {}, h('span', { class: 'sr' }, 'Mensagem')))),
        h('tbody', {}, list.map(s => h('tr', {}, h('td', {}, s.profileUrl ? h('a', { href: s.profileUrl, target: '_blank', rel: 'noopener' }, s.name) : s.name, contactMark(s)),
          h('td', { class: F.accessTone(s) === 'old' ? 'old' : '' }, s.accessKnown ? s.lastAccessText : h('span', { class: 'blank' }, 'não lido')),
          h('td', {}, miniBar(s), ` ${s.ov.entregues}/${s.itemCount}`),
          h('td', { class: 'n' }, s.pendCount ? h('b', {}, String(s.pendCount)) : h('span', { class: 'blank' }, '0')),
          h('td', { class: `n ${s.totalPct != null && s.totalPct < settings.minimumGrade ? 'low' : ''}` }, s.totalDisplay || '—'),
          h('td', {}, pill(s.situation, ALN.SITUATION_LABEL[s.situation])),
          h('td', {}, canSend(s) ? iconBtn('btn sq', 'send', `Enviar mensagem a ${s.name}`, () => openModal(s)) : null)))));
      return [toolbar, covLine(), warnBox(), h('div', { class: 'body' }, filters, resumo, list.length ? h('div', { class: 'scroll' }, table) : h('p', { class: 'empty' }, 'Nenhum aluno com esses filtros.'),
        h('span', { class: 'why' }, entregasLidas() ? '“Pendentes” = atividades que o Moodle mostra como sem entrega. Quem entregou e espera a sua correção não conta como pendente.' : '“Pendentes” conta itens sem nota; ainda não diz se o aluno entregou (pode estar aguardando a sua correção). Use “Ler entregas” acima para saber.'))];
    }
    function viewNotas() {
      const gb = st.data.gradebook, cat = visibleCategory();
      const items = gb.items.filter(ALN.isActivityItem).filter(it => !cat || it.category === cat);
      const list = studentsFiltered().filter(s => !st.onlyBelow || (s.totalPct != null && s.totalPct < settings.minimumGrade));
      const rep = ALN.buildReport(st.data.students, gb, settings, cat);
      const below = h('label', { style: 'display:flex;gap:6px;align-items:center' }, h('input', { type: 'checkbox', checked: st.onlyBelow, onchange: e => { st.onlyBelow = e.target.checked; renderBody(); } }), 'Só abaixo da média');
      const toolbar = h('div', { class: 'bar' }, search(), categorySelect(), below, readBtn(), csvBtn('Exportar notas em CSV', () => download(`notas-${slug(st.data.course.name)}.csv`, ALN.gradesCsv(list, gb, cat))));
      const head = h('tr', {}, h('th', {}, 'Aluno'), ...items.map(it => h('th', { class: 'n', title: it.name }, it.name.split('›').pop().trim(), it.maxGrade != null ? h('span', { class: 'why' }, `máx. ${it.maxGrade}`) : null)), h('th', { class: 'n' }, 'Total'));
      const rows = list.map(s => h('tr', {}, h('td', {}, s.name), ...items.map(it => { const g = s.grades[it.key]; const v = g ? g.value : null; const p = ALN.toPct(v, it.maxGrade); return h('td', { class: `n ${v === null ? 'blank' : p < settings.minimumGrade ? 'low' : ''}` }, v === null ? '—' : g.display || String(v)); }), h('td', { class: 'n' }, h('b', {}, s.totalDisplay || '—'))));
      const foot = h('tr', {}, h('td', {}, h('b', {}, 'Média da turma')), ...items.map(it => { const x = rep.perItem.find(p => p.key === it.key); return h('td', { class: 'n' }, x && x.avg != null ? ALN.fmt(x.avg) : '—'); }), h('td', { class: 'n' }, h('b', {}, rep.meanPct == null ? '—' : ALN.fmt(rep.meanPct))));
      return [toolbar, covLine(), warnBox(), h('div', { class: 'body' }, h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, head), h('tbody', {}, rows, foot))),
        h('span', { class: 'why' }, '“—” = sem nota lançada (não é zero). A nota máxima de cada item vem do livro de notas do Moodle.'))];
    }
    const LEVELS = ['imediato', 'alto', 'atencao', 'verificar', 'regular'];
    function viewAcomp() {
      const all = studentsFiltered();
      const list = all.filter(s => st.fLevel === 'todos' ? s.risk.level !== 'regular' : s.risk.level === st.fLevel).sort((a, b) => LEVELS.indexOf(a.risk.level) - LEVELS.indexOf(b.risk.level) || b.risk.score - a.risk.score);
      const counts = LEVELS.reduce((o, k) => (o[k] = (st.data.students.filter(s => s.risk.level === k)).length, o), {});
      const sel = h('select', { 'aria-label': 'Filtrar por nível', onchange: e => { st.fLevel = e.target.value; renderBody(); } },
        ['todos', ...LEVELS].map(k => h('option', { value: k, selected: k === st.fLevel }, k === 'todos' ? 'Precisam de atenção' : ALN.LEVEL_LABEL[k])));
      const toolbar = h('div', { class: 'bar' }, search(), sel, readBtn(), csvBtn('Exportar lista de contato em CSV', () => download(`acompanhamento-${slug(st.data.course.name)}.csv`, ALN.riskCsv(list.length ? list : all))));
      const cards = h('div', { class: 'cards' }, LEVELS.map(k => h('div', { class: 'card' }, h('b', {}, counts[k]), h('span', {}, ALN.LEVEL_LABEL[k]))));
      const table = h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Aluno'), h('th', {}, 'Nível'), h('th', {}, 'Motivos e próxima ação'), h('th', {}, ''))),
        h('tbody', {}, list.map(s => h('tr', {}, h('td', {}, h('b', {}, s.name), contactMark(s)), h('td', {}, pill(s.risk.level, ALN.LEVEL_LABEL[s.risk.level])),
          h('td', {}, s.risk.reasons.length ? s.risk.reasons.map(r => r.text).join(' · ') : (s.risk.unknown.length ? `Sem leitura de: ${s.risk.unknown.join(', ')}` : ''), h('span', { class: 'why' }, `→ ${s.risk.action}`)),
          h('td', {}, h('div', { class: 'actions' },
            iconBtn('btn', 'send', canSend(s) ? `Enviar mensagem a ${s.name} pelo Moodle` : `Não dá para enviar a ${s.name}: identificador do aluno não reconhecido`, () => openModal(s)),
            iconBtn('btn', 'copy', `Copiar mensagem para ${s.name}`, async e => { const b = e.currentTarget; try { await root.navigator.clipboard.writeText(ALN.contactText(s, st.data.course.name)); b.title = 'Copiado'; b.style.color = '#13795b'; } catch (_) { b.title = 'Não foi possível copiar'; } })))))));
      return [toolbar, covLine(), warnBox(), h('div', { class: 'body' }, cards, list.length ? table : h('p', { class: 'empty' }, 'Ninguém neste nível.'),
        h('span', { class: 'why' }, 'Aluno sem leitura de acesso ou de nota aparece como “Verificar”, nunca como regular. “Enviar” manda pelo Moodle, com a sua conta, só depois de você revisar e confirmar; “Copiar” só copia o texto. Contato registrado não significa problema resolvido.'),
        h('button', { class: 'btn', type: 'button', style: 'margin-top:8px', onclick: async e => { const b = e.currentTarget; if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.lastChild.textContent = 'Clique de novo para apagar o registro deste curso'; return; } await ALN.messenger.clearLog(st.data.course); st.contacts = {}; render(); } }, svg('close'), 'Apagar registro de contatos'))];
    }
    const RV = [['todos', 'Todos', () => true], ['atencao', 'Precisam de atenção', F.needsAttention], ['pend', 'Com pendência', x => x.pendCount > 0], ['aguardando', 'Aguardando minha correção', x => x.waitingCount > 0], ['acc15', 'Sem acesso +15d', x => x.accessKnown && x.lastAccessDays != null && x.lastAccessDays >= 15], ['em_dia', 'Em dia', x => x.pendCount === 0]];
    const dayOf = iso => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '');
    const perItemMap = () => { const rep = ALN.buildReport(st.data.students, st.data.gradebook, settings, ''); return { rep, byKey: new Map(rep.perItem.map(x => [x.key, x])) }; };
    const accessText = s => (s.accessKnown ? (s.lastAccessDays >= 9999 ? 'nunca acessou' : s.lastAccessDays >= 1 ? `há ${s.lastAccessDays} dia(s) sem acessar` : 'acessou hoje') : 'último acesso não lido');

    function studentCard(s) {
      const tone = s.totalPct == null ? 'var(--bd)' : s.totalPct >= settings.minimumGrade ? 'var(--ok)' : s.totalPct >= settings.recoveryMin ? 'var(--wn)' : 'var(--er)';
      const lc = lastContact(s), read = s.ov.readEntregas;
      return h('button', { type: 'button', class: 'stud', onclick: () => { st.ficha = s.key; renderBody(); }, 'aria-label': `Abrir ficha de ${s.name}` },
        h('span', { class: 'av', 'aria-hidden': 'true' }, F.initials(s.name)),
        h('span', { class: 'sname' }, h('b', {}, s.name), h('small', { class: F.accessTone(s) === 'old' ? 'old' : '' }, accessText(s)), miniBar(s)),
        h('span', {}, pill(s.risk.level, ALN.LEVEL_LABEL[s.risk.level]), h('small', { class: 'sub2' }, read ? `${s.pendCount} sem entrega · ${s.ov.entregues}/${s.itemCount} entregues` : `${s.pendCount} sem nota · ${s.itemsGraded}/${s.itemCount} com nota`, s.waitingCount ? ` · ${s.waitingCount} aguardando` : '', lc ? ' · contatado' : '')),
        h('span', { class: 'sgrade' }, h('b', {}, s.totalPct == null ? 'Sem nota' : `Nota ${s.totalDisplay || ALN.fmt(s.totalPct)}`),
          h('span', { class: 'bar2' }, h('i', { style: `width:${Math.max(0, Math.min(100, s.totalPct || 0))}%;background:${tone}` }), h('u', { style: `left:${settings.minimumGrade}%` })), h('small', { class: 'sub2' }, `média mínima ${settings.minimumGrade}`)),
        h('span', { class: 'go', 'aria-hidden': 'true' }, '›'));
    }

    // Modelo do relatório em HTML (todos os alunos; respeita a categoria/UC escolhida).
    function reportModel() {
      const gb = st.data.gradebook, cat = visibleCategory();
      const items = activities().filter(it => !cat || it.category === cat);
      const rep = ALN.buildReport(st.data.students, gb, settings, cat);
      const students = st.data.students.map(s => {
        const ov = ALN.tarefas.overview(s, items, st.tdata);
        return {
          name: s.name, email: s.email, level: s.risk.level, levelLabel: ALN.LEVEL_LABEL[s.risk.level], situationLabel: ALN.SITUATION_LABEL[s.situation],
          totalDisplay: s.totalDisplay || '', totalPct: s.totalPct, accessKnown: s.accessKnown, accessDays: s.accessKnown ? s.lastAccessDays : null,
          itemCount: items.length, entregues: ov.entregues, pend: ov.pendencias.length, reasons: s.risk.reasons.map(r => r.text), unknown: s.risk.unknown, action: s.risk.action,
          activities: ov.byItem.map(x => ({ name: x.name, state: x.state, display: x.display, dueText: dayOf(x.due), overdue: x.overdue })),
          contacts: (st.contacts[s.key] || []).map(c => ({ at: c.at, confirmed: c.confirmed }))
        };
      });
      const read = st.data.students.some(s => ALN.tarefas.overview(s, items, st.tdata).readEntregas);
      return {
        course: st.data.course, readAt: Date.now(), categoryLabel: cat || 'Todo o curso', minimumGrade: settings.minimumGrade, recoveryMin: settings.recoveryMin,
        warnings: st.data.warnings, entregasLidas: read, entregasPendentes: st.tdata ? st.tdata.pending.length : 0, students,
        summary: { alunos: students.length, media: rep.meanPct, atencao: students.filter(x => x.level === 'atencao').length, riscoAlto: students.filter(x => x.level === 'alto' || x.level === 'imediato').length, comPendencia: students.filter(x => x.pend > 0).length, sem30: students.filter(x => x.accessDays != null && x.accessDays >= 30).length },
        activities: rep.perItem.map(x => ({ name: x.name, avgPct: x.avgPct, graded: x.graded, total: x.total }))
      };
    }
    function exportHtml() {
      const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      download(`relatorio-uc-${slug(st.data.course.name)}-${day}.html`, ALN.reportHtml.build(reportModel()), 'text/html;charset=utf-8');
    }

    function viewRelatorio() {
      if (st.ficha) { const s = st.data.students.find(x => x.key === st.ficha); if (s) return viewFicha(s); st.ficha = null; }
      const gb = st.data.gradebook, cat = visibleCategory();
      const rep = ALN.buildReport(st.data.students, gb, settings, cat);
      const label = cat || 'Todo o curso';
      const toolbar = h('div', { class: 'bar' }, categorySelect(), iconBtn('btn pri', 'down', 'Exportar relatório completo em HTML', exportHtml, 'Exportar HTML'), iconBtn('btn', 'refresh', 'Ler de novo', read, 'Atualizar'),
        iconBtn('btn', 'down', 'Exportar relatório em CSV', () => download(`relatorio-${slug(label)}.csv`, ALN.reportCsv(rep, `${st.data.course.name} · ${label}`)), 'CSV'), iconBtn('btn', 'down', 'Imprimir ou salvar em PDF', () => root.print(), 'PDF'));
      const all = st.data.students;
      const sem30 = all.filter(x => x.accessKnown && x.lastAccessDays != null && x.lastAccessDays >= 30).length;
      const sum = h('div', { class: 'sumbar' },
        [[String(rep.students), 'alunos', ''], [rep.meanPct == null ? '—' : ALN.fmt(rep.meanPct), 'média da turma', 'tok'], [String(all.filter(x => x.risk.level === 'atencao').length), 'em atenção', 'twn'],
          [String(rep.riskCounts.imediato + rep.riskCounts.alto), 'risco alto', 'ter'], [String(all.filter(x => x.pendCount > 0).length), entregasLidas() ? 'com atividade sem entrega' : 'com item sem nota', ''], [String(sem30), 'sem acessar +30d', '']]
          .map(([v, t, c]) => h('div', {}, h('b', { class: c }, v), t)));
      const opts = RV.filter(([id]) => !(id === 'aguardando' && !entregasLidas()));
      const ver = h('div', { class: 'fgroup', role: 'group', 'aria-label': 'Ver' }, h('span', { class: 'flabel' }, 'Ver'),
        opts.map(([id, lab, fn]) => h('button', { type: 'button', class: `fchip${st.rv === id ? ' on' : ''}`, 'aria-pressed': st.rv === id ? 'true' : 'false', onclick: () => { st.rv = id; renderBody(); } }, lab, h('b', {}, String(all.filter(fn).length)))));
      const fn = (RV.find(x => x[0] === st.rv) || RV[0])[2];
      const list = F.sortStudents(all.filter(fn), 'urgency');
      const rows = rep.perItem.map(x => h('div', { class: 'row' }, h('span', { title: x.name }, x.name), h('div', { class: 'track' }, h('i', { style: `width:${x.coveragePct}%` })), h('span', {}, `${x.graded}/${x.total} · média ${x.avg == null ? '—' : ALN.fmt(x.avg)}`)));
      return [toolbar, covLine(), warnBox(), h('div', { class: 'body' }, sum, h('div', { class: 'filters' }, ver),
        h('div', { class: 'resline' }, `Mostrando ${list.length} de ${all.length} aluno(s) · ordem: `, h('b', {}, 'mais urgentes primeiro')),
        list.length ? list.map(studentCard) : h('p', { class: 'empty' }, 'Nenhum aluno neste grupo.'),
        h('details', { class: 'more' }, h('summary', {}, `Resumo por atividade · ${label}`), rows.length ? rows : h('p', { class: 'why' }, 'Nenhuma atividade nesta seleção.'),
          rep.lowest ? h('span', { class: 'why' }, `“${rep.lowest.name}” tem a menor cobertura de notas (${rep.lowest.graded}/${rep.lowest.total}).`) : null))];
    }

    function summaryText(s) {
      const ov = s.ov;
      const lines = ov.byItem.map(x => `- ${x.name}: ${STATE_LABEL[x.state]}${x.display ? ` (nota ${x.display})` : ''}${x.due ? ` · prazo ${dayOf(x.due)}${x.overdue && x.state === 'sem_entrega' ? ' (atrasada)' : ''}` : ''}`);
      return [`${s.name} — ${st.data.course.name}`, `Situação: ${ALN.LEVEL_LABEL[s.risk.level]} (${ALN.SITUATION_LABEL[s.situation]})`, `Nota total: ${s.totalDisplay || '—'} (mínima ${settings.minimumGrade})`,
        `Último acesso: ${F.accessLabel(s)}`, ov.readEntregas ? `Entregues: ${ov.entregues}/${s.itemCount} · sem entrega: ${s.pendCount}` : `Itens com nota: ${s.itemsGraded}/${s.itemCount}`, ...lines,
        ...(s.risk.reasons.length ? ['Motivos: ' + s.risk.reasons.map(r => r.text).join('; ')] : [])].join('\n');
    }

    function viewFicha(s) {
      const { byKey } = perItemMap();
      const ov = s.ov, log = st.contacts[s.key] || [];
      const toolbar = h('div', { class: 'bar' }, h('button', { type: 'button', class: 'btn', onclick: () => { st.ficha = null; renderBody(); } }, '‹ Voltar ao relatório'),
        canSend(s) ? iconBtn('btn pri', 'send', `Enviar mensagem a ${s.name}`, () => openModal(s), 'Enviar mensagem') : null,
        iconBtn('btn', 'copy', 'Copiar resumo do aluno', async e => { const b = e.currentTarget; try { await root.navigator.clipboard.writeText(summaryText(s)); b.lastChild.textContent = 'Copiado'; } catch (_) { b.lastChild.textContent = 'Não consegui copiar'; } }, 'Copiar resumo'));
      const k = (v, t, c) => h('div', {}, h('b', { class: c || '' }, v), h('span', {}, t));
      const reasons = s.risk.reasons.length ? s.risk.reasons.map(r => h('li', {}, r.text)) : [h('li', {}, s.risk.unknown.length ? `Não deu para avaliar: falta ${s.risk.unknown.join(' e ')}.` : 'Nada indica risco no que foi lido.')];
      const rows = ov.byItem.map(x => {
        const avg = byKey.get(x.item.key), p = x.value == null ? null : ALN.toPct(x.value, x.maxGrade);
        return h('tr', {}, h('td', { title: x.name }, x.name),
          h('td', {}, pill(STATE_PILL[x.state], STATE_LABEL[x.state].replace('entregue e ', 'entregue · ').replace('entregue, ', 'entregue · '))),
          h('td', { class: 'n' }, x.value == null ? h('span', { class: 'blank' }, '—') : [h('b', {}, x.display), h('span', { class: 'bar2 mini2' }, h('i', { style: `width:${Math.max(0, Math.min(100, p))}%;background:${ALN.situation(p, settings) === 'media' ? 'var(--ok)' : ALN.situation(p, settings) === 'recuperacao' ? 'var(--wn)' : 'var(--er)'}` }), avg && avg.avgPct != null ? h('u', { style: `left:${Math.min(100, avg.avgPct)}%`, title: `média da turma ${ALN.fmt(avg.avgPct)}` }) : null)]),
          h('td', {}, x.due ? [dayOf(x.due), x.overdue && x.state === 'sem_entrega' ? h('span', { class: 'tag late' }, 'atrasada') : null] : h('span', { class: 'blank' }, '—')));
      });
      const contacts = log.length ? log.slice().reverse().map(c => h('div', { class: 'contact' }, `✉ ${new Date(c.at).toLocaleDateString('pt-BR')} ${hhmm(c.at)} · ${c.confirmed ? 'enviada e conferida' : 'enviada (conferir no Moodle)'}`)) : [h('p', { class: 'why' }, 'Nenhuma mensagem enviada por aqui.')];
      return [toolbar, h('div', { class: 'body' },
        h('div', { class: 'hdr' }, h('span', { class: 'av big', 'aria-hidden': 'true' }, F.initials(s.name)), h('div', {}, h('h3', {}, s.name), h('small', { class: 'why' }, s.email || 'sem e-mail lido', s.profileUrl ? [' · ', h('a', { href: s.profileUrl, target: '_blank', rel: 'noopener' }, 'abrir perfil no Moodle')] : null)), pill(s.risk.level, ALN.LEVEL_LABEL[s.risk.level])),
        h('div', { class: 'k4' }, k(s.totalDisplay || '—', `nota total (mín. ${settings.minimumGrade})`, s.totalPct != null && s.totalPct < settings.minimumGrade ? 'low' : ''),
          k(`${ov.entregues}/${s.itemCount}`, ov.readEntregas ? 'atividades entregues' : 'itens com nota'), k(String(s.pendCount), ov.readEntregas ? 'sem entrega' : 'sem nota', s.pendCount ? 'low' : ''), k(s.accessKnown ? (s.lastAccessDays >= 9999 ? 'Nunca' : `${s.lastAccessDays} d`) : '—', 'último acesso', F.accessTone(s) === 'old' ? 'low' : '')),
        h('div', { class: 'sec' }, 'Por que está nesta situação'), h('ul', { class: 'why2' }, reasons), h('p', { class: 'why' }, `Sugestão: ${s.risk.action}`),
        h('div', { class: 'sec' }, 'Atividades ', h('span', { class: 'why' }, '· marca preta = média da turma')), h('div', { class: 'scroll' }, h('table', { class: 'ftable' }, h('thead', {}, h('tr', {}, h('th', {}, 'Atividade'), h('th', {}, 'Situação'), h('th', { class: 'n' }, 'Nota'), h('th', {}, 'Prazo'))), h('tbody', {}, rows))),
        ov.readEntregas ? null : h('p', { class: 'why note2' }, 'Entregas ainda não lidas: “sem nota” pode ser atividade enviada que espera a sua correção. Use “Ler entregas” na aba Relatório da UC.'),
        h('div', { class: 'sec' }, 'Contatos'), contacts)];
    }

    const canSend = s => Boolean(ALN.messenger.studentId(s));
    const contactMark = s => { const l = lastContact(s); return l ? h('span', { class: 'pill contacted', style: 'margin-left:6px', title: l.confirmed ? 'Mensagem enviada e conferida no Moodle' : 'Mensagem enviada; conferência pendente' }, `${l.confirmed ? 'Contatado' : 'Enviada (conferir)'} ${hhmm(l.at)}`) : null; };

    let opener = null;
    function closeModal() { st.modal = null; st.modalBusy = false; const m = shadow.querySelector('.mback'); if (m) m.remove(); if (opener && opener.isConnected) opener.focus(); }
    function openModal(s) {
      if (!canSend(s)) return;
      opener = shadow.activeElement;
      closeModal();
      const prev = lastContact(s);
      ensureOv();
      const pendList = s.ov && s.ov.readEntregas ? s.ov.pendencias : [];
      const waiting = s.ov ? s.ov.byItem.filter(x => x.state === 'aguardando') : [];
      const sel = new Set(pendList.map((_, i) => i));
      let edited = false;
      const compose = () => ALN.messenger.buildMessage(s, st.data.course.name, settings, pendList.filter((_, i) => sel.has(i)).map(x => ({ name: x.name, dueText: x.due ? dayOf(x.due).slice(0, 5) : '' })));
      const area = h('textarea', { 'aria-label': `Mensagem para ${s.name}`, maxlength: ALN.messenger.MAX_TEXT }, compose());
      area.addEventListener('input', () => { edited = true; });
      const checklist = pendList.length ? h('div', { class: 'pend' }, h('div', { class: 'ph' }, 'Atividades sem entrega deste aluno (marque as que quer cobrar)'),
        pendList.map((x, i) => h('label', {}, h('input', { type: 'checkbox', checked: true, onchange: e => { if (e.target.checked) sel.add(i); else sel.delete(i); if (!edited) { area.value = compose(); area.dispatchEvent(new root.Event('compose')); } syncAll(); } }), x.name, h('em', {}, `${x.due ? `prazo ${dayOf(x.due).slice(0, 5)}` : 'sem prazo lido'}${x.overdue ? ' · atrasada' : ''}`))),
        waiting.length ? h('p', { class: 'hint', style: 'padding:6px 10px;margin:0' }, `Entregues e aguardando a sua correção (não entram na mensagem): ${waiting.map(x => x.name).join(', ')}.`) : null,
        h('p', { class: 'hint', style: 'padding:0 10px 8px;margin:0' }, 'Se você editar o texto à mão, marcar ou desmarcar deixa de refazê-lo.'))
        : (s.ov && s.ov.readEntregas ? h('p', { class: 'hint' }, 'Este aluno não tem atividade sem entrega no que foi lido.') : h('p', { class: 'hint' }, 'Para listar as atividades pendentes na mensagem, use “Ler entregas” antes.'));
      const ok = h('input', { type: 'checkbox', id: 'aln-ok' });
      const res = h('div', { role: 'status', 'aria-live': 'polite' });
      const sendBtn = h('button', { class: 'btn pri', type: 'button', disabled: true }, svg('send'), 'Enviar ao aluno');
      const cancel = h('button', { class: 'btn', type: 'button', onclick: closeModal }, 'Cancelar');
      const sync = () => { sendBtn.disabled = !(ok.checked && area.value.trim()); };
      const syncAll = () => sync();
      ok.addEventListener('change', sync); area.addEventListener('input', sync);
      sendBtn.addEventListener('click', async () => {
        if (sendBtn.disabled) return;
        sendBtn.disabled = true; cancel.disabled = true; ok.disabled = true; area.disabled = true; st.modalBusy = true;
        res.className = 'res'; res.textContent = 'Enviando pelo Moodle…';
        try {
          const out = await ALN.messenger.send({ userId: ALN.messenger.studentId(s), text: area.value });
          st.contacts = await ALN.messenger.addLog(st.data.course, s.key, { at: out.at, msgid: out.msgid, confirmed: out.confirmed, text: area.value.trim(), nivel: s.risk.level });
          res.className = `res ${out.confirmed ? 'ok' : 'warn'}`;
          res.textContent = out.confirmed ? `Mensagem enviada e conferida no Moodle às ${hhmm(out.at)}.` : `Mensagem enviada às ${hhmm(out.at)}, mas não foi possível conferir. ${out.note}`;
          st.modalBusy = false; cancel.disabled = false; cancel.textContent = 'Fechar'; sendBtn.hidden = true;
          renderBody();
        } catch (e) {
          res.className = 'res bad'; res.textContent = `Não foi enviada. ${e && e.message ? e.message : e}`;
          st.modalBusy = false; cancel.disabled = false; ok.disabled = false; area.disabled = false; sync();
        }
      });
      const dialog = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Enviar mensagem a ${s.name}`,
        onkeydown: e => { if (e.key === 'Escape') { e.stopPropagation(); if (!cancel.disabled) closeModal(); } } },
        h('h3', {}, `Enviar mensagem a ${s.name}`),
        h('span', { class: 'why' }, `Nível: ${ALN.LEVEL_LABEL[s.risk.level]} · vai pela mensagem do Moodle, com a sua conta; o aluno recebe na caixa dele. Não dá para desfazer.`),
        prev ? h('div', { class: 'note' }, `Você já enviou uma mensagem a este aluno às ${hhmm(prev.at)}${new Date(prev.at).toDateString() === new Date().toDateString() ? ' (hoje)' : ` de ${new Date(prev.at).toLocaleDateString('pt-BR')}`}. Envie de novo só se for preciso.`) : null,
        checklist,
        area,
        h('label', {}, ok, 'Revisei o texto e quero enviar esta mensagem ao aluno.'),
        res,
        h('div', { class: 'row2' }, cancel, sendBtn));
      const back = h('div', { class: 'mback', onclick: e => { if (e.target === back && !cancel.disabled) closeModal(); } }, dialog);
      st.modal = s.key;
      drawer.append(back);
      area.focus();
    }

    const diagBtn = () => h('button', { type: 'button', class: 'linkbtn', onclick: copyDiag }, 'Copiar diagnóstico');
    const dot = (cls, t) => h('span', { class: `dot ${cls}`, 'aria-hidden': 'true' }, t || '');
    const STEPS = [['gradebook', 'Livro de notas'], ['participants', 'Participantes'], ['organize', 'Organizar']];
    function stepRows() {
      const cur = Math.max(0, STEPS.findIndex(([k]) => k === st.step));
      return STEPS.map(([k, label], i) => i < cur ? h('div', { class: 'stp' }, dot('ok2', '✓'), label)
        : i === cur ? h('div', { class: 'stp' }, dot('go'), h('b', {}, label), h('em', {}, 'em andamento'))
        : h('div', { class: 'stp todo' }, dot(''), label));
    }
    function readingState() {
      return [h('div', { class: 'panelbody' }, h('div', { class: 'box' },
        h('p', { class: 'big' }, 'Lendo… ', h('span', { 'data-elapsed': '' }, `${st.secs} s`)),
        h('div', { class: 'prog', role: 'progressbar', 'aria-label': 'Leitura em andamento' }, h('i')),
        h('p', { class: 'hint', 'data-progress': '', style: 'margin:0 0 6px' }, st.progress),
        h('div', { 'data-steps': '' }, stepRows()),
        h('p', { class: 'hint' }, 'O Moodle é lento com turmas grandes. Pedimos em lotes de 100 alunos para não sobrecarregá-lo.'),
        h('div', { class: 'stackbtn' }, h('button', { type: 'button', class: 'btn', onclick: cancelRead }, 'Cancelar'))))];
    }
    function emptyState() {
      if (st.error) {
        const keep = ALN.reader.canResume();
        const cancelled = /cancelada/i.test(st.error);
        return [h('div', { class: 'panelbody' },
          h('div', { class: 'err', role: 'alert', style: 'margin:0 0 12px' }, h('b', {}, cancelled ? 'Leitura cancelada' : 'Não foi possível ler'), h('p', { style: 'margin:4px 0 0' }, cancelled ? 'Nada foi gravado no Moodle.' : st.error)),
          h('div', { class: 'box' }, h('b', {}, 'O que você pode fazer'),
            h('ul', { class: 'sub', style: 'padding-left:18px;margin:8px 0 0' }, h('li', {}, 'Tentar de novo: o Moodle costuma responder mais rápido fora do horário de pico.'), h('li', {}, 'No Moodle, filtrar o livro de notas por grupo e ler de novo.')),
            h('div', { class: 'stackbtn' }, iconBtn('btn pri wide', 'refresh', keep ? 'Continuar a leitura' : 'Tentar de novo', () => read(true), keep ? 'Continuar de onde parou' : 'Tentar de novo'), diagBtn())))];
      }
      return [h('div', { class: 'panelbody' }, h('div', { class: 'box' },
        h('p', { class: 'big' }, 'Ler alunos e notas'),
        h('p', { class: 'sub' }, 'Traz notas e último acesso da turma. Só leitura: nada é gravado no Moodle.'),
        iconBtn('btn pri wide', 'refresh', 'Ler alunos e notas', () => read(false), 'Ler agora'),
        h('p', { class: 'hint' }, 'Turmas grandes podem levar cerca de 1 minuto.')))];
    }
    // Leitura que parou no meio: o que já foi lido fica guardado e só o que falta é repetido.
    function partialBanner() {
      const d = st.data; if (!d || !d.pending || !d.pending.length) return null;
      const both = d.pending.length > 1;
      const next = both ? 'Continuar a leitura' : `Continuar: ler ${d.pending[0].key === 'participants' ? 'participantes' : 'livro de notas'}`;
      const rows = [['gradebook', 'Livro de notas'], ['participants', 'Participantes']].map(([k, label]) => {
        const p = d.pending.find(x => x.key === k);
        return p ? h('div', { class: 'stp bad' }, dot('no', '!'), h('b', {}, label), h('em', {}, /tempo limite/i.test(p.reason) ? 'demorou demais' : /HTTP 5\d\d/.test(p.reason) ? 'Moodle indisponível' : 'não terminou'))
          : h('div', { class: 'stp' }, dot('ok2', '✓'), label);
      });
      return h('div', { class: 'partial', role: 'status' }, h('p', { class: 'big' }, 'Leitura incompleta'), h('p', { class: 'sub', style: 'margin-bottom:8px' }, 'O que já foi lido está guardado. As telas já mostram o que deu para ler; o resto fica como “Verificar”.'), rows,
        h('div', { class: 'stackbtn' }, iconBtn('btn pri wide', 'refresh', next, () => read(true), next), h('button', { type: 'button', class: 'btn', onclick: () => read(false) }, 'Ler tudo de novo'), diagBtn()));
    }

    function renderBody() { // refaz só o conteúdo da aba (mantém o foco da busca)
      const keep = shadow.activeElement && shadow.activeElement.type === 'search' ? shadow.activeElement.selectionStart : null;
      const old = drawer.querySelector('[data-content]'); if (old) old.replaceChildren(...content());
      if (keep != null) { const i = drawer.querySelector('input[type=search]'); if (i) { i.focus(); i.setSelectionRange(keep, keep); } }
    }
    function content() {
      if (st.busy) return readingState();
      if (!st.data) return emptyState();
      ensureOv();
      const out = st.tab === 'notas' ? viewNotas() : st.tab === 'acomp' ? viewAcomp() : st.tab === 'relatorio' ? viewRelatorio() : viewAlunos();
      if (st.error) out.unshift(h('div', { class: 'err', role: 'alert' }, st.error));
      if ((st.tab === 'alunos' || (st.tab === 'relatorio' && !st.ficha))) out.splice(1, 0, entregasCard());
      const banner = partialBanner(); if (banner) out.unshift(banner);
      return out.filter(Boolean);
    }
    function render() {
      const course = st.data ? st.data.course.name : '';
      drawer.replaceChildren(
        h('header', {}, h('div', {}, h('b', {}, 'Alunos e notas'), h('small', {}, course || 'Somente leitura · nada é gravado no Moodle')), iconBtn('ib', 'close', 'Fechar', () => api.close())),
        h('nav', { role: 'tablist' }, TABS.map(([k, t]) => h('button', { type: 'button', role: 'tab', class: st.data ? '' : 'off', title: st.data ? null : 'Leia a turma para liberar', 'aria-selected': st.tab === k ? 'true' : 'false', onclick: () => { st.tab = k; render(); } }, t))),
        h('div', { 'data-content': '', style: 'display:flex;flex-direction:column;flex:1;min-height:0' }, content()));
    }
    const onKey = e => { if (e.key !== 'Escape') return; if (st.modal) { if (!st.modalBusy) closeModal(); return; } api.close(); };
    const api = {
      show(tab) { if (tab) st.tab = tab; host.style.display = 'block'; render(); loadContacts().then(() => { if (st.tab === 'acomp') renderBody(); }); root.document.addEventListener('keydown', onKey); },
      close() { host.style.display = 'none'; root.document.removeEventListener('keydown', onKey); },
      read, state: st
    };
    host.__api = api;
    api.show(initialTab);
    return api;
  }

  ALN.ui = { open, HOST_ID };
})(globalThis);

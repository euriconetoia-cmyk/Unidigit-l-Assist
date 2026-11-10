// Criar conteúdo — tela em 4 passos (Escolher, Preencher, Prévia, Criar). Shadow DOM; todo texto entra por textContent.
// Nada é enviado ao Moodle antes do clique em "Criar (ocultas)". Tudo é criado oculto para os alunos.
(function (root) {
  'use strict';
  const CRI = root.CRI; const C = CRI.core; const A = CRI.api;
  const HOST_ID = 'hub-cri-host';
  const CSS = `
:host{all:initial}*{box-sizing:border-box}
.back{position:fixed;inset:0;z-index:2147483200;background:rgba(10,20,35,.5);display:grid;place-items:center;padding:16px;font:14px/1.45 Inter,-apple-system,"Segoe UI",system-ui,sans-serif;color:#14202e;--p:#1a4b9f;--m:#55657a;--bd:#d6dee9;--s:#fff;--c:#f3f6fa;--ok:#0f6b4f;--okbg:#dff3ea;--wn:#a14d08;--wnbg:#fff0d6;--er:#b3261e;--erbg:#fde6e3;--soft:#e8f0fa;--f:#f6b900}
@media (prefers-color-scheme:dark){.back{color:#e6ecf5;--p:#6b9be0;--m:#9aa8bd;--bd:#2e3a4b;--s:#1b2431;--c:#222d3b;--okbg:#143a2b;--ok:#6fd0a0;--wnbg:#3a2c12;--wn:#f0b45a;--erbg:#3d1d1a;--er:#ff8a80;--soft:#22344a}}
.box{width:min(780px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--s);border-radius:16px;padding:18px 20px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
.top{display:flex;gap:10px;justify-content:space-between;align-items:baseline;flex-wrap:wrap}h2{margin:0;font-size:19px}.sub{color:var(--m);font-size:12.5px;margin:2px 0 0}
ol.steps{display:flex;gap:6px;margin:12px 0;flex-wrap:wrap;padding:0}ol.steps li{list-style:none;padding:4px 11px;border-radius:99px;background:var(--c);color:var(--m);font-size:12px;font-weight:700}ol.steps li.on{background:var(--p);color:#fff}ol.steps li.done{background:var(--okbg);color:var(--ok)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.opt{font:inherit;color:inherit;text-align:left;cursor:pointer;border:1px solid var(--bd);background:var(--c);border-radius:12px;padding:12px 14px}.opt.on{border-color:var(--p);background:var(--soft)}.opt b{display:block;font-size:15px}.opt span{color:var(--m);font-size:12.5px}
.ico{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:8px;background:var(--p);color:#fff;font-weight:800;margin-bottom:6px}
label.l{display:block;font-size:12px;font-weight:700;color:var(--m);margin:10px 0 3px;text-transform:uppercase;letter-spacing:.05em}
input,select,textarea{width:100%;font:inherit;border:1px solid var(--bd);border-radius:8px;background:var(--s);color:inherit;padding:8px 10px;min-height:38px}textarea{min-height:120px;resize:vertical;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px}
button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid var(--f);outline-offset:2px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:560px){.two{grid-template-columns:1fr}}
.list{display:grid;gap:6px;max-height:340px;overflow:auto}.it{display:flex;gap:10px;align-items:center;border:1px solid var(--bd);background:var(--c);border-radius:10px;padding:7px 10px}.it input{width:auto;min-height:0}.it b{flex:1;font-size:13px}.it small{color:var(--m)}
.st{font-size:12px;padding:2px 9px;border-radius:8px;white-space:nowrap;font-weight:700;background:var(--bd);color:var(--m)}.st.ok{background:var(--okbg);color:var(--ok)}.st.go{background:var(--wnbg);color:var(--wn)}.st.er{background:var(--erbg);color:var(--er)}
.row2{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}.row2 .sp{flex:1;color:var(--m);font-size:12.5px;align-self:center}
button{font:inherit;min-height:38px;padding:0 16px;border-radius:9px;border:1px solid var(--bd);background:var(--s);color:inherit;cursor:pointer}button.pri{background:var(--p);border-color:var(--p);color:#fff;font-weight:700}button:disabled{opacity:.5;cursor:default}
.view{border:1px solid var(--bd);border-radius:12px;overflow:hidden}.view .hd{background:var(--c);padding:6px 12px;font-size:12px;color:var(--m);display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.view .bd{padding:12px 16px}.view h3{margin:0 0 6px;font-size:17px}.view dl{display:grid;grid-template-columns:150px 1fr;gap:4px 12px;margin:10px 0 0;font-size:13px}.view dt{color:var(--m)}.view dd{margin:0}
.eye{background:var(--wnbg);color:var(--wn);padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700}
table{width:100%;border-collapse:collapse;margin-top:6px}th,td{padding:6px 8px;border-bottom:1px solid var(--bd);text-align:left;font-size:13px;vertical-align:top}th{background:var(--c);color:var(--m);font-size:11px;text-transform:uppercase;letter-spacing:.05em}
.msg{margin-top:10px;padding:8px 10px;border-radius:8px;font-size:13px;background:var(--wnbg);color:var(--wn)}.msg.ok{background:var(--okbg);color:var(--ok)}.msg.err{background:var(--erbg);color:var(--er)}.msg.in{background:var(--c);color:inherit}
.prog{height:10px;border-radius:6px;background:var(--bd);overflow:hidden;margin:10px 0}.prog i{display:block;height:100%;background:var(--p);transition:width .3s}
.cw{margin:4px 0}.sec{margin:2px 0 6px 26px}.okd{color:#1b7a3d;font-weight:600}.avd{color:#b3411c;font-weight:600}
code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px}
@media (prefers-reduced-motion:reduce){*{transition-duration:.01ms!important}}`;

  function h(tag, props = {}, ...kids) {
    const n = root.document.createElement(tag);
    for (const [k, v] of Object.entries(props)) { if (v == null || v === false) continue; if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (k === 'value') n.value = v; else n.setAttribute(k, v === true ? '' : v); }
    kids.flat().forEach(c => { if (c != null && c !== false) n.append(c.nodeType ? c : root.document.createTextNode(String(c))); });
    return n;
  }
  const AUTO = ['uc', 'turma', 'tutor', 'abertura', 'prazo', 'hoje'];
  const dtLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  function open({ cursoAtual } = {}) {
    const old = root.document.getElementById(HOST_ID); if (old) old.remove();
    const doc = root.document; const origin = root.location.origin;
    const host = h('div', { id: HOST_ID }); host.style.cssText = 'all:initial';
    const shadow = host.attachShadow({ mode: 'open' }); shadow.append(h('style', {}, CSS));
    const cursos = cursoAtual ? [cursoAtual] : C.cursosDaPagina(doc, origin);
    const amanha = new Date(); amanha.setDate(amanha.getDate() + 1); amanha.setHours(8, 0, 0, 0);
    const fim = new Date(amanha.getTime() + 14 * 864e5); fim.setHours(23, 59, 0, 0);
    const tutor = C.nomeDoTutor(doc);
    const st = { passo: 0, modelo: C.MODELOS.forum, nome: C.MODELOS.forum.nome, texto: C.MODELOS.forum.texto, custom: {}, abertura: dtLocal(amanha), prazo: dtLocal(fim), extras: {}, secoes: new Map(), secaoPor: new Map(), busca: '', lendoSecoes: false, sel: new Set(cursoAtual ? [cursoAtual.id] : []), checks: new Map(), resultados: new Map(), running: false, ctl: null, msg: '', arquivo: '' };
    const box = h('div', { class: 'box', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Criar conteúdo' });
    const back = h('div', { class: 'back', onclick: e => { if (e.target === back && !st.running) close(); } }, box);
    shadow.append(back);
    function close() { if (st.running) return; host.remove(); }
    host.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); if (st.running) cancelar(); else close(); } });
    const cancelar = () => { if (st.ctl) st.ctl.abort(); };
    // Seção de cada curso: lida do próprio curso (só leitura) e escolhida pelo nome.
    const nomeDaSecao = c => { const k = st.secoes.get(c.id); const n = st.secaoPor.get(c.id); if (!k || k.estado !== 'ok' || n == null) return null; const x = k.lista.find(y => y.numero === n); return x ? x.nome : null; };
    const rotuloSecao = c => { const n = st.secaoPor.get(c.id); if (n == null) return '—'; const nm = nomeDaSecao(c); return nm ? `Seção ${n} · ${nm}` : `Seção ${n}`; };
    async function carregarSecoes() {
      if (st.lendoSecoes) return; st.lendoSecoes = true;
      try {
        const pend = () => escolhidos().find(c => !st.secoes.has(c.id));
        let c; let primeiro = true;
        while ((c = pend())) {
          if (!primeiro) await A.sleep(A.PAUSA_MS / 3); primeiro = false;
          st.secoes.set(c.id, { estado: 'lendo' }); draw();
          try {
            const lista = await A.lerSecoes({ origin, curso: c });
            if (lista.length) { st.secoes.set(c.id, { estado: 'ok', lista }); const n = st.busca ? C.acharSecao(lista, st.busca) : null; if (n != null) st.secaoPor.set(c.id, n); }
            else { st.secoes.set(c.id, { estado: 'manual', lista: [], aviso: 'Não consegui listar as seções deste curso. Digite o número.' }); st.secaoPor.set(c.id, 0); }
          } catch (e) { st.secoes.set(c.id, { estado: 'manual', lista: [], aviso: `${e && e.message ? e.message : 'Falha ao ler as seções.'} Digite o número.` }); st.secaoPor.set(c.id, 0); }
        }
      } finally { st.lendoSecoes = false; }
      draw();
    }
    // Campos que o Moodle deste curso exige (ex.: "Tipo de atividade"): a pessoa escolhe com as opções reais lidas do formulário.
    function campoCtl(campo, aoMudar) {
      const rot = campo.rotulo || campo.nome; const atual = st.extras[campo.nome] || '';
      const ctl = campo.opcoes
        ? h('select', { 'aria-label': rot, onchange: e => aoMudar(e.target.value) }, h('option', { value: '' }, 'Escolha…'), campo.opcoes.map(o => h('option', { value: o.valor }, o.texto)))
        : h('input', { type: 'text', 'aria-label': rot, onchange: e => aoMudar(C.clean(e.target.value)) });
      ctl.value = atual;
      return h('div', { class: 'sec', style: 'margin:6px 0 2px' }, h('label', { class: 'l' }, `${rot} — o Moodle exige`), ctl);
    }
    async function rechecar(nome) {
      st.running = true; st.ctl = new AbortController(); const at = C.clean(st.nome); let primeiro = true;
      try {
        for (const c of escolhidos()) {
          const k = st.checks.get(c.id); if (!k || !(k.obrigatorios || []).some(o => o.nome === nome)) continue;
          if (!primeiro) await A.sleep(A.PAUSA_MS, st.ctl.signal); primeiro = false;
          st.checks.set(c.id, { estado: 'lendo', detalhe: '' }); draw();
          st.checks.set(c.id, await A.checar({ origin, curso: c, modelo: st.modelo, nome: at, secao: st.secaoPor.get(c.id), secaoNome: nomeDaSecao(c), extras: st.extras, opcoes: { signal: st.ctl.signal } }));
        }
      } catch (e) { st.msg = 'Conferência cancelada.'; }
      st.running = false; st.ctl = null; draw();
    }
    const criarUm = c => A.criar({ origin, curso: c, modelo: st.modelo, nome: C.clean(st.nome), html: htmlPara(c), secao: st.secaoPor.get(c.id), secaoNome: nomeDaSecao(c), abertura: dAb(), prazo: dPr(), extras: st.extras, opcoes: { signal: st.ctl.signal } });
    async function tentarDeNovo(c) {
      st.running = true; st.ctl = new AbortController(); st.msg = `Tentando de novo — ${c.name}`; draw();
      try { st.resultados.set(c.id, await criarUm(c)); st.msg = ''; } catch (e) { st.msg = 'Cancelado.'; }
      st.running = false; st.ctl = null; draw();
    }
    // Procurar por nome: atualiza os seletores no lugar (sem redesenhar, para não perder o foco do campo).
    function aplicarBusca() {
      escolhidos().forEach(c => {
        const k = st.secoes.get(c.id); if (!k || k.estado !== 'ok') return;
        const n = st.busca ? C.acharSecao(k.lista, st.busca) : null; if (n != null) st.secaoPor.set(c.id, n); else if (st.busca) st.secaoPor.delete(c.id);
        const sel = box.querySelector(`select[data-curso="${c.id}"]`); if (sel) sel.value = st.secaoPor.has(c.id) ? String(st.secaoPor.get(c.id)) : '';
        const dica = box.querySelector(`[data-dica="${c.id}"]`); if (dica) { dica.textContent = st.busca ? (n != null ? `✓ achei “${st.busca}”` : `⚠ não achei “${st.busca}”: escolha na lista`) : ''; dica.className = `sub ${n != null || !st.busca ? 'okd' : 'avd'}`; }
      });
    }
    function secaoCtl(c) {
      const k = st.secoes.get(c.id);
      if (!k || k.estado === 'lendo') return h('div', { class: 'sub', role: 'status' }, 'Lendo as seções do curso…');
      if (k.estado === 'manual') return h('div', { class: 'sec' }, h('div', { class: 'sub' }, k.aviso), h('input', { type: 'number', min: '0', max: '60', value: String(st.secaoPor.get(c.id) ?? 0), 'aria-label': `Número da seção em ${c.name}`, onchange: e => { st.secaoPor.set(c.id, Math.max(0, parseInt(e.target.value, 10) || 0)); } }));
      const sel = h('select', { 'data-curso': c.id, 'aria-label': `Seção em ${c.name}`, onchange: e => { if (e.target.value === '') st.secaoPor.delete(c.id); else st.secaoPor.set(c.id, Number(e.target.value)); } },
        h('option', { value: '' }, 'Escolha a seção deste curso…'), k.lista.map(x => h('option', { value: String(x.numero) }, `${x.numero} · ${x.nome}${x.oculta ? ' (oculta)' : ''}`)));
      sel.value = st.secaoPor.has(c.id) ? String(st.secaoPor.get(c.id)) : '';
      const n = st.busca ? C.acharSecao(k.lista, st.busca) : null;
      return h('div', { class: 'sec' }, sel, h('div', { 'data-dica': c.id, class: `sub ${n != null || !st.busca ? 'okd' : 'avd'}` }, st.busca ? (n != null ? `✓ achei “${st.busca}”` : `⚠ não achei “${st.busca}”: escolha na lista`) : ''));
    }

    const mount = (...k) => box.replaceChildren(...k.flat().filter(x => x != null && x !== false));
    const escolhidos = () => cursos.filter(c => st.sel.has(c.id));
    const dAb = () => C.lerLocal(st.abertura), dPr = () => C.lerLocal(st.prazo);
    const textoLimpo = () => C.sanitizar(st.texto);
    function valoresPara(c) {
      const hoje = new Date();
      const v = { uc: c.name, tutor, hoje: C.fmtData(hoje).slice(0, 10), ...st.custom };
      if (c.category) v.turma = c.category;
      if (st.modelo.modname === 'assign') { if (dAb()) v.abertura = C.fmtData(dAb()); if (dPr()) v.prazo = C.fmtData(dPr()); }
      return v;
    }
    const camposDoTexto = () => C.campos(textoLimpo());
    const faltando = () => { const falta = new Set(); escolhidos().forEach(c => C.preencher(textoLimpo(), valoresPara(c)).faltando.forEach(f => falta.add(f))); return [...falta]; };
    const htmlPara = c => C.preencher(textoLimpo(), valoresPara(c)).html;

    const passos = () => h('ol', { class: 'steps', 'aria-label': 'Passos' }, ['Escolher', 'Preencher', 'Prévia', 'Criar'].map((n, i) => h('li', { class: i === st.passo ? 'on' : i < st.passo ? 'done' : '', 'aria-current': i === st.passo ? 'step' : null }, `${i + 1}. ${n}`)));
    const cab = sub => [h('div', { class: 'top' }, h('div', {}, h('h2', {}, 'Criar conteúdo'), h('p', { class: 'sub' }, sub))), passos()];
    const rodape = (...bt) => h('div', { class: 'row2' }, ...bt);

    function draw() {
      if (st.passo === 0) return p0(); if (st.passo === 1) return p1(); if (st.passo === 2) return p2(); return p3();
    }
    function p0() {
      mount(...cab('Escolha o que criar. Nada é criado até você confirmar na prévia; tudo nasce oculto para os alunos.'),
        h('label', { class: 'l' }, 'O que criar'),
        h('div', { class: 'cards' }, Object.values(C.MODELOS).map(m => h('button', { type: 'button', class: `opt${st.modelo.id === m.id ? ' on' : ''}`, 'aria-pressed': String(st.modelo.id === m.id), onclick: () => { st.modelo = m; st.nome = m.nome; st.texto = m.texto; st.custom = {}; draw(); } }, h('div', { class: 'ico' }, m.icone), h('b', {}, m.titulo), h('span', {}, m.descricao)))),
        rodape(h('button', { type: 'button', onclick: close }, 'Cancelar'), h('button', { type: 'button', class: 'pri', onclick: () => { st.passo = 1; draw(); carregarSecoes(); } }, 'Continuar')));
    }
    function p1() {
      const m = st.modelo; const ok = st.sel.size > 0;
      const nome = h('input', { type: 'text', value: st.nome, 'aria-label': 'Nome', oninput: e => { st.nome = e.target.value; } });
      const txt = h('textarea', { 'aria-label': 'Texto (HTML simples)', oninput: e => { st.texto = e.target.value; } }); txt.value = st.texto;
      const arq = h('input', { type: 'file', accept: '.html,.htm,.txt,.docx,text/html,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'aria-label': 'Importar modelo (DOCX, HTML ou texto)', onchange: async e => {
        const f = e.target.files && e.target.files[0]; if (!f) return;
        if (/\.pdf$/i.test(f.name)) { st.arquivo = 'PDF ainda não pode ser lido nem anexado nesta versão. Salve o documento como DOCX (Word) ou cole o texto.'; draw(); return; }
        if (/\.doc$/i.test(f.name)) { st.arquivo = 'Arquivo .doc antigo não é suportado. No Word, use “Salvar como” e escolha DOCX.'; draw(); return; }
        if (/\.docx$/i.test(f.name)) {
          if (f.size > 5242880) { st.arquivo = 'Arquivo grande demais (máximo 5 MB).'; draw(); return; }
          try { const r = await CRI.docx.ler(await f.arrayBuffer()); st.texto = r.html; st.arquivo = `Lido: ${f.name}. Títulos, negrito, listas, links e tabelas foram mantidos.${r.avisos.length ? ' ' + r.avisos.join(' ') : ''}`; }
          catch (er) { st.arquivo = er && er.message ? er.message : 'Não consegui ler este DOCX.'; }
          draw(); return;
        }
        if (f.size > 1048576) { st.arquivo = 'Arquivo grande demais (máximo 1 MB).'; draw(); return; }
        const t = await f.text(); st.texto = /\.txt$/i.test(f.name) ? t.split(/\n{2,}/).map(p => `<p>${C.esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('') : t;
        st.arquivo = `Lido: ${f.name}. Scripts, estilos, imagens e eventos foram removidos.`; draw();
      } });
      const ehAuto = c => AUTO.includes(c) && !(c === 'tutor' && !tutor);
      const nCampos = camposDoTexto().filter(c => !ehAuto(c));
      const aut = camposDoTexto().filter(ehAuto);
      const tab = (nCampos.length || aut.length) ? h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Campo'), h('th', {}, 'Valor'))), h('tbody', {},
        aut.map(c => h('tr', {}, h('td', {}, h('code', {}, `{{${c}}}`)), h('td', {}, 'automático'))),
        nCampos.map(c => h('tr', {}, h('td', {}, h('code', {}, `{{${c}}}`)), h('td', {}, h('input', { type: 'text', placeholder: c === 'tutor' ? 'não achei seu nome: digite aqui' : 'preencha', 'aria-label': `Valor de ${c}`, value: st.custom[c] || '', oninput: e => { st.custom[c] = e.target.value; } })))))) : null;
      const datas = m.modname === 'assign' ? h('div', { class: 'two' }, h('div', {}, h('label', { class: 'l' }, 'Abertura'), h('input', { type: 'datetime-local', value: st.abertura, 'aria-label': 'Abertura', onchange: e => { st.abertura = e.target.value; } })), h('div', {}, h('label', { class: 'l' }, 'Prazo'), h('input', { type: 'datetime-local', value: st.prazo, 'aria-label': 'Prazo de entrega', onchange: e => { st.prazo = e.target.value; } }))) : null;
      const lista = cursos.length ? h('div', { class: 'list' }, cursos.map(c => h('div', { class: 'cw' }, h('label', { class: 'it' }, h('input', { type: 'checkbox', checked: st.sel.has(c.id), 'aria-label': c.name, onchange: e => { if (e.target.checked) st.sel.add(c.id); else st.sel.delete(c.id); draw(); carregarSecoes(); } }), h('b', {}, c.name), c.category ? h('small', {}, c.category) : null), st.sel.has(c.id) ? secaoCtl(c) : null))) : h('div', { class: 'msg' }, 'Não achei cursos nesta página. Abra a página de um curso ou “Meus cursos”.');
      mount(...cab('Edite o texto e escolha onde criar.'),
        h('label', { class: 'l' }, 'Nome'), nome,
        h('label', { class: 'l' }, m.modname === 'label' ? 'Texto (HTML simples)' : 'Descrição (HTML simples)'), txt,
        h('div', { class: 'row2', style: 'justify-content:flex-start;margin-top:6px;align-items:center' }, h('span', {}, 'Ou importe um modelo:'), arq),
        st.arquivo ? h('div', { class: 'msg in', role: 'status' }, st.arquivo) : null,
        h('p', { class: 'sub' }, 'Use campos como {{uc}}, {{turma}}, {{tutor}}, {{prazo}} ou crie os seus ({{link_sala}}).'), tab,
        datas,
        h('div', { class: 'two' }, h('div', {}, h('label', { class: 'l' }, 'Procurar seção por nome (opcional)'), h('input', { type: 'text', value: st.busca, placeholder: 'ex.: Unidade 2', 'aria-label': 'Procurar seção por nome', oninput: e => { st.busca = C.clean(e.target.value); aplicarBusca(); } }), h('p', { class: 'sub' }, 'Cada curso tem as suas seções. Escolha a certa em cada curso abaixo.')), h('div', {}, h('label', { class: 'l' }, 'Visibilidade'), h('input', { type: 'text', value: 'Oculto para alunos (sempre)', disabled: true }))),
        h('label', { class: 'l' }, cursoAtual ? 'Onde criar' : 'Onde criar (escolha os cursos)'), lista,
        rodape(h('span', { class: 'sp', role: 'status' }, `${st.sel.size} curso(s) selecionado(s)`), h('button', { type: 'button', onclick: () => { st.passo = 0; draw(); } }, 'Voltar'), h('button', { type: 'button', class: 'pri', disabled: !ok, onclick: irPrevia }, 'Ver prévia')));
    }
    async function irPrevia() {
      const m = st.modelo; const nome = C.clean(st.nome);
      if (!nome) { st.msg = 'Escreva o nome.'; return alertaP1(st.msg); }
      if (m.modname === 'assign' && (!dAb() || !dPr() || dPr() <= dAb())) return alertaP1('Confira as datas: o prazo precisa ser depois da abertura.');
      const semSecao = escolhidos().filter(c => !st.secaoPor.has(c.id)); if (semSecao.length) { draw(); return alertaP1(`Escolha a seção em: ${semSecao.map(c => c.name).join(', ')}.`); }
      const f = faltando(); if (f.length) { draw(); return alertaP1(`Preencha os campos: ${f.map(x => `{{${x}}}`).join(', ')}.`); } // redesenha para mostrar o campo novo
      st.passo = 2; st.checks = new Map(); st.running = true; st.ctl = new AbortController(); st.msg = 'Conferindo cada curso (só leitura)…'; draw();
      try {
        const alvos = escolhidos();
        for (let i = 0; i < alvos.length; i++) {
          const c = alvos[i]; st.checks.set(c.id, { estado: 'lendo', detalhe: '' }); draw();
          st.checks.set(c.id, await A.checar({ origin, curso: c, modelo: m, nome, secao: st.secaoPor.get(c.id), secaoNome: nomeDaSecao(c), extras: st.extras, opcoes: { signal: st.ctl.signal } }));
          if (i < alvos.length - 1) await A.sleep(A.PAUSA_MS, st.ctl.signal);
        }
        st.msg = '';
      } catch (e) { st.msg = 'Conferência cancelada.'; }
      st.running = false; st.ctl = null; draw();
    }
    function alertaP1(t) { const m = box.querySelector('.alertap1'); if (m) m.remove(); box.insertBefore(h('div', { class: 'msg err alertap1', role: 'alert' }, t), box.querySelector('.row2:last-child')); }
    const rotulo = { lendo: ['lendo…', 'go'], pronta: ['Será criada', 'ok'], existe: ['Já existe: será pulada', 'go'], sem_permissao: ['Sem permissão', 'er'], incompativel: ['Formulário diferente', 'er'], erro: ['Não conferida', 'er'] };
    function p2() {
      const m = st.modelo; const prontos = escolhidos().filter(c => { const k = st.checks.get(c.id) || {}; return k.estado === 'pronta' && !(k.obrigatorios || []).length; });
      const ex = prontos[0] || escolhidos()[0];
      const prev = h('div', { class: 'bd' }, h('h3', {}, st.nome));
      if (ex) { const corpo = h('div', {}); const dd = new root.DOMParser().parseFromString(`<body>${htmlPara(ex)}`, 'text/html'); [...dd.body.childNodes].forEach(n => corpo.append(doc.importNode(n, true))); prev.append(corpo); }
      const dl = h('dl', {}); const resumo = [...m.resumo]; if (m.modname === 'assign') resumo.unshift(['Abertura', dAb() ? C.fmtData(dAb()) : '—'], ['Prazo', dPr() ? C.fmtData(dPr()) : '—']); resumo.forEach(([k, v]) => dl.append(h('dt', {}, k), h('dd', {}, v))); prev.append(dl);
      const view = h('div', { class: 'view' }, h('div', { class: 'hd' }, h('span', {}, `${m.titulo}${ex ? ` · ${ex.name}` : ''} · ${ex ? rotuloSecao(ex) : ''}`), h('span', { class: 'eye' }, 'Oculto para alunos')), prev);
      mount(...cab('Confira como vai ficar e o que será criado.'),
        h('div', { class: 'msg' }, 'Nada foi gravado ainda. Ao confirmar, cada item é criado oculto, lido de volta no Moodle e só então marcado como criado.'),
        h('label', { class: 'l' }, 'Como vai ficar (visão do aluno, depois de você revelar)'), view,
        h('label', { class: 'l' }, 'O que será criado'),
        h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Curso'), h('th', {}, 'Situação'))), h('tbody', {}, escolhidos().map(c => { const k = st.checks.get(c.id) || { estado: 'lendo' }; const falta = k.estado === 'pronta' && (k.obrigatorios || []).length; const r = falta ? ['Falta escolher', 'go'] : (rotulo[k.estado] || [k.estado, '']); return h('tr', {}, h('td', {}, c.name, h('div', { class: 'sub' }, rotuloSecao(c))), h('td', {}, h('span', { class: `st ${r[1]}` }, r[0]), falta ? (k.obrigatorios || []).map(o => campoCtl(o, v => { if (v) st.extras[o.nome] = v; else delete st.extras[o.nome]; rechecar(o.nome); })) : null, k.detalhe && k.estado !== 'pronta' ? h('div', { class: 'sub' }, k.detalhe) : null, (k.avisos || []).map(a => h('div', { class: 'sub' }, a)))); }))),
        st.msg ? h('div', { class: 'msg in', role: 'status' }, st.msg) : null,
        rodape(st.running ? h('button', { type: 'button', onclick: cancelar }, 'Cancelar') : h('button', { type: 'button', onclick: () => { st.passo = 1; draw(); } }, 'Voltar'),
          h('button', { type: 'button', class: 'pri', disabled: st.running || !prontos.length, onclick: () => iniciar(prontos) }, `Criar (ocultas)${prontos.length ? ` — ${prontos.length}` : ''}`)));
    }
    async function iniciar(alvos) {
      st.passo = 3; st.running = true; st.ctl = new AbortController(); st.resultados = new Map(); st.pct = 0; draw();
      const nome = C.clean(st.nome);
      try {
        for (let i = 0; i < alvos.length; i++) {
          const c = alvos[i]; st.pct = Math.round((i / alvos.length) * 100); st.msg = `Criando ${i + 1} de ${alvos.length} — ${c.name}`; draw();
          st.resultados.set(c.id, await criarUm(c));
          if (i < alvos.length - 1) await A.sleep(A.PAUSA_MS, st.ctl.signal);
        }
        st.msg = '';
      } catch (e) { st.msg = 'Criação cancelada. O que já foi criado continua no Moodle (oculto).'; }
      st.pct = 100; st.running = false; st.ctl = null; draw();
    }
    function p3() {
      const alvos = escolhidos(); const r = st.resultados;
      const n = k => [...r.values()].filter(x => x.estado === k).length; const pulados = alvos.filter(c => (st.checks.get(c.id) || {}).estado === 'existe').length;
      const rot = { criada: ['Criada (oculta)', 'ok'], incerta: ['Confira no Moodle', 'go'], falhou: ['Falhou', 'er'] };
      mount(...cab(st.running ? 'Criando…' : 'Resultado da criação.'),
        st.running ? h('div', { class: 'prog', role: 'progressbar', 'aria-valuenow': String(st.pct || 0), 'aria-label': 'Progresso' }, h('i', { style: `width:${st.pct || 0}%` })) : null,
        st.msg ? h('div', { class: 'msg in', role: 'status', 'aria-live': 'polite' }, st.msg) : null,
        h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Curso'), h('th', {}, 'Resultado'), h('th', {}, 'Conferido no Moodle'))), h('tbody', {}, alvos.map(c => { const x = r.get(c.id); const ex = (st.checks.get(c.id) || {}).estado === 'existe'; const rr = x ? rot[x.estado] : ex ? ['Pulada (já existe)', 'go'] : st.running ? ['aguardando', ''] : ['Não criada', '']; return h('tr', {}, h('td', {}, c.name), h('td', {}, h('span', { class: `st ${rr[1]}` }, rr[0])), h('td', {}, x ? x.detalhe : ex ? '—' : '', ...(x && x.campos && x.campos.length && !st.running ? [...x.campos.map(o => campoCtl(o, v => { if (v) st.extras[o.nome] = v; else delete st.extras[o.nome]; })), h('button', { type: 'button', class: 'pri', onclick: () => tentarDeNovo(c) }, 'Tentar de novo neste curso')] : []))); }))),
        !st.running ? h('div', { class: `msg ${n('falhou') || n('incerta') ? '' : 'ok'}`, role: 'status' }, `${n('criada')} criada(s), ${pulados} pulada(s)${n('incerta') ? `, ${n('incerta')} para conferir` : ''}${n('falhou') ? `, ${n('falhou')} com erro` : ''}. Tudo foi criado oculto: revele no Moodle depois de conferir.`) : null,
        rodape(st.running ? h('button', { type: 'button', onclick: cancelar }, 'Cancelar') : h('button', { type: 'button', onclick: close }, 'Fechar')));
    }

    root.document.documentElement.append(host);
    draw();
    const first = shadow.querySelector('button.opt'); if (first) first.focus();
    return { host, close };
  }

  CRI.ui = { open };
})(globalThis);

// Telas do "Cronograma da turma". Todo texto do Moodle/JSON entra por textContent. Nada é gravado no Moodle por aqui.
(function (root) {
  'use strict';
  const CRN = root.CRN; const J = CRN.json; const T = CRN.textos; const P = CRN.pagina;
  const HOST_ID = 'hub-crn-host';
  const CSS = `
:host{all:initial}*{box-sizing:border-box}
.back{position:fixed;inset:0;z-index:2147483200;background:rgba(10,20,35,.5);display:grid;place-items:center;padding:16px;font:14px/1.4 Inter,-apple-system,"Segoe UI",system-ui,sans-serif;color:#14202e;--p:#0b5cad;--m:#5b6b7c;--bd:#dbe3ec;--s:#fff;--c:#f8fafd;--okbg:#e3f5ec;--ok:#13795b;--wnbg:#fff1d6;--wn:#9a6200;--erbg:#fde8e6;--er:#b42318;--f:#f0a500}
@media (prefers-color-scheme:dark){.back{color:#e6ecf5;--m:#9aa8bd;--bd:#2b3646;--s:#1a212c;--c:#212a37;--okbg:#143a2b;--ok:#6fd0a0;--wnbg:#3a2f12;--wn:#f0c36a;--erbg:#3d1d1a;--er:#f2a29b}}
.box{width:min(1000px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--s);border-radius:14px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
h2{margin:0 0 2px;font-size:18px}h3{margin:14px 0 6px;font-size:14px}.sub{color:var(--m);font-size:12.5px;margin:0 0 10px}
.bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}.sp{flex:1}
button,label.btn{font:inherit;min-height:36px;padding:0 14px;border-radius:8px;border:1px solid var(--bd);background:var(--s);color:inherit;cursor:pointer;display:inline-flex;align-items:center}
button.pri{background:var(--p);border-color:var(--p);color:#fff}button:disabled{opacity:.5;cursor:default}
button:focus-visible,input:focus-visible,select:focus-visible,label.btn:focus-within{outline:3px solid var(--f);outline-offset:2px}
table{width:100%;border-collapse:collapse;font-size:13px}th{background:var(--c);text-align:left;padding:7px 8px;font-size:12px;position:sticky;top:0}td{padding:6px 8px;border-bottom:1px solid var(--bd);vertical-align:middle}
.wrap{overflow:auto;max-height:46vh;border:1px solid var(--bd);border-radius:10px}
input[type=text],select{font:inherit;min-height:32px;border:1px solid var(--bd);border-radius:7px;padding:0 8px;background:var(--s);color:inherit}
input.d{width:108px}input.h{width:64px}input.bad{border-color:var(--er)}
.pill{display:inline-block;padding:2px 9px;border-radius:99px;font-size:12px;white-space:nowrap;background:var(--bd);color:var(--m)}.pill.ok{background:var(--okbg);color:var(--ok)}.pill.dif{background:var(--wnbg);color:var(--wn)}.pill.er{background:var(--erbg);color:var(--er)}
.old{color:var(--m)}.tipo{color:var(--m);font-size:12px}
.msg{margin:10px 0;padding:8px 10px;border-radius:8px;font-size:13px;background:var(--c)}.msg.warn{background:var(--wnbg);color:var(--wn)}.msg.err{background:var(--erbg);color:var(--er)}.msg.ok{background:var(--okbg);color:var(--ok)}
.msg ul{margin:4px 0 0;padding-left:18px}
.grid{display:grid;grid-template-columns:150px 1fr;gap:8px;align-items:center;margin:6px 0;font-size:13px}
.row2{display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}
textarea{width:100%;min-height:120px;font:12px/1.4 ui-monospace,Consolas,monospace;border:1px solid var(--bd);border-radius:8px;background:var(--c);color:inherit;padding:8px}
@media (prefers-reduced-motion:reduce){*{transition-duration:.01ms!important}}`;

  function h(tag, props = {}, ...kids) {
    const n = root.document.createElement(tag);
    for (const [k, v] of Object.entries(props)) { if (v == null || v === false) continue; if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v); }
    kids.flat().forEach(c => { if (c != null && c !== false) n.append(c.nodeType ? c : root.document.createTextNode(String(c))); });
    return n;
  }
  function montar() {
    const velho = root.document.getElementById(HOST_ID); if (velho) velho.remove();
    const host = h('div', { id: HOST_ID }); host.style.cssText = 'all:initial';
    const shadow = host.attachShadow({ mode: 'open' }); shadow.append(h('style', {}, CSS));
    const box = h('div', { class: 'box', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Cronograma da turma' });
    const back = h('div', { class: 'back' }, box); shadow.append(back);
    root.document.documentElement.append(host);
    return { host, box, back, close: () => host.remove() };
  }
  const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const isoDeBr = txt => { const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(txt || ''); if (!m) return null; const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; const d = J.D(iso); return d && J.isoDe(d) === iso ? iso : null; };
  const horaOk = v => !v || /^\d{1,2}h(\d{2})?$/i.test(v.trim());

  function open() {
    const { host, box, back, close } = montar(); const origin = root.location.origin;
    const st = { fase: 'carregando', reg: null, erro: '', uc: null, rot: [], ver: false, naoValidadoOk: false, copia: '', busy: false, lidos: null, conf: null };
    const rotulos = P.listarRotulos(root.document);
    back.addEventListener('click', e => { if (e.target === back) close(); });
    host.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });

    const cfgDe = uc => {
      st.reg.config = st.reg.config || {}; if (st.reg.config[uc.id]) return st.reg.config[uc.id];
      const web = (uc.momentos || []).filter(m => m.webconferencia && m.webconferencia.data).map(m => ({ data: m.webconferencia.data }));
      const dia = web.length ? J.dow(web[0].data) : 4;
      const c = { origem: web.length || st.res.aprendizagem ? 'json' : 'gerar', dia, passo: 1, pular: true, ini: '', fim: '', atividades: true, diasAntes: 2, webaulas: web };
      st.reg.config[uc.id] = c; return c;
    };
    const salvar = async () => { try { await CRN.store.gravar(st.reg); } catch (e) { st.erro = e.message; } };
    const ucsDaTurma = () => J.ucs(st.reg.dados);
    const textosDa = uc => rotulos.map(r => ({ ...r, par: P.casarUc([uc], r.uc) })).filter(r => r.par);
    const alvoDe = uc => { const c = cfgDe(uc); return T.alvoDaUc(uc, { webaulas: c.webaulas.map(w => ({ data: w.data, ini: w.ini || undefined, fim: w.fim || undefined })), diasAntes: c.atividades ? c.diasAntes : null }); };

    async function importar(file) {
      st.erro = '';
      try {
        const r = J.ler(await file.text()); if (!r.ok) { st.erro = r.erro; return draw(); }
        st.reg = { arquivo: file.name, importadoEm: new Date().toISOString(), dados: r.dados, config: {} }; st.res = J.resumo(r.dados);
        await salvar(); st.fase = 'turma'; st.naoValidadoOk = false;
      } catch (e) { st.erro = e && e.message ? e.message : String(e); }
      draw();
    }
    function regerar(uc) {
      const c = cfgDe(uc); if (c.origem === 'json') { c.webaulas = (uc.momentos || []).filter(m => m.webconferencia && m.webconferencia.data).map(m => ({ data: m.webconferencia.data })); return; }
      c.webaulas = T.gerarWebaulas({ inicio: uc.inicio, termino: uc.termino, dia: c.dia, passo: c.passo, feriados: J.feriados(st.reg.dados), pular: c.pular }).map(data => ({ data }));
    }
    async function abrirUc(uc) {
      st.uc = uc; st.fase = 'uc'; st.erro = ''; st.lidos = null; st.conf = null; st.copia = ''; st.msgCopia = ''; st.busy = true; draw();
      try {
        const lidos = [];
        for (const r of textosDa(uc)) lidos.push({ ...r, html: await P.lerRotulo(origin, r.cmid) });
        st.lidos = lidos;
      } catch (e) { st.erro = e && e.message ? e.message : String(e); }
      st.busy = false; draw();
    }
    async function conferir() {
      st.busy = true; st.conf = null; draw();
      try { const res = []; for (const r of st.lidos) { const novo = await P.lerRotulo(origin, r.cmid); res.push({ cmid: r.cmid, tipo: r.tipo, n: T.ajustar(novo, alvoDe(st.uc)).mudancas.length }); } st.conf = res; }
      catch (e) { st.erro = e && e.message ? e.message : String(e); }
      st.busy = false; draw();
    }
    async function copiar(r) {
      const novo = T.ajustar(r.html, alvoDe(st.uc)).html; st.copia = '';
      try { await root.navigator.clipboard.writeText(novo); st.msgCopia = `Texto copiado (${r.tipo === 'cabecalho' ? 'cabeçalho' : 'cronograma completo'}). Cole em Ferramentas → Código-fonte do editor e salve.`; }
      catch (_) { st.copia = novo; st.msgCopia = 'Não consegui copiar sozinho: selecione o texto abaixo e copie.'; }
      draw();
    }

    const cab = () => [h('h2', {}, 'Cronograma da turma'), h('p', { class: 'sub' }, 'Usa o JSON do Cronograma EaD para atualizar as datas dos textos do curso. Só lê; quem cola e salva no Moodle é você.')];
    const fechar = () => h('button', { type: 'button', onclick: close }, 'Fechar');

    function telaImportar() {
      const input = h('input', { type: 'file', accept: '.json,application/json', style: 'position:absolute;opacity:0;width:1px;height:1px', onchange: e => e.target.files[0] && importar(e.target.files[0]), 'aria-label': 'Escolher o arquivo JSON do cronograma' });
      box.append(h('div', { class: 'msg' }, 'Escolha o arquivo .json exportado do sistema de cronogramas. Ele fica só neste navegador (você pode esquecê-lo depois).'),
        h('div', { class: 'row2' }, fechar(), h('label', { class: 'btn pri', style: 'position:relative' }, 'Escolher arquivo…', input)));
    }

    function telaTurma() {
      const s = st.res; const lig = J.ligar(s, P.nomeCurso(root.document)); const av = J.avisos(st.reg.dados);
      box.append(h('div', { class: 'bar' }, h('b', {}, `${s.curso || s.nome}`), s.numeroTurma ? h('span', { class: 'pill' }, s.numeroTurma) : null,
        h('span', { class: `pill ${s.validado ? 'ok' : 'dif'}` }, s.validado ? `Validado${s.versao ? ' · versão ' + s.versao : ''}` : `Não validado (${s.situacao || 'sem situação'})`),
        s.aprendizagem ? h('span', { class: 'pill' }, 'Aprendizagem') : null),
        h('p', { class: 'sub' }, `${s.unidade ? s.unidade + ' · ' : ''}início ${J.fmt(s.inicio)} · término previsto ${J.fmt(s.termino)} · arquivo ${st.reg.arquivo}`));
      if (!s.validado) box.append(h('div', { class: 'msg warn', role: 'alert' }, 'Este cronograma não está validado. Confirme só se tiver certeza.', h('label', { style: 'display:block;margin-top:6px' }, h('input', { type: 'checkbox', checked: st.naoValidadoOk, onchange: e => { st.naoValidadoOk = e.target.checked; draw(); } }), ' Usar mesmo assim')));
      const cls = { alta: ['ok', 'ligação segura'], media: ['dif', 'ligação a confirmar'], nenhuma: ['er', 'não parece ser esta turma'] }[lig.nivel];
      box.append(h('div', { class: `msg ${lig.nivel === 'nenhuma' ? 'err' : lig.nivel === 'media' ? 'warn' : 'ok'}`, role: 'status' }, h('span', { class: `pill ${cls[0]}` }, cls[1]), ` ${lig.motivo}`, lig.parsed ? ` (Moodle: ${lig.parsed.codigo} · ${lig.parsed.curso} · ${lig.parsed.turma})` : ''));
      if (av.length) { const mostra = st.ver ? av : av.slice(0, 4); box.append(h('div', { class: 'msg warn' }, `${av.length} aviso(s) no arquivo:`, h('ul', {}, mostra.map(a => h('li', {}, a.texto))), av.length > 4 ? h('button', { type: 'button', onclick: () => { st.ver = !st.ver; draw(); } }, st.ver ? 'Mostrar menos' : 'Ver todos') : null)); }
      const ucs = ucsDaTurma(); const bloqueado = (!s.validado && !st.naoValidadoOk) || lig.nivel === 'nenhuma';
      box.append(h('div', { class: 'wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ['Unidade curricular', 'Janela', 'Encontros', 'Textos no curso', ''].map(t => h('th', { scope: 'col' }, t)))),
        h('tbody', {}, ucs.map(uc => {
          const tx = textosDa(uc); const tem = t => tx.some(x => x.tipo === t);
          return h('tr', {}, h('td', {}, h('b', {}, uc.nome), h('div', { class: 'tipo' }, uc.modulo)), h('td', {}, `${J.fmt(uc.inicio)} → ${J.fmt(uc.termino)}`), h('td', {}, `${(uc.momentos || []).length}`),
            h('td', {}, h('span', { class: `pill ${tem('cabecalho') ? 'ok' : 'er'}` }, tem('cabecalho') ? 'cabeçalho ✓' : 'sem cabeçalho'), ' ', h('span', { class: `pill ${tem('cronograma') ? 'ok' : 'er'}` }, tem('cronograma') ? 'cronograma ✓' : 'sem cronograma')),
            h('td', {}, h('button', { type: 'button', class: 'pri', disabled: !tx.length || bloqueado, onclick: () => abrirUc(uc), 'aria-label': `Revisar ${uc.nome}` }, 'Revisar')));
        })))));
      box.append(h('div', { class: 'row2' }, fechar(), h('button', { type: 'button', onclick: async () => { await CRN.store.apagar(); st.reg = null; st.fase = 'importar'; draw(); } }, 'Esquecer este cronograma'), h('label', { class: 'btn', style: 'position:relative' }, 'Trocar arquivo…', h('input', { type: 'file', accept: '.json,application/json', style: 'position:absolute;opacity:0;width:1px;height:1px', onchange: e => e.target.files[0] && importar(e.target.files[0]), 'aria-label': 'Trocar o arquivo do cronograma' }))));
    }

    function telaUc() {
      const uc = st.uc; const c = cfgDe(uc); const aprend = st.res.aprendizagem;
      box.append(h('div', { class: 'bar' }, h('button', { type: 'button', onclick: () => { st.fase = 'turma'; draw(); } }, '← Voltar'), h('b', {}, uc.nome), h('span', { class: 'sp' }), h('span', { class: 'sub', style: 'margin:0' }, `${J.fmt(uc.inicio)} → ${J.fmt(uc.termino)}`)));
      if (st.erro) box.append(h('div', { class: 'msg err', role: 'alert' }, st.erro));
      if (st.busy && !st.lidos) { box.append(h('div', { class: 'msg', role: 'status' }, 'Lendo os textos desta UC…')); return; }
      // webaulas
      box.append(h('h3', {}, 'Webaulas'));
      const sel = h('select', { 'aria-label': 'Origem das webaulas', disabled: aprend, onchange: e => { c.origem = e.target.value; regerar(uc); salvar(); draw(); } }, h('option', { value: 'json', selected: c.origem === 'json' }, 'Usar as datas do cronograma'), h('option', { value: 'gerar', selected: c.origem === 'gerar' }, 'Gerar pelo dia da semana'));
      box.append(h('div', { class: 'grid' }, h('span', {}, 'Origem'), h('span', {}, sel, aprend ? h('span', { class: 'pill', style: 'margin-left:8px' }, 'Aprendizagem: sempre do cronograma') : null)));
      if (c.origem === 'gerar') {
        const re = () => { regerar(uc); salvar(); draw(); };
        box.append(h('div', { class: 'grid' }, h('span', {}, 'Dia da semana'), h('select', { 'aria-label': 'Dia da semana', onchange: e => { c.dia = Number(e.target.value); re(); } }, DIAS.map((d, i) => h('option', { value: String(i), selected: i === c.dia }, d)))),
          h('div', { class: 'grid' }, h('span', {}, 'Frequência'), h('select', { 'aria-label': 'Frequência', onchange: e => { c.passo = Number(e.target.value); re(); } }, [[1, 'Toda semana'], [2, 'A cada 2 semanas'], [3, 'A cada 3 semanas']].map(([v, t]) => h('option', { value: String(v), selected: v === c.passo }, t)))),
          h('div', { class: 'grid' }, h('span', {}, 'Feriados e férias'), h('label', {}, h('input', { type: 'checkbox', checked: c.pular, onchange: e => { c.pular = e.target.checked; re(); } }), ' pular os do cronograma')));
      }
      const hr = (k, ph, rot) => h('input', { type: 'text', class: 'h', value: c[k] || '', placeholder: ph, 'aria-label': rot, onchange: e => { if (!horaOk(e.target.value)) { e.target.classList.add('bad'); return; } c[k] = e.target.value.trim(); c.webaulas.forEach(w => { w[k] = c[k]; }); salvar(); draw(); } });
      box.append(h('div', { class: 'grid' }, h('span', {}, 'Horário (opcional)'), h('span', {}, hr('ini', 'início', 'Início de todas as webaulas'), ' até ', hr('fim', 'término', 'Término de todas as webaulas'), h('span', { class: 'tipo', style: 'margin-left:8px' }, 'em branco = mantém o horário do texto (ex.: 19h)'))));
      box.append(h('div', { class: 'wrap', style: 'max-height:26vh' }, h('table', {}, h('thead', {}, h('tr', {}, ['Webaula', 'Data (dd/mm/aaaa)', 'Observação', ''].map(t => h('th', { scope: 'col' }, t)))), h('tbody', {},
        c.webaulas.map((w, i) => { const fora = w.data < uc.inicio || w.data > uc.termino; const fer = J.feriados(st.reg.dados).has(w.data); return h('tr', {}, h('td', {}, `Webaula ${i + 1}`),
          h('td', {}, h('input', { type: 'text', class: 'd', value: J.fmt(w.data), 'aria-label': `Data da webaula ${i + 1}`, onchange: e => { const iso = isoDeBr(e.target.value); if (!iso) { e.target.classList.add('bad'); return; } w.data = iso; c.webaulas.sort((a, b) => (a.data < b.data ? -1 : 1)); salvar(); draw(); } })),
          h('td', {}, h('span', { class: 'tipo' }, DIAS[J.dow(w.data)]), fora ? h('span', { class: 'pill dif', style: 'margin-left:6px' }, 'fora da UC') : null, fer ? h('span', { class: 'pill dif', style: 'margin-left:6px' }, 'feriado/férias') : null),
          h('td', {}, h('button', { type: 'button', onclick: () => { c.webaulas.splice(i, 1); salvar(); draw(); }, 'aria-label': `Remover webaula ${i + 1}` }, 'Remover'))); })))),
        h('div', { class: 'bar' }, h('button', { type: 'button', onclick: () => { const ult = c.webaulas[c.webaulas.length - 1]; c.webaulas.push({ data: ult ? J.somar(ult.data, 7) : uc.inicio, ini: c.ini, fim: c.fim }); salvar(); draw(); } }, '+ Webaula'),
          h('label', { style: 'margin-left:auto' }, h('input', { type: 'checkbox', checked: c.atividades, onchange: e => { c.atividades = e.target.checked; salvar(); draw(); } }), ` Atualizar as linhas das atividades (início = início da UC; término = ${c.diasAntes} dias antes do 1º encontro) — regra a confirmar`)));
      // diferenças
      box.append(h('h3', {}, 'O que muda nos textos'));
      if (!st.lidos || !st.lidos.length) { box.append(h('div', { class: 'msg warn' }, 'Não encontrei textos desta UC na página.')); return; }
      const alvo = alvoDe(uc); const bloqueado = (!st.res.validado && !st.naoValidadoOk);
      st.lidos.forEach(r => {
        const x = T.ajustar(r.html, alvo); const conf = st.conf && st.conf.find(k => k.cmid === r.cmid);
        box.append(h('div', { class: 'bar' }, h('b', {}, r.tipo === 'cabecalho' ? 'Cabeçalho' : 'Cronograma completo da UC'), h('span', { class: `pill ${x.mudancas.length ? 'dif' : 'ok'}` }, x.mudancas.length ? `${x.mudancas.length} mudança(s)` : 'já está igual ao cronograma'),
          conf ? h('span', { class: `pill ${conf.n ? 'er' : 'ok'}` }, conf.n ? `diferente (${conf.n})` : 'conferido ✓') : null));
        if (x.mudancas.length) box.append(h('div', { class: 'wrap', style: 'max-height:22vh' }, h('table', {}, h('thead', {}, h('tr', {}, ['Onde', 'Está no Moodle', 'Pelo cronograma'].map(t => h('th', { scope: 'col' }, t)))), h('tbody', {}, x.mudancas.map(m => h('tr', {}, h('td', {}, m.rotulo), h('td', { class: 'old' }, m.de), h('td', {}, h('b', {}, m.para))))))));
        box.append(h('div', { class: 'row2', style: 'margin-top:6px' }, h('button', { type: 'button', class: 'pri', disabled: !x.mudancas.length || bloqueado, onclick: () => copiar(r) }, 'Copiar texto atualizado'), h('button', { type: 'button', onclick: () => root.open(P.editUrl(origin, r.cmid), '_blank', 'noopener') }, 'Abrir a edição no Moodle')));
      });
      if (st.msgCopia) box.append(h('div', { class: 'msg ok', role: 'status' }, st.msgCopia));
      if (st.copia) box.append(h('textarea', { readonly: true, 'aria-label': 'Texto atualizado para copiar' }, st.copia));
      box.append(h('div', { class: 'msg' }, 'Como aplicar: copie o texto, abra a edição, use Ferramentas → Código-fonte do editor, apague tudo, cole e clique em Salvar. Depois clique em “Conferir agora”.'),
        h('div', { class: 'row2' }, fechar(), h('button', { type: 'button', disabled: st.busy, onclick: conferir }, st.busy ? 'Conferindo…' : 'Conferir agora')));
    }

    function draw() {
      box.replaceChildren(...cab());
      if (st.erro && st.fase !== 'uc') box.append(h('div', { class: 'msg err', role: 'alert' }, st.erro));
      if (!P.nomeCurso(root.document) && st.fase === 'turma') box.append(h('div', { class: 'msg warn' }, 'Não achei o nome do curso nesta página.'));
      if (st.fase === 'carregando') { box.append(h('div', { class: 'msg', role: 'status' }, 'Carregando…')); return; }
      if (st.fase === 'importar') return telaImportar();
      if (st.fase === 'uc') return telaUc();
      return telaTurma();
    }
    draw();
    CRN.store.ler().then(reg => { if (reg) { st.reg = reg; st.res = J.resumo(reg.dados); st.fase = 'turma'; } else st.fase = 'importar'; draw(); const b = box.querySelector('button.pri,label.pri'); if (b) b.focus(); }).catch(() => { st.fase = 'importar'; draw(); });
    return { host, close };
  }
  CRN.ui = { open, HOST_ID };
})(globalThis);

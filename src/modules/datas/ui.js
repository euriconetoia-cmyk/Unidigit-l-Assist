// Telas do "Conferir datas". Todo texto do Moodle entra por textContent. Nada é gravado no Moodle por aqui.
(function (root) {
  'use strict';
  const DTS = root.DTS; const C = DTS.core;
  const HOST_ID = 'hub-dts-host'; const BANNER_ID = 'hub-dts-banner';
  const CSS = `
:host{all:initial}*{box-sizing:border-box}
.back{position:fixed;inset:0;z-index:2147483200;background:rgba(10,20,35,.5);display:grid;place-items:center;padding:16px;font:14px/1.4 Inter,-apple-system,"Segoe UI",system-ui,sans-serif;color:#14202e;--p:#0b5cad;--m:#5b6b7c;--bd:#dbe3ec;--s:#fff;--c:#f8fafd;--okbg:#e3f5ec;--ok:#13795b;--wnbg:#fff1d6;--wn:#9a6200;--erbg:#fde8e6;--er:#b42318;--f:#f0a500}
@media (prefers-color-scheme:dark){.back{color:#e6ecf5;--m:#9aa8bd;--bd:#2b3646;--s:#1a212c;--c:#212a37;--okbg:#143a2b;--ok:#6fd0a0;--wnbg:#3a2f12;--wn:#f0c36a;--erbg:#3d1d1a;--er:#f2a29b}}
.box{width:min(980px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--s);border-radius:14px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
h2{margin:0 0 2px;font-size:18px}.sub{color:var(--m);font-size:12.5px;margin:0 0 10px}
.bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}.sp{flex:1;color:var(--m);font-size:12.5px}
button{font:inherit;min-height:36px;padding:0 14px;border-radius:8px;border:1px solid var(--bd);background:var(--s);color:inherit;cursor:pointer}
button.pri{background:var(--p);border-color:var(--p);color:#fff}button:disabled{opacity:.5;cursor:default}
button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--f);outline-offset:2px}
table{width:100%;border-collapse:collapse;font-size:13px}th{background:var(--c);text-align:left;padding:7px 8px;font-size:12px;position:sticky;top:0}td{padding:6px 8px;border-bottom:1px solid var(--bd);vertical-align:middle}
.wrap{overflow:auto;max-height:52vh;border:1px solid var(--bd);border-radius:10px}
input[type=text],select{font:inherit;min-height:32px;border:1px solid var(--bd);border-radius:7px;padding:0 8px;background:var(--s);color:inherit}
input.d{width:104px}input.h{width:64px}input.bad{border-color:var(--er)}select{max-width:200px}
.pill{display:inline-block;padding:2px 9px;border-radius:99px;font-size:12px;white-space:nowrap;background:var(--bd);color:var(--m)}.pill.ok{background:var(--okbg);color:var(--ok)}.pill.dif{background:var(--wnbg);color:var(--wn)}.pill.er{background:var(--erbg);color:var(--er)}
.old{color:var(--m)}.tipo{color:var(--m);font-size:12px}
.msg{margin:10px 0;padding:8px 10px;border-radius:8px;font-size:13px;background:var(--c)}.msg.warn{background:var(--wnbg);color:var(--wn)}.msg.err{background:var(--erbg);color:var(--er)}.msg.ok{background:var(--okbg);color:var(--ok)}
.prog{height:10px;border-radius:6px;background:var(--bd);overflow:hidden;margin:8px 0}.prog i{display:block;height:100%;background:var(--p);transition:width .3s}
.opts{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;margin:8px 0}.opts label{display:flex;gap:6px;align-items:center}
.row2{display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}
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
    const box = h('div', { class: 'box', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Conferir datas' });
    const back = h('div', { class: 'back' }, box); shadow.append(back);
    root.document.documentElement.append(host);
    return { host, box, back, close: () => host.remove() };
  }

  // ---------- painel principal (página do curso) ----------
  function open() {
    const { host, box, back, close } = montar();
    const origin = root.location.origin;
    const cron = C.lerCronograma(root.document);
    const atividades = DTS.reader.listarAtividades(root.document, origin);
    const st = { fase: 'inicio', ctl: null, msg: '', pct: 0, linhas: [], regras: { limite: false, lembrete: false }, erro: '' };
    back.addEventListener('click', e => { if (e.target === back && st.fase !== 'lendo') close(); });
    host.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); if (st.fase === 'lendo' && st.ctl) st.ctl.abort(); else close(); } });

    const cab = () => [h('h2', {}, 'Conferir datas pelo cronograma'), h('p', { class: 'sub' }, 'Compara o “Cronograma de Atividades” desta página com as datas das tarefas e questionários. Só lê; para mudar, você confere e salva no próprio Moodle.')];

    // recalcula o estado de uma linha a partir do que está nos campos
    function recalcular(l) {
      l.erroCampo = ''; l.alvo = null; l.dif = []; l.avisos = [];
      if (l.erro) { l.estado = 'erro'; return; }
      const e = l.par >= 0 ? cron.entradas[l.par] : null;
      const manual = Boolean(l.ed.inicio || l.ed.termino || l.ed.hora); // a pessoa digitou datas à mão
      if (!manual) { l.estado = !e ? 'sem-par' : 'sem-data'; return; }
      const ini = C.parseData(l.ed.inicio), ter = C.parseData(l.ed.termino);
      const hora = l.ed.hora ? C.parseHora(l.ed.hora) : null;
      if (!ini || !ter || (l.ed.hora && !hora)) { l.estado = 'invalido'; l.erroCampo = 'Use dd/mm/aaaa e hh:mm.'; return; }
      l.alvo = C.montarAlvo({ inicio: ini, termino: ter, hora }, l.tipo, l.atual, st.regras);
      l.avisos = C.avisos(l.alvo); l.dif = C.diferencas(l.atual, l.alvo);
      if (l.avisos.some(a => a.tipo === 'ordem')) { l.estado = 'invalido'; l.erroCampo = 'O término é anterior ao início.'; return; }
      l.estado = l.dif.length ? 'diferente' : 'igual';
    }
    function preencherEd(l) {
      const e = l.par >= 0 ? cron.entradas[l.par] : null;
      l.ed = e && !e.semData ? { inicio: C.fmtData(e.inicio), termino: C.fmtData(e.termino), hora: C.fmtHora(e.hora || { h: 23, mi: 59 }) } : { inicio: '', termino: '', hora: '' };
    }
    function montarLinhas(lidas) {
      const par = C.emparelhar(lidas, cron.entradas);
      st.linhas = lidas.map((a, i) => { const l = { ...a, par: par[i], sel: false }; preencherEd(l); recalcular(l); l.sel = l.estado === 'diferente'; return l; });
    }

    async function ler() {
      st.fase = 'lendo'; st.erro = ''; st.ctl = new AbortController(); st.pct = 0; draw();
      try {
        const lidas = await DTS.reader.lerTodas(origin, atividades, { signal: st.ctl.signal, onProgress: p => { st.pct = Math.round((p.i / p.total) * 100); st.msg = `Lendo ${p.i + 1} de ${p.total} — ${p.nome}`; const m = box.querySelector('[data-msg]'); if (m) m.textContent = st.msg; const b = box.querySelector('.prog i'); if (b) b.style.width = `${st.pct}%`; } });
        montarLinhas(lidas); st.fase = 'tabela';
      } catch (e) { st.fase = 'inicio'; st.erro = e && e.name === 'AbortError' ? 'Leitura cancelada. Nada foi alterado.' : (e && e.message ? e.message : String(e)); }
      st.ctl = null; draw();
    }

    function aplicar() {
      const itens = st.linhas.filter(l => l.sel && l.estado === 'diferente').map(l => ({ cmid: l.cmid, nome: l.nome, tipo: l.tipo, alvo: l.alvo, estado: 'pendente', detalhe: '' }));
      if (!itens.length) return;
      try { DTS.fila.gravar({ cursoUrl: root.location.href, itens, fase: 'salvar', regras: st.regras }); } catch (e) { st.erro = e.message; draw(); return; }
      DTS.fluxo.irParaProxima(DTS.fila.ler());
    }

    const PILL = { igual: ['ok', 'igual'], diferente: ['dif', 'diferente'], 'sem-par': ['er', 'sem par'], 'sem-data': ['', 'A definir'], invalido: ['er', 'conferir'], erro: ['er', 'não li'] };
    function linhaTr(l) {
      const [cls, txt] = PILL[l.estado];
      const sel = h('select', { 'aria-label': `Par de ${l.nome} no cronograma`, onchange: e => { l.par = Number(e.target.value); preencherEd(l); recalcular(l); l.sel = l.estado === 'diferente'; draw(); } },
        h('option', { value: '-1', selected: l.par < 0 }, 'sem par…'), ...cron.entradas.map((e, j) => h('option', { value: String(j), selected: j === l.par }, e.nome)));
      const campo = (k, cl) => h('input', { type: 'text', class: `${cl}${l.estado === 'invalido' ? ' bad' : ''}`, value: l.ed[k], 'aria-label': `${k === 'inicio' ? 'Início' : k === 'termino' ? 'Término' : 'Hora limite'} de ${l.nome}`, disabled: Boolean(l.erro), placeholder: k === 'hora' ? 'hh:mm' : 'dd/mm/aaaa', title: 'Pode editar: digite a data que deseja aplicar', onchange: e => { l.ed[k] = e.target.value; recalcular(l); l.sel = l.estado === 'diferente'; draw(); } });
      const at = l.atual; const noMoodle = l.erro ? h('span', { class: 'old' }, l.erro) : [CAMPOS_TXT(at, 'inicio'), ' → ', CAMPOS_TXT(at, 'termino')];
      const chk = h('input', { type: 'checkbox', checked: l.sel, disabled: l.estado !== 'diferente', 'aria-label': `Aplicar em ${l.nome}`, onchange: e => { l.sel = e.target.checked; draw(); } });
      return h('tr', {}, h('td', {}, h('b', {}, l.nome), h('div', { class: 'tipo' }, C.TIPOS[l.tipo])), h('td', {}, sel), h('td', {}, noMoodle),
        h('td', {}, campo('inicio', 'd'), ' ', campo('termino', 'd'), ' ', campo('hora', 'h')),
        h('td', {}, h('span', { class: `pill ${cls}` }, txt), l.avisos.filter(a => a.tipo === 'domingo').map(a => h('div', { class: 'tipo' }, a.texto)), l.erroCampo ? h('div', { class: 'tipo' }, l.erroCampo) : null), h('td', {}, chk));
    }
    const CAMPOS_TXT = (at, papel) => (at && at[papel] && at[papel].on ? C.fmtTudo(at[papel]) : h('span', { class: 'old' }, 'sem data'));

    function draw() {
      box.replaceChildren(...cab());
      if (!cron.entradas.length) { box.append(h('div', { class: 'msg warn', role: 'status' }, 'Não encontrei a tabela “Cronograma de Atividades” (colunas Início e Término) nesta página. Abra a página principal do curso, onde o cronograma aparece, e tente de novo.'), fechar()); return; }
      if (!atividades.length) { box.append(h('div', { class: 'msg warn', role: 'status' }, 'Não encontrei tarefas nem questionários nesta página.'), fechar()); return; }
      if (st.fase === 'inicio' || st.fase === 'lendo') {
        box.append(h('div', { class: 'msg' }, `Cronograma: ${cron.entradas.length} item(ns) com datas · Moodle: ${atividades.length} atividade(s) (tarefas e questionários).`));
        if (st.erro) box.append(h('div', { class: 'msg err', role: 'alert' }, st.erro));
        if (st.fase === 'lendo') box.append(h('div', { class: 'prog', role: 'progressbar', 'aria-label': 'Progresso' }, h('i', { style: `width:${st.pct}%` })), h('div', { class: 'msg', role: 'status', 'aria-live': 'polite', 'data-msg': '' }, st.msg || 'Lendo…'), h('div', { class: 'row2' }, h('button', { type: 'button', onclick: () => st.ctl && st.ctl.abort() }, 'Cancelar')));
        else box.append(h('p', { class: 'sub' }, 'Para ler as datas de cada atividade a extensão abre a tela de edição dela, só para ler (uma por vez, com pausa). Nada é alterado.'), h('div', { class: 'row2' }, h('button', { type: 'button', onclick: close }, 'Fechar'), h('button', { type: 'button', class: 'pri', onclick: ler }, 'Ler as datas das atividades')));
        return;
      }
      const cont = { igual: 0, diferente: 0, 'sem-par': 0, 'sem-data': 0, invalido: 0, erro: 0 }; st.linhas.forEach(l => { cont[l.estado] += 1; });
      const nSel = st.linhas.filter(l => l.sel && l.estado === 'diferente').length;
      box.append(h('div', { class: 'bar' }, h('span', { class: 'pill dif' }, `${cont.diferente} diferente(s)`), h('span', { class: 'pill ok' }, `${cont.igual} igual(is)`), h('span', { class: 'pill er' }, `${cont['sem-par']} sem par`), cont.erro ? h('span', { class: 'pill er' }, `${cont.erro} não lida(s)`) : null, cont['sem-data'] ? h('span', { class: 'pill' }, `${cont['sem-data']} a definir`) : null));
      if (st.erro) box.append(h('div', { class: 'msg err', role: 'alert' }, st.erro));
      box.append(h('div', { class: 'wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ['Atividade', 'Par no cronograma', 'No Moodle (início → entrega)', 'Datas a aplicar (início, término, hora) — editáveis', 'Situação', ''].map(t => h('th', { scope: 'col' }, t)))), h('tbody', {}, st.linhas.map(linhaTr)))));
      const regra = (k, txt, extra) => h('label', {}, h('input', { type: 'checkbox', checked: st.regras[k], onchange: e => { st.regras[k] = e.target.checked; st.linhas.forEach(l => { const antes = l.sel; recalcular(l); l.sel = antes && l.estado === 'diferente'; if (l.estado === 'diferente' && !antes && st.regras[k]) l.sel = true; }); draw(); } }), txt, extra);
      box.append(h('div', { class: 'opts' }, h('span', { class: 'sub', style: 'margin:0' }, 'Regras:'), h('span', {}, 'Início → abre/permite envios · Término + hora limite → entrega/fecha'), regra('limite', 'Também ajustar “Data limite” (tarefas)'), regra('lembrete', 'Lembrete de avaliação = término + 7 dias (tarefas)')));
      box.append(h('div', { class: 'msg' }, '“A definir” e atividade sem par só mudam se você digitar as datas à mão. Aplicar abre uma atividade por vez com os campos já preenchidos; quem salva é você, no Moodle. Depois a extensão confere.'));
      box.append(h('div', { class: 'row2' }, h('button', { type: 'button', onclick: close }, 'Fechar'), h('button', { type: 'button', onclick: () => { st.linhas.forEach(l => { l.sel = l.estado === 'diferente'; }); draw(); } }, 'Marcar só os diferentes'), h('button', { type: 'button', onclick: baixar }, 'Baixar comparação (CSV)'), h('button', { type: 'button', class: 'pri', disabled: !nSel, onclick: aplicar }, `Aplicar nos ${nSel} marcado(s)`)));
    }
    const fechar = () => h('div', { class: 'row2' }, h('button', { type: 'button', onclick: close }, 'Fechar'));

    function baixar() {
      const cel = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
      const linhas = [['atividade', 'tipo', 'par_no_cronograma', 'inicio_moodle', 'entrega_moodle', 'inicio_cronograma', 'termino_cronograma', 'hora', 'situacao']];
      st.linhas.forEach(l => linhas.push([l.nome, C.TIPOS[l.tipo], l.par >= 0 ? cron.entradas[l.par].nome : '', l.atual ? C.fmtTudo(l.atual.inicio) : '', l.atual ? C.fmtTudo(l.atual.termino) : '', l.ed.inicio, l.ed.termino, l.ed.hora, PILL[l.estado][1]]));
      const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + linhas.map(r => r.map(cel).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' })), download: 'conferencia-de-datas.csv' });
      box.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }

    draw(); const primeiro = box.querySelector('button.pri'); if (primeiro) primeiro.focus();
    return { host, close };
  }

  // ---------- resultado depois de salvar (qualquer página do Moodle) ----------
  function resultado(est) {
    const { host, box, back, close } = montar();
    const pend = DTS.fila.proximo(est);
    const ROT = { conferido: ['ok', 'conferido'], diferente: ['er', 'não salvou'], erro: ['er', 'não consegui conferir'], pendente: ['', 'pendente'] };
    box.append(h('h2', {}, 'Conferência das datas'), h('p', { class: 'sub' }, 'A extensão releu cada atividade depois que você voltou da edição. Nada é dado como feito sem essa releitura.'),
      h('div', { class: 'wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ['Atividade', 'Esperado', 'Situação'].map(t => h('th', { scope: 'col' }, t)))),
        h('tbody', {}, est.itens.map(i => { const [c, t] = ROT[i.estado]; return h('tr', {}, h('td', {}, h('b', {}, i.nome), h('div', { class: 'tipo' }, C.TIPOS[i.tipo])), h('td', {}, Object.entries(i.alvo).map(([p, v]) => h('div', {}, `${C.ROTULO[C.CAMPOS[i.tipo][p]]}: ${C.fmtTudo({ ...v, on: true })}`))), h('td', {}, h('span', { class: `pill ${c}` }, t), i.detalhe ? h('div', { class: 'tipo' }, i.detalhe) : null)); })))));
    const encerrar = () => { DTS.fila.limpar(); close(); };
    box.append(h('div', { class: 'row2' }, h('button', { type: 'button', onclick: encerrar }, 'Encerrar'),
      pend >= 0 ? h('button', { type: 'button', class: 'pri', onclick: () => { close(); DTS.fluxo.irParaProxima(DTS.fila.ler()); } }, `Abrir a próxima (${est.itens.filter(i => i.estado === 'pendente').length} pendente(s))`) : h('button', { type: 'button', class: 'pri', onclick: () => { const u = est.cursoUrl; encerrar(); if (u) root.location.assign(u); } }, 'Voltar ao curso')));
    const f = box.querySelector('button.pri'); if (f) f.focus();
    back.addEventListener('click', e => { if (e.target === back) close(); });
    host.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    return { host, close };
  }

  // ---------- faixa na tela de edição ----------
  function bannerEdicao(item, n, est) {
    const velho = root.document.getElementById(BANNER_ID); if (velho) velho.remove();
    const host = h('div', { id: BANNER_ID }); host.style.cssText = 'all:initial';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.append(h('style', {}, `:host{all:initial}.b{position:fixed;left:0;right:0;top:0;z-index:2147483300;background:#fff1d6;color:#5c3b00;border-bottom:2px solid #f0a500;padding:10px 16px;font:14px/1.4 Inter,system-ui,sans-serif;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.b b{color:#14202e}button{font:inherit;min-height:32px;padding:0 12px;border-radius:8px;border:1px solid #c58b00;background:#fff;cursor:pointer}`));
    const pos = est.itens.findIndex(i => i.cmid === item.cmid) + 1;
    shadow.append(h('div', { class: 'b', role: 'status' }, h('span', {}, 'Unidigit@l Assist preencheu ', h('b', {}, `${n} data(s)`), ` de “${item.nome}” (${pos} de ${est.itens.length}). Confira e clique em `, h('b', {}, 'Salvar'), ' do Moodle. A extensão não salva por você.'),
      h('button', { type: 'button', onclick: () => host.remove() }, 'Entendi')));
    root.document.documentElement.append(host);
    return host;
  }

  DTS.ui = { open, resultado, bannerEdicao, HOST_ID, BANNER_ID };
})(globalThis);

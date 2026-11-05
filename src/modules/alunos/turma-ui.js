// Painel do Relatório da turma (página "Meus cursos"): escolher UCs, ler matriculados (e, se pedido, notas) de cada uma (com cancelar) e gerar HTML e/ou Excel.
// Nada é lido antes de "Gerar relatório". Somente leitura. Todo texto do Moodle entra no DOM por textContent.
(function (root) {
  'use strict';
  const ALN = root.ALN;
  const HOST_ID = 'hub-aln-turma';
  const CSS = `
:host{all:initial}*{box-sizing:border-box}
.back{position:fixed;inset:0;z-index:2147483200;background:rgba(10,20,35,.5);display:grid;place-items:center;padding:16px;font:14px/1.4 Inter,-apple-system,"Segoe UI",system-ui,sans-serif;color:#14202e;--p:#0b5cad;--m:#5b6b7c;--bd:#dbe3ec;--s:#fff;--c:#f8fafd;--ok:#157a4c;--okbg:#e1f5ec;--wn:#a86400;--wnbg:#fff3d6;--er:#b3261e;--erbg:#fde8e5;--f:#f6b900}
@media (prefers-color-scheme:dark){.back{color:#e6ecf5;--m:#9aa8bd;--bd:#2b3646;--s:#1a212c;--c:#212a37;--okbg:#143a2b;--ok:#6fd0a0;--wnbg:#3a2f12;--wn:#f0c36a;--erbg:#3d1d1a;--er:#f2a29b}}
.box{width:min(640px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--s);border-radius:14px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
h2{margin:0 0 2px;font-size:18px}.sub{color:var(--m);font-size:12.5px;margin:0 0 10px}
.bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}.bar .sp{flex:1;color:var(--m);font-size:12.5px}
button{font:inherit;min-height:36px;padding:0 14px;border-radius:8px;border:1px solid var(--bd);background:var(--s);color:inherit;cursor:pointer}
button.pri{background:var(--p);border-color:var(--p);color:#fff}button:disabled{opacity:.5;cursor:default}
button:focus-visible,input:focus-visible{outline:3px solid var(--f);outline-offset:2px}
.q{width:100%;min-height:38px;margin-top:8px;padding:0 12px;border-radius:8px;border:1px solid var(--bd);background:var(--s);color:inherit;font:inherit}
.list{display:grid;gap:6px;max-height:46vh;overflow:auto}
.it{display:flex;gap:10px;align-items:center;border:1px solid var(--bd);background:var(--c);border-radius:10px;padding:8px 10px}
.it.on{border-color:var(--p)}.it b{flex:1}.it small{color:var(--m)}.it label{display:flex;gap:10px;align-items:center;flex:1;cursor:pointer}
.st{font-size:12px;padding:2px 9px;border-radius:8px;white-space:nowrap;background:var(--bd);color:var(--m)}.st.ok{background:var(--okbg);color:var(--ok)}.st.go{background:var(--wnbg);color:var(--wn)}.st.er{background:var(--erbg);color:var(--er)}
.prog{height:10px;border-radius:6px;background:var(--bd);overflow:hidden;margin:8px 0}.prog i{display:block;height:100%;background:var(--p);width:0;transition:width .3s}
.msg{margin-top:10px;padding:8px 10px;border-radius:8px;font-size:13px;background:var(--c)}.msg.warn{background:var(--wnbg);color:var(--wn)}.msg.ok{background:var(--okbg);color:var(--ok)}.msg.err{background:var(--erbg);color:var(--er)}
.opt{margin-top:10px;padding:8px 10px;border:1px solid var(--bd);border-radius:10px;background:var(--c);display:grid;gap:4px;font-size:13px}.opt strong{font-size:12px;color:var(--m);text-transform:uppercase;letter-spacing:.05em}.opt label{display:flex;gap:8px;align-items:center;cursor:pointer;min-height:28px}.opt label.off{opacity:.55;cursor:default}.opt .hint{color:var(--m);font-size:12px;margin-left:26px}
.row2{display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}.empty{padding:14px;color:var(--m);text-align:center}
@media (prefers-reduced-motion:reduce){*{transition-duration:.01ms!important}}`;

  function h(tag, props = {}, ...kids) {
    const n = root.document.createElement(tag);
    for (const [k, v] of Object.entries(props)) { if (v == null || v === false) continue; if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v); }
    kids.flat().forEach(c => { if (c != null && c !== false) n.append(c.nodeType ? c : root.document.createTextNode(String(c))); });
    return n;
  }
  function saveXlsx(name, sheets) {
    const a = h('a', { href: URL.createObjectURL(new Blob([ALN.xlsx.build(sheets)], { type: ALN.xlsx.MIME })), download: name });
    root.document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const slug = s => String(s || 'turma').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'turma';

  function open() {
    const old = root.document.getElementById(HOST_ID); if (old) old.remove();
    const host = h('div', { id: HOST_ID }); host.style.cssText = 'all:initial';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.append(h('style', {}, CSS));
    const courses = ALN.turma.detectCourses(root.document, root.location.origin);
    const sel = new Set();
    const st = { q: '', reports: new Map(), mat: new Map(), failed: new Map(), running: false, ctl: null, status: new Map(), result: null, inc: { mat: true, notas: false }, out: { html: true, xlsx: true }, resumo: null, diff: new Map(), prev: null };
    // Última leitura (só números) para comparar. Falha de storage nunca atrapalha o relatório.
    try { const g = root.chrome && chrome.storage && chrome.storage.local && chrome.storage.local.get('uas.turmas'); if (g && g.then) g.then(o => { st.prev = (o || {})['uas.turmas'] || null; }).catch(() => {}); } catch (e) { /* sem comparação */ }
    const box = h('div', { class: 'box', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Relatório da turma' });
    const back = h('div', { class: 'back', onclick: e => { if (e.target === back && !st.running) close(); } }, box);
    shadow.append(back);
    function close() { if (st.running) return; host.remove(); }
    host.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); if (st.running) cancel(); else close(); } });
    function cancel() { if (st.running && st.ctl) st.ctl.abort(); }

    const countOn = () => courses.filter(c => sel.has(c.id)).length;
    function draw() {
      box.replaceChildren(h('h2', {}, 'Relatório da turma'),
        h('p', { class: 'sub' }, 'Escolha as unidades curriculares. Lê a lista de participantes de cada uma (uma por vez, com pausa) e mostra as turmas com o número de matriculados. Nada é gravado no Moodle.'));
      if (!courses.length) { box.append(h('div', { class: 'empty' }, 'Não encontrei cursos nesta página. Role a página até os cursos aparecerem (ou use o filtro “Em andamento” do Moodle) e abra de novo.'), h('div', { class: 'row2' }, h('button', { type: 'button', onclick: close }, 'Fechar'))); return; }
      const fold = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const visible = () => { const q = fold(st.q).trim(); return q ? courses.filter(c => fold(`${c.name} ${c.category || ''}`).includes(q)) : courses; };
      const searchIn = h('input', { type: 'search', class: 'q', placeholder: 'Buscar curso ou categoria', 'aria-label': 'Buscar curso ou categoria', value: st.q || '', disabled: st.running });
      const barEl = h('div', { class: 'bar' }), listEl = h('div', { class: 'list' });
      function refresh() {
        const vis = visible(); const allOn = vis.length > 0 && vis.every(c => sel.has(c.id)); const hidden = countOn() - vis.filter(c => sel.has(c.id)).length;
        const all = h('button', { type: 'button', disabled: st.running || !vis.length, onclick: () => { if (allOn) vis.forEach(c => sel.delete(c.id)); else vis.forEach(c => sel.add(c.id)); draw(); } }, st.q && st.q.trim() ? (allOn ? 'Limpar os encontrados' : 'Selecionar os encontrados') : (allOn ? 'Limpar seleção' : 'Selecionar todas'));
        barEl.replaceChildren(all, h('span', { class: 'sp', role: 'status', 'aria-live': 'polite' }, `${countOn() ? `${countOn()} unidade(s) selecionada(s)` : 'Nenhuma unidade selecionada'}${st.q && st.q.trim() ? ` · ${vis.length} de ${courses.length} na busca${hidden ? ` · ${hidden} selecionada(s) fora da busca` : ''}` : ''}`));
        listEl.replaceChildren(...(vis.length ? vis.map(c => {
          const s = st.status.get(c.id);
          const chk = h('input', { type: 'checkbox', checked: sel.has(c.id), disabled: st.running, onchange: e => { if (e.target.checked) sel.add(c.id); else sel.delete(c.id); draw(); } });
          return h('div', { class: `it${sel.has(c.id) ? ' on' : ''}` }, h('label', {}, chk, h('b', {}, c.name), c.category ? h('small', {}, c.category) : null), s ? h('span', { class: `st ${s.tone}` }, s.text) : null);
        }) : [h('div', { class: 'empty' }, `Nenhum curso encontrado para “${st.q.trim()}”.`)]));
      }
      searchIn.addEventListener('input', () => { st.q = searchIn.value; refresh(); });
      box.append(searchIn, barEl, listEl);
      refresh();
      const chk2 = (obj, key, label, hint, dis) => h('label', { class: dis ? 'off' : '' }, h('input', { type: 'checkbox', checked: obj[key], disabled: st.running || dis, onchange: e => { obj[key] = e.target.checked; draw(); } }), label);
      box.append(h('div', { class: 'opt' }, h('strong', {}, 'O que ler'),
        chk2(st.inc, 'mat', 'Matrículas por turma (leve)'),
        chk2(st.inc, 'notas', 'Notas e situação por UC (mais pesado)'), h('span', { class: 'hint' }, 'Lê também o livro de notas de cada UC.')),
        h('div', { class: 'opt' }, h('strong', {}, 'Saída'),
          chk2(st.out, 'html', 'Página HTML', '', !st.inc.mat), chk2(st.out, 'xlsx', 'Excel', '')));
      if (st.running) box.append(h('div', { class: 'prog', role: 'progressbar', 'aria-label': 'Progresso' }, h('i', { style: `width:${st.pct || 0}%` })), h('div', { class: 'msg', role: 'status', 'aria-live': 'polite' }, st.msg || 'Lendo…'));
      if (st.result) box.append(h('div', { class: `msg ${st.result.tone}`, role: 'status' }, st.result.text));
      const pend = st.running ? [] : pendentes(); const lidas = courses.filter(c => sel.has(c.id) && lido(c.id)).length;
      box.append(h('div', { class: 'row2' }, st.running ? h('button', { type: 'button', onclick: cancel }, 'Cancelar') : h('button', { type: 'button', onclick: close }, 'Fechar'),
        !st.running && pend.length ? h('button', { type: 'button', class: 'pri', onclick: () => generate(pend.map(c => c.id)) }, `Tentar só as não verificadas (${pend.length})`) : null,
        !st.running && pend.length && lidas ? h('button', { type: 'button', onclick: entregar }, 'Gerar assim mesmo') : null,
        !st.running && st.resumo ? h('button', { type: 'button', onclick: copiar }, 'Copiar resumo') : null,
        st.running || pend.length ? null : h('button', { class: 'pri', type: 'button', disabled: !countOn() || !(st.inc.mat || st.inc.notas) || !(st.out.html || st.out.xlsx), onclick: () => generate() }, st.reports.size || st.mat.size ? 'Ler de novo' : 'Gerar relatório')));
    }

    // Leituras já feitas nesta janela. notas: st.reports (id → {students, complete, reason}); matrículas: st.mat (id → {alunos, complete, reason}).
    // Quem falhou fica em st.failed. Uma UC só está “lida” quando tudo o que foi pedido veio completo.
    const lido = id => (!st.inc.mat || st.mat.has(id)) && (!st.inc.notas || st.reports.has(id)) && (st.inc.mat || st.inc.notas);
    const incompleta = id => st.failed.has(id) || (st.inc.mat && st.mat.has(id) && !st.mat.get(id).complete) || (st.inc.notas && st.reports.has(id) && !st.reports.get(id).complete);
    const motivo = id => (st.failed.get(id) || (st.mat.get(id) && !st.mat.get(id).complete ? st.mat.get(id) : st.reports.get(id)) || {}).reason || 'parcial';
    const pendentes = () => courses.filter(c => sel.has(c.id) && (incompleta(c.id) || !lido(c.id)) && (st.failed.has(c.id) || st.mat.has(c.id) || st.reports.has(c.id)));
    function baixarArquivo(name, blob) {
      const a = h('a', { href: URL.createObjectURL(blob), download: name });
      root.document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    function entregar() {
      // Tudo o que foi lido entra, mesmo que a outra leitura da mesma UC tenha falhado (as matrículas não se perdem por causa das notas).
      const picked = courses.filter(c => sel.has(c.id) && ((st.inc.mat && st.mat.has(c.id)) || (st.inc.notas && st.reports.has(c.id))));
      if (!picked.length) return;
      const falhas = courses.filter(c => sel.has(c.id) && (!lido(c.id) || incompleta(c.id))).map(c => ({ name: c.name, category: c.category, reason: motivo(c.id) }));
      const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const feitos = [];
      let resumo = null;
      if (st.inc.mat) {
        const reps = picked.filter(c => st.mat.has(c.id)).map(c => ({ id: c.id, name: c.name, category: c.category, alunos: st.mat.get(c.id).alunos }));
        const avisos = [...new Set(picked.flatMap(c => (st.mat.get(c.id) || {}).avisos || []))];
        resumo = ALN.turma.resumoMatriculas(reps, falhas);
        st.diff = ALN.turma.diffTurmas(st.prev, resumo); st.resumo = resumo; st.avisosLeitura = avisos;
        if (st.out.html) {
          const notas = st.inc.notas ? ALN.turma.resumoNotas(courses.filter(c => sel.has(c.id)).map(c => {
            const r = st.reports.get(c.id), m = st.mat.get(c.id);
            if (!r) return { id: c.id, name: c.name, category: c.category, estado: 'falhou', motivo: (st.failed.get(c.id) || {}).reason || 'Livro de notas não lido.' };
            return { id: c.id, name: c.name, category: c.category, estado: r.complete ? 'completa' : 'parcial', students: r.students, de: m ? m.alunos.length : null, motivo: r.reason };
          })) : null;
          baixarArquivo(`painel-turmas-${day}.html`, new Blob([ALN.turmaHtml.build(resumo, { diff: st.diff, avisos, notas, anteriorEm: st.prev && st.prev.lidoEm })], { type: 'text/html;charset=utf-8' })); feitos.push('HTML');
        }
      }
      if (st.out.xlsx) {
        let sheets = resumo ? ALN.turma.buildSheetsMatriculas(resumo) : [];
        if (st.inc.notas) {
          const nr = picked.filter(c => st.reports.has(c.id)).map(c => { const r = st.reports.get(c.id); return { id: r.id, name: r.name, category: r.category, students: r.students }; });
          const fx = falhas.map(f => ({ ...f }));
          sheets = sheets.concat(ALN.turma.buildSheets(nr, fx).filter(x => !(resumo && x.name === 'Avisos')));
        }
        if (sheets.length) { const um = resumo && resumo.turmas.length === 1 ? `-${slug(resumo.turmas[0].turma)}` : ''; saveXlsx(`relatorio-turma-${day}${um}.xlsx`, sheets); feitos.push('Excel'); }
      }
      // Foto só de números para a próxima comparação — só quando a leitura veio completa.
      if (resumo && !falhas.length) { try { const snap = ALN.turma.snapshot(resumo, Date.now()); const w = root.chrome && chrome.storage && chrome.storage.local && chrome.storage.local.set({ 'uas.turmas': snap }); if (w && w.catch) w.catch(() => {}); st.prev = snap; } catch (e) { /* sem comparação */ } }
      const n = resumo ? `${resumo.totais.matriculados} matriculados em ${resumo.turmas.length} turma(s)` : `${picked.length} unidade(s)`;
      st.result = falhas.length ? { tone: 'warn', text: `Gerado: ${feitos.join(' e ')} — ${n}. Atenção: ${falhas.length} unidade(s) sem leitura completa — veja os avisos.` } : { tone: 'ok', text: `Gerado: ${feitos.join(' e ')} — ${n}.${st.diff.size ? ' Comparado com a leitura anterior.' : ''}` };
      draw();
    }
    function copiar() {
      if (!st.resumo) return;
      const txt = ALN.turma.resumoTexto(st.resumo, st.diff, new Date().toLocaleDateString('pt-BR'));
      const ok = () => { st.result = { tone: 'ok', text: 'Resumo copiado.' }; draw(); };
      const fail = () => { st.result = { tone: 'warn', text: 'Não consegui copiar automaticamente. Selecione e copie o texto abaixo.\n' + txt }; draw(); };
      try { navigator.clipboard.writeText(txt).then(ok, fail); } catch (e) { fail(); }
    }

    // only: lista de ids a (re)ler; vazio = todas as marcadas. O arquivo só sai sozinho se tudo foi lido por completo.
    async function generate(only) {
      const picked = courses.filter(c => sel.has(c.id) && (!only || only.includes(c.id)));
      if (!picked.length || st.running) return;
      st.running = true; st.ctl = new AbortController(); st.result = null;
      if (!only) { st.reports = new Map(); st.mat = new Map(); st.failed = new Map(); st.status = new Map(); st.resumo = null; }
      draw();
      try {
        for (let i = 0; i < picked.length; i++) {
          const c = picked[i];
          if (st.ctl.signal.aborted) throw new Error('Leitura cancelada.');
          st.status.set(c.id, { tone: 'go', text: 'lendo…' }); st.pct = Math.round((i / picked.length) * 100); st.msg = `Lendo ${i + 1} de ${picked.length} — ${c.name}`; draw();
          const onProgress = p => { st.msg = `Lendo ${i + 1} de ${picked.length} — ${c.name}: ${p.text || ''}`; const m = box.querySelector('.msg'); if (m) m.textContent = st.msg; };
          st.failed.delete(c.id); st.mat.delete(c.id); st.reports.delete(c.id);
          const partes = []; const erros = [];
          // Cada leitura tem o seu try: se as notas falharem, as matrículas já lidas ficam.
          if (st.inc.mat) {
            try {
              const r = await ALN.reader.readParticipantsFor({ id: c.id, name: c.name }, { signal: st.ctl.signal, onProgress });
              const m = ALN.turma.matriculas(r.rows);
              const aviso = [...r.warnings, ...m.avisos];
              st.mat.set(c.id, { alunos: m.alunos, avisos: aviso, complete: Boolean(r.complete) && !m.avisos.length, reason: r.complete ? aviso.join(' ') : `Leitura parcial: ${[r.error, ...aviso].filter(Boolean).join(' ') || 'conferir no Moodle'}` });
              partes.push(`${m.alunos.length} matriculados`);
            } catch (e) { if (st.ctl.signal.aborted) throw e; erros.push(`Matrículas: ${e && e.message ? e.message : e}`); }
          }
          if (st.inc.notas) {
            if (st.inc.mat) await ALN.reader.sleep(ALN.reader.SETTINGS.requestDelayMs);
            try {
              const r = await ALN.reader.readGradebookFor({ id: c.id, name: c.name }, { signal: st.ctl.signal, onProgress });
              const students = ALN.buildStudents({ gradebook: r.gradebook, participants: [] }, ALN.DEFAULTS);
              st.reports.set(c.id, { id: c.id, name: c.name, category: c.category, students, complete: Boolean(r.complete), reason: r.complete ? '' : `Leitura parcial: ${r.warnings.join(' ') || 'conferir no Moodle'}` });
              partes.push(`${students.length} com notas`);
            } catch (e) { if (st.ctl.signal.aborted) throw e; erros.push(`Notas: ${e && e.message ? e.message : e}`); }
          }
          if (erros.length) st.failed.set(c.id, { reason: erros.join(' | ') });
          const parcial = incompleta(c.id);
          st.status.set(c.id, erros.length && !partes.length ? { tone: 'er', text: 'não verificada' } : { tone: parcial ? 'go' : 'ok', text: `${partes.join(' · ')}${parcial ? ' (parcial)' : ''}` });
          if (i < picked.length - 1) await ALN.reader.sleep(ALN.reader.SETTINGS.requestDelayMs);
        }
        const pend = pendentes();
        if (!pend.length) { st.running = false; entregar(); return; }
        const lidas = courses.filter(c => sel.has(c.id) && lido(c.id) && !incompleta(c.id)).length;
        st.result = lidas
          ? { tone: 'warn', text: `Leitura incompleta: ${pend.length} unidade(s) não verificada(s) ou parcial(is). Nada foi gerado. Tente só as não verificadas, ou gere assim mesmo (as pendências vão para os avisos).` }
          : { tone: 'err', text: `Nenhuma unidade pôde ser lida por completo. ${pend.map(c => `${c.name}: ${motivo(c.id)}`).join(' | ')}` };
      } catch (e) {
        st.result = { tone: 'warn', text: /cancel/i.test(String(e && e.message)) ? 'Leitura cancelada. Nenhum arquivo foi gerado; o que já foi lido continua aqui.' : `Não foi possível gerar o relatório: ${e && e.message ? e.message : e}` };
      } finally { st.running = false; st.ctl = null; draw(); }
    }

    root.document.documentElement.append(host);
    draw();
    const first = shadow.querySelector('input,button'); if (first) first.focus();
    return { host, close };
  }

  ALN.turmaUi = { open };
})(globalThis);

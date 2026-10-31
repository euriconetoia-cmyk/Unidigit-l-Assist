// Painel do Relatório da turma (página "Meus cursos"): escolher UCs, ler o livro de notas de cada uma (com cancelar) e baixar o Excel.
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
    const st = { q: '', running: false, ctl: null, status: new Map(), result: null };
    const box = h('div', { class: 'box', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Relatório da turma' });
    const back = h('div', { class: 'back', onclick: e => { if (e.target === back && !st.running) close(); } }, box);
    shadow.append(back);
    function close() { if (st.running) return; host.remove(); }
    host.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); if (st.running) cancel(); else close(); } });
    function cancel() { if (st.running && st.ctl) st.ctl.abort(); }

    const countOn = () => courses.filter(c => sel.has(c.id)).length;
    function draw() {
      box.replaceChildren(h('h2', {}, 'Relatório da turma'),
        h('p', { class: 'sub' }, 'Escolha as unidades curriculares. Lê só o “Total do curso” de cada uma, em ordem e com pausa, e gera um Excel com uma aba por turma. Nada é gravado no Moodle.'));
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
        go.disabled = st.running || !countOn();
      }
      const go = h('button', { class: 'pri', type: 'button', onclick: generate }, 'Gerar relatório');
      searchIn.addEventListener('input', () => { st.q = searchIn.value; refresh(); });
      box.append(searchIn, barEl, listEl);
      refresh();
      if (st.running) box.append(h('div', { class: 'prog', role: 'progressbar', 'aria-label': 'Progresso' }, h('i', { style: `width:${st.pct || 0}%` })), h('div', { class: 'msg', role: 'status', 'aria-live': 'polite' }, st.msg || 'Lendo…'));
      if (st.result) box.append(h('div', { class: `msg ${st.result.tone}`, role: 'status' }, st.result.text));
      box.append(h('div', { class: 'row2' }, st.running ? h('button', { type: 'button', onclick: cancel }, 'Cancelar') : h('button', { type: 'button', onclick: close }, 'Fechar'), st.running ? null : go));
    }

    async function generate() {
      const picked = courses.filter(c => sel.has(c.id));
      if (!picked.length || st.running) return;
      st.running = true; st.ctl = new AbortController(); st.result = null; st.status = new Map(); draw();
      const reports = [], failures = [];
      try {
        for (let i = 0; i < picked.length; i++) {
          const c = picked[i];
          if (st.ctl.signal.aborted) throw new Error('Leitura cancelada.');
          st.status.set(c.id, { tone: 'go', text: 'lendo…' }); st.pct = Math.round((i / picked.length) * 100); st.msg = `Lendo ${i + 1} de ${picked.length} — ${c.name}`; draw();
          try {
            const r = await ALN.reader.readGradebookFor({ id: c.id, name: c.name }, { signal: st.ctl.signal, onProgress: p => { st.msg = `Lendo ${i + 1} de ${picked.length} — ${c.name}: ${p.text || ''}`; const m = box.querySelector('.msg'); if (m) m.textContent = st.msg; } });
            const students = ALN.buildStudents({ gradebook: r.gradebook, participants: [] }, ALN.DEFAULTS);
            reports.push({ id: c.id, name: c.name, category: c.category, students });
            st.status.set(c.id, { tone: r.complete ? 'ok' : 'go', text: r.complete ? `${students.length} alunos` : `${students.length} alunos (parcial)` });
            if (!r.complete) failures.push({ name: c.name, category: c.category, reason: `Leitura parcial: ${r.warnings.join(' ') || 'conferir no Moodle'}` });
          } catch (e) {
            if (st.ctl.signal.aborted) throw e;
            st.status.set(c.id, { tone: 'er', text: 'falhou' }); failures.push({ name: c.name, category: c.category, reason: e && e.message ? e.message : String(e) });
          }
          if (i < picked.length - 1) await ALN.reader.sleep(ALN.reader.SETTINGS.requestDelayMs);
        }
        if (!reports.length) { st.result = { tone: 'err', text: `Nenhuma unidade pôde ser lida. ${failures.map(f => `${f.name}: ${f.reason}`).join(' | ')}` }; return; }
        const turmas = ALN.turma.groupByTurma(reports).length;
        const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        saveXlsx(`relatorio-turma-${day}${turmas === 1 ? `-${slug(ALN.turma.groupByTurma(reports)[0].turma)}` : ''}.xlsx`, ALN.turma.buildSheets(reports, failures));
        st.result = failures.length ? { tone: 'warn', text: `Excel gerado com ${reports.length} unidade(s) em ${turmas} turma(s). Atenção: ${failures.length} aviso(s) — veja a aba “Avisos”.` } : { tone: 'ok', text: `Excel gerado com ${reports.length} unidade(s) em ${turmas} turma(s).` };
      } catch (e) {
        st.result = { tone: 'warn', text: /cancel/i.test(String(e && e.message)) ? 'Leitura cancelada. Nenhum arquivo foi gerado.' : `Não foi possível gerar o relatório: ${e && e.message ? e.message : e}` };
      } finally { st.running = false; st.ctl = null; draw(); }
    }

    root.document.documentElement.append(host);
    draw();
    const first = shadow.querySelector('input,button'); if (first) first.focus();
    return { host, close };
  }

  ALN.turmaUi = { open };
})(globalThis);

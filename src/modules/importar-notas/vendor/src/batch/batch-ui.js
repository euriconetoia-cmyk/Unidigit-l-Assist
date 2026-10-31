// Tela "Lançar notas (CSV)" das páginas de curso e de categoria: CSV único → prévia por atividade → uma confirmação
// → execução atividade por atividade (salvar + reler) → resultado e relatório.
// Todo texto de arquivo/página entra no DOM via IMN.dom.h (textContent).
(function (root) {
  'use strict';
  const IMN = root.IMN;
  const h = IMN.dom.h;
  const B = IMN.batch;
  const flat = list => list.flat(Infinity).filter(x => x !== null && x !== undefined && x !== false);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function readFile(win, file) {
    return new Promise((resolve, reject) => {
      const reader = new win.FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
      reader.readAsArrayBuffer(file);
    });
  }

  const OUTCOME_LABEL = {
    conferido: 'salva e conferida', sem_alteracao: 'sem alteração', nao_lancada: 'não lançada', divergente: 'NÃO CONFERE',
    nao_verificada: 'salva, mas não conferida', nao_executada: 'não executada', cancelada: 'cancelada'
  };

  function init(doc, win, deps, bar) {
    if (!bar || !bar.el || doc.getElementById('imn-batch-root')) return null;
    const rootEl = h(doc, 'div', { id: 'imn-batch-root', class: 'imn-root' });
    const backdrop = h(doc, 'div', { class: 'imn-backdrop', hidden: true });
    rootEl.append(backdrop);
    doc.body.append(rootEl);

    const openButton = h(doc, 'button', { type: 'button', class: 'imn-ib imn-batch-open', 'aria-label': 'Lançar notas a partir de um CSV', title: 'Lançar notas a partir do CSV da IA (várias atividades de uma vez)', onclick: () => open() }, IMN.dom.icon(doc, IMN.radar.ICONS.upload));
    const row = bar.el.querySelector('.imn-bar-row');
    if (bar.icons) bar.icons.append(openButton); else if (row) row.append(openButton); else bar.el.append(openButton);

    const state = {
      phase: 'idle', fileName: '', split: null, activities: [], rejected: [], error: '', edits: {}, overwriteGrade: false, overwriteFeedback: false,
      filter: 'all', loaded: 0, progress: [], runner: null, outcome: null, expanded: new Set(), note: ''
    };
    let lastFocus = null;

    const open = () => { lastFocus = doc.activeElement; backdrop.hidden = false; render(); const c = backdrop.querySelector('.imn-close'); if (c) c.focus(); };
    const close = () => { backdrop.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); };

    // ---------- carregar arquivo ----------
    async function loadFile(buffer, name) {
      state.error = ''; state.edits = {}; state.activities = []; state.rejected = []; state.outcome = null; state.progress = []; state.expanded = new Set();
      try {
        const rows = /\.xlsx$/i.test(name) ? await IMN.xlsx.parseXlsx(buffer) : IMN.csv.parseDelimited(IMN.csv.decodeText(buffer));
        state.split = B.splitByActivity(rows);
      } catch (error) {
        state.split = null; state.phase = 'idle'; state.error = error.message; render(); return;
      }
      state.fileName = name;
      state.rejected = state.split.rejected;
      state.phase = 'loading'; state.loaded = 0; render();
      const origin = win.location.origin;
      state.activities = await Promise.all(state.split.groups.map(async group => {
        const info = await IMN.batchLoader.loadActivity(group.activityId, { fetchDoc: deps.fetchDoc, governor: deps.governor, origin });
        state.loaded += 1;
        const status = backdrop.querySelector('.imn-loading');
        if (status) status.textContent = `Lendo as atividades do Moodle… ${state.loaded} de ${state.split.groups.length}`;
        return { cmid: group.activityId, group, info, parsed: null, plan: null, error: info.error || '' };
      }));
      for (const a of state.activities) {
        if (a.error) continue;
        try { a.parsed = B.parseActivityRecords(a.group, state.split.header, a.info.max); }
        catch (error) { a.error = error.message; }
      }
      replanAll();
      state.expanded = new Set(state.activities.filter(a => a.plan && (a.plan.summary.blocked || a.plan.flagged)).map(a => a.cmid));
      if (!state.expanded.size && state.activities[0]) state.expanded.add(state.activities[0].cmid);
      state.phase = 'preview';
      render();
    }

    function replan(a) {
      if (!a.parsed || !a.info || a.info.error) { a.plan = null; return; }
      a.plan = B.planActivity(a.parsed.records, a.info, { edits: state.edits, overwriteGrade: state.overwriteGrade, overwriteFeedback: state.overwriteFeedback });
    }
    const replanAll = () => state.activities.forEach(replan);
    const summary = () => B.summarize(state.activities.map(a => ({ group: a.group, plan: a.plan })), state.rejected);

    // ---------- edição na prévia (atualiza a linha sem recriar os campos) ----------
    const gradeText = (a, record) => (record.grade.empty ? '' : record.grade.ok ? IMN.grade.formatGrade(record.grade.canonical, a.info.decimal) : record.notaRaw);
    const original = (a, rowNumber) => a.parsed.records.find(r => r.rowNumber === rowNumber);
    const editable = item => Boolean(item.row) && item.match.status !== 'conflict';
    const hasGradeIssue = item => item.reasons.some(r => /^Nota:/.test(r));
    const isEdited = item => Boolean(item.record.edited && Object.keys(item.record.edited).length);

    function onEdit(a, item, field, input) {
      const base = original(a, item.record.rowNumber);
      const baseText = field === 'grade' ? gradeText(a, base) : base.feedback;
      const key = item.record.rowNumber;
      const entry = { ...(state.edits[key] || {}) };
      if (input.value.trim() === String(baseText).trim()) delete entry[field]; else entry[field] = input.value;
      if (Object.keys(entry).length) state.edits[key] = entry; else delete state.edits[key];
      replan(a);
      refreshActivity(a);
      refreshTop();
    }

    function fieldNote(item, field) {
      const change = item.changes.find(c => c.field === field);
      const skip = item.skipped.find(c => c.field === field);
      if (change) return h(doc, 'span', {}, 'atual: ', change.from ? h(doc, 'span', { class: 'imn-old' }, change.from) : h(doc, 'span', { class: 'imn-empty' }, '(vazio)'), ' → será gravado');
      if (skip) return h(doc, 'span', { class: 'imn-muted' }, `${skip.reason}. Edite o campo para gravar mesmo assim.`);
      return h(doc, 'span', {}, '');
    }

    function fieldCell(a, item, field) {
      const label = field === 'grade' ? 'Nota' : 'Feedback';
      if (!editable(item)) return h(doc, 'td', { 'data-label': label }, '—');
      const who = item.row.name;
      const isGrade = field === 'grade';
      const input = isGrade
        ? h(doc, 'input', { type: 'text', inputmode: 'decimal', class: 'imn-input imn-input-grade', 'aria-label': `Nota de ${who}`, value: item.record.edited && item.record.edited.grade ? item.record.notaRaw : gradeText(a, item.record), onchange: e => onEdit(a, item, 'grade', e.target) })
        : h(doc, 'textarea', { class: 'imn-input imn-input-feedback', rows: '2', 'aria-label': `Feedback de ${who}`, onchange: e => onEdit(a, item, 'feedback', e.target) }, item.record.feedback);
      if (isGrade) input.setAttribute('aria-invalid', hasGradeIssue(item) ? 'true' : 'false');
      return h(doc, 'td', { 'data-label': label }, input, h(doc, 'div', { class: `imn-note imn-note-${field}` }, fieldNote(item, field)));
    }

    const chip = status => h(doc, 'span', { class: `imn-chip imn-${status}` }, { ready: 'Pronto', unchanged: 'Sem alteração', blocked: 'Bloqueado' }[status]);
    const notes = item => flat([
      item.reasons.map(r => h(doc, 'div', { class: 'imn-reason' }, r)),
      item.alerts.map(t => h(doc, 'div', { class: 'imn-flag' }, `Conferir: ${t}`))
    ]);
    const rowClass = item => `imn-row-${item.status}${isEdited(item) ? ' imn-row-edited' : ''}${item.alerts.length ? ' imn-row-flagged' : ''}`;
    const visible = item => state.filter === 'all' || (state.filter === 'ready' && item.status === 'ready') || (state.filter === 'blocked' && item.status === 'blocked') || (state.filter === 'flag' && item.alerts.length > 0);

    function itemRow(a, item) {
      const who = item.row ? item.row.name : item.record.nome || `id ${item.record.id}`;
      return h(doc, 'tr', { class: rowClass(item), 'data-row': String(item.record.rowNumber), hidden: !visible(item) },
        h(doc, 'td', { 'data-label': 'Aluno' }, h(doc, 'strong', {}, who), h(doc, 'div', { class: 'imn-muted' }, `id ${item.record.id}`), h(doc, 'div', { class: 'imn-reasons' }, ...notes(item))),
        fieldCell(a, item, 'grade'),
        fieldCell(a, item, 'feedback'),
        h(doc, 'td', { 'data-label': 'Status', class: 'imn-status' }, chip(item.status), isEdited(item) ? h(doc, 'div', { class: 'imn-muted' }, 'editado') : null));
    }

    function actChips(a) {
      if (!a.plan) return [h(doc, 'span', { class: 'imn-chip imn-blocked' }, 'Não lida')];
      const s = a.plan.summary;
      return flat([
        h(doc, 'span', { class: 'imn-chip imn-neutral' }, a.info.max === null ? 'nota máx. não lida' : `nota máx. ${String(a.info.max).replace('.', ',')}`),
        s.ready ? h(doc, 'span', { class: 'imn-chip imn-ready' }, plural(s.ready, 'pronto', 'prontos')) : null,
        s.unchanged ? h(doc, 'span', { class: 'imn-chip imn-unchanged' }, `${s.unchanged} sem alteração`) : null,
        s.blocked ? h(doc, 'span', { class: 'imn-chip imn-blocked' }, plural(s.blocked, 'bloqueado', 'bloqueados')) : null,
        a.plan.flagged ? h(doc, 'span', { class: 'imn-chip imn-flagchip' }, `${a.plan.flagged} p/ conferir`) : null
      ]);
    }

    function actWarnings(a) {
      if (!a.info || a.info.error) return [];
      return flat([
        a.info.hasMorePages ? h(doc, 'p', { class: 'imn-warn' }, 'Esta atividade tem mais de uma página de alunos; quem não estiver na primeira aparece como "não encontrado".') : null,
        a.info.max === null ? h(doc, 'p', { class: 'imn-warn' }, 'A nota máxima não foi lida na página: o limite não pôde ser verificado.') : null,
        a.plan ? a.plan.groupAlerts.map(t => h(doc, 'p', { class: 'imn-warn' }, `Conferir: ${t}`)) : null,
        a.parsed ? a.parsed.warnings.slice(0, 3).map(w => h(doc, 'p', { class: 'imn-warn' }, w)) : null
      ]);
    }

    function activitySection(a) {
      const title = `${a.info && a.info.course ? `${a.info.course} › ` : ''}${(a.info && a.info.name) || `Atividade ${a.cmid}`}`;
      const open = state.expanded.has(a.cmid);
      const body = h(doc, 'div', { class: 'imn-act-body', hidden: !open });
      const head = h(doc, 'button', { type: 'button', class: 'imn-act-head', 'aria-expanded': String(open), onclick: () => {
        const now = body.hidden; body.hidden = !now; head.setAttribute('aria-expanded', String(now)); caret.textContent = now ? '▾' : '▸';
        if (now) state.expanded.add(a.cmid); else state.expanded.delete(a.cmid);
      } });
      const caret = h(doc, 'span', { class: 'imn-caret', 'aria-hidden': 'true' }, open ? '▾' : '▸');
      head.append(h(doc, 'strong', {}, title), h(doc, 'span', { class: 'imn-act-chips' }, ...actChips(a)), h(doc, 'span', { class: 'imn-spacer' }), caret);
      if (a.error || !a.plan) {
        body.append(h(doc, 'p', { class: 'imn-alert' }, `Atividade ${a.cmid}: ${a.error || 'não foi possível ler.'} As ${plural(a.group.rows.length, 'linha', 'linhas')} desta atividade não serão lançadas.`));
      } else {
        body.append(...actWarnings(a), h(doc, 'div', { class: 'imn-table-wrap' }, h(doc, 'table', { class: 'imn-table' },
          h(doc, 'thead', {}, h(doc, 'tr', {}, ['Aluno', 'Nota', 'Feedback', 'Status'].map(t => h(doc, 'th', { scope: 'col' }, t)))),
          h(doc, 'tbody', {}, ...a.plan.items.map(item => itemRow(a, item))))));
      }
      return h(doc, 'section', { class: 'imn-act', 'data-cmid': a.cmid }, head, body);
    }

    function refreshActivity(a) {
      const sec = backdrop.querySelector(`section[data-cmid="${a.cmid}"]`);
      if (!sec || !a.plan) return;
      const chips = sec.querySelector('.imn-act-chips');
      if (chips) chips.replaceChildren(...actChips(a));
      for (const item of a.plan.items) {
        const tr = sec.querySelector(`tr[data-row="${item.record.rowNumber}"]`);
        if (!tr) continue;
        tr.className = rowClass(item);
        const reasons = tr.querySelector('.imn-reasons'); if (reasons) reasons.replaceChildren(...notes(item));
        const status = tr.querySelector('.imn-status');
        if (status) status.replaceChildren(...flat([chip(item.status), isEdited(item) ? h(doc, 'div', { class: 'imn-muted' }, 'editado') : null]));
        for (const field of ['grade', 'feedback']) { const n = tr.querySelector(`.imn-note-${field}`); if (n) n.replaceChildren(fieldNote(item, field)); }
        const g = tr.querySelector('.imn-input-grade'); if (g) g.setAttribute('aria-invalid', hasGradeIssue(item) ? 'true' : 'false');
      }
    }

    function counters() {
      const s = summary();
      return [['ready', s.ready, 'Prontos'], ['unchanged', s.unchanged, 'Sem alteração'], ['blocked', s.blocked, 'Bloqueados'], ['flag', s.flagged, 'Para conferir']];
    }
    function refreshTop() {
      const s = summary();
      counters().forEach(([key, value]) => { const el = backdrop.querySelector(`.imn-count-${key} b`); if (el) el.textContent = String(value); });
      const sum = backdrop.querySelector('.imn-summary'); if (sum) sum.textContent = summaryText(s);
      const go = backdrop.querySelector('.imn-go'); if (go) { go.textContent = goLabel(s); go.disabled = s.ready === 0; }
    }
    const summaryText = s => `${state.fileName}: ${plural(state.split.groups.reduce((n, g) => n + g.rows.length, 0) + state.rejected.length, 'linha', 'linhas')} · ${plural(s.activities, 'atividade', 'atividades')}`;
    const goLabel = s => `Lançar ${s.ready} aluno(s) em ${s.readyActivities} atividade(s)`;

    // ---------- reconferência pelo radar ----------
    // Mesmo caminho do radar ("Precisa de avaliação" na página da atividade): não depende da tabela de alunos, de filtros
    // nem do iframe. Lida ANTES e DEPOIS de salvar, mostra se ainda há envio sem nota.
    state.recheck = new Map();
    const pendingRef = cmid => ({ assignmentId: String(cmid), href: new URL(`/mod/assign/view.php?id=${cmid}`, win.location.origin).href });
    async function readPending(cmid) {
      if (!deps.scanner || typeof deps.scanner.pendingCount !== 'function') return { state: 'indisponivel', message: 'leitor do radar ausente' };
      try {
        const n = await deps.scanner.pendingCount(pendingRef(cmid), { force: true });
        return n === null ? { state: 'na' } : { state: 'ok', count: n };
      } catch (error) { return { state: 'erro', message: error && error.message ? error.message : 'falha na leitura' }; }
    }
    function recheckVerdict(cmid) {
      const e = state.recheck.get(String(cmid));
      if (!e || !e.after) return null;
      const A = e.after; const Bv = e.before && e.before.state === 'ok' ? e.before.count : null;
      if (A.state === 'na') return { code: 'sem_controle', tone: 'info', text: 'Reconferência pelo radar: esta atividade não mostra "Precisa de avaliação".' };
      if (A.state !== 'ok') return { code: 'indisponivel', tone: 'warn', text: `Reconferência pelo radar indisponível: ${A.message || 'não foi possível ler'}.` };
      if (A.count === 0) return { code: 'zerado', tone: 'ok', text: `Reconferência pelo radar: nenhum envio sem nota${Bv !== null ? ` (eram ${Bv})` : ''}.` };
      if (Bv !== null && A.count < Bv) return { code: 'diminuiu', tone: 'info', text: `Reconferência pelo radar: envios sem nota caíram de ${Bv} para ${A.count}.` };
      return { code: 'restam', tone: 'warn', text: `Reconferência pelo radar: ainda há ${plural(A.count, 'envio sem nota', 'envios sem nota')}${Bv !== null ? ` (antes: ${Bv})` : ''}. Pode ser aluno fora do arquivo ou nota não salva.` };
    }
    const RECHECKED = ['conferido', 'sem_alteracao', 'nao_verificada', 'divergente'];
    async function recheckAfter(results) {
      await Promise.all(results.filter(r => RECHECKED.includes(r.outcome)).map(async r => {
        const e = state.recheck.get(String(r.cmid)) || {};
        e.after = await readPending(r.cmid);
        state.recheck.set(String(r.cmid), e);
      }));
    }
    async function recheckNow() {
      if (!state.outcome) return;
      state.note = 'Reconferindo pelo radar…'; render();
      await recheckAfter(state.outcome.results);
      state.note = ''; render();
    }

    // ---------- execução ----------
    function buildJobs() {
      return state.activities.filter(a => a.plan && a.plan.summary.ready > 0).map(a => ({
        cmid: a.cmid, name: `${a.info.course ? `${a.info.course} › ` : ''}${a.info.name}`, url: a.info.url,
        records: IMN.records.applyEdits(a.parsed.records, state.edits, { max: a.info.max }),
        overwriteGrade: state.overwriteGrade, overwriteFeedback: state.overwriteFeedback, expected: IMN.plan.toExpected(a.plan)
      }));
    }

    const beforeUnload = e => { e.preventDefault(); e.returnValue = ''; };

    async function start() {
      const jobs = buildJobs();
      if (!jobs.length) return;
      state.phase = 'running';
      state.progress = jobs.map(j => ({ cmid: j.cmid, name: j.name, status: 'wait', message: '' }));
      const driver = deps.createBatchDriver ? deps.createBatchDriver() : IMN.batchRunner.createIframeDriver(win, doc);
      state.runner = IMN.batchRunner.createBatchRunner({ driver, governor: deps.governor, win, gapMs: deps.batchGapMs ?? 350, onProgress: e => {
        const p = state.progress[e.index];
        if (e.type === 'start' && p) p.status = 'active';
        if (e.type === 'done' && p) { p.status = e.result.outcome; p.message = e.result.message; }
        if (e.type === 'paused') state.note = 'Lote em pausa.';
        renderRunning();
      } });
      win.addEventListener('beforeunload', beforeUnload);
      state.recheck = new Map();
      state.note = 'Lendo os envios sem nota de cada atividade antes de lançar…';
      render();
      await Promise.all(jobs.map(async j => { state.recheck.set(String(j.cmid), { before: await readPending(j.cmid) }); }));
      state.note = '';
      render();
      let outcome;
      try { outcome = await state.runner.run(jobs); }
      finally { win.removeEventListener('beforeunload', beforeUnload); }
      state.note = 'Reconferindo pelo radar…';
      state.outcome = { ...outcome, jobs };
      renderRunning();
      await recheckAfter(outcome.results);
      state.note = '';
      state.phase = 'done';
      state.runner = null;
      render();
    }

    function reportRows() {
      const rows = [];
      const results = new Map((state.outcome ? state.outcome.results : []).map(r => [String(r.cmid), r]));
      for (const a of state.activities) {
        const name = a.info && a.info.name ? a.info.name : '';
        if (!a.plan) { rows.push({ atividade_id: a.cmid, atividade: name, resultado: 'atividade_nao_lida', motivo: a.error }); continue; }
        const res = results.get(String(a.cmid));
        const done = new Set();
        if (res) for (const f of res.fields) {
          done.add(`${f.userId}|${f.field}`);
          rows.push({ atividade_id: a.cmid, atividade: name, id: f.userId, nome: f.name, campo: f.field === 'grade' ? 'nota' : 'feedback', valor_anterior: f.from, valor_enviado: f.to, valor_no_moodle: f.after, resultado: f.status, motivo: f.reason });
        }
        for (const item of a.plan.items) {
          const base = { atividade_id: a.cmid, atividade: name, id: item.record.id, nome: item.row ? item.row.name : item.record.nome };
          if (item.status === 'blocked') rows.push({ ...base, resultado: 'bloqueado', motivo: item.reasons.join(' ') });
          else if (item.status === 'unchanged') rows.push({ ...base, resultado: 'sem_alteracao', motivo: item.skipped.map(s => s.reason).join('; ') });
          else if (!res || !item.changes.some(c => done.has(`${item.row.userId}|${c.field}`))) rows.push({ ...base, resultado: res ? res.outcome : 'nao_executada', motivo: res ? res.message : 'O lote não chegou a esta atividade.' });
        }
      }
      for (const a of state.activities) {
        const v = recheckVerdict(a.cmid);
        if (!v) continue;
        const e = state.recheck.get(String(a.cmid));
        rows.push({ atividade_id: a.cmid, atividade: a.info && a.info.name ? a.info.name : '', campo: 'envios_sem_nota_radar', valor_anterior: e.before && e.before.state === 'ok' ? e.before.count : '', valor_no_moodle: e.after.state === 'ok' ? e.after.count : '', resultado: v.code, motivo: v.text });
      }
      for (const r of state.rejected) rows.push({ resultado: 'linha_rejeitada', motivo: `Linha ${r.rowNumber}: ${r.reason}` });
      return rows;
    }

    function downloadReport() {
      const blob = new win.Blob(['﻿', B.buildReportCsv(reportRows())], { type: 'text/csv;charset=utf-8' });
      const url = win.URL.createObjectURL(blob);
      const a = h(doc, 'a', { href: url, download: `relatorio_lote_${new Date().toISOString().slice(0, 10)}.csv`, style: 'display:none' });
      doc.body.append(a); a.click(); a.remove();
      win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
    }

    async function copyPrompt() {
      try { await win.navigator.clipboard.writeText(B.BATCH_PROMPT); state.note = 'Prompt copiado.'; }
      catch (_) { state.error = 'O navegador bloqueou a cópia automática.'; }
      render();
    }

    // ---------- telas ----------
    const head = title => h(doc, 'div', { class: 'imn-head' }, h(doc, 'h2', { id: 'imn-batch-title' }, title), h(doc, 'button', { type: 'button', class: 'imn-close', 'aria-label': 'Fechar', onclick: close }, '×'));

    function mountDialog(parts) {
      const dialog = h(doc, 'div', { class: 'imn-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'imn-batch-title', tabindex: '-1' }, ...flat(parts));
      dialog.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
        if (e.key !== 'Tab') return;
        const f = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled])')];
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      });
      backdrop.replaceChildren(dialog);
    }

    function renderMain() {
      const parts = [head('Lançar notas do pacote')];
      parts.push(h(doc, 'p', { class: 'imn-muted' }, `Escolha o CSV único gerado pela IA (${B.BATCH_HEADER}). O lançamento é feito por id, nunca por nome.`));
      parts.push(h(doc, 'div', { class: 'imn-actions' },
        h(doc, 'label', { class: 'imn-file' }, 'Escolher arquivo (CSV, TSV ou XLSX)',
          h(doc, 'input', { type: 'file', accept: '.csv,.tsv,.txt,.xlsx', disabled: state.phase === 'loading', onchange: async e => { const f = e.target.files[0]; if (f) await loadFile(await readFile(win, f), f.name); } })),
        h(doc, 'button', { type: 'button', class: 'imn-btn', onclick: copyPrompt }, 'Copiar prompt para IA')));
      if (state.note) parts.push(h(doc, 'p', { class: 'imn-ok' }, state.note));
      if (state.error) parts.push(h(doc, 'p', { class: 'imn-alert', role: 'alert' }, state.error));
      if (state.phase === 'loading') {
        parts.push(h(doc, 'p', { class: 'imn-loading imn-muted', role: 'status' }, `Lendo as atividades do Moodle… ${state.loaded} de ${state.split.groups.length}`));
      }
      if (state.phase === 'preview' || state.phase === 'confirm') {
        const s = summary();
        parts.push(h(doc, 'p', { class: 'imn-summary' }, summaryText(s)));
        parts.push(h(doc, 'div', { class: 'imn-counts' }, ...counters().map(([key, value, label]) => h(doc, 'div', { class: `imn-count imn-count-${key}` }, h(doc, 'b', {}, String(value)), label))));
        parts.push(h(doc, 'div', { class: 'imn-options' },
          ...[['all', 'Todos'], ['ready', 'Prontos'], ['blocked', 'Bloqueados'], ['flag', 'Para conferir']].map(([key, label]) =>
            h(doc, 'button', { type: 'button', class: 'imn-pill', 'aria-pressed': String(state.filter === key), onclick: () => { state.filter = key; render(); } }, label)),
          h(doc, 'span', { class: 'imn-spacer' }),
          h(doc, 'label', {}, h(doc, 'input', { type: 'checkbox', checked: state.overwriteGrade, onchange: e => { state.overwriteGrade = e.target.checked; replanAll(); render(); } }), ' Sobrescrever notas já lançadas'),
          h(doc, 'label', {}, h(doc, 'input', { type: 'checkbox', checked: state.overwriteFeedback, onchange: e => { state.overwriteFeedback = e.target.checked; replanAll(); render(); } }), ' Sobrescrever feedbacks já lançados')));
        parts.push(h(doc, 'p', { class: 'imn-muted' }, 'Corrija nota e feedback direto na tabela. "Para conferir" são avisos: não bloqueiam, mas vale olhar antes de lançar.'));
        if (state.rejected.length) {
          parts.push(h(doc, 'div', { class: 'imn-alert' }, h(doc, 'strong', {}, `${plural(state.rejected.length, 'linha rejeitada', 'linhas rejeitadas')} (sem atividade_id ou id válido):`), ...state.rejected.slice(0, 8).map(r => h(doc, 'div', {}, `Linha ${r.rowNumber}: ${r.reason}`)), state.rejected.length > 8 ? h(doc, 'div', {}, `…e mais ${state.rejected.length - 8}. Veja o relatório.`) : null));
        }
        parts.push(h(doc, 'div', { class: 'imn-acts' }, ...state.activities.map(activitySection)));
        const foot = [];
        if (state.phase === 'preview') {
          foot.push(h(doc, 'button', { type: 'button', class: 'imn-btn imn-primary imn-go', disabled: s.ready === 0, onclick: () => { state.phase = 'confirm'; render(); } }, goLabel(s)));
          foot.push(h(doc, 'span', { class: 'imn-muted' }, 'Nada é salvo antes da sua confirmação.'));
        } else {
          foot.push(h(doc, 'strong', {}, `Salvar ${plural(s.grades + s.feedbacks, 'alteração', 'alterações')} em ${plural(s.readyActivities, 'atividade', 'atividades')}? Cada atividade é salva e relida antes da próxima; se algum campo não conferir, o lote para. Mantenha esta aba aberta até o fim.`));
          foot.push(h(doc, 'button', { type: 'button', class: 'imn-btn imn-primary imn-confirm', onclick: start }, 'Confirmar e lançar'));
          foot.push(h(doc, 'button', { type: 'button', class: 'imn-btn', onclick: () => { state.phase = 'preview'; render(); } }, 'Voltar'));
        }
        parts.push(h(doc, 'div', { class: 'imn-foot' }, ...foot));
      }
      mountDialog(parts);
    }

    function progressList() {
      return h(doc, 'div', { class: 'imn-progress' }, ...state.progress.map((p, i) => {
        const tone = p.status === 'conferido' || p.status === 'sem_alteracao' ? 'ok' : p.status === 'active' ? 'active' : p.status === 'wait' ? 'wait' : p.status === 'nao_executada' || p.status === 'cancelada' ? 'wait' : 'bad';
        const text = p.status === 'wait' ? 'aguardando' : p.status === 'active' ? 'salvando e conferindo…' : OUTCOME_LABEL[p.status] || p.status;
        return h(doc, 'div', { class: `imn-step imn-step-${tone}` }, h(doc, 'span', { class: 'imn-step-dot', 'aria-hidden': 'true' }, tone === 'ok' ? '✓' : String(i + 1)),
          h(doc, 'div', {}, h(doc, 'strong', {}, `${p.name} · ${text}`), p.message ? h(doc, 'div', {}, p.message) : null,
            (state.phase === 'done' && recheckVerdict(p.cmid)) ? h(doc, 'div', { class: `imn-recheck-line imn-recheck-${recheckVerdict(p.cmid).tone}` }, recheckVerdict(p.cmid).text) : null));
      }));
    }

    function renderRunning() {
      if (state.phase !== 'running') return;
      const finished = state.progress.filter(p => !['wait', 'active'].includes(p.status)).length;
      const paused = state.runner && state.runner.isPaused;
      mountDialog([
        head('Lançando…'),
        h(doc, 'p', { class: 'imn-summary', role: 'status' }, `${finished} de ${state.progress.length} atividades${paused ? ' · em pausa' : ''}`),
        h(doc, 'div', { class: 'imn-bar-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(state.progress.length), 'aria-valuenow': String(finished), 'aria-label': 'Progresso do lote' }, h(doc, 'i', { style: `width:${Math.round(100 * finished / Math.max(1, state.progress.length))}%` })),
        state.note ? h(doc, 'p', { class: 'imn-muted imn-note', role: 'status' }, state.note) : null,
        progressList(),
        h(doc, 'p', { class: 'imn-banner-line' }, 'Se algum campo não bater depois de salvar, o lote para na hora e mostra qual. Falha de leitura nunca vira nota zero.'),
        h(doc, 'div', { class: 'imn-foot' },
          h(doc, 'button', { type: 'button', class: 'imn-btn imn-pause', onclick: () => { if (state.runner.isPaused) { state.runner.resume(); state.note = ''; } else state.runner.pause(); renderRunning(); } }, paused ? 'Continuar' : 'Pausar'),
          h(doc, 'button', { type: 'button', class: 'imn-btn imn-cancel', onclick: () => state.runner.cancel() }, 'Cancelar o que falta'),
          h(doc, 'span', { class: 'imn-muted' }, 'Mantenha esta aba aberta.'))
      ]);
    }

    function recheckSummary(out) {
      const verdicts = out.results.map(r => recheckVerdict(r.cmid)).filter(Boolean);
      if (!verdicts.length) return null;
      const zero = verdicts.filter(v => v.code === 'zerado').length;
      const rest = verdicts.filter(v => v.code === 'restam').length;
      const down = verdicts.filter(v => v.code === 'diminuiu').length;
      const na = verdicts.length - zero - rest - down;
      return h(doc, 'p', { class: `imn-recheck-summary ${rest ? 'imn-warn' : 'imn-ok'}`, role: 'status' },
        h(doc, 'strong', {}, 'Reconferência pelo radar: '),
        `${plural(zero, 'atividade sem envio sem nota', 'atividades sem envio sem nota')}${down ? `, ${plural(down, 'com menos pendências', 'com menos pendências')}` : ''}${rest ? `, ${plural(rest, 'ainda com envio sem nota', 'ainda com envios sem nota')}` : ''}${na ? `, ${na} sem leitura` : ''}.`,
        state.note ? ` ${state.note}` : '');
    }

    function renderDone() {
      const out = state.outcome;
      const fields = out.results.flatMap(r => r.fields);
      const okFields = fields.filter(f => f.status === 'conferido');
      const bad = fields.filter(f => f.status === 'divergente' || f.status === 'nao_verificado');
      const badKeys = new Set(out.results.flatMap(r => r.fields.filter(f => f.status === 'divergente' || f.status === 'nao_verificado').map(f => `${r.cmid}|${f.userId}`)));
      const students = new Set(out.results.flatMap(r => r.fields.filter(f => f.status === 'conferido').map(f => `${r.cmid}|${f.userId}`)).filter(k => !badKeys.has(k)));
      const s = summary();
      const clean = !out.stopped && !out.cancelled && !bad.length && out.results.every(r => ['conferido', 'sem_alteracao', 'nao_lancada'].includes(r.outcome));
      const notLaunched = out.results.filter(r => r.outcome === 'nao_lancada');
      state.progress = out.results.map(r => ({ cmid: r.cmid, name: (out.jobs.find(j => String(j.cmid) === String(r.cmid)) || {}).name || r.name, status: r.outcome, message: r.message }));
      const title = bad.length ? `Atenção: ${plural(bad.length, 'campo não confere', 'campos não conferem')}` : out.cancelled ? 'Lote cancelado' : out.stopped ? 'O lote parou' : notLaunched.length ? 'Concluído, com atividades não lançadas' : `Concluído: ${plural(out.results.filter(r => r.outcome === 'conferido').length, 'atividade salva e conferida', 'atividades salvas e conferidas')}`;
      mountDialog([
        head('Resultado do lote'),
        h(doc, 'div', { class: clean ? 'imn-ok' : 'imn-alert', role: 'status' }, h(doc, 'strong', {}, title)),
        h(doc, 'div', { class: 'imn-counts' },
          h(doc, 'div', { class: 'imn-count' }, h(doc, 'b', {}, String(students.size)), 'alunos salvos'),
          h(doc, 'div', { class: 'imn-count' }, h(doc, 'b', {}, String(okFields.length)), 'campos relidos e iguais'),
          h(doc, 'div', { class: 'imn-count' }, h(doc, 'b', {}, String(s.unchanged)), 'sem alteração'),
          h(doc, 'div', { class: 'imn-count' }, h(doc, 'b', {}, String(s.blocked)), 'ficaram de fora'),
          h(doc, 'div', { class: 'imn-count' }, h(doc, 'b', {}, String(bad.length)), 'divergências')),
        out.stopped ? h(doc, 'p', { class: 'imn-warn' }, 'O lote parou nesta atividade: as seguintes não foram abertas. Confira a atividade marcada no Moodle antes de continuar.') : null,
        bad.length ? h(doc, 'div', { class: 'imn-table-wrap' }, h(doc, 'table', { class: 'imn-table' },
          h(doc, 'thead', {}, h(doc, 'tr', {}, ['Aluno', 'Campo', 'Enviado', 'Moodle mostra'].map(t => h(doc, 'th', { scope: 'col' }, t)))),
          h(doc, 'tbody', {}, ...bad.map(f => h(doc, 'tr', { class: 'imn-row-blocked' },
            h(doc, 'td', { 'data-label': 'Aluno' }, f.name), h(doc, 'td', { 'data-label': 'Campo' }, f.field === 'grade' ? 'nota' : 'feedback'),
            h(doc, 'td', { 'data-label': 'Enviado' }, f.to), h(doc, 'td', { 'data-label': 'Moodle mostra' }, f.after || '(vazio)')))))) : null,
        recheckSummary(out),
        progressList(),
        h(doc, 'p', { class: 'imn-muted' }, 'O relatório traz o valor anterior de cada campo, caso precise restaurar algo. Abra as atividades marcadas no Moodle para conferir.'),
        h(doc, 'div', { class: 'imn-foot' },
          h(doc, 'button', { type: 'button', class: 'imn-btn imn-primary imn-report', onclick: downloadReport }, 'Baixar relatório (CSV)'),
          h(doc, 'button', { type: 'button', class: 'imn-btn imn-recheck', title: 'Lê de novo, pelo radar, quantos envios ainda estão sem nota em cada atividade', onclick: recheckNow }, 'Reconferir pelo radar'),
          h(doc, 'button', { type: 'button', class: 'imn-btn', onclick: close }, 'Fechar'))
      ]);
    }

    function render() {
      if (state.phase === 'running') renderRunning();
      else if (state.phase === 'done') renderDone();
      else renderMain();
    }

    return { open, close, loadFile, state, backdrop, openButton, start, render, reportRows, downloadReport };
  }

  root.IMN.batchUi = { init };
})(globalThis);

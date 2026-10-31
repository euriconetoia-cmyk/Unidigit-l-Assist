// Leitura das TAREFAS do curso (somente leitura): para cada atividade, o prazo e a tabela de entregas (sem envio,
// enviada aguardando correção, avaliada). Só roda quando o usuário clica em "Ler entregas". Falha em uma atividade não
// derruba as outras: ela fica marcada e "Continuar" repete só o que faltou. Nada é gravado nem enviado.
// Ligação atividade ↔ item do livro de notas: nome normalizado EXATO (nunca por aproximação).
(function (root) {
  'use strict';
  const ALN = root.ALN;
  const U = root.MAT.utils;
  const cache = { courseId: null, data: null };
  let session = null;

  const normName = s => U.normalizeText(String(s || '').replace(/^\s*tarefa\s+/i, '').replace(/\s*tarefa\s*$/i, '').split('›').pop());
  const newSession = course => ({ courseId: course.id, course, listed: false, listError: '', list: [], attempts: 0, startedAt: Date.now() });

  async function listAssignments(adapter, course, settings, s, opts) {
    let found = [];
    const sources = [adapter.courseUrl(course.id), `${root.location.origin}/mod/assign/index.php?id=${course.id}`];
    s.listError = '';
    for (const url of sources) {
      try {
        opts.onProgress({ step: 'tarefas', text: 'Procurando as atividades do curso' });
        const { doc } = await ALN.reader.fetchDoc(url, 'Lista de atividades', settings, opts);
        found = adapter.discoverAssignments(doc);
      } catch (e) { if (opts.signal && opts.signal.aborted) throw e; s.listError = e.message; }
      if (found.length) { s.listError = ''; break; }
    }
    s.list = found.map(a => ({ cmid: a.cmid, name: a.name, url: a.url, dueDate: a.dueDate || null, dueText: a.dueText || '', maxGrade: null, state: 'todo', error: '', rows: [] }));
    s.listed = s.list.length > 0;
  }

  async function readOne(adapter, a, settings, opts) {
    const view = await ALN.reader.fetchDoc(a.url, `${a.name} (resumo)`, settings, opts);
    const sum = adapter.extractAssignmentSummary(view.doc, { cmid: a.cmid, name: a.name, url: a.url, dueDate: a.dueDate, dueText: a.dueText });
    a.dueDate = sum.dueDate || a.dueDate; a.dueText = sum.dueText || a.dueText; a.maxGrade = sum.maxGrade;
    await ALN.reader.sleep(settings.requestDelayMs);
    const grading = await ALN.reader.fetchDoc(adapter.assignmentGradingUrl(a.cmid, 500), `${a.name} (entregas)`, settings, opts);
    const parsed = adapter.extractAssignmentGradingRows(grading.doc, { cmid: a.cmid, name: a.name, url: a.url, gradingUrl: grading.url });
    if (!parsed.rows.length) throw new Error((parsed.diagnostics && parsed.diagnostics.reason) || 'Tabela de entregas não reconhecida');
    a.rows = parsed.rows.map(r => ({ studentKey: r.studentKey, submitted: r.submitted, missing: r.missing, graded: r.graded, requiresGrading: r.requiresGrading, grade: r.grade, gradeDisplay: r.gradeDisplay, modifiedText: r.modifiedText }));
    a.state = 'done'; a.error = '';
  }

  function snapshot(s) {
    const pending = s.list.filter(a => a.state !== 'done').map(a => ({ cmid: a.cmid, name: a.name, reason: a.error || 'não lida' }));
    return { course: s.course, readAt: Date.now(), assignments: s.list.map(a => ({ ...a, rows: a.rows })), pending, listError: s.listError, complete: s.listed && !pending.length };
  }

  // resume: true continua a leitura anterior do mesmo curso (repete só as atividades que faltam).
  async function read({ onProgress = () => {}, settings = ALN.reader.SETTINGS, resume = false, signal } = {}) {
    const adapter = root.MAT.adapters.createAdapter();
    const course = adapter.detectCourse(root.document);
    if (!course.id) throw new Error('Abra uma página de um curso do Moodle (o endereço precisa ter o número do curso).');
    if (!(resume && session && session.courseId === course.id && session.listed)) session = newSession(course);
    session.attempts += 1;
    const opts = { onProgress, signal };
    if (!session.listed) {
      await listAssignments(adapter, course, settings, session, opts);
      if (!session.listed) throw new Error(session.listError || 'Não encontrei tarefas neste curso.');
    }
    const todo = session.list.filter(a => a.state !== 'done');
    let i = 0;
    for (const a of todo) {
      i += 1;
      onProgress({ step: 'tarefas', text: `Atividade ${i} de ${todo.length}: ${a.name}`, percent: Math.round((i / todo.length) * 100) });
      try { await readOne(adapter, a, settings, opts); }
      catch (e) { if (signal && signal.aborted) throw e; a.state = 'error'; a.error = e.message; }
      await ALN.reader.sleep(settings.requestDelayMs);
    }
    const data = snapshot(session);
    cache.courseId = course.id; cache.data = data;
    return data;
  }
  const canResume = () => Boolean(session && session.listed);
  const cached = () => { const a = root.MAT.adapters.createAdapter(); return cache.data && cache.courseId === a.courseId ? cache.data : null; };
  const diagnostics = () => (session ? { sessao: true, curso: session.courseId, tentativas: session.attempts, atividades: session.list.length, lidas: session.list.filter(a => a.state === 'done').length, erros: session.list.filter(a => a.state === 'error').map(a => ({ atividade: a.cmid, erro: a.error })) } : { sessao: false });

  // ---- situação de cada aluno em cada atividade ----
  // avaliada: há nota no livro de notas · aguardando: entregou e espera correção · sem_entrega: Moodle diz que não enviou
  // sem_nota: não dá para saber (entregas não lidas ou atividade sem correspondência)
  function linkItems(items, tdata) {
    const map = new Map();
    if (!tdata) return map;
    const byName = new Map();
    tdata.assignments.forEach(a => { const k = normName(a.name); byName.set(k, byName.has(k) ? null : a); });
    items.forEach(it => { const a = byName.get(normName(it.name)); if (a) map.set(it.key, a); });
    return map;
  }

  function overview(student, items, tdata, now = Date.now()) {
    const links = linkItems(items, tdata);
    const byItem = items.map(it => {
      const g = student.grades[it.key], has = g && g.value !== null;
      const a = links.get(it.key);
      const due = a && a.dueDate ? a.dueDate : null;
      const overdue = Boolean(due && new Date(due).getTime() < now);
      let state = 'sem_nota';
      if (has) state = 'avaliada';
      else if (a && a.state === 'done') {
        const row = a.rows.find(r => r.studentKey === student.key);
        state = !row ? 'sem_nota' : row.missing ? 'sem_entrega' : row.submitted ? 'aguardando' : row.graded ? 'avaliada' : 'sem_nota';
      }
      return { item: it, name: it.name.split('›').pop().trim(), state, display: has ? (g.display || String(g.value)) : '', value: has ? g.value : null, maxGrade: it.maxGrade, due, dueText: a ? a.dueText : '', overdue, linked: Boolean(a) };
    });
    const counts = { avaliada: 0, aguardando: 0, sem_entrega: 0, sem_nota: 0 };
    byItem.forEach(x => { counts[x.state] += 1; });
    const readEntregas = Boolean(tdata) && byItem.some(x => x.linked);
    // Pendência do aluno: sem entrega (lido). Sem a leitura das entregas, a melhor pista é "sem nota".
    const pendencias = byItem.filter(x => (readEntregas ? x.state === 'sem_entrega' : x.state === 'sem_nota'))
      .sort((a, b) => (b.overdue - a.overdue) || String(a.due || '9').localeCompare(String(b.due || '9')));
    return { byItem, counts, pendencias, readEntregas, entregues: counts.avaliada + counts.aguardando };
  }

  ALN.tarefas = { read, canResume, cached, diagnostics, overview, linkItems, normName };
})(globalThis);

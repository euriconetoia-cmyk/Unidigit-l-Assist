// Leitura única do curso (somente leitura): livro de notas + participantes, com paginação, pausa entre consultas
// e cache em memória da página. Só roda quando o usuário clica em "Ler". Nada é gravado nem enviado.
(function (root) {
  'use strict';
  const ALN = root.ALN;
  const U = root.MAT.utils;
  // Livro de notas é a página mais pesada do Moodle: páginas menores (rápidas) + tempo maior + 1 nova tentativa.
  const SETTINGS = Object.freeze({ maxParticipants: 500, gradebookPerPage: 100, requestDelayMs: 180, requestTimeoutMs: 45000, gradebookTimeoutMs: 90000, retries: 1, retryDelayMs: 1500, maxPages: 60 });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const cache = { courseId: null, at: 0, data: null };

  // Mostra "Livro de notas… 23 s" enquanto espera, para o usuário ver que está trabalhando.
  function withTicker(label, onProgress) {
    const t0 = Date.now();
    const timer = setInterval(() => onProgress({ text: `${label}… ${Math.round((Date.now() - t0) / 1000)} s (o Moodle está montando a página)` }), 1000);
    return () => clearInterval(timer);
  }

  async function fetchDoc(url, label, settings, { timeoutMs = settings.requestTimeoutMs, onProgress = () => {}, signal } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= (settings.retries || 0); attempt += 1) {
      const stop = withTicker(attempt ? `${label}, nova tentativa` : label, onProgress);
      try { return await fetchDocOnce(url, label, settings, timeoutMs, signal); }
      catch (e) {
        lastError = e;
        const retryable = /tempo limite|HTTP 5\d\d|Failed to fetch|NetworkError/i.test(String(e && e.message));
        if (!retryable || attempt >= (settings.retries || 0)) break;
        await sleep(settings.retryDelayMs);
      } finally { stop(); }
    }
    if (/tempo limite/i.test(String(lastError && lastError.message))) throw new Error(`${lastError.message}. O Moodle demorou mais de ${Math.round(timeoutMs / 1000)} s; tente em outro horário ou filtre o livro de notas por grupo.`);
    throw lastError;
  }

  async function fetchDocOnce(url, label, settings, timeoutMs, signal) {
    if (signal && signal.aborted) throw new Error('Leitura cancelada.');
    if (!U.isAllowedMoodleUrl(url)) throw new Error(`${label}: endereço fora do Moodle autorizado`);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const onAbort = () => ctl.abort();
    if (signal) signal.addEventListener('abort', onAbort);
    try {
      const res = await root.fetch(url, { credentials: 'include', redirect: 'follow', signal: ctl.signal });
      const text = await res.text();
      if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
      if (!U.isAllowedMoodleUrl(res.url)) throw new Error(`${label}: redirecionado para fora do Moodle`);
      if (/login\/index\.php/i.test(res.url) || (/name="username"/i.test(text) && /name="password"/i.test(text))) throw new Error(`${label}: a sessão do Moodle parece ter expirado`);
      return { doc: new DOMParser().parseFromString(text, 'text/html'), url: res.url };
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error(signal && signal.aborted ? 'Leitura cancelada.' : `${label}: tempo limite excedido`);
      throw e;
    } finally { clearTimeout(timer); if (signal) signal.removeEventListener('abort', onAbort); }
  }

  // Próxima página: o menor `page=N` maior que o atual, ainda não visitado.
  function nextPageUrl(doc, currentUrl, visited, pathRe) {
    const cur = Number(new URL(currentUrl).searchParams.get('page') || 0);
    let best = null;
    doc.querySelectorAll('.paging a[href], [data-region="paging"] a[href], nav[aria-label*="pag" i] a[href], .pagination a[href]').forEach(a => {
      let u; try { u = new URL(a.getAttribute('href'), currentUrl); } catch (_) { return; }
      if (!pathRe.test(u.pathname) || !u.searchParams.has('page')) return;
      const n = Number(u.searchParams.get('page'));
      if (n > cur && !visited.has(u.href) && (!best || n < best.n)) best = { n, href: u.href };
    });
    return best ? best.href : '';
  }

  // Sessão de leitura: guarda o que já foi lido para "Continuar de onde parou" (só em memória da página).
  const PT_RE = /\/user\/index\.php$/, GB_RE = /\/grade\/report\/grader\/index\.php$/;
  let session = null;
  const newSession = course => ({
    courseId: course.id, course, startedAt: Date.now(), attempts: 0,
    gb: { value: null, next: '', visited: new Set(), pages: 0, error: '', warn: [], done: false },
    pt: { rows: [], next: '', visited: new Set(), pages: 0, error: '', warn: [], started: false, done: false }
  });

  async function readParticipants(adapter, course, settings, p, onProgress, signal) {
    p.error = ''; p.warn = []; p.done = false;
    const opts = { onProgress, signal };
    try {
      if (!p.started) {
        const first = await fetchDoc(adapter.participantsUrl(course.id, settings.maxParticipants), 'Participantes', settings, opts);
        p.rows = adapter.extractParticipantRows(first.doc).rows;
        p.visited.add(first.url); p.pages = 1; p.started = true;
        p.next = nextPageUrl(first.doc, first.url, p.visited, PT_RE);
      }
      while (p.next && p.pages < settings.maxPages) {
        const url = p.next;
        onProgress({ step: 'participants', text: `Participantes, página ${p.pages + 1}` });
        await sleep(settings.requestDelayMs);
        const page = await fetchDoc(url, `Participantes, página ${p.pages + 1}`, settings, opts);
        p.visited.add(url); p.visited.add(page.url);
        const before = p.rows.length;
        p.rows = U.uniqueBy([...p.rows, ...adapter.extractParticipantRows(page.doc).rows], r => r.key);
        p.pages += 1;
        if (p.rows.length <= before) { p.warn.push('A paginação de participantes não trouxe novos alunos; leitura interrompida.'); p.next = ''; break; }
        p.next = nextPageUrl(page.doc, page.url, p.visited, PT_RE);
      }
      if (p.next) p.warn.push('A lista de participantes não foi lida por inteiro (limite de páginas).');
      if (!p.rows.length) p.warn.push('Lista de participantes não reconhecida: o último acesso não será mostrado.');
    } catch (e) {
      if (signal && signal.aborted) throw e;
      p.error = e.message; p.warn.push(e.message);
    }
    p.done = !p.error && !p.next;
  }

  async function readGradebook(adapter, course, settings, g, onProgress, signal) {
    g.error = ''; g.warn = []; g.done = false;
    const opts = { timeoutMs: settings.gradebookTimeoutMs, onProgress, signal };
    if (!g.value) { // primeira página: sem ela não há o que mostrar, então a falha interrompe a leitura
      const first = await fetchDoc(adapter.gradesUrl(course.id, settings.gradebookPerPage), 'Livro de notas', settings, opts);
      const gb = adapter.extractGradebookReport(first.doc, course);
      if (!gb.items.length || !gb.students.length) {
        const why = gb.diagnostics && gb.diagnostics.reason ? ` (${gb.diagnostics.reason})` : '';
        throw new Error(`O livro de notas não foi reconhecido${why}. Confirme que você é tutor/professor deste curso.`);
      }
      g.value = gb; g.visited.add(first.url); g.pages = 1;
      g.next = nextPageUrl(first.doc, first.url, g.visited, GB_RE);
    }
    while (g.next && g.pages < settings.maxPages) {
      const url = g.next;
      onProgress({ step: 'gradebook', text: `Livro de notas, página ${g.pages + 1}` });
      await sleep(settings.requestDelayMs);
      let page;
      try { page = await fetchDoc(url, `Livro de notas, página ${g.pages + 1}`, settings, opts); }
      catch (e) { if (signal && signal.aborted) throw e; g.error = e.message; g.warn.push(`Livro de notas interrompido na página ${g.pages + 1}: ${e.message}`); return; }
      g.visited.add(url); g.visited.add(page.url);
      const more = adapter.extractGradebookReport(page.doc, course);
      const before = g.value.students.length;
      g.value = { ...g.value, students: U.uniqueBy([...g.value.students, ...more.students], s => s.studentKey) };
      g.pages += 1;
      if (g.value.students.length <= before) { g.warn.push('A paginação do livro de notas não trouxe novos alunos; leitura interrompida.'); g.next = ''; break; }
      g.next = nextPageUrl(page.doc, page.url, g.visited, GB_RE);
    }
    if (g.next) g.warn.push('O livro de notas não foi lido por inteiro (limite de páginas).');
    g.done = !g.error && !g.next;
  }

  function courseFromPage(adapter) {
    const course = adapter.detectCourse(root.document);
    if (!course.id) throw new Error('Abra uma página de um curso do Moodle (o endereço precisa ter o número do curso) para ler alunos e notas.');
    return course;
  }

  const STEP_LABEL = { gradebook: 'Livro de notas', participants: 'Participantes (último acesso)' };

  // resume: true continua a leitura anterior do mesmo curso, repetindo só o que não terminou.
  async function readCourse({ onProgress = () => {}, settings = SETTINGS, resume = false, signal } = {}) {
    const adapter = root.MAT.adapters.createAdapter();
    const course = courseFromPage(adapter);
    if (!(resume && session && session.courseId === course.id)) session = newSession(course);
    session.attempts += 1;
    const g = session.gb, p = session.pt;
    if (!g.done) { onProgress({ step: 'gradebook', text: 'Abrindo o livro de notas', percent: 10 }); await readGradebook(adapter, course, settings, g, onProgress, signal); }
    if (!p.done) {
      if (g.value) await sleep(settings.requestDelayMs);
      onProgress({ step: 'participants', text: 'Lendo participantes (último acesso)', percent: 60 });
      await readParticipants(adapter, course, settings, p, onProgress, signal);
    }
    onProgress({ step: 'organize', text: 'Organizando', percent: 95 });
    const gb = g.value;
    const warnings = [...g.warn];
    if (gb.meta.limitedByGroup) warnings.push(`O livro de notas está filtrado pelo grupo "${gb.meta.selectedGroup}": só esses alunos foram lidos.`);
    if (gb.meta.collapsedCategoriesDetected) warnings.push('Há categorias recolhidas no livro de notas: alguns itens podem não ter sido lidos. Expanda-as no Moodle e leia de novo.');
    if (!gb.courseTotalItem) warnings.push('O "Total do curso" não foi identificado: situação e média ficam como "não identificado".');
    warnings.push(...p.warn);
    const partialFlag = Boolean(gb.meta.limitedByGroup || gb.meta.collapsedCategoriesDetected);
    const students = ALN.buildStudents({ gradebook: gb, participants: p.rows });
    const withAccess = students.filter(s => s.accessKnown).length;
    // O que ainda dá para continuar (só falhas de rede/tempo; grupo filtrado e categorias recolhidas dependem do Moodle).
    const pending = [];
    if (!g.done) pending.push({ key: 'gradebook', label: STEP_LABEL.gradebook, reason: g.error || 'não terminou' });
    if (!p.done) pending.push({ key: 'participants', label: STEP_LABEL.participants, reason: p.error || 'não terminou' });
    const data = {
      course, readAt: Date.now(), gradebook: gb, participants: p.rows, students, warnings, pending,
      coverage: {
        students: students.length, withAccess, participants: p.rows.length,
        complete: g.done && !partialFlag && p.done && p.rows.length > 0 && withAccess === students.length,
        gradebookComplete: g.done && !partialFlag, participantsComplete: p.done && p.rows.length > 0
      }
    };
    cache.courseId = course.id; cache.at = data.readAt; cache.data = data;
    return data;
  }

  const canResume = () => Boolean(session && (session.gb.value || session.pt.started));

  // Resumo técnico para suporte: sem nomes, e-mails ou notas de alunos.
  function diagnostics() {
    if (!session) return { sessao: false };
    const g = session.gb, p = session.pt;
    return {
      sessao: true, curso: session.courseId, tentativas: session.attempts, segundosDesdeInicio: Math.round((Date.now() - session.startedAt) / 1000),
      livroDeNotas: { lido: Boolean(g.value), paginas: g.pages, alunos: g.value ? g.value.students.length : 0, terminou: g.done, erro: g.error || null },
      participantes: { paginas: p.pages, linhas: p.rows.length, terminou: p.done, erro: p.error || null },
      configuracao: { porPagina: SETTINGS.gradebookPerPage, limiteNotasMs: SETTINGS.gradebookTimeoutMs, limiteParticipantesMs: SETTINGS.requestTimeoutMs }
    };
  }

  function cached() {
    const adapter = root.MAT.adapters.createAdapter();
    return cache.data && cache.courseId === adapter.courseId ? cache.data : null;
  }

  // Lê SÓ o livro de notas de outra UC (usado pelo Relatório da turma). Devolve o livro, avisos e se terminou por inteiro.
  async function readGradebookFor(course, { onProgress = () => {}, settings = SETTINGS, signal } = {}) {
    const adapter = root.MAT.adapters.createAdapter();
    const g = { value: null, next: '', visited: new Set(), pages: 0, error: '', warn: [], done: false };
    await readGradebook(adapter, course, settings, g, onProgress, signal);
    const gb = g.value, warnings = [...g.warn];
    if (gb.meta.limitedByGroup) warnings.push(`Livro de notas filtrado pelo grupo "${gb.meta.selectedGroup}": só esses alunos foram lidos.`);
    if (gb.meta.collapsedCategoriesDetected) warnings.push('Há categorias recolhidas no livro de notas: alguns itens podem não ter sido lidos.');
    if (!gb.courseTotalItem) warnings.push('O "Total do curso" não foi identificado.');
    return { gradebook: gb, warnings, complete: g.done && !gb.meta.limitedByGroup && !gb.meta.collapsedCategoriesDetected && Boolean(gb.courseTotalItem) };
  }

  // Lê SÓ a lista de participantes de outra UC (Relatório da turma: matriculados). Mais leve que o livro de notas.
  async function readParticipantsFor(course, { onProgress = () => {}, settings = SETTINGS, signal } = {}) {
    const adapter = root.MAT.adapters.createAdapter();
    const p = { rows: [], next: '', visited: new Set(), pages: 0, error: '', warn: [], started: false, done: false };
    await readParticipants(adapter, course, settings, p, onProgress, signal);
    const rows = p.rows.map(r => ({ key: r.key, name: r.name, role: r.role, status: r.status, lastAccessDays: r.lastAccessDays }));
    return { rows, warnings: [...p.warn], complete: p.done && rows.length > 0, error: p.error };
  }

  ALN.reader = { readCourse, readGradebookFor, readParticipantsFor, cached, nextPageUrl, canResume, diagnostics, fetchDoc, sleep, SETTINGS };
})(globalThis);

// Leitura de páginas do Moodle (cursos, atividades, tela de avaliação) e consultas HTML com segurança.
// Funções de parsing recebem um Document já pronto, para serem testáveis sem rede.
(function (root) {
  'use strict';
  const { normalizeText } = root.IMN.text;
  const MAX_ASSIGNMENTS_PER_COURSE = 120;
  const MAX_COURSES_PER_CATEGORY = 40;

  const PENDING_LABELS = ['precisa de avaliacao', 'necessita avaliacao', 'needs grading', 'requires grading'];

  // Contagem "Precisa de avaliação" do resumo da atividade. null = campo não encontrado (nunca vira 0).
  function parsePendingCount(doc) {
    for (const row of doc.querySelectorAll('.gradingsummarytable tr, table.generaltable tr')) {
      const heading = row.querySelector('th, td:first-child');
      if (!PENDING_LABELS.includes(normalizeText(heading ? heading.textContent : ''))) continue;
      const valueCell = row.querySelector('td:last-child');
      const digits = ((valueCell && valueCell.textContent) || '').replace(/\s+/g, '').match(/\d+/);
      return digits ? Number.parseInt(digits[0], 10) : null;
    }
    return null;
  }

  const PARTICIPANT_LABELS = ['participantes', 'participants'];
  // Linha que fala de avaliação mas não é a de "Enviado para avaliação"/rascunho: se existir e não for reconhecida, é leitura incerta.
  const looksLikeGradingRow = label => /avalia|grading|graded/.test(label) && !/^(enviad|submitt|rascunho|draft)/.test(label);

  // Resumo da atividade: { kind: 'count', count } | { kind: 'na' } | { kind: 'unknown' }.
  // 'na' = a tabela de resumo é reconhecida (tem "Participantes") e NÃO tem linha de avaliação (ex.: tarefa sem envio online).
  // Qualquer dúvida (linha de avaliação com rótulo desconhecido, número ausente, sem tabela) é 'unknown' = Não verificado.
  function parsePendingInfo(doc) {
    let recognized = false;
    let gradingLike = false;
    for (const row of doc.querySelectorAll('.gradingsummarytable tr, table.generaltable tr')) {
      const heading = row.querySelector('th, td:first-child');
      const label = normalizeText(heading ? heading.textContent : '');
      if (PENDING_LABELS.includes(label)) {
        const count = parsePendingCount(doc);
        return count === null ? { kind: 'unknown' } : { kind: 'count', count };
      }
      if (PARTICIPANT_LABELS.includes(label)) recognized = true;
      if (looksLikeGradingRow(label)) gradingLike = true;
    }
    return recognized && !gradingLike ? { kind: 'na' } : { kind: 'unknown' };
  }

  function assignmentIdFromHref(href, base) {
    try {
      const url = new URL(href, base);
      return /\/mod\/assign\/view\.php$/.test(url.pathname) ? url.searchParams.get('id') || '' : '';
    } catch (_) { return ''; }
  }

  function courseIdFromHref(href, base) {
    try {
      const url = new URL(href, base);
      return /\/course\/view\.php$/.test(url.pathname) ? url.searchParams.get('id') || '' : '';
    } catch (_) { return ''; }
  }

  function cleanName(node, fallback) {
    if (!node) return fallback;
    const clone = node.cloneNode(true);
    clone.querySelectorAll('.accesshide, .visually-hidden, .sr-only').forEach(n => n.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ').trim() || fallback;
  }

  // Atividades "assign" de uma página de curso (ou de um Document baixado).
  // Procura primeiro no conteúdo principal (onde o selo será colocado) e depois na página toda:
  // com "uma seção por página" o miolo mostra só a seção atual e as tarefas aparecem apenas no índice do curso.
  function collectAssignments(doc, baseUrl) {
    const found = new Map();
    const main = doc.querySelector('[role="main"], #region-main');
    const scopes = main ? [main, doc] : [doc];
    for (const scope of scopes) {
      for (const link of scope.querySelectorAll('a[href*="/mod/assign/view.php"]')) {
        if (found.size >= MAX_ASSIGNMENTS_PER_COURSE) break;
        // Menus não contam, exceto o índice do curso (lista todas as atividades quando a página mostra uma seção por vez).
        if (link.closest('nav, .breadcrumb, .navbar, header') && !link.closest('.courseindex, #courseindex, [data-region="courseindex"], [id*="courseindex"]')) continue;
        const assignmentId = assignmentIdFromHref(link.getAttribute('href'), baseUrl);
        if (!assignmentId || found.has(assignmentId)) continue;
        const card = link.closest('li.activity, .activity-item, .modtype_assign') || link.parentElement;
        const name = cleanName(card && card.querySelector('.instancename'), cleanName(link, `Atividade ${assignmentId}`));
        found.set(assignmentId, { assignmentId, name, href: new URL(link.getAttribute('href'), baseUrl).href, card, link, fromIndex: scope === doc && Boolean(main) && !main.contains(link) });
      }
    }
    if (!found.size) {
      // Sem link visível (tema/formato que esconde o link): usa o identificador do módulo da atividade.
      for (const card of (main || doc).querySelectorAll('li.activity.modtype_assign[data-id], .activity.modtype_assign[data-id], li.modtype_assign[id^="module-"]')) {
        if (found.size >= MAX_ASSIGNMENTS_PER_COURSE) break;
        const assignmentId = card.getAttribute('data-id') || (/^module-(\d+)$/.exec(card.id || '') || [])[1] || '';
        if (!/^\d+$/.test(assignmentId) || found.has(assignmentId)) continue;
        const link = card.querySelector('a[href]') || null;
        const name = cleanName(card.querySelector('.instancename'), `Atividade ${assignmentId}`);
        found.set(assignmentId, { assignmentId, name, href: new URL(`/mod/assign/view.php?id=${assignmentId}`, baseUrl).href, card, link, fromIndex: false });
      }
    }
    return [...found.values()];
  }

  // Número do curso da página aberta (endereço ?id= ou classe "course-N" do corpo).
  function courseIdOf(doc, baseUrl) {
    try {
      const url = new URL(baseUrl);
      if (/\/course\/view\.php$/.test(url.pathname) && /^\d+$/.test(url.searchParams.get('id') || '')) return url.searchParams.get('id');
    } catch (_) { /* segue */ }
    const m = /(?:^|\s)course-(\d+)(?:\s|$)/.exec((doc.body && doc.body.className) || '');
    return m ? m[1] : '';
  }

  // Lista de tarefas do curso (página "Tarefas" do Moodle): serve quando a página inicial da UC não mostra as atividades.
  function assignmentIndexUrl(courseId, origin) { return `${origin}/mod/assign/index.php?id=${encodeURIComponent(courseId)}`; }
  function collectAssignmentsFromIndex(doc, baseUrl) {
    const found = new Map();
    const scope = doc.querySelector('[role="main"], #region-main') || doc;
    for (const link of scope.querySelectorAll('a[href*="/mod/assign/view.php"]')) {
      if (found.size >= MAX_ASSIGNMENTS_PER_COURSE) break;
      if (link.closest('nav, .breadcrumb, .navbar, header')) continue;
      const assignmentId = assignmentIdFromHref(link.getAttribute('href'), baseUrl);
      if (!assignmentId || found.has(assignmentId)) continue;
      found.set(assignmentId, { assignmentId, name: cleanName(link, `Atividade ${assignmentId}`), href: new URL(link.getAttribute('href'), baseUrl).href, card: null, link: null, fromIndex: true, fromAssignIndex: true });
    }
    return [...found.values()];
  }

  // Cursos listados numa página de categoria.
  function collectCourses(doc, baseUrl) {
    const main = doc.querySelector('[role="main"], #region-main') || doc;
    const found = new Map();
    for (const link of main.querySelectorAll('a[href*="/course/view.php"]')) {
      if (link.closest('nav, .breadcrumb, .navbar, .primary-navigation, .secondary-navigation, .pagination')) continue;
      const courseId = courseIdFromHref(link.getAttribute('href'), baseUrl);
      if (!courseId || found.has(courseId)) continue;
      const name = cleanName(link, `Curso ${courseId}`);
      found.set(courseId, { courseId, name, href: new URL(link.getAttribute('href'), baseUrl).href, link });
      if (found.size >= MAX_COURSES_PER_CATEGORY) break;
    }
    return [...found.values()];
  }

  // Datas escritas em texto (dd/mm, dd/mm/aa, dd/mm/aaaa). Só para diagnóstico: não decide nada por enquanto.
  const DATE_TEXT = /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g;
  const datesIn = text => [...new Set(String(text || '').match(DATE_TEXT) || [])].slice(0, 6);
  const squash = text => String(text || '').replace(/\s+/g, ' ').trim();

  // "Período: dd/mm/aaaa a dd/mm/aaaa" (também com "até", "-" ou "–"). Só aceita duas datas completas; senão null.
  const PERIODO = /per[ií]odo\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:a|à|até|ate|-|–|—)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i;
  function periodFromText(text) {
    const m = squash(text).match(PERIODO);
    return m ? { inicio: m[1], fim: m[2] } : null;
  }

  // Estrutura do curso (sem alunos): cabeçalho e seções com título, datas escritas, marcador "atual" e visibilidade.
  function readCourseInfo(doc) {
    const header = doc.querySelector('#page-header, .page-header-headings, .course-header');
    const summary = doc.querySelector('.course-summary, .summary, [data-region="course-summary"]');
    const sections = [...doc.querySelectorAll('li.section, .course-section')].slice(0, 60).map((node, index) => {
      const titleNode = node.querySelector('.sectionname, .section-title, h3, h4');
      const clone = node.cloneNode(true);
      clone.querySelectorAll('li.activity, .activity-item').forEach(n => n.remove());
      const own = squash(clone.textContent);
      const availability = squash((node.querySelector('.availabilityinfo, [data-region="availability-info"]') || {}).textContent).toLowerCase();
      return {
        index: index + 1,
        id: node.id || '',
        title: squash(titleNode && titleNode.textContent) || `Seção ${index + 1}`,
        dateTexts: datesIn(own),
        current: Boolean(node.classList.contains('current') || node.getAttribute('aria-current') === 'true' || node.querySelector('.current-section, .badge-current, [data-region="current-section"]')),
        hidden: Boolean(node.classList.contains('hidden') || node.classList.contains('dimmed') || node.getAttribute('aria-hidden') === 'true' || /não disponível|indisponível|oculto/.test(availability)),
        activities: node.querySelectorAll('li.activity, .activity-item').length
      };
    });
    // "Período: 09/06/2026 a 06/11/2026" no resumo do curso (.course-summary): é a fonte mais confiável da vigência.
    const summaries = [...doc.querySelectorAll('.course-summary, .no-overflow, .summary, [data-region="course-summary"]')];
    let periodo = null;
    for (const node of summaries) { periodo = periodFromText(node.textContent); if (periodo) break; }
    return {
      headerDateTexts: datesIn(`${header ? header.textContent : ''} ${summary ? summary.textContent : ''}`),
      periodo,
      sections
    };
  }

  // Texto do cartão do curso na categoria (rótulo da turma, carga horária etc.), para o diagnóstico.
  function readCourseCard(link) {
    const card = link && link.closest ? link.closest('.coursebox, .card, .course-card, [data-courseid]') : null;
    return card ? squash(card.textContent).slice(0, 1500) : '';
  }

  function extractSesskey(doc) {
    const input = doc.querySelector('input[name="sesskey"][value]');
    if (input && input.value) return input.value;
    for (const a of doc.querySelectorAll('a[href*="sesskey="]')) {
      try {
        const value = new URL(a.getAttribute('href'), 'https://x.invalid/').searchParams.get('sesskey');
        if (value) return value;
      } catch (_) { /* tenta o próximo */ }
    }
    const html = (doc.documentElement && doc.documentElement.innerHTML) || '';
    const m = html.match(/M\.cfg\.sesskey\s*=\s*["']([^"']+)["']/i) || html.match(/["']sesskey["']\s*:\s*["']([^"']+)["']/i);
    return m ? m[1] : '';
  }

  function extractPendingUserIds(doc) {
    const ids = new Set();
    for (const row of doc.querySelectorAll('table#submissions tbody tr, .gradingtable table tbody tr')) {
      const box = row.querySelector('input[name="selectedusers"][value], input[id^="selectuser_"][value]');
      const raw = box ? box.value || box.id.replace(/^selectuser_/, '') : '';
      if (/^\d+$/.test(raw)) ids.add(raw);
    }
    return [...ids];
  }

  function looksLikeLogin(finalUrl, html) {
    return /\/login\//.test(finalUrl.pathname) || (/name=["']username["']/i.test(html) && /name=["']password["']/i.test(html));
  }

  // Baixa uma página HTML do MESMO domínio. Erros trazem .status para o governador decidir se tenta de novo.
  // Leitura parcial: para de baixar assim que a tabela de resumo termina (o resto da página do Moodle é grande e não interessa).
  const SUMMARY_PARTIAL = Object.freeze({ marker: 'gradingsummary', end: '</table>' });

  async function readBody(response, partial) {
    if (!partial || !response.body || typeof response.body.getReader !== 'function') return response.text();
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let html = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      const start = html.indexOf(partial.marker);
      const end = start === -1 ? -1 : html.indexOf(partial.end, start);
      if (end !== -1) {
        try { await reader.cancel(); } catch (_) { /* já terminou */ }
        return html.slice(0, end + partial.end.length);
      }
    }
    return html + decoder.decode();
  }

  async function fetchDocument(url, { timeoutMs = 20000, partial = null, fetchImpl = globalThis.fetch, parser = html => new DOMParser().parseFromString(html, 'text/html'), origin = globalThis.location?.origin } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { credentials: 'include', cache: 'no-store', redirect: 'follow', signal: controller.signal, headers: { Accept: 'text/html,application/xhtml+xml' } });
      if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
      const finalUrl = new URL(response.url || url, origin);
      if (finalUrl.origin !== origin) throw Object.assign(new Error('Redirecionamento para outro domínio recusado.'), { noRetry: true });
      const html = await readBody(response, partial);
      if (looksLikeLogin(finalUrl, html)) throw Object.assign(new Error('Sessão do Moodle expirada. Entre de novo e atualize.'), { noRetry: true, status: 401 });
      return { doc: parser(html), finalUrl: finalUrl.href };
    } catch (error) {
      if (error && error.name === 'AbortError') throw Object.assign(new Error('Tempo limite excedido.'), { retriable: true });
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  root.IMN.pages = {
    parsePendingCount, parsePendingInfo, SUMMARY_PARTIAL, collectAssignments, collectAssignmentsFromIndex, assignmentIndexUrl, courseIdOf, collectCourses, extractSesskey, extractPendingUserIds,
    fetchDocument, looksLikeLogin, assignmentIdFromHref, courseIdFromHref,
    MAX_ASSIGNMENTS_PER_COURSE, MAX_COURSES_PER_CATEGORY, readCourseInfo, readCourseCard };
})(globalThis);

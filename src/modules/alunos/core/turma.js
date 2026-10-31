// Relatório da turma: junta o "Total do curso" de várias UCs numa planilha com uma aba por turma e uma aba "Situação".
// Funções puras (sem DOM), testadas em tests/alunos.test.js. Sem nota = célula vazia (nunca zero). Faixas vêm dos ajustes (DEFAULTS).
// Ideia de partida: projeto "SENAI Extensões" (Julio Alves, MIT) — reescrito aqui com testes e com as nossas faixas de situação.
(function (root) {
  'use strict';
  const ALN = root.ALN;
  const clean = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const keyOf = c => clean(c).toLowerCase();

  // reports: [{ id, name, category, students: [{ key, name, total, situation }] }] (UCs lidas com sucesso)
  function groupByTurma(reports) {
    const groups = new Map();
    reports.forEach(r => {
      const label = clean(r.category) || 'Turma sem identificação';
      const k = keyOf(label);
      if (!groups.has(k)) groups.set(k, { turma: label, reports: [] });
      groups.get(k).reports.push(r);
    });
    return [...groups.values()];
  }

  function turmaRows(group) {
    const people = new Map();
    group.reports.forEach(rep => rep.students.forEach(st => {
      const k = st.key || keyOf(st.name);
      if (!people.has(k)) people.set(k, { name: st.name, totals: new Map() });
      const p = people.get(k);
      if (st.name && st.name.length > p.name.length) p.name = st.name;
      p.totals.set(rep.id, typeof st.total === 'number' && Number.isFinite(st.total) ? st.total : null);
    }));
    const list = [...people.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return [['Aluno', ...group.reports.map(r => r.name)], ...list.map(p => [p.name, ...group.reports.map(r => (p.totals.has(r.id) ? p.totals.get(r.id) : null))])];
  }

  const COUNT_KEYS = ['sem_nota', 'abaixo', 'recuperacao', 'media'];
  function situationCounts(students) {
    const c = { sem_nota: 0, abaixo: 0, recuperacao: 0, media: 0, nao_identificado: 0, total: students.length };
    students.forEach(st => { c[COUNT_KEYS.includes(st.situation) ? st.situation : 'nao_identificado'] += 1; });
    return c;
  }

  // failures: [{ name, category, reason }] (UCs que não puderam ser lidas — aparecem na aba "Avisos")
  function buildSheets(reports, failures = []) {
    const groups = groupByTurma(reports);
    const sheets = groups.map(g => ({ name: g.turma, rows: turmaRows(g) }));
    const rows = [['Turma', 'UC', 'Alunos', 'Sem nota', 'Abaixo da faixa', 'Recuperação', 'Média alcançada']];
    groups.forEach(g => g.reports.forEach(r => { const c = situationCounts(r.students); rows.push([g.turma, r.name, c.total, c.sem_nota, c.abaixo, c.recuperacao, c.media]); }));
    sheets.push({ name: 'Situação', rows });
    if (failures.length) sheets.push({ name: 'Avisos', rows: [['UC', 'Turma', 'Motivo'], ...failures.map(f => [f.name, clean(f.category), f.reason])] });
    return sheets;
  }

  // Lê os cartões de curso da página "Meus cursos". Só olha o que está na tela; não consulta nada.
  function detectCourses(doc, origin) {
    const found = new Map();
    const main = doc.querySelector('[role="main"],#region-main,main') || doc.body;
    // Se a região principal não tem cursos (temas como o do FIEG), procura na página toda, menos menus, rodapé e gavetas.
    const links = [...main.querySelectorAll('a[href*="/course/view.php"]')];
    const lista = links.length ? links : [...doc.body.querySelectorAll('a[href*="/course/view.php"]')].filter(a => !a.closest('nav,header,footer,.navbar,.drawer,[data-region="drawer"],.dropdown-menu,[role="navigation"]'));
    lista.forEach(a => {
      let u; try { u = new URL(a.getAttribute('href'), origin); } catch (_) { return; }
      const id = u.searchParams.get('id');
      if (!id || !/^\d+$/.test(id) || u.origin !== origin || found.has(id)) return;
      const card = a.closest('[data-course-id],.course-summaryitem,.coursebox,.card,li') || a.parentElement;
      const nameNode = (card && card.querySelector('a.coursename,.coursename,.multiline')) || a;
      const textOf = n => { if (!n) return ''; const c = n.cloneNode(true); c.querySelectorAll('.sr-only,.visually-hidden,.accesshide,[aria-hidden="true"]').forEach(x => x.remove()); return clean(c.textContent); };
      const name = textOf(nameNode) || clean(a.getAttribute('title')) || `UC ${id}`;
      const category = textOf(card && card.querySelector('.categoryname'));
      found.set(id, { id, name, category });
    });
    return [...found.values()];
  }

  ALN.turma = { groupByTurma, turmaRows, situationCounts, buildSheets, detectCourses };
})(globalThis);

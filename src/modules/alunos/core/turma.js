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

  // ---- Matriculados por turma (lista de participantes de cada UC). Só números e, para a aba "Atenção", nomes de quem está sem acesso.
  const fold = t => clean(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const ROLE_ALUNO = /estudante|aluno|student|cursista/;
  const isSuspenso = status => /suspens|suspend|nao atual|not current/.test(fold(status));
  const DIAS_SEM_ACESSO = 7, NUNCA = 9999;

  // rows: participantes lidos ({ key, name, role, status, lastAccessDays }). Só papel de estudante conta.
  function matriculas(rows) {
    const lista = Array.isArray(rows) ? rows : [];
    const comPapel = lista.some(r => clean(r.role));
    const alunos = lista.filter(r => (comPapel ? ROLE_ALUNO.test(fold(r.role)) : true));
    const avisos = [];
    if (!lista.length) avisos.push('Lista de participantes vazia ou não reconhecida.');
    else if (!comPapel) avisos.push('A coluna de papéis não foi reconhecida: todos os participantes foram contados como alunos.');
    else if (!alunos.length) avisos.push('Nenhum participante com papel de estudante.');
    return { alunos: alunos.map(r => ({ key: r.key || keyOf(r.name), name: clean(r.name), suspenso: isSuspenso(r.status), dias: Number.isFinite(r.lastAccessDays) ? r.lastAccessDays : null })), avisos };
  }

  function contar(alunos, limite = DIAS_SEM_ACESSO) {
    const c = { matriculados: alunos.length, ativos: 0, suspensos: 0, semAcesso: 0, nunca: 0 };
    alunos.forEach(a => {
      if (a.suspenso) { c.suspensos += 1; return; }
      c.ativos += 1;
      if (a.dias === NUNCA) { c.nunca += 1; c.semAcesso += 1; } else if (a.dias != null && a.dias >= limite) c.semAcesso += 1;
    });
    return c;
  }

  // reports: [{ id, name, category, alunos }]. Na turma, o aluno que está em várias UCs conta uma vez:
  // fica ativo se estiver ativo em alguma UC e vale o acesso mais recente entre elas.
  function resumoMatriculas(reports, falhas = [], limite = DIAS_SEM_ACESSO) {
    const turmas = groupByTurma(reports).map(g => {
      const uniao = new Map();
      g.reports.forEach(r => r.alunos.forEach(a => {
        const antes = uniao.get(a.key);
        if (!antes) { uniao.set(a.key, { key: a.key, name: a.name, suspenso: a.suspenso, dias: a.dias, ucs: [r.name] }); return; }
        antes.suspenso = antes.suspenso && a.suspenso; antes.ucs.push(r.name);
        if (a.dias != null && (antes.dias == null || a.dias < antes.dias)) antes.dias = a.dias;
        if (a.name.length > antes.name.length) antes.name = a.name;
      }));
      const alunos = [...uniao.values()];
      const atencao = alunos.filter(a => !a.suspenso && a.dias != null && a.dias >= limite)
        .sort((a, b) => b.dias - a.dias || a.name.localeCompare(b.name, 'pt-BR'))
        .map(a => ({ name: a.name, ucs: a.ucs, dias: a.dias }));
      return { turma: g.turma, ...contar(alunos, limite), ucs: g.reports.map(r => ({ name: r.name, ...contar(r.alunos, limite) })), atencao };
    }).sort((a, b) => a.turma.localeCompare(b.turma, 'pt-BR'));
    const totais = turmas.reduce((t, x) => { ['matriculados', 'ativos', 'suspensos', 'semAcesso', 'nunca'].forEach(k => { t[k] += x[k]; }); return t; }, { matriculados: 0, ativos: 0, suspensos: 0, semAcesso: 0, nunca: 0 });
    return { turmas, totais, falhas: falhas.map(f => ({ name: clean(f.name), category: clean(f.category), reason: clean(f.reason) })), limite };
  }

  // Foto só de números (sem nomes) para comparar com a próxima leitura.
  const CAMPOS = ['matriculados', 'ativos', 'suspensos', 'semAcesso'];
  function snapshot(resumo, quando = Date.now()) {
    const turmas = {};
    resumo.turmas.forEach(t => { turmas[t.turma] = Object.fromEntries(CAMPOS.map(k => [k, t[k]])); });
    return { v: 1, lidoEm: quando, turmas };
  }
  function diffTurmas(anterior, resumo) {
    const out = new Map();
    if (!anterior || anterior.v !== 1 || !anterior.turmas || typeof anterior.turmas !== 'object') return out;
    resumo.turmas.forEach(t => {
      const a = anterior.turmas[t.turma];
      if (a && typeof a === 'object') out.set(t.turma, Object.fromEntries(CAMPOS.map(k => [k, t[k] - (Number.isFinite(a[k]) ? a[k] : 0)])));
    });
    return out;
  }
  const sinal = n => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

  function resumoTexto(resumo, diff = new Map(), dataTexto = '') {
    const t = resumo.totais;
    const linhas = [`Resumo das turmas${dataTexto ? ` (${dataTexto})` : ''}: ${t.matriculados} matriculados em ${resumo.turmas.length} turma(s); ${t.ativos} ativos, ${t.suspensos} suspensos/inativos, ${t.semAcesso} sem acesso há ${resumo.limite}+ dias.`];
    resumo.turmas.forEach(x => {
      const d = diff.get(x.turma);
      linhas.push(`• ${x.turma}: ${x.matriculados} matriculados (${x.ativos} ativos, ${x.suspensos} suspensos, ${x.semAcesso} sem acesso)${d ? ` — desde a leitura anterior: ${sinal(d.matriculados)} matriculados` : ''}`);
    });
    return linhas.join('\n');
  }

  // Notas por UC para o painel. items: [{ id, name, category, estado: 'completa'|'parcial'|'falhou', students, de, motivo }].
  // Leitura parcial vale: mostra o que foi lido (lidos/de). Falha total aparece com o motivo, nunca some.
  function resumoNotas(items) {
    return (Array.isArray(items) ? items : []).map(it => {
      const turma = clean(it.category) || 'Turma sem identificação';
      const base = { id: it.id, uc: clean(it.name), turma, estado: it.estado, motivo: clean(it.motivo) };
      if (it.estado === 'falhou') return base;
      const alunos = Array.isArray(it.students) ? it.students : [];
      const c = situationCounts(alunos);
      const pcts = alunos.map(x => x.totalPct).filter(n => typeof n === 'number' && Number.isFinite(n));
      const media = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) / 10 : null;
      return { ...base, media, abaixo: c.abaixo, recuperacao: c.recuperacao, semNota: c.sem_nota, lidos: alunos.length, de: Number.isFinite(it.de) && it.de > 0 ? it.de : null };
    }).sort((a, b) => a.turma.localeCompare(b.turma, 'pt-BR') || a.uc.localeCompare(b.uc, 'pt-BR'));
  }

  function buildSheetsMatriculas(resumo) {
    const cab = ['Turma', 'UCs lidas', 'Matriculados', 'Ativos', 'Suspensos/inativos', `Sem acesso há ${resumo.limite}+ dias`, 'Nunca acessaram'];
    const turmas = [cab, ...resumo.turmas.map(t => [t.turma, t.ucs.length, t.matriculados, t.ativos, t.suspensos, t.semAcesso, t.nunca]),
      ['Total', resumo.turmas.reduce((n, t) => n + t.ucs.length, 0), resumo.totais.matriculados, resumo.totais.ativos, resumo.totais.suspensos, resumo.totais.semAcesso, resumo.totais.nunca]];
    const porUc = [['Turma', 'UC', 'Matriculados', 'Ativos', 'Suspensos/inativos', `Sem acesso há ${resumo.limite}+ dias`, 'Nunca acessaram'],
      ...resumo.turmas.flatMap(t => t.ucs.map(u => [t.turma, u.name, u.matriculados, u.ativos, u.suspensos, u.semAcesso, u.nunca]))];
    const sheets = [{ name: 'Turmas', rows: turmas }, { name: 'Por UC', rows: porUc }];
    const atencao = resumo.turmas.flatMap(t => t.atencao.map(a => [a.name, t.turma, a.ucs.join('; '), a.dias === NUNCA ? 'Nunca acessou' : a.dias]));
    if (atencao.length) sheets.push({ name: 'Atenção', rows: [['Aluno', 'Turma', 'UC(s)', 'Dias sem acesso'], ...atencao] });
    if (resumo.falhas.length) sheets.push({ name: 'Avisos', rows: [['UC', 'Turma', 'Motivo'], ...resumo.falhas.map(f => [f.name, f.category, f.reason])] });
    return sheets;
  }

  ALN.turma = { groupByTurma, turmaRows, situationCounts, buildSheets, detectCourses, matriculas, contar, resumoMatriculas, resumoNotas, snapshot, diffTurmas, resumoTexto, buildSheetsMatriculas, DIAS_SEM_ACESSO };
})(globalThis);
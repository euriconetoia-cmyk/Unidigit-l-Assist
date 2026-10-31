// Regras puras do módulo Alunos e notas: situação, risco, relatório da UC e CSV.
// Sem DOM e sem rede, para testar em Node. Regras de risco portadas de classifyStudent (Assistente EaD 3.7.18).
(function (root) {
  'use strict';
  const ALN = root.ALN = root.ALN || {};

  const DEFAULTS = Object.freeze({
    minimumGrade: 60, recoveryMin: 40, recoveryMax: 59.99,
    noAccessAttentionDays: 7, noAccessHighDays: 10, noAccessImmediateDays: 15
  });

  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const isNum = v => typeof v === 'number' && Number.isFinite(v);
  const round1 = v => Math.round(v * 10) / 10;
  const fmt = v => (v == null || !Number.isFinite(v) ? '—' : String(round1(v)).replace('.', ','));

  // Nota → porcentagem da nota máxima (quando conhecida). Sem máximo, usa o valor como está (escala 0-100 do SENAI).
  const toPct = (value, max) => (!isNum(value) ? null : isNum(max) && max > 0 ? (value / max) * 100 : value);

  function situation(pct, settings) {
    const s = { ...DEFAULTS, ...settings };
    if (pct == null) return 'sem_nota';
    if (pct >= s.minimumGrade) return 'media';
    if (pct >= s.recoveryMin) return 'recuperacao';
    return 'abaixo';
  }
  const SITUATION_LABEL = { media: 'Média alcançada', recuperacao: 'Recuperação', abaixo: 'Abaixo da faixa', sem_nota: 'Sem nota', nao_identificado: 'Total não identificado' };

  const isActivityItem = item => !item.isCourseTotal && !item.isTotal;

  // Junta livro de notas e participantes. Aluno só existe se está no livro de notas (papel avaliado).
  function buildStudents({ gradebook, participants = [] }, settings) {
    const s = { ...DEFAULTS, ...settings };
    if (!gradebook || !gradebook.students || !gradebook.students.length) return [];
    const byKey = new Map(participants.map(p => [p.key, p]));
    const byName = new Map(participants.map(p => [norm(p.name), p]));
    const totalItem = gradebook.courseTotalItem || null;
    return gradebook.students.map(st => {
      const part = byKey.get(st.studentKey) || byName.get(norm(st.studentName)) || null;
      const totalPct = totalItem ? toPct(st.courseTotal, totalItem.maxGrade) : null;
      const acts = gradebook.items.filter(isActivityItem);
      const graded = acts.filter(it => st.grades[it.key] && st.grades[it.key].value !== null).length;
      const student = {
        key: st.studentKey, name: st.studentName, email: st.email || (part && part.email) || '',
        profileUrl: st.profileUrl || (part && part.profileUrl) || '',
        lastAccessText: part ? part.lastAccessText : '', lastAccessDays: part ? part.lastAccessDays : null,
        accessKnown: Boolean(part && part.lastAccessText),
        total: st.courseTotal, totalDisplay: st.courseTotalDisplay, totalPct,
        itemsGraded: graded, itemsMissing: acts.length - graded, itemCount: acts.length,
        grades: st.grades
      };
      student.situation = !totalItem ? 'nao_identificado' : situation(totalPct, s);
      student.risk = assessRisk(student, s, { totalKnown: Boolean(totalItem) });
      return student;
    }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  // Risco. Fonte ausente = "verificar", nunca "regular" (regra do Assistente EaD).
  function assessRisk(st, settings, { totalKnown }) {
    const s = { ...DEFAULTS, ...settings };
    const reasons = []; let score = 0;
    if (st.lastAccessDays != null) {
      if (st.lastAccessDays >= s.noAccessImmediateDays) { score += 5; reasons.push({ code: 'no_access_immediate', severity: 4, text: `${st.lastAccessText} no Moodle` }); }
      else if (st.lastAccessDays >= s.noAccessHighDays) { score += 4; reasons.push({ code: 'no_access_high', severity: 3, text: `${st.lastAccessText} no Moodle` }); }
      else if (st.lastAccessDays >= s.noAccessAttentionDays) { score += 2; reasons.push({ code: 'no_access_attention', severity: 2, text: `${st.lastAccessText} no Moodle` }); }
    }
    if (st.totalPct != null) {
      if (st.totalPct < s.recoveryMin) { score += 4; reasons.push({ code: 'grade_below_recovery', severity: 4, text: `Nota ${fmt(st.totalPct)} abaixo de ${s.recoveryMin}` }); }
      else if (st.totalPct <= s.recoveryMax) { score += 4; reasons.push({ code: 'recovery_range', severity: 3, text: `Nota ${fmt(st.totalPct)} na faixa de recuperação` }); }
      else if (st.totalPct < s.minimumGrade) { score += 2; reasons.push({ code: 'below_minimum', severity: 2, text: `Nota ${fmt(st.totalPct)} abaixo da média ${s.minimumGrade}` }); }
    }
    if (st.itemsMissing > 0) {
      const many = st.itemsMissing >= 3;
      score += many ? 2 : 1;
      reasons.push({ code: 'items_without_grade', severity: 1, text: `${st.itemsMissing} item(ns) sem nota lançada` });
    }
    const unknown = [];
    if (!st.accessKnown) unknown.push('último acesso');
    if (!totalKnown) unknown.push('total do curso');
    let level = score >= 8 ? 'imediato' : score >= 4 ? 'alto' : score >= 2 ? 'atencao' : 'regular';
    // Dado ausente nunca vira "regular": mostra "verificar" quando nada indica risco e falta fonte.
    if (level === 'regular' && unknown.length) level = 'verificar';
    reasons.sort((a, b) => b.severity - a.severity);
    return { level, score, reasons, unknown, action: recommend(reasons, level) };
  }

  function recommend(reasons, level) {
    const c = new Set(reasons.map(r => r.code));
    if (level === 'verificar') return 'Atualizar a leitura ou conferir o aluno manualmente no Moodle.';
    if (c.has('no_access_immediate')) return 'Fazer busca ativa: confirmar dificuldade de acesso e registrar o retorno.';
    if (c.has('grade_below_recovery')) return 'Conferir evidências, orientar o aluno e avaliar encaminhamento conforme as regras acadêmicas.';
    if (c.has('recovery_range') || c.has('below_minimum')) return 'Orientar sobre a recuperação e registrar a comunicação.';
    if (c.has('no_access_high') || c.has('no_access_attention')) return 'Enviar mensagem de acompanhamento e confirmar o acesso ao curso.';
    if (c.has('items_without_grade')) return 'Conferir se há entrega aguardando correção ou atividade a cobrar.';
    return 'Manter acompanhamento regular.';
  }

  // Relatório da UC. `category` filtra os itens (vazio = todo o curso).
  function buildReport(students, gradebook, settings, category) {
    const s = { ...DEFAULTS, ...settings };
    const items = (gradebook ? gradebook.items : []).filter(isActivityItem).filter(it => !category || it.category === category);
    const n = students.length;
    const withTotal = students.filter(st => st.totalPct != null);
    const counts = { media: 0, recuperacao: 0, abaixo: 0, sem_nota: 0, nao_identificado: 0 };
    students.forEach(st => { counts[st.situation] += 1; });
    const perItem = items.map(it => {
      const vals = students.map(st => st.grades[it.key] ? st.grades[it.key].value : null);
      const got = vals.filter(v => v !== null);
      const pcts = got.map(v => toPct(v, it.maxGrade));
      return {
        key: it.key, name: it.name.split('›').pop().trim(), maxGrade: it.maxGrade, graded: got.length, total: n,
        coveragePct: n ? (got.length / n) * 100 : 0,
        avg: got.length ? got.reduce((a, b) => a + b, 0) / got.length : null,
        avgPct: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null
      };
    });
    const cells = items.length * n;
    const gradedCells = perItem.reduce((a, x) => a + x.graded, 0);
    const lowest = perItem.filter(x => n).slice().sort((a, b) => a.coveragePct - b.coveragePct)[0] || null;
    return {
      students: n, items: items.length,
      meanPct: withTotal.length ? withTotal.reduce((a, st) => a + st.totalPct, 0) / withTotal.length : null,
      meanBase: withTotal.length,
      reachedPct: withTotal.length ? (counts.media / withTotal.length) * 100 : null,
      gradedPct: cells ? (gradedCells / cells) * 100 : null,
      missingCells: cells - gradedCells,
      counts, perItem, lowest: lowest && lowest.coveragePct < 100 ? lowest : null,
      riskCounts: ['imediato', 'alto', 'atencao', 'verificar', 'regular'].reduce((o, k) => (o[k] = students.filter(st => st.risk.level === k).length, o), {}),
      settings: s
    };
  }

  function categoriesOf(gradebook) {
    const set = new Set();
    (gradebook ? gradebook.items : []).filter(isActivityItem).forEach(it => { if (it.category) set.add(it.category); });
    return [...set];
  }

  // ---------- CSV (com proteção contra fórmula de planilha) ----------
  const cell = v => {
    const shared = root.MAT_SHARED && root.MAT_SHARED.csvCell;
    if (shared) return shared(v);
    let t = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const toCsv = rows => '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n') + '\r\n';
  const LEVEL_LABEL = { imediato: 'Imediato', alto: 'Alto', atencao: 'Atenção', verificar: 'Verificar', regular: 'Regular' };

  function studentsCsv(students) {
    return toCsv([['aluno', 'email', 'ultimo_acesso', 'itens_com_nota', 'itens_sem_nota', 'nota_total', 'situacao'],
      ...students.map(st => [st.name, st.email, st.lastAccessText, st.itemsGraded, st.itemsMissing, st.totalDisplay || '', SITUATION_LABEL[st.situation]])]);
  }
  function gradesCsv(students, gradebook, category) {
    const items = gradebook.items.filter(isActivityItem).filter(it => !category || it.category === category);
    return toCsv([['aluno', 'email', ...items.map(it => it.maxGrade != null ? `${it.name} (máx. ${it.maxGrade})` : it.name), 'nota_total', 'situacao'],
      ...students.map(st => [st.name, st.email, ...items.map(it => (st.grades[it.key] && st.grades[it.key].value !== null ? st.grades[it.key].value : '')), st.totalDisplay || '', SITUATION_LABEL[st.situation]])]);
  }
  function riskCsv(students) {
    return toCsv([['aluno', 'email', 'nivel', 'motivos', 'proxima_acao'],
      ...students.filter(st => st.risk.level !== 'regular').map(st => [st.name, st.email, LEVEL_LABEL[st.risk.level], st.risk.reasons.map(r => r.text).join(' | ') || (st.risk.unknown.length ? `Sem leitura de: ${st.risk.unknown.join(', ')}` : ''), st.risk.action])]);
  }
  function reportCsv(report, label) {
    return toCsv([['relatorio_uc', label || 'Curso completo'], ['alunos', report.students], ['media_da_turma', report.meanPct == null ? '' : round1(report.meanPct)],
      ['alunos_com_media', report.counts.media], ['em_recuperacao', report.counts.recuperacao], ['abaixo_da_faixa', report.counts.abaixo], ['sem_nota', report.counts.sem_nota], [],
      ['atividade', 'nota_maxima', 'alunos_com_nota', 'alunos', 'media_valor', 'media_percentual'],
      ...report.perItem.map(x => [x.name, x.maxGrade == null ? '' : x.maxGrade, x.graded, x.total, x.avg == null ? '' : round1(x.avg), x.avgPct == null ? '' : round1(x.avgPct)])]);
  }
  // ---------- Planilhas para o Excel (.xlsx): mesmos dados dos CSV, com números de verdade; sem nota = célula vazia (nunca 0) ----------
  const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  function studentsSheet(students) {
    return { name: 'Alunos', rows: [['Aluno', 'E-mail', 'Último acesso', 'Itens com nota', 'Itens sem nota', 'Nota total', 'Situação'],
      ...students.map(st => [st.name, st.email, st.lastAccessText, st.itemsGraded, st.itemsMissing, num(st.total), SITUATION_LABEL[st.situation]])] };
  }
  function gradesSheet(students, gradebook, category) {
    const items = gradebook.items.filter(isActivityItem).filter(it => !category || it.category === category);
    return { name: 'Notas', rows: [['Aluno', 'E-mail', ...items.map(it => (it.maxGrade != null ? `${it.name} (máx. ${it.maxGrade})` : it.name)), 'Nota total', 'Situação'],
      ...students.map(st => [st.name, st.email, ...items.map(it => num(st.grades[it.key] && st.grades[it.key].value)), num(st.total), SITUATION_LABEL[st.situation]])] };
  }
  function riskSheet(students) {
    return { name: 'Acompanhamento', rows: [['Aluno', 'E-mail', 'Nível', 'Motivos', 'Próxima ação'],
      ...students.filter(st => st.risk.level !== 'regular').map(st => [st.name, st.email, LEVEL_LABEL[st.risk.level], st.risk.reasons.map(r => r.text).join(' | ') || (st.risk.unknown.length ? `Sem leitura de: ${st.risk.unknown.join(', ')}` : ''), st.risk.action])] };
  }
  function reportSheets(report, label) {
    return [
      { name: 'Resumo', header: false, widths: [28, 40], rows: [['Relatório da UC', label || 'Curso completo'], ['Alunos', report.students], ['Média da turma', report.meanPct == null ? null : round1(report.meanPct)],
        ['Alunos com média', report.counts.media], ['Em recuperação', report.counts.recuperacao], ['Abaixo da faixa', report.counts.abaixo], ['Sem nota', report.counts.sem_nota]] },
      { name: 'Atividades', rows: [['Atividade', 'Nota máxima', 'Alunos com nota', 'Alunos', 'Média (valor)', 'Média (%)'],
        ...report.perItem.map(x => [x.name, num(x.maxGrade), x.graded, x.total, x.avg == null ? null : round1(x.avg), x.avgPct == null ? null : round1(x.avgPct)])] }
    ];
  }
  // Mensagem de contato para copiar (a extensão não envia nada).
  function contactText(st, courseName) {
    const motivos = st.risk.reasons.map(r => r.text.toLowerCase()).join('; ');
    return `Olá, ${st.name.split(' ')[0]}! Aqui é o tutor do curso${courseName ? ` ${courseName}` : ''}. Percebi que ${motivos || 'há pontos a conferir na sua participação'}. Posso ajudar com alguma dificuldade? Estou à disposição para combinarmos os próximos passos.`;
  }

  Object.assign(ALN, { DEFAULTS, toPct, situation, SITUATION_LABEL, LEVEL_LABEL, buildStudents, assessRisk, buildReport, categoriesOf, studentsCsv, gradesCsv, riskCsv, reportCsv, studentsSheet, gradesSheet, riskSheet, reportSheets, contactText, fmt, isActivityItem });
})(globalThis);

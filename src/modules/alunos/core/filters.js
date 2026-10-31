// Filtros, contagens e ordenação da lista de alunos. Funções puras (sem DOM), testadas em tests/alunos-filtros.test.js.
// "Pendências" aqui = itens sem nota no livro de notas. Isso NÃO prova falta de entrega (pode estar aguardando correção);
// a leitura das tarefas (próxima etapa) é que separa "sem entrega" de "aguardando correção".
(function (root) {
  'use strict';
  const ALN = root.ALN;

  const GROUPS = {
    access: { label: 'Último acesso', options: [['hoje', 'Hoje'], ['1-7', '1–7 dias'], ['8-14', '8–14'], ['15-30', '15–30'], ['30+', '+30 dias'], ['nunca', 'Nunca'], ['nao_lido', 'Não lido']] },
    graded: { label: 'Itens com nota', options: [['nenhum', 'Nenhum'], ['alguns', 'Alguns'], ['completo', 'Completos']] },
    pend: { label: 'Pendências', options: [['com', 'Com pendência'], ['em_dia', 'Em dia'], ['aguardando', 'Aguardando minha correção']] },
    situation: { label: 'Situação', options: [['media', 'Média'], ['recuperacao', 'Recuperação'], ['abaixo', 'Abaixo'], ['sem_nota', 'Sem nota']] }
  };
  const EMPTY = Object.freeze({ access: 'todos', graded: 'todos', pend: 'todos', situation: 'todos', q: '' });

  function accessBucket(st) {
    if (!st.accessKnown || st.lastAccessDays == null) return 'nao_lido';
    const d = st.lastAccessDays;
    if (d >= 9999) return 'nunca';
    if (d <= 0) return 'hoje';
    if (d <= 7) return '1-7';
    if (d <= 14) return '8-14';
    if (d <= 30) return '15-30';
    return '30+';
  }
  const gradedBucket = st => (st.itemsGraded <= 0 ? 'nenhum' : st.itemsGraded >= st.itemCount ? 'completo' : 'alguns');
  // Pendência = sem entrega (quando as entregas foram lidas) ou item sem nota (antes disso). Um aluno pode estar em dois grupos.
  const pendCount = st => (st.pendCount != null ? st.pendCount : st.itemsMissing);
  const pendBucket = st => [pendCount(st) > 0 ? 'com' : 'em_dia', ...(st.waitingCount > 0 ? ['aguardando'] : [])];
  const valueOf = { access: accessBucket, graded: gradedBucket, pend: pendBucket, situation: st => st.situation };

  const has = (v, id) => (Array.isArray(v) ? v.includes(id) : v === id);
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function matches(st, f, skip) {
    for (const g of Object.keys(valueOf)) if (g !== skip && f[g] && f[g] !== 'todos' && !has(valueOf[g](st), f[g])) return false;
    const q = norm(f.q).trim();
    return !q || norm(st.name).includes(q) || norm(st.email).includes(q);
  }
  const filterStudents = (students, f) => students.filter(st => matches(st, { ...EMPTY, ...f }));
  // Contagem de cada opção respeitando os OUTROS filtros (o próprio grupo fica livre para trocar de opção).
  function counts(students, f, group) {
    const base = students.filter(st => matches(st, { ...EMPTY, ...f }, group));
    const out = { todos: base.length };
    GROUPS[group].options.forEach(([id]) => { out[id] = base.filter(st => has(valueOf[group](st), id)).length; });
    return out;
  }
  const activeCount = f => Object.keys(valueOf).filter(g => f[g] && f[g] !== 'todos').length + (norm(f.q).trim() ? 1 : 0);

  const LEVEL_RANK = { imediato: 5, alto: 4, atencao: 3, verificar: 2, regular: 1 };
  const accessDays = st => (st.accessKnown && st.lastAccessDays != null ? st.lastAccessDays : -1);
  const KEYS = {
    name: (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
    access: (a, b) => accessDays(a) - accessDays(b),
    graded: (a, b) => a.itemsGraded - b.itemsGraded,
    total: (a, b) => (a.totalPct == null ? 1e9 : a.totalPct) - (b.totalPct == null ? 1e9 : b.totalPct),
    situation: (a, b) => (LEVEL_RANK[a.risk.level] - LEVEL_RANK[b.risk.level]),
    urgency: (a, b) => (LEVEL_RANK[b.risk.level] - LEVEL_RANK[a.risk.level]) || (b.risk.score - a.risk.score) || KEYS.total(a, b) || KEYS.name(a, b)
  };
  function sortStudents(list, key, dir) {
    const cmp = KEYS[key] || KEYS.name;
    return list.slice().sort((a, b) => (dir === 'desc' ? -1 : 1) * cmp(a, b) || KEYS.name(a, b));
  }
  const initials = name => String(name || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('') || '?';
  // "Precisam de atenção": risco imediato, alto ou atenção.
  const needsAttention = st => ['imediato', 'alto', 'atencao'].includes(st.risk.level);
  const accessLabel = st => (st.accessKnown ? st.lastAccessText : 'não lido');
  const accessTone = st => (st.accessKnown && st.lastAccessDays != null && st.lastAccessDays >= 15 ? 'old' : '');

  ALN.filters = { pendCount, GROUPS, EMPTY, accessBucket, gradedBucket, pendBucket, filterStudents, counts, activeCount, sortStudents, initials, needsAttention, accessLabel, accessTone };
})(globalThis);

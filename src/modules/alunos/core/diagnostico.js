// Diagnóstico de compatibilidade da página atual. Só olha o que já está na tela (não consulta o Moodle) e devolve
// contagens e nomes de elementos reconhecidos. NUNCA inclui nome, e-mail ou nota de aluno, nem textos da página.
(function (root) {
  'use strict';
  const ALN = root.ALN;
  const MAT = root.MAT;

  function tipo(loc) {
    try {
      const p = new URL(loc.href).pathname;
      const u = new URL(loc.href);
      if (/\/course\/view\.php$/.test(p)) return 'curso';
      if (/\/course\/index\.php$/.test(p) && u.searchParams.has('categoryid')) return 'categoria';
      if (/\/mod\/assign\/view\.php$/.test(p)) return 'atividade';
      if (/^\/my\/(courses\.php|index\.php)?$/.test(p)) return 'meus-cursos';
      if (/\/grade\/report\/grader\/index\.php$/.test(p)) return 'livro-de-notas';
      if (/\/user\/index\.php$/.test(p)) return 'participantes';
    } catch (_) { /* endereço inválido */ }
    return 'outra';
  }
  const ROTULO = { curso: 'Curso', categoria: 'Categoria de cursos', atividade: 'Atividade (tarefa)', 'meus-cursos': 'Meus cursos', 'livro-de-notas': 'Livro de notas', participantes: 'Participantes', outra: 'Outra página' };
  const ok = (rotulo, detalhe) => ({ rotulo, estado: 'ok', detalhe });
  const aviso = (rotulo, detalhe) => ({ rotulo, estado: 'aviso', detalhe });
  const falha = (rotulo, detalhe) => ({ rotulo, estado: 'falha', detalhe });
  const safe = (rotulo, fn) => { try { return fn(); } catch (e) { return falha(rotulo, `erro ao verificar (${e && e.message ? e.message : e})`); } };

  function verificarLivro(doc) {
    const out = [];
    const adapter = MAT.adapters.createAdapter();
    const gb = adapter.extractGradebookReport(doc, { id: 0 });
    const d = gb && gb.diagnostics ? gb.diagnostics : {};
    if (!gb || !gb.students || !gb.students.length) { out.push(falha('Tabela do livro de notas', (d.reason || 'não reconhecida'))); return out; }
    out.push(ok('Tabela do livro de notas', 'reconhecida'));
    out.push(ok('Linhas de alunos', String(gb.students.length)));
    out.push(gb.courseTotalItem ? ok('Coluna “Total do curso”', 'encontrada') : falha('Coluna “Total do curso”', 'não encontrada'));
    out.push(ok('Colunas de atividades', String((gb.items || []).filter(i => !i.isTotal).length)));
    out.push(d.paginationDetected ? aviso('Paginação', 'há mais páginas de alunos') : ok('Paginação', 'sem outras páginas'));
    if (d.limitedByGroup) out.push(aviso('Filtro de grupo', 'a leitura mostra só um grupo'));
    if (d.collapsedCategoriesDetected) out.push(aviso('Categorias recolhidas', String(d.collapsedCategoryCount || 'sim')));
    return out;
  }
  function verificarParticipantes(doc) {
    const r = MAT.adapters.createAdapter().extractParticipantRows(doc);
    if (!r.rows.length) return [falha('Tabela de participantes', (r.diagnostics && r.diagnostics.reason) || 'não reconhecida')];
    const semAcesso = r.rows.filter(x => !x.lastAccessText).length;
    return [ok('Tabela de participantes', 'reconhecida'), ok('Linhas', String(r.rows.length)), semAcesso === r.rows.length ? falha('Coluna “Último acesso”', 'não encontrada') : ok('Coluna “Último acesso”', 'encontrada')];
  }
  function verificarCurso(doc) {
    const out = [];
    const sec = doc.querySelectorAll('li.section, [data-for="section"], .course-section').length;
    out.push(sec ? ok('Seções do curso', String(sec)) : aviso('Seções do curso', 'não reconhecidas'));
    const link = (sub, rot) => out.push(doc.querySelector(`a[href*="${sub}"]`) ? ok(rot, 'link encontrado') : aviso(rot, 'link não encontrado nesta página'));
    link('/grade/report/', 'Acesso ao livro de notas');
    link('/user/index.php', 'Acesso aos participantes');
    const ativ = doc.querySelectorAll('a[href*="/mod/assign/view.php"]').length;
    out.push(ativ ? ok('Links de tarefas', String(ativ)) : aviso('Links de tarefas', 'nenhum nesta página'));
    return out;
  }
  function verificarAtividade(doc) {
    const out = [];
    const s = MAT.adapters.createAdapter().extractGradingPageSummary(doc);
    out.push(s ? ok('Resumo da tarefa', 'lido') : aviso('Resumo da tarefa', 'não reconhecido'));
    out.push(doc.querySelector('table.generaltable, table.flexible, table[id*="mod_assign"]') ? ok('Tabela de avaliação', 'encontrada') : aviso('Tabela de avaliação', 'não encontrada (abra a tela “Avaliação”)'));
    return out;
  }
  function verificarMeusCursos(doc, origin) {
    const cursos = ALN.turma.detectCourses(doc, origin);
    const out = [cursos.length ? ok('Cartões de curso', String(cursos.length)) : falha('Cartões de curso', 'não encontrados (role a página ou mude o filtro)')];
    if (cursos.length) {
      out.push(cursos.some(c => c.category) ? ok('Categoria nos cartões', 'encontrada') : aviso('Categoria nos cartões', 'não encontrada (turma pode sair como “Sem turma”)'));
    }
    return out;
  }

  // Devolve { versao, host, pagina, caminho, corpo, itens:[{rotulo,estado,detalhe}] }
  function rodar(doc, loc, versao) {
    const t = tipo(loc);
    const itens = [];
    const add = (rot, fn) => { const r = safe(rot, fn); (Array.isArray(r) ? r : [r]).forEach(x => itens.push(x)); };
    if (t === 'livro-de-notas') add('Livro de notas', () => verificarLivro(doc));
    else if (t === 'participantes') add('Participantes', () => verificarParticipantes(doc));
    else if (t === 'curso') add('Curso', () => verificarCurso(doc));
    else if (t === 'atividade') add('Atividade', () => verificarAtividade(doc));
    else if (t === 'meus-cursos') add('Meus cursos', () => verificarMeusCursos(doc, loc.origin));
    else itens.push(aviso('Página sem verificação específica', 'abra um curso, o livro de notas, os participantes, uma tarefa ou “Meus cursos”'));
    const corpo = (doc.body && doc.body.id) ? String(doc.body.id).slice(0, 60) : '';
    return { versao, host: loc.hostname, pagina: ROTULO[t], tipo: t, caminho: loc.pathname, corpo, itens };
  }

  const ICONE = { ok: '✓', aviso: '!', falha: '✗' };
  function comoTexto(r) {
    const cab = [`Unidigit@l Assist ${r.versao} — diagnóstico de compatibilidade`, `Moodle: ${r.host}`, `Página: ${r.pagina} (${r.caminho})`, r.corpo ? `Corpo da página: #${r.corpo}` : null].filter(Boolean);
    return [...cab, '', ...r.itens.map(i => `${ICONE[i.estado]} ${i.rotulo}: ${i.detalhe}`), '', 'Sem nome, e-mail ou nota de aluno.'].join('\n');
  }
  ALN.diagnostico = { tipo, rodar, comoTexto, ROTULO };
})(globalThis);

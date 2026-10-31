// Páginas fictícias no formato do Moodle 4 (livro de notas do avaliador e participantes). Dados inventados.
export const ALUNOS = [
  { id: 11, nome: 'Ana Beatriz Souza', email: 'ana@exemplo.com', acesso: '1 dia 2 horas', notas: [10, 9, 10, 9], total: 92 },
  { id: 12, nome: 'Bruno Henrique Lima', email: 'bruno@exemplo.com', acesso: '2 dias 3 horas', notas: [9, 8, null, 8], total: 81 },
  { id: 13, nome: 'Camila Ferreira', email: 'camila@exemplo.com', acesso: '9 dias 1 hora', notas: [7, null, 6, 5], total: 58 },
  { id: 14, nome: 'Diego Martins', email: 'diego@exemplo.com', acesso: '16 dias 4 horas', notas: [5, 4, null, null], total: 47 },
  { id: 15, nome: 'Fábio Rocha', email: 'fabio@exemplo.com', acesso: '23 dias 2 horas', notas: [3, null, null, null], total: 31 },
  { id: 16, nome: 'Gabriela Alves', email: 'gabriela@exemplo.com', acesso: '5 dias 2 horas', notas: [8, 8, 7, 7], total: 74 }
];
export const ITENS = [{ id: 201, nome: 'AV1 Fundamentos' }, { id: 202, nome: 'AV2 Endereçamento' }, { id: 203, nome: 'AV3 Serviços' }, { id: 204, nome: 'AV4 Segurança' }];
const dec = v => String(v).replace('.', ',');

// pagina/porPagina permitem simular paginação do livro de notas
export function graderPage({ id = 7, alunos = ALUNOS, pagina = 0, porPagina = 100, grupo = '', paginasTotal = 1 } = {}) {
  const fatia = alunos.slice(pagina * porPagina, (pagina + 1) * porPagina);
  const head = ITENS.map((it, i) => `<th class="header c${i + 1} cell" data-itemid="${it.id}"><a class="gradeitemheader" title="Tarefa ${it.nome}" href="#">${it.nome}</a></th>`).join('');
  const range = ITENS.map((it, i) => `<td class="cell c${i + 1} range">0–10</td>`).join('');
  const rows = fatia.map(a => `<tr class="userrow" data-userid="${a.id}"><th class="header userfield user cell c0" scope="row"><a href="/user/view.php?id=${a.id}&course=${id}">${a.nome}</a></th>${a.notas.map((v, i) => `<td class="cell c${i + 1} gradecell grade" data-itemid="${ITENS[i].id}"><span class="gradevalue">${v == null ? '-' : dec(v)}</span></td>`).join('')}<td class="cell c5 grade course" data-itemid="299"><span class="gradevalue">${dec(a.total)}</span></td></tr>`).join('');
  const paging = paginasTotal > 1 ? `<nav aria-label="Página" class="pagination"><ul>${Array.from({ length: paginasTotal }, (_, p) => `<li><a href="/grade/report/grader/index.php?id=${id}&page=${p}">${p + 1}</a></li>`).join('')}</ul></nav>` : '';
  const grupoSel = grupo ? `<div class="groupselector"><select name="group"><option selected>${grupo}</option></select></div>` : '';
  return `<html><body class="path-grade-report-grader"><h1>Curso ${id}</h1>${grupoSel}<table id="user-grades" class="gradereport-grader-table generaltable"><thead><tr class="heading"><th class="header c0 cell">Nome / Sobrenome</th>${head}<th class="header c5 cell" data-itemid="299"><a class="gradeitemheader" title="Total do curso" href="#">Total do curso</a></th></tr></thead><tbody>${rows}<tr class="range"><th class="cell c0">Faixa</th>${range}<td class="cell c5 range">0–100</td></tr></tbody></table>${paging}</body></html>`;
}

export function participantsPage({ id = 7, alunos = ALUNOS, extras = [{ id: 90, nome: 'Tutor Teste', email: 't@exemplo.com', papel: 'Professor', acesso: 'agora' }] } = {}) {
  const todos = [...alunos.map(a => ({ ...a, papel: 'Estudante' })), ...extras];
  const rows = todos.map(a => `<tr><td class="cell c1"><a href="/user/view.php?id=${a.id}&course=${id}">${a.nome}</a></td><td class="cell c2">${a.email}</td><td class="cell c3">${a.papel}</td><td class="cell c4">${a.acesso}</td></tr>`).join('');
  return `<html><body><h1>Participantes</h1><table id="participants" class="generaltable"><thead><tr><th>Nome completo</th><th>Endereço de email</th><th>Papéis</th><th>Último acesso ao curso</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

// Ferramentas do menu lateral. `disponivel: false` aparece como "em breve" e não faz nada ao clicar.
export const APPS = [
  { id: 'pendencias', grupo: 'Correção', nome: 'Pendências', descricao: 'Buscar o que falta corrigir', origem: 'Importar Notas', icone: 'pend', modulo: 'importar-notas', comando: 'radar.abrir', paginas: ['curso', 'categoria'], dicaPagina: 'Abra a página de um curso ou categoria', disponivel: true },
  { id: 'correcao', grupo: 'Correção', nome: 'Correção', descricao: 'Lançar notas e feedback por CSV', origem: 'Importar Notas', icone: 'corr', modulo: 'importar-notas', comando: 'correcao.abrir', comandoRetomar: 'correcao.retomar', paginas: ['curso', 'categoria', 'atividade'], dicaPagina: 'Abra um curso, categoria ou atividade', disponivel: true },
  { id: 'acompanhamento', grupo: 'Alunos', nome: 'Acompanhamento', descricao: 'Alunos em risco e próxima ação', origem: 'Assistente EaD', icone: 'acomp', modulo: 'alunos', comando: 'alunos.abrir', args: { aba: 'acomp' }, disponivel: true },
  { id: 'alunos-notas', grupo: 'Alunos', nome: 'Alunos e notas', descricao: 'Lista de alunos e boletim', origem: 'Assistente EaD', icone: 'alun', modulo: 'alunos', comando: 'alunos.abrir', args: { aba: 'alunos' }, disponivel: true },
  { id: 'relatorio-uc', grupo: 'Alunos', nome: 'Relatório da UC', descricao: 'Desempenho geral da turma', origem: 'Assistente EaD', icone: 'rel', modulo: 'alunos', comando: 'alunos.abrir', args: { aba: 'relatorio' }, disponivel: true },
  { id: 'relatorio-turma', grupo: 'Alunos', nome: 'Relatório da turma', descricao: 'Várias UCs de uma vez, em Excel', origem: 'novo', icone: 'turma', modulo: 'alunos', comando: 'alunos.turma', paginas: ['meus-cursos'], dicaPagina: 'Abra a página “Meus cursos”', disponivel: true },
  { id: 'blocos', grupo: 'Em breve', nome: 'Automação por blocos', descricao: 'Montar rotinas', origem: 'novo', icone: 'blo', disponivel: false }
];

// Tipo da página do Moodle para decidir onde cada ferramenta se aplica (só olha o endereço; não consulta nada).
export function tipoDaPagina(loc) {
  try {
    const u = new URL(loc.href);
    if (/\/course\/view\.php$/.test(u.pathname)) return 'curso';
    if (/\/course\/index\.php$/.test(u.pathname) && u.searchParams.has('categoryid')) return 'categoria';
    if (/\/mod\/assign\/view\.php$/.test(u.pathname)) return 'atividade';
    if (/^\/my\/(courses\.php|index\.php)?$/.test(u.pathname)) return 'meus-cursos';
  } catch (_) { /* endereço inválido */ }
  return 'outra';
}
export const aplicaNaPagina = (app, tipo) => !app.paginas || app.paginas.includes(tipo);

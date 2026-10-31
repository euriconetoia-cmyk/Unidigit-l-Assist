// Planilha-modelo do Kahoot (baixada pelo menu, em qualquer página). Mantida igual à de modules/kahoot/parse.js (um teste confere).
export const MODELO_KAHOOT = 'pergunta;opcao1;opcao2;opcao3;opcao4;correta\nQual é a capital de Goiás?;Goiânia;Anápolis;Brasília;Rio Verde;1\nO que é um DNS?;Tradutor de nomes em endereços IP;Um tipo de cabo;Um antivírus;Um navegador;A\n';

// Ferramentas do menu lateral. `gaveta`: aparece dentro de "Ferramentas" (gaveta com voltar), não no menu principal.
// `pagina`: abre uma página da própria extensão. `local`: ação feita pelo próprio botão (sem consultar nada). `disponivel: false` aparece como "em breve" e não faz nada ao clicar.
export const APPS = [
  { id: 'pendencias', grupo: 'Correção', nome: 'Pendências', descricao: 'Buscar o que falta corrigir', origem: 'Importar Notas', icone: 'pend', modulo: 'importar-notas', comando: 'radar.abrir', paginas: ['curso', 'categoria'], dicaPagina: 'Abra a página de um curso ou categoria', disponivel: true },
  { id: 'correcao', grupo: 'Correção', nome: 'Correção', descricao: 'Lançar notas e feedback por CSV', origem: 'Importar Notas', icone: 'corr', modulo: 'importar-notas', comando: 'correcao.abrir', comandoRetomar: 'correcao.retomar', paginas: ['curso', 'categoria', 'atividade'], dicaPagina: 'Abra um curso, categoria ou atividade', disponivel: true },
  { id: 'acompanhamento', grupo: 'Alunos', nome: 'Acompanhamento', descricao: 'Alunos em risco e próxima ação', origem: 'Assistente EaD', icone: 'acomp', modulo: 'alunos', comando: 'alunos.abrir', args: { aba: 'acomp' }, disponivel: true },
  { id: 'alunos-notas', grupo: 'Alunos', nome: 'Alunos e notas', descricao: 'Lista de alunos e boletim', origem: 'Assistente EaD', icone: 'alun', modulo: 'alunos', comando: 'alunos.abrir', args: { aba: 'resumo' }, disponivel: true },
  { id: 'relatorio-uc', grupo: 'Alunos', nome: 'Relatório da UC', descricao: 'Desempenho geral da turma', origem: 'Assistente EaD', icone: 'rel', modulo: 'alunos', comando: 'alunos.abrir', args: { aba: 'relatorio' }, disponivel: true },
  { id: 'relatorio-turma', grupo: 'Alunos', nome: 'Relatório da turma', descricao: 'Várias UCs de uma vez, em Excel', origem: 'novo', icone: 'turma', modulo: 'alunos', comando: 'alunos.turma', paginas: ['meus-cursos'], dicaPagina: 'Abra a página “Meus cursos”', disponivel: true },
  { id: 'compat', gaveta: 'ferramentas', grupo: 'Ajuda e dados', nome: 'Compatibilidade', descricao: 'Verificar esta página (sem dados de aluno)', origem: 'novo', icone: 'diag', modulo: 'alunos', comando: 'sistema.compat', disponivel: true },
  { id: 'meus-dados', gaveta: 'ferramentas', grupo: 'Ajuda e dados', nome: 'Meus dados', descricao: 'Uso, backup, validade e apagar', origem: 'novo', icone: 'dados', modulo: 'alunos', comando: 'sistema.dados', disponivel: true },
  { id: 'sobre', gaveta: 'ferramentas', grupo: 'Ajuda e dados', nome: 'Sobre', descricao: 'Versão, novidades e atualização', origem: 'novo', icone: 'info', modulo: 'alunos', comando: 'sistema.sobre', disponivel: true },
  { id: 'kahoot', gaveta: 'ferramentas', grupo: 'Ferramentas', nome: 'Kahoot — importar perguntas', descricao: 'Planilha CSV no editor · create.kahoot.it', origem: 'SENAI Extensões', icone: 'kahoot', pagina: 'kahoot.html', mensagem: 'Abri a página do Kahoot em outra aba.', disponivel: true },
  { id: 'modelo-kahoot', gaveta: 'ferramentas', grupo: 'Ferramentas', nome: 'Modelo de perguntas (CSV)', descricao: 'Baixa a planilha-modelo, em qualquer página', origem: 'novo', icone: 'modelo', local: 'modelo-kahoot', disponivel: true },
  { id: 'ajustar-datas', gaveta: 'ferramentas', grupo: 'Ferramentas', nome: 'Ajustar datas do Moodle', descricao: 'Mover prazos de várias atividades', origem: 'novo', icone: 'rel', disponivel: false },
  { id: 'blocos', gaveta: 'ferramentas', grupo: 'Ferramentas', nome: 'Automação por blocos', descricao: 'Montar rotinas visualmente', origem: 'novo', icone: 'blo', disponivel: false }
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

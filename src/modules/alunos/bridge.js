// Ponte do módulo Alunos e notas: roda NA PÁGINA, depois dos scripts do módulo, só quando o usuário clica no menu.
// Abrir o painel não consulta o Moodle: a leitura só começa no botão "Ler" do painel.
(function (root) {
  'use strict';
  if (root.HUB_ALN) return;
  const ALN = root.ALN;
  const ABAS = ['alunos', 'notas', 'acomp', 'relatorio'];
  async function run(command, args) {
    switch (command) {
      case 'alunos.abrir': {
        const aba = ABAS.includes(args && args.aba) ? args.aba : 'alunos';
        ALN.ui.open(aba);
        return { aberto: true, mensagem: 'Painel aberto. Clique em “Ler” para buscar os dados do curso.' };
      }
      default: throw new Error(`Comando desconhecido: ${command}`);
    }
  }
  root.HUB_ALN = { run };
})(globalThis);

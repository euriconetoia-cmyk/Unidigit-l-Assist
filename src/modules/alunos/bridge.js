// Ponte do módulo Alunos e notas: roda NA PÁGINA, depois dos scripts do módulo, só quando o usuário clica no menu.
// Abrir o painel não consulta o Moodle: a leitura só começa no botão "Ler" do painel.
(function (root) {
  'use strict';
  if (root.HUB_ALN) return;
  const ALN = root.ALN;
  const ABAS = ['alunos', 'notas', 'acomp', 'relatorio'];
  async function run(command, args) {
    switch (command) {
      case 'sistema.compat': ALN.sistemaUi.open('compat'); return { aberto: true, mensagem: 'Diagnóstico aberto.' };
      case 'sistema.dados': ALN.sistemaUi.open('dados'); return { aberto: true, mensagem: 'Meus dados aberto.' };
      case 'sistema.sobre': ALN.sistemaUi.open('sobre'); return { aberto: true, mensagem: 'Sobre aberto.' };
      case 'alunos.abrir': {
        try { await ALN.storage.init(); } catch (_) { /* validade é conveniência; não bloqueia */ }
        const aba = ABAS.includes(args && args.aba) ? args.aba : 'alunos';
        ALN.ui.open(aba);
        return { aberto: true, mensagem: 'Painel aberto. Clique em “Ler” para buscar os dados do curso.' };
      }
      case 'alunos.turma': {
        ALN.turmaUi.open();
        return { aberto: true, mensagem: 'Escolha as unidades e clique em “Gerar relatório”.' };
      }
      default: throw new Error(`Comando desconhecido: ${command}`);
    }
  }
  root.HUB_ALN = { run };
})(globalThis);

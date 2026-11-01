// Ponte do módulo "Cronograma da turma": roda na aba do Moodle, só depois do clique no menu.
(function (root) {
  'use strict';
  if (root.HUB_CRN) return;
  const CRN = root.CRN;
  async function run(command) {
    if (command !== 'cronograma.abrir') throw new Error(`Comando desconhecido: ${command}`);
    if (!/\/course\/view\.php$/.test(root.location.pathname)) throw new Error('Abra a página principal do curso para usar o cronograma da turma.');
    CRN.ui.open();
    return { aberto: true, mensagem: 'Cronograma da turma aberto.' };
  }
  root.HUB_CRN = { run };
})(globalThis);

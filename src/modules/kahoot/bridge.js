// Ponte do módulo Kahoot: roda NA aba do editor, só depois da permissão opcional e do clique em "Preparar".
(function (root) {
  'use strict';
  if (root.HUB_KHT) return;
  const KHT = root.KHT;
  async function run(command) {
    switch (command) {
      case 'kahoot.abrir': KHT.ui.garantirBotao(); KHT.ui.open(); return { aberto: true, mensagem: 'Escolha o arquivo CSV de perguntas.' };
      case 'kahoot.botao': KHT.ui.garantirBotao(); return { aberto: true, mensagem: 'Botão “Importar!” colocado no editor.' };
      default: throw new Error(`Comando desconhecido: ${command}`);
    }
  }
  root.HUB_KHT = { run };
})(globalThis);

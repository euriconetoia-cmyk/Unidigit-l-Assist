// Ponte do módulo "Conferir datas": roda na aba do Moodle, só depois do clique no menu.
(function (root) {
  'use strict';
  if (root.HUB_DTS) return;
  const DTS = root.DTS;
  async function run(command) {
    switch (command) {
      case 'datas.abrir': {
        if (!/\/course\/view\.php$/.test(root.location.pathname)) throw new Error('Abra a página principal do curso (onde está o cronograma) para conferir as datas.');
        DTS.ui.open();
        return { aberto: true, mensagem: 'Conferir datas aberto.' };
      }
      case 'datas.retomar': return DTS.fluxo.retomar();
      default: throw new Error(`Comando desconhecido: ${command}`);
    }
  }
  root.HUB_DTS = { run };
})(globalThis);

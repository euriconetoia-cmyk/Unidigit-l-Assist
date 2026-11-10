// Ponte do módulo "Criar conteúdo": roda na aba do Moodle, só depois do clique no menu.
(function (root) {
  'use strict';
  if (root.HUB_CRI) return;
  const CRI = root.CRI;
  async function run(command) {
    switch (command) {
      case 'criar.abrir': {
        const id = CRI.core.cursoIdDaUrl(root.location.href);
        if (id) {
          const h1 = root.document.querySelector('.page-header-headings h1, #page-header h1, h1');
          const nome = (h1 && CRI.core.clean(h1.textContent)) || CRI.core.clean(root.document.title) || `Curso ${id}`;
          CRI.ui.open({ cursoAtual: { id, name: nome, category: '' } });
          return { aberto: true, mensagem: 'Criar conteúdo aberto.' };
        }
        if (!CRI.core.cursosDaPagina(root.document, root.location.origin).length) throw new Error('Abra a página de um curso, ou “Meus cursos” com os cursos na tela, para criar conteúdo.');
        CRI.ui.open({});
        return { aberto: true, mensagem: 'Criar conteúdo aberto.' };
      }
      default: throw new Error(`Comando desconhecido: ${command}`);
    }
  }
  root.HUB_CRI = { run };
})(globalThis);

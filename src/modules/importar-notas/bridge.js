// Ponte do módulo Importar Notas: roda NA PÁGINA do Moodle, depois dos scripts do módulo, só quando um bloco pede.
// Nada aqui consulta o Moodle sozinho: cada comando vem de um bloco em execução.
(function (root) {
  'use strict';
  if (root.HUB_IMN) return;
  const IMN = root.IMN;
  const state = { ui: null, panel: null };
  const CONTINUAR_KEY = 'hub.continuar.v1';

  function pageKind() {
    const url = new URL(root.location.href);
    if (/\/course\/view\.php$/.test(url.pathname)) return 'curso';
    if (/\/course\/index\.php$/.test(url.pathname) && url.searchParams.has('categoryid')) return 'categoria';
    if (/\/mod\/assign\/view\.php$/.test(url.pathname)) return 'atividade';
    return 'outra';
  }

  function ensureUi() {
    if (state.ui) return state.ui;
    const kind = pageKind();
    if (root.document.querySelector('.imn-bar')) throw new Error('A extensão Importar Notas original também está ativa nesta página. Desative-a em chrome://extensions para usar a versão deste menu.');
    if (kind === 'atividade') throw new Error('Pendências funciona em página de curso ou de categoria. Nesta atividade, use Correção.');
    if (kind === 'outra') throw new Error('Abra uma página de curso ou de categoria do Moodle para usar este bloco.');
    const deps = IMN.radar.createDeps(root);
    const ui = kind === 'curso' ? IMN.radar.initCourse(root.document, root, deps) : IMN.radar.initCategory(root.document, root, deps);
    if (!ui) throw new Error(kind === 'curso' ? 'Não identifiquei o número do curso nesta página. Abra a página inicial do curso (o endereço precisa ter ?id=).' : 'Não encontrei cursos nesta categoria.');
    if (IMN.batchUi) IMN.batchUi.init(root.document, root, deps, ui.bar);
    state.ui = ui;
    return ui;
  }

  // Tela de avaliação da atividade (mesmo painel "Importar notas" da extensão original).
  function gradingUrl() {
    const url = new URL(root.location.href);
    url.searchParams.set('action', 'grading');
    url.searchParams.delete('rownum');
    return url.href;
  }
  function ensurePanel() {
    if (state.panel) return state.panel;
    if (root.document.querySelector('#imn-root') && !state.panel) throw new Error('A extensão Importar Notas original também está ativa nesta página. Desative-a em chrome://extensions para usar a versão deste menu.');
    const entry = IMN.moodle.readiness(root.document, root.location);
    if (!entry.isGrading) throw new Error('Abra a tela de avaliação da atividade (Ver/avaliar todos os envios).');
    if (!entry.hasTable) throw new Error('Não encontrei a tabela de envios nesta página. Espere a página carregar e tente de novo.');
    const panel = IMN.panel.init(root.document, root);
    if (!panel) throw new Error('Não consegui montar o painel de notas nesta página.');
    state.panel = panel;
    return panel;
  }
  function continuarDepoisDeNavegar() {
    try { root.sessionStorage.setItem(CONTINUAR_KEY, JSON.stringify({ app: 'correcao', at: Date.now() })); } catch (_) { /* sem armazenamento: o usuário clica de novo */ }
  }

  const summarize = scan => {
    const parts = Array.isArray(scan) ? scan.map(r => r.summary || null) : [scan.summary];
    const known = parts.filter(Boolean);
    return {
      total: known.reduce((s, x) => s + x.total, 0),
      atividadesComPendencia: known.reduce((s, x) => s + x.activitiesPending, 0),
      naoVerificadas: known.reduce((s, x) => s + x.unverified, 0) + parts.filter(x => !x).length,
      semControle: known.reduce((s, x) => s + (x.noControl || 0), 0),
      parcial: parts.some(x => !x) || known.some(x => x.partial)
    };
  };

  async function run(command, args) {
    switch (command) {
      case 'pagina.info': return { tipo: pageKind(), titulo: root.document.title };
      case 'radar.buscar': {
        const ui = ensureUi();
        const scan = await ui.scan(true);
        if (!scan) throw new Error((ui.bar.status.textContent || '').trim() || 'Não consegui buscar as pendências nesta página.');
        return summarize(scan);
      }
      case 'radar.abrir': {
        const ui = ensureUi();
        if (ui.bar.show) ui.bar.show();
        ui.bar.el.scrollIntoView({ block: 'center' });
        ui.bar.refresh.focus();
        return { aberto: true, mensagem: 'Barra de pendências aberta. Clique na lupa para buscar.' };
      }
      case 'radar.baixar': {
        const ui = ensureUi();
        if (ui.bar.download.disabled) throw new Error('Não há o que baixar: use "buscar pendências" antes e confira se há envios a corrigir.');
        ui.bar.download.click();
        return { iniciado: true };
      }
      case 'correcao.abrir': {
        const kind = pageKind();
        if (kind === 'atividade') {
          const entry = IMN.moodle.readiness(root.document, root.location);
          if (!entry.isGrading) {
            continuarDepoisDeNavegar();
            root.setTimeout(() => root.location.assign(gradingUrl()), 50);
            return { navegando: true, mensagem: 'Abrindo a tela de avaliação desta atividade…' };
          }
          const panel = ensurePanel();
          panel.open();
          return { aberto: true, mensagem: 'Painel de importação de notas aberto.' };
        }
        return run('lote.abrir', args);
      }
      case 'correcao.retomar': { // depois de salvar no Moodle a página recarrega: relê e confere o que foi enviado
        if (pageKind() !== 'atividade') return { aberto: false, mensagem: '' };
        const entry = IMN.moodle.readiness(root.document, root.location);
        if (!entry.isGrading || !entry.hasTable) return { aberto: false, mensagem: '' };
        ensurePanel();
        return { aberto: true, mensagem: 'Conferência do que foi salvo.' };
      }
      case 'lote.abrir': {
        const ui = ensureUi();
        const button = ui.bar.el.querySelector('.imn-batch-open');
        if (!button) throw new Error('O lançamento de notas não está disponível nesta página.');
        button.click();
        return { aberto: true, mensagem: 'Janela de lançamento de notas aberta.' };
      }
      default: throw new Error(`Comando desconhecido: ${command}`);
    }
  }

  root.HUB_IMN = { run, version: 1 };
})(globalThis);

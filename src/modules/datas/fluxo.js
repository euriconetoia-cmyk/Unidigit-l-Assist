// Fluxo entre páginas: na edição da atividade preenche e avisa; ao voltar, relê e confere. Nunca clica em Salvar.
(function (root) {
  'use strict';
  const DTS = root.DTS; const C = DTS.core;

  const emEdicao = loc => { try { const u = new URL(loc.href); return /\/course\/modedit\.php$/.test(u.pathname) ? u.searchParams.get('update') : null; } catch (_) { return null; } };

  // Chamado pelo menu (retomar): decide o que fazer com a fila guardada.
  async function retomar() {
    const est = DTS.fila.ler();
    if (!est) return { aberto: false, mensagem: '' };
    const cmidAqui = emEdicao(root.location);
    const idx = DTS.fila.proximo(est);
    if (cmidAqui) {
      const item = est.itens.find(i => i.cmid === cmidAqui && i.estado === 'pendente');
      if (!item) return { aberto: false, mensagem: '' };
      const feitos = C.preencher(root.document, item.tipo, item.alvo);
      DTS.ui.bannerEdicao(item, feitos.length, est);
      return { aberto: true, mensagem: `Preenchi ${feitos.length} data(s). Confira e salve no Moodle.` };
    }
    if (est.fase !== 'salvar' || idx < 0) { if (est.fase === 'fim') { DTS.ui.resultado(est); return { aberto: true, mensagem: 'Resultado da conferência.' }; } return { aberto: false, mensagem: '' }; }
    // voltou da edição: relê a atividade pendente e confere com o esperado
    const item = est.itens[idx];
    try {
      const atual = await DTS.reader.lerAtividade(root.location.origin, item);
      const dif = C.diferencas(atual, item.alvo);
      item.estado = dif.length ? 'diferente' : 'conferido';
      item.detalhe = dif.length ? 'O Moodle não ficou igual ao cronograma (salvou?)' : '';
      item.lido = atual;
    } catch (e) { item.estado = 'erro'; item.detalhe = e && e.message ? e.message : String(e); }
    est.fase = DTS.fila.proximo(est) >= 0 ? 'resultado' : 'fim';
    DTS.fila.gravar(est);
    DTS.ui.resultado(est);
    return { aberto: true, mensagem: 'Conferência feita.' };
  }

  // Aplicar: guarda a fila e abre a edição da primeira (ou da próxima) atividade pendente.
  function irParaProxima(est) {
    const idx = DTS.fila.proximo(est); if (idx < 0) return false;
    est.fase = 'salvar'; DTS.fila.gravar(est);
    root.location.assign(DTS.reader.editUrl(root.location.origin, est.itens[idx].cmid));
    return true;
  }

  DTS.fluxo = { retomar, irParaProxima, emEdicao };
})(globalThis);

// Ações dos blocos de módulo: ligam o tipo de bloco ao comando do módulo.
export function makeActions({ getTab, host, log }) {
  const imn = async (command, args) => {
    const tab = await getTab();
    return host.call(tab.id, 'importar-notas', command, args);
  };
  return {
    imn_buscar: async (_values, ctx) => {
      log({ level: 'run', text: 'Buscando pendências…' });
      const result = await imn('radar.buscar');
      ctx.state.lastSearch = result;
      log({ level: result.parcial ? 'warn' : 'ok', text: `Busca concluída: ${result.total} pendência(s) em ${result.atividadesComPendencia} atividade(s)${result.parcial ? ` · PARCIAL (${result.naoVerificadas} não verificada(s))` : ''}.` });
    },
    imn_baixar: async () => {
      await imn('radar.baixar');
      log({ level: 'warn', text: 'Download iniciado. Confirme na barra da página do Moodle.' });
    },
    imn_abrir_lote: async () => {
      await imn('lote.abrir');
      log({ level: 'warn', text: 'Janela de lançamento aberta. Escolha o CSV e confirme na página.' });
    },
    imn_total: async (_values, ctx) => {
      if (!ctx.state.lastSearch) throw new Error('Use o bloco "buscar pendências" antes de ler o total.');
      return ctx.state.lastSearch.total;
    },
    imn_parcial: async (_values, ctx) => {
      if (!ctx.state.lastSearch) throw new Error('Use o bloco "buscar pendências" antes.');
      return Boolean(ctx.state.lastSearch.parcial);
    },
    imn_pagina: async () => (await imn('pagina.info')).tipo
  };
}

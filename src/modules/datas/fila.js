// Estado entre páginas (sessionStorage da aba): a fila de atividades a ajustar. Vale por 30 minutos; "Encerrar" apaga.
(function (root) {
  'use strict';
  const DTS = root.DTS; const KEY = 'hub.datas.v1'; const TTL = 30 * 60000;
  const store = () => { try { return root.sessionStorage; } catch (_) { return null; } };
  function ler(agora = Date.now()) {
    const s = store(); if (!s) return null;
    try { const x = JSON.parse(s.getItem(KEY) || 'null'); if (!x || x.v !== 1 || !Array.isArray(x.itens) || agora - x.at > TTL) { if (x) s.removeItem(KEY); return null; } return x; } catch (_) { return null; }
  }
  function gravar(estado, agora = Date.now()) { const s = store(); if (!s) throw new Error('Este navegador não permite guardar o andamento entre páginas.'); s.setItem(KEY, JSON.stringify({ ...estado, v: 1, at: agora })); }
  const limpar = () => { const s = store(); if (s) s.removeItem(KEY); };
  // itens: [{ cmid, nome, tipo, alvo, estado: 'pendente'|'conferido'|'diferente'|'erro', detalhe }]
  const proximo = e => e.itens.findIndex(i => i.estado === 'pendente');
  DTS.fila = { KEY, TTL, ler, gravar, limpar, proximo };
})(globalThis);

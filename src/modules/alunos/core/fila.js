// Fila de envio de mensagens: um aluno por vez, com pausa entre envios, conferência de cada um (feita por messenger.send),
// parada a qualquer momento e "tentar de novo" só para quem falhou. Lógica pura (sem DOM), testada em tests/fila.test.js.
// Regra: quem já está "enviada" NUNCA é reenviado; falhas em sequência interrompem a fila (ex.: sessão expirada).
(function (root) {
  'use strict';
  const ALN = root.ALN;
  const MAX_FALHAS_SEGUIDAS = 3;

  const novoItem = ({ key, name, userId, text }) => ({ key, name, userId, text, state: 'fila', error: '', out: null });
  const resumo = items => items.reduce((o, i) => { o[i.state] = (o[i.state] || 0) + 1; return o; }, { fila: 0, enviando: 0, enviada: 0, falhou: 0 });
  // Prepara a nova rodada: só as que falharam voltam para a fila.
  function prepararNovaTentativa(items) { items.forEach(i => { if (i.state === 'falhou') { i.state = 'fila'; i.error = ''; } }); return items; }

  // send({userId,text}) -> { at, msgid, confirmed, note }. Resultado: { parou, motivo }.
  async function runQueue({ items, send, onUpdate = () => {}, shouldStop = () => false, sleep = ms => new Promise(r => setTimeout(r, ms)), gapMs = 2000 }) {
    let seguidas = 0, first = true;
    for (const item of items) {
      if (item.state !== 'fila') continue;
      if (shouldStop()) return { parou: true, motivo: 'parada pelo usuário' };
      if (!first && gapMs > 0) await sleep(gapMs);
      if (shouldStop()) return { parou: true, motivo: 'parada pelo usuário' };
      first = false;
      item.state = 'enviando'; onUpdate(item);
      try {
        item.out = await send({ userId: item.userId, text: item.text });
        item.state = 'enviada'; item.error = ''; seguidas = 0;
      } catch (e) {
        item.state = 'falhou'; item.error = e && e.message ? e.message : String(e); seguidas += 1;
      }
      onUpdate(item);
      if (seguidas >= MAX_FALHAS_SEGUIDAS) return { parou: true, motivo: `${MAX_FALHAS_SEGUIDAS} falhas seguidas — confira a sessão do Moodle e tente de novo` };
    }
    return { parou: false, motivo: '' };
  }

  ALN.fila = { novoItem, resumo, prepararNovaTentativa, runQueue, MAX_FALHAS_SEGUIDAS };
})(globalThis);

// Resumo do dia: só agrega o que já foi lido/guardado. Puro (sem DOM).
(function (root) {
  'use strict';
  const ALN = root.ALN;

  // a_corrigir = null quando as entregas ainda não foram lidas (nunca vira zero).
  function resumir({ students = [], retornos = [], comparativo = null, readAt = null, settings = ALN.DEFAULTS, hojeISO, agora = Date.now() }) {
    const d = hojeISO || ALN.retornos.hojeISO();
    const imediato = settings.noAccessImmediateDays;
    const entregas = students.some(s => s.ov && s.ov.readEntregas);
    const c = ALN.retornos.classificar(retornos, d);
    return {
      alunos: students.length,
      riscoAlto: students.filter(s => s.risk && (s.risk.level === 'alto' || s.risk.level === 'imediato')).length,
      semAcesso: students.filter(s => s.lastAccessDays != null && s.lastAccessDays >= imediato).length,
      semAcessoDias: imediato,
      aCorrigir: entregas ? students.reduce((n, s) => n + (s.waitingCount || 0), 0) : null,
      retornosHoje: c.atrasados.length + c.hoje.length,
      piorou: comparativo ? comparativo.piorou : null,
      idadeDias: readAt ? Math.max(0, Math.floor((agora - readAt) / 86400000)) : null
    };
  }
  const idadeTexto = dias => (dias == null ? '' : dias === 0 ? 'lida hoje' : dias === 1 ? 'há 1 dia' : `há ${dias} dias`);

  ALN.resumo = { resumir, idadeTexto };
})(globalThis);

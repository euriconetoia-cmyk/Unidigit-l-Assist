// Régua de nota (0.16.0): muda só o VALOR SUGERIDO antes da prévia. Sem DOM. Nada é gravado sem a confirmação do painel.
// Regras: sem nota continua sem nota; nota com erro não é tocada; nunca passa da nota máxima; edição manual na tabela vale mais que a régua.
(function (root) {
  'use strict';
  const IMN = root.IMN;

  const passoDe = max => (Number.isFinite(max) && max > 20 ? 1 : 0.5);
  const arred = v => Math.round(v * 100) / 100;
  const REGUAS = [
    { id: 'nenhuma', rotulo: 'Sem régua (nota do arquivo)', ajustar: v => v },
    { id: 'proxima', rotulo: 'Arredondar ao mais próximo', ajustar: (v, p) => Math.round(v / p) * p },
    { id: 'generosa', rotulo: 'Generosa: arredondar para cima', ajustar: (v, p) => Math.ceil(v / p - 1e-9) * p },
    { id: 'inteira', rotulo: 'Muito generosa: próximo inteiro', ajustar: v => Math.ceil(v - 1e-9) }
  ];
  const byId = id => REGUAS.find(r => r.id === id) || REGUAS[0];

  // Devolve a nota (texto canônico) depois da régua, ou null se não se aplica.
  function ajustarNota(regua, value, max) {
    if (!Number.isFinite(value)) return null;
    const r = byId(regua);
    let novo = arred(r.ajustar(value, passoDe(max)));
    if (Number.isFinite(max)) novo = Math.min(novo, max);
    return novo === value ? null : String(novo);
  }

  // records (de IMN.records.parseRecords) → mesmos records, com grade ajustada e `reguaAntes` marcando o que mudou.
  function apply(records, regua, { max = null } = {}) {
    if (!regua || regua === 'nenhuma') return records;
    return records.map(record => {
      const g = record.grade;
      if (!g || !g.ok || g.empty || record.forceGrade) return record;
      const novo = ajustarNota(regua, g.value, max);
      if (novo === null) return record;
      const grade = IMN.grade.parseGrade(novo, { max });
      if (!grade.ok) return record;
      return { ...record, grade, reguaAntes: g.canonical };
    });
  }

  // Lista "Antes/Depois" para a prévia (só quem mudou). plan = resultado de IMN.plan.buildPlan.
  function previa(plan) {
    return plan.items.filter(i => i.record.reguaAntes !== undefined && i.row).map(i => ({
      nome: i.row.name, antes: i.record.reguaAntes, depois: i.record.grade.canonical, rowNumber: i.record.rowNumber
    }));
  }

  IMN.regua = { REGUAS, byId, ajustarNota, apply, previa, passoDe };
})(globalThis);

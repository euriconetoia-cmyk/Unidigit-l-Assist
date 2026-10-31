// Ajustes por UC (com padrão para todas). Puro, exceto carregar/gravar. Alimenta relatório, Acompanhamento, Excel e a fila.
(function (root) {
  'use strict';
  const ALN = root.ALN;
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

  // Campos editáveis: limites e padrão de fábrica. Fora do limite = valor recusado (nunca "corrigido" em silêncio).
  const CAMPOS = [
    { id: 'minimumGrade', rotulo: 'Nota mínima (média)', min: 1, max: 100, padrao: 60, passo: 1 },
    { id: 'recoveryMin', rotulo: 'Recuperação a partir de', min: 0, max: 99, padrao: 40, passo: 1 },
    { id: 'noAccessAttentionDays', rotulo: 'Dias sem acesso (atenção)', min: 1, max: 60, padrao: 7, passo: 1 },
    { id: 'pausaSeg', rotulo: 'Pausa entre mensagens (s)', min: 2, max: 30, padrao: 2, passo: 1 },
    { id: 'validadeLeiturasSem', rotulo: 'Validade das leituras (semanas, 0 = nunca)', min: 0, max: 104, padrao: 12, passo: 1 }
  ];
  const PADRAO = Object.freeze(Object.fromEntries(CAMPOS.map(c => [c.id, c.padrao])));

  const num = v => (typeof v === 'string' ? Number(v.replace(',', '.').trim() || NaN) : v);
  // Aceita só campos conhecidos e números dentro do limite. Devolve { valores, erros }.
  function validar(entrada) {
    const valores = {}; const erros = [];
    for (const c of CAMPOS) {
      if (!isObj(entrada) || !(c.id in entrada) || entrada[c.id] === '' || entrada[c.id] == null) continue;
      const v = num(entrada[c.id]);
      if (!Number.isFinite(v) || v < c.min || v > c.max) { erros.push(`${c.rotulo}: use um número de ${c.min} a ${c.max}.`); continue; }
      valores[c.id] = Math.round(v * 100) / 100;
    }
    const min = valores.minimumGrade ?? null; const rec = valores.recoveryMin ?? null;
    if (min != null && rec != null && rec >= min) erros.push('Recuperação a partir de deve ser menor que a nota mínima.');
    return { valores, erros };
  }

  const vazio = () => ({ padrao: {}, ucs: {} });
  function normalizar(store) {
    const out = vazio();
    if (!isObj(store)) return out;
    out.padrao = validar(store.padrao).valores;
    if (isObj(store.ucs)) for (const [k, v] of Object.entries(store.ucs)) { const x = validar(v).valores; if (Object.keys(x).length) out.ucs[k] = x; }
    return out;
  }

  // Valores efetivos da UC: fábrica < padrão do usuário < ajuste da UC.
  function resolver(store, courseKey) {
    const n = normalizar(store);
    const v = { ...PADRAO, ...n.padrao, ...((courseKey && n.ucs[courseKey]) || {}) };
    if (v.recoveryMin >= v.minimumGrade) v.recoveryMin = Math.max(0, v.minimumGrade - 1); // padrão novo + UC antiga: nunca invertido
    const high = Math.max(ALN.DEFAULTS.noAccessHighDays, v.noAccessAttentionDays + 3);
    const settings = {
      ...ALN.DEFAULTS, minimumGrade: v.minimumGrade, recoveryMin: v.recoveryMin, recoveryMax: Math.round((v.minimumGrade - 0.01) * 100) / 100,
      noAccessAttentionDays: v.noAccessAttentionDays, noAccessHighDays: high, noAccessImmediateDays: Math.max(ALN.DEFAULTS.noAccessImmediateDays, high + 5)
    };
    return { settings, pausaMs: v.pausaSeg * 1000, validadeLeiturasDias: v.validadeLeiturasSem * 7, valores: v, propria: Boolean(courseKey && n.ucs[courseKey]) };
  }

  // Grava só o que difere do padrão de fábrica/padrão do usuário; "vazio" apaga o ajuste da UC.
  function definir(store, courseKey, entrada) {
    const { valores, erros } = validar(entrada);
    if (erros.length) return { ok: false, erros, store };
    const n = normalizar(store);
    // Guarda só o que difere do valor herdado (fábrica ou padrão do usuário), para a UC continuar seguindo o padrão no resto.
    const herdado = courseKey ? { ...PADRAO, ...n.padrao } : PADRAO;
    for (const k of Object.keys(valores)) if (valores[k] === herdado[k]) delete valores[k];
    if (courseKey) { if (Object.keys(valores).length) n.ucs[courseKey] = valores; else delete n.ucs[courseKey]; } else n.padrao = valores;
    return { ok: true, erros: [], store: n };
  }
  const voltarAoPadrao = (store, courseKey) => { const n = normalizar(store); if (courseKey) delete n.ucs[courseKey]; else n.padrao = {}; return n; };

  async function carregar() { try { return normalizar(await ALN.storage.getKey(ALN.storage.K_AJUSTES)); } catch (_) { return vazio(); } }
  async function gravar(store) { await ALN.storage.setKey(ALN.storage.K_AJUSTES, normalizar(store)); }

  ALN.ajustes = { CAMPOS, PADRAO, validar, normalizar, resolver, definir, voltarAoPadrao, carregar, gravar };
})(globalThis);

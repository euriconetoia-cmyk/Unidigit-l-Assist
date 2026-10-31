// Retornos agendados ("ver este aluno de novo em…"). Só a chave do aluno e datas; nada de nome ou nota. Sem notificação: aparece nas telas.
(function (root) {
  'use strict';
  const ALN = root.ALN;
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hojeISO = (now = Date.now()) => iso(new Date(now));
  const valida = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !Number.isNaN(Date.parse(`${s}T12:00:00`));
  function somarDias(dataISO, n) { const d = new Date(`${dataISO}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); }
  const br = s => (valida(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');

  // lista de um curso → nova lista (não altera a original). Um aluno tem no máximo UM retorno aberto: o novo substitui.
  function agendar(lista, aluno, em, criado) {
    if (!aluno || !valida(em)) throw new Error('Data de retorno inválida.');
    return [...(lista || []).filter(r => !(r.aluno === aluno && !r.feito)), { aluno, em, criado: criado || em, feito: null }];
  }
  const abertos = lista => (lista || []).filter(r => !r.feito);
  // atrasados (data < hoje), hoje, próximos, ordenados por data
  function classificar(lista, hoje) {
    const ord = (a, b) => String(a.em).localeCompare(String(b.em));
    const a = abertos(lista);
    return { atrasados: a.filter(r => r.em < hoje).sort(ord), hoje: a.filter(r => r.em === hoje), proximos: a.filter(r => r.em > hoje).sort(ord) };
  }
  const devidos = (lista, hoje) => { const c = classificar(lista, hoje); return [...c.atrasados, ...c.hoje]; };
  const feito = (lista, aluno, quando) => (lista || []).map(r => (r.aluno === aluno && !r.feito ? { ...r, feito: quando } : r));
  const adiar = (lista, aluno, dias, hoje) => (lista || []).map(r => (r.aluno === aluno && !r.feito ? { ...r, em: somarDias(hoje, dias) } : r));
  // Opções do seletor "Ver de novo em": null = não agendar
  const OPCOES = [{ id: '3', rotulo: '3 dias', dias: 3 }, { id: '7', rotulo: '7 dias', dias: 7 }, { id: '14', rotulo: '14 dias', dias: 14 }, { id: 'data', rotulo: 'escolher data' }, { id: 'nao', rotulo: 'não agendar' }];

  async function doCurso(courseKey) { const m = await ALN.storage.getKey(ALN.storage.K_RETORNOS); return (m && Array.isArray(m[courseKey]) ? m[courseKey] : []); }
  async function gravar(courseKey, lista) {
    const m = (await ALN.storage.getKey(ALN.storage.K_RETORNOS)) || {};
    const out = { ...m }; if (lista.length) out[courseKey] = lista; else delete out[courseKey];
    await ALN.storage.setKey(ALN.storage.K_RETORNOS, out);
  }
  ALN.retornos = { hojeISO, somarDias, valida, br, agendar, abertos, classificar, devidos, feito, adiar, OPCOES, doCurso, gravar };
})(globalThis);

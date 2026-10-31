// Modelos de mensagem com campos ({nome}, {uc}, {nota}, {dias_sem_acesso}, {pendencias}). Só texto; guardados neste navegador.
// Campo sem dado para o aluno NÃO é substituído por vazio: a mensagem fica marcada como incompleta e o tutor decide.
(function (root) {
  'use strict';
  const ALN = root.ALN;
  const CAMPOS = ['nome', 'uc', 'nota', 'dias_sem_acesso', 'pendencias'];
  const MAX = 4000;
  const PADROES = [
    { id: 'sem-acesso', nome: 'Sem acesso há muitos dias', uso: null, texto: 'Olá, {nome}, tudo bem? Na UC {uc}, vi que o seu último acesso foi há {dias_sem_acesso} dias. Posso ajudar com alguma dificuldade? Responda esta mensagem.' },
    { id: 'nota-baixa', nome: 'Nota abaixo da média', uso: null, texto: 'Olá, {nome}, tudo bem? Na UC {uc}, a sua nota atual é {nota}, abaixo da média. Vamos conversar sobre como recuperar? Responda esta mensagem.' },
    { id: 'pendentes', nome: 'Atividades pendentes', uso: null, texto: 'Olá, {nome}, tudo bem? Na UC {uc}, ainda constam estas atividades sem entrega:\n{pendencias}\nSe tiver alguma dificuldade, responda esta mensagem.' }
  ];
  const USOS = [{ id: null, rotulo: 'não escolher sozinho' }, { id: 'sem-acesso', rotulo: 'quando o risco é por falta de acesso' }, { id: 'nota', rotulo: 'quando o risco é por nota' }];
  const RE = /\{([a-z_]+)\}/g;
  const campos = texto => [...new Set([...String(texto || '').matchAll(RE)].map(m => m[1]))];
  const desconhecidos = texto => campos(texto).filter(c => !CAMPOS.includes(c));
  const primeiroNome = nome => String(nome || '').trim().split(/\s+/)[0] || '';

  function validar(modelo) {
    const erros = [];
    if (!String(modelo && modelo.nome || '').trim()) erros.push('Dê um nome ao modelo.');
    const t = String(modelo && modelo.texto || '');
    if (!t.trim()) erros.push('O texto do modelo está vazio.');
    if (t.length > MAX) erros.push(`O texto passa de ${MAX} caracteres.`);
    const d = desconhecidos(t); if (d.length) erros.push(`Campo(s) que não existem: ${d.map(x => `{${x}}`).join(', ')}.`);
    return erros;
  }

  // ctx: { nome, uc, nota (texto|null), dias (número|null), pendencias ([texto]|null) }
  function render(texto, ctx) {
    const faltando = []; const c = ctx || {};
    const valores = {
      nome: primeiroNome(c.nome) || null, uc: c.uc ? String(c.uc) : null, nota: c.nota != null && c.nota !== '' ? String(c.nota) : null,
      dias_sem_acesso: c.dias != null && c.dias < 9999 ? String(c.dias) : null,
      pendencias: Array.isArray(c.pendencias) && c.pendencias.length ? c.pendencias.map(x => `• ${x}`).join('\n') : null
    };
    const out = String(texto || '').replace(RE, (m, k) => {
      if (!CAMPOS.includes(k)) return m;
      if (valores[k] == null) { if (!faltando.includes(k)) faltando.push(k); return m; }
      return valores[k];
    });
    return { texto: out, faltando, desconhecidos: desconhecidos(texto) };
  }

  // qual modelo o tutor deixou como padrão para este tipo de risco
  function sugerido(modelos, reasons) {
    const codes = new Set((reasons || []).map(r => r.code));
    const acesso = ['no_access_attention', 'no_access_high', 'no_access_immediate'].some(x => codes.has(x));
    const nota = ['grade_below_recovery', 'recovery_range', 'below_minimum'].some(x => codes.has(x));
    const uso = nota ? 'nota' : acesso ? 'sem-acesso' : null;
    return uso ? (modelos.find(m => m.uso === uso) || null) : null;
  }
  const novoId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  async function carregar() {
    const v = await ALN.storage.getKey(ALN.storage.K_MODELOS);
    return v && Array.isArray(v.itens) ? v.itens.filter(m => m && m.id && m.nome && typeof m.texto === 'string') : PADROES.map(m => ({ ...m }));
  }
  async function salvar(itens) { await ALN.storage.setKey(ALN.storage.K_MODELOS, { itens }); }

  ALN.modelos = { CAMPOS, PADROES, USOS, MAX, campos, desconhecidos, validar, render, sugerido, novoId, primeiroNome, carregar, salvar };
})(globalThis);

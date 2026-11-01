// Lê e confere o JSON do Cronograma EaD (formato "cronograma-ead-turma"). Funções puras.
(function (root) {
  'use strict';
  const CRN = root.CRN;
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const D = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
  const fmt = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
  const isoDe = d => d.toISOString().slice(0, 10);
  const somar = (iso, n) => { const d = D(iso); d.setUTCDate(d.getUTCDate() + n); return isoDe(d); };
  const dow = iso => D(iso).getUTCDay(); // 0 = domingo

  function ler(texto) {
    let j; try { j = JSON.parse(String(texto).replace(/^﻿/, '')); } catch (_) { return { ok: false, erro: 'O arquivo não é um JSON válido.' }; }
    if (!j || typeof j !== 'object' || j.formato !== 'cronograma-ead-turma') return { ok: false, erro: 'Este arquivo não é um cronograma da turma (formato “cronograma-ead-turma”).' };
    if (!Array.isArray(j.modulos) || !j.turma) return { ok: false, erro: 'O cronograma está incompleto (sem turma ou módulos).' };
    return { ok: true, dados: j };
  }

  function resumo(j) {
    const t = j.turma || {}, c = j.curso || {}, mo = t.moodle || {};
    const codigo = mo.codigo || t.evento || (j.entrada && j.entrada.evento) || '';
    const modelo = String(c.modeloCronograma || '');
    return { nome: t.nome || '', curso: c.nome || '', situacao: t.situacao || '', versao: t.versao || null, validacao: t.validacao || '', inicio: t.inicio || '', termino: t.terminoPrevisto || '', unidade: (t.unidade && t.unidade.nome) || '', codigoMoodle: String(codigo || ''), numeroTurma: mo.numeroTurma || '', modelo, aprendizagem: /aprend/i.test(modelo) || /aprend/i.test(c.categoria || ''), validado: /valid/i.test(t.situacao || '') };
  }

  // Itens do cronograma em ordem; "uc" é o que tem texto no Moodle.
  function itens(j) { const out = []; for (const m of j.modulos || []) for (const it of m.itens || []) out.push({ ...it, modulo: m.nome }); return out; }
  const ucs = j => itens(j).filter(i => i.tipo === 'uc');
  const feriados = j => new Set((j.feriados || []).map(f => f.data));

  function avisos(j) {
    const out = []; const f = feriados(j);
    const datas = (j.feriados || []).map(x => x.data + '|' + x.nome); const vistos = new Set();
    for (const x of j.feriados || []) { if (vistos.has(x.data + '|' + norm(x.nome))) out.push({ uc: '', texto: `Feriado repetido: ${fmt(x.data)} (${x.nome}).`, nivel: 'info' }); vistos.add(x.data + '|' + norm(x.nome)); }
    void datas;
    for (const it of itens(j)) {
      if (it.inicio && it.termino && it.inicio > it.termino) out.push({ uc: it.nome, texto: `${it.nome}: o início (${fmt(it.inicio)}) é depois do término (${fmt(it.termino)}).`, nivel: 'erro' });
      if (it.termino && it.terminoAva && it.termino > it.terminoAva) out.push({ uc: it.nome, texto: `${it.nome}: o término passa do fim do AVA.`, nivel: 'aviso' });
      (it.momentos || []).forEach((m, i) => {
        const n = i + 1;
        if (m.data && it.inicio && m.data < it.inicio) out.push({ uc: it.nome, texto: `${it.nome}: o encontro ${n} (${fmt(m.data)}) é anterior ao início da UC (${fmt(it.inicio)}).`, nivel: 'aviso' });
        if (m.data && it.termino && m.data > it.termino) out.push({ uc: it.nome, texto: `${it.nome}: o encontro ${n} (${fmt(m.data)}) é depois do término da UC (${fmt(it.termino)}).`, nivel: 'aviso' });
        if (m.data && f.has(m.data)) out.push({ uc: it.nome, texto: `${it.nome}: o encontro ${n} cai em feriado/férias (${fmt(m.data)}).`, nivel: 'aviso' });
        const w = m.webconferencia && m.webconferencia.data;
        if (w && m.data && w > m.data) out.push({ uc: it.nome, texto: `${it.nome}: a webconferência ${n} (${fmt(w)}) é depois do encontro (${fmt(m.data)}).`, nivel: 'aviso' });
      });
    }
    return out;
  }

  // "1037240 - Técnico em Informática para Internet - 00001/2026" → { codigo, curso, turma }
  function parseNomeCurso(txt) {
    const m = /^\s*(\S+)\s+-\s+(.+?)\s+-\s+(\d{1,6}\/\d{4})\s*$/.exec(String(txt || '').replace(/\s+/g, ' '));
    return m ? { codigo: m[1], curso: m[2], turma: m[3] } : null;
  }
  function ligar(res, nomeMoodle) {
    const p = parseNomeCurso(nomeMoodle);
    if (!p) return { nivel: 'nenhuma', motivo: 'Não consegui separar o nome do curso (código - curso - nº/ano).', parsed: null };
    const mesmoCodigo = res.codigoMoodle && norm(res.codigoMoodle) === norm(p.codigo);
    const mesmoCurso = norm(res.curso) && (norm(p.curso) === norm(res.curso));
    const mesmaTurma = !res.numeroTurma || norm(res.numeroTurma) === norm(p.turma);
    if (mesmoCodigo && mesmoCurso) return { nivel: 'alta', motivo: 'Código do Moodle e nome do curso conferem.', parsed: p };
    if (mesmoCodigo) return { nivel: 'media', motivo: 'O código confere, mas o nome do curso é diferente.', parsed: p };
    if (mesmoCurso && mesmaTurma) return { nivel: 'media', motivo: res.codigoMoodle ? 'O código é diferente; o nome do curso confere.' : 'O JSON não traz o código; o nome do curso confere.', parsed: p };
    return { nivel: 'nenhuma', motivo: 'Este curso do Moodle não parece ser a turma do arquivo.', parsed: p };
  }

  CRN.json = { norm, D, fmt, isoDe, somar, dow, ler, resumo, itens, ucs, feriados, avisos, parseNomeCurso, ligar };
})(globalThis);

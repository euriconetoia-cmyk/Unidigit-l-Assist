// Vigência de uma UC (curso do Moodle) a partir do que a página já mostra. Sem DOM e sem consulta.
// Regra: o período é do menor ao maior dia escrito nas seções/cabeçalho; sem período, vale o marcador "atual" do Moodle;
// sem nenhum dos dois, "não identificada". Nunca se presume "encerrada" sem data.
(function (root) {
  'use strict';

  const pad = n => String(n).padStart(2, '0');

  // "06/10", "6/10/26", "06/10/2026" → Date local à meia-noite; inválida = null.
  function parseDateText(text, defaultYear) {
    const m = String(text || '').match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (!m) return null;
    const day = Number(m[1]); const month = Number(m[2]);
    let year = m[3] ? Number(m[3]) : Number(defaultYear);
    if (m[3] && m[3].length === 2) year += 2000;
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(year, month - 1, day);
    return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }

  // Ano da turma no rótulo do cartão ("… - 00001/2026"); senão o ano de hoje.
  function yearFromText(text, today) {
    const m = String(text || '').match(/\b\d{3,6}\/(20\d{2})\b/);
    return m ? Number(m[1]) : today.getFullYear();
  }

  const fmt = date => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  const fmtShort = date => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;

  function periodFrom(info, cardText, today) {
    const year = yearFromText(cardText, today);
    const texts = [...(info.headerDateTexts || []), ...((info.sections || []).flatMap(s => s.dateTexts || []))];
    const dates = texts.map(t => parseDateText(t, year)).filter(Boolean).sort((a, b) => a - b);
    if (dates.length < 2) return null;
    return { start: dates[0], end: dates[dates.length - 1] };
  }

  // Período escrito no resumo do curso ("Período: 09/06/2026 a 06/11/2026"): vem do curso (info.periodo) ou do texto do cartão da categoria.
  const PERIODO = /per[ií]odo\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:a|à|até|ate|-|–|—)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i;
  function periodFromSummary(info, cardText, today) {
    let raw = info && info.periodo;
    if (!raw) { const m = String(cardText || '').replace(/\s+/g, ' ').match(PERIODO); raw = m ? { inicio: m[1], fim: m[2] } : null; }
    if (!raw) return null;
    const year = yearFromText(cardText, today);
    const start = parseDateText(raw.inicio, year), end = parseDateText(raw.fim, year);
    return start && end && start <= end ? { start, end } : null;
  }

  // → { state: 'vigente' | 'encerrada' | 'futura' | 'nao_identificada', start, end, label, reason }
  function classify(info, { today = new Date(), cardText = '' } = {}) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const declared = periodFromSummary(info, cardText, day);
    if (!info && !declared) return { state: 'nao_identificada', label: 'Vigência não identificada', reason: 'A página do curso não foi lida.' };
    const period = declared || periodFrom(info, cardText, day);
    if (period) {
      const range = `${fmtShort(period.start)} a ${fmt(period.end)}`;
      const source = declared ? 'Período informado no resumo do curso' : 'Datas lidas nas seções';
      if (day < period.start) return { state: 'futura', ...period, label: `Começa em ${fmt(period.start)}`, reason: `${source}: ${range}.` };
      if (day > period.end) return { state: 'encerrada', ...period, label: `Encerrada em ${fmt(period.end)}`, reason: `${source}: ${range}.` };
      return { state: 'vigente', ...period, label: `UC vigente · ${range}`, reason: `Hoje está dentro do período (${source.toLowerCase()}): ${range}.` };
    }
    const current = ((info && info.sections) || []).find(s => s.current && !s.hidden);
    if (current) return { state: 'vigente', label: 'UC vigente · seção atual marcada', reason: `O Moodle marca "${current.title}" como seção atual; sem datas para confirmar o período.` };
    return { state: 'nao_identificada', label: 'Vigência não identificada', reason: 'Não há duas datas nas seções nem seção atual marcada.' };
  }

  root.IMN.vigencia = { parseDateText, yearFromText, periodFromSummary, classify };
})(globalThis);

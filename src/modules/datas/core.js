// Parte pura (sem rede): ler o cronograma, emparelhar nomes, ler/preencher os campos de data do formulário e comparar.
// Datas são { y, m, d } e horas { h, mi } em horário local do Moodle: nada de fuso nem de Date com hora.
(function (root) {
  'use strict';
  const DTS = root.DTS;
  const clean = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const norm = s => clean(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const pad = n => String(n).padStart(2, '0');

  // Quais campos de data cada tipo de atividade tem, e qual papel o cronograma dá a cada um.
  const CAMPOS = {
    assign: { inicio: 'allowsubmissionsfromdate', termino: 'duedate', limite: 'cutoffdate', lembrete: 'gradingduedate' },
    quiz: { inicio: 'timeopen', termino: 'timeclose' }
  };
  const ROTULO = {
    allowsubmissionsfromdate: 'Permite envios a partir de', duedate: 'Data de entrega', cutoffdate: 'Data limite', gradingduedate: 'Lembre-me de avaliar por',
    timeopen: 'Abertura do questionário', timeclose: 'Fechamento do questionário'
  };
  const TIPOS = { assign: 'tarefa', quiz: 'questionário' };

  const validaData = (y, m, d) => { if (!(y >= 1900 && y <= 2050 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return false; const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };
  const fmtData = x => (x ? `${pad(x.d)}/${pad(x.m)}/${x.y}` : '');
  const fmtHora = x => (x ? `${pad(x.h)}:${pad(x.mi)}` : '');
  const fmtTudo = x => (x && x.on ? `${fmtData(x)} ${fmtHora(x)}` : '');
  const diaSemana = x => new Date(Date.UTC(x.y, x.m - 1, x.d)).getUTCDay(); // 0 = domingo
  const somarDias = (x, n) => { const t = new Date(Date.UTC(x.y, x.m - 1, x.d + n)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; };
  const cmpData = (a, b) => (a.y - b.y) || (a.m - b.m) || (a.d - b.d);

  // "29/10/2026" ou "29/10/26" → { y, m, d } ou null. Só aceita data inteira e real.
  function parseData(texto) {
    const m = clean(texto).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const x = { y: Number(m[3]), m: Number(m[2]), d: Number(m[1]) };
    return validaData(x.y, x.m, x.d) ? x : null;
  }
  // "23:59", "23h59", "19h" → { h, mi } ou null
  function parseHora(texto) {
    const m = clean(texto).match(/^(\d{1,2})\s*(?:[:h]\s*(\d{2})?)\s*$/i);
    if (!m) return null;
    const h = Number(m[1]); const mi = m[2] === undefined ? 0 : Number(m[2]);
    return h <= 23 && mi <= 59 ? { h, mi } : null;
  }

  // ---------- cronograma ----------
  // Procura tabelas com colunas "Início" e "Término". Linha com duas datas = comparável; "A definir" = sem data.
  function lerCronograma(doc) {
    const entradas = []; const vistos = new Set(); let informativas = 0;
    doc.querySelectorAll('table').forEach(tabela => {
      const cab = [...tabela.querySelectorAll('th')].map(th => norm(th.textContent));
      if (!cab.some(c => c.startsWith('inicio')) || !cab.some(c => c.startsWith('termino'))) return;
      tabela.querySelectorAll('tr').forEach(tr => {
        const cels = [...tr.querySelectorAll('td')].map(td => clean(td.textContent));
        if (cels.length < 2 || !cels[0]) return;
        const nome = cels[0];
        const datas = cels.slice(1).map(c => c.match(/\d{1,2}\/\d{1,2}\/\d{4}/)).filter(Boolean).map(m => parseData(m[0])).filter(Boolean);
        const hora = cels.slice(1).map(c => c.match(/^(\d{1,2}):(\d{2})$/)).filter(Boolean).map(m => parseHora(m[0])).find(Boolean) || null;
        const k = norm(nome); if (vistos.has(k)) return;
        if (datas.length >= 2) { vistos.add(k); entradas.push({ nome, inicio: datas[0], termino: datas[1], hora, semData: false }); }
        else if (!datas.length && cels.slice(1).some(c => /a definir/i.test(c))) { vistos.add(k); entradas.push({ nome, inicio: null, termino: null, hora: null, semData: true }); }
        else informativas += 1;
      });
    });
    return { entradas, informativas };
  }

  // ---------- nomes ----------
  const PARADAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'para']);
  const tokens = s => norm(s).replace(/\b0+(\d)/g, '$1').split(/[^a-z0-9]+/).filter(t => t && !PARADAS.has(t));
  function similaridade(a, b) {
    const A = new Set(tokens(a)), B = new Set(tokens(b));
    if (!A.size || !B.size) return 0;
    const inter = [...A].filter(t => B.has(t)).length;
    if (inter === A.size && inter === B.size) return 1;
    if (inter === Math.min(A.size, B.size) && Math.min(A.size, B.size) >= 2) return 0.85; // "SAP 01" dentro de "Envio da SAP 01"
    return inter / (A.size + B.size - inter);
  }
  // Pares 1 para 1, do mais parecido ao menos. Devolve, para cada atividade, o índice da entrada (ou -1).
  function emparelhar(atividades, entradas, minimo = 0.7) {
    const cand = [];
    atividades.forEach((a, i) => entradas.forEach((e, j) => { const s = similaridade(a.nome, e.nome); if (s >= minimo) cand.push({ i, j, s }); }));
    cand.sort((x, y) => y.s - x.s);
    const par = atividades.map(() => -1); const usada = new Set();
    for (const c of cand) if (par[c.i] === -1 && !usada.has(c.j)) { par[c.i] = c.j; usada.add(c.j); }
    return par;
  }

  // ---------- formulário de edição da atividade ----------
  const el = (doc, name) => doc.querySelector(`[name="${name}"]`);
  // Lê um campo de data: { on, y, m, d, h, mi }. Sem "Habilitar" marcado = sem data (os seletores mostram só a hora de agora).
  function lerCampo(doc, campo) {
    const en = el(doc, `${campo}[enabled]`);
    const v = k => { const s = el(doc, `${campo}[${k}]`); return s ? Number(s.value) : NaN; };
    const x = { on: en ? Boolean(en.checked) : true, y: v('year'), m: v('month'), d: v('day'), h: v('hour'), mi: v('minute') };
    if ([x.y, x.m, x.d, x.h, x.mi].some(Number.isNaN)) return null;
    return x;
  }
  function lerCampos(doc, tipo) {
    const out = {};
    for (const [papel, campo] of Object.entries(CAMPOS[tipo] || {})) { const x = lerCampo(doc, campo); if (x) out[papel] = x; }
    return out;
  }
  // Preenche (sem salvar). Marca "Habilitar" com um clique de verdade (o Moodle libera os seletores nesse evento).
  function preencher(doc, tipo, alvo) {
    const Ev = doc.defaultView.Event; const feitos = [];
    for (const [papel, v] of Object.entries(alvo)) {
      const campo = CAMPOS[tipo][papel]; if (!campo) continue;
      const en = el(doc, `${campo}[enabled]`);
      if (en && !en.checked) en.click();
      for (const [k, val] of [['day', v.d], ['month', v.m], ['year', v.y], ['hour', v.h], ['minute', v.mi]]) {
        const s = el(doc, `${campo}[${k}]`);
        if (!s) throw new Error(`Não achei o campo “${ROTULO[campo]}” (${k}) nesta tela.`);
        s.disabled = false; s.value = String(val);
        if (Number(s.value) !== val) throw new Error(`O valor ${val} não existe em “${ROTULO[campo]}” (${k}).`);
        s.dispatchEvent(new Ev('change', { bubbles: true }));
      }
      feitos.push(campo);
    }
    return feitos;
  }

  // ---------- comparar ----------
  const ehHora = (a, b) => a.h === b.h && a.mi === b.mi;
  // início: só o dia conta (a hora de abertura pode ser outra); demais: dia e hora
  const igual = (papel, atual, alvo) => Boolean(atual && atual.on) && cmpData(atual, alvo) === 0 && (papel === 'inicio' || ehHora(atual, alvo));

  // ed: { inicio, termino } (datas) e hora (ou null = 23:59). regras: { limite, lembrete } (só tarefa)
  function montarAlvo(ed, tipo, atual, regras = {}) {
    const alvo = {}; const hora = ed.hora || { h: 23, mi: 59 };
    const campos = CAMPOS[tipo] || {};
    if (campos.inicio && ed.inicio) { const a = atual && atual.inicio; alvo.inicio = { ...ed.inicio, h: a && a.on ? a.h : 0, mi: a && a.on ? a.mi : 0 }; }
    if (campos.termino && ed.termino) {
      alvo.termino = { ...ed.termino, ...hora };
      if (campos.limite && regras.limite) alvo.limite = { ...ed.termino, ...hora };
      if (campos.lembrete && regras.lembrete) alvo.lembrete = { ...somarDias(ed.termino, 7), ...hora };
    }
    return alvo;
  }
  const diferencas = (atual, alvo) => Object.entries(alvo).filter(([papel, v]) => !igual(papel, atual[papel], v)).map(([papel]) => papel);
  // Avisos humanos sobre o alvo (não impedem; "ordem" impede)
  function avisos(alvo) {
    const out = [];
    if (alvo.inicio && alvo.termino && cmpData(alvo.inicio, alvo.termino) > 0) out.push({ tipo: 'ordem', texto: 'O término é anterior ao início.' });
    for (const [papel, v] of Object.entries(alvo)) if (diaSemana(v) === 0) out.push({ tipo: 'domingo', texto: `${fmtData(v)} cai num domingo.` });
    return out;
  }

  DTS.core = { CAMPOS, ROTULO, TIPOS, clean, norm, parseData, parseHora, fmtData, fmtHora, fmtTudo, validaData, diaSemana, somarDias, cmpData, lerCronograma, similaridade, emparelhar, lerCampo, lerCampos, preencher, igual, montarAlvo, diferencas, avisos };
})(globalThis);

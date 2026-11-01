// Textos (rótulos) do curso: acha o cabeçalho e o "Cronograma completo da UC" e troca SÓ as datas. Funções puras sobre HTML.
(function (root) {
  'use strict';
  const CRN = root.CRN; const J = CRN.json;
  const DATA_RE = /\d{2}\/\d{2}\/\d{4}/;
  const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const celulas = tr => [...tr.querySelectorAll('td')];

  function parse(html) { const doc = new root.DOMParser().parseFromString(`<body><div id="r">${html}</div></body>`, 'text/html'); return doc.getElementById('r'); }

  // Tipo do texto e nome da UC citado nele.
  function classificar(html) {
    const r = typeof html === 'string' ? parse(html) : html; const t = clean(r.textContent);
    if (/per[ií]odo de realiza[cç][aã]o/i.test(t)) {
      let uc = ''; r.querySelectorAll('span').forEach(s => { const m = /^UC\s*\d*\s*[–—-]\s*(.+)$/i.exec(clean(s.textContent)); if (m && !uc) uc = m[1]; });
      return { tipo: 'cabecalho', uc };
    }
    if (/cronograma de atividades/i.test(t)) { const h = r.querySelector('h2'); return { tipo: 'cronograma', uc: h ? clean(h.textContent) : '' }; }
    return { tipo: '', uc: '' };
  }

  // Webaulas pelo dia da semana (0 = domingo … 6 = sábado). passo = a cada N semanas.
  function gerarWebaulas({ inicio, termino, dia, passo = 1, feriados = new Set(), pular = true }) {
    const out = []; if (!inicio || !termino) return out;
    let d = inicio; let guarda = 0;
    while (J.dow(d) !== Number(dia) && guarda++ < 8) d = J.somar(d, 1);
    guarda = 0;
    while (d <= termino && guarda++ < 400) { if (!(pular && feriados.has(d))) out.push(d); d = J.somar(d, 7 * Math.max(1, Number(passo) || 1)); }
    return out;
  }

  // Datas do cronograma para uma UC: { inicio, termino, encontros:[iso], webaulas:[{data, ini?, fim?}] }.
  function alvoDaUc(uc, opcoes = {}) {
    const enc = (uc.momentos || []).filter(m => m.data).map(m => m.data);
    const web = opcoes.webaulas || (uc.momentos || []).filter(m => m.webconferencia && m.webconferencia.data).map(m => ({ data: m.webconferencia.data }));
    return { inicio: uc.inicio, termino: uc.termino, encontros: enc, webaulas: web, diasAntes: opcoes.diasAntes == null ? 2 : opcoes.diasAntes };
  }

  // Ajusta as linhas de uma tabela de lista (webaulas/encontros): acrescenta clonando a última ou remove as que sobram.
  function ajustarLinhas(tbody, n, nome, log, rotulo) {
    const linhas = () => [...tbody.querySelectorAll('tr')];
    if (!linhas().length || n < 0) return;
    while (linhas().length < n) { const ult = linhas()[linhas().length - 1]; const novo = ult.cloneNode(true); const alt = linhas().length; novo.style.background = alt % 2 ? '#f5f8fb' : '#fff'; tbody.append(novo); const c = celulas(novo); if (c[0]) c[0].textContent = `${nome} ${alt + 1}`; log.push({ rotulo: `${rotulo} · linha nova`, de: '—', para: `${nome} ${alt + 1}` }); }
    while (linhas().length > n) { const ult = linhas()[linhas().length - 1]; log.push({ rotulo: `${rotulo} · linha removida`, de: clean(celulas(ult)[0] && celulas(ult)[0].textContent), para: '—' }); ult.remove(); }
  }

  // Devolve { html, mudancas:[{rotulo,de,para}] } — só datas (e horários das webaulas se informados) mudam.
  function ajustar(html, alvo) {
    const r = parse(html); const log = []; const { tipo } = classificar(r);
    const set = (el, v, rotulo) => { const atual = clean(el.textContent); if (atual !== v) { log.push({ rotulo, de: atual, para: v }); el.textContent = v; } };
    // Período (cabeçalho e topo do cronograma): "dd/mm/aaaa a dd/mm/aaaa"
    if (alvo.inicio && alvo.termino) {
      const novo = `${J.fmt(alvo.inicio)} a ${J.fmt(alvo.termino)}`;
      const w = r.ownerDocument.createTreeWalker(r, 4); let n; const nos = []; while ((n = w.nextNode())) nos.push(n);
      for (const no of nos) { const m = /(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/.exec(no.nodeValue); if (m && m[0] !== novo) { log.push({ rotulo: 'Período', de: m[0], para: novo }); no.nodeValue = no.nodeValue.replace(m[0], novo); } }
    }
    if (tipo === 'cronograma') {
      r.querySelectorAll('table').forEach(t => {
        const cab = [...t.querySelectorAll('th')].map(x => clean(x.textContent).toLowerCase());
        const tbody = t.querySelector('tbody') || t;
        if (cab[0] === 'webaula' && alvo.webaulas) {
          ajustarLinhas(tbody, alvo.webaulas.length, 'Webaula', log, 'Webaulas');
          [...tbody.querySelectorAll('tr')].forEach((tr, i) => { const c = celulas(tr); const w = alvo.webaulas[i]; if (!w) return; set(c[1], J.fmt(w.data), `Webaula ${i + 1} · data`); if (w.ini && c[2]) set(c[2], w.ini, `Webaula ${i + 1} · início`); if (w.fim && c[3]) set(c[3], w.fim, `Webaula ${i + 1} · término`); });
        } else if (cab[0] === 'encontro' && alvo.encontros && alvo.encontros.length) {
          ajustarLinhas(tbody, alvo.encontros.length, 'Encontro', log, 'Encontros');
          [...tbody.querySelectorAll('tr')].forEach((tr, i) => { const c = celulas(tr); if (alvo.encontros[i] && c[1]) set(c[1], J.fmt(alvo.encontros[i]), `Encontro ${i + 1} · data`); });
        } else if (cab[0] === 'atividade') {
          [...tbody.querySelectorAll('tr')].forEach(tr => {
            const c = celulas(tr); if (c.length < 3) return; const nome = clean(c[0].textContent);
            if (/momento presencial/i.test(nome)) { if (alvo.encontros && alvo.encontros.length) { set(c[1], J.fmt(alvo.encontros[0]), 'Momento Presencial · início'); set(c[2], J.fmt(alvo.encontros[alvo.encontros.length - 1]), 'Momento Presencial · término'); } return; }
            if (alvo.diasAntes != null && alvo.encontros && alvo.encontros.length && DATA_RE.test(c[1].textContent) && DATA_RE.test(c[2].textContent)) {
              set(c[1], J.fmt(alvo.inicio), `${nome} · início`); set(c[2], J.fmt(J.somar(alvo.encontros[0], -alvo.diasAntes)), `${nome} · término`);
            }
          });
        }
      });
    }
    return { html: r.innerHTML, mudancas: log, tipo };
  }

  CRN.textos = { classificar, gerarWebaulas, alvoDaUc, ajustar, clean, parse };
})(globalThis);

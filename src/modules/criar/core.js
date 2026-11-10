// Criar conteúdo — parte pura (sem rede): modelos, campos {{assim}}, HTML seguro, leitura e montagem do formulário do Moodle.
// Testada com jsdom em tests/criar.test.js. Nada aqui grava nada: quem envia é api.js, depois da prévia e do clique do usuário.
(function (root) {
  'use strict';
  const CRI = root.CRI;
  const clean = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const fold = t => clean(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');

  // Modelos iniciais. Os campos {{uc}}, {{turma}}, {{tutor}}, {{abertura}} e {{prazo}} são preenchidos sozinhos; os outros o tutor preenche.
  const MODELOS = {
    forum: {
      id: 'forum', modname: 'forum', icone: 'F', titulo: 'Fórum de apresentação', descricao: 'Cada aluno abre um tópico se apresentando.',
      nome: 'Fórum de apresentação',
      texto: '<p>Bem-vindo(a) à turma de <b>{{uc}}</b>! Apresente-se aos colegas: conte seu nome, de onde fala, o que espera do curso e uma curiosidade sobre você.</p><p>Responda também a pelo menos duas apresentações dos colegas. Tutor(a): {{tutor}}.</p>',
      resumo: [['Tipo', 'Cada pessoa inicia um tópico']]
    },
    envio: {
      id: 'envio', modname: 'assign', icone: 'A', titulo: 'Atividade de envio', descricao: 'Envio de arquivo com prazo, nota e avaliação.',
      nome: 'Atividade 1 — Entrega',
      texto: '<p>Leia o enunciado, desenvolva o que foi pedido e envie em um único arquivo (PDF ou DOCX).</p><p>Disponível a partir de <b>{{abertura}}</b>. Prazo de entrega: <b>{{prazo}}</b>.</p><p>Dúvidas? Fale com o(a) tutor(a) {{tutor}}.</p>',
      resumo: [['Tipo de envio', 'Arquivo (1 arquivo)']]
    },
    boas: {
      id: 'boas', modname: 'label', icone: 'T', titulo: 'Texto de boas-vindas', descricao: 'Área de texto no topo do curso.',
      nome: 'Boas-vindas',
      texto: '<p><b>Seja bem-vindo(a) a {{uc}}!</b></p><p>Aqui você encontra o cronograma, as atividades e os canais de apoio. Em caso de dúvida, procure o(a) tutor(a) {{tutor}} pelo fórum de dúvidas.</p>',
      resumo: [['Tipo', 'Área de texto e mídia']]
    }
  };

  // ---- Campos {{nome}} ----
  const RE_CAMPO = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
  function campos(texto) { const out = []; String(texto || '').replace(RE_CAMPO, (_, n) => { const k = n.toLowerCase(); if (!out.includes(k)) out.push(k); return ''; }); return out; }
  // Valores entram como TEXTO (escapados): quem preenche um campo nunca injeta HTML.
  function preencher(texto, valores) {
    const v = {}; Object.keys(valores || {}).forEach(k => { v[k.toLowerCase()] = valores[k]; });
    const faltando = [];
    const html = String(texto || '').replace(RE_CAMPO, (m, n) => { const k = n.toLowerCase(); const x = v[k]; if (x == null || clean(x) === '') { if (!faltando.includes(k)) faltando.push(k); return m; } return esc(x); });
    return { html, faltando };
  }

  // ---- HTML seguro (modelos importados e texto digitado) ----
  const PERMITIDAS = new Set(['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span', 'blockquote', 'hr']);
  const DESCARTAR = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input', 'button', 'select', 'textarea', 'svg', 'math', 'img', 'video', 'audio', 'noscript', 'template', 'title', 'head']);
  function limpar(no, doc) {
    [...no.childNodes].forEach(c => {
      if (c.nodeType === 3) return;
      if (c.nodeType !== 1) { c.remove(); return; }
      const tag = c.tagName.toLowerCase();
      if (DESCARTAR.has(tag)) { c.remove(); return; }
      limpar(c, doc);
      if (!PERMITIDAS.has(tag)) { while (c.firstChild) no.insertBefore(c.firstChild, c); c.remove(); return; }
      [...c.attributes].forEach(a => {
        const n = a.name.toLowerCase();
        if (tag === 'a' && n === 'href' && /^(https?:|mailto:)/i.test(a.value.trim())) return;
        if ((tag === 'td' || tag === 'th') && (n === 'colspan' || n === 'rowspan') && /^\d{1,2}$/.test(a.value)) return;
        c.removeAttribute(a.name);
      });
      if (tag === 'a') { c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener noreferrer'); }
    });
  }
  // Devolve o HTML limpo (string) — só tags de texto simples, sem scripts, estilos, imagens nem eventos.
  function sanitizar(html) {
    const doc = new root.DOMParser().parseFromString(`<!doctype html><body>${String(html || '')}</body>`, 'text/html');
    limpar(doc.body, doc);
    return doc.body.innerHTML.trim();
  }

  // ---- Datas ----
  function partesData(d) { return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear(), hour: d.getHours(), minute: d.getMinutes() }; }
  const fmtData = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  // "2026-11-24T23:59" (campo datetime-local) → Date local; vazio ou inválido → null
  function lerLocal(s) { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(s || '')); if (!m) return null; const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]); return Number.isNaN(d.getTime()) ? null : d; }

  // ---- Formulário do Moodle ----
  const NAO_ENVIA = new Set(['submit', 'button', 'image', 'reset', 'file']);
  // Pares [nome, valor] como o navegador enviaria (desabilitados e não marcados ficam de fora).
  function coletar(form) {
    const pares = [];
    [...form.elements].forEach(el => {
      const name = el.getAttribute('name'); if (!name || el.disabled) return;
      const tag = el.tagName.toLowerCase(); const type = (el.getAttribute('type') || '').toLowerCase();
      if (tag === 'input') {
        if (NAO_ENVIA.has(type)) return;
        if ((type === 'checkbox' || type === 'radio') && !el.checked) return;
        pares.push([name, el.value]);
      } else if (tag === 'select') {
        if (el.multiple) [...el.options].filter(o => o.selected).forEach(o => pares.push([name, o.value]));
        else { const o = el.options[el.selectedIndex] || [...el.options].find(x => x.selected) || el.options[0]; if (o) pares.push([name, o.value]); }
      } else if (tag === 'textarea') pares.push([name, el.value]);
    });
    return pares;
  }
  function definir(pares, nome, valor) { const i = pares.findIndex(p => p[0] === nome); if (i >= 0) { pares[i][1] = String(valor); } else pares.push([nome, String(valor)]); }
  const tem = (pares, nome) => pares.some(p => p[0] === nome);
  const opcoes = (form, nome) => { const s = form.elements[nome]; return s && s.options ? [...s.options].map(o => o.value) : null; };
  function achaForm(doc) { return doc.querySelector('form.mform') || doc.querySelector('form#mform1') || doc.querySelector('form[action*="modedit.php"]'); }

  // Campos de data do Moodle (date_time_selector): dia, mês, ano, hora, minuto e a caixa "habilitar".
  function dataNoForm(form, pares, base, d, avisos) {
    const o = opcoes(form, `${base}[year]`);
    if (!o) { avisos.push(`Campo de data "${base}" não encontrado neste Moodle.`); return false; }
    const p = partesData(d);
    if (!o.includes(String(p.year))) { avisos.push(`O Moodle não aceita o ano ${p.year} em "${base}".`); return false; }
    // campos desabilitados saem de coletar(); aqui entram todos com os valores novos
    ['day', 'month', 'year', 'hour', 'minute'].forEach(k => definir(pares, `${base}[${k}]`, p[k]));
    definir(pares, `${base}[enabled]`, 1);
    return true;
  }

  // dados: { nome, html, visivelOculto:true, abertura?:Date, prazo?:Date }
  // Devolve { pares, avisos } ou { erro }. Só monta; nunca envia. Se não der para garantir "oculto", recusa.
  function montarEnvio(form, modelo, dados) {
    const avisos = []; const pares = coletar(form);
    if (!form.elements['introeditor[text]'] && !tem(pares, 'introeditor[text]')) return { erro: 'Não achei o campo de texto (introeditor) no formulário deste Moodle.' };
    definir(pares, 'introeditor[text]', dados.html); definir(pares, 'introeditor[format]', 1);
    if (modelo.modname !== 'label') {
      if (!tem(pares, 'name') && !form.elements.name) return { erro: 'Não achei o campo "Nome" no formulário deste Moodle.' };
      definir(pares, 'name', dados.nome);
    } else if (form.elements.name) definir(pares, 'name', dados.nome);
    const vis = opcoes(form, 'visible');
    if (!vis || !vis.includes('0')) return { erro: 'Não achei a opção "Ocultar" no formulário. Por segurança, nada foi criado.' };
    definir(pares, 'visible', 0);
    if (modelo.modname === 'forum') {
      const t = opcoes(form, 'type');
      if (t && t.includes('eachuser')) definir(pares, 'type', 'eachuser'); else avisos.push('Tipo de fórum "cada pessoa inicia um tópico" não existe neste Moodle: ficou o padrão.');
    }
    if (modelo.modname === 'assign') {
      if (!dados.prazo) return { erro: 'Informe o prazo de entrega.' };
      const ab = dados.abertura || new Date(); if (dados.prazo <= ab) return { erro: 'O prazo precisa ser depois da abertura.' };
      if (!dataNoForm(form, pares, 'allowsubmissionsfromdate', ab, avisos) || !dataNoForm(form, pares, 'duedate', dados.prazo, avisos)) return { erro: avisos.join(' ') || 'Datas não aplicadas.' };
      // O Moodle recusa "lembrete de correção" antes do prazo: se vier ligado, empurra para 7 dias depois do prazo.
      if (tem(pares, 'gradingduedate[enabled]')) { const g = new Date(dados.prazo.getTime() + 7 * 864e5); dataNoForm(form, pares, 'gradingduedate', g, avisos); }
      // "data limite" (cutoff) antes do prazo também é recusada: se estiver ligada, desliga.
      if (tem(pares, 'cutoffdate[enabled]')) { for (let i = pares.length - 1; i >= 0; i--) if (pares[i][0] === 'cutoffdate[enabled]') pares.splice(i, 1); }
      definir(pares, 'assignsubmission_file_enabled', 1);
      const mf = opcoes(form, 'assignsubmission_file_maxfiles'); if (mf && mf.includes('1')) definir(pares, 'assignsubmission_file_maxfiles', 1);
    }
    const botao = form.querySelector('input[type="submit"][name="submitbutton"], button[type="submit"][name="submitbutton"]');
    if (!botao) return { erro: 'Não achei o botão de salvar do formulário. Nada foi criado.' };
    pares.push([botao.getAttribute('name'), botao.value || botao.textContent || 'Save and return to course']);
    return { pares, avisos };
  }
  const codificar = pares => { const u = new URLSearchParams(); pares.forEach(([k, v]) => u.append(k, v)); return u.toString(); };

  // Mensagens de erro que o Moodle mostra quando recusa o formulário.
  function errosDoForm(doc) {
    const out = [];
    doc.querySelectorAll('.alert-danger, .errorbox, .notifyproblem, .form-control-feedback, [id^="id_error_"], .error').forEach(n => { const t = clean(n.textContent); if (t && !out.includes(t) && t.length < 300) out.push(t); });
    return out;
  }

  // ---- Página do curso ----
  const textoDe = n => { if (!n) return ''; const c = n.cloneNode(true); c.querySelectorAll('.accesshide,.sr-only,.visually-hidden,[aria-hidden="true"]').forEach(x => x.remove()); return clean(c.textContent); };
  function atividades(doc) {
    const lista = []; const vistos = new Set();
    doc.querySelectorAll('li.activity, [data-for="cmitem"]').forEach(li => {
      const a = li.querySelector('a[href*="/mod/"][href*="id="]'); const m = /[?&]id=(\d+)/.exec(a ? a.getAttribute('href') : '');
      const cmid = li.getAttribute('data-id') || (m && m[1]); if (!cmid || vistos.has(cmid)) return; vistos.add(cmid);
      const nome = textoDe(li.querySelector('.instancename')) || textoDe(a);
      lista.push({ cmid, nome });
    });
    return lista;
  }
  const acharPorNome = (doc, nome) => atividades(doc).filter(a => fold(a.nome) === fold(nome));
  function secoes(doc) {
    const out = []; const vistos = new Set();
    doc.querySelectorAll('li.section[data-number], li.course-section[data-number], [data-for="section"][data-number]').forEach(s => {
      const n = s.getAttribute('data-number'); if (n == null || vistos.has(n)) return; vistos.add(n);
      out.push({ oculta: s.classList.contains('hidden') || s.classList.contains('dimmed'), numero: Number(n), nome: clean(s.getAttribute('data-sectionname')) || textoDe(s.querySelector('.sectionname, [data-for="section_title"], h3')) || (n === '0' ? 'Geral' : `Seção ${n}`) });
    });
    return out;
  }
  // Procura, entre as seções lidas, a que melhor casa com o texto (sem acento/maiúscula). Devolve o número ou null. Nunca chuta: só aceita se achar UMA.
  function acharSecao(lista, busca) {
    const q = fold(busca); if (!q) return null;
    const exato = lista.filter(x => fold(x.nome) === q); if (exato.length === 1) return exato[0].numero;
    const parc = lista.filter(x => fold(x.nome).includes(q)); return parc.length === 1 ? parc[0].numero : null;
  }
  const valorVisivel = doc => { const s = doc.querySelector('select[name="visible"]'); const o = s && (s.options[s.selectedIndex] || [...s.options].find(x => x.selected)); return o ? o.value : null; };
  function cursoIdDaUrl(href) { try { const u = new URL(href); return /\/course\/view\.php$/.test(u.pathname) && /^\d+$/.test(u.searchParams.get('id') || '') ? u.searchParams.get('id') : null; } catch (_) { return null; } }

  // Cursos dos cartões de "Meus cursos" (só olha a tela).
  function cursosDaPagina(doc, origin) {
    const found = new Map();
    doc.querySelectorAll('a[href*="/course/view.php"]').forEach(a => {
      let u; try { u = new URL(a.getAttribute('href'), origin); } catch (_) { return; }
      const id = u.searchParams.get('id'); if (!id || !/^\d+$/.test(id) || u.origin !== origin || found.has(id)) return;
      if (a.closest('nav,header,footer,.navbar,.drawer,[data-region="drawer"],.dropdown-menu,[role="navigation"]')) return;
      const card = a.closest('[data-course-id],.course-summaryitem,.coursebox,.card,li') || a.parentElement;
      const nameNode = (card && card.querySelector('a.coursename,.coursename,.multiline')) || a;
      found.set(id, { id, name: textoDe(nameNode) || clean(a.getAttribute('title')) || `Curso ${id}`, category: textoDe(card && card.querySelector('.categoryname')) });
    });
    return [...found.values()];
  }
  function nomeDoTutor(doc) { const n = doc.querySelector('.usermenu .usertext, [data-region="usermenu"] .usertext, .userbutton .usertext, .usermenu .login .usertext'); return textoDe(n); }

  CRI.core = { MODELOS, campos, preencher, sanitizar, partesData, fmtData, lerLocal, coletar, definir, achaForm, montarEnvio, codificar, errosDoForm, atividades, acharPorNome, secoes, acharSecao, valorVisivel, cursoIdDaUrl, cursosDaPagina, nomeDoTutor, fold, clean, esc };
})(globalThis);

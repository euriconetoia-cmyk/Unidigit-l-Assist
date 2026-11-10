// Criar conteúdo — leitor de DOCX (Word). Roda só no navegador, sem biblioteca externa e sem enviar nada para fora.
// Um DOCX é um ZIP com XML. Lemos só o texto e a estrutura (títulos, negrito, listas, links, tabelas); imagens, macros e estilos soltos são descartados.
// O HTML devolvido ainda passa por CRI.core.sanitizar antes de qualquer uso.
(function (root) {
  'use strict';
  const CRI = root.CRI; const C = CRI.core;
  const MAX_XML = 8 * 1024 * 1024; // limite do que se descompacta (protege contra ZIP "bomba")

  const u16 = (v, o) => v.getUint16(o, true); const u32 = (v, o) => v.getUint32(o, true);

  // Lista as entradas do ZIP (central directory). Não descompacta nada ainda.
  function entradas(buf) {
    const v = new DataView(buf); const n = v.byteLength;
    let eocd = -1; for (let i = n - 22; i >= Math.max(0, n - 22 - 65535); i--) { if (u32(v, i) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error('Este arquivo não parece um DOCX (não é um ZIP válido).');
    const total = u16(v, eocd + 10); let o = u32(v, eocd + 16); const mapa = new Map();
    for (let k = 0; k < total; k++) {
      if (o + 46 > n || u32(v, o) !== 0x02014b50) throw new Error('DOCX com estrutura inválida.');
      const flag = u16(v, o + 8), metodo = u16(v, o + 10), comp = u32(v, o + 20), desc = u32(v, o + 24), nl = u16(v, o + 28), el = u16(v, o + 30), cl = u16(v, o + 32), local = u32(v, o + 42);
      const nome = new TextDecoder().decode(new Uint8Array(buf, o + 46, nl));
      mapa.set(nome, { flag, metodo, comp, desc, local });
      o += 46 + nl + el + cl;
    }
    return mapa;
  }

  async function inflarPadrao(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não consegue abrir DOCX. Atualize o Chrome.');
    const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }

  async function extrair(buf, mapa, nome, inflar) {
    const e = mapa.get(nome); if (!e) return null;
    if (e.flag & 1) throw new Error('Este DOCX está protegido por senha. Salve uma cópia sem senha.');
    if (e.desc > MAX_XML) throw new Error('O documento é grande demais para importar.');
    const v = new DataView(buf); const o = e.local;
    if (u32(v, o) !== 0x04034b50) throw new Error('DOCX com estrutura inválida.');
    const ini = o + 30 + u16(v, o + 26) + u16(v, o + 28);
    const dados = new Uint8Array(buf, ini, e.comp);
    let out;
    if (e.metodo === 0) out = dados; else if (e.metodo === 8) out = await inflar(dados); else throw new Error('Compactação de DOCX não suportada.');
    if (out.length > MAX_XML) throw new Error('O documento é grande demais para importar.');
    return new TextDecoder('utf-8').decode(out);
  }

  const xml = t => { const d = new root.DOMParser().parseFromString(t, 'application/xml'); if (d.getElementsByTagName('parsererror').length) throw new Error('Não consegui ler o texto do documento.'); return d; };
  const filhos = (el, nome) => el ? [...el.children].filter(c => c.localName === nome) : [];
  const um = (el, nome) => filhos(el, nome)[0] || null;
  const val = el => el ? (el.getAttribute('w:val') ?? el.getAttribute('val')) : null;
  const ligado = el => { if (!el) return false; const v = val(el); return !(v === '0' || v === 'false' || v === 'off' || v === 'none'); };

  function lerNumeracao(t) {
    const mapa = {}; if (!t) return mapa; const d = xml(t);
    const abs = {}; [...d.getElementsByTagName('*')].filter(e => e.localName === 'abstractNum').forEach(a => {
      const l0 = filhos(a, 'lvl').find(l => (l.getAttribute('w:ilvl') ?? l.getAttribute('ilvl')) === '0') || filhos(a, 'lvl')[0];
      abs[a.getAttribute('w:abstractNumId') ?? a.getAttribute('abstractNumId')] = val(um(l0, 'numFmt'));
    });
    [...d.getElementsByTagName('*')].filter(e => e.localName === 'num').forEach(n => {
      const id = n.getAttribute('w:numId') ?? n.getAttribute('numId'); const a = val(um(n, 'abstractNumId')); mapa[id] = abs[a] === 'bullet' ? 'ul' : 'ol';
    });
    return mapa;
  }
  function lerRels(t) {
    const mapa = {}; if (!t) return mapa;
    [...xml(t).getElementsByTagName('*')].filter(e => e.localName === 'Relationship' && /hyperlink$/.test(e.getAttribute('Type') || '')).forEach(r => { mapa[r.getAttribute('Id')] = r.getAttribute('Target') || ''; });
    return mapa;
  }

  // Um run do Word: texto + formatação. Runs vizinhos de mesma formatação são juntados depois (o Word costuma quebrar {{campo}} em vários runs).
  function run(r, ctx, link) {
    const rpr = um(r, 'rPr'); const f = { b: ligado(um(rpr, 'b')) && !!um(rpr, 'b'), i: ligado(um(rpr, 'i')) && !!um(rpr, 'i'), u: ligado(um(rpr, 'u')) && !!um(rpr, 'u') && val(um(rpr, 'u')) !== 'none' };
    let t = '';
    [...r.children].forEach(c => {
      if (c.localName === 't') t += C.esc(c.textContent);
      else if (c.localName === 'tab') t += ' ';
      else if (c.localName === 'br') t += '<br>';
      else if (c.localName === 'noBreakHyphen') t += '-';
      else if (c.localName === 'drawing' || c.localName === 'pict' || c.localName === 'object') ctx.imagens++;
    });
    return { chave: `${f.b ? 'b' : ''}${f.i ? 'i' : ''}${f.u ? 'u' : ''}|${link || ''}`, f, link, t };
  }
  function paragrafoHtml(p, ctx) {
    const itens = [];
    [...p.children].forEach(c => {
      if (c.localName === 'r') itens.push(run(c, ctx, ''));
      else if (c.localName === 'hyperlink') { const id = c.getAttribute('r:id') || c.getAttribute('id'); const href = id ? ctx.rels[id] : ''; filhos(c, 'r').forEach(r => itens.push(run(r, ctx, href || ''))); }
      else if (c.localName === 'ins' || c.localName === 'smartTag' || c.localName === 'sdt') [...c.getElementsByTagName('*')].filter(x => x.localName === 'r').forEach(r => itens.push(run(r, ctx, '')));
    });
    // junta runs vizinhos com a mesma formatação
    const grupos = []; itens.forEach(it => { const g = grupos[grupos.length - 1]; if (g && g.chave === it.chave) g.t += it.t; else grupos.push({ ...it }); });
    return grupos.map(g => {
      if (!g.t) return '';
      let h = g.t; if (g.f.u) h = `<u>${h}</u>`; if (g.f.i) h = `<em>${h}</em>`; if (g.f.b) h = `<strong>${h}</strong>`;
      return g.link ? `<a href="${C.esc(g.link)}">${h}</a>` : h;
    }).join('');
  }
  const semTags = h => h.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

  function corpoHtml(corpo, ctx) {
    const out = []; let lista = null; // {tipo, itens}
    const fecha = () => { if (lista) { out.push(`<${lista.tipo}>${lista.itens.map(i => `<li>${i}</li>`).join('')}</${lista.tipo}>`); lista = null; } };
    [...corpo.children].forEach(el => {
      if (el.localName === 'tbl') { fecha(); out.push(tabelaHtml(el, ctx)); return; }
      if (el.localName !== 'p') return;
      const ppr = um(el, 'pPr'); const estilo = val(um(ppr, 'pStyle')) || ''; const num = um(ppr, 'numPr');
      const h = paragrafoHtml(el, ctx); if (!semTags(h) && !/<br>/.test(h)) return;
      const nId = num && val(um(num, 'numId')); const nivel = num ? Number(val(um(num, 'ilvl')) || 0) : 0;
      if (num && nId && nId !== '0') {
        if (nivel > 0) ctx.achatou = true;
        const tipo = ctx.num[nId] || 'ul'; if (!lista || lista.tipo !== tipo) { fecha(); lista = { tipo, itens: [] }; } lista.itens.push(h); return;
      }
      fecha();
      const m = /^(?:heading|t[ií]tulo|ttulo)\s*([1-6])$/i.exec(estilo.replace(/\s+/g, ' '));
      if (m) { const n = Math.min(Number(m[1]) + 1, 6); out.push(`<h${n}>${semTags(h) ? h.replace(/<\/?(strong|em|u)>/g, '') : h}</h${n}>`); }
      else if (/^(title|ttulo|t[ií]tulo)$/i.test(estilo)) out.push(`<h2>${h.replace(/<\/?(strong|em|u)>/g, '')}</h2>`);
      else out.push(`<p>${h}</p>`);
    });
    fecha(); return out.join('');
  }
  function tabelaHtml(tbl, ctx) {
    const look = um(um(tbl, 'tblPr'), 'tblLook'); const cab = look && (look.getAttribute('w:firstRow') === '1' || look.getAttribute('firstRow') === '1');
    const linhas = filhos(tbl, 'tr').map((tr, i) => {
      const th = i === 0 && (cab || !!um(um(tr, 'trPr'), 'tblHeader')); const tag = th ? 'th' : 'td';
      return `<tr>${filhos(tr, 'tc').map(tc => `<${tag}>${corpoHtml(tc, { ...ctx, achatou: false }).replace(/<\/p><p>/g, '<br>').replace(/<\/?p>/g, '').replace(/<\/?(ul|ol)>/g, '').replace(/<li>/g, '• ').replace(/<\/li>/g, '<br>') || ''}</${tag}>`).join('')}</tr>`;
    });
    return linhas.length ? `<table>${linhas.join('')}</table>` : '';
  }

  // Converte o XML do documento (e opcionais) em HTML.
  function paraHtml(docXml, { numeracaoXml, relsXml } = {}) {
    const ctx = { imagens: 0, achatou: false, num: lerNumeracao(numeracaoXml), rels: lerRels(relsXml) };
    const d = xml(docXml); const corpo = [...d.getElementsByTagName('*')].find(e => e.localName === 'body');
    if (!corpo) throw new Error('O documento está vazio.');
    const html = corpoHtml(corpo, ctx); const avisos = [];
    if (!semTags(html)) throw new Error('Não achei texto neste documento.');
    if (ctx.imagens) avisos.push('Imagens e desenhos do documento não foram importados.');
    if (ctx.achatou) avisos.push('Listas com subníveis foram simplificadas para um nível só.');
    return { html, avisos };
  }

  // ArrayBuffer de um .docx -> { html, avisos }. `inflar` existe só para teste.
  async function ler(buf, { inflar } = {}) {
    const inf = inflar || inflarPadrao; const mapa = entradas(buf);
    const doc = await extrair(buf, mapa, 'word/document.xml', inf); if (doc == null) throw new Error('Este arquivo não parece um DOCX (falta o texto do documento).');
    const numeracaoXml = await extrair(buf, mapa, 'word/numbering.xml', inf); const relsXml = await extrair(buf, mapa, 'word/_rels/document.xml.rels', inf);
    return paraHtml(doc, { numeracaoXml, relsXml });
  }

  CRI.docx = { ler, paraHtml, entradas };
})(globalThis);

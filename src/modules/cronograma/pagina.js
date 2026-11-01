// Página do curso: acha os textos (rótulos) da UC e lê o texto guardado na edição (só GET).
(function (root) {
  'use strict';
  const CRN = root.CRN; const J = CRN.json; const T = CRN.textos;

  function similaridade(a, b) {
    const ta = J.norm(a).replace(/\buc\s*\d+\b/g, '').split(' ').filter(Boolean), tb = J.norm(b).replace(/\buc\s*\d+\b/g, '').split(' ').filter(Boolean);
    if (!ta.length || !tb.length) return 0;
    const sa = ta.join(' '), sb = tb.join(' '); if (sa === sb) return 1; if (sa.includes(sb) || sb.includes(sa)) return 0.9;
    const A = new Set(ta), B = new Set(tb); let i = 0; A.forEach(x => { if (B.has(x)) i += 1; });
    return i / (A.size + B.size - i);
  }
  function casarUc(ucs, nome, minimo = 0.7) {
    let melhor = null, nota = 0; for (const u of ucs) { const s = similaridade(u.nome, nome); if (s > nota) { nota = s; melhor = u; } }
    return nota >= minimo ? melhor : null;
  }
  function nomeCurso(doc) { const h = doc.querySelector('.page-header-headings h1, h1.h2, h1'); return h ? T.clean(h.textContent) : ''; }

  function listarRotulos(doc) {
    const out = [];
    doc.querySelectorAll('li.activity.label, li.modtype_label').forEach(li => {
      const m = /module-(\d+)/.exec(li.id || ''); if (!m) return;
      const alvo = li.querySelector('.activity-altcontent .no-overflow, .contentwithoutlink .no-overflow, .no-overflow') || li;
      const c = T.classificar(alvo.innerHTML); if (!c.tipo) return;
      out.push({ cmid: m[1], tipo: c.tipo, uc: c.uc });
    });
    return out;
  }
  const editUrl = (origin, cmid) => `${origin}/course/modedit.php?update=${encodeURIComponent(cmid)}`;

  // Texto guardado no Moodle (campo do editor), não o já processado da página.
  async function lerRotulo(origin, cmid, { fetchImpl, signal } = {}) {
    const f = fetchImpl || root.fetch.bind(root);
    const resp = await f(editUrl(origin, cmid), { credentials: 'same-origin', signal });
    if (!resp.ok) throw new Error(`O Moodle respondeu ${resp.status} ao abrir a edição do texto.`);
    const doc = new root.DOMParser().parseFromString(await resp.text(), 'text/html');
    const ta = doc.querySelector('textarea[name="introeditor[text]"]');
    if (!ta) throw new Error('Não achei o campo do texto na edição (sem permissão de editar ou tela diferente).');
    return ta.value;
  }
  CRN.pagina = { similaridade, casarUc, nomeCurso, listarRotulos, editUrl, lerRotulo };
})(globalThis);

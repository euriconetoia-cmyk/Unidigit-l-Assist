// Preenche o editor do Kahoot, pergunta por pergunta. Para na primeira falha dizendo QUAL pergunta e QUAL campo.
// Só usa a pergunta atual se ela estiver em branco (nunca sobrescreve conteúdo existente).
(function (root) {
  'use strict';
  const KHT = root.KHT;
  const doc = () => root.document;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const norm = v => String(v == null ? '' : v).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const clean = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  class FillError extends Error { constructor(msg, pergunta, campo) { super(msg); this.name = 'FillError'; this.pergunta = pergunta; this.campo = campo; } }
  class Cancelado extends Error { constructor() { super('Preenchimento cancelado.'); this.name = 'Cancelado'; } }

  function visible(el) {
    if (!el) return false;
    const s = root.getComputedStyle(el); const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && (r.width > 0 && r.height > 0);
  }
  const all = sel => [...doc().querySelectorAll(sel)].filter(visible);
  const texto = el => (!el ? '' : ('value' in el ? clean(el.value) : clean(el.innerText || el.textContent)));

  function tituloEl() {
    const sels = ['[data-functional-selector="question-title__input"]', '[data-functional-selector*="question-title"] [contenteditable="true"]', '[contenteditable="true"][aria-label*="question" i]', '[contenteditable="true"][aria-label*="pergunta" i]', 'textarea[placeholder*="question" i]', 'textarea[placeholder*="pergunta" i]'];
    for (const s of sels) { const f = all(s)[0]; if (f) return f; }
    return null;
  }
  function cartoes() {
    const st = all('[data-functional-selector="question-answer"]');
    if (st.length >= 4) return st.slice(0, 4);
    return all('[data-functional-selector="question-answer__input"], [contenteditable="true"][aria-label*="answer" i], [contenteditable="true"][aria-label*="resposta" i]').filter(e => e !== tituloEl()).slice(0, 4).map(i => i.closest('[data-functional-selector*="question-answer"],article,li,div') || i);
  }
  function opcaoEl(i) {
    const c = cartoes()[i]; if (!c) return null;
    return c.querySelector('[data-functional-selector="question-answer__input"]') || (c.matches('input,textarea,[contenteditable="true"]') ? c : c.querySelector('input[type="text"],textarea,[contenteditable="true"]'));
  }
  function alternadores() {
    for (const s of ['[data-functional-selector="question-answer__toggle-button"]', 'button[data-functional-selector*="answer"][aria-checked]', 'button[data-functional-selector*="answer"][aria-pressed]', '[role="checkbox"][aria-checked]']) {
      const f = all(s); if (f.length >= 4) return f.slice(0, 4);
    }
    return [];
  }
  const blocos = () => all('[data-functional-selector="sidebar-block"]');
  function addBtn() {
    const st = doc().querySelector('[data-functional-selector="add-question-button"]');
    if (visible(st)) return st;
    return all('button,[role="button"]').find(e => ['add', 'adicionar', 'adicionarpergunta', 'addquestion'].includes(norm(e.innerText || e.textContent))) || null;
  }
  const emBranco = () => { const t = tituloEl(); const c = cartoes(); return Boolean(t) && c.length >= 4 && texto(t) === '' && c.every((_, i) => texto(opcaoEl(i)) === ''); };

  // O que falta no editor (sem tocar em nada)
  function diagnostico() {
    const falta = [];
    if (!tituloEl()) falta.push('campo da pergunta');
    if (cartoes().length < 4) falta.push('quatro alternativas');
    if (alternadores().length < 4) falta.push('seleção da alternativa correta');
    if (!addBtn()) falta.push('botão para adicionar pergunta');
    return { pronto: !falta.length, falta, emBranco: falta.length ? false : emBranco() };
  }

  async function esperar(get, descricao, sig, ms = 12000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (sig && sig.aborted) throw new Cancelado(); const r = get(); if (r) return r; await sleep(120); }
    throw new Error(`tempo esgotado esperando ${descricao}`);
  }
  function setNative(el, value) {
    const proto = el instanceof root.HTMLTextAreaElement ? root.HTMLTextAreaElement.prototype : root.HTMLInputElement.prototype;
    const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
    set.call(el, value);
    el.dispatchEvent(new root.Event('input', { bubbles: true })); el.dispatchEvent(new root.Event('change', { bubbles: true }));
  }
  function escrever(el, value) {
    el.scrollIntoView({ block: 'center' }); el.focus({ preventScroll: true });
    if (el instanceof root.HTMLInputElement || el instanceof root.HTMLTextAreaElement) { setNative(el, value); return; }
    const sel = root.getSelection(); const r = doc().createRange(); r.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(r);
    let ok = false; try { ok = doc().execCommand('insertText', false, String(value)); } catch (_) { ok = false; }
    if (!ok) { el.textContent = String(value); el.dispatchEvent(new root.InputEvent('input', { bubbles: true, inputType: 'insertText', data: String(value) })); el.dispatchEvent(new root.Event('change', { bubbles: true })); }
    el.blur();
  }
  async function preencher(get, valor, ctx) {
    const esperado = clean(valor);
    for (let t = 0; t < 3; t += 1) {
      let el; try { el = await esperar(get, ctx.campo, ctx.sig, 9000); } catch (e) { if (e.name === 'Cancelado') throw e; throw new FillError(`Pergunta ${ctx.n}: não achei ${ctx.campo} no editor.`, ctx.n, ctx.campo); }
      if (texto(el) === esperado) return;
      escrever(el, valor); await sleep(ctx.pausa);
      const novo = get(); if (novo && texto(novo) === esperado) return;
    }
    throw new FillError(`Pergunta ${ctx.n}: não consegui preencher ${ctx.campo}.`, ctx.n, ctx.campo);
  }
  const marcado = b => b.getAttribute('aria-checked') === 'true' || b.getAttribute('aria-pressed') === 'true' || b.dataset.selected === 'true' || b.classList.contains('selected') || b.classList.contains('is-selected');
  async function marcarCorreta(idx, ctx) {
    const b = alternadores(); if (b.length < 4) throw new FillError(`Pergunta ${ctx.n}: não achei a seleção da resposta correta.`, ctx.n, 'resposta correta');
    for (let i = 0; i < 4; i += 1) if (marcado(b[i]) !== (i === idx)) { b[i].scrollIntoView({ block: 'center' }); b[i].click(); await sleep(ctx.pausa); }
    const f = alternadores(); if (f.length < 4 || !marcado(f[idx])) throw new FillError(`Pergunta ${ctx.n}: a resposta correta não ficou marcada.`, ctx.n, 'resposta correta');
  }
  async function novaPergunta(sig, n) {
    const antes = blocos().length; const tAntes = tituloEl();
    const add = await esperar(addBtn, 'o botão Adicionar', sig).catch(e => { if (e.name === 'Cancelado') throw e; throw new FillError(`Pergunta ${n}: não achei o botão Adicionar.`, n, 'botão Adicionar'); });
    add.click(); await sleep(320);
    if (blocos().length <= antes) {
      const pop = [...doc().querySelectorAll('[role="dialog"],[role="menu"],[data-radix-popper-content-wrapper]')].filter(visible).pop();
      const quiz = pop && [...pop.querySelectorAll('button,[role="button"]')].filter(visible).find(e => norm(e.innerText || e.textContent) === 'quiz');
      if (quiz) quiz.click();
    }
    await esperar(() => blocos().length > antes || tituloEl() !== tAntes, 'a nova pergunta', sig).catch(e => { if (e.name === 'Cancelado') throw e; throw new FillError(`Pergunta ${n}: o Kahoot não criou a nova pergunta.`, n, 'nova pergunta'); });
    await esperar(() => tituloEl() && emBranco(), 'o editor da nova pergunta', sig, 10000).catch(e => { if (e.name === 'Cancelado') throw e; throw new FillError(`Pergunta ${n}: a nova pergunta não ficou em branco.`, n, 'nova pergunta'); });
    await sleep(300);
  }

  // opts: { usarEmBranco (bool), pausa (ms), signal, onProgress(feitas, total, texto) }. Devolve { feitas }.
  async function executar(questions, opts = {}) {
    const sig = opts.signal; const pausa = Math.max(80, Number(opts.pausa) || 320); const entre = Math.max(0, Number(opts.entre == null ? 900 : opts.entre));
    const d = diagnostico();
    if (!d.pronto) throw new FillError(`O editor não está pronto: falta ${d.falta.join(', ')}. Abra uma pergunta do tipo Quiz.`, 0, d.falta[0]);
    let feitas = 0;
    try {
      for (let i = 0; i < questions.length; i += 1) {
        if (sig && sig.aborted) throw new Cancelado();
        const n = i + 1; const q = questions[i];
        const reaproveita = i === 0 && opts.usarEmBranco !== false && d.emBranco;
        if (!reaproveita) await novaPergunta(sig, n);
        if (opts.onProgress) opts.onProgress(feitas, questions.length, `Pergunta ${n} de ${questions.length}`);
        await preencher(tituloEl, q.question, { n, campo: 'o enunciado', sig, pausa });
        for (let k = 0; k < 4; k += 1) await preencher(() => opcaoEl(k), q.answers[k], { n, campo: `a opção ${k + 1}`, sig, pausa });
        await marcarCorreta(q.correctIndex, { n, pausa });
        feitas += 1;
        if (opts.onProgress) opts.onProgress(feitas, questions.length, '');
        await sleep(entre);
      }
    } catch (e) { e.feitas = feitas; throw e; }
    return { feitas };
  }
  KHT.filler = { diagnostico, executar, FillError, Cancelado };
})(globalThis);

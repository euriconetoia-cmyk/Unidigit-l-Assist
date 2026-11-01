// Leitura (só GET): lista as atividades da página do curso e abre o formulário de edição de cada uma só para LER as datas.
(function (root) {
  'use strict';
  const DTS = root.DTS; const C = DTS.core;
  const sleep = (ms, signal) => new Promise((res, rej) => {
    if (signal && signal.aborted) return rej(new DOMException('Cancelado', 'AbortError'));
    const t = setTimeout(res, ms); if (signal) signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('Cancelado', 'AbortError')); }, { once: true });
  });

  // Atividades de tarefa e questionário da página do curso (sem duplicar; nome sem o texto escondido "Tarefa"/"Questionário").
  function listarAtividades(doc, origin) {
    const achadas = new Map();
    const main = doc.querySelector('[role="main"],#region-main,main') || doc.body;
    main.querySelectorAll('a[href*="/mod/assign/view.php"],a[href*="/mod/quiz/view.php"]').forEach(a => {
      let u; try { u = new URL(a.getAttribute('href'), origin); } catch (_) { return; }
      const tipo = /\/mod\/assign\//.test(u.pathname) ? 'assign' : 'quiz'; const id = u.searchParams.get('id');
      if (!id || !/^\d+$/.test(id) || u.origin !== origin) return;
      const c = a.cloneNode(true); c.querySelectorAll('.accesshide,.sr-only,.visually-hidden,[aria-hidden="true"]').forEach(x => x.remove());
      const nome = C.clean(c.textContent);
      if (!nome) return;
      const antigo = achadas.get(id);
      if (!antigo || nome.length > antigo.nome.length) achadas.set(id, { cmid: id, tipo, nome });
    });
    return [...achadas.values()];
  }

  const editUrl = (origin, cmid) => `${origin}/course/modedit.php?update=${encodeURIComponent(cmid)}`;

  // Abre o formulário de edição e lê as datas. Erro claro se não for possível (sem permissão, sessão expirada, tela diferente).
  async function lerAtividade(origin, atv, { signal, fetchImpl } = {}) {
    const f = fetchImpl || root.fetch.bind(root);
    const resp = await f(editUrl(origin, atv.cmid), { credentials: 'same-origin', signal });
    if (!resp.ok) throw new Error(`O Moodle respondeu ${resp.status} ao abrir a edição.`);
    const html = await resp.text();
    const doc = new root.DOMParser().parseFromString(html, 'text/html');
    if (doc.querySelector('input[name="password"]') && !doc.querySelector('form#mform1')) throw new Error('Sessão do Moodle expirada: entre de novo.');
    const campos = C.lerCampos(doc, atv.tipo);
    if (!campos.termino) throw new Error('Não achei os campos de data na edição (sem permissão de editar ou tela diferente).');
    return campos;
  }

  async function lerTodas(origin, atividades, { onProgress = () => {}, signal, pausaMs = 400, fetchImpl } = {}) {
    const out = [];
    for (let i = 0; i < atividades.length; i++) {
      if (signal && signal.aborted) throw new DOMException('Cancelado', 'AbortError');
      const a = atividades[i]; onProgress({ i, total: atividades.length, nome: a.nome });
      try { out.push({ ...a, atual: await lerAtividade(origin, a, { signal, fetchImpl }), erro: '' }); }
      catch (e) { if (e && e.name === 'AbortError') throw e; out.push({ ...a, atual: null, erro: e && e.message ? e.message : String(e) }); }
      if (i < atividades.length - 1) await sleep(pausaMs, signal);
    }
    return out;
  }

  DTS.reader = { listarAtividades, lerAtividade, lerTodas, editUrl, sleep };
})(globalThis);

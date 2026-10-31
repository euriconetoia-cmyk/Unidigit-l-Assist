// Executa o lote: uma atividade por vez numa aba-fantasma (iframe do mesmo domínio), preenchendo,
// salvando e RELENDO. Se um campo não conferir, o lote PARA na hora. Falha de leitura nunca vira zero.
(function (root) {
  'use strict';
  const IMN = root.IMN;
  const h = IMN.dom.h;

  // Driver real: um iframe fora da tela. load(url) e submit(botão) resolvem com o Document recarregado.
  function createIframeDriver(win, doc, { timeoutMs = 60000 } = {}) {
    let frame = null;
    const ensure = () => {
      if (!frame) {
        frame = h(doc, 'iframe', { 'aria-hidden': 'true', tabindex: '-1', title: 'Importar Notas (lote em andamento)', style: 'position:fixed;left:-10000px;top:0;width:1280px;height:900px;border:0;visibility:hidden;pointer-events:none' });
        doc.body.append(frame);
      }
      return frame;
    };
    function waitLoad(trigger) {
      return new Promise((resolve, reject) => {
        const f = ensure();
        const done = fn => value => { win.clearTimeout(timer); f.removeEventListener('load', onLoad); fn(value); };
        const fail = done(reject);
        const ok = done(resolve);
        const timer = win.setTimeout(() => fail(new Error('Tempo limite: o Moodle não terminou de carregar a página.')), timeoutMs);
        function onLoad() {
          try {
            const d = f.contentDocument;
            if (!d || !d.documentElement) throw new Error('vazio');
            ok(d);
          } catch (_) {
            fail(new Error('O Moodle não permite abrir esta tela dentro da extensão. Use "Importar notas" dentro da própria atividade.'));
          }
        }
        f.addEventListener('load', onLoad);
        try { trigger(f); } catch (error) { fail(error); }
      });
    }
    return {
      load: url => waitLoad(f => { f.src = url; }),
      submit: button => waitLoad(() => button.click()),
      close() { if (frame) { frame.remove(); frame = null; } }
    };
  }

  // Retrato sem dados de alunos do que o Moodle devolveu: serve para entender por que não há tabela ou não há linhas.
  function describePage(doc) {
    const clip = (t, n = 110) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);
    const table = doc.querySelector('table#submissions');
    const rows = table ? table.querySelectorAll('tbody tr').length : 0;
    const filter = doc.querySelector('select[name="filter"] option:checked, #id_filter option:checked');
    const alert = doc.querySelector('.alert, [role="alert"], .notifications');
    return [`título "${clip(doc.title, 60)}"`, table ? `tabela com ${rows} linha(s)` : 'sem a tabela de alunos', filter ? `filtro "${clip(filter.textContent, 40)}"` : '', alert ? `aviso "${clip(alert.textContent)}"` : ''].filter(Boolean).join(' · ');
  }

  const keyOf = (userId, field) => `${userId}|${field}`;

  // job: { cmid, name, url, records, overwriteGrade, overwriteFeedback, expected: [{userId,name,field,to}] }
  // Resultado: { outcome, message, fields: [{ userId, name, field, from, to, after, status, reason }] }
  //   outcome: conferido | sem_alteracao | nao_lancada (nada foi salvo) | divergente | nao_verificada (salvou, mas não deu para conferir)
  async function runJob(job, { driver, governor }) {
    const M = IMN.moodle;
    const run = fn => (governor ? governor.run(fn) : fn());
    const out = { cmid: job.cmid, name: job.name, outcome: 'nao_lancada', message: '', fields: [] };
    let idoc;
    try { idoc = await run(() => driver.load(job.url)); } catch (error) { out.message = error.message; return out; }

    const ready = M.readiness(idoc, { href: job.url });
    if (!ready.ok) { out.message = ready.problem; return out; }

    const fresh = IMN.plan.buildPlan(job.records, M.readRows(idoc), { decimal: M.decimalSeparator(idoc), overwriteGrade: job.overwriteGrade, overwriteFeedback: job.overwriteFeedback });
    const wanted = new Set(job.expected.map(e => keyOf(e.userId, e.field)));
    const applied = new Set();
    const plan = { ...fresh, items: fresh.items.map(item => {
      if (item.status !== 'ready') return item;
      const changes = item.changes.filter(c => wanted.has(keyOf(item.row.userId, c.field)));
      changes.forEach(c => applied.add(keyOf(item.row.userId, c.field)));
      return { ...item, changes, status: changes.length ? 'ready' : 'unchanged' };
    }) };
    for (const e of job.expected) {
      if (!applied.has(keyOf(e.userId, e.field))) out.fields.push({ userId: e.userId, name: e.name, field: e.field, from: '', to: e.to, after: '', status: 'ignorado', reason: 'A página mudou desde a prévia; este campo não foi gravado.' });
    }
    const expected = IMN.plan.toExpected(plan);
    if (!expected.length) { out.outcome = 'sem_alteracao'; out.message = 'Nada a gravar nesta atividade (a página já está como o arquivo).'; return out; }

    const before = new Map();
    for (const item of plan.items) if (item.status === 'ready') for (const c of item.changes) before.set(keyOf(item.row.userId, c.field), c.from);

    M.fillPlan(plan);
    const button = M.saveButton(idoc);
    if (!button) { out.message = 'Botão de salvar do Moodle não encontrado nesta atividade; nada foi salvo.'; return out; }

    // Depois de salvar, o Moodle mostra uma página de resultado ("alterações salvas" + Continuar), sem a tabela, às vezes
    // na MESMA URL da avaliação. Navegar para a mesma URL viraria um "recarregar" dessa página. Por isso a releitura usa
    // uma URL nova (parâmetro único) e, se a tabela não vier, tenta mais uma vez antes de desistir.
    const rereadUrl = n => { const u = new URL(job.url); u.searchParams.set('imn_reread', `${Date.now()}${n}`); return u.href; };
    let after;
    try {
      await run(() => driver.submit(button));
      for (let attempt = 0; attempt < 2; attempt++) {
        after = await run(() => driver.load(rereadUrl(attempt)));
        if (M.readRows(after).length) break;
        await new Promise(r => setTimeout(r, 800));
      }
    } catch (error) {
      out.outcome = 'nao_verificada';
      out.message = `Pedi para salvar, mas não consegui confirmar: ${error.message} Confira esta atividade antes de continuar.`;
      expected.forEach(e => out.fields.push({ ...e, from: before.get(keyOf(e.userId, e.field)) || '', after: '', status: 'nao_verificado', reason: out.message }));
      return out;
    }
    if (!M.readRows(after).length) {
      out.outcome = 'nao_verificada';
      out.message = `Pedi para salvar, mas a releitura não mostrou alunos (duas tentativas). Os valores podem ter sido salvos: abra esta atividade no Moodle e confira antes de continuar. O Moodle devolveu: ${describePage(after)}.`;
      expected.forEach(e => out.fields.push({ ...e, from: before.get(keyOf(e.userId, e.field)) || '', after: '', status: 'nao_verificado', reason: out.message }));
      return out;
    }

    const back = new Map(M.readRows(after).map(r => [r.userId, r]));
    const problems = IMN.plan.verifyExpected(expected, back);
    const bad = new Map(problems.map(p => [keyOf(p.userId, p.field), p]));
    for (const e of expected) {
      const p = bad.get(keyOf(e.userId, e.field));
      out.fields.push({ userId: e.userId, name: e.name, field: e.field, from: before.get(keyOf(e.userId, e.field)) || '', to: e.to, after: p ? p.actual : e.to, status: p ? 'divergente' : 'conferido', reason: p ? p.reason : '' });
    }
    if (problems.length) { out.outcome = 'divergente'; out.message = `${problems.length} campo(s) não conferem depois de salvar.`; }
    else { out.outcome = 'conferido'; out.message = `${expected.length} campo(s) relidos do Moodle e iguais ao enviado.`; }
    return out;
  }

  const STOPPING = new Set(['divergente', 'nao_verificada']);

  function createBatchRunner({ driver, governor, win, onProgress = () => {}, gapMs = 350 }) {
    let cancelled = false;
    let paused = false;
    let release = null;
    const gate = () => (paused ? new Promise(resolve => { release = resolve; }) : null);

    async function run(jobs) {
      const results = [];
      try {
        for (let i = 0; i < jobs.length; i++) {
          const wait = gate(); if (wait) { onProgress({ type: 'paused', index: i, total: jobs.length }); await wait; }
          if (cancelled) break;
          const job = jobs[i];
          onProgress({ type: 'start', index: i, total: jobs.length, job });
          let result;
          try { result = await runJob(job, { driver, governor }); }
          catch (error) { result = { cmid: job.cmid, name: job.name, outcome: 'nao_verificada', message: `Falha inesperada: ${error.message}`, fields: [] }; }
          results.push(result);
          onProgress({ type: 'done', index: i, total: jobs.length, job, result });
          if (STOPPING.has(result.outcome)) {
            jobs.slice(i + 1).forEach(j => results.push({ cmid: j.cmid, name: j.name, outcome: 'nao_executada', message: 'O lote parou antes desta atividade.', fields: [] }));
            return { results, stopped: true, cancelled: false };
          }
          if (i < jobs.length - 1) await new Promise(r => win.setTimeout(r, gapMs));
        }
        if (cancelled) {
          const done = new Set(results.map(r => String(r.cmid)));
          jobs.filter(j => !done.has(String(j.cmid))).forEach(j => results.push({ cmid: j.cmid, name: j.name, outcome: 'cancelada', message: 'Cancelada por você.', fields: [] }));
        }
        return { results, stopped: false, cancelled };
      } finally {
        driver.close();
      }
    }

    return {
      run,
      pause() { paused = true; },
      resume() { paused = false; if (release) { const r = release; release = null; r(); } },
      cancel() { cancelled = true; paused = false; if (release) { const r = release; release = null; r(); } },
      get isPaused() { return paused; }
    };
  }

  root.IMN.batchRunner = { createIframeDriver, runJob, createBatchRunner };
})(globalThis);

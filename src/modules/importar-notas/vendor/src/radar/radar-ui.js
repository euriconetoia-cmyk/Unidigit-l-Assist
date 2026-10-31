// Interface do radar de pendências: selos por atividade (curso) ou por curso (categoria), resumo e download.
(function (root) {
  'use strict';
  const IMN = root.IMN;
  const h = IMN.dom.h;
  const ROOT_FOLDER = 'Moodle - Pendentes de correção';

  function pageName(doc, fallback) {
    for (const selector of ['.page-header-headings h1', '.page-context-header h1', '#page-header h1', '[role="main"] h1', 'h1']) {
      const text = ((doc.querySelector(selector) || {}).textContent || '').replace(/\s+/g, ' ').trim();
      if (text) return text;
    }
    return fallback;
  }

  function badgeText(result) {
    if (!result) return 'Verificando…';
    if (result.state === 'ok') return result.count === 0 ? 'Sem pendências' : `${result.count} p/ corrigir`;
    if (result.state === 'empty') return 'Sem tarefas lidas';
    if (result.state === 'na') return 'Sem controle de avaliação';
    return 'Não verificado';
  }
  function badgeTone(result) {
    if (!result) return 'loading';
    if (result.state === 'na') return 'na'; // informativo (azul): não há o que corrigir ali, mas também não é "zero verificado"
    if (result.state !== 'ok') return 'error'; // 'empty' e 'error': âmbar, nunca verde
    return result.count > 0 ? 'pending' : 'clear';
  }

  function setBadge(badge, result, detail) {
    badge.textContent = badgeText(result);
    badge.className = `imn-badge imn-badge-${badgeTone(result)}`;
    badge.title = result && result.state !== 'ok' ? (result.message || 'Não foi possível verificar.') : (detail || '');
  }

  // Selo da vigência da UC, ao lado do selo de pendências. Só texto e classe; o cartão ganha destaque quando é a UC vigente.
  function setVigencia(doc, anchor, card, v, slot) {
    if (slot.badge) slot.badge.remove();
    if (card) card.classList.remove('imn-card-vigente');
    const tone = v.state === 'vigente' ? 'vigente' : v.state === 'nao_identificada' ? 'error' : 'na';
    const badge = h(doc, 'span', { class: `imn-badge imn-badge-${tone} imn-vigencia`, title: v.reason }, v.label);
    if (anchor.classList && anchor.classList.contains('imn-bar-status')) anchor.insertAdjacentElement('afterend', badge); // fora do texto de status (que é reescrito a cada leitura)
    else anchor.append(' ', badge);
    slot.badge = badge;
    if (card && v.state === 'vigente') card.classList.add('imn-card-vigente');
    return badge;
  }

  function summaryText(summary, noun) {
    const parts = [`${summary.total} pendência(s) em ${summary.activitiesPending} ${noun}`];
    if (summary.noControl) parts.push(`${summary.noControl} sem controle de avaliação`);
    if (summary.partial) parts.push(`${summary.unverified} não verificada(s): o total acima é PARCIAL`);
    return parts.join(' · ');
  }

  function startBlobDownload(win, doc, blob, filename) {
    const token = (win.crypto && win.crypto.randomUUID ? win.crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/[^a-z0-9]/gi, '').toLowerCase();
    const register = new Promise(resolve => {
      try {
        win.chrome.runtime.sendMessage({ type: 'imn-register-download', token, filename }, response => resolve(Boolean(response && response.ok) && !win.chrome.runtime.lastError));
      } catch (_) { resolve(false); }
    });
    return register.then(registered => {
      const url = win.URL.createObjectURL(blob);
      const ext = ((filename.match(/\.(zip|csv|txt)$/i) || [])[1] || 'zip').toLowerCase();
      const link = h(doc, 'a', { href: url, download: registered ? `imn-pending-${token}.${ext}` : (filename.split('/').pop() || `pendentes.${ext}`), style: 'display:none' });
      doc.body.append(link);
      link.click();
      link.remove();
      win.setTimeout(() => win.URL.revokeObjectURL(url), 120000);
      return registered;
    });
  }

  const IDLE_TEXT = 'Nada lido ainda — clique na lupa para buscar as pendências.';
  const ICONS = {
    search: 'M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z',
    refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6',
    download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
    upload: 'M12 16V5M7 9l5-5 5 5M5 20h14',
    close: 'M6 6l12 12M18 6L6 18'
  };

  function createBar(doc, title) {
    const status = h(doc, 'span', { class: 'imn-bar-status', role: 'status' }, IDLE_TEXT);
    const detail = h(doc, 'div', { class: 'imn-bar-detail', hidden: true });
    // Nada é lido sozinho: a leitura começa na lupa (Buscar) e a mesma lupa vira Atualizar depois da primeira busca.
    const refresh = h(doc, 'button', { type: 'button', class: 'imn-ib imn-primary imn-search' });
    const retry = h(doc, 'button', { type: 'button', class: 'imn-btn imn-btn-sm', hidden: true, title: 'Lê de novo só o que ficou "Não verificado"; o que já foi lido é mantido' }, 'Tentar só as não verificadas');
    const download = h(doc, 'button', { type: 'button', class: 'imn-ib imn-primary imn-download', disabled: true, 'aria-label': 'Baixar pendentes', title: 'Baixar pendentes (busque primeiro)' }, IMN.dom.icon(doc, ICONS.download));
    const diagnose = h(doc, 'button', { type: 'button', class: 'imn-btn imn-btn-sm', title: 'Copia um resumo do que foi lido (sem dados de alunos)' }, 'Copiar diagnóstico');
    const closeBtn = h(doc, 'button', { type: 'button', class: 'imn-ib imn-close', 'aria-label': 'Fechar barra de pendências', title: 'Fechar a barra' }, IMN.dom.icon(doc, ICONS.close));
    const icons = h(doc, 'span', { class: 'imn-bar-icons' }, refresh, download);
    const el = h(doc, 'section', { class: 'imn-root imn-bar', 'aria-label': title },
      h(doc, 'div', { class: 'imn-bar-row' }, h(doc, 'strong', {}, title), status, h(doc, 'span', { class: 'imn-spacer' }), diagnose, retry, icons, closeBtn), detail);
    const bar = { el, status, detail, refresh, retry, download, diagnose, icons, close: closeBtn, searched: false };
    closeBtn.addEventListener('click', () => { el.hidden = true; });
    bar.show = () => { el.hidden = false; };
    bar.setSearched = done => {
      bar.searched = done;
      refresh.replaceChildren(IMN.dom.icon(doc, done ? ICONS.refresh : ICONS.search));
      refresh.setAttribute('aria-label', done ? 'Atualizar (lê tudo de novo)' : 'Buscar pendências');
      refresh.title = done ? 'Atualizar: lê tudo de novo' : 'Buscar pendências (nada é lido antes do clique)';
    };
    bar.setSearched(false);
    return bar;
  }

  function showDetail(bar, doc, nodes) {
    bar.detail.hidden = false;
    bar.detail.replaceChildren(...nodes.flat().filter(Boolean));
  }

  const item0 = prepared => (prepared[0] && prepared[0].folders[0]) || 'Moodle';

  // Preparação + confirmação em linha + downloads. entries: [{ assignment, count, folders: [...] }]
  function offerDownloads({ doc, win, bar, deps, entries, unverified }) {
    bar.download.disabled = true;
    const prepared = [];
    const failures = [];
    let done = 0;
    const progress = () => { bar.status.textContent = `Preparando ${done}/${entries.length}…`; };
    progress();

    return Promise.all(entries.map(async entry => {
      try {
        const sel = await deps.downloads.collectPending(entry.assignment, entry.count, { fetchDoc: deps.fetchDoc, governor: deps.governor, origin: win.location.origin });
        prepared.push({ ...entry, userIds: sel.userIds, max: sel.max ?? null, students: sel.students || [], sesskey: sel.sesskey, name: entry.assignment.name, assignmentId: entry.assignment.assignmentId });
      } catch (error) {
        failures.push(`${entry.assignment.name}: ${error.message}`);
      } finally { done += 1; progress(); }
    })).then(async () => {
      // Devolve a listagem do Moodle ao normal (o filtro "Requer avaliação" ficaria gravado na conta do usuário).
      if (entries.length) await deps.downloads.restoreListing(entries[0].assignment, { fetchDoc: deps.fetchDoc, governor: deps.governor, origin: win.location.origin });
      bar.status.textContent = deps.lastSummaryText || '';
      if (!prepared.length) {
        showDetail(bar, doc, [h(doc, 'p', { class: 'imn-alert' }, 'Nenhum ZIP pôde ser preparado.'), failures.map(f => h(doc, 'p', { class: 'imn-reason' }, f))]);
        bar.download.disabled = false;
        return;
      }
      const total = prepared.reduce((s, p) => s + p.userIds.length, 0);
      const confirm = h(doc, 'button', { type: 'button', class: 'imn-btn imn-primary', onclick: async () => {
        confirm.disabled = true; cancel.disabled = true;
        const D = deps.downloads;
        const got = [];
        const used = new Set();
        const manifestRows = [];
        const errors = [...failures];
        for (let i = 0; i < prepared.length; i++) {
          const item = prepared[i];
          bar.status.textContent = `Baixando ${i + 1}/${prepared.length}…`;
          try {
            const blob = await D.requestArchive(item, { origin: win.location.origin });
            const inner = IMN.zip ? IMN.zip.uniqueName(D.buildFilename(item.folders.slice(1), item.name, item.userIds.length, item.assignmentId), used) : '';
            got.push({ item, blob, inner });
            for (const st of item.students) manifestRows.push({ courseId: item.courseId, course: item.courseName, activityId: item.assignmentId, activity: item.name, max: item.max, userId: st.userId, name: st.name, files: st.files });
          } catch (error) { errors.push(`${item.name}: ${error.message}`); }
          await new Promise(r => win.setTimeout(r, 350));
        }
        const finish = (kind, text) => {
          bar.status.textContent = deps.lastSummaryText || '';
          bar.download.disabled = false;
          showDetail(bar, doc, [h(doc, 'p', { class: kind }, text), errors.map(e => h(doc, 'p', { class: 'imn-reason' }, e))]);
        };
        if (!got.length) { finish('imn-alert', 'Nenhum ZIP foi gerado.'); return; }

        const students = manifestRows.length;
        try {
          if (!IMN.zip) throw new Error('módulo de empacotamento ausente');
          bar.status.textContent = 'Montando o pacote…';
          const bom = text => `﻿${text}`;
          const parts = got.map(g => ({ name: g.inner, data: g.blob }));
          if (students && IMN.batch) {
            parts.push({ name: 'manifesto.csv', data: bom(IMN.batch.buildManifestCsv(manifestRows)) }, { name: 'LEIA-ME.txt', data: bom(IMN.batch.LEIAME_TEXT) });
          }
          const master = await IMN.zip.buildStoredZip(parts);
          const name = D.buildFilename([ROOT_FOLDER], `Pacote de correção - ${item0(prepared)}`, got.reduce((s, g) => s + g.item.userIds.length, 0), 'pacote');
          await startBlobDownload(win, doc, master, name);
          finish(errors.length ? 'imn-warn' : 'imn-ok', `1 pacote (.zip) com ${got.length} atividade(s) e ${got.reduce((s, g) => s + g.item.userIds.length, 0)} envio(s), mais manifesto.csv e LEIA-ME.txt${errors.length ? `. ${errors.length} atividade(s) com problema (veja abaixo)` : ''}.`);
        } catch (error) {
          // Não coube num pacote único: entrega os ZIPs separados, como antes.
          for (const g of got) {
            await startBlobDownload(win, doc, g.blob, D.buildFilename([ROOT_FOLDER, ...g.item.folders], g.item.name, g.item.userIds.length, g.item.assignmentId));
            await new Promise(r => win.setTimeout(r, 350));
          }
          errors.push(`Não consegui montar o pacote único (${error.message}); os ZIPs foram baixados separados, sem manifesto.`);
          finish('imn-warn', `${got.length} download(s) iniciado(s) separadamente.`);
        }
      } }, 'Confirmar e baixar');
      const cancel = h(doc, 'button', { type: 'button', class: 'imn-btn', onclick: () => { bar.detail.hidden = true; bar.download.disabled = false; } }, 'Cancelar');
      showDetail(bar, doc, [
        h(doc, 'p', {}, h(doc, 'strong', {}, `Gerar 1 pacote (.zip) com ${prepared.length} atividade(s) e ${total} envio(s) pendente(s)?`), ' Só o que ainda requer nota entra; nada já avaliado é incluído. O pacote leva também o manifesto.csv e o LEIA-ME.txt.'),
        unverified ? h(doc, 'p', { class: 'imn-warn' }, `${unverified} atividade(s) não verificada(s) ficam de fora.`) : null,
        failures.map(f => h(doc, 'p', { class: 'imn-reason' }, `Não preparado — ${f}`)),
        h(doc, 'div', { class: 'imn-actions' }, confirm, cancel)
      ]);
    });
  }

  // Copia o texto; sem permissão de área de transferência, mostra a caixa de texto já selecionada.
  async function copyText(doc, win, bar, text) {
    try { await win.navigator.clipboard.writeText(text); return true; } catch (_) { /* tenta o método antigo */ }
    const area = h(doc, 'textarea', { readonly: true, rows: '10', style: 'width:100%' }, text);
    showDetail(bar, doc, [h(doc, 'p', {}, 'Não consegui copiar sozinho. Selecione o texto abaixo (Ctrl+A) e copie (Ctrl+C):'), area]);
    try { area.focus(); area.select(); return Boolean(doc.execCommand && doc.execCommand('copy')); } catch (_) { return false; }
  }

  function engineInfo(deps, startedAt) {
    const g = deps.governor.state;
    return { elapsedSeconds: startedAt ? Math.round((Date.now() - startedAt) / 1000) : null, queriesUsed: deps.scanner.used, concurrency: g.concurrency, pauses: g.trips, circuitOpen: g.open, circuitReason: g.reason || undefined };
  }

  function wireDiagnostics(doc, win, bar, makeReport) {
    bar.diagnose.addEventListener('click', async () => {
      const text = JSON.stringify(makeReport(), null, 2);
      const copied = await copyText(doc, win, bar, text);
      if (copied) { bar.status.textContent = 'Diagnóstico copiado. Cole na conversa.'; bar.detail.hidden = true; }
    });
  }

  // Linha de status que mostra a pausa do disjuntor por cima do progresso (o progresso não apaga o aviso de pausa).
  function makeStatus(deps, bar, progressText) {
    let pausedText = '';
    const refresh = () => { bar.status.textContent = pausedText || progressText(); };
    if (deps.governor.onEvent) {
      deps.governor.onEvent(event => {
        if (event.type === 'pause') {
          const seconds = Math.max(1, Math.round((event.resumeAt - Date.now()) / 1000));
          pausedText = `O Moodle está respondendo devagar: pausa de ${seconds} s antes de tentar de novo (${event.trip}/${event.maxTrips})…`;
        } else pausedText = '';
        refresh();
      });
    }
    return { refresh, clear() { pausedText = ''; } };
  }

  function initCourse(doc, win, deps) {
    const url = win.location.href;
    let assignments = deps.pages.collectAssignments(doc, url);
    // Em página de curso a barra sempre aparece: se a página inicial da UC não mostra as atividades,
    // a lista de tarefas do curso é consultada só quando o usuário clica na lupa.
    const courseId = deps.pages.courseIdOf ? deps.pages.courseIdOf(doc, url) : '';
    let needsDiscovery = false;
    if (!assignments.length) {
      if (!courseId) return null;
      needsDiscovery = true;
    }
    const bar = createBar(doc, 'Pendências de correção');
    const main = doc.querySelector('[role="main"], #region-main') || doc.body;
    main.prepend(bar.el);
    const badges = new Map();
    const attachBadge = a => {
      const badge = h(doc, 'span', { class: 'imn-badge imn-badge-loading', hidden: true }, 'Verificando…');
      badges.set(a.assignmentId, badge);
      const anchor = a.link ? (a.link.parentElement || a.link) : a.card;
      if (anchor) anchor.append(' ', badge);
    };
    assignments.forEach(attachBadge);
    let last = null;
    const vigenciaSlot = {};
    let startedAt = 0;
    let finished = 0;
    const progressText = () => `Verificando… ${finished}/${assignments.length}`;
    const status = makeStatus(deps, bar, progressText);

    // force = Atualizar (relê tudo). Sem force = continua: o que já foi lido vem do cache e só o não verificado é consultado.
    async function scan(force) {
      bar.setSearched(true);
      bar.refresh.disabled = true; bar.retry.disabled = true; bar.download.disabled = true;
      deps.scanner.resetBudget();
      deps.governor.reset();
      if (needsDiscovery) {
        bar.status.textContent = 'Procurando as atividades deste curso…';
        try {
          const { doc: indexDoc, finalUrl } = await deps.governor.run(() => deps.fetchDoc(deps.pages.assignmentIndexUrl(courseId, win.location.origin)));
          assignments = deps.pages.collectAssignmentsFromIndex(indexDoc, finalUrl || url);
          assignments.forEach(attachBadge);
          needsDiscovery = false;
        } catch (error) {
          bar.status.textContent = `Não consegui listar as atividades do curso (${error && error.message ? error.message : error}). Tente de novo.`;
          bar.refresh.disabled = false;
          return null;
        }
        if (!assignments.length) {
          bar.status.textContent = 'Este curso não tem tarefas listadas pelo Moodle. Nada a corrigir aqui.';
          bar.refresh.disabled = false; needsDiscovery = true;
          return null;
        }
      }
      if (force) deps.cache.clear(assignments.map(a => a.assignmentId));
      assignments.forEach(a => { const b = badges.get(a.assignmentId); b.hidden = false; setBadge(b, null); });
      startedAt = Date.now(); finished = 0;
      status.clear(); status.refresh();
      const scan = await deps.scanner.scanAssignments(assignments, (a, r) => { finished += 1; setBadge(badges.get(a.assignmentId), r); status.refresh(); }, { force });
      last = scan;
      if (deps.pages.readCourseInfo) {
        const v = IMN.vigencia.classify(deps.pages.readCourseInfo(doc), { today: deps.now(), cardText: '' });
        vigenciaSlot.result = v;
        setVigencia(doc, bar.status, null, v, vigenciaSlot);
      }
      status.clear();
      deps.lastSummaryText = summaryText(scan.summary, 'atividade(s)');
      bar.status.textContent = deps.lastSummaryText;
      bar.refresh.disabled = false;
      bar.retry.disabled = false;
      bar.retry.hidden = scan.summary.unverified === 0;
      bar.download.disabled = !scan.results.some(r => r.state === 'ok' && r.count > 0);
      return scan;
    }

    bar.refresh.addEventListener('click', () => scan(true));
    bar.retry.addEventListener('click', () => scan(false));
    bar.download.addEventListener('click', () => {
      if (!last) return;
      const folder = pageName(doc, 'Curso');
      const entries = last.results.filter(r => r.state === 'ok' && r.count > 0).map(r => ({ assignment: r.assignment, count: r.count, folders: [folder], courseId: new URL(win.location.href).searchParams.get('id') || '', courseName: folder }));
      offerDownloads({ doc, win, bar, deps, entries, unverified: last.summary.unverified });
    });
    function diagnostics() {
      return {
        page: win.location.href,
        generatedAt: new Date().toISOString(),
        engine: engineInfo(deps, startedAt),
        courses: [{
          courseId: new URL(win.location.href).searchParams.get('id') || '',
          name: pageName(doc, 'Curso'),
          assignmentsFound: assignments.length,
          discoveredViaAssignIndex: assignments.some(a => a.fromAssignIndex),
          fromCourseIndex: assignments.filter(a => a.fromIndex).length,
          info: deps.pages.readCourseInfo ? deps.pages.readCourseInfo(doc) : null,
          activities: ((last && last.results) || []).map(x => ({ id: x.assignment.assignmentId, name: x.assignment.name, state: x.state, count: x.count, message: x.message }))
        }]
      };
    }
    wireDiagnostics(doc, win, bar, diagnostics);
    return { bar, badges, scan, assignments, diagnostics };
  }

  function initCategory(doc, win, deps) {
    const courses = deps.pages.collectCourses(doc, win.location.href);
    if (!courses.length) return null;
    const bar = createBar(doc, 'Pendências de correção (cursos desta página)');
    const main = doc.querySelector('[role="main"], #region-main') || doc.body;
    main.prepend(bar.el);
    const badges = new Map();
    for (const c of courses) {
      const badge = h(doc, 'span', { class: 'imn-badge imn-badge-loading', hidden: true }, 'Verificando…');
      badges.set(c.courseId, badge);
      (c.link.parentElement || c.link).append(' ', badge);
    }
    let last = [];
    const vigenciaSlots = new Map();
    let startedAt = 0;
    const progress = { courses: 0, acts: 0, actsDone: 0 };
    const progressText = () => `Verificando… ${progress.courses}/${courses.length} cursos lidos · ${progress.actsDone}/${progress.acts} atividades`;
    const status = makeStatus(deps, bar, progressText);

    async function scan(force) {
      bar.setSearched(true);
      bar.refresh.disabled = true; bar.retry.disabled = true; bar.download.disabled = true;
      deps.scanner.resetBudget();
      deps.governor.reset();
      startedAt = Date.now();
      Object.assign(progress, { courses: 0, acts: 0, actsDone: 0 });
      status.clear(); status.refresh();
      const done = await Promise.all(courses.map(async course => {
        badges.get(course.courseId).hidden = false;
        setBadge(badges.get(course.courseId), null);
        let total = 0; let finishedHere = 0;
        const badge = badges.get(course.courseId);
        try {
          const r = await deps.scanner.scanCourse(course, () => {
            finishedHere += 1; progress.actsDone += 1;
            if (total) badge.textContent = `Verificando… ${finishedHere}/${total}`;
            status.refresh();
          }, { force, onAssignments: list => { total = list.length; progress.acts += list.length; progress.courses += 1; badge.textContent = `Verificando… 0/${total}`; status.refresh(); } });
          const s = r.summary;
          let result;
          let detail = '';
          if (s.assignmentCount === 0) {
            // Nenhuma tarefa lida NÃO é "sem pendências": pode ser página que o app não soube ler.
            result = { state: 'empty', message: 'Nenhuma tarefa foi encontrada na página deste curso. Abra o curso para conferir.' };
            r.empty = true;
          } else if (s.partial && s.total === 0) {
            // total parcial igual a 0 não pode virar "Sem pendências": o que falhou pode ter pendência
            result = { state: 'error', message: `${s.unverified} atividade(s) não verificada(s).` };
          } else if (s.checked === 0 && s.noControl > 0) {
            result = { state: 'na', message: 'Nenhuma atividade deste curso mostra "Precisa de avaliação". Abra o curso se esperava pendências.' };
          } else {
            result = { state: 'ok', count: s.total };
            detail = s.partial ? `${s.unverified} atividade(s) não verificada(s): total parcial.` : `${s.activitiesPending} de ${s.assignmentCount} atividade(s) com pendência.`;
          }
          setBadge(badge, result, detail);
          if (s.partial && result.state === 'ok') badge.textContent += '*';
          const cardNode = course.link.closest ? course.link.closest('.coursebox, .card, .course-card, [data-courseid]') : null;
          r.vigencia = IMN.vigencia.classify(r.info, { today: deps.now(), cardText: deps.pages.readCourseCard ? deps.pages.readCourseCard(course.link) : '' });
          setVigencia(doc, badge.parentElement || course.link, cardNode, r.vigencia, vigenciaSlots.get(course.courseId) || vigenciaSlots.set(course.courseId, {}).get(course.courseId));
          return r;
        } catch (error) {
          progress.courses += 1;
          setBadge(badge, { state: 'error', message: error.message });
          return { course, assignments: [], results: [], summary: null, error };
        }
      }));
      last = done;
      const sums = done.filter(r => r.summary).map(r => r.summary);
      const agg = {
        total: sums.reduce((s, x) => s + x.total, 0),
        activitiesPending: sums.reduce((s, x) => s + x.activitiesPending, 0),
        noControl: sums.reduce((s, x) => s + (x.noControl || 0), 0),
        unverified: sums.reduce((s, x) => s + x.unverified, 0) + done.filter(r => !r.summary || r.empty).length
      };
      agg.partial = agg.unverified > 0;
      status.clear();
      deps.lastSummaryText = `${summaryText(agg, 'atividade(s)')}${agg.partial ? ' (* = parcial)' : ''}`;
      bar.status.textContent = deps.lastSummaryText;
      bar.refresh.disabled = false;
      bar.retry.disabled = false;
      bar.retry.hidden = agg.unverified === 0;
      bar.download.disabled = !done.some(r => r.results.some(x => x.state === 'ok' && x.count > 0));
      return done;
    }

    bar.refresh.addEventListener('click', () => scan(true));
    bar.retry.addEventListener('click', () => scan(false));
    bar.download.addEventListener('click', () => {
      const category = pageName(doc, 'Categoria');
      const entries = last.flatMap(r => r.results.filter(x => x.state === 'ok' && x.count > 0).map(x => ({ assignment: x.assignment, count: x.count, folders: [category, r.course.name], courseId: r.course.courseId, courseName: r.course.name })));
      const unverified = last.reduce((s, r) => s + (r.summary ? r.summary.unverified : 1), 0);
      offerDownloads({ doc, win, bar, deps, entries, unverified });
    });
    // Resumo do que foi lido, sem dados de alunos: serve para entender por que um curso apareceu como aparece.
    function diagnostics() {
      return {
        page: win.location.href,
        generatedAt: new Date().toISOString(),
        engine: engineInfo(deps, startedAt),
        courses: last.map(r => ({
          courseId: r.course.courseId,
          name: r.course.name,
          assignmentsFound: r.assignments ? r.assignments.length : 0,
          fromCourseIndex: r.assignments ? r.assignments.filter(a => a.fromIndex).length : 0,
          cardText: deps.pages.readCourseCard ? deps.pages.readCourseCard(r.course.link) : '',
          info: r.info || null,
          vigencia: r.vigencia ? { state: r.vigencia.state, label: r.vigencia.label, reason: r.vigencia.reason } : null,
          error: r.error ? r.error.message : undefined,
          activities: (r.results || []).map(x => ({ id: x.assignment.assignmentId, name: x.assignment.name, state: x.state, count: x.count, message: x.message }))
        }))
      };
    }
    wireDiagnostics(doc, win, bar, diagnostics);
    return { bar, badges, scan, courses, diagnostics };
  }

  function createDeps(win) {
    const governor = IMN.governor.createGovernor();
    const cache = IMN.cache.createCache({ origin: () => win.location.origin });
    const fetchDoc = (url, options = {}) => IMN.pages.fetchDocument(url, { origin: win.location.origin, ...options });
    const scanner = IMN.scanner.createScanner({ governor, cache, fetchDoc });
    win.addEventListener('pagehide', () => governor.cancel());
    return { governor, cache, fetchDoc, scanner, now: () => new Date(), pages: IMN.pages, downloads: IMN.downloads, lastSummaryText: '' };
  }

  root.IMN.radar = { initCourse, initCategory, createDeps, summaryText, badgeText, startBlobDownload, ICONS, IDLE_TEXT };
})(globalThis);

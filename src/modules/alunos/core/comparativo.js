// Comparativo entre leituras: guarda um instantâneo COMPACTO por UC (só números, sem nome nem e-mail) e compara com o anterior.
(function (root) {
  'use strict';
  const ALN = root.ALN;
  const MAX = 12;
  const JUNTAR_MIN = 10; // leituras seguidas em até 10 min viram um só instantâneo
  const r1 = v => (v == null || Number.isNaN(v) ? null : Math.round(v * 10) / 10);

  // students: lista do reader. [nota%, dias sem acesso, pendências (null se as entregas não foram lidas)]
  function instantaneo(students, now = Date.now()) {
    const a = {}; const notas = [];
    for (const s of students) {
      a[s.key] = [r1(s.totalPct), s.accessKnown && s.lastAccessDays != null ? s.lastAccessDays : null, s.ov && s.ov.readEntregas ? s.pendCount : null];
      if (s.totalPct != null) notas.push(s.totalPct);
    }
    return { at: new Date(now).toISOString(), n: students.length, media: notas.length ? r1(notas.reduce((x, y) => x + y, 0) / notas.length) : null, a };
  }
  function acrescentar(lista, snap) {
    const base = [...(lista || [])];
    const ult = base[base.length - 1];
    if (ult && Math.abs(Date.parse(snap.at) - Date.parse(ult.at)) < JUNTAR_MIN * 60000) base[base.length - 1] = snap; else base.push(snap);
    return base.slice(-MAX);
  }
  const delta = (antes, depois) => (antes == null || depois == null ? null : r1(depois - antes));

  // anterior × atual → linhas só dos alunos presentes nas duas leituras
  function comparar(anterior, atual) {
    const linhas = [];
    for (const [key, cur] of Object.entries(atual.a)) {
      const old = anterior.a[key]; if (!old) continue;
      const dn = delta(old[0], cur[0]); const dd = delta(old[1], cur[1]); const dp = delta(old[2], cur[2]);
      const piorou = (dn != null && dn <= -1) || (dp != null && dp > 0) || (dd != null && dd >= 3);
      const melhorou = !piorou && ((dn != null && dn >= 1) || (dp != null && dp < 0));
      linhas.push({ key, nota: { antes: old[0], depois: cur[0], delta: dn }, acesso: { antes: old[1], depois: cur[1], delta: dd }, pend: { antes: old[2], depois: cur[2], delta: dp }, piorou, melhorou });
    }
    linhas.sort((a, b) => Number(b.piorou) - Number(a.piorou) || (a.nota.delta ?? 0) - (b.nota.delta ?? 0));
    const novos = Object.keys(atual.a).filter(k => !anterior.a[k]).length; const sairam = Object.keys(anterior.a).filter(k => !atual.a[k]).length;
    return { desde: anterior.at, linhas, media: { antes: anterior.media, depois: atual.media, delta: delta(anterior.media, atual.media) }, novos, sairam, piorou: linhas.filter(l => l.piorou).length, melhorou: linhas.filter(l => l.melhorou).length };
  }
  async function listaDoCurso(courseKey) { const m = await ALN.storage.getKey(ALN.storage.K_LEITURAS); return m && Array.isArray(m[courseKey]) ? m[courseKey] : []; }
  // guarda o instantâneo e devolve o comparativo com a leitura anterior (ou null se for a primeira)
  async function registrar(courseKey, students, now = Date.now()) {
    const m = (await ALN.storage.getKey(ALN.storage.K_LEITURAS)) || {};
    const lista = Array.isArray(m[courseKey]) ? m[courseKey] : [];
    const snap = instantaneo(students, now);
    const anterior = lista.length && Math.abs(now - Date.parse(lista[lista.length - 1].at)) < JUNTAR_MIN * 60000 ? lista[lista.length - 2] : lista[lista.length - 1];
    await ALN.storage.setKey(ALN.storage.K_LEITURAS, { ...m, [courseKey]: acrescentar(lista, snap) });
    return anterior ? comparar(anterior, snap) : null;
  }
  // comparativo das duas últimas leituras já guardadas (ao abrir o painel sem ler de novo)
  async function ultimo(courseKey) { const l = await listaDoCurso(courseKey); return l.length >= 2 ? comparar(l[l.length - 2], l[l.length - 1]) : null; }
  ALN.comparativo = { MAX, instantaneo, acrescentar, comparar, registrar, ultimo, listaDoCurso };
})(globalThis);

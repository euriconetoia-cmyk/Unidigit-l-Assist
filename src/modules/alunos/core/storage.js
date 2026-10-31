// Camada única de armazenamento local (chrome.storage.local): versão de formato, migrações, medição, validade, backup.
// Só neste navegador; nada vai para a nuvem. Funções puras recebem os dados; as de E/S recebem a "área" (testável).
(function (root) {
  'use strict';
  const ALN = root.ALN;
  const APP_ID = 'unidigital-assist';
  const SCHEMA = 1;
  const META_KEY = 'uas.meta';
  const CONFIG_KEY = 'uas.config';
  const QUOTA = 10 * 1024 * 1024; // chrome.storage.local sem "unlimitedStorage"
  const AVISO = 0.7;
  // Tudo que a extensão guarda. Chave nova só entra aqui (e o backup/apagar/medir passam a enxergá-la).
  const K_CONTATOS = 'hub.contatos.v1', K_MODELOS = 'uas.modelos', K_RETORNOS = 'uas.retornos', K_LEITURAS = 'uas.leituras', K_AJUSTES = 'uas.ajustes';
  const KEYS = [
    { key: K_CONTATOS, categoria: 'Contatos', rotulo: 'Registro de mensagens enviadas' },
    { key: K_MODELOS, categoria: 'Modelos', rotulo: 'Modelos de mensagem' },
    { key: K_RETORNOS, categoria: 'Retornos', rotulo: 'Retornos agendados' },
    { key: K_LEITURAS, categoria: 'Leituras', rotulo: 'Instantâneos para o comparativo' },
    { key: K_AJUSTES, categoria: 'Ajustes', rotulo: 'Ajustes por UC' }
  ];
  const DEFAULT_CONFIG = { validadeContatosDias: 365, validadeLeiturasDias: 84 };
  const VALIDADES = [{ dias: 90, rotulo: '3 meses' }, { dias: 180, rotulo: '6 meses' }, { dias: 365, rotulo: '12 meses' }, { dias: 0, rotulo: 'nunca expirar' }];
  const VALIDADES_LEITURAS = [{ dias: 28, rotulo: '4 semanas' }, { dias: 84, rotulo: '12 semanas' }, { dias: 180, rotulo: '6 meses' }, { dias: 0, rotulo: 'nunca expirar' }];
  const DAY = 86400000;

  const known = key => KEYS.some(k => k.key === key);
  const bytesOf = v => { const s = JSON.stringify(v === undefined ? null : v); return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : s.length; };
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

  // ---- migrações: cada passo leva do formato N para N+1 e é puro ----
  const MIGRATIONS = { 0: all => all }; // 0 → 1: só passa a gravar a versão
  function migrate(all) {
    const out = { ...all };
    const meta = isObj(out[META_KEY]) ? out[META_KEY] : {};
    let v = Number.isInteger(meta.schema) ? meta.schema : 0;
    const start = v;
    if (v > SCHEMA) return { all: out, mudou: false, futuro: true, de: start, para: v };
    let cur = out;
    while (v < SCHEMA) { cur = MIGRATIONS[v](cur); v += 1; }
    cur[META_KEY] = { ...meta, schema: SCHEMA };
    return { all: cur, mudou: start !== SCHEMA, futuro: false, de: start, para: SCHEMA };
  }

  const configOf = all => ({ ...DEFAULT_CONFIG, ...(isObj(all[CONFIG_KEY]) ? all[CONFIG_KEY] : {}) });

  // ---- validade: tira registros de contato mais antigos que o prazo ----
  function pruneContatos(contatos, now, dias) {
    if (!isObj(contatos) || !dias) return { value: contatos, removidos: 0 };
    const limite = now - dias * DAY; let removidos = 0; const out = {};
    for (const [curso, alunos] of Object.entries(contatos)) {
      if (!isObj(alunos)) continue;
      const novo = {};
      for (const [aluno, lista] of Object.entries(alunos)) {
        const mant = (Array.isArray(lista) ? lista : []).filter(e => { const t = Date.parse(e && e.at); return !(Number.isFinite(t) && t < limite); });
        removidos += (Array.isArray(lista) ? lista.length : 0) - mant.length;
        if (mant.length) novo[aluno] = mant;
      }
      if (Object.keys(novo).length) out[curso] = novo;
    }
    return { value: out, removidos };
  }
  const hoje = now => { const d = new Date(now); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  // porUc: { [curso]: dias } sobrepõe o prazo geral nas UCs com ajuste próprio (0 = nunca expirar nessa UC)
  function pruneLeituras(map, now, dias, porUc = {}) {
    if (!isObj(map)) return { value: map, removidos: 0 };
    let removidos = 0; const out = {};
    for (const [curso, lista] of Object.entries(map)) {
      const d = Number.isFinite(porUc[curso]) ? porUc[curso] : dias;
      if (!d) { if (Array.isArray(lista) && lista.length) out[curso] = lista; continue; }
      const limite = now - d * DAY;
      const mant = (Array.isArray(lista) ? lista : []).filter(x => { const t = Date.parse(x && x.at); return !(Number.isFinite(t) && t < limite); });
      removidos += (Array.isArray(lista) ? lista.length : 0) - mant.length;
      if (mant.length) out[curso] = mant;
    }
    return { value: out, removidos };
  }
  // retornos: feitos há mais de 60 dias e vencidos e não feitos há mais de 365 dias saem
  function pruneRetornos(map, now) {
    if (!isObj(map)) return { value: map, removidos: 0 };
    const h = hoje(now); const feitoLim = hoje(now - 60 * DAY); const velhoLim = hoje(now - 365 * DAY); let removidos = 0; const out = {};
    for (const [curso, lista] of Object.entries(map)) {
      const mant = (Array.isArray(lista) ? lista : []).filter(r => isObj(r) && !(r.feito ? String(r.feito) < feitoLim : String(r.em) < velhoLim));
      removidos += (Array.isArray(lista) ? lista.length : 0) - mant.length;
      if (mant.length) out[curso] = mant;
    }
    void h;
    return { value: out, removidos };
  }
  function prune(all, now) {
    const cfg = configOf(all); let out = all; let removidos = 0;
    const apply = (key, fn) => { if (!(key in out)) return; const r = fn(out[key]); if (r.removidos) { out = { ...out, [key]: r.value }; removidos += r.removidos; } };
    apply(K_CONTATOS, v => pruneContatos(v, now, cfg.validadeContatosDias));
    const aj = isObj(out[K_AJUSTES]) && isObj(out[K_AJUSTES].ucs) ? out[K_AJUSTES].ucs : {};
    const porUc = Object.fromEntries(Object.entries(aj).filter(([, v]) => isObj(v) && Number.isFinite(v.validadeLeiturasDias)).map(([k, v]) => [k, v.validadeLeiturasDias]));
    apply(K_LEITURAS, v => pruneLeituras(v, now, cfg.validadeLeiturasDias, porUc));
    apply(K_RETORNOS, v => pruneRetornos(v, now));
    return { all: out, removidos };
  }

  // ---- medição ----
  const len = l => (Array.isArray(l) ? l.length : 0);
  function contar(key, v) {
    if (key === K_CONTATOS && isObj(v)) return Object.values(v).reduce((n, a) => n + (isObj(a) ? Object.values(a).reduce((m, l) => m + len(l), 0) : 0), 0);
    if ((key === K_RETORNOS || key === K_LEITURAS) && isObj(v)) return Object.values(v).reduce((n, l) => n + len(l), 0);
    if (key === K_MODELOS && isObj(v)) return len(v.itens);
    if (key === K_AJUSTES && isObj(v)) return isObj(v.ucs) ? Object.keys(v.ucs).length : 0;
    return 0;
  }
  function usage(all) {
    const cats = new Map();
    for (const k of KEYS) {
      if (!(k.key in all)) continue;
      const c = cats.get(k.categoria) || { categoria: k.categoria, bytes: 0, itens: 0, rotulo: k.rotulo };
      c.bytes += bytesOf(all[k.key]);
      const v = all[k.key];
      c.itens += contar(k.key, v);
      cats.set(k.categoria, c);
    }
    const total = [...cats.values()].reduce((n, c) => n + c.bytes, 0);
    return { categorias: [...cats.values()], total, quota: QUOTA, fracao: total / QUOTA, aviso: total / QUOTA >= AVISO };
  }
  const fmtBytes = n => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1).replace('.', ',')} MB`);

  // ---- backup ----
  function exportBackup(all, now, versao) {
    const dados = {};
    for (const k of KEYS) if (k.key in all) dados[k.key] = all[k.key];
    dados[CONFIG_KEY] = configOf(all);
    return JSON.stringify({ app: APP_ID, schema: SCHEMA, versao: versao || '', criadoEm: new Date(now).toISOString(), dados }, null, 2);
  }
  const MAX_BACKUP = 8 * 1024 * 1024;
  function parseBackup(text) {
    if (typeof text !== 'string' || !text.trim()) return { ok: false, erro: 'O arquivo está vazio.' };
    if (text.length > MAX_BACKUP) return { ok: false, erro: 'O arquivo é grande demais para ser um backup desta extensão.' };
    let j; try { j = JSON.parse(text); } catch (_) { return { ok: false, erro: 'O arquivo não é um backup válido (JSON ilegível).' }; }
    if (!isObj(j) || j.app !== APP_ID) return { ok: false, erro: 'Este arquivo não é um backup do Unidigit@l Assist.' };
    if (!Number.isInteger(j.schema) || j.schema < 0) return { ok: false, erro: 'O backup não informa a versão do formato.' };
    if (j.schema > SCHEMA) return { ok: false, erro: 'Este backup foi feito por uma versão mais nova da extensão. Atualize a extensão e tente de novo.' };
    if (!isObj(j.dados)) return { ok: false, erro: 'O backup não tem dados.' };
    const m = migrate({ ...j.dados, [META_KEY]: { schema: j.schema } }).all;
    const dados = {};
    for (const k of Object.keys(j.dados)) {
      if (k === CONFIG_KEY) { if (isObj(j.dados[k])) dados[k] = { ...DEFAULT_CONFIG, ...pick(j.dados[k]) }; } else if (known(k)) dados[k] = j.dados[k];
    }
    void m;
    return { ok: true, dados, criadoEm: j.criadoEm || '', versao: j.versao || '', resumo: usage(dados) };
  }
  const pick = c => { const o = {}; for (const k of ['validadeContatosDias', 'validadeLeiturasDias']) if (Number.isFinite(c[k]) && c[k] >= 0 && c[k] <= 3650) o[k] = Math.floor(c[k]); return o; };
  // junta os contatos do backup com os atuais (sem duplicar), respeitando o limite por aluno
  function mergeContatos(atual, novo, keep = 5) {
    const out = {};
    for (const src of [atual, novo]) {
      if (!isObj(src)) continue;
      for (const [curso, alunos] of Object.entries(src)) {
        if (!isObj(alunos)) continue;
        out[curso] = out[curso] || {};
        for (const [aluno, lista] of Object.entries(alunos)) {
          const seen = new Set((out[curso][aluno] || []).map(e => JSON.stringify(e)));
          const add = (Array.isArray(lista) ? lista : []).filter(e => isObj(e) && !seen.has(JSON.stringify(e)));
          out[curso][aluno] = [...(out[curso][aluno] || []), ...add].sort((a, b) => String(a.at).localeCompare(String(b.at))).slice(-keep);
        }
      }
    }
    return out;
  }
  const mergeListas = (atual, novo, chave, max) => {
    const out = {};
    for (const src of [atual, novo]) {
      if (!isObj(src)) continue;
      for (const [curso, lista] of Object.entries(src)) {
        const base = out[curso] || []; const seen = new Set(base.map(chave));
        out[curso] = [...base, ...(Array.isArray(lista) ? lista : []).filter(x => isObj(x) && !seen.has(chave(x)) && seen.add(chave(x)))];
      }
    }
    for (const c of Object.keys(out)) { out[c].sort((a, b) => String(a.at || a.em).localeCompare(String(b.at || b.em))); if (max) out[c] = out[c].slice(-max); }
    return out;
  };
  const mergeModelos = (atual, novo) => { const itens = [...(isObj(atual) && Array.isArray(atual.itens) ? atual.itens : [])]; const ids = new Set(itens.map(m => m.id)); for (const m of (isObj(novo) && Array.isArray(novo.itens) ? novo.itens : [])) if (isObj(m) && m.id && !ids.has(m.id)) { itens.push(m); ids.add(m.id); } return { itens }; };
  function applyImport(all, dados, modo) {
    const out = { ...all };
    for (const [k, v] of Object.entries(dados)) {
      if (k === CONFIG_KEY) out[k] = { ...configOf(all), ...v };
      else if (modo === 'substituir') out[k] = v;
      else if (k === K_CONTATOS) out[k] = mergeContatos(all[k], v);
      else if (k === K_RETORNOS) out[k] = mergeListas(all[k], v, r => `${r.aluno}|${r.em}`);
      else if (k === K_LEITURAS) out[k] = mergeListas(all[k], v, r => String(r.at), 12);
      else if (k === K_MODELOS) out[k] = mergeModelos(all[k], v);
      else if (k === K_AJUSTES) out[k] = { padrao: { ...((all[k] || {}).padrao || {}), ...((isObj(v) && v.padrao) || {}) }, ucs: { ...((isObj(v) && v.ucs) || {}), ...((all[k] || {}).ucs || {}) } };
      else out[k] = v;
    }
    return out;
  }

  // ---- E/S (área = chrome.storage.local ou equivalente) ----
  const ownKeys = () => [META_KEY, CONFIG_KEY, ...KEYS.map(k => k.key)];
  const area = () => (root.chrome && root.chrome.storage && root.chrome.storage.local) || null;
  async function readAll(a = area()) { if (!a) return {}; return a.get(ownKeys()); }
  async function init(a = area(), now = Date.now()) {
    if (!a) return { all: {}, mudou: false };
    const all = await readAll(a);
    const m = migrate(all);
    let cur = m.all, removidos = 0;
    if (!m.futuro) { const p = prune(cur, now); cur = p.all; removidos = p.removidos; }
    if (!m.futuro && (m.mudou || removidos)) await a.set(Object.fromEntries(Object.entries(cur).filter(([k]) => ownKeys().includes(k))));
    return { all: cur, mudou: m.mudou, removidos, futuro: m.futuro };
  }
  async function getKey(key, a = area()) { if (!a || !known(key)) return undefined; const o = await a.get([key]); return o[key]; }
  async function setKey(key, value, a = area()) { if (!a || !known(key)) throw new Error('Chave de armazenamento desconhecida.'); await a.set({ [key]: value }); }
  async function clearAll(a = area()) { if (!a) return; await a.remove(KEYS.map(k => k.key)); }
  async function saveConfig(cfg, a = area()) { if (!a) return; const all = await readAll(a); await a.set({ [CONFIG_KEY]: { ...configOf(all), ...pick(cfg) } }); }
  async function writeImport(all, a = area()) { if (!a) return; await a.set(Object.fromEntries(Object.entries(all).filter(([k]) => ownKeys().includes(k)))); }

  ALN.storage = { SCHEMA, QUOTA, AVISO, KEYS, K_CONTATOS, K_MODELOS, K_RETORNOS, K_LEITURAS, K_AJUSTES, VALIDADES, VALIDADES_LEITURAS, hoje, getKey, setKey, pruneLeituras, pruneRetornos, DEFAULT_CONFIG, META_KEY, CONFIG_KEY, migrate, configOf, prune, pruneContatos, usage, fmtBytes, exportBackup, parseBackup, mergeContatos, applyImport, init, readAll, clearAll, saveConfig, writeImport };
})(globalThis);

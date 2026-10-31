// Painel lateral: editor Blockly + execução. Nada roda sem o clique em Executar.
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as PtBr from 'blockly/msg/pt-br';
import { registerBlocks, TOOLBOX, EXAMPLES } from '../blocks/definitions.js';
import { run } from '../engine/interpreter.js';
import { makeActions } from './actions.js';
import { createModuleHost } from '../host/modules.js';
import { resolveTab } from './tabs.js';

Blockly.setLocale(PtBr);
registerBlocks();

const $ = id => document.getElementById(id);
const els = { run: $('run'), stop: $('stop'), examples: $('examples'), saved: $('saved'), name: $('name'), save: $('save'), del: $('delete'), clear: $('clear'), log: $('log'), state: $('state') };

const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
const workspace = Blockly.inject('editor', {
  toolbox: TOOLBOX, media: 'media/', trashcan: true, grid: { spacing: 24, length: 3, colour: dark ? '#33415a' : '#d5dde8', snap: true },
  zoom: { controls: true, wheel: true, startScale: 0.9 }, move: { scrollbars: true, drag: true, wheel: false }, sounds: false
});

// ---- registro ----
function log({ level = 'info', text }) {
  const li = document.createElement('li');
  li.className = level;
  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString('pt-BR');
  const span = document.createElement('span');
  span.textContent = text;
  li.append(time, span);
  els.log.append(li);
  li.scrollIntoView({ block: 'end' });
}
const setState = text => { els.state.textContent = text; };

// ---- armazenamento local (programas salvos e rascunho) ----
const store = {
  async get(key, fallback) { try { const o = await chrome.storage.local.get(key); return o[key] ?? fallback; } catch (_) { return fallback; } },
  async set(key, value) { try { await chrome.storage.local.set({ [key]: value }); } catch (_) { /* sem armazenamento: segue sem salvar */ } }
};
const snapshot = () => Blockly.serialization.workspaces.save(workspace);
const load = json => { Blockly.serialization.workspaces.load(json, workspace); };

async function refreshSaved(selected = '') {
  const programs = await store.get('programas', {});
  els.saved.replaceChildren(new Option('Meus programas…', ''), ...Object.keys(programs).sort().map(n => new Option(n, n)));
  els.saved.value = selected;
  els.del.disabled = !selected;
}
let draftTimer = 0;
workspace.addChangeListener(event => {
  if (event.isUiEvent) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => store.set('rascunho', snapshot()), 600);
});

els.examples.append(...Object.keys(EXAMPLES).map(n => new Option(n, n)));
els.examples.addEventListener('change', () => {
  const make = EXAMPLES[els.examples.value];
  if (make) { load(make()); setState('Exemplo carregado. Clique em Executar quando quiser.'); }
  els.examples.value = '';
});
els.saved.addEventListener('change', async () => {
  const name = els.saved.value;
  els.del.disabled = !name;
  if (!name) return;
  const programs = await store.get('programas', {});
  if (programs[name]) { load(programs[name]); els.name.value = name; setState(`Programa "${name}" carregado.`); }
});
els.save.addEventListener('click', async () => {
  const name = els.name.value.trim();
  if (!name) { setState('Dê um nome ao programa para salvar.'); els.name.focus(); return; }
  const programs = await store.get('programas', {});
  programs[name] = snapshot();
  await store.set('programas', programs);
  await refreshSaved(name);
  setState(`Programa "${name}" salvo neste navegador.`);
});
els.del.addEventListener('click', async () => {
  const name = els.saved.value;
  if (!name) return;
  const programs = await store.get('programas', {});
  delete programs[name];
  await store.set('programas', programs);
  await refreshSaved('');
  setState(`Programa "${name}" excluído.`);
});
els.clear.addEventListener('click', () => { workspace.clear(); els.log.replaceChildren(); setState('Editor limpo.'); });

// ---- execução ----
let controller = null;
const host = createModuleHost(chrome);
const actions = makeActions({ getTab: () => resolveTab(chrome, location.search), host, log });

async function execute() {
  if (controller) return;
  controller = new AbortController();
  els.run.disabled = true; els.stop.disabled = false;
  els.log.replaceChildren();
  setState('Executando…');
  log({ level: 'run', text: 'Programa iniciado.' });
  const result = await run(snapshot(), actions, {
    signal: controller.signal,
    log,
    onBlock: id => { try { workspace.highlightBlock(id); } catch (_) { /* realce é só visual */ } }
  });
  try { workspace.highlightBlock(null); } catch (_) { /* idem */ }
  if (result.status === 'ok') { log({ level: 'ok', text: `Programa concluído (${result.steps} passo(s)).` }); setState('Concluído.'); }
  else if (result.status === 'parado') { log({ level: 'warn', text: 'Execução interrompida por você.' }); setState('Parado.'); }
  else {
    log({ level: 'error', text: result.message });
    const block = result.blockId && workspace.getBlockById(result.blockId);
    if (block) block.select();
    setState('Erro. Veja o registro.');
  }
  controller = null;
  els.run.disabled = false; els.stop.disabled = true;
}
els.run.addEventListener('click', execute);
els.stop.addEventListener('click', () => { if (controller) { controller.abort(); setState('Parando…'); } });

// ---- início: restaura o rascunho (só o desenho dos blocos; nada é executado) ----
(async () => {
  await refreshSaved('');
  const draft = await store.get('rascunho', null);
  if (draft) { try { load(draft); } catch (_) { /* rascunho inválido: começa vazio */ } }
  else load(EXAMPLES['Buscar pendências e registrar o total']());
})();

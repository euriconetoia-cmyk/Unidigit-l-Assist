import test from 'node:test';
import assert from 'node:assert/strict';
import { makeActions } from '../src/sidepanel/actions.js';
import { createModuleHost } from '../src/host/modules.js';
import { resolveTab } from '../src/sidepanel/tabs.js';
import { run } from '../src/engine/interpreter.js';

let n = 0; const id = () => `a${++n}`;
const ws = (...blocks) => { for (let i = 0; i < blocks.length - 1; i += 1) blocks[i].next = { block: blocks[i + 1] }; return { blocks: { blocks: [{ type: 'hub_inicio', id: id(), x: 0, y: 0, inputs: { DO: { block: blocks[0] } } }] } }; };
const b = (type, extra = {}) => ({ type, id: id(), ...extra });

function fakeHost(handlers) {
  const calls = [];
  return { calls, host: { call: async (tabId, module, command, args) => { calls.push([tabId, module, command]); if (!handlers[command]) throw new Error(`sem ${command}`); return handlers[command](args); } } };
}

test('buscar guarda o resultado; "total" e "parcial" leem a última busca', async () => {
  const { host, calls } = fakeHost({ 'radar.buscar': async () => ({ total: 7, atividadesComPendencia: 2, naoVerificadas: 0, parcial: false }), 'radar.baixar': async () => ({ iniciado: true }) });
  const logs = [];
  const actions = makeActions({ getTab: async () => ({ id: 5 }), host, log: e => logs.push(e.text) });
  const total = { block: b('imn_total') };
  const se = b('controls_if', { inputs: { IF0: { block: b('logic_compare', { fields: { OP: 'GT' }, inputs: { A: total, B: { shadow: b('math_number', { fields: { NUM: 0 } }) } } }) }, DO0: { block: b('imn_baixar') } } });
  const r = await run(ws(b('imn_buscar'), se), actions, { log: e => logs.push(e.text) });
  assert.equal(r.status, 'ok');
  assert.deepEqual(calls.map(c => c[2]), ['radar.buscar', 'radar.baixar']);
  assert.ok(calls.every(c => c[0] === 5 && c[1] === 'importar-notas'));
  assert.ok(logs.some(t => /7 pendência/.test(t)));
});

test('"total de pendências" sem buscar antes: erro claro no bloco', async () => {
  const { host } = fakeHost({});
  const actions = makeActions({ getTab: async () => ({ id: 1 }), host, log() {} });
  const r = await run(ws(b('hub_registrar', { inputs: { TEXTO: { block: b('imn_total') } } })), actions);
  assert.equal(r.status, 'erro');
  assert.match(r.message, /buscar pendências/);
});

test('erro do módulo (página errada) chega ao registro como erro do bloco', async () => {
  const { host } = fakeHost({ 'radar.buscar': async () => { throw new Error('Abra uma página de curso ou de categoria do Moodle.'); } });
  const actions = makeActions({ getTab: async () => ({ id: 1 }), host, log() {} });
  const r = await run(ws(b('imn_buscar')), actions);
  assert.equal(r.status, 'erro');
  assert.match(r.message, /curso ou de categoria/);
});

test('aba fora do Moodle permitido é recusada; ?tab= escolhe a aba', async () => {
  const mk = url => ({ tabs: { query: async () => [{ id: 1, url }], get: async i => ({ id: i, url: 'https://ead.fieg.com.br/course/view.php?id=3' }) } });
  await assert.rejects(resolveTab(mk('https://example.com/'), ''), /Abra uma página do Moodle/);
  await assert.rejects(resolveTab(mk(undefined), ''), /Abra uma página do Moodle/);
  assert.equal((await resolveTab(mk('https://ead.senai.br/my/'), '')).id, 1);
  assert.equal((await resolveTab(mk('https://example.com/'), '?tab=9')).id, 9);
});

test('injeção sob demanda: só injeta quando o módulo ainda não está na página, e só uma vez', async () => {
  const injected = []; let present = false;
  const chromeApi = {
    runtime: { getURL: p => `chrome-extension://x/${p}` },
    scripting: {
      executeScript: async opts => {
        if (opts.files) { injected.push(opts.files); present = true; return []; }
        if (opts.args && opts.args.length === 1) return [{ result: present }];
        return [{ result: { ok: true, value: { tipo: 'curso' } } }];
      },
      insertCSS: async () => {}
    }
  };
  const host = createModuleHost(chromeApi, { fetchJson: async () => ({ scripts: ['src/a.js', 'src/b.js'], css: ['src/s.css'] }) });
  assert.deepEqual(await host.call(1, 'importar-notas', 'pagina.info'), { tipo: 'curso' });
  await host.call(1, 'importar-notas', 'pagina.info');
  assert.equal(injected.length, 1);
  assert.deepEqual(injected[0], ['modules/importar-notas/vendor/src/a.js', 'modules/importar-notas/vendor/src/b.js', 'modules/importar-notas/bridge.js']);
  await assert.rejects(host.ensureInjected(1, 'outro'), /Módulo desconhecido/);
});

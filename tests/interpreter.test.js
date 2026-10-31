import test from 'node:test';
import assert from 'node:assert/strict';
import { run, findStarts, StopError } from '../src/engine/interpreter.js';

let n = 0;
const id = () => `b${++n}`;
const num = v => ({ block: { type: 'math_number', id: id(), fields: { NUM: v } } });
const txt = v => ({ block: { type: 'text', id: id(), fields: { TEXT: v } } });
const reg = value => ({ type: 'hub_registrar', id: id(), inputs: { TEXTO: value } });
const chain = (...blocks) => { for (let i = 0; i < blocks.length - 1; i += 1) blocks[i].next = { block: blocks[i + 1] }; return blocks[0]; };
const start = (...blocks) => ({ type: 'hub_inicio', id: id(), x: 0, y: 0, inputs: blocks.length ? { DO: { block: chain(...blocks) } } : {} });
const ws = (...tops) => ({ blocks: { languageVersion: 0, blocks: tops } });
const collect = () => { const lines = []; return { lines, log: e => lines.push(e.text) }; };
const noSleep = async () => {};

test('executa os blocos em sequência e registra', async () => {
  const { lines, log } = collect();
  const r = await run(ws(start(reg(txt('um')), reg(txt('dois')))), {}, { log });
  assert.equal(r.status, 'ok');
  assert.deepEqual(lines, ['um', 'dois']);
});

test('sem o bloco "Quando clicar em Executar": erro claro e nada roda', async () => {
  const { lines, log } = collect();
  const r = await run(ws(reg(txt('solto'))), {}, { log });
  assert.equal(r.status, 'erro');
  assert.match(r.message, /Quando clicar em Executar/);
  assert.deepEqual(lines, []);
});

test('se / senão se / senão com comparação', async () => {
  const cmp = (a, op, b) => ({ block: { type: 'logic_compare', id: id(), fields: { OP: op }, inputs: { A: a, B: b } } });
  const ifBlock = value => ({ type: 'controls_if', id: id(), extraState: { elseIfCount: 1, hasElse: true }, inputs: {
    IF0: cmp(num(value), 'GT', num(5)), DO0: { block: reg(txt('grande')) },
    IF1: cmp(num(value), 'EQ', num(5)), DO1: { block: reg(txt('igual')) },
    ELSE: { block: reg(txt('pequeno')) } } });
  for (const [v, esperado] of [[9, 'grande'], [5, 'igual'], [1, 'pequeno']]) {
    const { lines, log } = collect();
    await run(ws(start(ifBlock(v))), {}, { log });
    assert.deepEqual(lines, [esperado]);
  }
});

test('repetir N vezes; passar do limite de repetições é erro', async () => {
  const rep = times => ({ type: 'controls_repeat_ext', id: id(), inputs: { TIMES: num(times), DO: { block: reg(txt('x')) } } });
  const a = collect();
  assert.equal((await run(ws(start(rep(3))), {}, { log: a.log })).status, 'ok');
  assert.equal(a.lines.length, 3);
  const r = await run(ws(start(rep(999))), {}, { limits: { maxRepeat: 10 } });
  assert.equal(r.status, 'erro');
  assert.match(r.message, /limite/);
});

test('limite de passos interrompe laço enorme (sem travar)', async () => {
  const rep = { type: 'controls_repeat_ext', id: id(), inputs: { TIMES: num(100), DO: { block: reg(txt('x')) } } };
  const r = await run(ws(start(rep)), {}, { limits: { maxSteps: 50 } });
  assert.equal(r.status, 'erro');
  assert.match(r.message, /Limite de 50 passos/);
});

test('ação de módulo: bloco de instrução e bloco de valor usados no "se"', async () => {
  const calls = [];
  const actions = {
    imn_buscar: async () => { calls.push('buscar'); },
    imn_total: async () => 4,
    imn_baixar: async () => { calls.push('baixar'); }
  };
  const total = { block: { type: 'imn_total', id: id() } };
  const se = { type: 'controls_if', id: id(), inputs: { IF0: { block: { type: 'logic_compare', id: id(), fields: { OP: 'GT' }, inputs: { A: total, B: num(0) } } }, DO0: { block: { type: 'imn_baixar', id: id() } } } };
  const r = await run(ws(start({ type: 'imn_buscar', id: id() }, se)), actions);
  assert.equal(r.status, 'ok');
  assert.deepEqual(calls, ['buscar', 'baixar']);
});

test('erro de uma ação vira erro do bloco, com o id para destacar', async () => {
  const bloco = { type: 'imn_buscar', id: 'alvo' };
  const r = await run(ws(start(bloco)), { imn_buscar: async () => { throw new Error('Abra uma página do Moodle.'); } });
  assert.equal(r.status, 'erro');
  assert.equal(r.blockId, 'alvo');
  assert.match(r.message, /Abra uma página/);
});

test('Parar interrompe durante a espera e não executa os blocos seguintes', async () => {
  const { lines, log } = collect();
  const ac = new AbortController();
  const esperar = { type: 'hub_esperar', id: id(), inputs: { SEGUNDOS: num(30) } };
  const promise = run(ws(start(reg(txt('antes')), esperar, reg(txt('depois')))), {}, { log, signal: ac.signal });
  setTimeout(() => ac.abort(), 20);
  const r = await promise;
  assert.equal(r.status, 'parado');
  assert.deepEqual(lines, ['antes']);
});

test('espera passando do limite por bloco é recusada; a espera usa o sleep injetado', async () => {
  const esperar = s => ({ type: 'hub_esperar', id: id(), inputs: { SEGUNDOS: num(s) } });
  assert.equal((await run(ws(start(esperar(500))), {}, { limits: { maxWaitMs: 60000 }, sleep: noSleep })).status, 'erro');
  let slept = 0;
  await run(ws(start(esperar(2))), {}, { sleep: async ms => { slept = ms; } });
  assert.equal(slept, 2000);
});

test('bloco desconhecido: erro explicando; valor faltando: erro claro', async () => {
  const a = await run(ws(start({ type: 'bloco_que_nao_existe', id: id() })));
  assert.match(a.message, /ainda não é suportado/);
  const b = await run(ws(start({ type: 'controls_if', id: id(), inputs: {} })));
  assert.match(b.message, /Falta encaixar/);
});

test('vários blocos iniciais executam de cima para baixo; findStarts os acha', async () => {
  const { lines, log } = collect();
  const a = start(reg(txt('A'))); a.y = 200;
  const b = start(reg(txt('B'))); b.y = 10;
  assert.equal(findStarts(ws(a, b)).length, 2);
  await run(ws(a, b), {}, { log });
  assert.deepEqual(lines, ['B', 'A']);
});

test('StopError é exportado para as ações', () => { assert.ok(new StopError() instanceof Error); });

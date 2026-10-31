import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODELO_KAHOOT } from '../src/apps.js';
import { temPermissao, pedirPermissao, abasDoEditor, prepararAba, abrirEditor } from '../src/kahoot/pagina.js';

const mod = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/modules/kahoot');
const files = JSON.parse(fs.readFileSync(path.join(mod, 'files.json'), 'utf8')).scripts.filter(f => f !== 'ui.js');
const eq = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));

// Editor do Kahoot simulado com os mesmos seletores que o módulo usa (nada é carregado de fora).
function editor({ preenchido = false, semAdd = false } = {}) {
  const html = `<!doctype html><body><div id="side"><div data-functional-selector="sidebar-block">Pergunta 1</div></div>
  <div id="ed"><div contenteditable="true" data-functional-selector="question-title__input">${preenchido ? 'Já existe' : ''}</div>
  ${[0, 1, 2, 3].map(i => `<div data-functional-selector="question-answer"><div contenteditable="true" data-functional-selector="question-answer__input"></div><button data-functional-selector="question-answer__toggle-button" aria-checked="false"></button></div>`).join('')}</div>
  ${semAdd ? '' : '<button data-functional-selector="add-question-button">Add</button>'}</body>`;
  const dom = new JSDOM(html, { url: 'https://create.kahoot.it/creator/1', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.Element.prototype.getBoundingClientRect = function () { return { width: 10, height: 10, x: 0, y: 0, top: 0, left: 0, right: 10, bottom: 10 }; };
  w.document.execCommand = () => false; // força o caminho alternativo de escrita
  w.document.querySelectorAll('[data-functional-selector="question-answer__toggle-button"]').forEach(b => b.addEventListener('click', () => { const on = b.getAttribute('aria-checked') === 'true'; w.document.querySelectorAll('[data-functional-selector="question-answer__toggle-button"]').forEach(x => x.setAttribute('aria-checked', 'false')); b.setAttribute('aria-checked', String(!on)); }));
  const add = w.document.querySelector('[data-functional-selector="add-question-button"]');
  if (add) add.addEventListener('click', () => {
    const side = w.document.getElementById('side'); const d = w.document.createElement('div'); d.setAttribute('data-functional-selector', 'sidebar-block'); d.textContent = `Pergunta ${side.children.length + 1}`; side.append(d);
    w.document.querySelectorAll('#ed [contenteditable]').forEach(e => { e.textContent = ''; });
    w.document.querySelectorAll('[data-functional-selector="question-answer__toggle-button"]').forEach(b => b.setAttribute('aria-checked', 'false'));
  });
  for (const f of files) w.eval(fs.readFileSync(path.join(mod, f), 'utf8'));
  return w;
}
const Q = (n, extra = {}) => ({ question: `Pergunta ${n}?`, answers: ['A1', 'B1', 'C1', 'D1'].map(x => `${x}-${n}`), correctIndex: n % 4, line: n + 1, ...extra });

test('CSV: aceita ; , e TAB, BOM, aspas e nomes de coluna variados', () => {
  const { parse } = editor().KHT;
  for (const d of [';', ',', '\t']) {
    const r = parse.parseQuestions(`﻿pergunta${d}opcao1${d}opcao2${d}opcao3${d}opcao4${d}correta\n"Quanto é 2${d}3?"${d}5${d}6${d}7${d}8${d}A\n`);
    assert.equal(r.questions.length, 1); assert.equal(r.questions[0].question, `Quanto é 2${d}3?`.replace("\t", " ")); assert.equal(r.questions[0].correctIndex, 0);
  }
  const alias = parse.parseQuestions('Enunciado;a;b;c;d;gabarito\nX;1;2;3;4;3\n'); assert.equal(alias.questions[0].correctIndex, 2);
  const texto = parse.parseQuestions('pergunta;opcao1;opcao2;opcao3;opcao4;correta\nX;sim;não;talvez;nunca;talvez\n'); assert.equal(texto.questions[0].correctIndex, 2);
});

test('CSV: valida linha a linha (vazia, opções, correta, tamanhos) sem perder as boas', () => {
  const { parse } = editor().KHT;
  const r = parse.parseQuestions(['pergunta;opcao1;opcao2;opcao3;opcao4;correta', 'Boa?;a;b;c;d;1', 'Sem correta?;a;b;c;d;', 'Poucas?;a;b;;;2', `${'x'.repeat(130)};a;b;c;d;1`, `Longa?;${'y'.repeat(80)};b;c;d;1`, ';a;b;c;d;1', '', ''].join('\n'));
  assert.equal(r.questions.length, 1); assert.equal(r.erros, 5); assert.equal(r.linhas.length, 6);
  assert.match(r.linhas[1].erros.join(), /falta a correta/); assert.match(r.linhas[2].erros.join(), /só 2 opções/);
  assert.match(r.linhas[3].erros.join(), /120/); assert.match(r.linhas[4].erros.join(), /opção 1 com mais de 75/); assert.match(r.linhas[5].erros.join(), /pergunta vazia/);
  assert.throws(() => parse.parseQuestions('pergunta;opcao1\nx;y'), /Use as colunas/);
  assert.throws(() => parse.parseQuestions('pergunta;opcao1;opcao2;opcao3;opcao4;correta'), /pelo menos uma pergunta/);
  assert.equal(parse.MODELO, MODELO_KAHOOT, 'o modelo do menu e o do módulo são o mesmo');
  assert.equal(parse.parseQuestions(parse.MODELO).questions.length, 2);
});

test('editor: diagnóstico diz o que falta sem tocar em nada', () => {
  const ok = editor().KHT.filler.diagnostico(); assert.equal(ok.pronto, true); assert.equal(ok.emBranco, true);
  const sem = editor({ semAdd: true }).KHT.filler.diagnostico(); assert.equal(sem.pronto, false); eq(sem.falta, ['botão para adicionar pergunta']);
  assert.equal(editor({ preenchido: true }).KHT.filler.diagnostico().emBranco, false);
});

test('preenchimento: usa a pergunta em branco atual e cria as demais, marcando a correta', async () => {
  const w = editor(); const { filler } = w.KHT; const progresso = [];
  const r = await filler.executar([Q(1), Q(2), Q(3)], { pausa: 80, entre: 0, onProgress: (f, t) => progresso.push(f) });
  assert.equal(r.feitas, 3);
  const doc = w.document; assert.equal(doc.querySelectorAll('[data-functional-selector="sidebar-block"]').length, 3, 'só 2 novas: a 1ª foi na em branco');
  assert.equal(doc.querySelector('[data-functional-selector="question-title__input"]').textContent, 'Pergunta 3?');
  const ans = [...doc.querySelectorAll('[data-functional-selector="question-answer__input"]')].map(e => e.textContent); eq(ans, ['A1-3', 'B1-3', 'C1-3', 'D1-3']);
  const marc = [...doc.querySelectorAll('[data-functional-selector="question-answer__toggle-button"]')].map(b => b.getAttribute('aria-checked')); eq(marc, ['false', 'false', 'false', 'true']);
  assert.ok(progresso.includes(3));
});

test('preenchimento: nunca sobrescreve pergunta existente (cria nova e mantém a antiga)', async () => {
  const w = editor({ preenchido: true }); await w.KHT.filler.executar([Q(1)], { pausa: 80, entre: 0 });
  assert.equal(w.document.querySelectorAll('[data-functional-selector="sidebar-block"]').length, 2);
});

test('preenchimento: editor incompleto não começa; falha no meio diz pergunta e campo e quantas já foram', async () => {
  const sem = editor({ semAdd: true });
  await assert.rejects(sem.KHT.filler.executar([Q(1)], { entre: 0 }), e => e.name === 'FillError' && /não está pronto: falta botão para adicionar pergunta/.test(e.message));
  const w = editor(); const antiga = w.document.querySelector('[data-functional-selector="add-question-button"]');
  antiga.addEventListener('click', () => { w.document.querySelectorAll('[data-functional-selector="question-answer"]')[2].remove(); }); // o Kahoot "mudou o layout"
  await assert.rejects(w.KHT.filler.executar([Q(1), Q(2)], { pausa: 80, entre: 0 }), e => e.name === 'FillError' && e.feitas === 1 && /Pergunta 2/.test(e.message), 'diz a pergunta');
});

test('preenchimento: cancelar para entre perguntas, sem apagar o que já foi feito', async () => {
  const w = editor(); const ctl = new w.AbortController();
  const p = w.KHT.filler.executar([Q(1), Q(2), Q(3)], { pausa: 80, entre: 0, signal: ctl.signal, onProgress: f => { if (f === 1) ctl.abort(); } });
  await assert.rejects(p, e => e.name === 'Cancelado' && e.feitas === 1);
  assert.equal(w.document.querySelector('[data-functional-selector="question-title__input"]').textContent, 'Pergunta 1?');
});

// ---- página da extensão (permissão opcional com clique) ----
function chromeFalso({ concedida = false, recusa = false, abas = [] } = {}) {
  const st = { concedida, pedidos: 0, injetado: [], criadas: [], ouvintes: [] };
  return {
    st,
    permissions: { contains: async () => st.concedida, request: async () => { st.pedidos += 1; if (recusa) return false; st.concedida = true; return true; } },
    tabs: { query: async () => abas, create: async o => { st.criadas.push(o.url); return { id: 77 }; }, onUpdated: { addListener: fn => { st.ouvintes.push(fn); setTimeout(() => fn(77, { status: 'complete' }), 5); }, removeListener: () => {} } },
    runtime: { getURL: p => `chrome-extension://x/${p}` }
  };
}
const hostFalso = log => ({ call: async (tab, mod, cmd) => { log.push([tab, mod, cmd]); return { mensagem: 'ok' }; } });

test('página Kahoot: sem permissão nada é injetado nem aberto; recusar não muda nada', async () => {
  const c = chromeFalso({ recusa: true }); const log = [];
  assert.equal(await temPermissao(c), false);
  await assert.rejects(prepararAba(c, 5, { host: hostFalso(log) }), /Falta a permissão/);
  await assert.rejects(abrirEditor(c, { host: hostFalso(log) }), /Falta a permissão/);
  assert.equal(await pedirPermissao(c), false); assert.equal(await temPermissao(c), false);
  assert.deepEqual(await abasDoEditor(c), []); assert.deepEqual(log, []); assert.deepEqual(c.st.criadas, []);
});

test('página Kahoot: com a permissão, lista abas do editor, prepara a aba e abre o editor', async () => {
  const c = chromeFalso({ abas: [{ id: 4, title: 'Meu quiz' }, { title: 'sem id' }] }); const log = [];
  assert.equal(await pedirPermissao(c), true);
  assert.deepEqual(await abasDoEditor(c), [{ id: 4, titulo: 'Meu quiz' }]);
  await prepararAba(c, 4, { host: hostFalso(log) });
  const r = await abrirEditor(c, { host: hostFalso(log) });
  assert.deepEqual(log, [[4, 'kahoot', 'kahoot.abrir'], [77, 'kahoot', 'kahoot.abrir']]); assert.deepEqual(c.st.criadas, ['https://create.kahoot.it/']); assert.equal(r.tabId, 77);
});

test('manifest: o único host opcional é o Kahoot e não há content script nele', () => {
  const m = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../manifest.json'), 'utf8'));
  eq(m.optional_host_permissions, ['https://create.kahoot.it/*']);
  assert.ok(!JSON.stringify(m.content_scripts).includes('kahoot'));
  assert.ok(!(m.host_permissions || []).some(h => /kahoot/.test(h)));
});

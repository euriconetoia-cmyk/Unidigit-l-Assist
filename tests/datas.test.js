import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mod = path.join(root, 'src/modules/datas');
const files = JSON.parse(fs.readFileSync(path.join(mod, 'files.json'), 'utf8')).scripts;
const eq = v => JSON.parse(JSON.stringify(v));

function load(url = 'https://ead.senai.br/course/view.php?id=7', body = '<h1>Curso</h1>', fetchImpl, ate = 'fluxo.js') {
  const dom = new JSDOM(`<!doctype html><html><body>${body}</body></html>`, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window; if (fetchImpl) w.fetch = fetchImpl;
  for (const f of files.slice(0, files.indexOf(ate) + 1)) w.eval(fs.readFileSync(path.join(mod, f), 'utf8'));
  return w;
}
const opts = (n, a, b) => Array.from({ length: b - a + 1 }, (_, i) => `<option value="${a + i}"${a + i === n ? ' selected' : ''}>${a + i}</option>`).join('');
// Parte "Disponibilidade" do formulário do Moodle para um campo de data.
function campo(f, d) {
  const on = Boolean(d);
  const x = d || { y: 2026, m: 1, d: 1, h: 0, mi: 0 };
  return `<input type="checkbox" name="${f}[enabled]"${on ? ' checked' : ''}>` + [['day', 1, 31, x.d], ['month', 1, 12, x.m], ['year', 2020, 2035, x.y], ['hour', 0, 23, x.h], ['minute', 0, 59, x.mi]]
    .map(([k, a, b, v]) => `<select name="${f}[${k}]"${on ? '' : ' disabled'}>${opts(v, a, b)}</select>`).join('');
}
const formAssign = (o = {}) => `<form>${campo('allowsubmissionsfromdate', o.inicio)}${campo('duedate', o.termino)}${campo('cutoffdate', o.limite)}${campo('gradingduedate', o.lembrete)}</form>`;
const D = (y, m, d, h = 0, mi = 0) => ({ y, m, d, h, mi });

test('cronograma real: lê início, término e hora; "A definir" fica sem data', () => {
  const html = fs.readFileSync(path.join(root, 'tests/fixtures/cronograma-real.html'), 'utf8');
  const w = load(undefined, html);
  const c = w.DTS.core.lerCronograma(w.document);
  assert.ok(c.entradas.length >= 2);
  const q1 = c.entradas.find(e => /question[aá]rio\s*0?1/i.test(e.nome));
  assert.ok(q1, 'achou Questionário 1');
  assert.deepEqual(eq({ y: q1.inicio.y, m: q1.inicio.m, d: q1.inicio.d }), { y: 2026, m: 10, d: 16 });
  assert.deepEqual(eq({ m: q1.termino.m, d: q1.termino.d }), { m: 10, d: 29 });
  assert.equal(q1.semData, false);
});

test('datas: parse, validação e dia da semana', () => {
  const C = load().DTS.core;
  assert.deepEqual(eq(C.parseData('29/10/2026')), { y: 2026, m: 10, d: 29 });
  assert.equal(C.parseData('31/02/2026'), null);
  assert.equal(C.parseData('abc'), null);
  assert.deepEqual(eq(C.parseHora('23:59')), { h: 23, mi: 59 });
  assert.equal(C.parseHora('25:00'), null);
  assert.deepEqual(eq(C.somarDias(D(2026, 12, 28), 7)), { y: 2027, m: 1, d: 4 });
});

test('emparelhar: nomes parecidos casam 1:1; sem semelhança fica sem par', () => {
  const C = load().DTS.core;
  const par = C.emparelhar([{ nome: 'Questionário 1' }, { nome: 'Envio da SAP 01' }, { nome: 'Algo totalmente diferente' }], [{ nome: 'Envio da SAP 1' }, { nome: 'Questionário 01' }]);
  assert.deepEqual(eq(par), [1, 0, -1]);
});

test('formulário: lê, preenche e compara; campo sem "Habilitar" = sem data', () => {
  const w = load(undefined, formAssign({ inicio: D(2026, 10, 1), termino: D(2026, 10, 10, 18, 0) }));
  const C = w.DTS.core; const doc = w.document;
  const at = C.lerCampos(doc, 'assign');
  assert.equal(at.inicio.on, true); assert.equal(at.limite.on, false);
  const alvo = C.montarAlvo({ inicio: D(2026, 10, 16), termino: D(2026, 10, 29), hora: { h: 23, mi: 59 } }, 'assign', at, {});
  assert.deepEqual(eq(Object.keys(alvo)), ['inicio', 'termino'], 'sem regras extras só mexe em início e entrega');
  assert.deepEqual(eq(C.diferencas(at, alvo)), ['inicio', 'termino']);
  C.preencher(doc, 'assign', alvo);
  const dep = C.lerCampos(doc, 'assign');
  assert.deepEqual(eq(C.diferencas(dep, alvo)), [], 'depois de preencher fica igual');
  assert.equal(dep.termino.h, 23); assert.equal(dep.termino.mi, 59);
});

test('regras opcionais: data limite e lembrete (+7 dias); avisos de domingo e ordem', () => {
  const w = load(undefined, formAssign());
  const C = w.DTS.core;
  const alvo = C.montarAlvo({ inicio: D(2026, 10, 16), termino: D(2026, 10, 29), hora: null }, 'assign', C.lerCampos(w.document, 'assign'), { limite: true, lembrete: true });
  assert.deepEqual(eq(alvo.limite), D(2026, 10, 29, 23, 59));
  assert.equal(alvo.lembrete.d, 5); assert.equal(alvo.lembrete.m, 11);
  const dom = C.avisos(C.montarAlvo({ inicio: D(2026, 10, 16), termino: D(2026, 11, 1), hora: null }, 'assign', {}, {}));
  assert.ok(dom.some(a => a.tipo === 'domingo'), '1/11/2026 é domingo');
  const ord = C.avisos(C.montarAlvo({ inicio: D(2026, 10, 20), termino: D(2026, 10, 10), hora: null }, 'assign', {}, {}));
  assert.ok(ord.some(a => a.tipo === 'ordem'));
});

test('fila: guarda, expira em 30 min e acha o próximo pendente', () => {
  const w = load();
  const F = w.DTS.fila;
  F.gravar({ fase: 'salvar', itens: [{ cmid: '1', estado: 'conferido' }, { cmid: '2', estado: 'pendente' }] }, 1000);
  assert.equal(F.proximo(F.ler(2000)), 1);
  assert.equal(F.ler(1000 + F.TTL + 1), null);
  F.gravar({ itens: [] }); F.limpar(); assert.equal(F.ler(), null);
});

test('fluxo: na edição preenche e avisa; nunca clica em Salvar; ao voltar relê e confere', async () => {
  const alvo = { inicio: D(2026, 10, 16), termino: D(2026, 10, 29, 23, 59) };
  let salvo = { inicio: D(2026, 10, 1), termino: D(2026, 10, 10, 18, 0) };
  const fetchImpl = async () => ({ ok: true, status: 200, url: 'https://ead.senai.br/course/modedit.php?update=55', text: async () => `<html><body>${formAssign(salvo)}</body></html>` });
  // 1) página de edição
  const ed = load('https://ead.senai.br/course/modedit.php?update=55&return=1', formAssign(salvo) + '<input type="submit" id="submit">', fetchImpl, 'ui.js');
  let cliques = 0; ed.document.getElementById('submit').addEventListener('click', () => { cliques++; });
  ed.DTS.fila.gravar({ fase: 'salvar', cursoUrl: 'https://ead.senai.br/course/view.php?id=7', itens: [{ cmid: '55', nome: 'Envio da SAP 01', tipo: 'assign', alvo, estado: 'pendente', detalhe: '' }] });
  const r1 = await ed.DTS.fluxo.retomar();
  assert.equal(r1.aberto, true); assert.equal(cliques, 0);
  assert.ok(ed.document.getElementById(ed.DTS.ui.BANNER_ID), 'faixa de aviso');
  assert.deepEqual(eq(ed.DTS.core.diferencas(ed.DTS.core.lerCampos(ed.document, 'assign'), alvo)), []);
  // 2) voltou sem salvar → "não salvou"
  const cur = load('https://ead.senai.br/course/view.php?id=7', '', fetchImpl, 'ui.js');
  cur.sessionStorage.setItem('hub.datas.v1', ed.sessionStorage.getItem('hub.datas.v1'));
  await cur.DTS.fluxo.retomar();
  assert.equal(cur.DTS.fila.ler().itens[0].estado, 'diferente');
  // 3) salvou → "conferido"
  salvo = alvo;
  const cur2 = load('https://ead.senai.br/course/view.php?id=7', '', fetchImpl, 'ui.js');
  cur2.DTS.fila.gravar({ fase: 'salvar', itens: [{ cmid: '55', nome: 'X', tipo: 'assign', alvo, estado: 'pendente', detalhe: '' }] });
  await cur2.DTS.fluxo.retomar();
  assert.equal(cur2.DTS.fila.ler().itens[0].estado, 'conferido');
});

test('bridge: só abre na página principal do curso', async () => {
  const w = load('https://ead.senai.br/mod/assign/view.php?id=3', '', undefined, 'ui.js');
  w.eval(fs.readFileSync(path.join(mod, 'bridge.js'), 'utf8'));
  await assert.rejects(() => w.HUB_DTS.run('datas.abrir'), /página principal do curso/);
});

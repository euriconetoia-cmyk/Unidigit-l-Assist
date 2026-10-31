import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imn = path.join(root, 'src/modules/importar-notas');
const ctx = vm.createContext({ console, Intl, Number, String, Math, Map, Set, Object, Array, JSON, RegExp, Error });
ctx.globalThis = ctx;
for (const f of ['core/namespace.js', 'core/text.js', 'core/limits.js', 'core/grade.js', 'core/records.js', 'core/match.js', 'core/plan.js']) vm.runInContext(fs.readFileSync(path.join(imn, 'vendor/src', f), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(imn, 'regua.js'), 'utf8'), ctx);
const { IMN } = ctx;
const j = v => JSON.parse(JSON.stringify(v));

test('régua: arredonda sem passar da nota máxima e sem mexer no que não é nota', () => {
  const R = IMN.regua;
  assert.equal(R.ajustarNota('generosa', 8.3, 10), '8.5');
  assert.equal(R.ajustarNota('generosa', 8.5, 10), null, 'já está no passo: não muda');
  assert.equal(R.ajustarNota('generosa', 9.8, 10), '10');
  assert.equal(R.ajustarNota('generosa', 10, 10), null);
  assert.equal(R.ajustarNota('proxima', 6.2, 10), '6');
  assert.equal(R.ajustarNota('inteira', 6.1, 10), '7');
  assert.equal(R.ajustarNota('inteira', 99.9, 100), '100');
  assert.equal(R.ajustarNota('generosa', 4.4, 10), '4.5');
  assert.equal(R.ajustarNota('nenhuma', 4.4, 10), null);
  assert.equal(R.ajustarNota('generosa', null, 10), null);
});

test('régua: sem nota continua sem nota; nota com erro e edição manual não são tocadas', () => {
  const rows = [['id', 'nome', 'nota'], ['1', 'Ana', '8,3'], ['2', 'Bruno', ''], ['3', 'Camila', '11'], ['4', 'Dani', '4,4']];
  const { records } = IMN.records.parseRecords(rows, { max: 10 });
  const out = IMN.regua.apply(records, 'generosa', { max: 10 });
  assert.equal(out[0].grade.canonical, '8.5'); assert.equal(out[0].reguaAntes, '8.3');
  assert.equal(out[1].grade.empty, true); assert.equal(out[1].reguaAntes, undefined);
  assert.equal(out[2].grade.ok, false, 'erro continua erro');
  assert.equal(out[3].grade.canonical, '4.5');
  assert.equal(records[0].grade.canonical, '8.3', 'não altera os registros originais');
  const editado = IMN.records.applyEdits(out, { [out[0].rowNumber]: { grade: '7' } }, { max: 10 });
  assert.equal(editado[0].grade.canonical, '7', 'a edição manual vale mais que a régua');
  assert.strictEqual(IMN.regua.apply(records, 'nenhuma', { max: 10 }), records);
});

test('régua: a prévia Antes/Depois lista só quem mudou, e o plano usa o valor novo', () => {
  const rows = [['id', 'nome', 'nota'], ['1', 'Ana', '8,3'], ['2', 'Bruno', '9'], ['3', 'Camila', '']];
  const parsed = IMN.records.parseRecords(rows, { max: 10 }).records;
  const page = [{ userId: '1', name: 'Ana', gradeText: '', feedbackText: '' }, { userId: '2', name: 'Bruno', gradeText: '', feedbackText: '' }, { userId: '3', name: 'Camila', gradeText: '', feedbackText: '' }];
  const plan = IMN.plan.buildPlan(IMN.regua.apply(parsed, 'generosa', { max: 10 }), page, { decimal: ',' });
  const prev = IMN.regua.previa(plan);
  assert.deepEqual(j(prev.map(x => [x.nome, x.antes, x.depois])), [['Ana', '8.3', '8.5']]);
  assert.equal(plan.items[0].changes[0].to, '8,5', 'o texto que vai ao Moodle usa o separador da página');
  assert.equal(plan.items[2].status, 'unchanged', 'sem nota segue sem nota');
});

test('o painel vendorizado leva o patch da régua (2 marcas) e o carregador inclui regua.js', () => {
  const panel = fs.readFileSync(path.join(imn, 'vendor/src/ui/panel.js'), 'utf8');
  assert.equal((panel.match(/HUB-PATCH regua/g) || []).length, 2);
  assert.match(fs.readFileSync(path.join(root, 'src/host/modules.js'), 'utf8'), /modules\/importar-notas\/regua\.js/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mod = path.join(root, 'src/modules/cronograma');
const files = JSON.parse(fs.readFileSync(path.join(mod, 'files.json'), 'utf8')).scripts;
const fx = f => fs.readFileSync(path.join(root, 'tests/fixtures', f), 'utf8');
const eq = v => JSON.parse(JSON.stringify(v));

function load(ate = 'textos.js', url = 'https://ead.senai.br/course/view.php?id=7', body = '') {
  const dom = new JSDOM(`<!doctype html><html><body>${body}</body></html>`, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  for (const f of files.slice(0, files.indexOf(ate) + 1)) w.eval(fs.readFileSync(path.join(mod, f), 'utf8'));
  return w;
}
// UC fictícia (formato do JSON) com datas deslocadas em 1 semana em relação ao texto real
const UC = { nome: 'Infraestrutura de Redes de Computadores', tipo: 'uc', inicio: '2026-10-23', termino: '2026-11-23',
  momentos: [{ tipo: 'presencial', data: '2026-11-07', webconferencia: { data: '2026-10-29', hora: '19h' } }, { tipo: 'presencial', data: '2026-11-21', webconferencia: { data: '2026-11-12', hora: '19h' } }] };
const strip = h => h.replace(/\s+/g, ' ').replace(/\d{2}\/\d{2}\/\d{4}/g, 'D').replace(/>\s*Webaula \d+/g, '>Webaula N').replace(/>\s*Encontro \d+/g, '>Encontro N');

test('JSON de exemplo: lê, resume e confere', () => {
  const w = load('json.js'); const J = w.CRN.json;
  const r = J.ler(fx('cronograma-turma-exemplo.json')); assert.equal(r.ok, true);
  const s = J.resumo(r.dados);
  assert.equal(s.validado, true); assert.equal(s.codigoMoodle, '1037240'); assert.equal(s.aprendizagem, false);
  assert.equal(J.ucs(r.dados).length, 12);
  const av = J.avisos(r.dados).map(a => a.texto);
  assert.ok(av.some(t => /Assessoria.*encontro 1.*anterior ao início/.test(t)), av.join('\n'));
  assert.ok(av.some(t => /Feriado repetido/.test(t)));
  assert.equal(J.ler('não é json').ok, false);
  assert.equal(J.ler('{"formato":"outro"}').ok, false);
});

test('nome do curso no Moodle: separa código, curso e turma; liga por código', () => {
  const w = load('json.js'); const J = w.CRN.json;
  assert.deepEqual(eq(J.parseNomeCurso('1037240 - Técnico em Informática para Internet - 00001/2026')), { codigo: '1037240', curso: 'Técnico em Informática para Internet', turma: '00001/2026' });
  assert.equal(J.parseNomeCurso('TEC.2026.2.184 - Técnico em Redes de Computadores - 00001/2026').codigo, 'TEC.2026.2.184');
  assert.equal(J.parseNomeCurso('Segurança em Redes'), null);
  const s = J.resumo(J.ler(fx('cronograma-turma-exemplo.json')).dados);
  assert.equal(J.ligar(s, '1037240 - Técnico em Informática para Internet - 00001/2026').nivel, 'alta');
  assert.equal(J.ligar(s, '1037240 - Outro nome - 00001/2026').nivel, 'media');
  assert.equal(J.ligar(s, 'TEC.2026.2.184 - Técnico em Redes de Computadores - 00001/2026').nivel, 'nenhuma');
});

test('texto: classifica cabeçalho e cronograma completo e acha a UC', () => {
  const T = load().CRN.textos;
  assert.deepEqual(eq(T.classificar(fx('rotulo-cabecalho.html'))), { tipo: 'cabecalho', uc: 'Infraestrutura de Redes de Computadores' });
  const c = T.classificar(fx('rotulo-cronograma-completo.html'));
  assert.equal(c.tipo, 'cronograma'); assert.match(c.uc, /INFRAESTRUTURA DE REDES/);
  assert.equal(T.classificar('<p>Bem-vindo</p>').tipo, '');
});

test('cabeçalho: troca só o período', () => {
  const T = load().CRN.textos; const antes = fx('rotulo-cabecalho.html');
  const r = T.ajustar(antes, T.alvoDaUc(UC));
  assert.deepEqual(eq(r.mudancas), [{ rotulo: 'Período', de: '16/10/2026 a 16/11/2026', para: '23/10/2026 a 23/11/2026' }]);
  assert.equal(strip(r.html), strip(T.parse(antes).innerHTML));
  assert.equal(T.ajustar(r.html, T.alvoDaUc(UC)).mudancas.length, 0, 'segunda passada não muda nada (idempotente)');
});

test('cronograma completo: período, atividades, momento presencial, webaulas e encontros; resto intacto', () => {
  const T = load().CRN.textos; const antes = fx('rotulo-cronograma-completo.html');
  const r = T.ajustar(antes, T.alvoDaUc(UC));
  const m = Object.fromEntries(r.mudancas.map(x => [x.rotulo, x.para]));
  assert.equal(m['Período'], '23/10/2026 a 23/11/2026');
  assert.equal(m['SAP 01 · início'], '23/10/2026'); assert.equal(m['SAP 01 · término'], '05/11/2026', '2 dias antes do 1º encontro (07/11)');
  assert.equal(m['Momento Presencial · início'], '07/11/2026'); assert.equal(m['Momento Presencial · término'], '21/11/2026');
  assert.equal(m['Webaula 1 · data'], '29/10/2026'); assert.equal(m['Webaula 2 · data'], '12/11/2026');
  assert.equal(m['Encontro 1 · data'], '07/11/2026'); assert.equal(m['Encontro 2 · data'], '21/11/2026');
  assert.ok(!r.mudancas.some(x => /Webaula \d · (início|término)/.test(x.rotulo)), 'hora das webaulas não muda se não for informada');
  assert.equal(strip(r.html), strip(T.parse(antes).innerHTML), 'estrutura idêntica fora das datas');
  assert.match(r.html, /Horário Limite/); assert.match(r.html, /25 Pontos/); assert.match(r.html, /19h/);
  assert.equal(T.ajustar(r.html, T.alvoDaUc(UC)).mudancas.length, 0);
});

test('webaulas: horário informado entra; linhas acrescentadas ou removidas copiando o estilo', () => {
  const T = load().CRN.textos; const antes = fx('rotulo-cronograma-completo.html');
  const quatro = ['2026-10-29', '2026-11-05', '2026-11-12', '2026-11-19'].map(data => ({ data, ini: '20h', fim: '21h' }));
  const r = T.ajustar(antes, T.alvoDaUc(UC, { webaulas: quatro }));
  assert.match(r.html, /Webaula 4/); assert.match(r.html, /19\/11\/2026/); assert.match(r.html, /20h/);
  assert.ok(r.mudancas.some(x => /linha nova/.test(x.rotulo)));
  const uma = T.ajustar(antes, T.alvoDaUc(UC, { webaulas: [{ data: '2026-10-29' }] }));
  assert.ok(!/Webaula 2/.test(uma.html)); assert.ok(uma.mudancas.some(x => /linha removida/.test(x.rotulo)));
});

test('gerar webaulas pelo dia da semana: toda semana, quinzenal e feriados', () => {
  const T = load().CRN.textos;
  const base = { inicio: '2026-10-16', termino: '2026-11-16', dia: 4 };
  assert.deepEqual(eq(T.gerarWebaulas(base)), ['2026-10-22', '2026-10-29', '2026-11-05', '2026-11-12']);
  assert.deepEqual(eq(T.gerarWebaulas({ ...base, passo: 2 })), ['2026-10-22', '2026-11-05']);
  assert.deepEqual(eq(T.gerarWebaulas({ ...base, feriados: new Set(['2026-10-29']) })), ['2026-10-22', '2026-11-05', '2026-11-12']);
  assert.deepEqual(eq(T.gerarWebaulas({ ...base, feriados: new Set(['2026-10-29']), pular: false })).length, 4);
});

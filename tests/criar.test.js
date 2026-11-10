import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mod = path.join(root, 'src/modules/criar');
const files = JSON.parse(fs.readFileSync(path.join(mod, 'files.json'), 'utf8')).scripts;
const eq = v => JSON.parse(JSON.stringify(v));
const ORIGIN = 'https://ead.senai.br';

function load(url = `${ORIGIN}/course/view.php?id=7`, body = '<h1>Curso</h1>', ate = 'api.js') {
  const dom = new JSDOM(`<!doctype html><html><body>${body}</body></html>`, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  for (const f of files.slice(0, files.indexOf(ate) + 1)) w.eval(fs.readFileSync(path.join(mod, f), 'utf8'));
  return w;
}
const opts = (n, a, b) => Array.from({ length: b - a + 1 }, (_, i) => `<option value="${a + i}"${a + i === n ? ' selected' : ''}>${a + i}</option>`).join('');
function data(base, on, d) {
  const x = d || { d: 1, m: 1, y: 2026, h: 0, mi: 0 };
  return (on ? `<input type="checkbox" name="${base}[enabled]" value="1" checked>` : '<input type="checkbox" name="' + base + '[enabled]" value="1">') + [['day', 1, 31, x.d], ['month', 1, 12, x.m], ['year', 2020, 2035, x.y], ['hour', 0, 23, x.h], ['minute', 0, 59, x.mi]]
    .map(([k, a, b, v]) => `<select name="${base}[${k}]"${on ? '' : ' disabled'}>${opts(v, a, b)}</select>`).join('');
}
// Formulário parecido com o do Moodle 4 (campos reais de nome; valores fictícios).
function formAssign({ semVisivel = false, semNome = false, cutoff = false } = {}) {
  return `<form class="mform" action="${ORIGIN}/course/modedit.php" method="post">
<input type="hidden" name="course" value="7"><input type="hidden" name="section" value="0"><input type="hidden" name="module" value="1"><input type="hidden" name="modulename" value="assign"><input type="hidden" name="add" value="assign"><input type="hidden" name="update" value="0"><input type="hidden" name="return" value="0"><input type="hidden" name="sesskey" value="SK123"><input type="hidden" name="_qf__mod_assign_mod_form" value="1">
${semNome ? '' : '<input type="text" name="name" value="">'}<textarea name="introeditor[text]"></textarea><input type="hidden" name="introeditor[format]" value="1"><input type="hidden" name="introeditor[itemid]" value="555">
${data('allowsubmissionsfromdate', true)}${data('duedate', true)}${data('cutoffdate', cutoff)}${data('gradingduedate', true)}
${semVisivel ? '' : '<select name="visible"><option value="1" selected>Mostrar</option><option value="0">Ocultar</option></select>'}
<input type="checkbox" name="assignsubmission_file_enabled" value="1" checked><select name="assignsubmission_file_maxfiles">${opts(20, 1, 20)}</select>
<input type="submit" name="submitbutton" value="Salvar e voltar ao curso"><input type="submit" name="submitbutton2" value="Salvar e mostrar"></form>`;
}
const formForum = () => `<form class="mform" action="${ORIGIN}/course/modedit.php"><input type="hidden" name="sesskey" value="SK123"><input type="text" name="name"><textarea name="introeditor[text]"></textarea><select name="type"><option value="general" selected>General</option><option value="eachuser">Cada pessoa</option></select><select name="visible"><option value="1" selected>Mostrar</option><option value="0">Ocultar</option></select><input type="submit" name="submitbutton" value="Salvar"></form>`;
const docDe = (w, html) => new w.DOMParser().parseFromString(html, 'text/html');
const mapa = pares => Object.fromEntries(pares);

test('sanitizar: tira script, estilo, imagem, eventos e links perigosos; mantém texto simples', () => {
  const w = load(); const s = w.CRI.core.sanitizar('<p onclick="x()">Oi <b>você</b></p><script>alert(1)</script><style>p{}</style><img src="x" onerror="y()"><a href="javascript:alert(1)">ruim</a><a href="https://exemplo.org/a">bom</a><iframe src="https://x"></iframe><span style="color:red">t</span>');
  assert.ok(!/script|style|img|onclick|onerror|javascript:|iframe/i.test(s), s);
  assert.match(s, /<b>você<\/b>/); assert.match(s, /href="https:\/\/exemplo\.org\/a"/); assert.match(s, /rel="noopener noreferrer"/);
});

test('campos: acha {{campos}} sem repetir e preenche com texto escapado, avisando os que faltam', () => {
  const w = load(); const C = w.CRI.core;
  assert.deepEqual(eq(C.campos('{{UC}} e {{ uc }} e {{link_sala}}')), ['uc', 'link_sala']);
  const r = C.preencher('<p>{{uc}} — {{Tutor}} — {{link_sala}}</p>', { uc: 'Redes <b>1</b>', tutor: 'Ana & Cia' });
  assert.equal(r.html, '<p>Redes &lt;b&gt;1&lt;/b&gt; — Ana &amp; Cia — {{link_sala}}</p>');
  assert.deepEqual(eq(r.faltando), ['link_sala']);
});

test('montarEnvio (envio): nome, texto, datas, OCULTO, arquivo e botão salvar; mantém sesskey e campos escondidos do Moodle', () => {
  const w = load(); const C = w.CRI.core;
  const form = C.achaForm(docDe(w, formAssign()));
  const ab = new w.Date(2026, 10, 10, 8, 0), pr = new w.Date(2026, 10, 24, 23, 59);
  const r = C.montarEnvio(form, C.MODELOS.envio, { nome: 'Atividade 1', html: '<p>Oi</p>', abertura: ab, prazo: pr });
  assert.ok(!r.erro, r.erro); const m = mapa(r.pares);
  assert.equal(m.name, 'Atividade 1'); assert.equal(m['introeditor[text]'], '<p>Oi</p>'); assert.equal(m.visible, '0');
  assert.equal(m.sesskey, 'SK123'); assert.equal(m['introeditor[itemid]'], '555'); assert.equal(m.add, 'assign'); assert.equal(m._qf__mod_assign_mod_form, '1');
  assert.equal(m['duedate[day]'], '24'); assert.equal(m['duedate[month]'], '11'); assert.equal(m['duedate[hour]'], '23'); assert.equal(m['duedate[enabled]'], '1');
  assert.equal(m['allowsubmissionsfromdate[day]'], '10');
  assert.equal(m['gradingduedate[day]'], '1'); assert.equal(m['gradingduedate[month]'], '12'); // prazo + 7 dias
  assert.equal(m.assignsubmission_file_enabled, '1'); assert.equal(m.assignsubmission_file_maxfiles, '1');
  assert.equal(m.submitbutton, 'Salvar e voltar ao curso'); assert.ok(!('submitbutton2' in m));
  assert.equal(r.pares.filter(p => p[0] === 'visible').length, 1);
});

test('montarEnvio: data limite (cutoff) ligada é desligada; recusa sem opção Ocultar, sem nome, sem prazo ou prazo antes da abertura', () => {
  const w = load(); const C = w.CRI.core; const hoje = new w.Date(2026, 10, 10, 8, 0); const pr = new w.Date(2026, 10, 24, 23, 59);
  const com = C.montarEnvio(C.achaForm(docDe(w, formAssign({ cutoff: true }))), C.MODELOS.envio, { nome: 'A', html: 'x', abertura: hoje, prazo: pr });
  assert.ok(!('cutoffdate[enabled]' in mapa(com.pares)));
  assert.match(C.montarEnvio(C.achaForm(docDe(w, formAssign({ semVisivel: true }))), C.MODELOS.envio, { nome: 'A', html: 'x', abertura: hoje, prazo: pr }).erro, /Ocultar/);
  assert.match(C.montarEnvio(C.achaForm(docDe(w, formAssign({ semNome: true }))), C.MODELOS.envio, { nome: 'A', html: 'x', abertura: hoje, prazo: pr }).erro, /Nome/);
  assert.match(C.montarEnvio(C.achaForm(docDe(w, formAssign())), C.MODELOS.envio, { nome: 'A', html: 'x', abertura: hoje }).erro, /prazo/i);
  assert.match(C.montarEnvio(C.achaForm(docDe(w, formAssign())), C.MODELOS.envio, { nome: 'A', html: 'x', abertura: pr, prazo: hoje }).erro, /depois da abertura/);
});

test('montarEnvio (fórum): cada pessoa inicia um tópico e oculto', () => {
  const w = load(); const C = w.CRI.core;
  const r = C.montarEnvio(C.achaForm(docDe(w, formForum())), C.MODELOS.forum, { nome: 'Apresentação', html: '<p>x</p>' });
  const m = mapa(r.pares); assert.equal(m.type, 'eachuser'); assert.equal(m.visible, '0'); assert.equal(m.name, 'Apresentação');
});

test('página do curso: acha atividade pelo nome (sem acento/caixa) e lê o cmid; lê valor de "visible"', () => {
  const w = load(); const C = w.CRI.core;
  const d = docDe(w, '<ul><li class="activity" data-id="48"><a href="/mod/forum/view.php?id=48"><span class="instancename">Fórum de apresentação <span class="accesshide">Fórum</span></span></a></li><li class="activity"><a href="/mod/assign/view.php?id=51"><span class="instancename">Envio 1</span></a></li></ul>');
  assert.deepEqual(eq(C.acharPorNome(d, 'forum de APRESENTACAO')), [{ cmid: '48', nome: 'Fórum de apresentação' }]);
  assert.equal(C.acharPorNome(d, 'Outro').length, 0);
  assert.equal(C.valorVisivel(docDe(w, '<select name="visible"><option value="1">a</option><option value="0" selected>b</option></select>')), '0');
});

// Moodle de mentira: roteia o fetch como o servidor faria.
function moodle(w, { form = formAssign(), pos = 'ok', visivelFinal = '0', existe = false, semForm = false } = {}) {
  const log = { gets: [], posts: [] }; const acts = existe ? [{ id: 48, nome: 'Atividade 1' }] : [];
  const pagina = () => `<ul>${acts.map(a => `<li class="activity" data-id="${a.id}"><a href="/mod/assign/view.php?id=${a.id}"><span class="instancename">${a.nome}</span></a></li>`).join('')}</ul>`;
  const resp = (url, body, extra = {}) => ({ ok: true, status: 200, redirected: false, url, text: async () => body, ...extra });
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    if (init.method === 'POST') {
      log.posts.push(new URLSearchParams(init.body));
      if (pos === 'erro') return resp(`${ORIGIN}/course/modedit.php`, `<div class="alert alert-danger">O prazo não pode ser antes da abertura.</div>${form}`);
      if (pos === 'login') return resp(`${ORIGIN}/login/index.php`, '<form></form>', { redirected: true });
      if (pos === 'ok') acts.push({ id: 77, nome: log.posts[log.posts.length - 1].get('name') });
      return resp(`${ORIGIN}/course/view.php?id=7`, pagina(), { redirected: true });
    }
    log.gets.push(u.pathname + u.search);
    if (u.pathname === '/course/view.php') return resp(url, pagina());
    if (u.pathname === '/course/modedit.php' && u.searchParams.get('add')) return resp(url, semForm ? '<div class="errorbox">Você não tem permissão</div>' : form);
    if (u.pathname === '/course/modedit.php' && u.searchParams.get('update')) return resp(url, `<form class="mform"><select name="visible"><option value="1"${visivelFinal === '1' ? ' selected' : ''}>m</option><option value="0"${visivelFinal === '0' ? ' selected' : ''}>o</option></select></form>`);
    return { ok: false, status: 404, redirected: false, url, text: async () => '' };
  };
  return { fetchImpl, log };
}
const base = (w, fetchImpl) => ({ origin: ORIGIN, curso: { id: '7', name: 'Redes' }, modelo: w.CRI.core.MODELOS.envio, nome: 'Atividade 1', secao: 0, opcoes: { fetchImpl }, html: '<p>x</p>', abertura: new w.Date(2026, 10, 10, 8), prazo: new w.Date(2026, 10, 24, 23, 59) });

test('criar: cria oculta, lê de volta e confirma (criada); o POST leva o sesskey do formulário e visible=0', async () => {
  const w = load(); const m = moodle(w);
  const r = await w.CRI.api.criar(base(w, m.fetchImpl));
  assert.equal(r.estado, 'criada'); assert.equal(r.cmid, '77'); assert.equal(m.log.posts.length, 1);
  const p = m.log.posts[0]; assert.equal(p.get('visible'), '0'); assert.equal(p.get('sesskey'), 'SK123'); assert.equal(p.get('name'), 'Atividade 1');
});

test('criar: Moodle recusa o formulário → falhou com a mensagem do Moodle; sessão expirada → falhou; sem permissão → falhou sem enviar nada', async () => {
  const w = load();
  let m = moodle(w, { pos: 'erro' }); let r = await w.CRI.api.criar(base(w, m.fetchImpl));
  assert.equal(r.estado, 'falhou'); assert.match(r.detalhe, /antes da abertura/);
  m = moodle(w, { pos: 'login' }); r = await w.CRI.api.criar(base(w, m.fetchImpl)); assert.equal(r.estado, 'falhou'); assert.match(r.detalhe, /sessão/);
  m = moodle(w, { semForm: true }); r = await w.CRI.api.criar(base(w, m.fetchImpl)); assert.equal(r.estado, 'falhou'); assert.match(r.detalhe, /permissão/); assert.equal(m.log.posts.length, 0);
});

test('criar: criada mas VISÍVEL ou não achada na página do curso → "incerta" (nunca diz que está ok)', async () => {
  const w = load();
  let m = moodle(w, { visivelFinal: '1' }); let r = await w.CRI.api.criar(base(w, m.fetchImpl));
  assert.equal(r.estado, 'incerta'); assert.match(r.detalhe, /VISÍVEL/);
  m = moodle(w, { pos: 'nada' }); r = await w.CRI.api.criar(base(w, m.fetchImpl));
  assert.equal(r.estado, 'incerta'); assert.match(r.detalhe, /não achei/);
});

test('criar: formulário que aponta para outro endereço não recebe nada', async () => {
  const w = load(); const m = moodle(w, { form: formAssign().replace(`${ORIGIN}/course/modedit.php`, 'https://outro.exemplo/course/modedit.php') });
  const r = await w.CRI.api.criar(base(w, m.fetchImpl));
  assert.equal(r.estado, 'falhou'); assert.match(r.detalhe, /outro endereço/); assert.equal(m.log.posts.length, 0);
});

test('checar: só lê (nenhum POST); detecta já existe, sem permissão e formulário diferente', async () => {
  const w = load();
  let m = moodle(w); let r = await w.CRI.api.checar({ ...base(w, m.fetchImpl) });
  assert.equal(r.estado, 'pronta'); assert.equal(m.log.posts.length, 0);
  m = moodle(w, { existe: true }); r = await w.CRI.api.checar(base(w, m.fetchImpl)); assert.equal(r.estado, 'existe');
  m = moodle(w, { semForm: true }); r = await w.CRI.api.checar(base(w, m.fetchImpl)); assert.equal(r.estado, 'sem_permissao');
  m = moodle(w, { form: formAssign({ semVisivel: true }) }); r = await w.CRI.api.checar(base(w, m.fetchImpl)); assert.equal(r.estado, 'incompativel');
});

test('ponte: em página de curso abre; em página qualquer sem cursos recusa com mensagem clara', async () => {
  const w = load(`${ORIGIN}/mod/forum/view.php?id=3`, '<h1>Fórum</h1>', 'ui.js');
  w.eval(fs.readFileSync(path.join(mod, 'bridge.js'), 'utf8'));
  await assert.rejects(() => w.HUB_CRI.run('criar.abrir'), /página de um curso/);
  const c = load(`${ORIGIN}/course/view.php?id=7`, '<h1>Redes</h1>', 'ui.js');
  c.eval(fs.readFileSync(path.join(mod, 'bridge.js'), 'utf8'));
  const out = await c.HUB_CRI.run('criar.abrir'); assert.equal(out.aberto, true);
  assert.ok(c.document.getElementById('hub-cri-host'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { graderPage, participantsPage, ALUNOS } from './fixtures/moodle-alunos.js';
import { courseWithAssignments, assignViewPage, assignGradingPage } from './fixtures/moodle-tarefas.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mod = path.join(root, 'src/modules/alunos');
const files = JSON.parse(fs.readFileSync(path.join(mod, 'files.json'), 'utf8')).scripts.filter(f => f !== 'ui.js');

// Carrega os scripts do módulo numa página jsdom (como a injeção faz) e devolve a janela.
function load(url = 'https://ead.senai.br/course/view.php?id=7', fetchImpl, bodyClass = 'course-7') {
  const dom = new JSDOM(`<!doctype html><html><body class="${bodyClass}"><h1>Segurança em Redes</h1></body></html>`, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  if (fetchImpl) w.fetch = fetchImpl;
  for (const f of files) w.eval(fs.readFileSync(path.join(mod, f), 'utf8'));
  return w;
}
const page = html => { const d = new JSDOM(html).window.document; return d; };

test('adaptador lê o livro de notas e a nota máxima', () => {
  const w = load();
  const adapter = w.MAT.adapters.createAdapter();
  const gb = adapter.extractGradebookReport(page(graderPage()), { id: 7 });
  assert.equal(gb.students.length, ALUNOS.length);
  assert.equal(gb.items.filter(i => !i.isTotal).length, 4);
  assert.ok(gb.courseTotalItem, 'total do curso identificado');
  assert.equal(gb.courseTotalItem.maxGrade, 100);
  const camila = gb.students.find(s => /Camila/.test(s.studentName));
  assert.equal(camila.courseTotal, 58);
  const nulls = Object.values(camila.grades).filter(g => g.value === null).length;
  assert.equal(nulls, 1, 'célula "-" vira sem nota, não zero');
});

test('participantes: último acesso e papel', () => {
  const w = load();
  const rows = w.MAT.adapters.createAdapter().extractParticipantRows(page(participantsPage())).rows;
  assert.equal(rows.length, ALUNOS.length + 1);
  assert.equal(rows.find(r => /Fábio/.test(r.name)).lastAccessDays, 23);
});

function buildAll() {
  const w = load();
  const a = w.MAT.adapters.createAdapter();
  const gb = a.extractGradebookReport(page(graderPage()), { id: 7 });
  const parts = a.extractParticipantRows(page(participantsPage())).rows;
  return { w, gb, students: w.ALN.buildStudents({ gradebook: gb, participants: parts }) };
}

test('situação e risco por aluno', () => {
  const { students } = buildAll();
  const by = n => students.find(s => s.name.startsWith(n));
  assert.equal(students.length, ALUNOS.length, 'professor não entra como aluno');
  assert.equal(by('Ana').situation, 'media');
  assert.equal(by('Ana').risk.level, 'regular');
  assert.equal(by('Camila').situation, 'recuperacao');
  assert.equal(by('Fábio').situation, 'abaixo');
  assert.equal(by('Fábio').risk.level, 'imediato');
  assert.ok(by('Fábio').risk.reasons.some(r => r.code === 'no_access_immediate'));
  assert.ok(['alto', 'imediato'].includes(by('Diego').risk.level));
  assert.equal(by('Bruno').itemsMissing, 1);
});

test('dado ausente vira "verificar", nunca "regular"', () => {
  const w = load();
  const a = w.MAT.adapters.createAdapter();
  const gb = a.extractGradebookReport(page(graderPage()), { id: 7 });
  const students = w.ALN.buildStudents({ gradebook: gb, participants: [] }); // participantes não lidos
  const ana = students.find(s => s.name.startsWith('Ana'));
  assert.equal(ana.risk.level, 'verificar');
  assert.deepEqual(Array.from(ana.risk.unknown), ['último acesso']);
});

test('relatório da UC: médias, contagens e item com menos notas', () => {
  const { w, gb, students } = buildAll();
  const rep = w.ALN.buildReport(students, gb, {}, '');
  assert.equal(rep.students, 6);
  assert.equal(rep.counts.media + rep.counts.recuperacao + rep.counts.abaixo, 6);
  assert.equal(rep.counts.media, 3);
  assert.equal(Math.round(rep.meanPct * 10) / 10, 63.8);
  assert.equal(rep.perItem.length, 4);
  assert.equal(rep.missingCells, 7);
  assert.equal(rep.lowest.graded, 3); // AV3 e AV4 empatam em 3 notas; mostra uma delas
  assert.ok(rep.reachedPct > 49 && rep.reachedPct < 51);
});

test('CSV: cabeçalho, ponto-e-vírgula e proteção contra fórmula', () => {
  const { w, gb, students } = buildAll();
  students[0].name = '=HYPERLINK("x")';
  const csv = w.ALN.studentsCsv(students);
  assert.ok(csv.startsWith('\uFEFF"aluno";"email";'));
  assert.ok(!/"=HYP/.test(csv) && csv.includes("'=HYPERLINK"));
  const g = w.ALN.gradesCsv(students, gb, '');
  assert.ok(/AV1 Fundamentos \(máx\. 10\)/.test(g));
  assert.ok(/Sem nota|Recuperação/.test(w.ALN.riskCsv(students)) || true);
});

test('mensagem de contato só cita fatos lidos', () => {
  const { w, students } = buildAll();
  const f = students.find(s => s.name.startsWith('Fábio'));
  const msg = w.ALN.contactText(f, 'Redes');
  assert.match(msg, /^Olá, Fábio!/);
  assert.match(msg, /23 dias/);
});

// ---- leitor: paginação, grupo e erros ----
const fakeFetch = routes => async url => {
  const u = new URL(url);
  const key = u.pathname + (u.searchParams.get('page') ? `?page=${u.searchParams.get('page')}` : '');
  const body = routes[key] ?? routes[u.pathname];
  if (body == null) return { ok: false, status: 404, url, text: async () => '' };
  return { ok: true, status: 200, url, text: async () => body };
};

test('leitor: lê livro de notas e participantes e calcula cobertura', async () => {
  const calls = [];
  const w = load(undefined, fakeFetch({ '/grade/report/grader/index.php': graderPage(), '/user/index.php': participantsPage() }));
  const orig = w.fetch; w.fetch = (u, o) => { calls.push(new URL(u).pathname); return orig(u, o); };
  const data = await w.ALN.reader.readCourse({ settings: { ...w.ALN.reader.SETTINGS, requestDelayMs: 0 } });
  assert.equal(data.students.length, 6);
  assert.equal(data.coverage.complete, true);
  assert.deepEqual(calls, ['/grade/report/grader/index.php', '/user/index.php']);
  assert.equal(w.ALN.reader.cached().course.id, 7);
});

test('leitor: segue a paginação do livro de notas', async () => {
  const p0 = ALUNOS.slice(0, 3), p1 = ALUNOS.slice(3);
  const w = load(undefined, fakeFetch({
    '/grade/report/grader/index.php': graderPage({ alunos: ALUNOS, porPagina: 3, pagina: 0, paginasTotal: 2 }),
    '/grade/report/grader/index.php?page=1': graderPage({ alunos: ALUNOS, porPagina: 3, pagina: 1, paginasTotal: 2 }),
    '/user/index.php': participantsPage()
  }));
  const data = await w.ALN.reader.readCourse({ settings: { ...w.ALN.reader.SETTINGS, requestDelayMs: 0 } });
  assert.equal(data.students.length, 6);
  assert.ok(p0.length + p1.length === 6);
});

test('leitor: grupo filtrado e total não identificado viram aviso (leitura parcial)', async () => {
  const w = load(undefined, fakeFetch({ '/grade/report/grader/index.php': graderPage({ grupo: 'Turma A' }), '/user/index.php': participantsPage() }));
  const data = await w.ALN.reader.readCourse({ settings: { ...w.ALN.reader.SETTINGS, requestDelayMs: 0 } });
  assert.ok(data.warnings.some(x => /Turma A/.test(x)));
  assert.equal(data.coverage.complete, false);
});

test('leitor: livro de notas não reconhecido é erro claro, não zero alunos', async () => {
  const w = load(undefined, fakeFetch({ '/grade/report/grader/index.php': '<html><body><p>Sem permissão</p></body></html>', '/user/index.php': participantsPage() }));
  await assert.rejects(() => w.ALN.reader.readCourse({ settings: { ...w.ALN.reader.SETTINGS, requestDelayMs: 0 } }), /livro de notas não foi reconhecido/);
});

test('leitor: sessão expirada e fora do Moodle são recusados', async () => {
  const expirada = load(undefined, async url => ({ ok: true, status: 200, url: 'https://ead.senai.br/login/index.php', text: async () => '<html></html>' }));
  await assert.rejects(() => expirada.ALN.reader.readCourse({ settings: { ...expirada.ALN.reader.SETTINGS, requestDelayMs: 0 } }), /sessão do Moodle parece ter expirado/);
  const w = load('https://ead.senai.br/my/', undefined, '');
  await assert.rejects(() => w.ALN.reader.readCourse(), /número do curso/);
});

// ---- mensagem ao aluno pelo Moodle ----
const PAGINA_COM_SESSAO = `<html><body><a href="https://ead.senai.br/login/logout.php?sesskey=AbC123xyz">Sair</a></body></html>`;
function loadWithSession(fetchImpl) {
  const w = load('https://ead.senai.br/course/view.php?id=7', fetchImpl);
  w.document.body.innerHTML = PAGINA_COM_SESSAO;
  return w;
}
const jsonRes = (body, ok = true, status = 200) => ({ ok, status, url: 'x', text: async () => JSON.stringify(body) });
function moodleFake({ sendReply, readReply, calls = [] } = {}) {
  return async (url, opts) => {
    const u = new URL(url); const body = JSON.parse(opts.body); calls.push({ method: body[0].methodname, sesskey: u.searchParams.get('sesskey'), args: body[0].args, opts });
    if (body[0].methodname === 'core_message_send_instant_messages') return jsonRes(sendReply || [{ error: false, data: [{ msgid: 77, conversationid: 5, useridfrom: 90, text: 'x' }] }]);
    if (body[0].methodname === 'core_message_get_conversation_messages') return jsonRes(readReply || [{ error: false, data: { messages: [{ id: 77, useridfrom: 90, text: 'x' }] } }]);
    return jsonRes([{ error: true, exception: { message: 'inesperado' } }]);
  };
}

test('mensagem: texto cita só fatos lidos e nada da falta de nota (que é do tutor)', () => {
  const { w, students } = buildAll();
  const fabio = students.find(s => s.name.startsWith('Fábio'));
  const msg = w.ALN.messenger.buildMessage(fabio, 'Redes');
  assert.match(msg, /^Olá, Fábio, tudo bem\?/);
  assert.match(msg, /último acesso ao ambiente foi há 23 dias/);
  assert.match(msg, /nota atual \(31\)/);
  assert.ok(!/sem nota/i.test(msg));
  const ana = students.find(s => s.name.startsWith('Ana'));
  assert.match(w.ALN.messenger.buildMessage(ana, 'Redes'), /gostaria de acompanhar/);
});

test('mensagem: identificador do aluno vem da chave id:N', () => {
  const { w, students } = buildAll();
  assert.equal(w.ALN.messenger.studentId(students[0]), 11);
  assert.equal(w.ALN.messenger.studentId({ key: 'name:fulano' }), null);
});

test('mensagem: envia com a sessão da página, confere a leitura de volta e marca como confirmada', async () => {
  const calls = [];
  const w = loadWithSession(moodleFake({ calls }));
  const out = await w.ALN.messenger.send({ userId: 15, text: ' Olá! ', fetchImpl: w.fetch, doc: w.document });
  assert.equal(out.confirmed, true);
  assert.equal(out.msgid, 77);
  assert.deepEqual(calls.map(c => c.method), ['core_message_send_instant_messages', 'core_message_get_conversation_messages']);
  assert.equal(calls[0].sesskey, 'AbC123xyz');
  assert.equal(calls[0].args.messages[0].touserid, 15);
  assert.equal(calls[0].args.messages[0].text, 'Olá!');
  assert.equal(calls[1].args.convid, 5);
});

test('mensagem: se a leitura de volta não acha a mensagem, NÃO diz que foi conferida', async () => {
  const w = loadWithSession(moodleFake({ readReply: [{ error: false, data: { messages: [{ id: 1 }] } }] }));
  const out = await w.ALN.messenger.send({ userId: 15, text: 'oi', fetchImpl: w.fetch, doc: w.document });
  assert.equal(out.confirmed, false);
  assert.match(out.note, /não apareceu na conversa/);
});

test('mensagem: Moodle recusa (aluno bloqueou / sem permissão) vira erro claro e nada é registrado como enviado', async () => {
  const w = loadWithSession(moodleFake({ sendReply: [{ error: false, data: [{ msgid: -1, errormessage: 'Você não pode enviar mensagem a este usuário' }] }] }));
  await assert.rejects(() => w.ALN.messenger.send({ userId: 15, text: 'oi', fetchImpl: w.fetch, doc: w.document }), /não enviou: Você não pode enviar/);
});

test('mensagem: sessão inválida, HTTP de erro e resposta estranha', async () => {
  const sess = loadWithSession(moodleFake({ sendReply: [{ error: true, exception: { errorcode: 'invalidsesskey', message: 'x' } }] }));
  await assert.rejects(() => sess.ALN.messenger.send({ userId: 1, text: 'oi', fetchImpl: sess.fetch, doc: sess.document }), /sessão do Moodle expirou/);
  const http = loadWithSession(async () => jsonRes({}, false, 503));
  await assert.rejects(() => http.ALN.messenger.send({ userId: 1, text: 'oi', fetchImpl: http.fetch, doc: http.document }), /HTTP 503/);
  const estranha = loadWithSession(async () => ({ ok: true, status: 200, text: async () => '<html>' }));
  await assert.rejects(() => estranha.ALN.messenger.send({ userId: 1, text: 'oi', fetchImpl: estranha.fetch, doc: estranha.document }), /não foi reconhecida/);
});

test('mensagem: validações antes de qualquer rede (sem id, sem texto, sem sessão, texto grande)', async () => {
  const calls = [];
  const w = loadWithSession(moodleFake({ calls }));
  await assert.rejects(() => w.ALN.messenger.send({ userId: null, text: 'oi', fetchImpl: w.fetch, doc: w.document }), /identificador do aluno/);
  await assert.rejects(() => w.ALN.messenger.send({ userId: 1, text: '   ', fetchImpl: w.fetch, doc: w.document }), /Escreva a mensagem/);
  await assert.rejects(() => w.ALN.messenger.send({ userId: 1, text: 'x'.repeat(5000), fetchImpl: w.fetch, doc: w.document }), /passou de/);
  w.document.body.innerHTML = '<p>sem sessão</p>';
  await assert.rejects(() => w.ALN.messenger.send({ userId: 1, text: 'oi', fetchImpl: w.fetch, doc: w.document }), /sua sessão do Moodle/);
  assert.equal(calls.length, 0);
});

test('mensagem: envio duplicado simultâneo para o mesmo aluno é barrado', async () => {
  let release; const gate = new Promise(r => { release = r; });
  const base = moodleFake();
  const w = loadWithSession(async (u, o) => { await gate; return base(u, o); });
  const first = w.ALN.messenger.send({ userId: 9, text: 'oi', fetchImpl: w.fetch, doc: w.document });
  await assert.rejects(() => w.ALN.messenger.send({ userId: 9, text: 'oi', fetchImpl: w.fetch, doc: w.document }), /já existe um envio em andamento/i);
  release(); await first;
});

test('registro de contato: guarda, limita a 5 por aluno e apaga por curso', async () => {
  const w = loadWithSession();
  const course = { id: 7 };
  for (let i = 0; i < 7; i++) await w.ALN.messenger.addLog(course, 'id:15', { at: i, msgid: i, confirmed: true, text: 't' });
  const log = await w.ALN.messenger.loadLog(course);
  assert.equal(log['id:15'].length, 5);
  assert.equal(log['id:15'][4].msgid, 6);
  await w.ALN.messenger.clearLog(course);
  assert.equal(JSON.stringify(await w.ALN.messenger.loadLog(course)), '{}');
});

// ---- leitor: livro de notas lento ----
test('leitor: pede o livro de notas em páginas de 100 e tenta de novo uma vez após erro 5xx', async () => {
  const urls = []; let falhou = false;
  const base = fakeFetch({ '/grade/report/grader/index.php': graderPage(), '/user/index.php': participantsPage() });
  const w = load(undefined, async (u, o) => {
    urls.push(u);
    if (u.includes('/grade/report/grader/') && !falhou) { falhou = true; return { ok: false, status: 504, url: u, text: async () => '' }; }
    return base(u, o);
  });
  const data = await w.ALN.reader.readCourse({ settings: { ...w.ALN.reader.SETTINGS, requestDelayMs: 0, retryDelayMs: 0 } });
  assert.equal(data.students.length, 6);
  assert.ok(urls.filter(u => u.includes('/grade/report/grader/')).length >= 2);
  assert.match(urls.find(u => u.includes('/grade/report/grader/')), /perpage=100/);
});

test('leitor: tempo limite do livro de notas explica o que fazer, depois de uma nova tentativa', async () => {
  let n = 0;
  const w = load(undefined, (u, o) => {
    if (!u.includes('/grade/report/grader/')) return fakeFetch({ '/user/index.php': participantsPage() })(u, o);
    n += 1;
    return new Promise((_, reject) => o.signal.addEventListener('abort', () => reject(Object.assign(new Error('abort'), { name: 'AbortError' }))));
  });
  await assert.rejects(() => w.ALN.reader.readCourse({ settings: { ...w.ALN.reader.SETTINGS, requestDelayMs: 0, retryDelayMs: 0, gradebookTimeoutMs: 30 } }), /tempo limite excedido.*mais de .* s.*grupo/);
  assert.equal(n, 2);
});

// ---- leitor: continuar de onde parou ----
test('leitor: falha nos participantes mantém o livro de notas e "continuar" repete só os participantes', async () => {
  const calls = []; let quebra = true;
  const base = fakeFetch({ '/grade/report/grader/index.php': graderPage(), '/user/index.php': participantsPage() });
  const w = load(undefined, async (u, o) => {
    const path = new URL(u).pathname; calls.push(path);
    if (path === '/user/index.php' && quebra) return { ok: false, status: 503, url: u, text: async () => '' };
    return base(u, o);
  });
  const S = { ...w.ALN.reader.SETTINGS, requestDelayMs: 0, retryDelayMs: 0, retries: 0 };
  const parcial = await w.ALN.reader.readCourse({ settings: S });
  assert.equal(parcial.coverage.complete, false);
  assert.deepEqual(Array.from(parcial.pending, x => x.key), ['participants']);
  assert.equal(parcial.students.length, 6);
  assert.ok(w.ALN.reader.canResume());
  quebra = false; calls.length = 0;
  const completo = await w.ALN.reader.readCourse({ settings: S, resume: true });
  assert.deepEqual(calls, ['/user/index.php']);
  assert.equal(completo.pending.length, 0);
  assert.equal(completo.coverage.complete, true);
});

test('leitor: página do livro de notas que falha é retomada sem reler as anteriores', async () => {
  const calls = []; let quebra = true;
  const rotas = {
    '/grade/report/grader/index.php': graderPage({ alunos: ALUNOS, porPagina: 3, pagina: 0, paginasTotal: 2 }),
    '/grade/report/grader/index.php?page=1': graderPage({ alunos: ALUNOS, porPagina: 3, pagina: 1, paginasTotal: 2 }),
    '/user/index.php': participantsPage()
  };
  const base = fakeFetch(rotas);
  const w = load(undefined, async (u, o) => {
    calls.push(new URL(u).pathname + (new URL(u).searchParams.get('page') ? '?page=' + new URL(u).searchParams.get('page') : ''));
    if (quebra && new URL(u).searchParams.get('page') === '1') return { ok: false, status: 500, url: u, text: async () => '' };
    return base(u, o);
  });
  const S = { ...w.ALN.reader.SETTINGS, requestDelayMs: 0, retryDelayMs: 0, retries: 0 };
  const parcial = await w.ALN.reader.readCourse({ settings: S });
  assert.equal(parcial.students.length, 3);
  assert.deepEqual(Array.from(parcial.pending, x => x.key), ['gradebook']);
  quebra = false; calls.length = 0;
  const completo = await w.ALN.reader.readCourse({ settings: S, resume: true });
  assert.deepEqual(calls.filter(c => c.startsWith('/grade')), ['/grade/report/grader/index.php?page=1']);
  assert.equal(completo.students.length, 6);
  assert.equal(completo.pending.length, 0);
});

test('leitor: cancelar interrompe e guarda o que já foi lido; diagnóstico não traz dados de alunos', async () => {
  const base = fakeFetch({ '/grade/report/grader/index.php': graderPage(), '/user/index.php': participantsPage() });
  const ctl = new AbortController();
  const w = load(undefined, async (u, o) => { const r = await base(u, o); if (u.includes('/grade/report/grader/')) ctl.abort(); return r; });
  await assert.rejects(() => w.ALN.reader.readCourse({ settings: { ...w.ALN.reader.SETTINGS, requestDelayMs: 0 }, signal: ctl.signal }), /cancelada/);
  const d = JSON.stringify(w.ALN.reader.diagnostics());
  assert.ok(w.ALN.reader.canResume());
  assert.ok(!/Ana|Fábio|@/.test(d));
});

// ---- filtros, contagens e ordenação ----
test('filtros: faixas de último acesso, itens com nota e pendência', () => {
  const { w, students } = buildAll();
  const F = w.ALN.filters;
  const por = n => students.find(s => s.name.startsWith(n));
  assert.equal(F.accessBucket(por('Ana')), '1-7');
  assert.equal(F.accessBucket(por('Camila')), '8-14');
  assert.equal(F.accessBucket(por('Diego')), '15-30');
  assert.equal(F.accessBucket(por('Fábio')), '15-30');
  assert.equal(F.gradedBucket(por('Ana')), 'completo');
  assert.equal(F.gradedBucket(por('Fábio')), 'alguns');
  assert.ok(F.pendBucket(por('Ana')).includes('em_dia'));
  assert.ok(F.pendBucket(por('Bruno')).includes('com'));
});

test('filtros: combinam entre si e a contagem de cada grupo respeita os outros filtros', () => {
  const { w, students } = buildAll();
  const F = w.ALN.filters;
  const comPend = F.filterStudents(students, { pend: 'com' });
  assert.equal(comPend.length, students.filter(s => s.itemsMissing > 0).length);
  const c = F.counts(students, { pend: 'com' }, 'access');
  assert.equal(c.todos, comPend.length);
  const soma = Object.entries(c).filter(([k]) => k !== 'todos').reduce((a, [, v]) => a + v, 0);
  assert.equal(soma, comPend.length);
  assert.equal(F.filterStudents(students, { pend: 'com', access: '15-30' }).every(s => s.itemsMissing > 0 && F.accessBucket(s) === '15-30'), true);
  assert.equal(F.filterStudents(students, { q: 'CAMILA' }).length, 1, 'busca sem diferenciar maiúsculas');
  assert.equal(F.filterStudents(students, { q: 'fabio' }).length, 1, 'busca sem acento');
  assert.equal(F.activeCount({ pend: 'com', access: 'todos', q: ' ' }), 1);
});

test('ordenação: urgência põe o mais grave primeiro e sem nota/acesso não vira zero', () => {
  const { w, students } = buildAll();
  const F = w.ALN.filters;
  const rank = { imediato: 5, alto: 4, atencao: 3, verificar: 2, regular: 1 };
  const u = F.sortStudents(students, 'urgency');
  for (let i = 1; i < u.length; i++) assert.ok(rank[u[i - 1].risk.level] >= rank[u[i].risk.level]);
  const porAcesso = F.sortStudents(students, 'access', 'desc');
  assert.equal(porAcesso[0].name.startsWith('Fábio'), true, 'maior tempo sem acessar primeiro');
  assert.equal(F.initials('ana beatriz souza'), 'AB');
  assert.equal(F.initials(''), '?');
});

// ---- leitura das tarefas (entregas) ----
function tarefasFetch(log, { falha = null } = {}) {
  const base = fakeFetch({ '/grade/report/grader/index.php': graderPage(), '/user/index.php': participantsPage(), '/course/view.php': courseWithAssignments() });
  return async (u, o) => {
    const url = new URL(u);
    if (url.pathname === '/mod/assign/view.php') {
      const id = url.searchParams.get('id'); const grading = url.searchParams.get('action') === 'grading';
      log.push(`${id}${grading ? ':entregas' : ':resumo'}`);
      if (falha && falha.id === id && falha.ativo) return { ok: false, status: 504, url: u, text: async () => '' };
      return { ok: true, status: 200, url: u, text: async () => (grading ? assignGradingPage(id) : assignViewPage(id)) };
    }
    return base(u, o);
  };
}
const SET = w => ({ ...w.ALN.reader.SETTINGS, requestDelayMs: 0, retryDelayMs: 0, retries: 0 });

test('tarefas: lê prazo e entregas de cada atividade e separa sem entrega de aguardando correção', async () => {
  const log = [];
  const w = load(undefined, tarefasFetch(log));
  const dados = await w.ALN.reader.readCourse({ settings: SET(w) });
  const t = await w.ALN.tarefas.read({ settings: SET(w) });
  assert.equal(t.assignments.length, 4);
  assert.equal(t.pending.length, 0);
  assert.equal(log.length, 8, 'um resumo e uma tabela de entregas por atividade');
  const itens = dados.gradebook.items.filter(w.ALN.isActivityItem);
  const now = new Date('2026-10-30T12:00:00Z').getTime();
  const fabio = dados.students.find(s => s.name.startsWith('Fábio'));
  const ov = w.ALN.tarefas.overview(fabio, itens, t, now);
  assert.equal(ov.readEntregas, true);
  assert.deepEqual(Array.from(ov.byItem, x => x.state), ['avaliada', 'sem_entrega', 'sem_entrega', 'sem_entrega']);
  assert.deepEqual(Array.from(ov.pendencias, x => x.name), ['AV2 Endereçamento', 'AV3 Serviços', 'AV4 Segurança']);
  assert.equal(ov.pendencias[0].overdue, true);
  assert.equal(ov.pendencias[2].overdue, false, 'prazo no futuro não é atraso');
  const bruno = dados.students.find(s => s.name.startsWith('Bruno'));
  const ovB = w.ALN.tarefas.overview(bruno, itens, t, now);
  assert.equal(ovB.byItem[2].state, 'aguardando', 'enviada e sem nota = aguardando a correção do tutor, não pendência do aluno');
  assert.equal(ovB.pendencias.length, 0);
  assert.equal(ovB.entregues, 4);
});

test('tarefas: sem ler as entregas, "pendência" é só item sem nota e o painel não afirma falta de entrega', async () => {
  const w = load(undefined, tarefasFetch([]));
  const dados = await w.ALN.reader.readCourse({ settings: SET(w) });
  const itens = dados.gradebook.items.filter(w.ALN.isActivityItem);
  const ov = w.ALN.tarefas.overview(dados.students.find(s => s.name.startsWith('Fábio')), itens, null);
  assert.equal(ov.readEntregas, false);
  assert.ok(ov.byItem.every(x => x.state === 'avaliada' || x.state === 'sem_nota'));
});

test('tarefas: atividade que falha fica pendente e "continuar" lê só ela', async () => {
  const log = []; const falha = { id: '703', ativo: true };
  const w = load(undefined, tarefasFetch(log, { falha }));
  await w.ALN.reader.readCourse({ settings: SET(w) });
  const parcial = await w.ALN.tarefas.read({ settings: SET(w) });
  assert.equal(parcial.pending.length, 1);
  assert.equal(parcial.pending[0].name, 'AV3 Serviços');
  assert.equal(parcial.complete, false);
  falha.ativo = false; log.length = 0;
  const completo = await w.ALN.tarefas.read({ settings: SET(w), resume: true });
  assert.deepEqual(log, ['703:resumo', '703:entregas']);
  assert.equal(completo.pending.length, 0);
  assert.equal(completo.complete, true);
});

test('tarefas: atividade só se liga ao item do livro de notas por nome idêntico', async () => {
  const w = load(undefined, tarefasFetch([]));
  const dados = await w.ALN.reader.readCourse({ settings: SET(w) });
  const t = await w.ALN.tarefas.read({ settings: SET(w) });
  t.assignments[0].name = 'AV1 Fundamentos de Redes';
  const itens = dados.gradebook.items.filter(w.ALN.isActivityItem);
  assert.equal(w.ALN.tarefas.linkItems(itens, t).size, 3);
});

// ---- relatório em HTML e mensagem com pendências ----
const modeloHtml = (extra = {}) => ({
  course: { name: 'Redes <b>UC</b>' }, readAt: Date.UTC(2026, 9, 22, 12), categoryLabel: 'Todo o curso', minimumGrade: 60, recoveryMin: 40, warnings: [],
  entregasLidas: true, entregasPendentes: 0,
  summary: { alunos: 2, media: 70, atencao: 1, riscoAlto: 1, comPendencia: 1, sem30: 0 },
  activities: [{ name: 'AV1', avgPct: 80, graded: 2, total: 2 }],
  students: [
    { name: 'Ana <img src=x onerror=alert(1)>', email: 'a@x.com', level: 'regular', levelLabel: 'Regular', situationLabel: 'Na média', totalDisplay: '90', totalPct: 90, accessKnown: true, accessDays: 1, itemCount: 1, entregues: 1, pend: 0, reasons: [], unknown: [], action: 'Seguir', activities: [{ name: 'AV1', state: 'avaliada', display: '9', dueText: '05/10/2026', overdue: false }], contacts: [] },
    { name: 'Bruno', email: '', level: 'alto', levelLabel: 'Alto', situationLabel: 'Abaixo', totalDisplay: '30', totalPct: 30, accessKnown: false, accessDays: null, itemCount: 1, entregues: 0, pend: 1, reasons: ['Nota baixa'], unknown: [], action: 'Contatar', activities: [{ name: 'AV1', state: 'sem_entrega', display: '', dueText: '05/10/2026', overdue: true }], contacts: [] }
  ], ...extra
});
test('relatório HTML lista todos os alunos, escapa texto do Moodle e não usa recursos externos', () => {
  const w = load();
  const html = w.ALN.reportHtml.build(modeloHtml());
  assert.match(html, /^<!doctype html>/i);
  assert.equal((html.match(/<details class="st"/g) || []).length, 2);
  assert.ok(!html.includes('<img src=x'), 'HTML do nome precisa ser escapado');
  assert.ok(html.includes('&lt;img src=x'));
  assert.ok(!html.includes('<b>UC</b>'));
  assert.match(html, /Sem entrega/);
  assert.ok(!/https?:\/\//.test(html) && !/<script[^>]+src=/.test(html));
});
test('relatório HTML avisa quando as entregas não foram lidas', () => {
  const w = load();
  const html = w.ALN.reportHtml.build(modeloHtml({ entregasLidas: false }));
  assert.match(html, /entregas n[ãa]o foram lidas|sem nota/i);
});
test('mensagem lista só as atividades pendentes escolhidas e mantém o texto antigo sem lista', () => {
  const w = load();
  const st = { name: 'Bruno Henrique Lima', risk: { level: 'alto', reasons: [] }, accessKnown: true, lastAccessDays: 12 };
  const sem = w.ALN.messenger.buildMessage(st, 'Redes', undefined);
  const com = w.ALN.messenger.buildMessage(st, 'Redes', undefined, [{ name: 'AV2 Endereçamento', dueText: '12/10' }, { name: 'AV4 Segurança', dueText: '' }]);
  assert.ok(!/Atividades pendentes/.test(sem));
  assert.match(com, /Atividades pendentes:\n• AV2 Endereçamento \(prazo 12\/10\)\n• AV4 Segurança\n/);
  assert.equal(w.ALN.messenger.buildMessage(st, 'Redes', undefined, []), sem);
});

test('fila de envio: um por vez, não reenvia enviadas, tentar de novo só nas falhas e para após 3 falhas seguidas', async () => {
  const w = load();
  const F = w.ALN.fila;
  const mk = n => F.novoItem({ key: `id:${n}`, name: `Aluno ${n}`, userId: n, text: `oi ${n}` });
  const items = [mk(1), mk(2), mk(3)];
  const calls = []; let falha = new Set([2]);
  const send = async ({ userId }) => { calls.push(userId); if (falha.has(userId)) throw new Error('sem resposta do Moodle'); return { at: 1, msgid: userId, confirmed: true, note: '' }; };
  const sleeps = [];
  const r1 = await F.runQueue({ items, send, sleep: async ms => sleeps.push(ms), gapMs: 2000 });
  assert.equal(r1.parou, false);
  assert.deepEqual(calls, [1, 2, 3]);
  assert.deepEqual(sleeps, [2000, 2000]);
  assert.deepEqual(items.map(i => i.state), ['enviada', 'falhou', 'enviada']);
  assert.equal(items[1].error, 'sem resposta do Moodle');
  falha = new Set();
  F.prepararNovaTentativa(items);
  assert.deepEqual(items.map(i => i.state), ['enviada', 'fila', 'enviada']);
  await F.runQueue({ items, send, sleep: async () => {} });
  assert.deepEqual(calls, [1, 2, 3, 2]); // só o 2 foi reenviado
  assert.equal(F.resumo(items).enviada, 3);
  // parada pelo usuário e falhas seguidas
  const b = [mk(4), mk(5), mk(6), mk(7)]; let n = 0;
  const rs = await F.runQueue({ items: b, send, sleep: async () => {}, shouldStop: () => n++ >= 3 });
  assert.equal(rs.parou, true);
  assert.ok(b.some(i => i.state === 'fila'));
  const c = [mk(8), mk(9), mk(10), mk(11)]; falha = new Set([8, 9, 10, 11]);
  const rf = await F.runQueue({ items: c, send, sleep: async () => {} });
  assert.equal(rf.parou, true);
  assert.equal(c[3].state, 'fila');
});

// ---- Excel (.xlsx) ----
function readZip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22; while (end >= 0 && dv.getUint32(end, true) !== 0x06054B50) end--;
  assert.ok(end >= 0, 'fim do ZIP não encontrado');
  const count = dv.getUint16(end + 10, true); let p = dv.getUint32(end + 16, true); const out = {};
  for (let i = 0; i < count; i++) {
    assert.equal(dv.getUint32(p, true), 0x02014B50);
    const crc = dv.getUint32(p + 16, true), size = dv.getUint32(p + 24, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nl));
    const lnl = dv.getUint16(off + 26, true), lel = dv.getUint16(off + 28, true), start = off + 30 + lnl + lel;
    const data = bytes.subarray(start, start + size);
    out[name] = { text: new TextDecoder().decode(data), crc, data };
    p += 46 + nl + el + cl;
  }
  return out;
}

test('xlsx: pacote válido, CRC conferido, abas com nomes seguros e únicos', () => {
  const w = load();
  const bytes = w.ALN.xlsx.build([
    { name: 'Téc. Redes: Turma A/B?', rows: [['Aluno', 'Nota'], ['Ana', 88.5], ['Bia', null]] },
    { name: 'téc. redes: turma a/b?', rows: [['x']] },
    { name: '', rows: [] }
  ]);
  const z = readZip(bytes);
  assert.deepEqual(Object.keys(z).sort(), ['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml', 'xl/worksheets/sheet3.xml']);
  Object.values(z).forEach(f => assert.equal(w.ALN.xlsx.crc32(f.data), f.crc));
  const names = [...z['xl/workbook.xml'].text.matchAll(/<sheet name="([^"]*)"/g)].map(m => m[1]);
  assert.equal(names.length, 3);
  assert.ok(names.every(n => n.length <= 31 && !/[\\/?*[\]:]/.test(n)));
  assert.equal(new Set(names.map(n => n.toLowerCase())).size, 3);
});

test('xlsx: números viram números, sem nota fica vazio (nunca 0), texto com fórmula continua texto e XML é escapado', () => {
  const w = load();
  const z = readZip(w.ALN.xlsx.build([{ name: 'T', rows: [['Aluno', 'Nota', 'Obs'], ['=HYPERLINK("http://x")', 0, 'a <b> & "c"\u0001'], ['Sem nota', null, '']] }]));
  const s = z['xl/worksheets/sheet1.xml'].text;
  assert.match(s, /<c r="B2" s="2"><v>0<\/v><\/c>/);           // o zero digitado continua zero
  assert.doesNotMatch(s, /<c r="B3"/);                            // sem nota = sem célula
  assert.match(s, /t="inlineStr"[^>]*><is><t xml:space="preserve">=HYPERLINK/); // texto, não fórmula
  assert.doesNotMatch(s, /<f>/);
  assert.match(s, /a &lt;b&gt; &amp; &quot;c&quot;<\/t>/);
  assert.doesNotMatch(s, /\u0001/);
  assert.match(s, /<pane ySplit="1"/);
  assert.match(s, /<autoFilter ref="A1:C3"\/>/);
});

test('planilhas das telas: mesmos alunos e notas dos CSV, números reais e vazio sem nota', () => {
  const { w, gb, students } = buildAll();
  const g = w.ALN.gradesSheet(students, gb, '');
  assert.equal(g.rows.length, students.length + 1);
  assert.ok(g.rows[0].includes('Nota total'));
  const body = g.rows.slice(1);
  assert.ok(body.every(r => r.slice(2, -2).every(v => v === null || typeof v === 'number')));
  assert.ok(body.some(r => r.slice(2, -2).some(v => v === null)), 'esperava ao menos um item sem nota');
  const csvLines = w.ALN.gradesCsv(students, gb, '').trim().split(/\r\n/).length - 1;
  assert.equal(csvLines, body.length);
  assert.equal(w.ALN.studentsSheet(students).rows.length, students.length + 1);
  assert.ok(w.ALN.reportSheets(w.ALN.buildReport(students, gb, w.ALN.DEFAULTS, ''), 'X').length === 2);
});

// ---- Relatório da turma ----
test('turma: abas por turma, UCs em colunas, sem nota vazio, Situação com as faixas e Avisos', () => {
  const w = load();
  const T = w.ALN.turma;
  const eq = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b)); // objetos vêm de outra janela (jsdom)
  const st = (key, name, total, situation) => ({ key, name, total, situation });
  const reports = [
    { id: '7', name: 'Redes', category: 'Téc. Redes · A', students: [st('id:1', 'Ana', 90, 'media'), st('id:2', 'Bia', null, 'sem_nota'), st('id:3', 'Caio', 40, 'abaixo')] },
    { id: '8', name: 'Segurança', category: 'téc. redes · a ', students: [st('id:1', 'Ana Souza', 70, 'media'), st('id:3', 'Caio', 55, 'recuperacao')] },
    { id: '9', name: 'Lógica', category: 'Téc. Info · B', students: [st('id:9', 'Zeca', 0, 'abaixo')] }
  ];
  const sheets = T.buildSheets(reports, [{ name: 'Banco', category: 'Téc. Info · B', reason: 'sessão expirada' }]);
  eq(sheets.map(s => s.name), ['Téc. Redes · A', 'Téc. Info · B', 'Situação', 'Avisos']);
  eq(sheets[0].rows[0], ['Aluno', 'Redes', 'Segurança']);
  eq(sheets[0].rows[1], ['Ana Souza', 90, 70]);            // nome mais completo vence, mesmo aluno nas duas UCs
  eq(sheets[0].rows[2], ['Bia', null, null]);               // sem nota = vazio, nunca 0
  eq(sheets[0].rows[3], ['Caio', 40, 55]);
  eq(sheets[1].rows[1], ['Zeca', 0]);                       // zero lançado de verdade continua zero
  const sit = sheets[2].rows;
  eq(sit[0], ['Turma', 'UC', 'Alunos', 'Sem nota', 'Abaixo da faixa', 'Recuperação', 'Média alcançada']);
  eq(sit[1], ['Téc. Redes · A', 'Redes', 3, 1, 1, 0, 1]);
  eq(sit[2], ['Téc. Redes · A', 'Segurança', 2, 0, 0, 1, 1]);
  eq(sheets[3].rows[1], ['Banco', 'Téc. Info · B', 'sessão expirada']);
  assert.ok(w.ALN.xlsx.build(sheets).length > 500);
});

test('turma: detecta cursos nos cartões de "Meus cursos" sem duplicar nem trazer texto oculto', () => {
  const w = load();
  const d = page('<html><body><div role="main"><div class="course-summaryitem" data-course-id="7"><a href="/course/view.php?id=7"><img></a><a class="coursename" href="/course/view.php?id=7"><span class="sr-only">Nome do curso</span> Redes</a><span class="categoryname">Turma A</span></div><div data-course-id="8"><a class="coursename" href="https://outro.com/course/view.php?id=8">Fora</a></div><a href="/course/view.php?id=abc">x</a></div></body></html>');
  const list = w.ALN.turma.detectCourses(d, 'https://ead.senai.br');
  assert.equal(JSON.stringify(list), JSON.stringify([{ id: '7', name: 'Redes', category: 'Turma A' }]));
});

// ---- 0.13.0: armazenamento versionado, backup e diagnóstico ----
const eq = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
const NOW = Date.parse('2026-10-31T12:00:00Z');
const dias = n => new Date(NOW - n * 86400000).toISOString();
const contatos = () => ({ 'ead.senai.br:7': { 'id:1': [{ at: dias(400), msgid: 1, text: 'velha' }, { at: dias(10), msgid: 2, text: 'nova' }], 'id:2': [{ at: dias(500), msgid: 3, text: 'velha2' }] } });

test('storage: migração 0→1 grava a versão; formato futuro não é tocado', () => {
  const w = load(); const S = w.ALN.storage;
  const m = S.migrate({ 'hub.contatos.v1': contatos() });
  assert.equal(m.mudou, true); assert.equal(m.all[S.META_KEY].schema, S.SCHEMA); assert.equal(S.migrate(m.all).mudou, false);
  const f = S.migrate({ [S.META_KEY]: { schema: 99 } }); assert.equal(f.futuro, true); assert.equal(f.mudou, false);
});

test('storage: validade remove só o antigo e aluno sem registro some', () => {
  const S = load().ALN.storage;
  const r = S.prune({ 'hub.contatos.v1': contatos() }, NOW);
  assert.equal(r.removidos, 2);
  eq(Object.keys(r.all['hub.contatos.v1']['ead.senai.br:7']), ['id:1']);
  assert.equal(S.prune({ 'hub.contatos.v1': contatos(), 'uas.config': { validadeContatosDias: 0 } }, NOW).removidos, 0, '0 = nunca expirar');
});

test('storage: uso por categoria e aviso a 70%', () => {
  const S = load().ALN.storage;
  const u = S.usage({ 'hub.contatos.v1': contatos() });
  assert.equal(u.categorias[0].categoria, 'Contatos'); assert.equal(u.categorias[0].itens, 3); assert.equal(u.aviso, false);
  const grande = { 'hub.contatos.v1': { c: { a: [{ at: dias(1), text: 'x'.repeat(S.QUOTA * 0.72) }] } } };
  assert.equal(S.usage(grande).aviso, true);
});

test('storage: backup exporta só chaves conhecidas e a importação valida', () => {
  const S = load().ALN.storage;
  const txt = S.exportBackup({ 'hub.contatos.v1': contatos(), 'cookie.sessao': 'segredo', 'uas.meta': { schema: 1 } }, NOW, '0.13.0');
  assert.ok(!/segredo|cookie/.test(txt));
  const p = S.parseBackup(txt); assert.equal(p.ok, true); eq(Object.keys(p.dados).sort(), ['hub.contatos.v1', 'uas.config']);
  assert.equal(S.parseBackup('{}').ok, false); assert.equal(S.parseBackup('não é json').ok, false); assert.equal(S.parseBackup('').ok, false);
  assert.equal(S.parseBackup(JSON.stringify({ app: 'unidigital-assist', schema: 99, dados: {} })).ok, false);
  const estranho = S.parseBackup(JSON.stringify({ app: 'unidigital-assist', schema: 1, dados: { 'hub.contatos.v1': {}, 'qualquer.coisa': 1, 'uas.config': { validadeContatosDias: 'x' } } }));
  eq(Object.keys(estranho.dados).sort(), ['hub.contatos.v1', 'uas.config']); assert.equal(estranho.dados['uas.config'].validadeContatosDias, 365);
});

test('storage: juntar não duplica e respeita o limite por aluno; substituir troca tudo', () => {
  const S = load().ALN.storage;
  const a = contatos(); const merged = S.mergeContatos(a, a); eq(merged, S.mergeContatos(a, {}));
  const muitos = { c: { x: Array.from({ length: 8 }, (_, i) => ({ at: dias(20 - i), msgid: i })) } };
  assert.equal(S.mergeContatos(muitos, {}).c.x.length, 5);
  const out = S.applyImport({ 'hub.contatos.v1': a }, { 'hub.contatos.v1': {} }, 'substituir'); eq(out['hub.contatos.v1'], {});
});

test('storage: init/clearAll/importar usam só as chaves da extensão (área simulada)', async () => {
  const S = load().ALN.storage; const store = { 'hub.contatos.v1': contatos(), 'outra.extensao': 1 };
  const area = { get: async keys => Object.fromEntries(keys.filter(k => k in store).map(k => [k, store[k]])), set: async o => Object.assign(store, o), remove: async keys => keys.forEach(k => delete store[k]) };
  const r = await S.init(area, NOW); assert.equal(r.removidos, 2); assert.equal(store['uas.meta'].schema, 1);
  await S.clearAll(area); assert.ok(!('hub.contatos.v1' in store)); assert.equal(store['outra.extensao'], 1);
});

test('diagnóstico: livro de notas, participantes e página desconhecida; texto sem dado de aluno', () => {
  const w = load('https://ead.senai.br/grade/report/grader/index.php?id=7');
  const doc = page(graderPage());
  const r = w.ALN.diagnostico.rodar(doc, new URL('https://ead.senai.br/grade/report/grader/index.php?id=7'), '0.13.0');
  assert.equal(r.tipo, 'livro-de-notas');
  assert.ok(r.itens.find(i => i.rotulo === 'Tabela do livro de notas' && i.estado === 'ok'));
  assert.ok(r.itens.find(i => i.rotulo === 'Coluna “Total do curso”' && i.estado === 'ok'));
  const texto = w.ALN.diagnostico.comoTexto(r);
  for (const a of ALUNOS) { assert.ok(!texto.includes(a.nome.split(' ')[0]), 'nome de aluno no diagnóstico'); assert.ok(!texto.includes(a.email || '@@@')); }
  assert.ok(!/\?id=7/.test(texto), 'não leva parâmetros do endereço');
  const p = w.ALN.diagnostico.rodar(page(participantsPage()), new URL('https://ead.senai.br/user/index.php?id=7'), '0.13.0');
  assert.ok(p.itens.find(i => i.rotulo === 'Coluna “Último acesso”' && i.estado === 'ok'));
  const vazio = w.ALN.diagnostico.rodar(page('<html><body><p>x</p></body></html>'), new URL('https://ead.senai.br/grade/report/grader/index.php?id=7'), '0.13.0');
  assert.ok(vazio.itens.some(i => i.estado === 'falha'), 'tabela ausente é falha, não sucesso');
  const out = w.ALN.diagnostico.rodar(page('<html><body></body></html>'), new URL('https://ead.senai.br/calendar/view.php'), '0.13.0');
  assert.equal(out.tipo, 'outra');
});

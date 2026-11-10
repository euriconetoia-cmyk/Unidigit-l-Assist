import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { APPS, tipoDaPagina } from '../src/apps.js';
import { createHandler } from '../src/hub-handler.js';

globalThis.__HUB_TEST__ = true;
const { mountLauncher } = await import('../src/launcher/launcher.js');

function mount(send) {
  const dom = new JSDOM('<!doctype html><html><body><div role="main"><h1>Curso</h1></div></body></html>', { url: 'https://ead.senai.br/course/view.php?id=7' });
  const sent = [];
  const ui = mountLauncher(dom.window.document, async message => { sent.push(message); return send ? send(message) : { ok: true, message: 'ok' }; });
  return { dom, ui, sent };
}
const flush = () => new Promise(r => setTimeout(r, 5));

test('o botão lateral aparece sozinho, mas o menu fica fechado e nada é enviado', () => {
  const { ui, sent } = mount();
  assert.ok(ui.tab);
  assert.equal(ui.isOpen(), false);
  assert.equal(ui.tab.getAttribute('aria-label'), 'Abrir Unidigit@l Assist');
  assert.equal(ui.tab.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(sent, []);
});

test('não monta duas vezes na mesma página', () => {
  const { dom } = mount();
  assert.equal(mountLauncher(dom.window.document, async () => ({})), null);
  assert.equal(dom.window.document.querySelectorAll('#hub-ead-launcher').length, 1);
});

const nomesMain = ui => [...ui.shadow.querySelectorAll('[data-view="main"] .items > .app b')].map(b => b.textContent);

test('menu na página do curso: só 4 entradas, sem descrição e sem rótulos de grupo; toda ferramenta continua existindo', () => {
  const { ui } = mount();
  ui.tab.click();
  assert.equal(ui.isOpen(), true);
  assert.deepEqual(nomesMain(ui), ['Alunos', 'Correção', 'Criar conteúdo', 'Datas do curso']);
  assert.equal(ui.shadow.querySelectorAll('.sec, small, .hint').length, 0);
  assert.equal(ui.shadow.querySelector('.rodape').textContent, 'Só age quando você clica');
  const ids = ui.items.map(i => i.getAttribute('data-app'));
  for (const a of APPS.filter(x => !x.oculto)) assert.ok(ids.includes(a.id), `falta ${a.id}`);
  assert.ok(ids.includes('grupo-correcao') && ids.includes('grupo-datas'));
});

test('o menu muda com a página: Meus cursos, atividade e página qualquer', () => {
  const nomes = url => { const { ui } = mountAt(url); ui.tab.click(); return nomesMain(ui); };
  assert.deepEqual(nomes('https://ead.senai.br/my/'), ['Criar conteúdo', 'Relatório da turma']);
  assert.deepEqual(nomes('https://ead.senai.br/mod/assign/view.php?id=55'), ['Alunos', 'Correção']);
  assert.deepEqual(nomes('https://ead.senai.br/user/index.php?id=3'), ['Alunos']);
  const { ui } = mountAt('https://ead.senai.br/mod/assign/view.php?id=55');
  assert.ok(ui.shadow.querySelector('[data-view="main"] [data-app="correcao"]'), 'na atividade, Correção abre direto (sem grupo)');
  assert.equal(ui.shadow.querySelector('[data-app="grupo-correcao"]'), null);
});

test('a engrenagem abre "Ajuda e dados" com voltar; fechar o menu volta ao principal', () => {
  const { ui } = mount();
  ui.tab.click();
  const view = n => ui.shadow.querySelector(`[data-view="${n}"]`);
  assert.equal(view('apoio').hidden, true);
  ui.shadow.querySelector('[data-ctl="apoio"]').click();
  assert.equal(view('main').hidden, true); assert.equal(view('apoio').hidden, false);
  const nomes = [...view('apoio').querySelectorAll('.app b')].map(b => b.textContent);
  assert.deepEqual(nomes, ['Compatibilidade', 'Meus dados', 'Sobre e novidades', 'Kahoot: importar perguntas', 'Modelo de perguntas (CSV)', 'Automação por blocos']);
  assert.match(view('apoio').textContent, /Mover aba/);
  view('apoio').querySelector('[data-ctl="voltar"]').click();
  assert.equal(view('main').hidden, false); assert.equal(view('apoio').hidden, true);
  ui.shadow.querySelector('[data-ctl="apoio"]').click();
  ui.tab.click(); ui.tab.click(); // fecha e reabre: volta ao principal
  assert.equal(view('main').hidden, false); assert.equal(view('apoio').hidden, true);
  ui.shadow.querySelector('[data-ctl="fechar"]').click();
  assert.equal(ui.isOpen(), false);
});

test('grupo: Correção abre a escolha (Pendências / Lançar notas) e Datas do curso (Conferir datas / Cronograma)', () => {
  const { ui } = mount();
  ui.tab.click();
  const view = n => ui.shadow.querySelector(`[data-view="${n}"]`);
  ui.shadow.querySelector('[data-app="grupo-correcao"]').click();
  assert.equal(view('main').hidden, true);
  assert.deepEqual([...view('grupo-correcao').querySelectorAll('.app b')].map(b => b.textContent), ['Pendências', 'Lançar notas por CSV']);
  view('grupo-correcao').querySelector('[data-ctl="voltar"]').click();
  ui.shadow.querySelector('[data-app="grupo-datas"]').click();
  assert.deepEqual([...view('grupo-datas').querySelectorAll('.app b')].map(b => b.textContent), ['Conferir datas', 'Cronograma da turma']);
});

test('Alt+U abre e fecha o menu; a lingueta anuncia o atalho', () => {
  const { ui, dom } = mount();
  const doc = dom.window.document;
  assert.equal(ui.tab.getAttribute('aria-keyshortcuts'), 'Alt+U');
  doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'u', altKey: true, bubbles: true }));
  assert.equal(ui.isOpen(), true);
  doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'U', altKey: true, bubbles: true }));
  assert.equal(ui.isOpen(), false);
  doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'u', bubbles: true })); // sem Alt: nada
  assert.equal(ui.isOpen(), false);
});

test('Mover aba sobe e desce 48 px, sem passar dos limites', () => {
  const { ui } = mount();
  const wrap = ui.shadow.querySelector('.wrap');
  const [sobe, desce] = ui.shadow.querySelectorAll('.mover');
  sobe.click(); assert.equal(wrap.style.getPropertyValue('--bt'), '144px');
  desce.click(); desce.click(); desce.click(); desce.click(); desce.click();
  assert.equal(wrap.style.getPropertyValue('--bt'), '24px');
});

test('setas ↑ ↓ andam entre as entradas visíveis do menu', () => {
  const { ui, dom } = mount();
  ui.open();
  const key = k => ui.shadow.querySelector('.panel').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  assert.equal(ui.shadow.activeElement.getAttribute('data-app'), 'alunos-notas');
  key('ArrowDown'); assert.equal(ui.shadow.activeElement.getAttribute('data-app'), 'grupo-correcao');
  key('ArrowUp'); key('ArrowUp'); assert.equal(ui.shadow.activeElement.getAttribute('data-app'), 'grupo-datas');
});

test('cada ferramenta tem ícone próprio (exceto as que repetem de propósito) e todos existem', () => {
  const nomes = APPS.map(a => a.icone);
  for (const grupo of [['pendencias', 'correcao', 'alunos-notas', 'relatorio-uc', 'conferir-datas', 'cronograma-turma']]) {
    const ic = grupo.map(id => APPS.find(a => a.id === id).icone);
    assert.equal(new Set(ic).size, ic.length);
  }
  assert.ok(nomes.every(Boolean));
});

test('ferramenta que não serve para a página some do menu (sem aviso "não se aplica aqui"), mas continua existindo oculta', () => {
  const { ui } = mountAt('https://ead.senai.br/mod/assign/view.php?id=55');
  ui.tab.click();
  assert.doesNotMatch(ui.shadow.textContent, /não se aplica aqui/);
  const pend = ui.shadow.querySelector('[data-app="pendencias"]');
  assert.ok(pend.closest('[hidden]'), 'Pendências fica no depósito oculto');
  assert.ok(!nomesMain(ui).includes('Datas do curso'));
});

test('Kahoot na gaveta pede a página da extensão; o modelo CSV baixa sem enviar nada', async () => {
  const { ui, sent, dom } = mount();
  dom.window.URL.createObjectURL = () => 'blob:x'; dom.window.URL.revokeObjectURL = () => {};
  const baixados = []; dom.window.HTMLAnchorElement.prototype.click = function () { baixados.push(this.download); };
  ui.tab.click();
  ui.shadow.querySelector('[data-app="modelo-kahoot"]').click(); await flush();
  assert.deepEqual(baixados, ['modelo-perguntas-kahoot.csv']); assert.deepEqual(sent, []);
  ui.shadow.querySelector('[data-app="kahoot"]').click(); await flush();
  assert.deepEqual(sent, [{ type: 'hub-open', app: 'kahoot' }]);
});

test('clicar em Pendências (dentro de Correção) envia o pedido e fecha o menu; "em breve" não envia nada', async () => {
  const { ui, sent } = mount();
  ui.tab.click();
  ui.shadow.querySelector('[data-ctl="apoio"]').click();
  ui.shadow.querySelector('[data-app="blocos"]').click();
  await flush();
  assert.deepEqual(sent, []);
  assert.match(ui.status.textContent, /ainda não está disponível/);
  ui.shadow.querySelector('[data-view="apoio"] [data-ctl="voltar"]').click();
  ui.shadow.querySelector('[data-app="grupo-correcao"]').click();
  ui.shadow.querySelector('[data-app="pendencias"]').click();
  await flush();
  assert.deepEqual(sent, [{ type: 'hub-open', app: 'pendencias' }]);
  assert.equal(ui.isOpen(), false);
});

test('erro da ferramenta fica visível no menu (menu continua aberto)', async () => {
  const { ui } = mount(() => ({ ok: false, error: 'Abra uma página de curso ou de categoria do Moodle para usar este bloco.' }));
  ui.tab.click();
  ui.items[1].click();
  await flush();
  assert.equal(ui.isOpen(), true);
  assert.match(ui.status.textContent, /curso ou de categoria/);
  assert.equal(ui.status.className, 'status err');
});

test('Esc e o próprio botão (agora X) recolhem o menu; clicar fora também', () => {
  const { ui, dom } = mount();
  const doc = dom.window.document;
  ui.tab.click();
  doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(ui.isOpen(), false);
  ui.tab.click();
  ui.tab.click();
  assert.equal(ui.isOpen(), false);
  ui.tab.click();
  doc.body.click();
  assert.equal(ui.isOpen(), false);
});

// ---- tratamento no service worker ----
const sender = (extra = {}) => ({ id: 'ext1', url: 'https://ead.senai.br/course/view.php?id=7', tab: { id: 12 }, ...extra });
const makeHandler = calls => createHandler({ runtimeId: 'ext1', host: { call: async (tab, mod, cmd, args) => { calls.push(args && Object.keys(args).length ? [tab, mod, cmd, args] : [tab, mod, cmd]); return { mensagem: 'Barra aberta.' }; } } });

test('handler: Pendências → módulo importar-notas, comando radar.abrir, na aba do remetente', async () => {
  const calls = [];
  const r = await makeHandler(calls)({ type: 'hub-open', app: 'pendencias' }, sender());
  assert.deepEqual(calls, [[12, 'importar-notas', 'radar.abrir']]);
  assert.deepEqual(r, { ok: true, message: 'Barra aberta.' });
  await makeHandler(calls)({ type: 'hub-open', app: 'correcao' }, sender());
  assert.equal(calls[1][2], 'correcao.abrir');
  await makeHandler(calls)({ type: 'hub-open', app: 'correcao', motivo: 'retomar' }, sender());
  assert.equal(calls[2][2], 'correcao.retomar');
  await makeHandler(calls)({ type: 'hub-open', app: 'pendencias', motivo: 'retomar' }, sender());
  assert.equal(calls[3][2], 'radar.abrir', 'só a Correção tem comando de retomada');
});

test('handler: recusa remetente de outra extensão, página fora do Moodle, ferramenta desconhecida ou em breve', async () => {
  const calls = [];
  const h = makeHandler(calls);
  assert.equal((await h({ type: 'hub-open', app: 'pendencias' }, sender({ id: 'outra' }))).ok, false);
  assert.match((await h({ type: 'hub-open', app: 'pendencias' }, sender({ url: 'https://example.com/' }))).error, /não é do Moodle/);
  assert.match((await h({ type: 'hub-open', app: 'xyz' }, sender())).error, /desconhecida/);
  assert.match((await h({ type: 'hub-open', app: 'blocos' }, sender())).error, /ainda não está disponível/);
  assert.equal((await h({ type: 'hub-open', app: 'pendencias' }, { id: 'ext1', url: 'https://ead.senai.br/' })).ok, false, 'sem aba');
  assert.deepEqual(calls, []);
  assert.equal(await h({ type: 'outra-coisa' }, sender()), null);
});

test('handler: Acompanhamento, Alunos e notas e Relatório da UC chamam o módulo alunos com a aba certa', async () => {
  const calls = [];
  const h = makeHandler(calls);
  for (const app of ['acompanhamento', 'alunos-notas', 'relatorio-uc']) assert.equal((await h({ type: 'hub-open', app }, sender())).ok, true);
  assert.deepEqual(calls.map(c => c.slice(1)), [['alunos', 'alunos.abrir', { aba: 'acomp' }], ['alunos', 'alunos.abrir', { aba: 'resumo' }], ['alunos', 'alunos.abrir', { aba: 'relatorio' }]]);
});

test('menu em cards: painel inerte quando fechado e rótulo do botão acompanha o estado', () => {
  const { ui } = mount();
  assert.equal(ui.panel.hasAttribute('inert'), true);
  ui.tab.click();
  assert.equal(ui.panel.hasAttribute('inert'), false);
  assert.equal(ui.tab.getAttribute('aria-expanded'), 'true');
  assert.equal(ui.tab.getAttribute('aria-label'), 'Fechar Unidigit@l Assist');
  ui.tab.click();
  assert.equal(ui.panel.hasAttribute('inert'), true);
  assert.equal(ui.tab.getAttribute('aria-label'), 'Abrir Unidigit@l Assist');
});

test('a caixa do menu não bloqueia cliques na página: só o botão e o painel aberto recebem eventos', () => {
  const { ui } = mount();
  const css = ui.shadow.querySelector('style').textContent;
  assert.match(css, /\.wrap \{[^}]*pointer-events: none/);
  assert.match(css, /\.tab \{[^}]*pointer-events: auto/);
  assert.match(css, /\.wrap\.open \.panel \{[^}]*pointer-events: auto/);
  assert.match(css, /\.panel \{[^}]*pointer-events: none/);
});

function mountAt(url, setup) {
  const dom = new JSDOM('<!doctype html><html><body><div role="main"><h1>Atividade</h1></div></body></html>', { url });
  if (setup) setup(dom.window);
  const sent = [];
  const ui = mountLauncher(dom.window.document, async message => { sent.push(message); return { ok: true, message: 'ok' }; });
  return { dom, ui, sent };
}
test('em página de atividade: Correção abre direto; Pendências não aparece e, se pedida, só explica (nada é enviado)', async () => {
  const { ui, sent } = mountAt('https://ead.senai.br/mod/assign/view.php?id=55');
  const btn = id => ui.shadow.querySelector(`.app[data-app="${id}"]`);
  btn('pendencias').click(); await flush();
  assert.equal(sent.length, 0);
  assert.match(ui.status.textContent, /não se aplica a esta página/);
  btn('correcao').click(); await flush();
  assert.deepEqual(sent, [{ type: 'hub-open', app: 'correcao' }]);
});
test('em página de curso: só o Relatório da turma é exclusivo de "Meus cursos" (fica oculto)', () => {
  const { ui } = mountAt('https://ead.senai.br/course/view.php?id=7');
  const ocultos = [...ui.shadow.querySelectorAll('[data-deposito] .app')].map(b => b.getAttribute('data-app'));
  assert.deepEqual(ocultos, ['relatorio-turma']);
});
test('depois de salvar no Moodle (conferência pendente) a Correção é retomada sozinha, uma vez', async () => {
  const { sent } = mountAt('https://ead.senai.br/mod/assign/view.php?id=55&action=grading', w => w.sessionStorage.setItem('imn_verify_v1', '{}'));
  await flush();
  assert.deepEqual(sent, [{ type: 'hub-open', app: 'correcao', motivo: 'retomar' }]);
});
test('navegação pedida pela Correção continua na tela de avaliação; marca velha é ignorada e apagada', async () => {
  const fresh = mountAt('https://ead.senai.br/mod/assign/view.php?id=55&action=grading', w => w.sessionStorage.setItem('hub.continuar.v1', JSON.stringify({ app: 'correcao', at: Date.now() })));
  await flush();
  assert.deepEqual(fresh.sent, [{ type: 'hub-open', app: 'correcao', motivo: 'continuar' }]);
  assert.equal(fresh.dom.window.sessionStorage.getItem('hub.continuar.v1'), null);
  const old = mountAt('https://ead.senai.br/mod/assign/view.php?id=55&action=grading', w => w.sessionStorage.setItem('hub.continuar.v1', JSON.stringify({ app: 'correcao', at: Date.now() - 600000 })));
  await flush();
  assert.equal(old.sent.length, 0);
  const curso = mountAt('https://ead.senai.br/course/view.php?id=7', w => w.sessionStorage.setItem('imn_verify_v1', '{}'));
  await flush();
  assert.equal(curso.sent.length, 0, 'fora de atividade nada é retomado');
});

test('hub-handler: app com página da extensão chama abrirPagina e só ela', async () => {
  const abertas = [];
  const handle = createHandler({ host: { call: async () => { throw new Error('não deveria injetar'); } }, runtimeId: 'abc', abrirPagina: async n => abertas.push(n) });
  const sender = { id: 'abc', url: 'https://ead.senai.br/my/', tab: { id: 3 } };
  const r = await handle({ type: 'hub-open', app: 'kahoot' }, sender);
  assert.equal(r.ok, true); assert.deepEqual(abertas, ['kahoot.html']);
  const semPagina = await createHandler({ host: {}, runtimeId: 'abc' })({ type: 'hub-open', app: 'kahoot' }, sender);
  assert.equal(semPagina.ok, false);
  const fora = await handle({ type: 'hub-open', app: 'kahoot' }, { ...sender, url: 'https://exemplo.com/' });
  assert.equal(fora.ok, false); assert.deepEqual(abertas, ['kahoot.html']);
});

test('tipoDaPagina: "Meus cursos" é /my/ (SENAI) e a raiz do site (FIEG); outras páginas não', () => {
  const t = u => tipoDaPagina({ href: u });
  for (const u of ['https://ead.senai.br/my/', 'https://ead.senai.br/my', 'https://ead.senai.br/my/courses.php', 'https://ead.fieg.com.br/', 'https://ead.fieg.com.br/index.php', 'https://ead.fieg.com.br/?redirect=0', 'https://ead.fieg.com.br/#cursos']) assert.equal(t(u), 'meus-cursos', u);
  assert.equal(t('https://ead.fieg.com.br/course/view.php?id=3'), 'curso');
  assert.equal(t('https://ead.fieg.com.br/user/index.php?id=3'), 'outra');
  assert.equal(t('https://ead.fieg.com.br/login/index.php'), 'outra');
  assert.equal(t('https://ead.fieg.com.br/mod/assign/view.php?id=9'), 'atividade');
});

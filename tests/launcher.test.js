import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { APPS } from '../src/apps.js';
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

test('o menu principal tem 6 ferramentas + "Ferramentas"; as indisponíveis ficam na gaveta como "em breve"', () => {
  const { ui } = mount();
  ui.tab.click();
  assert.equal(ui.isOpen(), true);
  assert.equal(ui.items.length, APPS.length + 1); // + o botão da gaveta
  const main = [...ui.shadow.querySelectorAll('[data-view="main"] .app b')].map(b => b.textContent);
  assert.deepEqual(main, ['Pendências', 'Correção', 'Acompanhamento', 'Alunos e notas', 'Relatório da UC', 'Relatório da turma', 'Ferramentas']);
  const gav = [...ui.shadow.querySelectorAll('[data-view="gaveta"] .app b')].map(b => b.textContent);
  assert.deepEqual(gav, ['Kahoot — importar perguntas', 'Modelo de perguntas (CSV)', 'Ajustar datas do Moodle', 'Automação por blocos', 'Compatibilidade', 'Meus dados', 'Sobre']);
  const tag = n => ui.shadow.querySelector(`[data-app="${n}"]`).getAttribute('aria-disabled');
  assert.deepEqual(['kahoot', 'modelo-kahoot', 'ajustar-datas', 'blocos'].map(tag), ['false', 'false', 'true', 'true']);
  assert.match(ui.shadow.querySelector('[data-app="blocos"]').textContent, /em breve/);
});

test('a gaveta Ferramentas abre com voltar, e fechar o menu volta ao principal', () => {
  const { ui } = mount();
  ui.tab.click();
  const view = n => ui.shadow.querySelector(`[data-view="${n}"]`);
  assert.equal(view('gaveta').hidden, true);
  ui.shadow.querySelector('[data-app="ferramentas"]').click();
  assert.equal(view('main').hidden, true); assert.equal(view('gaveta').hidden, false);
  assert.equal(ui.shadow.querySelector('.voltar').getAttribute('aria-label'), 'Voltar ao menu');
  ui.shadow.querySelector('.voltar').click();
  assert.equal(view('main').hidden, false); assert.equal(view('gaveta').hidden, true);
  ui.shadow.querySelector('[data-app="ferramentas"]').click();
  ui.tab.click(); ui.tab.click(); // fecha e reabre
  assert.equal(view('main').hidden, false);
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

test('clicar em Pendências envia o pedido e fecha o menu; em breve não envia nada', async () => {
  const { ui, sent } = mount();
  ui.tab.click();
  ui.shadow.querySelector('[data-app="ferramentas"]').click();
  ui.shadow.querySelector('[data-app="blocos"]').click();
  await flush();
  assert.deepEqual(sent, []);
  assert.match(ui.status.textContent, /ainda não está disponível/);
  ui.items[0].click();
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
  assert.deepEqual(calls.map(c => c.slice(1)), [['alunos', 'alunos.abrir', { aba: 'acomp' }], ['alunos', 'alunos.abrir', { aba: 'alunos' }], ['alunos', 'alunos.abrir', { aba: 'relatorio' }]]);
});

test('menu em cards: seções, painel inerte quando fechado e rótulo do botão acompanha o estado', () => {
  const { ui } = mount();
  assert.equal(ui.panel.hasAttribute('inert'), true);
  const secoes = [...ui.shadow.querySelectorAll('.sec')].map(n => n.textContent);
  assert.deepEqual(secoes, ['Correção', 'Alunos', 'Mais', 'Ferramentas', 'Ajuda e dados']);
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
test('em página de atividade: Correção vale, Pendências fica esmaecida e só explica (nada é enviado)', async () => {
  const { ui, sent } = mountAt('https://ead.senai.br/mod/assign/view.php?id=55');
  const btn = id => ui.shadow.querySelector(`.app[data-app="${id}"]`);
  assert.equal(btn('pendencias').getAttribute('data-fora'), 'true');
  assert.equal(btn('correcao').getAttribute('data-fora'), null);
  btn('pendencias').click(); await flush();
  assert.equal(sent.length, 0);
  assert.match(ui.status.textContent, /não se aplica a esta página/);
  btn('correcao').click(); await flush();
  assert.deepEqual(sent, [{ type: 'hub-open', app: 'correcao' }]);
});
test('em página de curso: Pendências e Correção valem', () => {
  const { ui } = mountAt('https://ead.senai.br/course/view.php?id=7');
  const fora = [...ui.shadow.querySelectorAll('[data-fora="true"]')].map(b => b.getAttribute('data-app'));
  assert.deepEqual(fora, ['relatorio-turma']); // só o Relatório da turma é exclusivo de "Meus cursos"
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

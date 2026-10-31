// E2E do botão lateral: Chromium real com a extensão carregada (dist/ext) e um Moodle simulado (dados fictícios).
// Uso: node tests/e2e/lateral.mjs [pastaDaExtensao] [pastaDePrints]   (precisa de Playwright global: npm i -g playwright)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { graderPage, participantsPage } from '../fixtures/moodle-alunos.js';
import { TAREFAS, assignViewPage, assignGradingPage } from '../fixtures/moodle-tarefas.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));

const EXT = path.resolve(process.argv[2] || path.join(here, '..', '..', 'dist', 'ext'));
const SHOTS = path.resolve(process.argv[3] || fs.mkdtempSync(path.join(os.tmpdir(), 'blocos-e2e-')));
fs.mkdirSync(SHOTS, { recursive: true });
const ORIGIN = 'https://ead.senai.br';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: Boolean(ok), detail }); console.log(`${ok ? '  ok ' : ' FALHA'}  ${name}${ok || !detail ? '' : ` → ${detail}`}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- Moodle simulado ----
const COURSES = { 7: 'Segurança em Redes - QUA-ASR-001', 8: 'Introdução à Segurança da Informação - QUA-ASR-001' };
const UC9 = 'Apresentação Eletrônica - QUA - 063.009';
const ACTS = { 301: { course: 9, name: 'SAP 01', pending: 2 }, 302: { course: 9, name: 'SAP 02', pending: 1 }, 101: { course: 7, name: 'SAP 01', pending: 3 }, 102: { course: 7, name: 'SAP 02', pending: 2 }, 201: { course: 8, name: 'SAP 01', pending: 0 } };
const state = { failUsers: false, indexHits: 0, summaryHits: 0, downloads: 0, graderHits: 0, usersHits: 0, sent: [], readbacks: 0, failNext: false, tarefaHits: 0, failTarefa: 0, modoEntregas: false };
const TIDS = TAREFAS.map(t => String(t.cmid));
const tli = TAREFAS.map(t => `<li class="activity assign modtype_assign"><a href="/mod/assign/view.php?id=${t.cmid}"><span class="instancename">${t.nome}</span></a></li>`).join('');
const li = id => `<li class="activity assign modtype_assign"><a href="/mod/assign/view.php?id=${id}"><span class="instancename">${ACTS[id].name}</span></a></li>`;
const gradingPage = (id, hubtest) => `<html><body><div role="main"><h2>${ACTS[id].name}</h2><a class="btn btn-primary" href="/mod/assign/view.php?id=${id}&action=grader">Nota</a><form><input name="sesskey" value="abc123"><label for="qg">Avaliação rápida</label><input type="checkbox" id="qg" name="quickgrading" checked></form><table id="submissions"><tbody>${['Ana Souza', 'João da Silva', 'Beatriz Alves'].slice(0, ACTS[id].pending).map((n, i) => `<tr><td><input type="checkbox" name="selectedusers" value="${10 + i}"></td><td class="cell username"><a href="/user/view.php?id=${10 + i}&course=1">${n}</a></td><td><a href="/pluginfile.php/1/x/${i}/trabalho.pdf">trabalho.pdf</a></td><td><div class="w-100"><input type="text" name="quickgrade_${10 + i}" value="${hubtest && i === 0 ? '8,00' : ''}">&nbsp;/&nbsp;10,00</div></td></tr>`).join('')}</tbody></table></div></body></html>`;
const handler = async route => {
  const req = route.request(); const u = new URL(req.url());
  const html = body => route.fulfill({ contentType: 'text/html; charset=utf-8', body });
  if (u.pathname === '/course/index.php') return html(`<html><body><div role="main"><h1>Cursos</h1>${Object.entries(COURSES).map(([id, n]) => `<div class="coursebox card"><h3 class="coursename"><a href="/course/view.php?id=${id}">${n}</a></h3></div>`).join('')}</div></body></html>`);
  if (u.pathname === '/course/view.php' && u.searchParams.get('id') === '9') return html(`<html><body><a href="/login/logout.php?sesskey=sk123456">Sair</a><div role="main"><h1>${UC9}</h1><table><tr><td>Cronograma de Atividades</td></tr></table></div></body></html>`);
  if (u.pathname === '/mod/assign/index.php') { state.indexHits += 1; return html(`<html><body><div role="main"><table class="generaltable">${[301, 302].map(i => `<tr><td><a href="/mod/assign/view.php?id=${i}">${ACTS[i].name}</a></td></tr>`).join('')}</table></div></body></html>`); }
  if (u.pathname === '/course/view.php') { const c = Number(u.searchParams.get('id')); return html(`<html><body><a href="/login/logout.php?sesskey=sk123456">Sair</a><div role="main"><h1>${COURSES[c]}</h1><div class="course-summary"><div class="no-overflow">Técnico em Informática para Internet<br><br>Fatec SENAI Roberto Mange<br><br>Período: 01/01/2020 a 31/12/2099<br><br></div></div><ul>${Object.keys(ACTS).filter(i => ACTS[i].course === c).map(li).join('')}${c === 7 ? tli : ''}</ul></div></body></html>`); }
  if (u.pathname === '/lib/ajax/service.php' && req.method() === 'POST') {
    const body = JSON.parse(req.postData()); const m = body[0];
    const ok = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ error: false, data }]) });
    if (u.searchParams.get('sesskey') !== 'sk123456') return route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ error: true, exception: { errorcode: 'invalidsesskey', message: 'x' } }]) });
    if (m.methodname === 'core_message_send_instant_messages') {
      if (state.failNext) { state.failNext = false; return ok([{ msgid: -1, errormessage: 'Este usuário bloqueou mensagens' }]); }
      const id = 500 + state.sent.length; state.sent.push({ id, to: m.args.messages[0].touserid, text: m.args.messages[0].text });
      return ok([{ msgid: id, conversationid: 9, useridfrom: 90 }]);
    }
    if (m.methodname === 'core_message_get_conversation_messages') { state.readbacks += 1; return ok({ messages: state.sent.map(x => ({ id: x.id, text: x.text, useridfrom: 90 })) }); }
    return route.fulfill({ status: 404, body: '' });
  }
  if (u.pathname === '/grade/report/grader/index.php') { state.graderHits += 1; await sleep(60); return html(graderPage({ id: 7 })); }
  if (u.pathname === '/user/index.php' && state.failUsers) return route.fulfill({ status: 503, body: '' });
  if (u.pathname === '/user/index.php') { state.usersHits += 1; return html(participantsPage({ id: 7 })); }
  if (u.pathname === '/my/') return html('<html><body><div role="main"><h1>Painel</h1></div></body></html>');
  if (u.pathname === '/mod/assign/view.php') {
    if (req.method() === 'POST') { state.downloads += 1; return route.fulfill({ status: 200, headers: { 'content-type': 'application/zip' }, body: Buffer.from('504b0506' + '00'.repeat(18), 'hex') }); }
    const id = u.searchParams.get('id'); const a = ACTS[id];
    if (state.modoEntregas && (id === '101' || id === '102')) { state.tarefaHits += 1; await sleep(40); return html(u.searchParams.get('action') === 'grading' ? assignGradingPage(id) : assignViewPage(id)); }
    if (TIDS.includes(id)) { state.tarefaHits += 1; await sleep(40); if (state.failTarefa === Number(id)) return route.fulfill({ status: 503, body: '' }); return html(u.searchParams.get('action') === 'grading' ? assignGradingPage(id) : assignViewPage(id)); }
    if (!a) return route.fulfill({ status: 404, body: '' });
    if (u.searchParams.get('action') === 'grading') return html(gradingPage(id, u.searchParams.get('hubtest') === '1'));
    state.summaryHits += 1; await sleep(120);
    return html(`<html><body><div class="gradingsummary"><table class="generaltable gradingsummarytable"><tr><th>Participantes</th><td>30</td></tr><tr><th>Precisa de avaliação</th><td>${a.pending}</td></tr></table></div></body></html>`);
  }
  return route.fulfill({ status: 404, body: '' });
};

// ---- execução ----
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ferramentas-profile-'));
const ctx = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`], viewport: { width: 1000, height: 700 }, acceptDownloads: true });
try {
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  check('a extensão carregou (service worker ativo)', /^[a-p]{32}$/.test(new URL(sw.url()).host));
  await ctx.route(`${ORIGIN}/**`, handler);

  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  pg.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await pg.goto(`${ORIGIN}/course/index.php?categoryid=3`);
  await pg.waitForSelector('#hub-ead-launcher', { state: 'attached', timeout: 15000 });
  await sleep(1500);
  check('o botão lateral aparece na página do Moodle', await pg.locator('#hub-ead-launcher .tab').isVisible());
  check('só o botão: nenhuma barra do radar, nenhuma consulta ao Moodle', await pg.locator('.imn-bar').count() === 0 && state.summaryHits === 0);
  check('o menu começa fechado', await pg.locator('#hub-ead-launcher .panel').isHidden());
  await pg.screenshot({ path: path.join(SHOTS, '1-botao-fechado.png') });

  await pg.click('#hub-ead-launcher .tab');
  const names = await pg.locator('#hub-ead-launcher .app b').allTextContents();
  check('o menu lista as 6 ferramentas na ordem do mockup', JSON.stringify(names) === JSON.stringify(['Pendências', 'Correção', 'Acompanhamento', 'Alunos e notas', 'Relatório da UC', 'Automação por blocos']), JSON.stringify(names));
  await sleep(900);
  await pg.screenshot({ path: path.join(SHOTS, '2-menu-aberto.png') });

  await pg.click('#hub-ead-launcher .app[data-app="blocos"]', { force: true });
  check('ferramenta "em breve" explica e não faz nada', /ainda não está disponível/.test(await pg.locator('#hub-ead-launcher .status').textContent()) && await pg.locator('.imn-bar').count() === 0);

  await pg.click('#hub-ead-launcher .app[data-app="pendencias"]');
  await pg.waitForSelector('.imn-bar', { timeout: 15000 });
  check('Pendências: injeta o módulo e mostra a barra, o menu fecha', await pg.locator('#hub-ead-launcher .panel').waitFor({ state: 'hidden', timeout: 3000 }).then(() => true, () => false));
  await sleep(800);
  check('abrir a barra NÃO busca nada: "Nada lido ainda" e zero consultas', /Nada lido ainda/.test(await pg.locator('.imn-bar-status').textContent()) && state.summaryHits === 0);
  await pg.screenshot({ path: path.join(SHOTS, '3-pendencias-aberta.png') });

  await pg.click('.imn-search');
  await pg.waitForFunction(() => /pendência/.test(document.querySelector('.imn-bar-status').textContent) && !document.querySelector('.imn-search').disabled, null, { timeout: 60000 });
  check('a busca só começa no clique da lupa e acha as 6 pendências (5 das SAP + 1 da AV3 do curso 7)', /6 pendência/.test(await pg.locator('.imn-bar-status').textContent()) && state.summaryHits > 0, await pg.locator('.imn-bar-status').textContent());
  await pg.screenshot({ path: path.join(SHOTS, '4-busca-feita.png') });

  const bars = await pg.locator('.imn-bar').count();
  await pg.click('#hub-ead-launcher .tab');
  await pg.click('#hub-ead-launcher .app[data-app="correcao"]');
  await pg.waitForSelector('#imn-batch-root .imn-backdrop:not([hidden])', { timeout: 15000 });
  check('Correção: abre a janela de lançamento de notas (CSV), sem duplicar a barra', await pg.locator('.imn-bar').count() === bars);
  await pg.screenshot({ path: path.join(SHOTS, '5-correcao-aberta.png') });


  // ---- Correção na página da atividade (mesma tela do Importar Notas: painel junto ao botão "Nota") ----
  await pg.goto(`${ORIGIN}/mod/assign/view.php?id=101`);
  await pg.waitForSelector('#hub-ead-launcher', { state: 'attached' });
  await pg.click('#hub-ead-launcher .tab');
  check('na página da atividade: Correção disponível e Pendências esmaecida (não se aplica)', await pg.locator('#hub-ead-launcher .app[data-app="pendencias"][data-fora="true"]').count() === 1 && await pg.locator('#hub-ead-launcher .app[data-app="correcao"][data-fora="true"]').count() === 0);
  await sleep(900);
  await pg.screenshot({ path: path.join(SHOTS, '24-atividade-menu.png') });
  await pg.click('#hub-ead-launcher .app[data-app="correcao"]');
  await pg.waitForURL(/action=grading/, { timeout: 15000 });
  await pg.waitForSelector('#imn-root .imn-backdrop:not([hidden])', { timeout: 20000 });
  check('Correção fora da tela de avaliação leva até ela e abre o painel de importar notas sozinha, uma vez', await pg.locator('#imn-root').count() === 1 && await pg.locator('.imn-launcher').count() === 1);
  await pg.screenshot({ path: path.join(SHOTS, '25-atividade-painel-importar.png') });
  await pg.keyboard.press('Escape');
  await pg.reload();
  await pg.waitForSelector('#hub-ead-launcher', { state: 'attached' });
  await sleep(800);
  check('recarregar a tela de avaliação sem pedir nada NÃO injeta o painel', await pg.locator('#imn-root').count() === 0);
  await pg.click('#hub-ead-launcher .tab');
  await pg.click('#hub-ead-launcher .app[data-app="correcao"]');
  await pg.waitForSelector('#imn-root .imn-backdrop:not([hidden])', { timeout: 15000 });
  check('já na tela de avaliação: Correção abre o painel direto, ao lado do botão Nota', await pg.locator('.imn-launcher.imn-inline').count() === 1);
  // depois de salvar o Moodle recarrega: a conferência volta sozinha
  await pg.goto(`${ORIGIN}/mod/assign/view.php?id=101&action=grading&hubtest=1`);
  await pg.waitForSelector('#hub-ead-launcher', { state: 'attached' });
  await pg.evaluate(() => sessionStorage.setItem('imn_verify_v1', JSON.stringify({ id: `${location.pathname}?id=101`, at: Date.now(), expected: [{ userId: '10', name: 'Ana Souza', field: 'grade', to: '8' }] })));
  await pg.reload();
  await pg.waitForSelector('#imn-root .imn-banner:not([hidden])', { timeout: 20000 });
  check('após salvar, a conferência roda sozinha e mostra "Salvo e conferido"', /Salvo e conferido/.test(await pg.locator('#imn-root .imn-banner').textContent()));
  await pg.screenshot({ path: path.join(SHOTS, '26-atividade-conferido.png') });

  // ---- Alunos e notas / Acompanhamento / Relatório da UC (curso 7) ----
  await pg.goto(`${ORIGIN}/course/view.php?id=7`);
  await pg.waitForSelector('#hub-ead-launcher', { state: 'attached' });
  const g0 = state.graderHits;
  await pg.click('#hub-ead-launcher .tab');
  await pg.click('#hub-ead-launcher .app[data-app="alunos-notas"]');
  await pg.waitForSelector('#hub-aln-host', { state: 'attached', timeout: 15000 });
  await sleep(700);
  const shadow = sel => pg.locator(`#hub-aln-host ${sel}`);
  check('Alunos e notas: abre o painel só com "Ler agora", sem consultar o livro de notas', await shadow('.box').isVisible() && /Ler alunos e notas/.test(await shadow('.box').textContent()) && await shadow('.btn.pri').count() === 1 && state.graderHits === g0);
  await pg.screenshot({ path: path.join(SHOTS, '7-alunos-vazio.png') });
  await shadow('.btn.pri').first().click();
  await shadow('table tbody tr').first().waitFor({ timeout: 20000 });
  const rows = await shadow('table tbody tr').count();
  check('"Ler" busca livro de notas e participantes uma vez e lista 6 alunos (professor fora)', rows === 6 && state.graderHits === g0 + 1 && state.usersHits >= 1, `${rows} linhas, ${state.graderHits - g0} consultas`);
  check('faixa de cobertura mostra leitura completa', /Leitura completa/.test(await shadow('.cov').textContent()));
  await pg.screenshot({ path: path.join(SHOTS, '8-alunos-lidos.png') });
  // ---- filtros da aba Alunos ----
  await shadow('.fgroup[aria-label="Último acesso"] .fchip:has-text("15–30")').click();
  const fRows = await shadow('table tbody tr').count();
  check('filtro Último acesso 15–30 dias mostra só 2 alunos e a faixa "Mostrando 2 de 6"', fRows === 2 && /Mostrando 2 de 6/.test(await shadow('.resline').textContent()), `${fRows} linhas`);
  await shadow('.fgroup[aria-label="Pendências"] .fchip:has-text("Com pendência")').click();
  check('filtros combinam (acesso 15–30 + com pendência)', await shadow('table tbody tr').count() === 2 && await shadow('.fgroup[aria-label="Pendências"] .fchip.on').count() === 1 && /Com pendência/.test(await shadow('.fgroup[aria-label="Pendências"] .fchip.on').textContent()));
  await pg.screenshot({ path: path.join(SHOTS, '16-alunos-filtros.png') });
  await shadow('.resline .linkbtn').click();
  check('"Limpar filtros" volta aos 6 alunos', await shadow('table tbody tr').count() === 6 && await shadow('.resline .linkbtn').count() === 0);
  await shadow('.thbtn:has-text("Último acesso")').click();
  await shadow('.thbtn:has-text("Último acesso")').click();
  check('ordenar por Último acesso (decrescente) põe quem está há mais tempo sem acessar primeiro', /Fábio/.test(await shadow('table tbody tr').first().textContent()));
  // ---- Relatório da UC centrado no aluno + ficha ----
  await shadow('nav button:has-text("Relatório da UC")').click();
  await shadow('.stud').first().waitFor();
  const cards = await shadow('.stud').count();
  await pg.screenshot({ path: path.join(SHOTS, '17-relatorio-alunos.png') });
  check('Relatório da UC lista cartões de alunos por urgência (o mais grave primeiro: Fábio)', cards >= 3 && /Fábio/.test(await shadow('.stud').first().textContent()), `${cards} cartões`);
  await shadow('.stud').first().click();
  await shadow('.k4').waitFor();
  await pg.screenshot({ path: path.join(SHOTS, '18-ficha-aluno.png') });
  const ficha = await shadow('.body').textContent();
  check('ficha do aluno traz nota, itens, motivos e notas por atividade', /Fábio Rocha/.test(ficha) && /itens com nota/.test(ficha) && /Por que está nesta situação/.test(ficha) && await shadow('.ftable tbody tr').count() === 4);
  await shadow('.bar .btn:has-text("Voltar")').click();
  check('Voltar ao relatório mostra a lista de novo', await shadow('.stud').count() === cards);
  await shadow('nav button:has-text("Alunos")').click();
  await shadow('input[type=search]').fill('fábio');
  check('busca filtra a lista', await shadow('table tbody tr').count() === 1);
  await shadow('input[type=search]').fill('');

  await shadow('nav button:has-text("Notas")').click();
  const head = await shadow('thead th').allTextContents();
  check('Notas: colunas por atividade com nota máxima e total', head.length === 6 && /AV1/.test(head[1]) && /máx\. 10/.test(head[1]), head.join('|'));
  check('Notas: sem nota aparece como "—" e há linha de média da turma', (await shadow('td.blank').count()) === 7 && /Média da turma/.test(await shadow('tbody tr:last-child').textContent()));
  await pg.screenshot({ path: path.join(SHOTS, '9-notas.png') });

  await shadow('nav button:has-text("Acompanhamento")').click();
  const accompText = await shadow('.body').textContent();
  check('Acompanhamento: Fábio aparece como Imediato com motivo e próxima ação', /Fábio/.test(accompText) && /Imediato/.test(accompText) && /23 dias/.test(accompText) && /busca ativa/i.test(accompText));
  await pg.screenshot({ path: path.join(SHOTS, '10-acompanhamento.png') });
  await pg.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  await shadow('tbody tr').first().locator('button').last().click();
  const copied = await pg.evaluate(() => navigator.clipboard.readText());
  check('copiar mensagem coloca o texto na área de transferência (nada é enviado)', /^Olá, /.test(copied), copied);

  // ---- enviar mensagem ao aluno pelo Moodle (Acompanhamento) ----
  await shadow('nav button:has-text("Acompanhamento")').click();
  const firstRow = shadow('tbody tr').first();
  const nomeAluno = (await firstRow.locator('td b').first().textContent()).trim();
  await firstRow.locator('button').first().click();
  await shadow('.modal').waitFor({ timeout: 5000 });
  const campo = await shadow('.modal textarea').inputValue();
  check('modal de envio abre com texto sugerido editável e SEM enviar nada', /^Olá, /.test(campo) && state.sent.length === 0 && await shadow('.modal .btn.pri').isDisabled());
  await pg.screenshot({ path: path.join(SHOTS, '13-mensagem-modal.png') });
  await shadow('.modal textarea').fill(campo + ' Retorne quando puder.');
  check('só marcar "Revisei o texto" libera o botão de enviar', await shadow('.modal .btn.pri').isDisabled());
  await shadow('.modal label:has-text("Revisei") input').check();
  check('depois de marcar, o botão libera, e ainda assim nada foi enviado', !(await shadow('.modal .btn.pri').isDisabled()) && state.sent.length === 0);
  await shadow('.modal .btn.pri').click();
  await shadow('.modal .res.ok').waitFor({ timeout: 8000 });
  check('envia uma mensagem pelo Moodle, confere a leitura de volta e mostra confirmada', state.sent.length === 1 && state.readbacks === 1 && /enviada e conferida/.test(await shadow('.modal .res').textContent()) && /Retorne quando puder/.test(state.sent[0].text));
  await pg.screenshot({ path: path.join(SHOTS, '14-mensagem-enviada.png') });
  await shadow('.modal .btn:has-text("Fechar")').click();
  check('a linha do aluno passa a mostrar "Contatado" (e contato não resolve o risco)', /Contatado/.test(await shadow('tbody tr').first().textContent()) && /Imediato|Alto/.test(await shadow('tbody tr').first().textContent()));
  await pg.screenshot({ path: path.join(SHOTS, '15-acompanhamento-contatado.png') });
  await shadow('tbody tr').first().locator('button').first().click();
  check('segundo envio ao mesmo aluno avisa que já houve mensagem', /já enviou uma mensagem/.test(await shadow('.modal .note').textContent()));
  state.failNext = true;
  await shadow('.modal label:has-text("Revisei") input').check();
  await shadow('.modal .btn.pri').click();
  await shadow('.modal .res.bad').waitFor({ timeout: 8000 });
  check('recusa do Moodle (aluno bloqueou) aparece como erro e NÃO conta como enviada', /Não foi enviada/.test(await shadow('.modal .res').textContent()) && /bloqueou/.test(await shadow('.modal .res').textContent()) && state.sent.length === 1);
  await pg.screenshot({ path: path.join(SHOTS, '16-mensagem-recusada.png') });
  await pg.keyboard.press('Escape');
  check('Esc fecha só o modal, o painel continua aberto', !(await shadow('.modal').count()) && await shadow('.drawer').isVisible());


  await shadow('nav button:has-text("Relatório da UC")').click();
  const rel = await shadow('.body').textContent();
  check('Relatório da UC: faixa-resumo (média 63,8), filtros "Ver" e resumo por atividade', /63,8/.test(rel) && /média da turma/.test(rel) && /Precisam de atenção/.test(rel) && /Resumo por atividade/.test(rel));
  await shadow('details.more summary').click();
  check('resumo por atividade (recolhível) lista AV4 Segurança', /AV4 Segurança/.test(await shadow('details.more').textContent()));
  await pg.screenshot({ path: path.join(SHOTS, '11-relatorio.png') });
  const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 10000 }), shadow('.bar button:has-text("CSV")').click()]);
  check('exportar CSV baixa um arquivo .csv', /\.csv$/.test(dl.suggestedFilename()), dl.suggestedFilename());

  await pg.keyboard.press('Escape');
  check('Esc fecha o painel', !(await shadow('.drawer').isVisible()));
  await pg.click('#hub-ead-launcher .tab');
  await pg.click('#hub-ead-launcher .app[data-app="relatorio-uc"]');
  await sleep(500);
  check('reabrir mostra os dados já lidos, sem nova consulta', await shadow('.drawer').isVisible() && state.graderHits === g0 + 1 && /média da turma|Precisam de atenção/.test(await shadow('.body').textContent()));


  // ---- leitura que para no meio: "Continuar de onde parou" repete só o que falhou ----
  await pg.goto(`${ORIGIN}/course/view.php?id=7`);
  await pg.waitForSelector('#hub-ead-launcher', { state: 'attached' });
  state.failUsers = true;
  const gC = state.graderHits;
  await pg.click('#hub-ead-launcher .tab');
  await pg.click('#hub-ead-launcher .app[data-app="alunos-notas"]');
  await pg.waitForSelector('#hub-aln-host', { state: 'attached' });
  await sleep(700);
  await shadow('.btn.pri').first().click();
  await shadow('.partial:has-text("Leitura incompleta")').waitFor({ timeout: 30000 });
  await pg.screenshot({ path: path.join(SHOTS, '15-leitura-incompleta.png') });
  check('participantes falharam: aparece "Leitura incompleta" com o livro de notas guardado e as notas na tela', /Leitura incompleta/.test(await shadow('.partial:has-text("Leitura incompleta")').textContent()) && /Continuar: ler participantes/.test(await shadow('.partial:has-text("Leitura incompleta")').textContent()) && await shadow('table tbody tr').count() === 6);
  state.failUsers = false;
  await shadow('.partial:has-text("Leitura incompleta") .btn.pri').click();
  await shadow('.cov .chip.ok').waitFor({ timeout: 30000 });
  check('"Continuar" lê só os participantes (livro de notas não é pedido de novo) e fecha a leitura completa', state.graderHits === gC + 1 && await shadow('.partial:has-text("Leitura incompleta")').count() === 0 && /Leitura completa/.test(await shadow('.cov').textContent()), `consultas ao livro de notas: ${state.graderHits - gC}`);

  // ---- entregas: quem entregou cada atividade (leitura sob demanda, com "Continuar") + relatório completo em HTML ----
  await shadow('nav button:has-text("Relatório da UC")').click();
  const tBase = state.tarefaHits;
  check('Relatório da UC lista TODOS os alunos (6), não só quem tem pendência', await shadow('.stud').count() === 6 && /Mostrando 6 de 6/.test(await shadow('.resline').first().textContent()));
  check('antes de ler entregas, o painel explica que “pendente” é só “sem nota” e não consultou tarefas', /Ler entregas/.test(await shadow('.partial').first().textContent()) && state.tarefaHits === tBase);
  state.failTarefa = 703; state.modoEntregas = true;
  await shadow('.partial .btn.pri:has-text("Ler entregas")').click();
  await shadow('.partial:has-text("Entregas incompletas")').waitFor({ timeout: 30000 });
  const tIncompleta = await shadow('.partial:has-text("Entregas incompletas")').textContent();
  check('uma atividade falhou: “Entregas incompletas” lista só a AV3 e oferece Continuar', /AV3 Serviços/.test(tIncompleta) && /Continuar: ler 1 atividade/.test(tIncompleta) && !/AV1 Fundamentos/.test(tIncompleta), tIncompleta);
  await pg.screenshot({ path: path.join(SHOTS, '19-entregas-incompletas.png') });
  state.failTarefa = 0;
  const tH = state.tarefaHits;
  await shadow('.partial:has-text("Entregas incompletas") .btn.pri').click();
  await shadow('.chip.ok:has-text("Entregas lidas")').waitFor({ timeout: 30000 });
  check('“Continuar” relê só a atividade que falhou (no máximo 2 consultas)', state.tarefaHits - tH <= 2 && state.tarefaHits - tH >= 1, `consultas: ${state.tarefaHits - tH}`);
  await pg.screenshot({ path: path.join(SHOTS, '20-relatorio-com-entregas.png') });
  const txtRel = await shadow('.body').textContent();
  check('com entregas lidas, os cartões falam em “sem entrega” e “entregues” e há o filtro “Aguardando minha correção”', /sem entrega · \d\/4 entregues/.test(txtRel) && /Aguardando minha correção/.test(txtRel));
  await shadow('.fchip:has-text("Aguardando minha correção")').click();
  check('filtro “Aguardando minha correção” mostra só o Bruno (AV3 enviada e sem nota)', await shadow('.stud').count() === 1 && /Bruno/.test(await shadow('.stud').first().textContent()));
  await shadow('.fchip:has-text("Todos")').first().click();
  await shadow('.stud:has-text("Camila")').click();
  await shadow('.ftable').waitFor();
  await pg.screenshot({ path: path.join(SHOTS, '21-ficha-com-entregas.png') });
  const fichaT = await shadow('.ftable').textContent();
  check('ficha da Camila: AV2 “sem entrega”, demais entregues e avaliadas, com nota e prazo', /AV2 Endereçamento\s*sem entrega/.test(fichaT) && (fichaT.match(/entregue · avaliada/g) || []).length === 3 && /12\/10\/2026/.test(fichaT));
  await shadow('.bar .btn:has-text("Voltar")').click();
  // ---- mensagem com checklist das atividades sem entrega ----
  await shadow('.stud:has-text("Fábio")').click();
  await shadow('.bar .btn:has-text("Enviar mensagem")').click();
  await shadow('.modal .pend').waitFor();
  const msg1 = await shadow('.modal textarea').inputValue();
  check('mensagem do Fábio já traz as atividades sem entrega marcadas (AV2, AV3, AV4)', /Atividades pendentes:/.test(msg1) && /AV2 Endereçamento/.test(msg1) && /AV3 Serviços/.test(msg1) && /AV4 Segurança/.test(msg1) && !/AV1 Fundamentos/.test(msg1));
  await pg.screenshot({ path: path.join(SHOTS, '22-mensagem-com-pendencias.png') });
  await shadow('.modal .pend label:has-text("AV3") input').uncheck();
  const msg2 = await shadow('.modal textarea').inputValue();
  check('desmarcar uma atividade tira só ela do texto', !/AV3 Serviços/.test(msg2) && /AV2 Endereçamento/.test(msg2));
  check('nada foi enviado nessa conferência', state.sent.length === 1);
  await shadow('.modal .btn:has-text("Cancelar")').click().catch(async () => { await pg.keyboard.press('Escape'); });
  // ---- exportar HTML ----
  await shadow('.bar .btn:has-text("Voltar")').click();
  const [dlH] = await Promise.all([pg.waitForEvent('download', { timeout: 10000 }), shadow('.bar button:has-text("Exportar HTML")').click()]);
  const htmlPath = path.join(SHOTS, 'relatorio-exportado.html');
  await dlH.saveAs(htmlPath);
  const exp = fs.readFileSync(htmlPath, 'utf8');
  check('HTML exportado: arquivo .html com os 6 alunos, entregas e notas por atividade', /^relatorio-uc-.*\.html$/.test(dlH.suggestedFilename()) && ['Ana Beatriz Souza', 'Bruno Henrique Lima', 'Camila Ferreira', 'Diego Martins', 'Fábio Rocha', 'Gabriela Alves'].every(n => exp.includes(n)) && /AV3 Serviços/.test(exp) && /sem entrega/i.test(exp), dlH.suggestedFilename());
  check('HTML exportado é autônomo: só filtro local, sem arquivos nem endereços externos, sem rede', !/<script[^>]+src=/i.test(exp) && !/fetch\(|XMLHttp|<link[^>]+href=|<img[^>]+src=/i.test(exp) && !/https?:\/\//i.test(exp));
  await pg.screenshot({ path: path.join(SHOTS, '23-relatorio-exportar.png') });
  state.modoEntregas = false;

  errors.length = 0; // os 503 acima foram provocados de propósito pelo teste
  // ---- Pendências numa página de CURSO, depois de usar Alunos e notas (mesma página, dois módulos) ----
  await pg.goto(`${ORIGIN}/course/view.php?id=7`);
  await pg.waitForSelector('#hub-ead-launcher', { state: 'attached' });
  await pg.click('#hub-ead-launcher .tab');
  await pg.click('#hub-ead-launcher .app[data-app="alunos-notas"]');
  await pg.waitForSelector('#hub-aln-host', { state: 'attached' });
  await pg.keyboard.press('Escape');
  const hits0 = state.summaryHits;
  await pg.click('#hub-ead-launcher .tab');
  await pg.click('#hub-ead-launcher .app[data-app="pendencias"]');
  await pg.waitForSelector('.imn-bar', { timeout: 15000 });
  await sleep(600);
  const topo = await pg.evaluate(() => { const b = document.querySelector('.imn-search').getBoundingClientRect(); const e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return e && e.closest('.imn-search') ? 'lupa' : (e && e.id) || String(e && e.tagName); });
  check('o menu fechado não cobre a lupa (nenhuma caixa invisível por cima)', topo === 'lupa', topo);
  await pg.click('.imn-search');
  const done = await pg.waitForFunction(() => /pendência|Nenhuma|erro|não/i.test(document.querySelector('.imn-bar-status').textContent) && !document.querySelector('.imn-search').disabled, null, { timeout: 30000 }).then(() => true, () => false);
  const txt = await pg.locator('.imn-bar-status').textContent();
  check('vigência vem do "Período:" do resumo do curso e aparece na barra', /UC vigente · 01\/01 a 31\/12\/2099/.test(await pg.locator('.imn-bar').textContent()), (await pg.locator('.imn-bar').textContent()).slice(0, 160));
  check('curso, depois de Alunos e notas: a lupa busca e mostra o resultado', done && /6 pendência/.test(txt) && state.summaryHits > hits0, `${txt} · consultas ${state.summaryHits - hits0}`);
  await pg.screenshot({ path: path.join(SHOTS, '12-curso-lupa.png') });
  // ---- UC sem links de tarefa na página + botão de fechar ----
  await pg.goto(`${ORIGIN}/course/view.php?id=9`);
  await pg.waitForSelector('#hub-ead-launcher', { state: 'attached' });
  await pg.click('#hub-ead-launcher .tab');
  await pg.click('#hub-ead-launcher .app[data-app="pendencias"]');
  await pg.waitForSelector('.imn-bar', { timeout: 15000 });
  await sleep(500);
  check('UC sem links de tarefa: a barra aparece e nada foi consultado antes da lupa', state.indexHits === 0 && await pg.locator('.imn-bar').isVisible() && /Nada lido/i.test(await pg.locator('.imn-bar-status').textContent()), await pg.locator('.imn-bar-status').textContent());
  const sh0 = state.summaryHits;
  await pg.click('.imn-search');
  const done9 = await pg.waitForFunction(() => /pendência/i.test(document.querySelector('.imn-bar-status').textContent) && !document.querySelector('.imn-search').disabled, null, { timeout: 30000 }).then(() => true, () => false);
  const txt9 = await pg.locator('.imn-bar-status').textContent();
  check('UC sem links: a lupa descobre as tarefas do curso e conta 3 pendências', done9 && /3 pendência/.test(txt9) && state.indexHits === 1 && state.summaryHits === sh0 + 2, `${txt9} · lista ${state.indexHits} · resumos ${state.summaryHits - sh0}`);
  await pg.screenshot({ path: path.join(SHOTS, '13-uc-sem-links.png') });
  await pg.click('.imn-close');
  check('botão de fechar esconde a barra', !(await pg.locator('.imn-bar').isVisible()));
  await pg.screenshot({ path: path.join(SHOTS, '14-barra-fechada.png') });
  await pg.click('#hub-ead-launcher .tab');
  await pg.click('#hub-ead-launcher .app[data-app="pendencias"]');
  await sleep(500);
  check('Pendências no menu reabre a barra fechada', await pg.locator('.imn-bar').isVisible());

  check('nenhum erro no console durante a execução', errors.length === 0, errors.join(' | '));

  await pg.goto(`${ORIGIN}/my/`);
  await pg.waitForSelector('#hub-ead-launcher', { state: 'attached' });
  await pg.click('#hub-ead-launcher .tab');
  await pg.click('#hub-ead-launcher .app[data-app="pendencias"]');
  await pg.waitForFunction(() => document.querySelector('#hub-ead-launcher').shadowRoot.querySelector('.status').textContent.length > 0, null, { timeout: 15000 });
  check('em página que não é curso/categoria: aviso claro no menu e nada injetado', /não se aplica.*curso ou categoria/.test(await pg.locator('#hub-ead-launcher .status').textContent()) && await pg.locator('.imn-bar').count() === 0);
  await pg.screenshot({ path: path.join(SHOTS, '6-erro-pagina.png') });
} catch (error) {
  check('o teste rodou até o fim', false, error.stack || String(error));
}
await ctx.close();
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram. Prints: ${SHOTS}`);
if (failed.length) process.exit(1);

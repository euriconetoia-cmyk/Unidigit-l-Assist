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

const EXT_REAL = path.resolve(process.argv[2] || path.join(here, '..', '..', 'dist', 'ext'));
// O aviso de permissão do Chrome não é automatizável: o teste usa uma CÓPIA do pacote com o host do Kahoot já concedido (o resto é idêntico).
const EXT = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-e2e-'));
fs.cpSync(EXT_REAL, EXT, { recursive: true });
{ const mf = path.join(EXT, 'manifest.json'); const m = JSON.parse(fs.readFileSync(mf, 'utf8')); m.host_permissions.push(...m.optional_host_permissions); delete m.optional_host_permissions; fs.writeFileSync(mf, JSON.stringify(m)); }
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
  if (u.pathname === '/grade/report/grader/index.php' && u.searchParams.get('id') === '9' && state.modoMeus) return route.fulfill({ status: 503, body: '' });
  if (u.pathname === '/grade/report/grader/index.php') { state.graderHits += 1; await sleep(60); return html(graderPage({ id: Number(u.searchParams.get('id')) || 7 })); }
  if (u.pathname === '/user/index.php' && state.failUsers) return route.fulfill({ status: 503, body: '' });
  if (u.pathname === '/user/index.php') { state.usersHits += 1; return html(participantsPage({ id: 7 })); }
  if (u.pathname === '/my/' && state.modoMeus) return html(`<html><body><div role="main"><h1>Meus cursos</h1>${[[7, 'Redes de Computadores', 'Téc. Redes · Turma A'], [8, 'Segurança em Redes', 'Téc. Redes · Turma A'], [9, 'Lógica de Programação', 'Téc. Informática · Turma B']].map(([id, n, c]) => `<div class="course-summaryitem" data-course-id="${id}"><a href="/course/view.php?id=${id}"><img alt=""></a><a class="coursename" href="/course/view.php?id=${id}"><span class="sr-only">Nome do curso</span> ${n}</a><span class="categoryname">${c}</span></div>`).join('')}</div></body></html>`);
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
  const names = await pg.locator('#hub-ead-launcher [data-view="main"] .app b').allTextContents();
  check('o menu principal lista 6 ferramentas + Ferramentas (gaveta)', JSON.stringify(names) === JSON.stringify(['Pendências', 'Correção', 'Acompanhamento', 'Alunos e notas', 'Relatório da UC', 'Relatório da turma', 'Ferramentas']), JSON.stringify(names));
  await sleep(900);
  await pg.screenshot({ path: path.join(SHOTS, '2-menu-aberto.png') });

  await pg.click('#hub-ead-launcher .app[data-app="ferramentas"]');
  await pg.click('#hub-ead-launcher .app[data-app="blocos"]', { force: true });
  check('ferramenta "em breve" explica e não faz nada', /ainda não está disponível/.test(await pg.locator('#hub-ead-launcher .status').textContent()) && await pg.locator('.imn-bar').count() === 0);
  await pg.click('#hub-ead-launcher .voltar');

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
  // ---- 0.16: régua de nota na prévia da Correção ----
  const csvRegua = path.join(os.tmpdir(), `regua-${Date.now()}.csv`);
  fs.writeFileSync(csvRegua, 'id;nome;nota\n10;Ana Souza;8,3\n11;João da Silva;9,8\n12;Beatriz Alves;\n');
  await pg.setInputFiles('#imn-root .imn-file input[type=file]', csvRegua);
  await pg.waitForSelector('#imn-root select[aria-label="Régua de nota"]', { timeout: 15000 });
  const val0 = await pg.locator('#imn-root input[name^="quickgrade_"]').evaluateAll(els => els.map(e => e.value));
  await pg.selectOption('#imn-root select[aria-label="Régua de nota"]', 'generosa');
  const prev = await pg.locator('#imn-root .imn-regua-prev tbody tr').allTextContents();
  check('Régua generosa: a prévia mostra Antes/Depois só de quem mudou (8,3→8,5 e 9,8→10); sem nota fica de fora', prev.length === 2 && /Ana Souza.*8\.3.*8\.5/.test(prev[0]) && /João da Silva.*9\.8.*10/.test(prev[1]), prev.join(' | '));
  check('Régua: escolher a régua não grava nem preenche nada na página', JSON.stringify(await pg.locator('#imn-root input[name^="quickgrade_"]').evaluateAll(els => els.map(e => e.value))) === JSON.stringify(val0));
  await pg.screenshot({ path: path.join(SHOTS, '6b-regua.png') });
  await pg.selectOption('#imn-root select[aria-label="Régua de nota"]', 'nenhuma');
  check('Régua: voltar para "Sem régua" tira a prévia', await pg.locator('#imn-root .imn-regua-prev').count() === 0);
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
  await shadow('.cards .card').first().waitFor({ timeout: 20000 });
  // ---- 0.16: Resumo do dia é a primeira tela; Ajustes por UC mudam o que aparece ----
  const resumo = await shadow('[data-content]').textContent();
  check('Resumo do dia é a primeira tela: alunos, risco alto, sem acesso, a corrigir, retornos e piorou', await shadow('nav button[aria-selected=true]').textContent() === 'Resumo' && /alunos/.test(resumo) && /risco alto/.test(resumo) && /sem acesso \+15d/.test(resumo) && /a corrigir/.test(resumo) && /Retornos de hoje/.test(resumo) && /Piorou desde a última leitura/.test(resumo) && /Ler agora/.test(resumo));
  check('Resumo: "a corrigir" sem ler as entregas fica em "—", nunca zero', /—\s*a corrigir/.test(resumo));
  await pg.screenshot({ path: path.join(SHOTS, '7b-resumo.png') });
  await shadow('nav button:has-text("Ajustes")').click();
  check('Ajustes: mostra padrão e valor da UC com os 5 campos', await shadow('tbody tr').count() === 5 && /Nota mínima/.test(await shadow('tbody').textContent()));
  await shadow('input[aria-label="Dias sem acesso (atenção)"]').fill('abc');
  await shadow('button:has-text("Salvar")').click();
  check('Ajustes: valor inválido é recusado com motivo e nada muda', /use um número de 1 a 60/.test(await shadow('.err').textContent()));
  await shadow('input[aria-label="Dias sem acesso (atenção)"]').fill('30');
  await shadow('button:has-text("Salvar")').click();
  check('Ajustes: salvar mostra confirmação e marca "ajustado"', /Ajustes salvos/.test(await shadow('[role=status]').textContent()) && /ajustado/.test(await shadow('tbody').textContent()));
  await pg.screenshot({ path: path.join(SHOTS, '7c-ajustes.png') });
  await shadow('nav button:has-text("Acompanhamento")').click();
  await shadow('nav button:has-text("Ajustes")').click();
  await shadow('button:has-text("Voltar ao padrão")').click();
  check('Ajustes: "Voltar ao padrão" restaura', /Ajustes restaurados/.test(await shadow('[role=status]').textContent()) && !/ajustado/.test(await shadow('tbody').textContent()));
  await shadow('nav button:has-text("Alunos")').click();
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

  // ---- Excel (.xlsx) ----
  await shadow('nav button:has-text("Notas")').click();
  const [dlX] = await Promise.all([pg.waitForEvent('download', { timeout: 10000 }), shadow('.bar button:has-text("Excel")').click()]);
  const xPath = path.join(SHOTS, 'notas-exportadas.xlsx'); await dlX.saveAs(xPath);
  const xb = fs.readFileSync(xPath);
  check('Excel: botão baixa um .xlsx de verdade (ZIP com planilha de notas e todos os alunos)', /^notas-.*\.xlsx$/.test(dlX.suggestedFilename()) && xb.slice(0, 2).toString() === 'PK' && xb.includes(Buffer.from('xl/worksheets/sheet1.xml')) && ['Ana Beatriz Souza', 'Fábio Rocha'].every(n => xb.includes(Buffer.from(n))), dlX.suggestedFilename());
  await pg.screenshot({ path: path.join(SHOTS, '28-notas-excel.png') });
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

  // ---- fila de envio (Acompanhamento): revisar, enviar um a um, falha de um aluno, tentar de novo só nele ----
  const antes = state.sent.length;
  await shadow('nav button:has-text("Acompanhamento")').click();
  await pg.screenshot({ path: path.join(SHOTS, '29-antes-fila.png') });
  await shadow('.bar button:has-text("Enviar em fila")').click();
  await shadow('.modal .fl').waitFor();
  const goFila = shadow('.modal .btn.pri');
  check('fila abre só para revisão: nada enviado e botão travado até marcar "Revisei"', state.sent.length === antes && await goFila.isDisabled());
  check('quem já foi contatado hoje vem desmarcado', await shadow('.modal .fl .it:has(.st:has-text("já contatado hoje")) input[type=checkbox]').first().isChecked() === false);
  await pg.screenshot({ path: path.join(SHOTS, '30-fila-revisao.png') });
  await shadow('.modal label:has-text("Revisei as mensagens") input').check();
  state.failNext = true; // o 1º da fila será recusado pelo Moodle
  await goFila.click();
  await shadow('.modal .btn:has-text("Tentar de novo")').waitFor({ timeout: 40000 });
  const enviadas1 = state.sent.length - antes; const totalDepoisFila = state.sent.length + 1;
  check('fila envia um por vez, o recusado aparece como "falhou" e as outras seguem', enviadas1 >= 1 && (await shadow('.modal .st.falhou').count()) === 1 && (await shadow('.modal .st.enviada').count()) === enviadas1);
  await pg.screenshot({ path: path.join(SHOTS, '31-fila-resultado.png') });
  await shadow('.modal .btn:has-text("Tentar de novo")').click();
  await shadow('.modal .btn:has-text("Fechar")').waitFor({ timeout: 20000 });
  check('"Tentar de novo" reenvia só a que falhou (as já enviadas não se repetem)', state.sent.length - antes === enviadas1 + 1 && (await shadow('.modal .st.falhou').count()) === 0);
  await shadow('.modal .btn:has-text("Fechar")').click();


  // ---- 0.15: retornos, modelos de mensagem e comparativo ----
  await shadow('nav button:has-text("Acompanhamento")').click();
  check('o 1º envio já agendou o retorno padrão (7 dias): aparece em "Próximos" do painel de retornos', await shadow('.rbox').count() === 1 && new RegExp(nomeAluno.split(' ')[0]).test(await shadow('.rbox').textContent()) && /Próximos/.test(await shadow('.rbox').textContent()), await shadow('.rbox').count() ? await shadow('.rbox').textContent() : 'sem .rbox');
  await shadow('.bar button:has-text("Modelos")').click();
  await shadow('.modal select').first().waitFor();
  check('Modelos: abre com 3 modelos padrão e os campos para inserir', (await shadow('.modal select').first().locator('option').count()) === 3 && (await shadow('.modal .chips button').count()) === 5);
  await shadow('.modal select').first().selectOption('nota-baixa');
  await shadow('.modal select[aria-label="Usar automaticamente"]').selectOption('nota');
  await shadow('.modal .btn.pri:has-text("Salvar modelo")').click();
  await shadow('.modal .res.ok').waitFor();
  await pg.screenshot({ path: path.join(SHOTS, '60-modelos.png') });
  await shadow('.modal .btn:has-text("Fechar")').click();
  await shadow('tbody tr:has-text("Fábio Rocha") button').first().click();
  await shadow('.modal textarea').waitFor();
  check('modelo marcado como padrão para "nota" já vem escolhido e preenchido com os dados do aluno', (await shadow('.modal select[aria-label="Modelo de mensagem"]').inputValue()) === 'nota-baixa' && /^Olá, Fábio, tudo bem\? Na UC .+, a sua nota atual é 31/.test(await shadow('.modal textarea').inputValue()), await shadow('.modal textarea').inputValue());
  await shadow('.modal select[aria-label="Modelo de mensagem"]').selectOption('pendentes');
  await shadow('.modal label:has-text("Revisei") input').check();
  check('modelo com campo sem dado ({pendencias} sem entregas lidas): o campo fica visível, avisa e TRAVA o envio', /\{pendencias\}/.test(await shadow('.modal textarea').inputValue()) && /não foi lido/.test(await shadow('.modal p[role="status"]').textContent()) && await shadow('.modal .btn.pri').isDisabled());
  await pg.screenshot({ path: path.join(SHOTS, '61-modelo-campo-faltando.png') });
  await shadow('.modal select[aria-label="Modelo de mensagem"]').selectOption('sem-acesso');
  const antesM = state.sent.length;
  await shadow('.modal select[aria-label="Ver de novo em"]').selectOption('3');
  check('outro modelo, sem campo faltando: libera o envio', /último acesso foi há 23 dias/.test(await shadow('.modal textarea').inputValue()) && !(await shadow('.modal .btn.pri').isDisabled()));
  await shadow('.modal .btn.pri').click();
  await shadow('.modal .res.ok').waitFor({ timeout: 8000 });
  check('envia com o modelo e agenda o retorno em 3 dias (dito no resultado)', state.sent.length === antesM + 1 && /Retorno em \d\d\/\d\d\./.test(await shadow('.modal .res').textContent()));
  await shadow('.modal .btn:has-text("Fechar")').click();
  check('o painel de retornos mostra o aluno agendado', /Fábio Rocha/.test(await shadow('.rbox').textContent()));

  // retorno que vence hoje, comparativo com leitura de 7 dias atrás (guardados direto no armazenamento da extensão)
  await sw.evaluate(async () => {
    const d = new Date(); const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const r = (await chrome.storage.local.get('uas.retornos'))['uas.retornos'] || {};
    r['ead.senai.br:7'] = [...(r['ead.senai.br:7'] || []), { aluno: 'id:13', em: hoje, criado: hoje, feito: null }];
    const l = (await chrome.storage.local.get('uas.leituras'))['uas.leituras'] || {};
    const prev = { at: new Date(Date.now() - 7 * 86400000).toISOString(), n: 6, media: 60, a: { 'id:11': [92, 1, null], 'id:12': [81, 2, null], 'id:13': [52, 3, null], 'id:14': [51, 10, null], 'id:15': [31, 20, null], 'id:16': [74, 5, null] } };
    l['ead.senai.br:7'] = [prev, ...(l['ead.senai.br:7'] || [])];
    await chrome.storage.local.set({ 'uas.retornos': r, 'uas.leituras': l });
  });
  await pg.keyboard.press('Escape');
  await pg.click('#hub-ead-launcher .tab');
  await pg.click('#hub-ead-launcher .app[data-app="acompanhamento"]');
  await shadow('.rbox').waitFor();
  check('"Retornos de hoje": o retorno que vence hoje aparece com Feito e Adiar', /Retornos de hoje \(1\)/.test(await shadow('.rbox').textContent()) && /Camila Ferreira/.test(await shadow('.rbox').textContent()) && await shadow('.rbox button:has-text("Adiar 3 dias")').count() === 1);
  await shadow('details.cmpbox').waitFor();
  await shadow('details.cmpbox summary').click();
  const cmp = await shadow('details.cmpbox').textContent();
  check('Comparativo: resume quem piorou/melhorou e mostra a variação por aluno (Camila +6, Diego −4)', /piorou/.test(cmp) && /melhorou/.test(cmp) && /Camila Ferreira[\s\S]*58 \(\+6\)/.test(cmp) && /Diego Martins[\s\S]*47 \(-4\)/.test(cmp), cmp.slice(0, 300));
  await pg.screenshot({ path: path.join(SHOTS, '62-retornos-comparativo.png') });
  check('o comparativo não guarda nome nem e-mail (só números)', await sw.evaluate(async () => { const t = JSON.stringify((await chrome.storage.local.get('uas.leituras'))['uas.leituras']); return !/Camila|@exemplo|Fábio/.test(t); }));
  await shadow('.rbox button:has-text("Feito")').first().click();
  check('"Feito" tira o retorno da lista de hoje', !/Retornos de hoje \(1\)/.test(await shadow('.rbox').textContent()));
  await sw.evaluate(() => chrome.storage.local.remove('uas.modelos')); // volta aos modelos padrão para os próximos testes


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
  await shadow('nav button:has-text("Alunos")').click();
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
  check('nada foi enviado nessa conferência', state.sent.length === totalDepoisFila + 1); // +1: a mensagem com modelo enviada no bloco da 0.15
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

  // ---- Relatório da turma (página "Meus cursos") ----
  state.modoMeus = true;
  await pg.goto(`${ORIGIN}/my/`);
  await pg.waitForSelector('#hub-ead-launcher', { state: 'attached' });
  await pg.click('#hub-ead-launcher .tab');
  check('menu mostra "Relatório da turma" disponível em Meus cursos', await pg.evaluate(() => { const b = document.querySelector('#hub-ead-launcher').shadowRoot.querySelector('.app[data-app="relatorio-turma"]'); return Boolean(b) && b.getAttribute('data-fora') !== 'true'; }));
  const gh0 = state.graderHits;
  await pg.click('#hub-ead-launcher .app[data-app="relatorio-turma"]');
  await pg.waitForSelector('#hub-aln-turma', { state: 'attached', timeout: 15000 });
  const tshadow = sel => pg.locator(`#hub-aln-turma >> ${sel}`);
  await tshadow('.list .it').first().waitFor();
  check('lista as 3 UCs da página com a turma, sem consultar nada antes de gerar', (await tshadow('.list .it').count()) === 3 && state.graderHits === gh0 && /Téc\. Redes/.test(await tshadow('.list').textContent()) && !/Nome do curso/.test(await tshadow('.list').textContent()));
  check('"Gerar relatório" começa travado sem seleção', await tshadow('button.pri').isDisabled());
  const nomesT = await tshadow('.list .it b').allTextContents();
  const termo = nomesT[0].trim().split(/\s+/).sort((a, b) => b.length - a.length)[0].toUpperCase();
  await tshadow('input.q').fill(termo);
  const achados = await tshadow('.list .it').count();
  check('busca por curso: filtra a lista sem diferenciar maiúsculas/acentos e diz quantos achou', achados >= 1 && achados <= 3 && /na busca/.test(await tshadow('.bar .sp').textContent()), `${termo}: ${achados}`);
  await pg.screenshot({ path: path.join(SHOTS, '31-turma-busca.png') });
  await tshadow('button:has-text("Selecionar os encontrados")').click();
  check('selecionar os encontrados marca só os da busca e libera o botão', await tshadow('.list .it.on').count() === achados && !(await tshadow('button.pri').isDisabled()));
  await tshadow('input.q').fill('zzzzqq');
  check('busca sem resultado mostra aviso e mantém a seleção fora da busca', await tshadow('.list .it').count() === 0 && /Nenhum curso encontrado/.test(await tshadow('.list').textContent()) && /fora da busca/.test(await tshadow('.bar .sp').textContent()));
  await tshadow('input.q').fill('');
  if (achados < 3) await tshadow('button:has-text("Selecionar todas")').click();
  await tshadow('button:has-text("Limpar seleção")').click();
  check('apagar a busca volta às 3 UCs e a seleção pode ser limpa', await tshadow('.list .it').count() === 3 && await tshadow('button.pri').isDisabled());
  await tshadow('button:has-text("Selecionar todas")').click();
  await pg.screenshot({ path: path.join(SHOTS, '32-turma-selecao.png') });
  let baixouSozinho = 0; const contaDl = () => { baixouSozinho += 1; }; pg.on('download', contaDl);
  await tshadow('button.pri').click();
  await tshadow('button:has-text("Tentar só as não verificadas")').waitFor({ timeout: 40000 });
  await sleep(500);
  await pg.screenshot({ path: path.join(SHOTS, '33-turma-incompleta.png') });
  check('leitura incompleta NÃO gera o Excel sozinha: avisa e oferece "Tentar só as não verificadas (1)" e "Baixar Excel assim mesmo"', baixouSozinho === 0 && /NÃO foi gerado/.test(await tshadow('.msg').last().textContent()) && /\(1\)/.test(await tshadow('button:has-text("Tentar só as não verificadas")').textContent()) && await tshadow('button:has-text("Baixar Excel assim mesmo")').count() === 1 && /não verificada/.test(await tshadow('.list').textContent()), `downloads=${baixouSozinho}`);
  const gh2 = state.graderHits;
  await tshadow('button:has-text("Tentar só as não verificadas")').click();
  await tshadow('button:has-text("Tentar só as não verificadas")').waitFor({ timeout: 40000 });
  check('"Tentar só as não verificadas" lê apenas a que faltava (as 2 lidas não são pedidas de novo)', state.graderHits === gh2 && baixouSozinho === 0, `${state.graderHits - gh2} consultas extras`);
  const [dlT] = await Promise.all([pg.waitForEvent('download', { timeout: 40000 }), tshadow('button:has-text("Baixar Excel assim mesmo")').click()]);
  const tPath = path.join(SHOTS, 'turma.xlsx'); await dlT.saveAs(tPath);
  const tb = fs.readFileSync(tPath);
  await tshadow('.msg').last().waitFor();
  await pg.screenshot({ path: path.join(SHOTS, '33-turma-resultado.png') });
  check('"Baixar assim mesmo": uma aba por turma + Situação + Avisos (a UC que falhou)', /^relatorio-turma-.*\.xlsx$/.test(dlT.suggestedFilename()) && ['Téc. Redes · Turma A', 'Situação', 'Avisos', 'Redes de Computadores', 'Segurança em Redes'].every(t => tb.includes(Buffer.from(t))) && tb.includes(Buffer.from('Lógica de Programação')), dlT.suggestedFilename());
  check('a UC que falhou não vira nota zero nem some: aparece em Avisos e as outras seguem', /não verificada/.test(await tshadow('.list').textContent()) && state.graderHits - gh0 === 2 && /Atenção/i.test(await tshadow('.msg').last().textContent()));
  state.modoMeus = false; // o Moodle voltou: agora a tentativa só da que faltava completa tudo e baixa sozinha
  const [dlOk] = await Promise.all([pg.waitForEvent('download', { timeout: 40000 }), tshadow('button:has-text("Tentar só as não verificadas")').click()]);
  await tshadow('button:has-text("Ler de novo")').waitFor({ timeout: 20000 });
  check('depois que a pendente é lida, o Excel completo sai sozinho e sem a lista de pendências', /^relatorio-turma-/.test(dlOk.suggestedFilename()) && state.graderHits - gh0 === 3 && /Excel gerado com 3 unidade/.test(await tshadow('.msg').last().textContent()) && await tshadow('button:has-text("Tentar só")').count() === 0, `${state.graderHits - gh0} consultas`);
  pg.off('download', contaDl);
  await tshadow('button:has-text("Fechar")').click();
  state.modoMeus = false;

  // ---- 0.13: Compatibilidade, Sobre e Meus dados ----
  await pg.goto(`${ORIGIN}/grade/report/grader/index.php?id=7`);
  await pg.waitForSelector('#hub-ead-launcher', { state: 'attached' });
  const gh1 = state.graderHits, uh1 = state.usersHits;
  await pg.click('#hub-ead-launcher .tab');
  await pg.click('#hub-ead-launcher .app[data-app="ferramentas"]');
  await pg.click('#hub-ead-launcher .app[data-app="compat"]');
  await pg.waitForSelector('#hub-aln-sistema', { state: 'attached', timeout: 15000 });
  const sis = sel => pg.locator(`#hub-aln-sistema >> ${sel}`);
  await sis('.it').first().waitFor();
  const diagTxt = await sis('.box').textContent();
  check('Compatibilidade: reconhece o livro de notas, sem consultar o Moodle e sem nome de aluno', /Tabela do livro de notas/.test(diagTxt) && /Coluna “Total do curso”/.test(diagTxt) && state.graderHits === gh1 && state.usersHits === uh1 && !/Camila|Fábio|Diego/.test(diagTxt), diagTxt.slice(0, 200));
  await pg.screenshot({ path: path.join(SHOTS, '40-compat.png') });
  await sis('button:has-text("Fechar")').click();

  await pg.click('#hub-ead-launcher .tab');
  await pg.click('#hub-ead-launcher .app[data-app="ferramentas"]');
  await pg.click('#hub-ead-launcher .app[data-app="sobre"]');
  await sis('h2').waitFor();
  const sobre = await sis('.box').textContent();
  const link = await sis('a:has-text("Ver se há versão nova")').getAttribute('href');
  check('Sobre: mostra a versão, os créditos e abre só a página de versões do GitHub', /0\.15\.0/.test(sobre) && /Julio Alves/.test(sobre) && /github\.com\/euriconetoia-cmyk\/Unidigit-l-Assist\/releases$/.test(link));
  await pg.screenshot({ path: path.join(SHOTS, '41-sobre.png') });
  await sis('button:has-text("Fechar")').click();

  await pg.click('#hub-ead-launcher .tab');
  await pg.click('#hub-ead-launcher .app[data-app="ferramentas"]');
  await pg.click('#hub-ead-launcher .app[data-app="meus-dados"]');
  await sis('button:has-text("Exportar backup")').waitFor();
  check('Meus dados: mostra o uso em KB (baixo) e sem aviso de limite', /Uso: \d+ (B|KB) de 10,0 MB/.test(await sis('.box').textContent()) && !(await sis('.bar.hot').count()), (await sis('.box').textContent()).slice(0, 300));
  const [dlB] = await Promise.all([pg.waitForEvent('download', { timeout: 15000 }), sis('button:has-text("Exportar backup")').click()]);
  const bPath = path.join(SHOTS, 'backup.json'); await dlB.saveAs(bPath);
  const bj = JSON.parse(fs.readFileSync(bPath, 'utf8'));
  check('Backup exportado: arquivo JSON do app, formato 1, com a validade', /^unidigital-assist-backup-.*\.json$/.test(dlB.suggestedFilename()) && bj.app === 'unidigital-assist' && bj.schema === 1 && bj.dados['uas.config'].validadeContatosDias === 365);
  const bad = path.join(SHOTS, 'ruim.json'); fs.writeFileSync(bad, '{"qualquer":"coisa"}');
  await pg.locator('#hub-aln-sistema >> input[type=file]').setInputFiles(bad);
  await sis('.msg.err').waitFor();
  check('Importar rejeita arquivo que não é backup, sem mudar nada', /não é um backup/.test(await sis('.msg.err').textContent()));
  const bom = path.join(SHOTS, 'bom.json'); fs.writeFileSync(bom, JSON.stringify({ app: 'unidigital-assist', schema: 1, dados: { 'hub.contatos.v1': { 'x:1': { 'id:5': [{ at: new Date().toISOString(), msgid: 9, text: 'oi' }] } }, 'uas.config': { validadeContatosDias: 180 } } }));
  await pg.locator('#hub-aln-sistema >> input[type=file]').setInputFiles(bom);
  await sis('button:has-text("Juntar")').click();
  await sis('.msg.ok').waitFor();
  check('Importar backup válido: aparece em Contatos e a validade vira 6 meses', /Contatos/.test(await sis('.box').textContent()) && /registro\(s\)/.test(await sis('.box').textContent()) && (await sis('select[aria-label="Validade dos contatos"]').inputValue()) === '180');
  await pg.screenshot({ path: path.join(SHOTS, '42-meus-dados.png') });
  await sis('button:has-text("Apagar tudo")').click();
  check('Apagar tudo pede confirmação antes de apagar', /Não dá para desfazer/.test(await sis('#apagar').textContent()));
  await sis('button:has-text("Sim, apagar tudo")').click();
  await sis('.msg.ok').waitFor();
  check('Apagar tudo limpa os contatos', /Nada guardado ainda/.test(await sis('.box').textContent()));
  await sis('button:has-text("Fechar")').click();

  // ---- 0.14: gaveta Ferramentas, modelo CSV e Kahoot (Kahoot simulado) ----
  const KAHOOT_HTML = `<!doctype html><html><head><title>Quiz de teste</title></head><body style="font:14px sans-serif">
  <div id="side"><div data-functional-selector="sidebar-block">Pergunta 1</div><button data-functional-selector="add-question-button">Add</button></div>
  <div id="ed"><div contenteditable="true" data-functional-selector="question-title__input" style="border:1px solid #888;min-height:24px;margin:6px"></div>
  ${[0, 1, 2, 3].map(() => '<div data-functional-selector="question-answer" style="margin:6px"><div contenteditable="true" data-functional-selector="question-answer__input" style="border:1px solid #aaa;min-height:22px;display:inline-block;min-width:240px"></div> <button data-functional-selector="question-answer__toggle-button" aria-checked="false">correta</button></div>').join('')}</div>
  <script>
  document.querySelectorAll('[data-functional-selector="question-answer__toggle-button"]').forEach(b => b.addEventListener('click', () => { const on = b.getAttribute('aria-checked') === 'true'; document.querySelectorAll('[data-functional-selector="question-answer__toggle-button"]').forEach(x => x.setAttribute('aria-checked', 'false')); b.setAttribute('aria-checked', String(!on)); }));
  document.querySelector('[data-functional-selector="add-question-button"]').addEventListener('click', () => { const d = document.createElement('div'); d.setAttribute('data-functional-selector', 'sidebar-block'); d.textContent = 'Pergunta ' + (document.querySelectorAll('[data-functional-selector="sidebar-block"]').length + 1); document.getElementById('side').insertBefore(d, document.querySelector('[data-functional-selector="add-question-button"]')); document.querySelectorAll('#ed [contenteditable]').forEach(e => { e.textContent = ''; }); document.querySelectorAll('[data-functional-selector="question-answer__toggle-button"]').forEach(x => x.setAttribute('aria-checked', 'false')); });
  </script></body></html>`;
  const kahootHits = []; await ctx.route('https://create.kahoot.it/**', r => { kahootHits.push(r.request().url()); return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: KAHOOT_HTML }); });
  await pg.goto(`${ORIGIN}/course/view.php?id=7`);
  await pg.waitForSelector('#hub-ead-launcher', { state: 'attached' });
  await pg.click('#hub-ead-launcher .tab');
  await pg.click('#hub-ead-launcher .app[data-app="ferramentas"]');
  await pg.screenshot({ path: path.join(SHOTS, '50-gaveta.png') });
  check('gaveta Ferramentas: Kahoot e Modelo disponíveis; Conferir datas disponível; Automação "em breve"', await pg.evaluate(() => { const r = document.querySelector('#hub-ead-launcher').shadowRoot; const d = id => r.querySelector(`[data-app="${id}"]`).getAttribute('aria-disabled'); return d('kahoot') === 'false' && d('modelo-kahoot') === 'false' && d('conferir-datas') === 'false' && d('blocos') === 'true'; }));
  const [dlM] = await Promise.all([pg.waitForEvent('download', { timeout: 15000 }), pg.click('#hub-ead-launcher .app[data-app="modelo-kahoot"]')]);
  const mPath = path.join(SHOTS, 'modelo.csv'); await dlM.saveAs(mPath);
  check('Modelo de perguntas: baixa o CSV com o cabeçalho esperado, sem consultar nada', dlM.suggestedFilename() === 'modelo-perguntas-kahoot.csv' && /^﻿pergunta;opcao1;opcao2;opcao3;opcao4;correta/.test(fs.readFileSync(mPath, 'utf8')) && kahootHits.length === 0);

  const [kpage] = await Promise.all([ctx.waitForEvent('page', { timeout: 15000 }), pg.click('#hub-ead-launcher .app[data-app="kahoot"]')]).catch(async e => { throw new Error(`${e.message} | status do menu: ${await pg.locator('#hub-ead-launcher .status').textContent()} | páginas: ${ctx.pages().map(p => p.url()).join(' ; ')} | aberto: ${await pg.locator('#hub-ead-launcher .panel').isVisible()} | erros: ${JSON.stringify(errors)} | abas: ${JSON.stringify(await sw.evaluate(() => chrome.tabs.query({}).then(t => t.map(x => x.url || x.pendingUrl))))}`); });
  await kpage.waitForLoadState('domcontentloaded');
  check('Kahoot no menu: abre a página da extensão (nada do Kahoot foi tocado ainda)', /^chrome-extension:\/\/.+\/kahoot\.html$/.test(kpage.url()) && kahootHits.length === 0, kpage.url());
  await kpage.waitForSelector('#com:not([hidden])', { timeout: 10000 });
  await kpage.screenshot({ path: path.join(SHOTS, '51-pagina-kahoot.png') });
  // (abrir o editor numa aba nova é coberto no teste unitário; aqui a aba do Kahoot já está aberta, como no uso normal)
  const editorPg = await ctx.newPage(); await editorPg.goto('https://create.kahoot.it/creator/1'); await editorPg.waitForSelector('[data-functional-selector="add-question-button"]');
  await kpage.click('#reler');
  await kpage.locator('#abas button').first().waitFor({ timeout: 10000 });
  check('página Kahoot: lista a aba aberta do editor para "Preparar esta aba"', /Quiz de teste/.test(await kpage.locator('#abas button').first().textContent()));
  await kpage.click('#abas button');
  await editorPg.bringToFront();
  await editorPg.waitForSelector('#hub-kht-host', { state: 'attached', timeout: 20000 }).catch(async e => { throw new Error(`${e.message} | msg: ${await kpage.locator('#msg').textContent()}`); });
  const kh = sel => editorPg.locator(`#hub-kht-host >> ${sel}`);
  await kh('input[type=file]').waitFor({ state: 'attached' });
  check('Kahoot: janela de importação aparece no editor depois de preparar', kahootHits.length >= 1 && /Importar perguntas/.test(await kh('h2').textContent()));
  const csv = path.join(SHOTS, 'quiz.csv');
  fs.writeFileSync(csv, 'pergunta;opcao1;opcao2;opcao3;opcao4;correta\nQual é a capital de Goiás?;Goiânia;Anápolis;Brasília;Rio Verde;1\nO que é um DNS?;Tradutor de nomes;Um cabo;Um antivírus;Um navegador;A\nSem correta?;a;b;c;d;\nPorta do HTTPS?;80;443;21;22;443\n');
  await editorPg.locator('#hub-kht-host >> input[type=file]').setInputFiles(csv);
  await kh('table').waitFor();
  await editorPg.screenshot({ path: path.join(SHOTS, '52-kahoot-conferir.png') });
  const tabTxt = await kh('table').textContent();
  check('Kahoot: conferência mostra 3 prontas e 1 com problema (falta a correta); "Importar tudo" fica travado', /falta a correta/.test(tabTxt) && /3 pronta/.test(await kh('.sub').textContent()) && await kh('button.pri').isDisabled());
  await kh('button:has-text("Importar só as válidas")').click();
  await editorPg.locator('#hub-kht-host-prog >> .msg.ok').waitFor({ timeout: 40000 });
  await editorPg.screenshot({ path: path.join(SHOTS, '53-kahoot-concluido.png') });
  const out = await editorPg.evaluate(() => ({ blocos: document.querySelectorAll('[data-functional-selector="sidebar-block"]').length, titulo: document.querySelector('[data-functional-selector="question-title__input"]').textContent, opcoes: [...document.querySelectorAll('[data-functional-selector="question-answer__input"]')].map(e => e.textContent), marcada: [...document.querySelectorAll('[data-functional-selector="question-answer__toggle-button"]')].findIndex(b => b.getAttribute('aria-checked') === 'true') }));
  check('Kahoot: 3 perguntas preenchidas (1ª na em branco), última com a alternativa correta marcada', out.blocos === 3 && out.titulo === 'Porta do HTTPS?' && JSON.stringify(out.opcoes) === JSON.stringify(['80', '443', '21', '22']) && out.marcada === 1, JSON.stringify(out));
  check('Kahoot: o aviso final manda conferir e salvar no Kahoot', /Confira o quiz e salve/.test(await editorPg.locator('#hub-kht-host-prog >> .msg.ok').textContent()));
  await editorPg.close(); await kpage.close();

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

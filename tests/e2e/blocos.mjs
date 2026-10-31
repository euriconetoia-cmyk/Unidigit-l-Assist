// E2E: Chromium real com a extensão carregada (dist/ext), painel aberto como aba e um Moodle simulado (dados fictícios).
// Uso: node tests/e2e/blocos.mjs [pastaDaExtensao] [pastaDePrints]   (precisa de Playwright global: npm i -g playwright)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

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
const ACTS = { 101: { course: 7, name: 'SAP 01', pending: 3 }, 102: { course: 7, name: 'SAP 02', pending: 2 }, 201: { course: 8, name: 'SAP 01', pending: 0 } };
const state = { summaryHits: 0, downloads: 0 };
const li = id => `<li class="activity assign modtype_assign"><a href="/mod/assign/view.php?id=${id}"><span class="instancename">${ACTS[id].name}</span></a></li>`;
const gradingPage = id => `<html><body><form><input name="sesskey" value="abc123"></form><table id="submissions"><tbody>${['Ana Souza', 'João da Silva', 'Beatriz Alves'].slice(0, ACTS[id].pending).map((n, i) => `<tr><td><input type="checkbox" name="selectedusers" value="${10 + i}"></td><td class="cell username"><a href="/user/view.php?id=${10 + i}&course=1">${n}</a></td><td><a href="/pluginfile.php/1/x/${i}/trabalho.pdf">trabalho.pdf</a></td><td><div class="w-100"><input type="text" name="quickgrade_${10 + i}" value="">&nbsp;/&nbsp;10,00</div></td></tr>`).join('')}</tbody></table></body></html>`;
const handler = async route => {
  const req = route.request(); const u = new URL(req.url());
  const html = body => route.fulfill({ contentType: 'text/html; charset=utf-8', body });
  if (u.pathname === '/course/index.php') return html(`<html><body><div role="main"><h1>Cursos</h1>${Object.entries(COURSES).map(([id, n]) => `<div class="coursebox card"><h3 class="coursename"><a href="/course/view.php?id=${id}">${n}</a></h3></div>`).join('')}</div></body></html>`);
  if (u.pathname === '/course/view.php') { const c = Number(u.searchParams.get('id')); return html(`<html><body><div role="main"><h1>${COURSES[c]}</h1><ul>${Object.keys(ACTS).filter(i => ACTS[i].course === c).map(li).join('')}</ul></div></body></html>`); }
  if (u.pathname === '/my/') return html('<html><body><div role="main"><h1>Painel</h1></div></body></html>');
  if (u.pathname === '/mod/assign/view.php') {
    if (req.method() === 'POST') { state.downloads += 1; return route.fulfill({ status: 200, headers: { 'content-type': 'application/zip' }, body: Buffer.from('504b0506' + '00'.repeat(18), 'hex') }); }
    const id = u.searchParams.get('id'); const a = ACTS[id];
    if (!a) return route.fulfill({ status: 404, body: '' });
    if (u.searchParams.get('action') === 'grading') return html(gradingPage(id));
    state.summaryHits += 1; await sleep(120);
    return html(`<html><body><div class="gradingsummary"><table class="generaltable gradingsummarytable"><tr><th>Participantes</th><td>30</td></tr><tr><th>Precisa de avaliação</th><td>${a.pending}</td></tr></table></div></body></html>`);
  }
  return route.fulfill({ status: 404, body: '' });
};

// ---- execução ----
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'blocos-profile-'));
const ctx = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`], viewport: { width: 520, height: 820 }, acceptDownloads: true });
try {
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  const extId = new URL(sw.url()).host;
  check('a extensão carregou (service worker ativo)', /^[a-p]{32}$/.test(extId), sw.url());
  await ctx.route(`${ORIGIN}/**`, handler);

  const moodle = await ctx.newPage();
  await moodle.setViewportSize({ width: 900, height: 600 });
  await moodle.goto(`${ORIGIN}/course/index.php?categoryid=3`);
  await sleep(1200);
  check('o Moodle aberto não recebe NADA da extensão antes de um bloco pedir (sem barra, sem consulta)', await moodle.locator('.imn-bar').count() === 0 && state.summaryHits === 0);

  const panel = await ctx.newPage();
  await panel.goto(`chrome-extension://${extId}/sidepanel.html`);
  const moodleTabId = await panel.evaluate(async () => (await chrome.tabs.query({ url: 'https://ead.senai.br/*' }))[0].id);
  await panel.goto(`chrome-extension://${extId}/sidepanel.html?tab=${moodleTabId}`);
  await panel.waitForSelector('.blocklySvg', { timeout: 15000 });
  await sleep(800);
  const blockCount = await panel.locator('.blocklyDraggable').count();
  check('o editor Blockly abre em português com o exemplo inicial já desenhado (sem executar)', blockCount >= 3 && /Nada roda sozinho/.test(await panel.locator('#state').textContent()), `blocos=${blockCount}`);
  check('abrir o painel não executou nada', state.summaryHits === 0 && await moodle.locator('.imn-bar').count() === 0);
  await panel.screenshot({ path: path.join(SHOTS, '1-painel-inicial.png') });

  // Exemplo 1: buscar e registrar
  await panel.click('#run');
  await panel.waitForFunction(() => /Conclu[ií]do|Erro/.test(document.getElementById('state').textContent), null, { timeout: 60000 });
  const log1 = await panel.locator('#log').textContent();
  check('executar: o bloco "buscar pendências" leu o Moodle da aba ativa (5 pendências)', /Pendências: 5/.test(log1) && /Busca concluída: 5 pendência/.test(log1), log1.slice(0, 300));
  check('o módulo só foi injetado depois do clique em Executar (a barra do radar aparece)', await moodle.locator('.imn-bar').count() === 1);
  check('mesma contagem do radar da página', /5 pendência/.test(await moodle.locator('.imn-bar-status').textContent()));
  await panel.screenshot({ path: path.join(SHOTS, '2-painel-executado.png') });
  await moodle.screenshot({ path: path.join(SHOTS, '3-moodle-apos-executar.png') });

  // Exemplo 2: buscar e baixar se houver
  const hitsBefore = state.summaryHits;
  await panel.selectOption('#examples', 'Buscar e, se houver pendência, baixar');
  await sleep(500);
  await panel.click('#run');
  await panel.waitForFunction(() => /Conclu[ií]do|Erro/.test(document.getElementById('state').textContent), null, { timeout: 60000 });
  await moodle.waitForSelector('.imn-bar-detail:not([hidden]) .imn-actions', { timeout: 30000 });
  const detail = await moodle.locator('.imn-bar-detail').textContent();
  check('"se houver pendência → baixar" inicia o fluxo e PARA na confirmação da página (o bloco não confirma por você)', /Gerar|Confirmar/.test(detail) && state.downloads === 0, detail.slice(0, 160));
  check('o segundo programa não injetou de novo (só uma barra) e releu o Moodle', await moodle.locator('.imn-bar').count() === 1 && state.summaryHits > hitsBefore);
  await panel.screenshot({ path: path.join(SHOTS, '4-painel-baixar.png') });
  await moodle.screenshot({ path: path.join(SHOTS, '5-moodle-confirmacao.png') });

  // Página errada: erro claro e nada injetado
  await moodle.goto(`${ORIGIN}/my/`);
  await panel.selectOption('#examples', 'Buscar pendências e registrar o total');
  await sleep(500);
  await panel.click('#run');
  await panel.waitForFunction(() => /Conclu[ií]do|Erro/.test(document.getElementById('state').textContent), null, { timeout: 30000 });
  const log3 = await panel.locator('#log').textContent();
  check('em página que não é curso/categoria: erro claro no registro, sem quebrar o painel', /curso ou de categoria/.test(log3) && /Erro/.test(await panel.locator('#state').textContent()), log3.slice(0, 200));
  await panel.screenshot({ path: path.join(SHOTS, '6-painel-erro.png') });

  // Salvar / carregar
  await panel.fill('#name', 'Meu teste');
  await panel.click('#save');
  await sleep(300);
  check('salvar um programa pelo nome e listá-lo em "Meus programas"', (await panel.locator('#saved option').allTextContents()).includes('Meu teste'));
} catch (error) {
  check('o teste rodou até o fim', false, error.stack || String(error));
}
await ctx.close();
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram. Prints: ${SHOTS}`);
if (failed.length) process.exit(1);

// E2E do "Cronograma da turma": Chromium real + extensão + Moodle simulado (dados fictícios).
// Uso: node tests/e2e/cronograma.mjs [pastaDaExtensao] [pastaDePrints]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { abrirItem } from './menu.mjs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const EXT = path.resolve(process.argv[2] || path.join(here, '..', '..', 'dist', 'ext'));
const SHOTS = path.resolve(process.argv[3] || fs.mkdtempSync(path.join(os.tmpdir(), 'crono-e2e-')));
fs.mkdirSync(SHOTS, { recursive: true });
const ORIGIN = 'https://ead.senai.br';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: Boolean(ok), detail }); console.log(`${ok ? '  ok ' : ' FALHA'}  ${name}${ok || !detail ? '' : ` → ${detail}`}`); };
const fx = f => fs.readFileSync(path.join(here, '..', 'fixtures', f), 'utf8');

// JSON do teste: o exemplo + a UC do texto real (com as datas deslocadas 1 semana)
const j = JSON.parse(fx('cronograma-turma-exemplo.json'));
j.modulos[0].itens.push({ id: 'i99', tipo: 'uc', nome: 'Infraestrutura de Redes de Computadores', inicio: '2026-10-23', termino: '2026-11-23', terminoAva: '2026-12-01', momentos: [
  { tipo: 'presencial', data: '2026-11-07', horario: '08:00h às 17:00h', webconferencia: { data: '2026-10-29', hora: '19h' }, postagemNotas: '2026-11-11' },
  { tipo: 'presencial', data: '2026-11-21', horario: '08:00h às 12:00h', webconferencia: { data: '2026-11-12', hora: '19h' }, postagemNotas: '2026-11-25' }], suporte: {} });
const jsonPath = path.join(SHOTS, 'cronograma-teste.json'); fs.writeFileSync(jsonPath, JSON.stringify(j));

// ---- Moodle simulado ----
const rotulos = { 306733: fx('rotulo-cabecalho.html'), 306734: fx('rotulo-cronograma-completo.html') };
const log = { gets: 0, posts: 0 };
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const li = id => `<li class="activity activity-wrapper label modtype_label" id="module-${id}"><div class="activity-item"><div class="activity-altcontent"><div class="no-overflow">${rotulos[id]}</div></div></div></li>`;
const coursePage = () => `<html><body><div class="page-header-headings"><h1 class="h2 mb-0">1037240 - Técnico em Informática para Internet - 00001/2026</h1></div><div role="main"><ul>${li(306733)}${li(306734)}<li class="activity label modtype_label" id="module-1"><div class="no-overflow"><p>Bem-vindo ao curso</p></div></li></ul></div></body></html>`;
const handler = async route => {
  const req = route.request(); const u = new URL(req.url());
  const html = body => route.fulfill({ contentType: 'text/html; charset=utf-8', body });
  if (u.pathname === '/course/view.php') return html(coursePage());
  if (u.pathname === '/course/modedit.php') {
    if (req.method() !== 'GET') { log.posts += 1; return route.fulfill({ status: 500, body: '' }); }
    const id = u.searchParams.get('update'); if (!rotulos[id]) return route.fulfill({ status: 404, body: '' });
    log.gets += 1; return html(`<html><body><form id="mform1"><textarea name="introeditor[text]">${esc(rotulos[id])}</textarea></form></body></html>`);
  }
  return route.fulfill({ status: 404, body: '' });
};

const EXTC = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-crono-')); fs.cpSync(EXT, EXTC, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'crono-profile-'));
const ctx = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${EXTC}`, `--load-extension=${EXTC}`], viewport: { width: 1200, height: 900 }, acceptDownloads: true });
try {
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  await ctx.route(`${ORIGIN}/**`, handler);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  const pg = await ctx.newPage(); const errors = [];
  pg.on('pageerror', e => errors.push(e.message));
  await pg.goto(`${ORIGIN}/course/view.php?id=7`);
  await pg.waitForSelector('#hub-ead-launcher', { state: 'attached', timeout: 15000 });
  await pg.click('#hub-ead-launcher .tab');
  check('gaveta tem "Cronograma da turma" disponível', await pg.evaluate(() => document.querySelector('#hub-ead-launcher').shadowRoot.querySelector('[data-app="cronograma-turma"]').getAttribute('aria-disabled') === 'false'));
  await abrirItem(pg, 'cronograma-turma');
  await pg.waitForSelector('#hub-crn-host', { state: 'attached', timeout: 15000 });
  const q = s => pg.locator(`#hub-crn-host ${s}`);
  await q('input[type=file]').first().waitFor({ state: 'attached', timeout: 10000 });
  check('antes de importar, nada foi consultado no Moodle', log.gets === 0);
  await q('input[type=file]').first().setInputFiles(jsonPath);
  await q('table').waitFor({ timeout: 10000 });
  const txt = await q('.box').textContent();
  check('turma importada: validada e ligação segura pelo código do Moodle', /Validado/.test(txt) && /ligação segura/.test(txt) && /1037240/.test(txt), txt.slice(0, 300));
  check('avisos do arquivo aparecem (encontro antes do início da UC)', /encontro 1.*anterior ao início/.test(txt));
  const linha = q('tbody tr:has-text("Infraestrutura de Redes")');
  check('a UC do curso mostra cabeçalho ✓ e cronograma ✓; as outras UCs não têm revisão', /cabeçalho ✓/.test(await linha.textContent()) && /cronograma ✓/.test(await linha.textContent()) && await q('button:has-text("Revisar"):not([disabled])').count() === 1);
  await pg.screenshot({ path: path.join(SHOTS, 'c1-turma.png') });
  await linha.locator('button').click();
  await q('h3:has-text("O que muda nos textos")').waitFor({ timeout: 10000 });
  const t2 = await q('.box').textContent();
  check('mostra as mudanças: período, webaulas, encontros e atividades', /23\/10\/2026 a 23\/11\/2026/.test(t2) && /Webaula 1 · data/.test(t2) && /Encontro 2 · data/.test(t2) && /SAP 01 · término/.test(t2));
  await pg.screenshot({ path: path.join(SHOTS, 'c2-uc.png') });
  // webaulas pelo dia da semana: quintas, a cada 2 semanas (16/10..16/11 não, UC é 23/10..23/11 → 29/10 e 12/11 são quintas)
  await q('select[aria-label="Origem das webaulas"]').selectOption('gerar');
  await q('select[aria-label="Dia da semana"]').selectOption('4');
  await q('select[aria-label="Frequência"]').selectOption('2');
  const datas = await q('input[aria-label^="Data da webaula"]').evaluateAll(l => l.map(i => i.value));
  check('gerador: quintas a cada 2 semanas dentro da UC', JSON.stringify(datas) === JSON.stringify(['29/10/2026', '12/11/2026']), JSON.stringify(datas));
  await q('select[aria-label="Frequência"]').selectOption('1');
  check('gerador: toda semana gera 4 datas (29/10, 05/11, 12/11, 19/11)', await q('input[aria-label^="Data da webaula"]').count() === 4);
  await q('select[aria-label="Origem das webaulas"]').selectOption('json');
  // copiar o texto atualizado do cronograma completo e "colar e salvar" (simulado)
  await q('button:has-text("Copiar texto atualizado")').nth(1).click();
  await q('.msg.ok').waitFor({ timeout: 5000 });
  const copiado = await pg.evaluate(() => navigator.clipboard.readText());
  check('o texto copiado traz as datas novas e preserva o resto', /23\/10\/2026 a 23\/11\/2026/.test(copiado) && !/16\/10\/2026/.test(copiado) && /25 Pontos/.test(copiado) && /Horário Limite/.test(copiado));
  await q('button:has-text("Copiar texto atualizado")').nth(0).click();
  const copiadoCab = await pg.evaluate(() => navigator.clipboard.readText());
  check('o texto do cabeçalho também é copiado', /23\/10\/2026 a 23\/11\/2026/.test(copiadoCab) && /Período de Realização/.test(copiadoCab));
  check('a extensão só leu (GET) e não gravou nada', log.posts === 0);
  await q('button:has-text("Conferir agora")').click();
  await q('.pill:has-text("diferente")').first().waitFor({ timeout: 10000 });
  check('antes de salvar no Moodle: conferência diz "diferente"', await q('.pill:has-text("diferente")').count() === 2);
  // a pessoa cola e salva (o simulado passa a ter os textos novos)
  rotulos[306733] = copiadoCab; rotulos[306734] = copiado;
  await q('button:has-text("Conferir agora")').click();
  await q('.pill:has-text("conferido")').first().waitFor({ timeout: 10000 });
  check('depois de salvar: os dois textos aparecem como "conferido"', await q('.pill:has-text("conferido")').count() === 2);
  await pg.screenshot({ path: path.join(SHOTS, 'c3-conferido.png') });
  await q('button:has-text("Voltar")').click();
  await q('button:has-text("Esquecer este cronograma")').click();
  await q('input[type=file]').first().waitFor({ state: 'attached', timeout: 5000 });
  check('"Esquecer este cronograma" apaga e volta à importação', true);
  check('sem erros de script', errors.length === 0, errors.join(' | '));
} catch (e) { check('o teste rodou até o fim', false, e.stack || String(e)); }
await ctx.close();
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram. Prints: ${SHOTS}`);
if (failed.length) process.exit(1);

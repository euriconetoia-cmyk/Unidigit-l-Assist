// E2E do "Conferir datas": Chromium real + extensão + Moodle simulado (dados fictícios).
// Uso: node tests/e2e/datas.mjs [pastaDaExtensao] [pastaDePrints]
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
const SHOTS = path.resolve(process.argv[3] || fs.mkdtempSync(path.join(os.tmpdir(), 'datas-e2e-')));
fs.mkdirSync(SHOTS, { recursive: true });
const ORIGIN = 'https://ead.senai.br';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: Boolean(ok), detail }); console.log(`${ok ? '  ok ' : ' FALHA'}  ${name}${ok || !detail ? '' : ` → ${detail}`}`); };

// ---- Moodle simulado ----
// estado das atividades: início/término como [dia, mês, ano, hora, min] ou null (sem data)
const ACT = {
  501: { tipo: 'assign', nome: 'Envio da SAP 01', f: { allowsubmissionsfromdate: [1, 10, 2026, 0, 0], duedate: [10, 10, 2026, 18, 0], cutoffdate: null, gradingduedate: null } },
  502: { tipo: 'assign', nome: 'Envio da SAP 02', f: { allowsubmissionsfromdate: [16, 10, 2026, 0, 0], duedate: [29, 10, 2026, 23, 59], cutoffdate: null, gradingduedate: null } },
  601: { tipo: 'quiz', nome: 'Questionário 1', f: { timeopen: [1, 10, 2026, 8, 0], timeclose: [10, 10, 2026, 12, 0] } },
};
const CRON = [['Questionário 1', '16/10/2026', '29/10/2026', '23:59'], ['Envio da SAP 01', '16/10/2026', '29/10/2026', '23:59'], ['Envio da SAP 02', '16/10/2026', '29/10/2026', '23:59'], ['Encontro 1', 'A definir', 'A definir', '—']];
const log = { gets: 0, posts: 0, escritas: 0 };
const sel = (name, a, b, v, off) => `<select name="${name}"${off ? ' disabled' : ''}>${Array.from({ length: b - a + 1 }, (_, i) => `<option value="${a + i}"${a + i === v ? ' selected' : ''}>${a + i}</option>`).join('')}</select>`;
const campo = (f, v) => `<div><label><input type="checkbox" name="${f}[enabled]" value="1"${v ? ' checked' : ''}> Habilitar ${f}</label> ` + [['day', 1, 31, v ? v[0] : 1], ['month', 1, 12, v ? v[1] : 1], ['year', 2020, 2035, v ? v[2] : 2026], ['hour', 0, 23, v ? v[3] : 0], ['minute', 0, 59, v ? v[4] : 0]].map(([k, a, b, x]) => sel(`${f}[${k}]`, a, b, x, !v)).join('') + '</div>';
const editPage = id => `<html><body><div role="main"><h1>Editando ${ACT[id].nome}</h1><form id="mform1" method="post" action="/course/modedit.php?update=${id}">${Object.entries(ACT[id].f).map(([f, v]) => campo(f, v)).join('')}<input type="submit" id="id_submitbutton" value="Salvar e voltar ao curso"></form>
<script>document.querySelectorAll('input[type=checkbox]').forEach(c=>c.addEventListener('click',()=>{const f=c.name.replace('[enabled]','');document.querySelectorAll('select[name^="'+f+'["]').forEach(s=>s.disabled=!c.checked);}));</script></div></body></html>`;
const coursePage = `<html><body><div role="main"><h1>Sistemas Operacionais</h1>
<table><caption><strong>Cronograma de Atividades – SO</strong></caption><thead><tr><th>Atividade</th><th>Início</th><th>Término</th><th>Horário Limite</th></tr></thead><tbody>${CRON.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>
<ul>${Object.entries(ACT).map(([id, a]) => `<li class="activity"><a href="/mod/${a.tipo}/view.php?id=${id}"><span class="instancename">${a.nome} <span class="accesshide">${a.tipo === 'quiz' ? 'Questionário' : 'Tarefa'}</span></span></a></li>`).join('')}</ul></div></body></html>`;
const handler = async route => {
  const req = route.request(); const u = new URL(req.url());
  const html = body => route.fulfill({ contentType: 'text/html; charset=utf-8', body });
  if (u.pathname === '/course/view.php') return html(coursePage);
  if (u.pathname === '/course/modedit.php') {
    const id = u.searchParams.get('update'); if (!ACT[id]) return route.fulfill({ status: 404, body: '' });
    if (req.method() === 'POST') {
      log.posts += 1; const p = new URLSearchParams(req.postData() || '');
      for (const f of Object.keys(ACT[id].f)) ACT[id].f[f] = p.get(`${f}[enabled]`) ? [Number(p.get(`${f}[day]`)), Number(p.get(`${f}[month]`)), Number(p.get(`${f}[year]`)), Number(p.get(`${f}[hour]`)), Number(p.get(`${f}[minute]`))] : null;
      return route.fulfill({ status: 303, headers: { location: '/course/view.php?id=7' }, body: '' });
    }
    log.gets += 1; return html(editPage(id));
  }
  return route.fulfill({ status: 404, body: '' });
};

const EXTC = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-datas-')); fs.cpSync(EXT, EXTC, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'datas-profile-'));
const ctx = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${EXTC}`, `--load-extension=${EXTC}`], viewport: { width: 1200, height: 800 }, acceptDownloads: true });
try {
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  await ctx.route(`${ORIGIN}/**`, handler);
  const pg = await ctx.newPage(); const errors = [];
  pg.on('pageerror', e => errors.push(e.message));
  await pg.goto(`${ORIGIN}/course/view.php?id=7`);
  await pg.waitForSelector('#hub-ead-launcher', { state: 'attached', timeout: 15000 });
  await pg.click('#hub-ead-launcher .tab');
  check('gaveta tem "Conferir datas" disponível', await pg.evaluate(() => document.querySelector('#hub-ead-launcher').shadowRoot.querySelector('[data-app="conferir-datas"]').getAttribute('aria-disabled') === 'false'));
  await abrirItem(pg, 'conferir-datas');
  await pg.waitForSelector('#hub-dts-host', { state: 'attached', timeout: 15000 });
  const q = s => pg.locator(`#hub-dts-host ${s}`);
  check('antes do clique em Ler, nada foi consultado', log.gets === 0);
  await pg.screenshot({ path: path.join(SHOTS, 'd1-inicio.png') });
  await q('button.pri').click();
  await q('table').waitFor({ timeout: 20000 });
  check('leu as 3 atividades (só GET) sem gravar nada', log.gets === 3 && log.posts === 0, JSON.stringify(log));
  const linhas = await q('tbody tr').allTextContents();
  check('compara: SAP 01 e Questionário 1 diferentes, SAP 02 igual', /SAP 01.*diferente/.test(linhas.join('|')) && /Questionário 1.*diferente/.test(linhas.join('|')) && /SAP 02.*igual/.test(linhas.join('|')), linhas.join(' | ').slice(0, 400));
  await pg.screenshot({ path: path.join(SHOTS, 'd2-comparacao.png') });
  // data editável: muda o término da SAP 02 (que estava igual) para outra data e vira "diferente"
  const campoTerm = q('tbody tr').nth(1).locator('input.d').nth(1);
  await campoTerm.fill('30/10/2026'); await campoTerm.dispatchEvent('change');
  check('editar a data à mão recalcula a situação (SAP 02 igual → diferente) e libera marcar', /diferente/.test(await q('tbody tr').nth(1).textContent()) && await q('tbody tr').nth(1).locator('input[type=checkbox]').isEnabled());
  await pg.screenshot({ path: path.join(SHOTS, 'd2b-editando.png') });
  await campoTerm.fill('29/10/2026'); await campoTerm.dispatchEvent('change');
  // aplicar só a SAP 01
  await pg.evaluate(() => { const r = document.querySelector('#hub-dts-host').shadowRoot; r.querySelectorAll('tbody tr').forEach(tr => { const c = tr.querySelector('input[type=checkbox]'); if (c && !/SAP 01/.test(tr.textContent) && c.checked) c.click(); }); });
  await q('button.pri').click();
  await pg.waitForURL(/modedit\.php\?update=501/, { timeout: 15000 });
  await pg.waitForSelector('#hub-dts-banner', { state: 'attached', timeout: 15000 });
  check('abriu a edição da SAP 01 com faixa de aviso', true);
  const vals = await pg.evaluate(() => ['allowsubmissionsfromdate', 'duedate'].map(f => ['day', 'month', 'year', 'hour', 'minute'].map(k => document.querySelector(`[name="${f}[${k}]"]`).value).join('-')));
  check('campos preenchidos (16/10 e 29/10 23:59) e nada salvo ainda', vals[0] === '16-10-2026-0-0' && vals[1] === '29-10-2026-23-59' && log.posts === 0, JSON.stringify(vals));
  await pg.screenshot({ path: path.join(SHOTS, 'd3-edicao.png') });
  await pg.click('#id_submitbutton'); // quem salva é a pessoa
  await pg.waitForSelector('#hub-dts-host', { state: 'attached', timeout: 15000 });
  await q('table').waitFor({ timeout: 15000 });
  check('depois de salvar: relê e mostra "conferido"', log.posts === 1 && /conferido/.test(await q('tbody').textContent()), await q('tbody').textContent());
  await pg.screenshot({ path: path.join(SHOTS, 'd4-conferido.png') });
  check('mostra a próxima como pendente (o questionário também estava marcado)', /pendente/.test(await q('tbody').textContent()));
  await q('button:has-text("Abrir a próxima")').click();
  await pg.waitForURL(/modedit\.php\?update=601/, { timeout: 15000 });
  await pg.waitForSelector('#hub-dts-banner', { state: 'attached', timeout: 15000 });
  await pg.click('#id_submitbutton');
  await q('button:has-text("Voltar ao curso")').waitFor({ timeout: 15000 });
  check('questionário salvo e conferido; 2 gravações no total, ambas feitas pela pessoa', log.posts === 2 && (await q('tbody').textContent()).match(/conferido/g).length === 2);
  await pg.screenshot({ path: path.join(SHOTS, 'd5-final.png') });
  await q('button:has-text("Voltar ao curso")').click();
  await pg.waitForLoadState('load'); await new Promise(r => setTimeout(r, 800));
  check('Voltar ao curso encerra a fila (nada reabre)', await pg.locator('#hub-dts-host').count() === 0 && await pg.evaluate(() => sessionStorage.getItem('hub.datas.v1')) === null);
  check('sem erros de script', errors.length === 0, errors.join(' | '));
} catch (e) { check('o teste rodou até o fim', false, e.stack || String(e)); }
await ctx.close();
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram. Prints: ${SHOTS}`);
if (failed.length) process.exit(1);

// E2E do "Criar conteúdo": Chromium real + extensão + Moodle simulado (dados fictícios).
// Uso: node tests/e2e/criar.mjs [pastaDaExtensao] [pastaDePrints]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const EXT = path.resolve(process.argv[2] || path.join(here, '..', '..', 'dist', 'ext'));
const SHOTS = path.resolve(process.argv[3] || fs.mkdtempSync(path.join(os.tmpdir(), 'criar-e2e-')));
fs.mkdirSync(SHOTS, { recursive: true });
const ORIGIN = 'https://ead.senai.br';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: Boolean(ok), detail }); console.log(`${ok ? '  ok ' : ' FALHA'}  ${name}${ok || !detail ? '' : ` → ${detail}`}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- Moodle simulado: 3 cursos; no 9 o usuário não pode editar; no 8 já existe o fórum ----
const CURSOS = { 7: 'Redes de Computadores', 8: 'Segurança em Redes', 9: 'Administração de Servidores' };
const acts = { 7: [], 8: [{ id: 800, nome: 'Fórum de apresentação', visivel: '1' }], 9: [] };
let proxId = 1000; const log = { posts: [], gets: 0 };
const opts = (n, a, b) => Array.from({ length: b - a + 1 }, (_, i) => `<option value="${a + i}"${a + i === n ? ' selected' : ''}>${a + i}</option>`).join('');
const data = (base, on) => `<input type="checkbox" name="${base}[enabled]" value="1"${on ? ' checked' : ''}>` + [['day', 1, 31, 1], ['month', 1, 12, 1], ['year', 2020, 2035, 2026], ['hour', 0, 23, 0], ['minute', 0, 59, 0]].map(([k, a, b, v]) => `<select name="${base}[${k}]"${on ? '' : ' disabled'}>${opts(v, a, b)}</select>`).join('');
const EXTRA = {
  7: '<div class="fitem"><label for="id_activitytype">Tipo de atividade</label><select id="id_activitytype" name="activitytype" required><option value="" selected>Escolher…</option><option value="2">Formativa</option><option value="5">Somativa</option></select></div>',
  8: '<div class="fitem"><label for="id_fase">Fase</label><select id="id_fase" name="fase"><option value="" selected>Escolher…</option><option value="a">Fase A</option><option value="b">Fase B</option></select>@@ERRO@@</div>', // o servidor cobra, mas o formulário não marca como obrigatório
};
const form = (tipo, curso, sec = '0', erro = false) => `<html><body><div role="main"><h1>Adicionando ${tipo}</h1><form class="mform" id="mform1" method="post" action="/course/modedit.php">
<input type="hidden" name="course" value="${curso}"><input type="hidden" name="section" value="${sec}"><input type="hidden" name="module" value="1"><input type="hidden" name="modulename" value="${tipo}"><input type="hidden" name="add" value="${tipo}"><input type="hidden" name="update" value="0"><input type="hidden" name="return" value="0"><input type="hidden" name="sesskey" value="SKSIM"><input type="hidden" name="_qf__mod_${tipo}_mod_form" value="1">
${tipo === 'label' ? '' : '<input type="text" name="name" value="">'}<textarea name="introeditor[text]"></textarea><input type="hidden" name="introeditor[format]" value="1"><input type="hidden" name="introeditor[itemid]" value="9">
${tipo === 'assign' ? data('allowsubmissionsfromdate', true) + data('duedate', true) + data('gradingduedate', true) + '<input type="checkbox" name="assignsubmission_file_enabled" value="1" checked><select name="assignsubmission_file_maxfiles">' + opts(20, 1, 20) + '</select>' : ''}
${tipo === 'forum' ? '<select name="type"><option value="general" selected>Geral</option><option value="eachuser">Cada pessoa inicia um tópico</option></select>' : ''}
${tipo === 'assign' && EXTRA[curso] ? EXTRA[curso].replace('@@ERRO@@', erro ? '<span class="invalid-feedback" id="id_error_fase">Inserir um valor</span>' : '') : ''}
<select name="visible"><option value="1" selected>Mostrar</option><option value="0">Ocultar</option></select>
<input type="submit" name="submitbutton" value="Salvar e voltar ao curso"></form></div></body></html>`;
const usuario = '<div class="usermenu"><span class="usertext">Tutora Exemplo</span></div>';
const SECOES = { 7: [['Geral'], ['Unidade 1 — Fundamentos'], ['Unidade 2 — Endereçamento IP']], 8: [['Geral'], ['Módulo 1 — Linux'], ['Unidade 2 — Criptografia']] };
const secoesHtml = id => (SECOES[id] ? `<ul class="topics">${SECOES[id].map(([n], i) => `<li class="section main" data-number="${i}" data-sectionname="${n}"></li>`).join('')}</ul>` : '');
const cursoPage = id => `<html><body>${usuario}<div role="main"><h1>${CURSOS[id]}</h1>${secoesHtml(id)}<ul>${acts[id].map(a => `<li class="activity" data-id="${a.id}"><a href="/mod/x/view.php?id=${a.id}"><span class="instancename">${a.nome}</span></a></li>`).join('')}</ul></div></body></html>`;
const meusCursos = `<html><body>${usuario}<div role="main"><h1>Meus cursos</h1>${Object.entries(CURSOS).map(([id, n]) => `<div class="card" data-course-id="${id}"><a class="coursename" href="/course/view.php?id=${id}">${n}</a><div class="categoryname">Téc. Redes · Turma A</div></div>`).join('')}</div></body></html>`;
let falha503 = false;
// DOCX mínimo (ZIP com deflate) montado aqui, para o Chrome real abrir com o DecompressionStream.
function docx(corpoXml) {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const ents = [['word/document.xml', `<?xml version="1.0"?><w:document ${W}><w:body>${corpoXml}</w:body></w:document>`]];
  const partes = []; const central = []; let off = 0;
  for (const [nome, txt] of ents) {
    const raw = Buffer.from(txt); const comp = zlib.deflateRawSync(raw); const n = Buffer.from(nome);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(zlib.crc32(raw) >>> 0, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(n.length, 26);
    partes.push(lh, n, comp);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(zlib.crc32(raw) >>> 0, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, n); off += 30 + n.length + comp.length;
  }
  const cd = Buffer.concat(central); const eo = Buffer.alloc(22); eo.writeUInt32LE(0x06054b50, 0); eo.writeUInt16LE(ents.length, 8); eo.writeUInt16LE(ents.length, 10); eo.writeUInt32LE(cd.length, 12); eo.writeUInt32LE(off, 16);
  return Buffer.concat([...partes, cd, eo]);
}
const wr = t => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`;
const handler = async route => {
  const req = route.request(); const u = new URL(req.url()); if (process.env.DBG) console.log('   >', req.method(), u.pathname + u.search);
  const html = (body, status = 200) => route.fulfill({ status, contentType: 'text/html; charset=utf-8', body });
  if (u.pathname === '/my/') return html(meusCursos);
  if (u.pathname === '/course/view.php') { const id = u.searchParams.get('id'); return CURSOS[id] ? html(cursoPage(id)) : html('', 404); }
  if (u.pathname === '/course/modedit.php') {
    if (req.method() === 'POST') {
      const p = new URLSearchParams(req.postData() || ''); log.posts.push(Object.fromEntries(p));
      const c = p.get('course'); if (c === '9') return html('<div class="errorbox">sem permissão</div>');
      if (falha503 && c === '8') return html('', 503);
      if (p.get('modulename') === 'assign' && c === '7' && !p.get('activitytype')) return html(form('assign', c, p.get('section'), true));
      if (p.get('modulename') === 'assign' && c === '8' && !p.get('fase')) return html(form('assign', c, p.get('section'), true));
      const id = proxId++; acts[c].push({ id, nome: p.get('name') || 'Texto', visivel: p.get('visible') });
      return html(cursoPage(c)); // o Moodle real redireciona; aqui a resposta já é a página do curso
    }
    log.gets += 1;
    if (u.searchParams.get('add')) { const c = u.searchParams.get('course'); if (c === '9') return html('<html><body><div class="errorbox">Você não tem permissão para adicionar aqui.</div></body></html>'); return html(form(u.searchParams.get('add'), c, u.searchParams.get('section') || '0')); }
    if (u.searchParams.get('update')) { const a = Object.values(acts).flat().find(x => String(x.id) === u.searchParams.get('update')); return html(`<html><body><form class="mform"><select name="visible"><option value="1"${a && a.visivel === '1' ? ' selected' : ''}>m</option><option value="0"${a && a.visivel === '0' ? ' selected' : ''}>o</option></select></form></body></html>`); }
  }
  return route.fulfill({ status: 404, body: '' });
};

const EXTC = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-criar-')); fs.cpSync(EXT, EXTC, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'criar-profile-'));
const ctx = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${EXTC}`, `--load-extension=${EXTC}`], viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
try {
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  await ctx.route(`${ORIGIN}/**`, handler);
  const pg = await ctx.newPage(); globalThis.__pg = pg; const erros = []; pg.on('pageerror', e => { erros.push(e.message); console.log('  pageerror:', e.message); });
  await pg.goto(`${ORIGIN}/my/`);
  await pg.waitForSelector('#hub-ead-launcher', { state: 'attached', timeout: 15000 });
  await pg.click('#hub-ead-launcher .tab');
  await pg.click('#hub-ead-launcher .app[data-app="ferramentas"]');
  check('gaveta mostra "Criar conteúdo" disponível em Meus cursos', await pg.evaluate(() => document.querySelector('#hub-ead-launcher').shadowRoot.querySelector('[data-app="criar-conteudo"]').getAttribute('aria-disabled') === 'false'));
  await pg.click('#hub-ead-launcher .app[data-app="criar-conteudo"]');
  await pg.waitForSelector('#hub-cri-host', { state: 'attached', timeout: 15000 });
  const q = s => pg.locator(`#hub-cri-host >> ${s}`);
  check('abrir não consulta nada no Moodle', log.gets === 0 && log.posts.length === 0);
  await pg.screenshot({ path: path.join(SHOTS, 'c1-escolher.png') });
  await q('button.opt:has-text("Atividade de envio")').click();
  await q('button.pri:has-text("Continuar")').click();
  await q('input[aria-label="Nome"]').fill('Atividade 1 — Entrega');
  check('Meus cursos: lista os 3 cursos e o "Ver prévia" começa travado', await q('.list .it').count() === 3 && await q('button.pri:has-text("Ver prévia")').isDisabled());
  await q('.list .cw:nth-child(1) .it input').check(); await q('.list .cw:nth-child(2) .it input').check(); await q('.list .cw:nth-child(3) .it input').check();
  await q('select[data-curso="8"]').waitFor({ timeout: 30000 }); await q('.list .cw:nth-child(3) input[type="number"]').waitFor({ timeout: 30000 });
  check('cada curso mostra as SUAS seções (7 e 8 listas diferentes; 9 sem lista → número manual)', (await q('select[data-curso="7"] option').allTextContents()).some(t => /Endereçamento IP/.test(t)) && (await q('select[data-curso="8"] option').allTextContents()).some(t => /Módulo 1/.test(t)) && !(await q('select[data-curso="7"] option').allTextContents()).some(t => /Módulo 1/.test(t)));
  await q('button.pri:has-text("Ver prévia")').click();
  check('sem escolher a seção, a prévia não abre e diz em quais cursos falta', /Escolha a seção em/.test(await q('.alertap1').textContent()) && log.posts.length === 0);
  await q('input[aria-label="Procurar seção por nome"]').fill('unidade 2');
  check('procurar por nome escolhe a seção certa em cada curso (2 nos dois, nomes diferentes)', await q('select[data-curso="7"]').inputValue() === '2' && await q('select[data-curso="8"]').inputValue() === '2' && /achei/.test(await q('[data-dica="7"]').textContent()));
  await q('.list .cw:nth-child(3) input[type="number"]').fill('0');
  await pg.screenshot({ path: path.join(SHOTS, 'c2-preencher.png') });
  await q('button.pri:has-text("Ver prévia")').click();
  await q('button.pri:has-text("Criar (ocultas)"):not([disabled])').waitFor({ timeout: 30000 });
  await sleep(300);
  const tab = await q('table').last().textContent();
  check('prévia mostra o destino de cada curso (seção e nome)', /Seção 2 · Unidade 2 — Endereçamento IP/.test(tab) && /Seção 2 · Unidade 2 — Criptografia/.test(tab));
  check('prévia (só leitura, sem POST): curso 7 "Será criada", 9 "Sem permissão" e envio ocultos', log.posts.length === 0 && /Segurança em Redes[^]{0,90}Será criada/.test(tab) && /Administração de Servidores[^]{0,60}Sem permissão/.test(tab), tab.slice(0, 600));
  await pg.screenshot({ path: path.join(SHOTS, 'c3-previa.png') });
  check('campo que o Moodle exige (marcado) aparece na prévia com as opções reais; o curso fica "Falta escolher" e só o 8 pode ser criado', /Redes de Computadores[^]{0,120}Falta escolher/.test(tab) && (await q('select[aria-label="Tipo de atividade"] option').allTextContents()).join('|').includes('Somativa') && await q('button.pri:has-text("Criar (ocultas) — 1")').count() === 1, tab.slice(0, 400));
  await pg.screenshot({ path: path.join(SHOTS, 'c3b-obrigatorio.png') });
  await q('select[aria-label="Tipo de atividade"]').selectOption('5');
  await q('button.pri:has-text("Criar (ocultas) — 2"):not([disabled])').waitFor({ timeout: 30000 });
  check('escolher o tipo libera o curso 7 (reconferido, ainda sem POST)', log.posts.length === 0);
  await q('button.pri:has-text("Criar (ocultas)")').click();
  await q('button:has-text("Tentar de novo neste curso")').waitFor({ timeout: 60000 });
  await pg.screenshot({ path: path.join(SHOTS, 'c4a-recusado.png') });
  check('Moodle recusou o campo "Fase" no curso 8: a tela mostra o nome do campo e as opções', /Fase \(fase\): Inserir um valor/.test(await q('table').last().textContent()) && (await q('select[aria-label="Fase"] option').allTextContents()).join('|').includes('Fase A') && log.posts.length === 2);
  await q('select[aria-label="Fase"]').selectOption('a');
  await q('button:has-text("Tentar de novo neste curso")').click();
  await q('button:has-text("Tentar de novo neste curso")').waitFor({ state: 'detached', timeout: 60000 });
  await q('button:has-text("Fechar")').waitFor({ timeout: 30000 });
  await pg.screenshot({ path: path.join(SHOTS, 'c4-resultado.png') });
  const res = await q('table').last().textContent();
  check('criou nos cursos 7 e 8 (o 9 não tem permissão), tudo oculto e conferido', log.posts.length === 3 && log.posts[0].course === '7' && log.posts[0].activitytype === '5' && log.posts[1].course === '8' && !log.posts[1].fase && log.posts[2].course === '8' && log.posts[2].fase === 'a' && log.posts.every(p => p.visible === '0') && log.posts[0].section === '2' && log.posts[2].section === '2' && log.posts[0].sesskey === 'SKSIM' && /Redes de Computadores\s*Criada \(oculta\)/.test(res) && /Segurança em Redes\s*Criada \(oculta\)/.test(res) && /Administração de Servidores\s*Não criada/.test(res) && acts[7].length === 1 && acts[7][0].visivel === '0', res.slice(0, 500) + ' | ' + JSON.stringify(log.posts));
  check('o texto foi com tutor, abertura e prazo preenchidos, e as datas do envio', /Tutora Exemplo/.test(log.posts[0]['introeditor[text]']) && /11\/11\/2026 08:00/.test(log.posts[0]['introeditor[text]']) && /Prazo de entrega/.test(log.posts[0]['introeditor[text]']) && log.posts[0]['duedate[enabled]'] === '1', log.posts[0]['introeditor[text]']);
  check('sem erro de script na página', erros.length === 0, erros.join(';'));
  await q('button:has-text("Fechar")').click();

  // ---- Fórum no curso 8 (já existe) e texto no 7, a partir da página do curso ----
  await pg.goto(`${ORIGIN}/course/view.php?id=8`);
  await pg.waitForSelector('#hub-ead-launcher', { state: 'attached' });
  await pg.click('#hub-ead-launcher .tab'); await pg.click('#hub-ead-launcher .app[data-app="ferramentas"]'); await pg.click('#hub-ead-launcher .app[data-app="criar-conteudo"]');
  await pg.waitForSelector('#hub-cri-host', { state: 'attached' });
  await q('button.pri:has-text("Continuar")').click();
  await q('select[data-curso="8"]').waitFor({ timeout: 30000 }); await q('select[data-curso="8"]').selectOption('2');
  check('na página do curso, o curso atual já vem marcado', await q('.list .it input:checked').count() === 1);
  await q('button.pri:has-text("Ver prévia")').click();
  await q('button:has-text("Voltar")').waitFor({ timeout: 30000 }); await sleep(300);
  check('fórum com o mesmo nome: "Já existe: será pulada" e o botão Criar fica travado', /Já existe/.test(await q('table').last().textContent()) && await q('button.pri:has-text("Criar")').isDisabled() && log.posts.length === 3);
  await q('button:has-text("Voltar")').click();
  await q('button:has-text("Voltar")').click();
  await q('button.opt:has-text("Texto de boas-vindas")').click();
  await q('button.pri:has-text("Continuar")').click();
  const MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  await q('input[type="file"]').setInputFiles({ name: 'Boas-vindas.docx', mimeType: MIME, buffer: docx(`<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${wr('Bem-vindo(a) à UC')}</w:p><w:p>${wr('Olá, {{uc}}! Sala: {{link_sala}}')}</w:p>`) });
  await q('.msg.in:has-text("Lido: Boas-vindas.docx")').waitFor({ timeout: 15000 });
  check('DOCX importado no Chrome real: texto com título e campos viram o texto da atividade', /<h2>Bem-vindo\(a\) à UC<\/h2>/.test(await q('textarea').inputValue()) && /\{\{uc\}\}/.test(await q('textarea').inputValue()));
  await q('input[type="file"]').setInputFiles({ name: 'Regras.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  check('PDF: mensagem clara de que ainda não é suportado (e nada é lido)', /PDF ainda não/.test(await q('.msg.in').textContent()));
  await q('textarea').fill('<p>Olá, {{uc}}! Sala: {{link_sala}}</p><script>alert(1)</script>');
  await q('button.pri:has-text("Ver prévia")').click();
  check('campo {{link_sala}} sem valor trava a prévia com aviso claro', /link_sala/.test(await q('.alertap1').textContent()));
  await q('input[aria-label="Valor de link_sala"]').fill('https://sala.exemplo/abc');
  await q('button.pri:has-text("Ver prévia")').click();
  await q('button.pri:has-text("Criar (ocultas)"):not([disabled])').waitFor({ timeout: 30000 }); await sleep(200);
  check('prévia do texto não tem script (limpo)', !(await q('.view').innerHTML()).includes('<script'));
  await pg.screenshot({ path: path.join(SHOTS, 'c5-boas-previa.png') });
  await q('button.pri:has-text("Criar (ocultas)")').click();
  await q('button:has-text("Fechar")').waitFor({ timeout: 40000 });
  const ult = log.posts[log.posts.length - 1];
  check('texto de boas-vindas criado oculto, sem script, com a sala preenchida', ult.course === '8' && ult.visible === '0' && !/script/i.test(ult['introeditor[text]']) && /sala\.exemplo/.test(ult['introeditor[text]']) && !('name' in ult && ult.name === undefined));
  await q('button:has-text("Fechar")').click();

  // ---- Moodle falha (503): vira "Falhou" e não conta como criada ----
  falha503 = true; acts[8] = [];
  await pg.click('#hub-ead-launcher .tab'); await pg.click('#hub-ead-launcher .app[data-app="ferramentas"]'); await pg.click('#hub-ead-launcher .app[data-app="criar-conteudo"]');
  await pg.waitForSelector('#hub-cri-host', { state: 'attached' });
  await q('button.opt:has-text("Fórum de apresentação")').click();
  await q('button.pri:has-text("Continuar")').click(); await q('select[data-curso="8"]').waitFor({ timeout: 30000 }); await q('select[data-curso="8"]').selectOption('2'); await q('button.pri:has-text("Ver prévia")').click();
  await q('button.pri:has-text("Criar (ocultas)"):not([disabled])').waitFor({ timeout: 30000 });
  await q('button.pri:has-text("Criar (ocultas)")').click();
  await q('button:has-text("Fechar")').waitFor({ timeout: 40000 });
  check('503 do Moodle aparece como "Falhou" e não como criada', /Falhou/.test(await q('table').last().textContent()) && /com erro/.test(await q('.msg').last().textContent()));
  await pg.screenshot({ path: path.join(SHOTS, 'c6-falha.png') });
  check('nenhum erro de script em toda a sessão', erros.length === 0, erros.join(';'));
} catch (e) { console.log(' ERRO ', e && e.message ? e.message.split('\n')[0] : e); try { await globalThis.__pg.screenshot({ path: path.join(SHOTS, 'erro.png') }); console.log((await globalThis.__pg.evaluate(() => { const h = document.getElementById('hub-cri-host'); return h && h.shadowRoot ? h.shadowRoot.textContent.slice(-700) : 'sem host'; }))); } catch (_) {} results.push({ name: 'o teste rodou até o fim', ok: false }); } finally { await ctx.close(); }
const ok = results.filter(r => r.ok).length;
console.log(`\n${ok}/${results.length} verificações passaram. Prints: ${SHOTS}`);
process.exit(ok === results.length ? 0 : 1);

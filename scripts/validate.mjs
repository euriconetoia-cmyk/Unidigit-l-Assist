// Valida a pasta dist/ext: manifesto, permissões permitidas, arquivos existentes e padrões proibidos.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ext = path.join(root, 'dist', 'ext');
const errors = [];
const fail = m => errors.push(m);
const read = f => fs.readFileSync(path.join(ext, f), 'utf8');

if (!fs.existsSync(path.join(ext, 'manifest.json'))) { console.error('✗ rode "npm run build" antes'); process.exit(1); }
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

// O Chrome recusa arquivo que não seja UTF-8 válido (ex.: caracteres "não-caractere" como U+FFFE) — já aconteceu uma vez.
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
for (const f of walk(ext).filter(x => /\.(js|json|css|html)$/.test(x))) {
  try { const t = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(f)); if (/[\uFFFE\uFFFF]/.test(t)) fail(`caractere inválido (U+FFFE/FFFF) em ${path.relative(ext, f)}`); } catch (_) { fail(`arquivo não é UTF-8 válido: ${path.relative(ext, f)}`); }
}
// ID fixo da extensão: a "key" mantém o mesmo ID ao mudar de pasta (os dados guardados continuam). Para a loja, o pacote sai sem "key".
if (!manifest.key) fail('manifest.key ausente (ID fixo da extensão)');
else {
  const id = [...crypto.createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0, 32)].map(c => String.fromCharCode(97 + parseInt(c, 16))).join('');
  const idFile = path.join(root, 'docs/projeto/ID_DA_EXTENSAO.txt');
  if (fs.existsSync(idFile) && fs.readFileSync(idFile, 'utf8').trim() !== id) fail(`o ID derivado da key (${id}) difere de docs/projeto/ID_DA_EXTENSAO.txt`);
}
if (manifest.manifest_version !== 3) fail('manifest_version deve ser 3');
if (manifest.version !== pkg.version) fail(`versão do manifest (${manifest.version}) difere do package.json (${pkg.version})`);
const withBlocos = Boolean(manifest.side_panel);
const ALLOWED_PERMS = ['scripting', 'storage', 'downloads', ...(withBlocos ? ['sidePanel'] : [])];
for (const p of manifest.permissions || []) if (!ALLOWED_PERMS.includes(p)) fail(`permissão não autorizada: ${p}`);
const ALLOWED_HOSTS = ['https://ead.senai.br/*', 'https://ead.fieg.com.br/*'];
for (const h of manifest.host_permissions || []) if (!ALLOWED_HOSTS.includes(h)) fail(`host não autorizado: ${h}`);
if (manifest.externally_connectable) fail('externally_connectable é proibido');
for (const f of [...Object.values(manifest.icons || {}), ...Object.values((manifest.action || {}).default_icon || {})]) if (!fs.existsSync(path.join(ext, f))) fail(`ícone ausente: ${f}`);
const cs = manifest.content_scripts || [];
if (cs.length !== 1 || JSON.stringify(cs[0].js) !== JSON.stringify(['launcher.js']) || JSON.stringify(cs[0].matches) !== JSON.stringify(ALLOWED_HOSTS)) fail('content_scripts deve ter só o launcher.js, nos dois hosts do Moodle; os módulos entram por injeção sob demanda');
if (cs[0] && cs[0].all_frames) fail('o launcher não pode rodar em subframes');
if (manifest.optional_permissions && manifest.optional_permissions.length) fail('optional_permissions precisa de decisão registrada');
// Única exceção registrada (rules.md, 0.14.0): o Kahoot, como permissão de site OPCIONAL pedida no clique, sem content script lá.
if (JSON.stringify(manifest.optional_host_permissions || []) !== JSON.stringify(['https://create.kahoot.it/*'])) fail('optional_host_permissions deve ser exatamente ["https://create.kahoot.it/*"] (decisão de 31/10/2026)');
if (manifest.content_security_policy) fail('não altere a CSP padrão (sem unsafe-eval)');

for (const f of [manifest.background && manifest.background.service_worker, 'launcher.js', ...(withBlocos ? [manifest.side_panel.default_path, 'sidepanel.js', 'sidepanel.css', 'media/sprites.svg'] : [])]) {
  if (!f || !fs.existsSync(path.join(ext, f))) fail(`arquivo ausente: ${f}`);
}
const files = JSON.parse(read('modules/importar-notas/vendor/files.json'));
for (const f of [...files.scripts, ...files.css]) if (!fs.existsSync(path.join(ext, 'modules/importar-notas/vendor', f))) fail(`arquivo do módulo ausente: ${f}`);
if (!fs.existsSync(path.join(ext, 'modules/importar-notas/bridge.js'))) fail('bridge.js ausente');
if (!fs.existsSync(path.join(ext, 'modules/importar-notas/regua.js'))) fail('regua.js ausente (régua de nota, 0.16.0)');
// O painel vendorizado leva 2 trechos locais da régua; um "npm run sync" que os apague tem de falhar aqui.
if ((read('modules/importar-notas/vendor/src/ui/panel.js').match(/HUB-PATCH regua/g) || []).length !== 2) fail('panel.js perdeu o patch da régua (HUB-PATCH regua x2). Reaplique depois do sync.');

const alunos = JSON.parse(read('modules/alunos/files.json'));
const datas = JSON.parse(read('modules/datas/files.json'));
for (const f of [...datas.scripts, 'bridge.js']) if (!fs.existsSync(path.join(ext, 'modules/datas', f))) fail(`arquivo do módulo datas ausente: ${f}`);
for (const f of [...alunos.scripts, 'bridge.js']) if (!fs.existsSync(path.join(ext, 'modules/alunos', f))) fail(`arquivo do módulo alunos ausente: ${f}`);
if (fs.existsSync(path.join(ext, 'modules/alunos/vendor/origem.json'))) {
  const o = JSON.parse(read('modules/alunos/vendor/origem.json'));
  if (!o.versao) fail('origem.json do módulo alunos sem versão');
}

const kahoot = JSON.parse(read('modules/kahoot/files.json'));
for (const f of [...kahoot.scripts, 'bridge.js']) if (!fs.existsSync(path.join(ext, 'modules/kahoot', f))) fail(`arquivo do módulo kahoot ausente: ${f}`);
for (const f of ['kahoot.html', 'kahoot.js']) if (!fs.existsSync(path.join(ext, f))) fail(`arquivo ausente: ${f}`);
if (/<script(?![^>]*\bsrc=["'][a-z.]+["'])[^>]*>[\s\S]*?<\/script>/i.test(read('kahoot.html')) || /<script[^>]*src=["']https?:/i.test(read('kahoot.html'))) fail('kahoot.html: só script local por arquivo (sem inline nem remoto)');
if (/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(kahoot.scripts.map(f => read(`modules/kahoot/${f}`)).join('\n'))) fail('o módulo kahoot não pode usar rede');
const nov = read('modules/alunos/novidades.js');
if (!new RegExp(`versao: '${manifest.version.replace(/\./g, '\\.')}'`).test(nov)) fail(`novidades.js: a primeira entrada deve ser a versão ${manifest.version}`);

const BANNED = [[/\beval\s*\(/, 'eval('], [/new\s+Function\s*\(/, 'new Function('], [/document\.write\s*\(/, 'document.write('], [/\bsetTimeout\s*\(\s*['"`]/, 'setTimeout(string)'], [/\balert\s*\(|\bconfirm\s*\(|\bprompt\s*\(/, 'alert/confirm/prompt'], [/https?:\/\/(?!ead\.senai\.br|ead\.fieg\.com\.br|www\.w3\.org|github\.com\/google\/blockly)[^"'\s)]+\.js/, 'script remoto']];
const NO_NETWORK = /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/;
if (NO_NETWORK.test(read('launcher.js'))) fail('launcher.js não pode consultar nada (só desenha o botão)');
for (const file of ['launcher.js', 'background.js', 'modules/importar-notas/bridge.js', ...files.scripts.map(f => `modules/importar-notas/vendor/${f}`), 'modules/alunos/bridge.js', ...alunos.scripts.map(f => `modules/alunos/${f}`), 'modules/datas/bridge.js', ...datas.scripts.map(f => `modules/datas/${f}`), 'modules/kahoot/bridge.js', ...kahoot.scripts.map(f => `modules/kahoot/${f}`), 'kahoot.js']) {
  const text = read(file);
  for (const [re, label] of BANNED) if (re.test(text)) fail(`${file}: padrão proibido ${label}`);
}
// o bundle do Blockly pode conter strings de biblioteca; confere só o que é nosso e a CSP via ausência de unsafe-eval no manifest
for (const f of withBlocos ? ['sidepanel.html'] : []) if (/<script[^>]*src=["']https?:/i.test(read(f))) fail(`${f}: script remoto`);

if (errors.length) { console.error('✗ validação falhou:\n' + errors.map(e => ` - ${e}`).join('\n')); process.exit(1); }
const count = (dir => { let n = 0; const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => (e.isDirectory() ? walk(path.join(d, e.name)) : (n += 1))); walk(dir); return n; })(ext);
console.log(`✓ extensão válida (${count} arquivos, versão ${manifest.version})`);

// Valida a pasta dist/ext: manifesto, permissões permitidas, arquivos existentes e padrões proibidos.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ext = path.join(root, 'dist', 'ext');
const errors = [];
const fail = m => errors.push(m);
const read = f => fs.readFileSync(path.join(ext, f), 'utf8');

if (!fs.existsSync(path.join(ext, 'manifest.json'))) { console.error('✗ rode "npm run build" antes'); process.exit(1); }
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

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
if (manifest.content_security_policy) fail('não altere a CSP padrão (sem unsafe-eval)');

for (const f of [manifest.background && manifest.background.service_worker, 'launcher.js', ...(withBlocos ? [manifest.side_panel.default_path, 'sidepanel.js', 'sidepanel.css', 'media/sprites.svg'] : [])]) {
  if (!f || !fs.existsSync(path.join(ext, f))) fail(`arquivo ausente: ${f}`);
}
const files = JSON.parse(read('modules/importar-notas/vendor/files.json'));
for (const f of [...files.scripts, ...files.css]) if (!fs.existsSync(path.join(ext, 'modules/importar-notas/vendor', f))) fail(`arquivo do módulo ausente: ${f}`);
if (!fs.existsSync(path.join(ext, 'modules/importar-notas/bridge.js'))) fail('bridge.js ausente');

const alunos = JSON.parse(read('modules/alunos/files.json'));
for (const f of [...alunos.scripts, 'bridge.js']) if (!fs.existsSync(path.join(ext, 'modules/alunos', f))) fail(`arquivo do módulo alunos ausente: ${f}`);
if (fs.existsSync(path.join(ext, 'modules/alunos/vendor/origem.json'))) {
  const o = JSON.parse(read('modules/alunos/vendor/origem.json'));
  if (!o.versao) fail('origem.json do módulo alunos sem versão');
}

const BANNED = [[/\beval\s*\(/, 'eval('], [/new\s+Function\s*\(/, 'new Function('], [/document\.write\s*\(/, 'document.write('], [/\bsetTimeout\s*\(\s*['"`]/, 'setTimeout(string)'], [/\balert\s*\(|\bconfirm\s*\(|\bprompt\s*\(/, 'alert/confirm/prompt'], [/https?:\/\/(?!ead\.senai\.br|ead\.fieg\.com\.br|www\.w3\.org|github\.com\/google\/blockly)[^"'\s)]+\.js/, 'script remoto']];
const NO_NETWORK = /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/;
if (NO_NETWORK.test(read('launcher.js'))) fail('launcher.js não pode consultar nada (só desenha o botão)');
for (const file of ['launcher.js', 'background.js', 'modules/importar-notas/bridge.js', ...files.scripts.map(f => `modules/importar-notas/vendor/${f}`), 'modules/alunos/bridge.js', ...alunos.scripts.map(f => `modules/alunos/${f}`)]) {
  const text = read(file);
  for (const [re, label] of BANNED) if (re.test(text)) fail(`${file}: padrão proibido ${label}`);
}
// o bundle do Blockly pode conter strings de biblioteca; confere só o que é nosso e a CSP via ausência de unsafe-eval no manifest
for (const f of withBlocos ? ['sidepanel.html'] : []) if (/<script[^>]*src=["']https?:/i.test(read(f))) fail(`${f}: script remoto`);

if (errors.length) { console.error('✗ validação falhou:\n' + errors.map(e => ` - ${e}`).join('\n')); process.exit(1); }
const count = (dir => { let n = 0; const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => (e.isDirectory() ? walk(path.join(d, e.name)) : (n += 1))); walk(dir); return n; })(ext);
console.log(`✓ extensão válida (${count} arquivos, versão ${manifest.version})`);

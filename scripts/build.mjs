// Monta a pasta da extensão em dist/ext. Padrão: botão lateral + módulos. `--with-blocos` inclui o painel de blocos (opcional, futuro).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist', 'ext');
const withBlocos = process.argv.includes('--with-blocos');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
if (!fs.existsSync(path.join(root, 'src/modules/importar-notas/vendor/files.json'))) throw new Error('Rode "npm run sync" antes do build.');

const common = { bundle: true, format: 'iife', target: 'chrome108', minify: false, legalComments: 'none', logLevel: 'warning' };
await build({ ...common, entryPoints: [path.join(root, 'src/launcher/launcher.js')], outfile: path.join(out, 'launcher.js') });
await build({ ...common, entryPoints: [path.join(root, 'src/background.js')], outfile: path.join(out, 'background.js') });

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
if (withBlocos) {
  await build({ ...common, minify: true, target: 'chrome114', entryPoints: [path.join(root, 'src/sidepanel/main.js')], outfile: path.join(out, 'sidepanel.js') });
  for (const f of ['sidepanel.html', 'sidepanel.css']) fs.copyFileSync(path.join(root, f), path.join(out, f));
  fs.cpSync(path.join(root, 'node_modules/blockly/media'), path.join(out, 'media'), { recursive: true, filter: s => !/\.map$/.test(s) });
  manifest.permissions.push('sidePanel');
  manifest.side_panel = { default_path: 'sidepanel.html' };
  manifest.minimum_chrome_version = '114';
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
if (fs.existsSync(path.join(root, 'icons'))) fs.cpSync(path.join(root, 'icons'), path.join(out, 'icons'), { recursive: true, filter: s => !/\.svg$/.test(s) });
fs.cpSync(path.join(root, 'src/modules'), path.join(out, 'modules'), { recursive: true });
for (const f of ['README.md', 'CHANGELOG.md', 'CREDITOS.md', 'PRIVACIDADE.md']) if (fs.existsSync(path.join(root, f))) fs.copyFileSync(path.join(root, f), path.join(out, f));
console.log(`✓ extensão montada em dist/ext${withBlocos ? ' (com painel de blocos)' : ''}`);

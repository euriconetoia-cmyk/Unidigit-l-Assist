// Copia o código do projeto importar-notas para dentro deste módulo (sem o ponto de entrada automático).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const source = path.resolve(process.argv[2] || path.join(root, '..', 'importar-notas'));
const target = path.join(root, 'src', 'modules', 'importar-notas', 'vendor');

const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
const radar = manifest.content_scripts.find(c => c.js.some(f => f.endsWith('radar-main.js')));
if (!radar) throw new Error('Não achei o bloco do radar no manifest do importar-notas.');
// Telas do Importar Notas: radar (curso/categoria) + painel da tela de avaliação da atividade (assign/view.php).
const assign = manifest.content_scripts.find(c => c.js.some(f => f.endsWith('content-main.js')));
if (!assign) throw new Error('Não achei o bloco da tela de avaliação no manifest do importar-notas.');
const scripts = radar.js.filter(f => !f.endsWith('radar-main.js'));
for (const f of assign.js) if (!f.endsWith('content-main.js') && !scripts.includes(f)) scripts.push(f);
const css = radar.css || [];

fs.rmSync(target, { recursive: true, force: true });
for (const file of [...scripts, ...css, 'src/background.js']) {
  const to = path.join(target, file);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(path.join(source, file), to);
}
fs.copyFileSync(path.join(source, 'src', 'background.js'), path.join(target, 'background.js'));
fs.rmSync(path.join(target, 'src', 'background.js'));
fs.writeFileSync(path.join(target, 'files.json'), JSON.stringify({ fromVersion: manifest.version, scripts, css }, null, 2));
console.log(`✓ importar-notas ${manifest.version} copiado (${scripts.length} scripts, ${css.length} css) → ${path.relative(root, target)}`);

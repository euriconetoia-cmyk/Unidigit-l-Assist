// Copia do projeto assistente-ead-senai só o que o módulo "Alunos e notas" reaproveita: leitura de
// participantes/livro de notas (adapters.js) e as funções de apoio que ele usa. Nada de UI nem de gravação.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.argv[2] || path.join(root, '..', 'assistente-ead-senai'));
const target = path.join(root, 'src', 'modules', 'alunos', 'vendor');
const FILES = ['content/shared-validation.js', 'content/utils.js', 'content/adapters.js'];
const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
for (const f of FILES) fs.copyFileSync(path.join(source, f), path.join(target, path.basename(f)));
fs.writeFileSync(path.join(target, 'origem.json'), JSON.stringify({ projeto: 'assistente-ead-senai', versao: manifest.version, arquivos: FILES }, null, 2));
console.log(`✓ assistente-ead-senai ${manifest.version} copiado (${FILES.length} arquivos) → ${path.relative(root, target)}`);

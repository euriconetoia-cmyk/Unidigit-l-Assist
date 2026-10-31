// Gera icons/icon-{16,32,48,128}.png a partir de icons/icon.svg (precisa de Playwright global).
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const svg = fs.readFileSync(path.join(root, 'icons/icon.svg'), 'utf8');
const browser = await chromium.launch();
for (const n of [16, 32, 48, 128]) {
  const page = await browser.newPage({ viewport: { width: n, height: n } });
  await page.setContent(`<body style="margin:0;background:transparent"><div style="width:${n}px;height:${n}px">${svg.replace('<svg ', `<svg width="${n}" height="${n}" `)}</div></body>`);
  await page.screenshot({ path: path.join(root, `icons/icon-${n}.png`), omitBackground: true });
  await page.close();
}
await browser.close();
console.log('✓ ícones gerados');

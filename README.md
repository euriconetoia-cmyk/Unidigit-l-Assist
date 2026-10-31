# Ferramentas EaD SENAI

Extensão do Chrome (Manifest V3, Chrome 114+) para montar, **com blocos**, o que as ferramentas EaD devem fazer no Moodle (SENAI e FIEG) e executar só quando você clicar.

## Usar
1. Abra qualquer página do Moodle (SENAI ou FIEG): o botão **FERRAMENTAS** fica na lateral direita.
2. Clique nele e escolha: **Pendências** (abre a barra do radar; clique na lupa para buscar), **Correção** (lançamento de notas por CSV), **Acompanhamento**, **Alunos e notas** ou **Relatório da UC** (painel só de leitura; clique em **Ler** para buscar os dados do curso). Automação por blocos está "em breve".
3. Pendências e Correção funcionam em páginas de **curso** ou de **categoria**; o painel de alunos e notas, em qualquer página que tenha o número do curso no endereço. O que exige confirmação (baixar, lançar notas) continua pedindo na página.
4. Se a extensão **Importar Notas** original estiver ativa, desative-a: as duas desenhariam a mesma barra.

## Instalar
1. `npm install && npm run sync && npm run build`
2. Chrome → `chrome://extensions` → Modo do desenvolvedor → **Carregar sem compactação** → pasta `dist/ext` (ou use o ZIP de `npm run package`, extraído). Painel de blocos opcional: `npm run build:blocos`.

## Desenvolver
- `npm test` (executor e ações) · `npm run validate` · `npm run test:e2e` (Chromium + Moodle simulado; precisa de Playwright global).
- `npm run sync` copia o código do `importar-notas` (módulo Importar Notas) e as funções de leitura do `assistente-ead-senai` (módulo Alunos e notas: `adapters.js`, `utils.js`, `shared-validation.js`) para `vendor/`.
- Contexto do projeto: `docs/contexto/`.

Créditos em `CREDITOS.md`; privacidade em `PRIVACIDADE.md`.

# Arquitetura — Blocos EaD SENAI

Manifest V3, JavaScript em módulos ES, empacotado com esbuild (devDependency) porque o Blockly precisa de bundle. Blockly 13 (Apache-2.0) vem do npm e entra no pacote; nada é carregado da internet.

| Parte | Onde | Papel |
|---|---|---|
| Service worker | `src/background.js` | Abre o painel ao clicar no ícone; nomeia downloads dos módulos (`importScripts` do módulo). |
| Painel lateral | `src/sidepanel/` (inclui `sidepanel.html` e `sidepanel.css`) | Editor Blockly, barra (Executar, Parar, Exemplos, Salvar/Carregar), registro. |
| Blocos | `src/blocks/` | Definições (JSON) e caixa de ferramentas. |
| Executor | `src/engine/interpreter.js` | **Sem DOM e sem Blockly.** Percorre o JSON de `Blockly.serialization.workspaces.save` e chama as ações. Sem `eval`/`Function` (CSP do MV3). |
| Módulos | `src/modules/<nome>/` | Cada módulo: lista de scripts a injetar, CSS, ponte `HUB` e ações. |

## Execução
Executar → o painel lê o workspace → interpretador percorre os blocos → uma ação de módulo → `ensureInjected(tab, módulo)` (injeta scripts e CSS **na primeira vez**, com `chrome.scripting`) → `executeScript({func})` chama `globalThis.HUB.run(comando, args)` na página → resultado volta ao interpretador (ex.: total de pendências).

A aba alvo é a **aba ativa da janela** (ou `?tab=<id>` na URL do painel, só para testes). Páginas fora do Moodle permitido não recebem nada.

## Módulo Importar Notas
`scripts/sync-importar-notas.mjs` **copia** o `src` do projeto `importar-notas` para `src/modules/importar-notas/src` (sem o ponto de entrada automático `radar-main.js`) e grava a versão copiada. `bridge.js` (`HUB`) cria a barra do radar da página (se ainda não existe) e expõe: `radar.buscar`, `radar.baixar`, `lote.abrir`, `pagina.info`. O service worker do módulo (`background.js` copiado) nomeia os ZIPs.

## Testes
`node --test tests/*.test.js` (interpretador, registro de módulos). `npm run validate` confere manifesto, permissões, arquivos e padrões proibidos. `npm run test:e2e` (Playwright + Chromium, painel aberto como aba, Moodle simulado).

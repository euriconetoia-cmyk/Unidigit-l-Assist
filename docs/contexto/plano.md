# Plano de ação — versões 0.11 a 1.0

Decisões de base (ver `memory.md`): Julio Alves coautor; armazenamento só em `chrome.storage.local` (resumos compactos, validade, limite com aviso; sem `unlimitedStorage` nem `storage.sync`); atualização pelo "Caminho 2" agora e loja do Edge (gratuita, "Hidden", revisão até 7 dias úteis) depois da homologação; Drive PDF descartado; Kahoot com permissão opcional pedida no clique.

Regras de cada etapa (valem para todas): ler `docs/contexto/*` antes; **mockup aprovado antes do código**; uma etapa por vez; `npm test` + `npm run build` + `npm run validate` + `npm run test:e2e` verdes; CHANGELOG, `task.md` e `memory.md` atualizados; release `vX.Y.Z` com o ZIP; nada de dado de aluno fora do navegador; nenhum host/permissão novo sem decisão registrada.

| Versão | Entrega | Depende de | Mockup |
|---|---|---|---|
| **0.11.0** | **Excel (.xlsx)**: gerador sem dependências (crédito Julio Alves) + botões "Excel" em Notas, Relatório da UC, Acompanhamento e lista de contatos | — | `relatorio-turma-xlsx` ✔ |
| **0.12.0** | **Relatório da turma** em "Meus cursos" (`/my/`): seleção de UCs, leitura com cancelar, abas por turma + aba Situação (faixas das configurações) | 0.11 | `relatorio-turma-xlsx` ✔ |
| **0.13.0** | **Fundação**: relatório de compatibilidade (diagnóstico sem dado de aluno) · tela **Sobre** (versão, novidades, ver versão nova) · **Meus dados** (uso por categoria, backup exportar/importar, apagar, expiração) · `key` fixa no manifest · camada de armazenamento com versão de formato e migração | — | a fazer |
| **0.14.0** | Gaveta **Ferramentas** no menu + **Kahoot** (permissão opcional do site no clique, validação do CSV, progresso, cancelar) + modelo CSV | 0.13 | `ferramentas-kahoot` ✔ |
| **0.15.0** | **Modelos de mensagem** (campos nome/UC), **retornos agendados** ("Retornos de hoje"), **comparativo entre leituras** (instantâneos compactos) | 0.13 | a fazer |
| **0.16.0** | **Resumo do dia** (tela inicial do curso) + **Ajustes** (nota mínima/recuperação/pausa por UC) + **régua de nota** configurável na Correção | 0.15 | feito (local) |
| **1.0.0** | Homologado em Moodle real (SENAI e FIEG) + política de privacidade pública | tudo | — (loja do Edge adiada) |

## Pontos de parada (homologação em Moodle real)
- **Após 0.13.0**: você instala, roda o relatório de compatibilidade nas páginas reais (curso, atividade, "Meus cursos", livro de notas) e me manda o resultado. Corrijo seletores antes de seguir. Se aparecer algo grave, as etapas seguintes esperam.
- **Após 0.16.0**: rodada final de testes reais → 1.0.0.

## Detalhe técnico por etapa
**0.11.0** — `core/xlsx.js` (ZIP + XML, células de texto/número, cabeçalho azul, linha fixa, filtro, nomes de aba únicos até 31 caracteres, escape de XML); testes: abrir o arquivo gerado e reler (jsdom/zip), nomes inválidos, "—" = célula vazia (nunca 0), e abrir no LibreOffice no e2e (se disponível) como verificação extra. Botões ao lado do CSV; CSV continua.
**0.12.0** — comando `relatorio.turma` em `apps.js` (`paginas:['meus-cursos']`, novo `tipoDaPagina`); injeção sob demanda; seleção nos cartões (`data-course-id`); leitura do livro de notas por UC (reaproveita `reader.js`) com paginação, cancelar e falha parcial; exclui curso não iniciado pela vigência; faixas vindas dos ajustes.
**0.13.0** — `storage.js` único (get/set em lote, `schemaVersion`, migrações, medição com `getBytesInUse`, aviso a 70%, poda por validade); `diagnostico.js` (só nomes de seletores achados/ausentes, contagens e versão do Moodle, sem texto de aluno); `Sobre` e `Meus dados` como telas do hub.
**0.14.0** — `optional_host_permissions: ["https://create.kahoot.it/*"]`; `chrome.permissions.request` a partir do clique; injeção por `scripting.executeScript` (sem content script novo); parser de CSV com `;` ou `,`, aliases de colunas, validação linha a linha; preenchimento com espera por elemento, parada que diz pergunta e campo; Kahoot simulado no e2e. Registrar em `rules.md`/`memory.md` a exceção do host opcional **antes** do código.
**0.15.0** — modelos com variáveis; registro de contato guarda `modelo + edição` em vez do texto inteiro; retornos (`aluno, data, nota`) com lista do dia; instantâneo por UC por leitura (só números), últimas 12 leituras.
**0.16.0** — Resumo do dia agrega o que já existe (pendências, risco, sem acesso, retornos); Ajustes por UC; régua configurável na Correção com pré-visualização do efeito nas notas antes de aplicar.

## Riscos e como tratamos
| Risco | Resposta |
|---|---|
| Seletores do Moodle real diferem do simulado | Relatório de compatibilidade (0.13) + ponto de parada com testes reais |
| Kahoot muda a tela | Seletores isolados em um arquivo, parada com mensagem clara, teste simulado |
| Dados guardados crescem | Só resumos, validade, limite com aviso, "Meus dados" |
| Perder dados ao reinstalar/trocar de pasta | `key` fixa + backup exportar/importar + migração entre formatos |
| Revisão da loja demora (até 7 dias úteis) | Só depois da 1.0.0; correções urgentes continuam por ZIP |
| Mexer em várias frentes ao mesmo tempo | Uma etapa por vez, mockup aprovado, versão testável a cada passo |

## Como acompanhamos
`task.md` guarda a lista por versão (marcada ao concluir); `memory.md` guarda as decisões; cada versão tem release no GitHub com o ZIP e o CHANGELOG.

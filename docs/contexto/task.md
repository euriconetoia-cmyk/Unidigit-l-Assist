# Task — Blocos EaD SENAI

Trabalhar uma por vez, na ordem. Decisões importantes vão para `memory.md`.

## Versão 0.1.0
- [x] E1. Estrutura: manifest, painel lateral, build com esbuild, Blockly em pt-BR, docs.
- [x] E2. Executor (interpretador sem eval) com blocos de controle e limites. Testes: `interpreter`.
- [x] E3. Módulo Importar Notas: sync, ponte `HUB`, injeção sob demanda, blocos (Buscar, Baixar, Abrir lançamento, Total de pendências, Página atual).
- [x] E4. Exemplos, salvar/carregar programas (`storage.local`), registro de execução.
- [x] E5. Validador, e2e, pacote, prints para validação do usuário.

## Depois
- [ ] A1. Módulo **Alunos e notas** (somente leitura).
- [ ] A2. Integrar ao hub as funções restantes do Assistente EaD e demais extensões antigas (**direção de 30/10: o hub é o ponto único**).
- [ ] A3. Homologar em Moodle real (SENAI e FIEG).

## Versão 0.2.0 (botão lateral) — direção corrigida em 30/10/2026
- [x] L1. Botão lateral (content script `launcher.js`, Shadow DOM) + menu com Pendências, Correção, Acompanhamento, Alunos e notas.
- [x] L2. Pendências = abre a barra do radar (sem buscar); Correção = abre o lançamento de notas (CSV). Acompanhamento e Alunos e notas = "em breve".
- [x] L3. Alunos e notas (A1) como ferramenta do menu, somente leitura (0.3.0): abas Alunos e Notas.
- [x] L4. Acompanhamento = risco por aluno do Assistente EaD (0.3.0). Fechamento da UC removido por decisão do usuário; entrou o **Relatório da UC**.
- [ ] L5. "Automação por blocos" como item do menu (reaproveita `--with-blocos`).
- [ ] L6. Homologar em Moodle real; ícone da extensão.

## Versão 0.3.0 (alunos e notas)
- [x] M1. Leitura única do curso (livro de notas + participantes) com cache em memória, só ao clicar em Ler.
- [x] M2. Telas Alunos, Notas, Acompanhamento e Relatório da UC; CSV; copiar mensagem.
- [ ] M3. Ler as **tarefas** (entregas, sem entrega, aguardando correção) por atividade, sob demanda — habilita "sem entrega" no risco.
- [ ] M4. Excel (.xlsx) das notas e PDF próprio do relatório (hoje: CSV e impressão do navegador).
- [ ] M5. UC vigente automática (reaproveitar `vigencia.js`) e data de encerramento no risco.
- [ ] M6. Ficha do aluno, ranking de atividades, linha do tempo de prazos (sugestões).
- [ ] L6. Homologar no Moodle real (nenhum seletor do livro de notas foi testado fora do Moodle simulado).

## Versão 0.4.0
- [x] N1. Enviar mensagem ao aluno pelo Moodle, com conferência por leitura de volta e registro local.
- [ ] N2. Saída em **página HTML animada** a partir de Notas (alunos, pendências e demais dados lidos) — mockup antes.
- [ ] N3. Analisar o "Ajustar datas Moodle 1.3.4" (aguardando ZIP com arquivos).
- [x] N1b. Pendências na página da UC sem links de tarefa + botão de fechar (0.4.1).

## Versão 0.6.0
- [x] P1. Aba Alunos: filtros em chips, mini-barra de itens, último acesso destacado, ordenação.
- [x] P2. Relatório da UC por aluno (cartões por urgência) + ficha do aluno.
- [x] P3. Ler as tarefas (envio/prazo por atividade, com "Continuar") e mensagem de pendências com atividades marcáveis.
- [x] P4. HTML baixável do relatório e da ficha (N2).

## Versão 0.10.0
- [x] Q1. Fila de envio de mensagens com revisão, parada e "Tentar de novo" só nas falhas (mockup `docs/mockups/fila-mensagens.html` aprovado).
- [ ] Q2. Nome e ícone Unidigit@l Assist na barra do Importar Notas dentro do hub.
- [x] Q3. N3: "Ajustar datas" virou **Conferir datas** (módulo `datas`, 0.16.0, commit local; falta homologar em Moodle real).
- [ ] Q4. Homologar em Moodle real.

## Plano 0.11 → 1.0 (detalhes em `plano.md`)
- [x] 0.11.0 Excel (.xlsx) + botões nas telas (Alunos, Notas, Acompanhamento, Relatório da UC)
- [x] 0.12.0 Relatório da turma (`/my/`) — lista própria no painel (não caixas nos cartões do Moodle); UCs futuras: usar o filtro do Moodle
- [x] 0.13.0 Compatibilidade + Sobre + Meus dados + armazenamento versionado + `key` fixa
- [x] 0.14.0 Gaveta Ferramentas + Kahoot (host opcional)
- [x] 0.15.0 Modelos de mensagem + retornos agendados + comparativo entre leituras
- [x] 0.16.0 Resumo do dia + Ajustes por UC + régua de nota (commit local; sem push)
- [ ] 1.0.0 Homologação real + política de privacidade pública (loja do Edge: adiada por decisão do usuário em 31/10/2026)

- [x] R1. Cronograma da turma (JSON → textos do curso): importar, validar, ligar, atualizar datas dos textos e webaulas, conferir. Versão de teste 0.16.0; falta: datas das atividades/curso a partir do JSON, incluir `crn.v1` em Meus dados, homologar em Moodle real.

## Menu em aba (01/11/2026)
- [x] N1. Menu em aba na borda direita, ícones B, foco duplo, “não se aplica aqui”, Alt+U, setas, Mover aba (0.16.0).
- [x] N2. `crn.v1` e `uas.aba` em Meus dados.
- [x] N3. Rascunho da política de privacidade pública (`docs/projeto/politica-de-privacidade-publica.md`).
- [ ] N4. Homologar a aba em Moodle real (SENAI e FIEG): conferir posição frente ao VLibras e ao chat.
- [ ] N5. Cronograma da turma: datas do curso e das atividades pelo JSON (depende do `modeloCronograma` da Aprendizagem e da regra das linhas Fórum/SAP/Avaliação Final).
- [ ] N6. Selo de pendências na aba só com a última leitura guardada (decidir: o launcher hoje não lê nada).
- [ ] N7. Publicar a política de privacidade em página pública (1.0.0).

- [x] N8 Relatório da turma com matriculados (HTML/Excel, comparação, copiar resumo) — testar no Moodle real (SENAI e FIEG).

- [x] N9 Painel HTML dinâmico das turmas + Notas por UC com leitura parcial — testar no Moodle real.

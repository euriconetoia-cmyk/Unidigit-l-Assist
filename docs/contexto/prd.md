# PRD — Ferramentas EaD SENAI (hub)

> Direção atual (30/10/2026): **botão lateral sempre presente nas páginas do Moodle**, com um menu de ferramentas (Pendências, Correção, Acompanhamento, Alunos e notas). O editor de blocos (Blockly) virou um item **futuro** do mesmo menu; o código dele está guardado (`--with-blocos`). O texto abaixo sobre blocos descreve esse futuro.

## Problema
O tutor usa várias extensões separadas (Importar Notas, Assistente EaD, e em breve Alunos e notas). Cada uma tem seus botões e seu jeito de rodar. Falta um lugar único em que ele monte, visualmente, **o que quer que aconteça** e execute só quando decidir.

## O que é
Uma extensão do Chrome com **programação por blocos (Blockly)** num painel lateral. O usuário monta uma sequência de blocos (ex.: "buscar pendências → se houver pendência → baixar pendentes") e clica em **Executar**. Cada bloco chama um módulo (aplicação) que age na aba do Moodle aberta.

## Para quem
Tutores e instrutores do Moodle (SENAI e FIEG) que não programam.

## Primeira versão (0.1.0)
1. Painel lateral com o editor Blockly, Executar/Parar, registro de execução, exemplos e salvar/carregar programas.
2. Executor de blocos próprio (sem `eval`), com blocos de controle básicos.
3. Módulo **Importar Notas** (radar de pendências, baixar pendentes, abrir o lançamento de notas por CSV), injetado na página **somente quando um bloco o usa**.

## Depois
- Módulo **Alunos e notas** (somente leitura: Alunos, Atividades e notas, Relatório de notas).
- Módulo **Assistente EaD** e migração das extensões antigas para dentro desta.

## O que não faz
- Nada roda sozinho: não há execução ao abrir página, nem em segundo plano, nem agendada.
- Não grava nota sem a confirmação que o módulo já exige na tela; blocos **não** contornam a prévia/confirmação.
- Não chama IA nem serviço externo; não guarda dados de alunos.

## Critérios de sucesso
- Um programa de blocos faz o mesmo que o clique manual no módulo, e para quando o usuário clica em Parar.
- Nenhum módulo é injetado antes de ser pedido por um bloco em execução.
- Homologado em Moodle real antes de ser chamado de "validado".

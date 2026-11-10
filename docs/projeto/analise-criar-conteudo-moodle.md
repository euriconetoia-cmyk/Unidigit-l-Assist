# Análise: criar conteúdo no Moodle pela extensão (atividade de envio, fórum, HTML)

Data: 10/11/2026. Status: **análise, sem decisão tomada**. Nada foi implementado nem testado em Moodle real.

## 1. Veredito
**Viável**, com ressalvas. O caminho mais seguro e que combina com as regras do projeto é **preencher o formulário oficial de criação do Moodle e deixar o usuário clicar em Salvar** (Fase 1). Criar direto, em lote e com prévia (Fases 2 e 3) também é possível, mas só depois de mapear os formulários dos dois Moodles (SENAI e FIEG) e de registrar a decisão em `memory.md`. O maior limite não é técnico: **quem é "Professor sem permissão de edição" não consegue criar nada**, e a extensão não pode dar essa permissão.

## 2. O que já temos e reaproveita
- **Conferir datas** já abre `course/modedit.php?update=ID`, preenche campos e **nunca clica em Salvar**; depois relê e confere. É o mesmo mecanismo, só que para criar (`modedit.php?add=assign&course=ID&section=N`).
- **Enviar mensagens** já usa `lib/ajax/service.php` com o `sesskey` da página, mesma origem, sem permissão nova, com leitura de volta para confirmar. Decisão registrada em `memory.md`.
- **Cronograma da turma** já guarda as datas de cada atividade. Dá para criar a atividade já com as datas certas.
- Relatórios e fila com pausa, cancelar e prévia (padrão do projeto).

## 3. Caminhos técnicos
| Caminho | Como | Prós | Contras | Veredito |
|---|---|---|---|---|
| A. Serviço web oficial do Moodle | `lib/ajax/service.php` | Limpo | Pelo que pude verificar, o Moodle não expõe um serviço para **criar** atividade (existem funções PHP internas, `add_moduleinfo`/`create_module`, não serviços). Não confirmei isso em Moodle real | Não contar com ele |
| B. Preencher o formulário e o usuário salva | Content script na página `modedit.php?add=...` | Moodle valida tudo, usuário confere, sem gravação automática, mesmo princípio do "Conferir datas" | Um item por vez | **Fase 1** |
| C. Enviar o formulário em nome do usuário | `fetch` na página de criação (lê os campos padrão, troca só os nossos, envia com o `sesskey`) | Permite lote (vários UCs) e usar o cronograma | Depende da versão e dos campos obrigatórios de cada Moodle; precisa de prévia e confirmação; nova decisão sobre `sesskey` | Fases 2 e 3 |
| D. Plugin ou serviço próprio no Moodle | Código PHP no servidor | Mais robusto | Exige administrador do Moodle, fora do nosso controle | Fora de escopo |

## 4. Por tipo de conteúdo
- **Atividade de envio (assign)**: formulário grande (nome, descrição, datas de abertura/limite/lembrete, tipos de envio, nota, conclusão, restrições). Funciona bem com B e C, mas é o mais sensível a versão e campos personalizados.
- **Fórum**: formulário médio (nome, descrição, tipo de fórum, assinatura, conclusão). O mais simples dos três.
- **"Bloco de HTML"**: são duas coisas diferentes no Moodle.
  - **Rótulo / área de texto e mídia** (dentro do tópico, via mesmo `modedit.php`): fácil, mesmo caminho dos outros. **Recomendo** como padrão para "texto com HTML" no curso.
  - **Bloco HTML lateral** (`block_html`): precisa de ativar edição, adicionar o bloco e depois configurá-lo (duas etapas, rotas diferentes e outras permissões). Deixar para a última fase.
- O Moodle limpa o HTML conforme a permissão do usuário (por exemplo, remove `<script>`). Não dá para contar com JavaScript no conteúdo criado.

## 5. Permissões (limite real)
A criação segue o que o **usuário logado** já pode fazer: pelo menos `moodle/course:manageactivities` e `mod/assign:addinstance` ou `mod/forum:addinstance` (bloco lateral: `moodle/block:edit` e `block/html:addinstance`). Nos dados que já lemos aparece o papel **"Professor sem permissão de edição"**; se o perfil do tutor for esse, o botão deve avisar "você não tem permissão de edição neste curso" **antes** de qualquer coisa. A extensão deve detectar isso (página de criação recusa ou o curso não tem modo de edição).

## 6. Riscos e como reduzir
1. **Conteúdo aparecendo para aluno por engano** → criar sempre **oculto**; o usuário revela depois de conferir.
2. **Duplicar** (rodar duas vezes) → antes de criar, checar se já existe atividade com o mesmo nome na seção.
3. **Lote que falha no meio** → fila sequencial com pausa, relatório do que foi criado e do que falhou, "tentar só as pendentes".
4. **Versões e campos diferentes entre SENAI e FIEG** → começar com um "mapa do formulário" somente leitura (Compatibilidade) antes de enviar qualquer coisa.
5. **`sesskey`**: a regra proíbe "ler/guardar token de sessão". O envio de mensagens já usa o `sesskey` da página sem guardar; o caminho C seguiria o mesmo princípio e pede **decisão registrada** (como foi feito com o Kahoot e com as mensagens).
6. **Confirmar que gravou**: reler a atividade criada (como o "Conferir datas") antes de dizer "criado".
7. **Desfazer**: apagar atividade pela extensão é arriscado; no Moodle 4.x a lixeira ajuda, mas deixar fora das primeiras fases. Guardar só a lista local do que foi criado (ids), sem dado de aluno.
8. **Qualidade pedagógica e política interna**: confirmar com a coordenação se a criação automática segue o padrão (MSEP) e o registro de auditoria. O log do Moodle mostra a ação como feita pelo próprio usuário.
9. **Dado de aluno**: não há; os modelos têm só texto e datas.

## 7. Plano em fases
- **Fase 0 (pequena): mapa do formulário.** Em "Compatibilidade", botão somente leitura que lista os campos do formulário de criação (nome do campo, tipo, obrigatório) de assign, fórum e rótulo, nos dois Moodles. Sem gravar nada.
- **Fase 1 (média): modelos e preenchimento.** Botão "Criar conteúdo" → escolher tipo e modelo → abre a página de criação já preenchida → **usuário confere e salva**. Modelos editáveis (texto padrão de fórum de apresentação, de dúvidas, atividade de envio padrão).
- **Fase 2 (média/grande): criar direto, um item, com prévia.** Prévia visual, criado oculto, releitura para confirmar.
- **Fase 3 (grande): lote por turma e cronograma.** Mesmo modelo em várias UCs, com datas vindas do Cronograma da turma, fila com pausa, cancelar e relatório.
- **Fase 4: bloco HTML lateral e desfazer** (se ainda fizer sentido).

## 8. Critérios de aceitação (Fase 1)
- Nada é gravado sem o usuário clicar em Salvar no Moodle.
- Sem permissão de edição: aviso claro e nenhum formulário aberto.
- Sem permissão nova no manifest; testes unitários e e2e no Moodle simulado; **homologação em Moodle real antes de chamar de "validado"**.

## 9. Perguntas em aberto
1. Que versão do Moodle roda no SENAI e no FIEG? (Administrador ou tela "Sobre".)
2. O perfil de quem vai usar tem permissão de edição nas UCs?
3. Que modelos você quer primeiro (fórum de apresentação, atividade de envio padrão, texto de boas-vindas)?
4. Começar pela Fase 1 (você salva) ou ir direto para criar com prévia?

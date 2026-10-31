# Changelog

## 0.15.0 — 2026-10-31

### Novo
- **Modelos de mensagem** (Acompanhamento → Modelos): textos prontos com campos **{nome}**, **{uc}**, **{nota}**, **{dias_sem_acesso}** e **{pendencias}**, usados na mensagem individual e na **fila**. Vêm 3 modelos padrão; você cria, edita e exclui, e pode marcar um para ser escolhido sozinho quando o risco for por falta de acesso ou por nota. **Campo sem dado nunca vira vazio nem zero**: ele continua visível no texto, a tela avisa e o envio fica travado até você completar à mão ou trocar de modelo (na fila, o aluno sai da seleção).
- **Retornos agendados**: ao enviar, “Ver de novo em” (3, 7 ou 14 dias, data ou não agendar; padrão 7). O painel **Retornos de hoje** (no Acompanhamento) lista o que vence hoje ou está atrasado, com **Feito** e **Adiar 3 dias**, e os próximos. Só a chave do aluno e as datas ficam guardadas, neste navegador, sem notificações.
- **Comparativo entre leituras**: cada leitura guarda um instantâneo **só com números** (nota, dias sem acesso, pendências, sem nome nem e-mail); o Acompanhamento mostra “desde a leitura de DD/MM”: quantos pioraram/melhoraram, variação da média e a tabela por aluno. Até 12 leituras por UC; leituras seguidas em 10 minutos viram uma só.
- **Meus dados**: novas categorias (Modelos, Retornos, Leituras) medidas, exportadas no backup e apagáveis; nova validade “Leituras do comparativo” (padrão 12 semanas).

### Interno
- O registro de contato passa a anotar qual modelo foi usado (`modelo`); o texto enviado continua guardado como antes.
- Sem permissão nova.

## 0.14.0 — 2026-10-31

### Novo
- **Gaveta “Ferramentas”** no menu: o menu principal fica com a correção e os alunos; dentro de Ferramentas ficam **Kahoot**, **Modelo de perguntas (CSV)**, Ajustar datas e Automação por blocos (“em breve”) e o grupo **Ajuda e dados** (Compatibilidade, Meus dados, Sobre). Tem botão de voltar.
- **Kahoot — importar perguntas**: abre uma página da extensão que pede, uma vez e só se você aceitar, a permissão para `create.kahoot.it`. Com ela, você abre o editor de um quiz e usa **Preparar esta aba** (ou “Abrir o Kahoot e preparar”); a janela **Importar!** lê o CSV (`;`, `,` ou TAB), **confere linha a linha** (pergunta vazia, opção faltando, sem correta, textos acima de 120/75 caracteres), mostra o progresso com tempo, **Cancelar**, e “Importar só as válidas”. Só usa a pergunta atual se estiver **em branco**; nunca sobrescreve conteúdo. Se algum campo não for achado, para e diz **qual pergunta e qual campo**, e quantas já foram preenchidas.
- **Modelo de perguntas (CSV)**: baixa a planilha-modelo em qualquer página.
- Fluxo do Kahoot reescrito a partir da ideia do projeto “SENAI Extensões” (Julio Alves, MIT).

### Segurança e permissões
- Única permissão nova: `optional_host_permissions` para `https://create.kahoot.it/*`, **opcional**, pedida só no clique e revogável em `chrome://extensions`. Nenhum content script novo; o CSV é lido no navegador e nunca enviado. Decisão registrada em `docs/contexto/rules.md` e `memory.md`.
- Os seletores do editor do Kahoot **não foram homologados** no Kahoot real (testado em simulação).

## 0.13.0 — 2026-10-31

### Novo
- **Compatibilidade** (menu → Ajuda e dados): diagnóstico da página aberta (livro de notas, participantes, curso, tarefa ou “Meus cursos”). Mostra só o que foi reconhecido, em contagens — **sem nome, e-mail ou nota de aluno** e sem consultar o Moodle. “Copiar diagnóstico” gera o texto para enviar a quem mantém a extensão.
- **Meus dados**: uso do armazenamento do navegador por categoria, barra com aviso a partir de 70%, **exportar backup** (JSON), **importar** (juntar ou substituir, com validação) e **apagar tudo** com confirmação. Registros de contato **expiram** no prazo escolhido (padrão 12 meses; 3, 6 ou nunca).
- **Sobre**: versão instalada, créditos, novidades e como atualizar; “Ver se há versão nova” só abre a página de versões no GitHub (a extensão não consulta a internet sozinha).

### Interno
- Camada única de armazenamento com **versão de formato** e migrações (`core/storage.js`); só `chrome.storage.local`, sem `unlimitedStorage` e sem `storage.sync`.
- **ID fixo da extensão** (`key` no manifest): ao trocar a pasta de instalação, os dados guardados continuam. O ID está em `docs/projeto/ID_DA_EXTENSAO.txt`; o validador confere. O pacote da loja do Edge deve sair **sem** `key`.
- Nenhuma permissão nova.

## 0.12.0 — 2026-10-31

### Novo
- **Relatório da turma** (menu → Alunos → Relatório da turma), na página **“Meus cursos”**: o painel lista as UCs que aparecem na página, você marca as que quer e clica em **Gerar relatório**. A extensão lê só o “Total do curso” de cada UC (em ordem, com pausa e **Cancelar**) e baixa um **Excel com uma aba por turma** (uma coluna por UC), uma aba **Situação** (sem nota / abaixo da faixa / recuperação / média alcançada, pelas suas faixas) e, se alguma UC falhar ou vier parcial, uma aba **Avisos**. Sem nota = célula vazia, nunca zero. Nada é lido antes de “Gerar” e nada é gravado no Moodle.
- Fora de “Meus cursos” o item aparece esmaecido e explica onde funciona.
- Limitação conhecida: os cartões do Moodle não trazem a data de início, então UCs **futuras** não são excluídas automaticamente — use o filtro “Em andamento” do próprio Moodle antes de abrir o relatório.

## 0.11.0 — 2026-10-31

### Novo
- **Excel (.xlsx)** ao lado do CSV em **Alunos, Notas, Acompanhamento e Relatório da UC**. Arquivo real do Excel (abre sem aviso de incompatibilidade, no Excel e no LibreOffice), com cabeçalho azul, linha fixa e filtro. Notas são números; **sem nota fica célula vazia, nunca zero**; texto que parece fórmula continua texto. O CSV continua existindo. Gerador sem dependências, com ideia de partida do projeto *SENAI Extensões* (Julio Alves, MIT), reescrito e testado aqui.

## 0.10.0 — 2026-10-31

### Novo
- **Fila de envio de mensagens** (aba Acompanhamento → "Enviar em fila"): você revisa e edita o texto de cada aluno, marca "Revisei" e a fila envia **um por vez**, com pausa de 2 s e conferência de cada envio. Dá para **parar** a qualquer momento. Quem já foi contatado hoje vem desmarcado.
- **Tentar de novo:** reenvia só quem falhou; quem já foi enviado nunca é repetido. Após 3 falhas seguidas a fila para (ex.: sessão do Moodle expirada).

## 0.9.0 — 2026-10-31

### Novo
- **Nome Unidigit@l Assist** na extensão (manifest, botão lateral e menu).
- **Pedido de ⭐** como 1º passo das instruções de instalação no README (nada dentro da extensão).
- Rodapé dos relatórios HTML: "Feito com Unidigit@l Assist · By Eurico Cirilo" com o endereço do projeto.
- **Licença MIT** adicionada ao repositório.

## 0.8.1 — 2026-10-31

### Melhorado
- **Vigência da UC pelo "Período:" do resumo do curso** (ex.: `Período: 09/06/2026 a 06/11/2026`). Tem prioridade sobre as datas soltas das seções; na categoria também é lido do cartão do curso. Sem esse campo, vale a leitura anterior. Código do Importar Notas 1.5.1. Corrigido também: na página do curso o selo de vigência era apagado logo depois de aparecer.

## 0.8.0 — 2026-10-31

### Corrigido / Novo
- **Correção agora aparece nas mesmas telas do Importar Notas.** Antes só funcionava em página de curso/categoria. Agora, **na página de uma atividade** (`mod/assign/view.php`), Correção abre o **mesmo painel "Importar notas e feedback"** da extensão original, com o botão ao lado de "Nota". Fora da tela de avaliação, Correção leva você até ela (Ver/avaliar todos os envios) e abre o painel — um clique só.
- **Conferência após salvar:** o Moodle recarrega a página ao salvar; agora o menu reabre o módulo só para rodar a conferência ("Salvo e conferido" / campos que não conferem), como na extensão original.
- **Menu por página:** Pendências vale em curso e categoria; Correção vale em curso, categoria e atividade. O que não se aplica à página fica esmaecido e, ao clicar, explica onde usar (nada é enviado ao Moodle).

### Atenção
- Os dois comportamentos automáticos (continuar até a tela de avaliação e conferir após salvar) só ocorrem depois de um pedido seu (clique em Correção ou "Salvar" do painel), duram poucos minutos e acontecem uma vez.
- Testado em páginas simuladas; falta homologar no Moodle real (botão ao lado de "Nota", Avaliação rápida, salvar e conferir).

## 0.7.0 — 2026-10-30

### Novo
- **Relatório da UC completo:** lista **todos os alunos** (não só quem tem pendência), ordenados por urgência, com nota, último acesso, situação, entregues/pendentes e mini-barra por atividade. Faixa-resumo da turma e filtros "Ver" (todos, precisam de atenção, com pendência, aguardando minha correção, sem acesso +15d, em dia).
- **Ler entregas (sob demanda):** uma consulta por atividade da UC, com cancelar e **Continuar** só nas que falharam (lê o resumo e a tabela de avaliação de cada tarefa). Passa a distinguir **entregue e avaliada**, **entregue e aguardando correção**, **sem entrega** e **sem nota** (quando ainda não se leu).
- **Ficha do aluno com atividade por atividade:** situação da entrega, nota (com média da turma), prazo e marca "atrasada".
- **Mensagem de pendências com checklist:** com as entregas lidas, o modal traz as atividades **sem entrega** do aluno já marcadas; desmarcar tira da mensagem (a menos que o texto já tenha sido editado à mão). Atividades entregues e aguardando correção **não** entram. Segue exigindo "Revisei o texto" antes de enviar.
- **Exportar HTML:** botão no Relatório da UC baixa `relatorio-uc-<curso>-<data>.html`, arquivo único (abre sem internet) com todos os alunos, entregas, notas, pendências, último acesso, motivos de risco e contatos. Tem busca e filtro locais; não carrega nada externo. As telas do painel continuam.
- "Copiar diagnóstico" agora inclui o estado da leitura das entregas (sem nomes, e-mails ou notas).

### Atenção
- Atividade e item do livro de notas são ligados **só pelo nome idêntico** (sem acentos/caixa). Se o nome diferir, a atividade aparece como "sem nota" em vez de chutar.
- Pendência = "sem entrega" quando as entregas foram lidas; caso contrário continua sendo "sem nota" (que pode ser trabalho aguardando correção).
- Não homologado no Moodle real: os seletores da tabela de avaliação e o envio de mensagem foram testados só em páginas simuladas.

## 0.6.0 — 2026-10-30

### Novo
- **Aba Alunos com filtros em chips** (um clique, com contagem; clicar no chip ativo limpa o grupo): Último acesso (hoje, 1–7, 8–14, 15–30, +30 dias, nunca, não lido), Itens com nota (nenhum, alguns, completos), Pendências (com pendência, em dia) e Situação. Os filtros combinam e as contagens respeitam os outros filtros. "Limpar filtros" aparece quando há filtro ativo.
- **Último acesso em vermelho** a partir de 15 dias; **mini-barra de itens com nota** (um quadrado por atividade); coluna **Pendentes**; colunas ordenáveis (acesso, itens, nota, situação); botão ✉ em cada linha.
- **Relatório da UC centrado no aluno:** faixa-resumo da turma, filtros "Ver" (precisam de atenção, todos, com pendência, sem acesso +15d, em dia) e um **cartão por aluno** ordenado por urgência. O resumo por atividade ficou recolhível no fim.
- **Ficha do aluno** (clique no cartão): nota, itens, pendências, último acesso, motivos do risco com sugestão, notas por atividade com a média da turma, contatos já feitos, **Enviar mensagem** e **Copiar resumo**.

### Atenção
- "Pendentes" conta itens **sem nota** no livro de notas; ainda não distingue "sem entrega" de "aguardando correção". A leitura das tarefas (próxima versão) resolve isso e alimenta a mensagem de pendências.

## 0.5.0 — 2026-10-30

### Novo
- **"Continuar de onde parou"** na leitura de Alunos e notas: se os participantes ou uma página do livro de notas falharem, o que já foi lido fica guardado e o botão repete **só o que faltou**. "Ler tudo de novo" continua disponível. Telas com leitura parcial mostram o que deu para ler e marcam o resto como "Verificar".
- **Cancelar** durante a leitura (o que já foi lido é mantido) e **Copiar diagnóstico** (sem nomes, e-mails ou notas de alunos).
- **Painel mais simples:** antes de ler, um título e um botão ("Ler agora"); lendo, barra, etapas e contador; abas esmaecidas até a leitura; um só botão azul por tela.
- **Identidade visual unificada** (cores, raios 8/14 px, escala de texto, tema escuro por variáveis) no painel de alunos e no menu flutuante.

### Ainda não
- Barra de pendências e HTML do relatório seguirão a mesma identidade nas próximas versões.

## 0.4.2 — 2026-10-30

### Corrigido
- **"Livro de notas: tempo limite excedido"** em cursos grandes. O livro de notas é a página mais pesada do Moodle e o limite era de 18 s.
  - O livro de notas agora é pedido em **páginas de 100 alunos** (mais rápidas) e o leitor segue a paginação sozinho.
  - Tempo limite: **90 s** para o livro de notas e **45 s** para participantes.
  - **Uma nova tentativa automática** após tempo limite ou erro 5xx.
  - Enquanto espera, o painel mostra o contador ("Livro de notas… 23 s").
  - Se ainda falhar, a mensagem explica o que fazer (outro horário ou filtrar por grupo).

## 0.4.1 — 2026-10-30

### Corrigido / Novo
- **Pendências na página inicial da UC** mesmo quando as atividades não aparecem como links (ex.: "Cronograma de Atividades"): a barra abre e, ao clicar na lupa, procura a lista de tarefas do curso. Nada é consultado antes da lupa.
- **Botão de fechar (X)** na barra de pendências; o item Pendências do menu reabre a barra.
- Inclui o Importar Notas 1.5.0 (sincronizado). Mensagens de erro da lupa agora mostram o motivo real.

## 0.4.0 — Enviar mensagem ao aluno pelo Moodle (Acompanhamento)
- Em **Acompanhamento**, cada aluno ganha o botão **Enviar mensagem**: abre uma janela com o texto sugerido (só fatos lidos: dias sem acesso e nota; a falta de nota lançada não vai ao aluno), editável; o envio só é liberado depois de marcar "Revisei o texto".
- Envia pelo serviço de mensagens do próprio Moodle, com a sessão do tutor, e **lê a conversa de volta** para confirmar; se não conseguir conferir, avisa em vez de dizer que deu certo. Recusa do Moodle (aluno bloqueou, sem permissão, sessão expirada) aparece como erro e não conta como enviada.
- Registro de contato **só neste navegador** (últimos 5 por aluno) com marca "Contatado hh:mm" na linha e aviso antes de reenviar; botão para apagar o registro do curso. Contato não resolve o risco.
- Sem permissões novas. Testes: +9 unitários e +10 verificações no e2e.

## 0.3.2 — Correção: menu fechado bloqueava cliques
- Na 0.3.1 a caixa invisível do menu (painel fechado) ficava sobre o canto inferior direito da página e interceptava cliques, inclusive na **lupa de Pendências**. Agora só o botão e o painel aberto recebem cliques.
- Teste novo: o menu fechado não cobre a lupa (e2e) e o CSS não deixa a caixa receber eventos (unitário).

## 0.3.1 — Menu flutuante em cards
- Botão lateral vira botão flutuante arredondado; o menu abre ao lado dele em painel de vidro com cards em seções (Correção, Alunos, Em breve), entrada animada, tema claro/escuro e respeito a "reduzir movimento".
- Painel inerte quando fechado (teclado/leitor de tela não alcançam os cards); Esc, clique fora e o botão (que vira X) fecham; erro aparece dentro do painel.

## 0.3.0 — Alunos e notas, Acompanhamento e Relatório da UC
- Novo módulo **alunos** (injetado só ao clicar no menu): painel lateral com abas **Alunos**, **Notas**, **Acompanhamento** e **Relatório da UC**; leitura única do curso (livro de notas + participantes, com paginação, pausa entre consultas e cobertura) só ao clicar em **Ler**.
- Reaproveita do Assistente EaD SENAI 3.7.18 os adaptadores de leitura e as regras de risco ("sem entrega" e "UC encerrando" ficam de fora: exigem ler as tarefas).
- Dado ausente aparece como "Verificar"; sem nota lançada aparece como "—", nunca zero.
- CSV (alunos, notas, lista de contato, relatório) com proteção contra fórmula; "Copiar mensagem" sem envio; PDF pela impressão do navegador.
- Menu com 6 itens (Relatório da UC no lugar do Fechamento; Automação por blocos "em breve").
- Testes: 12 do módulo + e2e com Moodle simulado (23 verificações).


# Política de privacidade — Unidigit@l Assist (rascunho para publicação)

*Rascunho. Para a versão 1.0.0 este texto precisa ficar numa página pública (endereço exigido pelas lojas de extensões) e ser revisado por quem representa a instituição.*

**Quem fez:** Eurico Cirilo (coautor Julio Alves — Importador de Notas). Contato: euriconetophn@gmail.com.

## O que a extensão é
Uma ferramenta de apoio ao tutor nos ambientes Moodle `ead.senai.br` e `ead.fieg.com.br`. Ela só age quando você clica numa ferramenta do menu.

## O que ela faz com dados
- **Lê** páginas do Moodle que você já pode ver (notas, participantes, cronograma, edição de atividades), com a sua própria sessão, e só depois de um clique.
- **Não envia dados de alunos, notas ou mensagens a nenhum servidor nosso nem de terceiros.** Não existe servidor da extensão.
- **Guarda neste navegador** (`chrome.storage.local`): registro dos contatos feitos, modelos de mensagem, retornos agendados, leituras para comparação, ajustes por UC, o cronograma JSON que você importou e a altura da aba do menu. Em **Meus dados** você vê o tamanho, exporta um backup, importa ou apaga tudo.
- **Não guarda** senha, cookie, token de sessão nem dados de pagamento.
- **Kahoot:** o acesso a `create.kahoot.it` é uma permissão opcional, pedida só quando você usa essa ferramenta. O arquivo CSV é lido no seu navegador e não é enviado a lugar nenhum.

## O que é gravado no Moodle
Somente o que você mandar gravar: enviar mensagem, lançar notas e feedback, salvar datas. Cada uma dessas ações exige sua revisão e sua confirmação (ou o seu clique em Salvar no próprio Moodle).

## Seus controles
Apagar tudo em **Meus dados**; revogar permissões em `chrome://extensions`; remover a extensão apaga os dados guardados.

## Permissões
`sidePanel`, `scripting`, `storage`, `downloads` e acesso aos dois endereços do Moodle. Nada de “todos os sites”.

## Alterações
Mudanças nesta política serão registradas no CHANGELOG e na data abaixo.

*Última atualização: 01/11/2026 (rascunho).*

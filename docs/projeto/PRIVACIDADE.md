

## Módulo Alunos e notas (0.3.0)
Só lê, e só quando você clica em **Ler**: a página do livro de notas e a de participantes do curso aberto, com a sua sessão do Moodle. Os dados ficam **apenas na memória da página** (somem ao recarregar) e não são gravados no navegador nem enviados a qualquer servidor. CSV e mensagens são gerados localmente; “Copiar mensagem” só copia o texto, nada é enviado ao aluno.

## Mensagens ao aluno (0.4.0)
“Enviar mensagem” só age quando você revisa o texto, marca a confirmação e clica em enviar. A mensagem vai **pelo Moodle** (mesmo serviço da caixa de mensagens), com a sua conta, e o Moodle a entrega ao aluno; nada passa por outro servidor. Guardamos **neste navegador** (chrome.storage.local) um registro dos últimos 5 contatos por aluno: horário, número da mensagem, se foi conferida e o texto enviado. O botão “Apagar registro de contatos” remove o do curso aberto.

## Meus dados e validade (0.13.0)
A tela **Meus dados** mostra o que a extensão guarda neste navegador (hoje, só o registro de contatos e a validade escolhida), permite **exportar um backup** em arquivo local, **importar** de volta e **apagar tudo**. Os registros de contato expiram no prazo que você escolher (padrão 12 meses). Nada é enviado a servidor algum.

## Kahoot (0.14.0)
O acesso a `create.kahoot.it` é uma **permissão opcional**, pedida uma vez, só quando você clica em Kahoot e aceita; pode ser revogada em `chrome://extensions`. Com ela, a extensão só age na aba do editor que você preparou e só preenche as perguntas do arquivo CSV que você escolher. O arquivo é lido no navegador e **não é enviado a lugar nenhum**.

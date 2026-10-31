

## Módulo Alunos e notas (0.3.0)
Só lê, e só quando você clica em **Ler**: a página do livro de notas e a de participantes do curso aberto, com a sua sessão do Moodle. Os dados ficam **apenas na memória da página** (somem ao recarregar) e não são gravados no navegador nem enviados a qualquer servidor. CSV e mensagens são gerados localmente; “Copiar mensagem” só copia o texto, nada é enviado ao aluno.

## Mensagens ao aluno (0.4.0)
“Enviar mensagem” só age quando você revisa o texto, marca a confirmação e clica em enviar. A mensagem vai **pelo Moodle** (mesmo serviço da caixa de mensagens), com a sua conta, e o Moodle a entrega ao aluno; nada passa por outro servidor. Guardamos **neste navegador** (chrome.storage.local) um registro dos últimos 5 contatos por aluno: horário, número da mensagem, se foi conferida e o texto enviado. O botão “Apagar registro de contatos” remove o do curso aberto.

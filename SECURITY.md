# Segurança

## Reportar uma falha
Não abra uma issue pública. Use **Security → Report a vulnerability** neste repositório (aviso privado) ou fale diretamente com o mantenedor.

Inclua a versão, o que acontece e como reproduzir, **sem dados reais de alunos**.

## Princípios do projeto
- Só os domínios `ead.senai.br` e `ead.fieg.com.br`; permissões mínimas, validadas por `npm run validate`.
- Nenhum dado de aluno sai do navegador; nada é enviado a serviço externo.
- Nada roda sozinho; gravações no Moodle exigem confirmação do usuário e são conferidas por releitura.
- Sem senha, cookie ou token guardados pela extensão.

# Regras — Blocos EaD SENAI

## Acima de tudo
Nada roda sem o usuário pedir (clique numa ferramenta do menu lateral; no futuro, Executar nos blocos). Nenhuma gravação no Moodle é dada como feita sem a conferência do módulo; **blocos nunca pulam a prévia ou a confirmação do módulo**.

## Fazer
- Executor percorre o JSON do workspace; **proibido** gerar código JavaScript e executá-lo (`eval`, `new Function`, `setTimeout(string)`).
- Limites no executor: máximo de passos por execução, de repetições e de espera; Parar interrompe entre blocos e durante esperas.
- Módulo só é injetado quando um bloco em execução o usa; injeção só em `ead.senai.br` e `ead.fieg.com.br`.
- Erro de leitura = o bloco falha com mensagem; nunca vira "zero".
- Todo texto de página/arquivo no DOM via `textContent` (sem `innerHTML` com dado externo).
- Depois de alterar código: `npm test`, `npm run build`, `npm run validate`.

## Nunca
- Permissão ou host além de: `sidePanel`, `scripting`, `storage`, `downloads` e os dois hosts do Moodle, sem decisão registrada em `memory.md` (o validador falha).
- `<all_urls>`, `tabs` amplo, `webRequest`, `alarms`, `externally_connectable`, scripts remotos.
- Mais de **um** content script: só o `launcher.js` (botão lateral) é declarado no manifest, nos dois hosts, sem subframes; ele **não consulta nada** (sem `fetch`/XHR) e só desenha o botão. Todo o resto entra por injeção sob demanda, após o clique.
- Ler/guardar senha, cookie ou token de sessão. Enviar dado de aluno a serviço externo.
- Chamar a versão de "validada em Moodle real" sem homologação.

## Convenções
Interface e documentação em português do Brasil; nomes técnicos em inglês. Créditos: Eurico Cirilo (módulos originais) e Julio Alves (Importador de Notas 0.8.1).

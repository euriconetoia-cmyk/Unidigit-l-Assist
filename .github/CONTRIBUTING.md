# Como contribuir

## Antes de mexer
1. Leia tudo em [`docs/contexto/`](../docs/contexto): `prd.md`, `architecture.md`, `rules.md` (restrições que não podem ser violadas), `design.md` (vale para toda tela nova), `task.md` (fila, uma tarefa por vez, na ordem) e `memory.md` (histórico de decisões).
2. Trabalhe em um branch a partir de `main` (`feat/…`, `fix/…`, `docs/…`) e abra um Pull Request. `main` só recebe código com o CI verde.

## Regras que não mudam
- Nada roda sozinho; ações que gravam no Moodle pedem confirmação e são conferidas depois.
- Sem permissão nova no manifesto, sem scripts remotos, sem `eval`, texto de página sempre via `textContent`.
- Fixtures e exemplos usam **dados fictícios**. Nunca versione nome, e-mail, nota ou print real de aluno.
- Interface e documentação em português do Brasil.

## Antes de abrir o PR
```bash
npm ci && npm test && npm run build && npm run validate
npm run test:e2e   # se mudou tela ou fluxo
```
Mudou a interface? Anexe o print do e2e. Decisão importante? Registre em `docs/contexto/memory.md`.

## Commits
Mensagens curtas no imperativo, em português, com prefixo: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.

## Nova versão
1. Atualize a versão em `package.json` **e** `manifest.json` (devem ser iguais) e descreva no `CHANGELOG.md` (`## X.Y.Z — AAAA-MM-DD`).
2. Depois do merge em `main`: `git tag vX.Y.Z && git push origin vX.Y.Z` **ou**, sem terminal, *Actions › Release › Run workflow* informando a tag (e, se quiser, o commit). O workflow **Release** confere tag × manifesto, roda tudo e publica o ZIP em *Releases* com as notas do `CHANGELOG`.

## Código vindo de outros projetos
`src/modules/importar-notas/vendor` e `src/modules/alunos/vendor` são cópias geradas por `npm run sync`. Não edite à mão: mude no projeto de origem e sincronize.

## Configuração do GitHub
`bash scripts/configurar-github.sh` (uma vez, com o `gh` logado) ajusta descrição, tópicos, merge por squash, etiquetas, alertas de segurança e a proteção da `main`.

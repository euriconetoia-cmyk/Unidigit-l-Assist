# GitHub: configuração e publicação de versões

Repositório: <https://github.com/euriconetoia-cmyk/Unidigit-l-Assist> · Licença MIT · Branch padrão `main`.

## O que está configurado
| Item | Estado |
|---|---|
| Descrição e tópicos | "Extensão do Chrome para tutores EaD no Moodle (SENAI/FIEG)…"; tópicos `chrome-extension`, `manifest-v3`, `moodle`, `ead`, `senai`, `tutoria`, `education`, `javascript` |
| Merge | somente squash; branch apagada ao mesclar |
| `main` | protegida (alterações por Pull Request; CI **CI / Testes, build e validação** verde) |
| CI | `.github/workflows/ci.yml` em push na `main` e em PR (testes unitários, build, validação) |
| E2E | `.github/workflows/e2e.yml`, **manual** (Chromium real + Moodle simulado) |
| Dependabot | `.github/dependabot.yml` (npm e GitHub Actions) |
| Perfil de comunidade | **100%** (11/11/2026) |
| Arquivos de comunidade | `README`, `LICENSE`, `CONTRIBUTING`, `CODE_OF_CONDUCT`, `SECURITY`, modelos de issue (erro, melhoria) e de PR |
| Modelos de issue | `blank_issues_enabled: false`; contato de segurança leva ao aviso privado |

`scripts/configurar-github.sh` reaplica essa configuração (precisa do `gh` logado com a conta do dono).

## Como publicar uma versão
1. Atualize `package.json` **e** `manifest.json` (mesma versão) e escreva a seção `## X.Y.Z — AAAA-MM-DD` no `CHANGELOG.md`; adicione a entrada em `src/modules/alunos/novidades.js` (o validador confere).
2. `npm ci && npm test && npm run build && npm run validate` (e `npm run test:e2e` se mudou tela).
3. Envie para a `main`.
4. Publique, de um destes jeitos:
   - **Sem terminal:** *Actions › Release › Run workflow*, informando a tag (`vX.Y.Z`) e, se quiser outra base que não a `main`, o commit.
   - **Terminal:** `git tag vX.Y.Z && git push origin vX.Y.Z`.
5. O workflow **Release** confere tag × manifesto, roda testes, build e validação, gera o ZIP e cria a release com o trecho do `CHANGELOG`.

## Histórico de releases
| Versão | Base | Conteúdo |
|---|---|---|
| v0.18.2 | `main` | Painel Alunos com 4 abas; Relatório da turma e Criar conteúdo enxutos (a publicar) |
| v0.18.1 | `main` (558a9f4) | Menu enxuto contextual (ícones estilo C), apoio atrás da engrenagem |
| v0.18.0 | `ec7e7ec` | Criar conteúdo (seção por nome, DOCX, campos obrigatórios), painel das turmas |
| v0.17.0 | `2272104` | Menu em aba, cor única nos ícones, Meus dados com cronograma |
| v0.16.0 e anteriores | tags originais | Veja o `CHANGELOG.md` |

## Segurança (conferido em 11/11/2026)
Ligados: relato privado de vulnerabilidade, grafo de dependências, alertas do Dependabot, atualizações de segurança do Dependabot e *push protection* de segredos. Desligados (opcionais): alertas de malware, atualizações agrupadas, CodeQL e varreduras por IA.

## Só pelo site do GitHub
- **Imagem de compartilhamento:** *Settings › General › Social preview* (sugestão: `docs/imagens/menu.png`). Ainda não enviada.

## Registro de homologação
Todas as versões foram validadas no Moodle simulado. A criação de conteúdo foi confirmada no Moodle real do SENAI (0.18.0). Falta homologar no FIEG.

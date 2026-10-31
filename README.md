# Unidigit@l Assist

Ferramentas do tutor EaD dentro do Moodle: **corrigir, cobrar pendências, acompanhar alunos e gerar relatórios** sem sair da tela. É uma extensão do Chrome (Manifest V3) para os ambientes `ead.senai.br` e `ead.fieg.com.br`.

> **Nada roda sozinho.** Cada ferramenta só age quando você clica, e nada é gravado no Moodle sem a sua confirmação. Os dados dos alunos não saem do seu navegador.

> **Unidigit@l Assist** — ferramentas do tutor EaD para o Moodle.
>
> ⭐ Se a ferramenta ajuda no seu dia a dia, deixe uma estrela neste repositório: ajuda quem desenvolve a continuar.

## O que faz

| Ferramenta | Onde funciona | O que entrega |
|---|---|---|
| **Pendências** | Curso e categoria | Radar do que falta corrigir, por atividade; baixa os envios e mostra a **vigência da UC** (lida do campo "Período:" do resumo do curso). |
| **Correção** | Curso, categoria e atividade | Lançamento de notas e feedback por CSV/XLSX, com prévia, confirmação e conferência depois de salvar (o mesmo painel do Importar Notas). |
| **Alunos e notas** | Curso | Lista de alunos com filtros (último acesso, itens com nota, pendências, situação), boletim e leitura que pode ser **continuada** se falhar. |
| **Acompanhamento** | Curso | Alunos em risco, motivo e próxima ação; envio de mensagem pelo Moodle, sempre com revisão antes. |
| **Relatório da UC** | Curso | Todos os alunos, desempenho, entregas, pendências e nota por atividade; **exporta em HTML** (arquivo único, abre offline), além de CSV e PDF. |

## Instalar

1. Baixe o ZIP da versão mais recente em **[Releases](../../releases)** e extraia.
2. No Chrome, abra `chrome://extensions`, ligue o **Modo do desenvolvedor** e clique em **Carregar sem compactação**, escolhendo a pasta extraída.
3. Abra uma página do Moodle: o botão da ferramenta aparece na lateral direita.

Se a extensão **Importar Notas** original estiver ativa, desative-a: as duas desenhariam a mesma barra.

## Desenvolver

Requisitos: Node 20 ou mais novo.

```bash
npm ci
npm run build       # monta a extensão em dist/ext
npm test            # testes unitários (node:test + jsdom)
npm run validate    # manifesto, permissões e arquivos
npm run package     # gera dist/<nome>-<versão>.zip
npm run test:e2e    # Chromium real + Moodle simulado (precisa de Playwright global)
```

- `npm run sync` atualiza a cópia do código dos projetos de origem (Importar Notas e Assistente EaD) em `vendor/`; só é preciso quando esses projetos mudam, e eles devem estar em pastas ao lado deste.
- Estrutura e decisões: [`docs/contexto/`](docs/contexto) (produto, arquitetura, regras, design, tarefas e histórico de decisões).
- Fluxo de contribuição: [`CONTRIBUTING.md`](.github/CONTRIBUTING.md). Histórico de versões: [`CHANGELOG.md`](CHANGELOG.md).

## Estrutura do repositório

```
src/            código da extensão (launcher, módulos Importar Notas e Alunos, painel de blocos opcional)
tests/          testes unitários e e2e (Chromium + Moodle simulado)
scripts/        build, validação, empacotamento, sincronização e configuração do GitHub
docs/           contexto do projeto, mockups, créditos/privacidade e histórico (veja docs/README.md)
icons/          ícones da extensão
.github/        CI, release, templates, CONTRIBUTING e SECURITY
```

## Segurança e privacidade

- Permissões mínimas: `scripting`, `storage`, `downloads` e os dois domínios do Moodle. Nenhum serviço externo, nenhum script remoto.
- Dados de alunos ficam no navegador; relatórios exportados são arquivos locais. Veja [`PRIVACIDADE.md`](docs/projeto/PRIVACIDADE.md) e [`SECURITY.md`](.github/SECURITY.md).
- **Estado de homologação:** testado em páginas simuladas; a validação no Moodle real do SENAI/FIEG é feita por versão e registrada no `CHANGELOG`.

## Créditos e licença

Idealização e desenvolvimento: **Eurico Cirilo**. Importador de Notas 0.8.1: coautoria de **Julio Alves**. Detalhes em [`CREDITOS.md`](docs/projeto/CREDITOS.md).

Licença [MIT](LICENSE) — © 2026 Eurico Cirilo. Uso, cópia e modificação livres, mantendo o aviso de copyright.

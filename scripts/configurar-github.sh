#!/usr/bin/env bash
# Configura o repositório no GitHub (uma vez). Precisa do GitHub CLI logado com a sua conta:  gh auth login
# Uso:  bash scripts/configurar-github.sh            (configura tudo, mantém a visibilidade atual)
#       bash scripts/configurar-github.sh --privado  (também torna o repositório privado)
set -u
R="euriconetoia-cmyk/Unidigit-l-Assist"
ok()   { printf '  ✓ %s\n' "$1"; }
falha() { printf '  ! %s (veja a mensagem acima; pode depender do plano do GitHub)\n' "$1"; }

echo "Repositório: $R"
gh repo edit "$R" \
  --description "Unidigit@l Assist — ferramentas do tutor EaD para o Moodle (correção, pendências, alunos e relatórios)" \
  --enable-wiki=false --enable-projects=false \
  --delete-branch-on-merge --enable-squash-merge --enable-merge-commit=false --enable-rebase-merge=false \
  --add-topic moodle --add-topic chrome-extension --add-topic ead --add-topic tutoria --add-topic senai \
  && ok "descrição, tópicos e modo de merge (somente squash, apaga branch ao mesclar)" || falha "ajustes gerais"

if [ "${1:-}" = "--privado" ]; then
  gh repo edit "$R" --visibility private --accept-visibility-change-consequences && ok "repositório privado" || falha "visibilidade"
fi

for l in "bug|d73a4a|Algo não funciona" "melhoria|0b5cad|Ideia ou melhoria" "dependências|ededed|Atualização de dependências"; do
  IFS='|' read -r nome cor desc <<<"$l"
  gh label create "$nome" --color "$cor" --description "$desc" --force >/dev/null 2>&1 && ok "etiqueta $nome" || falha "etiqueta $nome"
done

gh api -X PUT "repos/$R/vulnerability-alerts" >/dev/null 2>&1 && ok "alertas de dependências vulneráveis" || falha "alertas de vulnerabilidade"
gh api -X PUT "repos/$R/automated-security-fixes" >/dev/null 2>&1 && ok "correções automáticas de segurança (Dependabot)" || falha "Dependabot security updates"
gh api -X PUT "repos/$R/private-vulnerability-reporting" >/dev/null 2>&1 && ok "relato privado de vulnerabilidade" || falha "relato privado"

# main protegida: só entra por Pull Request com o CI verde ("Testes, build e validação"); sem force-push nem exclusão.
gh api -X PUT "repos/$R/branches/main/protection" --input - >/dev/null 2>&1 <<'JSON' && ok "proteção da branch main" || falha "proteção da branch main"
{
  "required_status_checks": { "strict": true, "contexts": ["Testes, build e validação"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0, "dismiss_stale_reviews": true },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON

# Primeira release: cria a tag v0.8.1 em main, o que dispara o workflow "Release" (publica o ZIP).
SHA="$(gh api "repos/$R/commits/main" -q .sha)"
gh api -X POST "repos/$R/git/refs" -f ref="refs/tags/v0.8.1" -f sha="$SHA" >/dev/null 2>&1 && ok "tag v0.8.1 criada (a release aparece em alguns minutos)" || falha "tag v0.8.1 (já existe?)"
echo "Pronto. Confira em: https://github.com/$R/settings"

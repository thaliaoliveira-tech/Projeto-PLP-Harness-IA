#!/usr/bin/env bash
# Gera docs/historico-git.md: o histórico do repositório principal e de cada execução (ramos importados).
set -euo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"
SAIDA=docs/historico-git.md
{
  echo "# Histórico git"
  echo
  echo "Gerado em $(date '+%d/%m/%Y %H:%M') por \`scripts/gerar-historico-git.sh\`."
  echo
  echo "## Repositório principal (main)"
  echo
  echo "| Data | Commit | Mensagem |"
  echo "|---|---|---|"
  git log main --reverse --date=format:'%d/%m/%Y %H:%M' --pretty='| %ad | `%h` | %s |'
  for ramo in $(git for-each-ref --format='%(refname:short)' refs/heads/execucoes refs/heads/ensaio 2>/dev/null); do
    echo
    echo "## Execução \`$ramo\`"
    echo
    echo "| Data | Commit | Autor | Mensagem |"
    echo "|---|---|---|---|"
    git log "$ramo" --reverse --date=format:'%d/%m/%Y %H:%M' --pretty='| %ad | `%h` | %an | %s |'
    echo
    echo "Diferença da entrega inicial para o final: \`git diff $ramo/entrega $ramo/final --stat\`"
  done
} > "$SAIDA"
echo "✔ $SAIDA"

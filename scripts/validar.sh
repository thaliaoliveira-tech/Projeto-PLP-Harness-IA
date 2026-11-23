#!/usr/bin/env bash
# Validação completa do projeto (parte do harness).  Uso: npm run validate
# Roda todas as etapas (mesmo que uma falhe) e termina com "VALIDAÇÃO OK" ou "VALIDAÇÃO FALHOU".
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
source scripts/lib/node.sh
source scripts/lib/registrar.sh
export NO_COLOR=1 FORCE_COLOR=0 CI=1

ETAPAS=(
  "tipos|npx tsc --noEmit -p tsconfig.json"
  "lint|npx oxlint --type-aware src/ test/"
  "regras-reativas|node scripts/verificar-reatividade.mjs"
  "dependencias|npx depcruise src --config .dependency-cruiser.cjs --output-type err"
  "estrutura|node scripts/verificar-estrutura.mjs"
  "testes-unitarios|npx vitest run --passWithNoTests"
  "testes-contrato|npx vitest run --config vitest.config.e2e.ts"
)

mkdir -p .harness/validacao
falhas=()
for etapa in "${ETAPAS[@]}"; do
  nome="${etapa%%|*}"; comando="${etapa#*|}"
  inicio=$(date +%s)
  if bash -c "$comando" > ".harness/validacao/$nome.log" 2>&1; then
    printf '✔ %-17s %3ss\n' "$nome" "$(( $(date +%s) - inicio ))"
  else
    printf '✖ %-17s %3ss\n' "$nome" "$(( $(date +%s) - inicio ))"
    falhas+=("$nome")
    echo "──── saída de '$nome' (últimas 80 linhas; completa em .harness/validacao/$nome.log) ────"
    tail -n 80 ".harness/validacao/$nome.log" | sed 's/\x1b\[[0-9;]*m//g'
    echo "────"
  fi
done

if [ ${#falhas[@]} -eq 0 ]; then
  registrar "validate ok"
  echo "VALIDAÇÃO OK"
  exit 0
fi
registrar "validate falhou ${falhas[*]}"
echo "VALIDAÇÃO FALHOU: ${falhas[*]}"
exit 1

#!/usr/bin/env bash
# Hook Stop: quando o agente tenta encerrar, roda "npm run validate".
# Se falhar, bloqueia o encerramento e devolve os erros ao agente (no máximo 3 vezes por pedido do usuário).
cd "${CLAUDE_PROJECT_DIR:-$(dirname "${BASH_SOURCE[0]}")/../..}" || exit 0
source scripts/lib/node.sh
source scripts/lib/registrar.sh
LIMITE=3
CONTADOR=.harness/bloqueios-stop
mkdir -p .harness
cat > /dev/null   # descarta a entrada JSON do hook (não é necessária)

saida="$(bash scripts/validar.sh 2>&1)"; status=$?
if [ $status -eq 0 ]; then
  rm -f "$CONTADOR"
  registrar "stop liberado (validação ok)"
  exit 0
fi

n=$(cat "$CONTADOR" 2>/dev/null || echo 0)
if [ "$n" -ge "$LIMITE" ]; then
  rm -f "$CONTADOR"
  registrar "stop liberado (limite de $LIMITE bloqueios atingido)"
  exit 0
fi
n=$((n + 1)); echo "$n" > "$CONTADOR"
registrar "stop bloqueado $n/$LIMITE"

motivo="[harness] A validação do projeto (npm run validate) falhou — bloqueio $n de $LIMITE. Corrija os problemas abaixo e rode npm run validate novamente antes de encerrar.

$(printf '%s\n' "$saida" | tail -n 120)"
node -e 'process.stdout.write(JSON.stringify({ decision: "block", reason: process.argv[1] }))' "$motivo"
exit 0

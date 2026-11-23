#!/usr/bin/env bash
# Hook UserPromptSubmit: cada novo pedido do usuário zera o contador de bloqueios do hook Stop.
# Não pode escrever nada no stdout (seria injetado no contexto do agente).
cd "${CLAUDE_PROJECT_DIR:-$(dirname "${BASH_SOURCE[0]}")/../..}" || exit 0
source scripts/lib/registrar.sh
cat > /dev/null
rm -f .harness/bloqueios-stop
registrar "prompt recebido"
exit 0

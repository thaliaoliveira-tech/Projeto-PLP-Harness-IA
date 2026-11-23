#!/usr/bin/env bash
# Hook PostToolUse (Edit|Write|MultiEdit): verifica as regras reativas no arquivo editado.
# Saída 2 + stderr => o Claude Code mostra as violações ao agente.
cd "${CLAUDE_PROJECT_DIR:-$(dirname "${BASH_SOURCE[0]}")/../..}" || exit 0
source scripts/lib/node.sh
exec node scripts/verificar-reatividade.mjs --hook

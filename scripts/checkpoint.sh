#!/usr/bin/env bash
# Atalho para: node scripts/experimento.mjs checkpoint ...  (ver experimento/protocolo.md)
set -euo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$RAIZ/scripts/lib/comum.sh"
exec node "$RAIZ/scripts/experimento.mjs" checkpoint "$@"

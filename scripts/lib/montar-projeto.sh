#!/usr/bin/env bash
# Monta um projeto NestJS pronto para uso a partir das camadas versionadas no repositório.
#
# Uso: scripts/lib/montar-projeto.sh <destino> <variante> [--overlay <dir>]... [--sem-install]
#   variante: base     -> só projetos/base               (execuções do grupo A, sem harness)
#             harness  -> projetos/base + projetos/harness (execuções do grupo B, com harness)
#   --overlay <dir>    -> aplica por cima mais uma camada (usado pelo gabarito/anti-gabarito)
#   --sem-install      -> não roda "npm ci"
#
# O destino não pode existir. node_modules/ e dist/ nunca são copiados.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$RAIZ/scripts/lib/comum.sh"

[ $# -ge 2 ] || { echo "uso: $0 <destino> <base|harness> [--overlay dir]... [--sem-install]" >&2; exit 2; }
DEST="$1"; VARIANTE="$2"; shift 2
OVERLAYS=(); INSTALAR=1
while [ $# -gt 0 ]; do
  case "$1" in
    --overlay) OVERLAYS+=("$2"); shift 2 ;;
    --sem-install) INSTALAR=0; shift ;;
    *) echo "opção desconhecida: $1" >&2; exit 2 ;;
  esac
done

[ -e "$DEST" ] && { echo "erro: destino já existe: $DEST" >&2; exit 1; }
case "$VARIANTE" in base|harness) ;; *) echo "variante inválida: $VARIANTE" >&2; exit 2 ;; esac

EXCLUIR=(--exclude node_modules --exclude dist --exclude .harness --exclude coverage --exclude '*.tsbuildinfo')

mkdir -p "$DEST"
rsync -a "${EXCLUIR[@]}" "$RAIZ/projetos/base/" "$DEST/"
if [ "$VARIANTE" = harness ]; then
  rsync -a "${EXCLUIR[@]}" "$RAIZ/projetos/harness/" "$DEST/"
fi
for o in "${OVERLAYS[@]}"; do
  # Um overlay substitui por completo as pastas src/ e test/ que ele trouxer.
  for pasta in src test; do
    if [ -d "$o/$pasta" ]; then rm -rf "${DEST:?}/$pasta"; fi
  done
  rsync -a "${EXCLUIR[@]}" "$o/" "$DEST/"
done

if [ "$INSTALAR" = 1 ]; then
  (cd "$DEST" && npm ci --prefer-offline --no-audit --no-fund --loglevel=error > /dev/null)
fi
echo "$DEST"

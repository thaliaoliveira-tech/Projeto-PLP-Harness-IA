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
  # Um overlay substitui por completo a pasta src/ (se trouxer uma) e acrescenta os demais arquivos.
  # REMOVER.txt (opcional) lista caminhos a apagar do projeto montado (ex.: testes do exemplo).
  if [ -d "$o/src" ]; then rm -rf "${DEST:?}/src"; fi
  rsync -a "${EXCLUIR[@]}" --exclude REMOVER.txt "$o/" "$DEST/"
  if [ -f "$o/REMOVER.txt" ]; then
    while IFS= read -r caminho; do
      [ -n "$caminho" ] && rm -rf "${DEST:?}/$caminho"
    done < "$o/REMOVER.txt"
  fi
done

# Cada projeto montado é um repositório git próprio (ferramentas como o oxlint respeitam o
# .gitignore do repositório que contém a pasta; sem isso herdariam as regras do repositório principal).
(cd "$DEST" && git init -q && git symbolic-ref HEAD refs/heads/main)

if [ "$INSTALAR" = 1 ]; then
  (cd "$DEST" && npm ci --prefer-offline --no-audit --no-fund --loglevel=error > /dev/null)
fi
echo "$DEST"

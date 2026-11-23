# Funções e variáveis compartilhadas pelos scripts (carregar com: source scripts/lib/comum.sh)

# Node.js: nesta máquina o Node 24 não está no PATH de shells não interativos.
if ! command -v node > /dev/null 2>&1; then
  for d in /usr/local/node-v24*/bin "$HOME"/.nvm/versions/node/v24*/bin; do
    [ -x "$d/node" ] && export PATH="$d:$PATH" && break
  done
fi
command -v node > /dev/null 2>&1 || { echo "erro: Node.js 24 não encontrado no PATH" >&2; exit 1; }

RAIZ="${RAIZ:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
